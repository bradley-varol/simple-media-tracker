#!/usr/bin/env bash
# Downloads the PocketBase executable this project is pinned to, verifying it
# against the checksums published with the release.
#
# The binary is deliberately not committed: it is 30MB and platform specific.
set -euo pipefail

cd "$(dirname "$0")/.."

# One source of truth for the version, shared with the Dockerfile and CI.
VERSION="$(grep -m1 '^ARG POCKETBASE_VERSION=' Dockerfile | cut -d= -f2)"
if [[ -z "$VERSION" ]]; then
  echo "Could not read POCKETBASE_VERSION from the Dockerfile." >&2
  exit 1
fi

if [[ -x ./pocketbase ]] && ./pocketbase --version 2>/dev/null | grep -q "$VERSION"; then
  echo "PocketBase $VERSION is already here."
  exit 0
fi

case "$(uname -s)" in
  Linux) os=linux ;;
  Darwin) os=darwin ;;
  *) echo "Unsupported OS: $(uname -s). Download PocketBase $VERSION manually from https://github.com/pocketbase/pocketbase/releases" >&2; exit 1 ;;
esac

case "$(uname -m)" in
  x86_64 | amd64) arch=amd64 ;;
  aarch64 | arm64) arch=arm64 ;;
  armv7l) arch=armv7 ;;
  *) echo "Unsupported architecture: $(uname -m). Download PocketBase $VERSION manually from https://github.com/pocketbase/pocketbase/releases" >&2; exit 1 ;;
esac

if command -v sha256sum >/dev/null 2>&1; then
  checksum_cmd=(sha256sum -c -)
elif command -v shasum >/dev/null 2>&1; then
  checksum_cmd=(shasum -a 256 -c -)
else
  echo "Need sha256sum or shasum to verify the download." >&2
  exit 1
fi

archive="pocketbase_${VERSION}_${os}_${arch}.zip"
base="https://github.com/pocketbase/pocketbase/releases/download/v${VERSION}"
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT

echo "Downloading PocketBase $VERSION for $os/$arch..."
curl -fsSL -o "$tmp/$archive" "$base/$archive"
curl -fsSL -o "$tmp/checksums.txt" "$base/checksums.txt"

(cd "$tmp" && grep " $archive\$" checksums.txt | "${checksum_cmd[@]}")

# Not every machine has unzip; Python is the common fallback.
if command -v unzip >/dev/null 2>&1; then
  unzip -q -o "$tmp/$archive" pocketbase -d "$tmp"
elif command -v python3 >/dev/null 2>&1; then
  python3 -c 'import sys,zipfile; zipfile.ZipFile(sys.argv[1]).extract("pocketbase", sys.argv[2])' "$tmp/$archive" "$tmp"
elif command -v bsdtar >/dev/null 2>&1; then
  bsdtar -xf "$tmp/$archive" -C "$tmp" pocketbase
else
  echo "Need unzip, python3 or bsdtar to unpack the download. Install one, or grab PocketBase $VERSION manually from https://github.com/pocketbase/pocketbase/releases" >&2
  exit 1
fi

mv "$tmp/pocketbase" ./pocketbase
chmod +x ./pocketbase

echo "PocketBase $VERSION is ready."
