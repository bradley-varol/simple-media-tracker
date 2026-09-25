# Contributing

Thanks for taking an interest. This is a deliberately small project — a
personal media library with a short feature list — so the most useful
contributions are bug fixes, self-hosting improvements, and documentation.

## Scope

Before opening a large pull request, please open an issue first. Things that
are intentionally **out of scope**:

- Artwork, external ratings (IMDb, Goodreads), and start dates. The data model
  leaves these out on purpose.
- Per-user libraries or account isolation. This is a single-owner tracker; see
  [SECURITY.md](SECURITY.md).
- Integrations with tracking services, and importers for their exports.

## Development setup

Requires Node.js 24 or newer.

```bash
npm install
npm run pocketbase   # fetches the pinned PocketBase executable if it is missing or stale
```

See the README's [First run](README.md#first-run) for setting up the account you
log in with.

In another terminal:

```bash
npm run dev
```

The Vite dev server proxies `/api` to PocketBase on port 8091, so the app talks
to the backend over the same origin in development and production alike.

Or run the whole stack in containers:

```bash
docker compose -f compose.dev.yaml up --build
```

## Before you open a pull request

Run the same checks CI runs:

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

All four must pass.

## Database changes

Schema lives in `pb_migrations/` as PocketBase JS migrations. Add a **new**
migration file rather than editing an existing one — the applied history is
tracked by filename, so editing a file that has already run does nothing on
existing installs.

The single `1789948800_init.js` is a squash of the migrations that built the
schema up to the first release. Squashing was a one-off taken while nothing was
running the old files, and it is not a pattern to repeat: an instance that had
already applied the old filenames would not pick the new file up, so it would
stay on the old schema while the frontend expects the new one.

Every migration needs both an `up` and a `down` function. Test yours against a
fresh database *and* an existing one:

```bash
rm -rf pb_data && npm run pocketbase    # fresh install
./pocketbase migrate down 1             # then confirm the revert works
```

## Style

There is no formatter — match the surrounding code. Two-space indent, no
semicolons, double quotes. `npm run lint` catches the rest.

## Commit messages

Conventional commits (`feat:`, `fix:`, `docs:`, `chore:`) — they feed the
changelog.
