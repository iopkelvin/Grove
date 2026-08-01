# Grove — User Manual

> **A note on timing.** This manual describes Grove as it is once both parts
> of the production-hardening work have landed. The backend landed first, on
> its own; the frontend rewrite is a separate pull request. Until that
> merges, **Settings, dark mode and the redesigned empty/error states are not
> yet on `development`** — everything else described here is. See
> [DEVELOPMENT_PLAN.md](DEVELOPMENT_PLAN.md) for the sequencing.

## What Grove is

Grove is a productivity app for students. You keep your tasks in it, and
every day you finish at least one, a tree grows. Miss a day and the streak
resets — the tree stops growing, but it remembers how far it got.

The point is the second half. A to-do list tells you what you have not done.
Grove tries to show you what you have, and to make studying feel less
solitary: you can see which friends are online and sit in a shared study
room with them while you work.

## Who it is for

Students who study alone but would rather not. Specifically, people who:

- keep a running list of coursework and want it in one place,
- respond better to a visible streak than to a deadline,
- study at the same times as their friends but not in the same room.

It is not a project manager. There are no assignees, no sub-tasks and no
Gantt charts, and there will not be.

---

## Before you start

### Devices and browsers

Grove runs in a browser. It has been tested on:

| Browser | Version | Result |
|---|---|---|
| Chrome (desktop) | 120+ | Fully supported |
| Firefox (desktop) | 121+ | Fully supported |
| Safari (macOS) | 17+ | Fully supported |
| Safari (iOS) | 17+ | Supported; layout collapses to one column |
| Chrome (Android) | 120+ | Supported; layout collapses to one column |

Below 640px wide the three-column home page becomes a single column and type
sizes shrink. Everything remains usable; nothing is hidden.

Internet Explorer and legacy Edge are not supported.

### What you need

- An email address you can receive mail at.
- A network connection. Grove does not work offline — it will tell you when
  it cannot reach the server rather than silently showing stale data.

---

## Getting started

### 1. Create an account

1. Open Grove. You will land on the **Log In** page.
2. Click **Sign up** at the bottom.
3. Fill in first name, last name, email and a password of at least 8
   characters.
4. Click **Sign Up**.

**What you should see:** either you are taken straight to your home page, or
you see a message asking you to confirm your email first.

Which one depends on how the Supabase project is configured. If you are
asked to confirm, open the email, click the link, then come back and log in
— your Grove profile is created automatically the first time you sign in.

**Your username** is generated from your email. `kelvin@berkeley.edu`
becomes `kelvin`. If somebody already has that username, you get `kelvin2`.
Your username is public and appears in your profile URL.

**If something goes wrong:** the form tells you which field is wrong and
why, underneath that field. A red message at the bottom of the form means
the problem was with the request rather than with what you typed.

### 2. Log in

1. Enter your email and password.
2. Click **Log In**.

**What you should see:** your home page, greeting you by first name.

If you were following a link to a specific page when you were asked to log
in, you are returned to that page rather than to the home page.

### 3. Find your way around

The **menu button** is in the top-right corner, next to the light/dark
toggle. It opens the navigation panel:

| Item | What it is |
|---|---|
| Home | Your streak tree, friends, and what to do next |
| Profile | Your public profile |
| Tasks | The full task list |
| Streaks | Streak history and the activity heatmap |
| Friends | Search for people, and manage requests |
| Lobby | The one study room everybody shares |
| Rooms | Study rooms you host or have joined |
| Settings | Theme, presence, account |

Press `Escape` to close the panel. The item you are currently on is
highlighted.

---

## Using Grove

### Tasks

#### Add a task

1. Go to **Tasks**.
2. Type into the box marked *Add a task…*.
3. Click **+**, or press Enter.

**What you should see:** the task appears at the top of the list
immediately.

For a due date or tags, click **More** before adding. Tags are
comma-separated: `College, Today`. Tag matching ignores case, so `today` and
`Today` are the same tag.

**Expected limits:** a title is required and can be up to 200 characters.
The description can be 2,000. You can have up to 20 tags on one task, and up
to 1,000 tasks in total.

#### Complete a task

Click the square to the left of it.

**What you should see:** the square becomes a tick, the title greys out and
is struck through, and — if this is your first completed task today — your
streak goes up.

The change appears instantly. If the server rejects it, the tick reverts and
a message explains why.

Completing a second task on the same day does **not** move the streak again.
Unticking and re-ticking does not either — the day is already counted.

#### Change or delete a task

Tags and due dates are set when you create a task. To remove one, click the
bin icon on the right of its row, then click **Delete** to confirm.

**Why it asks:** there is no undo. One misplaced click used to destroy a
task permanently.

#### Filter

The **All / Open / Done** tabs above the list filter it. When you have
completed tasks, a **Clear completed** link appears on the right and deletes
all of them at once.

### Streaks

Go to **Streaks**.

- **Current streak** — consecutive days you have completed at least one
  task, including today if you have.
- **Longest streak** — the best run you have ever had. It survives breaking
  the current one.
- **Active days** — every day you have ever completed something.
- **The heatmap** — the last 13 weeks. Darker means more tasks that day.
  Hover any square for the date and count.

If your streak is alive but you have not logged today, the page says so.
It stays quiet otherwise.

**Your tree** grows in five stages, at 0, 5, 10, 20 and 35 days. Past 35 the
shape is fixed and only the colours keep changing — the palette shifts
through spring, summer, autumn and winter every 30 days. The shape is
derived from your account, so it is yours and it never reshuffles.

### Friends

#### Find someone

1. Go to **Friends**.
2. Type at least two characters of their username or display name.

**What you should see:** results appear as you type. If nobody matches, it
says so.

Click **Add** to send a request. If you have already asked them, the button
says *Requested* instead — and it still says that after a reload.

#### Respond to a request

The **Requests** tab lists people waiting on you. Tick to accept, cross to
decline. The menu shows a badge with the number waiting.

If you both send each other a request, you simply become friends.

#### Remove a friend

**Friends** tab → **Remove**. Under **Sent**, the button says **Cancel** and
withdraws a request you sent.

A green dot next to a name means they are online — active in the last five
minutes, and not hiding their status.

### Study rooms

#### The Lobby

**Lobby** is the one room everybody shares. It shows how many people are
there and draws each of them as a tree, sized by their streak.

Click **Join the grove** to appear there. Click **Leave** to disappear.

**Expected behaviour:** the count updates about every 30 seconds. Someone
who closes their browser drops off within about five minutes — there is no
"user left" event to rely on, so presence is inferred from recent activity.

#### Your own rooms

1. Go to **Rooms** → **New room**.
2. Name it, pick a theme, optionally set a capacity.
3. Click **Create room**.

You are placed inside it automatically. Share the URL with a friend to
invite them.

**Expected limits:** five rooms per person; capacity between 1 and 50, or
blank for unlimited. A full room turns people away with a message.

Only the host can close a room, and closing asks for confirmation because it
removes the room for everyone in it.

### Profile

**Profile** shows your public page — the same one anybody visiting
`/user/<your-username>` sees.

Click the pencil to edit your name, display name and bio (500 characters).
Click your picture or banner to upload an image; they must be under 5MB.

Your email is only ever visible to you. It does not appear on your public
profile, in search results, in a friends list or in a room roster.

### Settings

- **Appearance** — Light, Dark, or *Match my system*, which follows your
  operating system and changes live. Remembered on this device.
- **Show when I am online** — turn it off and friends and study rooms show
  you as offline. You can still see everyone else and still join rooms.
- **Account** — your username, email and join date, and a log-out button.

---

## Known limitations

These are deliberate, and none of them are bugs.

| Limitation | Why |
|---|---|
| **No calendar.** The CalDAV integration is not built. `/api/calendar` returns a documented 501. | Out of scope for this milestone; tracked as a stretch goal. |
| **Message and Ping do nothing.** They appear on other people's profiles marked *Planned* and are disabled. | Not built. Shown rather than hidden so the plan is visible. |
| **Presence lags by up to five minutes.** | Inferred from recent requests, because browsers do not reliably announce that they have closed. |
| **Room presence polls every 30 seconds.** It is not instant. | Websockets need infrastructure this deployment does not have. |
| **Un-completing a task does not undo streak credit.** | The day is already earned. This matches how habit trackers behave, and reversing it cannot be done correctly anyway — the counter alone cannot tell whether something else also finished that day. |
| **Task titles and tags are per-user.** Nothing is shared. | Task sharing is a stretch goal. |
| **No offline support.** | Grove is a thin client over an API. It reports connection failures rather than pretending. |
| **Deleting a task is permanent.** | There is no undo, hence the confirmation step. |
| **The free API host sleeps.** The first request after a quiet period can take 30–60 seconds. | Free tier. Requests time out at 15 seconds and offer a retry rather than spinning forever. |

---

## Troubleshooting

### "Your session has expired. Please log in again."

Your access token has passed its expiry and could not be refreshed. Log in
again. If it keeps happening within minutes, your device clock is probably
wrong — token expiry is checked against it.

### "Could not reach the server."

Grove could not get a response at all. Check your connection. If you are
running locally, check that the backend is up:
<http://localhost:5000/api/health>.

If the deployed API has been idle it may be waking up; wait half a minute
and press **Try again**.

### "Your account has not finished setting up."

Your Supabase login exists but your Grove profile does not — usually a
signup that was interrupted. Log out and log back in; the profile is created
on the way in.

### The page is blank, or says Grove hit an unexpected problem

Press **Try again**. If it persists, note the reference code shown on the
error screen and reload the page. That code identifies the exact request in
the server logs, so include it in any bug report.

### Running locally: a white page and a console error about `supabaseUrl`

`frontend/.env` is missing or incomplete. Copy `frontend/.env.example` to
`frontend/.env`, fill in `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`
from your Supabase project's **Settings → API**, then restart `npm run dev`.
Vite only reads env files at startup.

Recent builds show this as a readable message on the login page instead of a
blank screen.

### Running locally: every request 404s or fails CORS

`VITE_API_URL` is set when it should be empty. Leave it blank in
development so requests go through the Vite proxy.

### My streak did not go up

Check three things:

1. You completed a task **today** — the day is counted in your local
   timezone.
2. You had not already completed one today. Only the first counts.
3. The task went from unfinished to finished. Re-ticking one you had already
   done today does not count.

### Nobody shows as online

Somebody is "online" if they made a request in the last five minutes and
have not turned off **Show when I am online** in Settings. If everyone looks
offline and you know they are not, ask them to check that setting.

### An image will not upload

It must be an image file under 5MB. Grove checks before uploading, so the
message appears immediately rather than after a long wait.

---

## Getting help

Open an issue on the repository. The bug template asks for a **reference
id** — the code shown at the bottom of any error screen in Grove. Including
it turns a report into a single traceable line in the server logs and is the
difference between a fix in ten minutes and a fix in a day.
