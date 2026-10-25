#!/usr/bin/env sh
set -eu
cd -- "$(dirname -- "$0")"
command -v node >/dev/null 2>&1 || { echo 'Install Node.js 22 LTS to run a source checkout.' >&2; exit 1; }
command -v cargo >/dev/null 2>&1 || { echo 'Install Rust stable and the Linux build prerequisites in docs/LINUX.md.' >&2; exit 1; }
exec node scripts/start.mjs
