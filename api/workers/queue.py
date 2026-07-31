"""Grove — background work.

The development plan lists "Processing and Async: processing of calls either
in memory or asynchronous". This is that, kept deliberately small.

Two kinds of work do not belong on the request path:

* **Fire-and-forget side effects.** Recording that someone was seen should
  never be the reason a user waits for their page.
* **Periodic maintenance.** Room memberships accumulate forever unless
  something sweeps the ones whose owner has clearly gone.

WHY NOT CELERY / RQ
-------------------
Both need a broker (Redis) this project does not deploy and a second process
type Render's free tier does not offer. A bounded in-process thread pool
covers everything above with no new infrastructure. The tradeoff is explicit
and worth naming: **queued work does not survive a restart**, so nothing
enqueued here may be the only copy of something that matters. Every current
job is idempotent and safe to skip entirely.

Each job runs inside its own Flask application context and its own database
session, and always closes that session — a leaked session in a worker
thread holds a pooled connection open until the process dies.
"""

from __future__ import annotations

import atexit
import contextlib
import queue
import threading
import time
from collections.abc import Callable
from dataclasses import dataclass, field
from typing import Any

from api.utils.logger import get_logger, get_request_id, new_request_id, set_request_id

_null_context = contextlib.nullcontext

logger = get_logger(__name__)

DEFAULT_WORKERS = 2
DEFAULT_MAX_QUEUE = 512
# How long stop() waits for in-flight jobs before giving up and letting the
# daemon threads die with the process.
SHUTDOWN_GRACE_SECONDS = 5.0
# How often the maintenance schedule runs.
SWEEP_INTERVAL_SECONDS = 30 * 60


@dataclass
class Job:
    func: Callable[..., Any]
    args: tuple = ()
    kwargs: dict = field(default_factory=dict)
    name: str = ""

    def label(self) -> str:
        return self.name or getattr(self.func, "__name__", repr(self.func))


class BackgroundQueue:
    """A tiny bounded thread pool bound to one Flask app.

    `eager` mode runs every job inline on submit. Tests use it so asserting
    on a job's effect never needs a sleep or a retry loop, which is the
    usual source of flaky background-work tests.
    """

    def __init__(
        self,
        app,
        *,
        workers: int = DEFAULT_WORKERS,
        max_queue: int = DEFAULT_MAX_QUEUE,
        eager: bool = False,
    ) -> None:
        self.app = app
        self.eager = eager
        self._queue: queue.Queue[Job | None] = queue.Queue(maxsize=max_queue)
        self._threads: list[threading.Thread] = []
        self._stopping = threading.Event()
        self._worker_count = workers

        # Counters, so the health endpoint can show whether background work
        # is actually flowing rather than silently wedged.
        self.submitted = 0
        self.completed = 0
        self.failed = 0
        self.dropped = 0
        self._lock = threading.Lock()

    # ── lifecycle ───────────────────────────────────────────────────────

    def start(self) -> None:
        if self.eager or self._threads:
            return

        for index in range(self._worker_count):
            thread = threading.Thread(
                target=self._run, name=f"grove-worker-{index}", daemon=True
            )
            thread.start()
            self._threads.append(thread)

        logger.info("background queue started", extra={"workers": self._worker_count})

    def stop(self, timeout: float = SHUTDOWN_GRACE_SECONDS) -> None:
        if not self._threads:
            return

        self._stopping.set()
        for _ in self._threads:
            # A sentinel per worker; put_nowait so a full queue cannot make
            # shutdown itself block.
            with contextlib.suppress(queue.Full):
                self._queue.put_nowait(None)

        deadline = time.monotonic() + timeout
        for thread in self._threads:
            thread.join(timeout=max(0.0, deadline - time.monotonic()))

        self._threads.clear()
        logger.info("background queue stopped", extra={"completed": self.completed})

    # ── submission ──────────────────────────────────────────────────────

    def submit(self, func: Callable[..., Any], *args, name: str = "", **kwargs) -> bool:
        """Queue a job. Returns False if it was dropped.

        Never raises and never blocks: a background side effect must not be
        able to fail the request that triggered it. A full queue means the
        workers are behind, and dropping the kind of work that goes here —
        presence and cleanup — is strictly better than stalling a user.
        """
        job = Job(func=func, args=args, kwargs=kwargs, name=name)

        if self.eager:
            self._execute(job)
            return True

        try:
            self._queue.put_nowait(job)
        except queue.Full:
            with self._lock:
                self.dropped += 1
            logger.warning("background queue full, dropping job", extra={"job": job.label()})
            return False

        with self._lock:
            self.submitted += 1
        return True

    # ── internals ───────────────────────────────────────────────────────

    def _run(self) -> None:
        while not self._stopping.is_set():
            try:
                job = self._queue.get(timeout=0.5)
            except queue.Empty:
                continue

            if job is None:  # shutdown sentinel
                self._queue.task_done()
                break

            try:
                self._execute(job)
            finally:
                self._queue.task_done()

    def _execute(self, job: Job) -> None:
        from flask import has_app_context

        from api.config.database import db

        # In eager mode the caller is usually already inside a request's app
        # context. Pushing another would give the job a *different* session
        # and then tear it down — harmless, but it makes eager and threaded
        # execution behave differently, which defeats the point of eager
        # mode being a faithful stand-in during tests.
        owns_context = not has_app_context()

        # Its own request id, so a background failure stays traceable and is
        # visibly not part of whatever request happened to enqueue it.
        previous_request_id = None if owns_context else get_request_id()
        set_request_id(f"bg-{new_request_id()[:8]}")

        try:
            with self.app.app_context() if owns_context else _null_context():
                try:
                    job.func(*job.args, **job.kwargs)
                    with self._lock:
                        self.completed += 1
                finally:
                    # Always release the session's connection back to the
                    # pool — but only the one this job opened.
                    if owns_context:
                        db.session.remove()
        except Exception:
            with self._lock:
                self.failed += 1
            # Never re-raise: an exception here would kill the worker thread
            # and silently stop all background processing for the process.
            logger.exception("background job failed", extra={"job": job.label()})
        finally:
            set_request_id(previous_request_id)

    def stats(self) -> dict:
        with self._lock:
            return {
                "submitted": self.submitted,
                "completed": self.completed,
                "failed": self.failed,
                "dropped": self.dropped,
                "pending": self._queue.qsize(),
                "eager": self.eager,
            }


class PeriodicScheduler:
    """Runs a callable every `interval` seconds on a daemon thread.

    One thread per job, which is fine at this scale and far easier to reason
    about than a timer wheel. Ticks are skipped rather than queued up if a
    run overruns.
    """

    def __init__(self, app, *, interval: float, func: Callable[[], Any], name: str) -> None:
        self.app = app
        self.interval = interval
        self.func = func
        self.name = name
        self._stopping = threading.Event()
        self._thread: threading.Thread | None = None

    def start(self) -> None:
        if self._thread is not None:
            return
        self._thread = threading.Thread(target=self._loop, name=self.name, daemon=True)
        self._thread.start()
        logger.info("scheduler started", extra={"job": self.name, "interval": self.interval})

    def stop(self) -> None:
        self._stopping.set()
        if self._thread is not None:
            self._thread.join(timeout=SHUTDOWN_GRACE_SECONDS)
            self._thread = None

    def _loop(self) -> None:
        from api.config.database import db

        # Waits first: firing every job the instant the process boots makes
        # every deploy do a burst of maintenance at its busiest moment.
        while not self._stopping.wait(self.interval):
            set_request_id(f"cron-{new_request_id()[:8]}")
            try:
                with self.app.app_context():
                    try:
                        self.func()
                    finally:
                        db.session.remove()
            except Exception:
                logger.exception("scheduled job failed", extra={"job": self.name})
            finally:
                set_request_id(None)


def init_background_workers(app, *, eager: bool | None = None) -> BackgroundQueue:
    """Attach a queue and the maintenance schedule to an app.

    Stored on `app.extensions` so routes reach it via
    `current_app.extensions["grove_queue"]` rather than a module-level
    global, which would be shared between apps and break the test suite.
    """
    from api.services import room as room_service

    is_eager = app.config.get("TESTING", False) if eager is None else eager

    background = BackgroundQueue(app, eager=is_eager)
    background.start()

    app.extensions["grove_queue"] = background
    app.extensions["grove_schedulers"] = []

    if not is_eager:
        sweeper = PeriodicScheduler(
            app,
            interval=SWEEP_INTERVAL_SECONDS,
            func=room_service.sweep_stale_memberships,
            name="grove-room-sweeper",
        )
        sweeper.start()
        app.extensions["grove_schedulers"].append(sweeper)

        @atexit.register
        def _shutdown() -> None:  # pragma: no cover — process teardown
            for scheduler in app.extensions.get("grove_schedulers", []):
                scheduler.stop()
            background.stop()

    return background
