# Simple Media Tracker

A minimal, easy to use, self-hosted media tracker for the movies, shows, games,
books, anime and manga you have watched, played and read. No metadata lookups,
no artwork, no recommendations: an entry has a type, a title, a status, an
optional completion date and an optional rating out of five stars, with a sixth
star for the exceptional ones. Dark-only, and backed by
[PocketBase](https://pocketbase.io).

I kept all of this in a Notion database for years. It worked, but it was
slow to open, didn't look great, and it lived on someone else's servers. The
self-hosted trackers I tried instead do far more than I wanted: scrapers,
artwork, recommendations, a page per title. This is the table I had in Notion
as a small app that starts fast, stays out of the way, and runs on your own
machine.

The library is **public to read** and **private to write** by default. Anyone
can browse it; only you can change it. Individual entries or whole media types
can be hidden from guests, and public viewing can be turned off entirely in
Settings.

Search by title, filter by status, and sort by title, by rating or by what you
finished most recently; a series opens onto its seasons in the same order.

- [Screenshots](#screenshots)
- [Demo](#demo)
- [Settings](#settings)
- [Calendar](#calendar)
- [Series and seasons](#series-and-seasons)
- [Deleting and restoring](#deleting-and-restoring)
- [Requirements](#requirements)
- [Quick start](#quick-start)
- [Unraid](#unraid)
- [First run](#first-run)
- [Putting it on the internet](#putting-it-on-the-internet)
- [Backups](#backups)
- [Updating](#updating)
- [Local development](#local-development)

## Screenshots

Entries | Adding an Entry
:-------------------------:|:-------------------------:
![](https://github.com/user-attachments/assets/424ac898-dc98-41fa-9ce0-a3e7a1916738)  |  ![](https://github.com/user-attachments/assets/b3ad2623-a4c6-4db3-a5cf-bfd22def2c0d)
Calendar | Settings
![](https://github.com/user-attachments/assets/3034d802-872f-4a02-a58d-97475bb7e21d)  |  ![](https://github.com/user-attachments/assets/78a76a72-6224-4617-9c9a-9424013e6b6e)


## Demo

[![Open the demo at media.bradluke.com](https://img.shields.io/badge/Open_the_demo-media.bradluke.com-1f6feb?style=for-the-badge)](https://media.bradluke.com)

A live instance, open to browse as a guest — which is how a visitor sees any
library with public viewing on. Signing in is for its owner, so nothing there
can be added or changed, and anything hidden from guests stays hidden.

## Settings

Signed in, the gear icon opens Settings. Changes save themselves, and they live
in the database rather than your browser, so they apply to everyone who visits
the library.

- **Library name** — what the header and the browser tab call this library, up
  to 40 characters. Everyone who visits sees it, and emptying the box puts
  “media” back.
- **Media types** — turn any of the six types on or off. Anime and manga ship
  switched off. Turning a type off removes its tab and hides its entries; it
  deletes nothing, and turning it back on restores everything. At least one type
  has to stay on.
- **Rating scale** — out of 5 or out of 10 stars. Changing it converts every
  rating you have already given, and a dialog says how many will move before it
  happens. Rounding means the conversion is not exactly reversible.
- **Exceptional rating** — offer one star above the scale (6/5 or 11/10) for the
  rare favourites. Switching it off moves existing exceptional ratings down to
  the top of the normal scale.
- **Public viewing** — let anyone read the library without an account, or close
  it. Turning it off closes the API too, not just the interface: the
  `media_entries` read rule checks this setting, so nothing is readable without
  signing in. Entries already marked hidden keep that mark and it applies again
  if you turn public viewing back on.
- **Shown to guests** — with public viewing on, keep whole types to yourself.
  Switch a type off here and guests lose its tab and every one of its entries,
  while you still see all of it signed in. Like hidden entries, this is enforced
  by the `media_entries` read rule rather than the interface, so it holds for
  the API too.
- **Finished dates** — whether an entry records the day you finished it.
  Switching it off takes the date out of the entry form, the column out of the
  library, the sort out of the toolbar and the calendar out of the header — the
  calendar is built from these dates and has nothing to show without them. Dates
  already saved are kept and show again if you turn it back on.
- **Recently deleted** — everything you deleted in the last 30 days, with
  Restore and Delete for good on each entry, and a button to empty it. See
  [Deleting and restoring](#deleting-and-restoring).

## Calendar

What you finished and when, built from completion dates. A month grid, or a year
as twelve rows of titles — click a month there to open it. Entries without a
completion date do not appear. Signed in, clicking an entry opens it for editing.
The page follows the **Finished dates** setting: switch those off and the
calendar goes with them.

## Series and seasons

A show can be broken into seasons. A season is an ordinary entry that points at
its series, so it keeps its own rating, status and completion date, while the
series keeps a rating of its own — a series is often worth more or less than the
average of its parts, so that number is yours to set rather than computed.

A completion date is a fact rather than a judgement, so a series does take one
from its seasons: mark the series completed without giving it a date and it
shows the latest date among its seasons, greyed out to say where it came from.
A date you set on the series yourself always wins, and a series you are still
watching stays undated — the latest season tells you when you last watched it,
which is not the same as having finished. Nothing is written to the series, so
the calendar still shows the season you actually finished rather than both.

In the library a series shows as one row with a season count; expand it to see
the seasons. Counts and the "showing x of y" summary count series, not seasons.
Searching a season surfaces the series it belongs to. Deleting a series deletes
its seasons too, and the dialog says how many before you confirm.

To make an entry a season, use the searchable **Season of** picker in its edit
dialog. To add a new season to a series, choose **Add season** from the series'
row menu, which opens a new entry with **Season of** already set to it. Only
shows and anime can have seasons, and nesting is one level deep: a season cannot
have seasons.

## Deleting and restoring

Deleting an entry moves it to **Recently deleted** rather than removing it.
Straight after, an Undo button at the bottom of the screen puts it back; after
that, the Recently deleted card at the bottom of Settings lists everything
deleted in the last 30 days, with how long each has left. Restore puts an entry
back as it was — same rating, dates and series. Delete for good removes it
there and then, and **Empty Recently deleted** clears the whole bin at once.

A series goes in with its seasons and comes back with the same ones. A season
you deleted on its own before deleting its series stays a separate row, since
you had already taken it out; restoring it brings the series back too, because
a season cannot stand without one. For the same reason a season cannot be added
to a series while the series is in the bin.

Anything left for 30 days is removed for good by an hourly job on the server,
whether or not anyone opens the app. Guests never see what is in the bin — the
API refuses them deleted entries as it does hidden ones. The bin is also the only
way out: the plain records API no longer deletes entries, even for the owner, so
nothing skips the 30 days by accident.

## Requirements

- Docker with Compose v2.24 or newer, **or** Node.js 24+ for local development.
- Nothing else. The PocketBase executable is downloaded and checksum-verified
  during the build, so there is no binary committed to this repository.

## Quick start

Two ways to run it. Both end up in the same place: the app at the address
`WEB_PUBLISH` publishes — **<http://127.0.0.1:8090>** by default — and the
PocketBase dashboard at `/_/` on the same address. Every other address this
README gives for reaching the app or its dashboard is written with that
default; substitute yours if you changed it.

That address is bound to localhost on purpose — see
[Putting it on the internet](#putting-it-on-the-internet) before exposing
anything, because exposing the app exposes the dashboard with it.

### From published images

No source checkout, nothing to build. Make a directory for it:

```bash
mkdir -p media-tracker/pb_data && cd media-tracker
```

Save this as `compose.yaml` beside that `pb_data` directory:

```yaml
services:
  pocketbase:
    image: ghcr.io/bradley-varol/simple-media-tracker-pocketbase:${MEDIA_TRACKER_VERSION:-latest}
    # Loopback by default. Note that this port also serves the superuser
    # dashboard at /_/, which has full database access: before publishing it
    # anywhere, restrict the dashboard to the addresses you use it from with
    # `superuser ips` — see the README.
    ports:
      - "${WEB_PUBLISH:-127.0.0.1:8090}:8091"
    volumes:
      # Long syntax so create_host_path can be turned off: a missing ./pb_data
      # would otherwise be created by Docker as root, which this container runs
      # too unprivileged to write. Being told the directory is missing beats
      # debugging a database that will not open.
      - type: bind
        source: ./pb_data
        target: /pb_data
        bind:
          create_host_path: false
    # Must match the owner of ./pb_data on the host. `id -u` / `id -g`.
    user: "${PUID:-1000}:${PGID:-1000}"
    security_opt:
      - no-new-privileges:true
    healthcheck:
      test: ["CMD", "wget", "--quiet", "--spider", "http://127.0.0.1:8091/api/health"]
      interval: 5s
      timeout: 3s
      retries: 10
      start_period: 10s
    restart: unless-stopped
```

Then start it:

```bash
docker compose up -d
```

Rather not paste? The same file is in the repository as `compose.ghcr.yaml`.
Save it under the default name and every command in this README works as
written:

```bash
curl -fsSL -o compose.yaml https://raw.githubusercontent.com/bradley-varol/simple-media-tracker/main/compose.ghcr.yaml
```

The image is published for amd64 and arm64, so this works on a Raspberry Pi or
an Apple Silicon Mac without building anything.

### From source

Build it yourself, which is also what you want if you intend to change anything:

```bash
git clone https://github.com/bradley-varol/simple-media-tracker.git
cd simple-media-tracker
mkdir -p pb_data
docker compose up --build -d
```

### If the port is already taken

Docker refuses to start the container and says so: `port is already
allocated` if another container has it, or `address already in use` if
something outside Docker does. Put a free one in a `.env` file beside the
compose file — `WEB_PUBLISH=127.0.0.1:8092`, say — and start it again.

### If pb_data is not yours

The container runs unprivileged and keeps the database in `./pb_data`, so that
directory has to belong to the user in the compose file. If it does not, set
`PUID` and `PGID` in a `.env` file to match `id -u` and `id -g`. Copy
`.env.example` to `.env` for the full list of settings.

Creating `pb_data` yourself, as both quick starts do, is the part worth not
skipping: Docker creates a missing bind-mount source as **root**, and the
container cannot write it. Compose is told not to do that, so a missing
directory stops the stack with `bind source path does not exist` rather than
leaving you a root-owned one. If an older version left you one already, the
container says so on startup. Either way the fix is the same:

```bash
sudo chown -R "$(id -u):$(id -g)" pb_data
```

## Unraid

Unraid runs this fine, with one setup detail that matters more than the rest.

**Put `appdata` on a cache-only share.** PocketBase stores everything in SQLite,
and SQLite on Unraid's `/mnt/user` FUSE layer is a known cause of database
corruption. Set the `appdata` share to **Cache: Only** (or otherwise give it
exclusive access so it bypasses FUSE) before pointing anything at it. This is a
lose-your-library problem, not a performance one.

Unraid has no built-in Docker Compose — it is coming in Unraid 8, but on 7.3.x
you need the **Compose Manager Plus** plugin from Community Applications. Once
it is installed, this project needs no special build:

1. Add a new stack in the Compose plugin.
2. Paste this in as its compose file, then bring the stack up.

```yaml
services:
  pocketbase:
    image: ghcr.io/bradley-varol/simple-media-tracker-pocketbase:${MEDIA_TRACKER_VERSION:-latest}
    # Loopback by default. Note that this port also serves the superuser
    # dashboard at /_/, which has full database access: before publishing it
    # anywhere, restrict the dashboard to the addresses you use it from with
    # `superuser ips` — see the README.
    ports:
      - "0.0.0.0:8090:8091"
    volumes:
      # Long syntax so create_host_path can be turned off: a missing ./pb_data
      # would otherwise be created by Docker as root, which this container runs
      # too unprivileged to write. Being told the directory is missing beats
      # debugging a database that will not open.
      - type: bind
        source: /mnt/user/appdata/simple-media-tracker
        target: /pb_data
        bind:
          create_host_path: false
    # 99:100 is nobody:users, which owns appdata on Unraid.
    user: "99:100"
    security_opt:
      - no-new-privileges:true
    healthcheck:
      test: ["CMD", "wget", "--quiet", "--spider", "http://127.0.0.1:8091/api/health"]
      interval: 5s
      timeout: 3s
      retries: 10
      start_period: 10s
    restart: unless-stopped
```

That is the quick-start file with the three Unraid details already set. `99:100`
is `nobody:users`, which owns `appdata` — the default of `1000:1000` cannot write
there. The bind mount is absolute because the plugin has no project directory to
be relative to; change the path if your share is named differently.

The `ports` line is where to look if `8090` is already taken on your server:
put a free port on its left side, `0.0.0.0:8092:8091` say, and substitute it
wherever this README writes `8090`.

Publishing on `0.0.0.0` makes the app reachable from the rest of your LAN, which
is usually the point on Unraid. It makes the superuser dashboard at `/_/`
reachable from your LAN too, so restrict it to the machine you administer from
once the stack is up:

```bash
docker compose exec pocketbase pocketbase superuser ips 127.0.0.1 192.168.1.50 --dir /pb_data
```

Do not port forward it — see
[Putting it on the internet](#putting-it-on-the-internet) for the proper way to
expose this.

Everything else — creating the two accounts, backups, updating — works exactly
as described below.

## First run

The tracker starts empty and logged out. Visit it and, instead of a library,
you will see a short **Set up your library** form — nobody has an account yet.
Fill in an email and a password of at least 8 characters and submit; you are
signed in immediately, with full control of the library.

**That form only works once.** The moment the account exists, the endpoint
behind it refuses every request after, and a returning visitor sees the
ordinary login screen in its place instead. Finish this before putting the
instance anywhere but localhost — whoever reaches that form first becomes the
owner, the same assumption most self-hosted install wizards make.

That is everything most instances need. The PocketBase dashboard, at `/_/` on
the same address as the app, is only for administering the database directly,
and it needs a superuser. None exists by default — create one from the command
line when you need it:

```bash
docker compose exec pocketbase pocketbase superuser create you@example.com 'a-long-password' --dir /pb_data
```

Use `upsert` instead of `create` to reset the password of an account that
already exists. Running without Docker, drop the `docker compose exec pocketbase`
prefix and the `--dir` flag:

```bash
./pocketbase superuser create you@example.com 'a-long-password'
```

> Typing a password as a command argument leaves it in your shell history. Clear
> it afterwards, or set the account up and change the password from the
> dashboard.

Until a superuser exists, PocketBase also prints an installer link in the
container log on every start — `docker compose logs pocketbase` shows it — of
the form `http://0.0.0.0:8091/_/#/pbinstall/…`. It does the same job as the
command above, with three catches the command does not have. The `0.0.0.0` is
the address PocketBase binds inside the container, which no browser can open:
substitute the address `WEB_PUBLISH` publishes. The token in the link expires
30 minutes after the container started, and only a restart prints a fresh one.
And submitting its form is a superuser request like any other, so once the
dashboard is restricted with `superuser ips`, the link works only from an
address on that list and fails with "You are not allowed to perform this
request" from anywhere else.

> A superuser has complete access to the database, including every password
> hash. Keep the dashboard off the public internet — see
> [Putting it on the internet](#putting-it-on-the-internet) and
> [SECURITY.md](SECURITY.md).

## Putting it on the internet

The stack listens on loopback only. To reach it from anywhere else, put a
TLS-terminating reverse proxy in front of it. **Do not** change `WEB_PUBLISH`
to `0.0.0.0` and forward the port directly: passwords and session tokens would
cross the network in cleartext.

Give it a host of its own — `media.example.com` rather than
`example.com/media/`. The app, its assets and the API all load from the root of
whatever origin the browser sees, and there is no way to tell the bundle to
expect a prefix, so under a path it would ask for `example.com/assets/…` and
never load.

A complete Caddy example, which obtains a certificate automatically:

```caddyfile
media.example.com {
    # The address WEB_PUBLISH publishes: the default here, or yours if you
    # changed it.
    reverse_proxy 127.0.0.1:8090 {
        # Without this, PocketBase sees every request arriving from Caddy: one
        # rate limit bucket for all your visitors, and an IP allowlist that
        # cannot tell them apart. `header_up` overwrites the header, so a
        # client cannot forge it the way it can prepend to X-Forwarded-For.
        header_up X-Real-IP {remote_host}
    }
}
```

Then set the trusted proxy header to `X-Real-IP` in the dashboard's settings,
so PocketBase believes it. Leave that unset if nothing is proxying, or an
exposed instance will take a forged header at face value.

### The dashboard goes public with everything else

One port serves the app, the API and the superuser dashboard at `/_/`, and that
dashboard grants complete access to the database, including every password
hash. Publishing the app publishes it too.

Restrict it to the addresses you administer from before you expose anything:

```bash
docker compose exec pocketbase pocketbase superuser ips 127.0.0.1 203.0.113.7 --dir /pb_data
```

Everything else stays reachable; only `/_/` and the superuser endpoints are
restricted. Pass no addresses to clear the restriction again. With a dynamic
home address, allow `127.0.0.1` alone and reach the dashboard through a tunnel
to the address `WEB_PUBLISH` publishes:

```bash
ssh -L 8090:127.0.0.1:8090 you@your-server
```

Before going public, also:

- Use a long, unique password for both the superuser and the account you log
  into the tracker with. Rate limiting is enabled by migration, but it only
  slows an attacker down.
- Consider MFA on the superuser account, but know what it is first: PocketBase
  has no authenticator-app option, so MFA means a password **plus** a one-time
  code emailed to the account, and nothing here configures SMTP. Set up SMTP in
  the dashboard before turning it on, or you will be minting each code from the
  command line:

  ```bash
  docker compose exec pocketbase pocketbase superuser otp you@example.com --dir /pb_data
  ```

  That works, but it is a break-glass procedure rather than a way to log in.
  The IP allowlist above is the control doing the real work.

## Backups

Everything lives in `./pb_data`. It is a SQLite database, so copy it while the
stack is stopped, or use PocketBase's own backup feature (dashboard →
**Settings → Backups**), which snapshots safely while running.

```bash
docker compose stop pocketbase
tar czf media-backup-$(date +%F).tar.gz pb_data
docker compose start pocketbase
```

`pb_data` is gitignored and will never be committed.

## Updating

`docker compose pull` replaces the image and nothing else. The compose file is
part of what a release ships too, and the [CHANGELOG](CHANGELOG.md) says when
it moved. Each GitHub release carries its CHANGELOG entry as its notes, so
watching the repository's releases tells you when there is something to pull.

Running from published images:

```bash
docker compose pull
docker compose up -d --remove-orphans
```

When the release notes mention the compose file, take the new one first — the
repository's `compose.ghcr.yaml` again, saved under the default name:

```bash
curl -fsSL -o compose.yaml https://raw.githubusercontent.com/bradley-varol/simple-media-tracker/main/compose.ghcr.yaml
```

This matters more than it sounds. Pulling alone runs the new application
against the old file, and a file saved from an older README still has whatever
that README said. Re-fetching overwrites any edits of your own, so diff it
first if you have changed the file itself — the Unraid paste's `ports` line,
say. A port set in `.env` lives outside it and survives.

Running from source:

```bash
git pull
docker compose up --build -d --remove-orphans
```

`--remove-orphans` clears any container an older version defined and this one
does not, so nothing left behind keeps answering on a port the app now uses.

Migrations apply automatically at startup. The version you are running is shown
in the app footer. Back up `pb_data` first if the release notes mention a schema
change.

## Local development

```bash
npm install
npm run pocketbase   # fetches the pinned PocketBase executable if it is missing or stale
```

In another terminal:

```bash
npm run dev
```

The Vite dev server proxies `/api` to PocketBase, so the app talks to one origin
in development exactly as it does in production — no backend URL is baked into
the bundle.

`npm run dev` listens on localhost only. To reach it from a phone or another
machine on your network, use `npm run dev:host` — but treat that as a temporary,
trusted-network thing. The Vite dev server is not hardened and should never face
the internet.

To run the whole stack in containers with hot reload instead:

```bash
docker compose -f compose.dev.yaml up --build
```

`compose.dev.yaml` includes `compose.yaml`, so it stands on its own: one `-f`,
or a right-click in an editor that offers a "Compose Up" on the file.

That stack is worth making the default while you work on the app. The
production container builds the frontend into its image, so a plain
`docker compose up -d` keeps serving whatever was built last and your edits
never appear. Setting `COMPOSE_FILE` in `.env` points every compose command in
this directory at it:

```bash
COMPOSE_FILE=compose.dev.yaml
```

The dev stack mounts the source tree and serves it through Vite, so changed
files take effect straight away. Leave that line commented out on anything you
deploy from — it applies to production commands run in the same directory too.

Before opening a pull request, run what CI runs:

```bash
npm run lint && npm run typecheck && npm test && npm run build
```

See [CONTRIBUTING.md](CONTRIBUTING.md).

## Commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Vite development server with hot reload, on localhost |
| `npm run dev:host` | Same, but reachable from your local network |
| `npm run pocketbase` | Start PocketBase on port 8091, fetching it if needed |
| `npm run pocketbase:fetch` | Download the pinned PocketBase executable |
| `npm run lint` | Lint with oxlint |
| `npm run typecheck` | Typecheck without emitting |
| `npm test` | Run the filtering, validation, calendar and settings tests |
| `npm run build` | Typecheck and create a production build |

## Project layout

- `src/components/` — tracker interface: tabs, toolbar, rows, rating, dialogs
- `src/components/ui/` — generated shadcn components
- `src/hooks/` — entries, settings, sign-in and first-run setup, as React hooks
- `src/lib/media.ts` — filtering, sorting, series and seasons, and the bin
- `src/lib/repository.ts` — PocketBase data access
- `src/lib/route.ts` — the paths for pages and tabs
- `pb_migrations/` — database schema and instance hardening
- `pb_hooks/` — the setup endpoint, the Recently deleted endpoints and the job
  that empties them, and the security headers and compression PocketBase serves
  the frontend with

## Security

Found a vulnerability? Please report it privately — see
[SECURITY.md](SECURITY.md), which also describes the security model in full.

## License

[MIT](LICENSE).
