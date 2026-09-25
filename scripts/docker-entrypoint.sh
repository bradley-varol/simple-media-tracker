#!/bin/sh
# Checks that /pb_data is usable before handing over to PocketBase.
#
# PocketBase keeps its SQLite databases in /pb_data, and the container runs as
# an unprivileged user. Mount a directory it cannot write and the only thing
# that reaches the log is SQLite's "unable to open database file (14)", which
# names neither the directory nor the ownership that caused it. Say it plainly
# here instead.
set -eu

DATA_DIR="${PB_DATA_DIR:-/pb_data}"

fail() {
  echo "simple-media-tracker: $1" >&2
  shift
  echo >&2
  for line in "$@"; do
    if [ -n "$line" ]; then echo "  $line" >&2; else echo >&2; fi
  done
  echo >&2
  echo "  See the README's \"Quick start\" for the whole setup." >&2
  exit 1
}

if [ ! -d "$DATA_DIR" ]; then
  fail "$DATA_DIR does not exist." \
    "Create the host directory you are mounting there before starting:" \
    "" \
    "    mkdir -p pb_data"
fi

# touch rather than a `: >` redirect: `:` is a special built-in, and POSIX has
# a redirection error on one exit the shell outright — taking this check, and
# the explanation it exists to print, with it.
probe="$DATA_DIR/.write-probe.$$"
if ! touch "$probe" 2>/dev/null; then
  owner="$(stat -c '%u:%g' "$DATA_DIR" 2>/dev/null || echo unknown)"
  mode="$(stat -c '%a' "$DATA_DIR" 2>/dev/null || echo unknown)"
  self="$(id -u):$(id -g)"
  fail "$DATA_DIR is not writable." \
    "It is owned by ${owner} (mode ${mode}). This container runs as ${self}." \
    "" \
    "Docker creates a missing bind-mount source as root, so this usually" \
    "means the host directory did not exist when the container started." \
    "" \
    "Give it to the user the container runs as:" \
    "" \
    "    sudo chown -R ${self} ./pb_data" \
    "" \
    "Or set PUID and PGID to match the directory's existing owner instead."
fi
rm -f "$probe"

exec "$@"
