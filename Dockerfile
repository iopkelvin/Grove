# Backend container.
#
# This file's entire previous contents were "# Kelvin", so `docker build .`
# failed and docker-compose.yml referenced an image that could not exist.
#
# Two stages: the first installs dependencies into a virtualenv, the second
# copies that virtualenv into a clean image. The build toolchain psycopg2
# needs never reaches the runtime image, which keeps it small and removes a
# compiler from the thing exposed to the internet.

# ── build ───────────────────────────────────────────────────────────────
FROM python:3.12-slim AS builder

ENV PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

# psycopg2-binary ships wheels, but gcc and libpq-dev are still needed if
# pip ever has to fall back to building from source on this platform.
RUN apt-get update \
    && apt-get install -y --no-install-recommends gcc libpq-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /build

RUN python -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

# Copied on its own so a code change does not invalidate the dependency
# layer — the difference between a five-second rebuild and a two-minute one.
COPY requirements.txt .
RUN pip install -r requirements.txt

# ── runtime ─────────────────────────────────────────────────────────────
FROM python:3.12-slim AS runtime

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PATH="/opt/venv/bin:$PATH" \
    FLASK_ENV=production

# libpq5 is the runtime half of libpq-dev; the compiler stays behind.
RUN apt-get update \
    && apt-get install -y --no-install-recommends libpq5 curl \
    && rm -rf /var/lib/apt/lists/*

# Never run as root. A container breakout is a much smaller problem when the
# process inside it owns nothing.
RUN useradd --create-home --shell /usr/sbin/nologin grove

COPY --from=builder /opt/venv /opt/venv

WORKDIR /app
COPY --chown=grove:grove api ./api
COPY --chown=grove:grove migrations ./migrations
COPY --chown=grove:grove app.py pyproject.toml ./

USER grove

EXPOSE 5000

# Uses the liveness endpoint, which deliberately does not touch the
# database — see api/routes/health.py for why.
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD curl --fail --silent http://localhost:5000/api/health || exit 1

# Two workers with two threads each fits a small instance. --access-logfile -
# sends request logs to stdout, where the platform can collect them.
CMD ["gunicorn", \
     "--bind", "0.0.0.0:5000", \
     "--workers", "2", \
     "--threads", "2", \
     "--timeout", "60", \
     "--access-logfile", "-", \
     "--error-logfile", "-", \
     "app:app"]
