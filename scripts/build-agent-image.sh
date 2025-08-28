#!/usr/bin/env bash
set -euo pipefail

# Run from repo root regardless of invocation dir
cd "$(dirname "$0")/.."

# Determine Bun version: prefer $BUN_VERSION, else parse from package.json
if [[ -n "${BUN_VERSION:-}" ]]; then
  bun_version="$BUN_VERSION"
else
  bun_version=$(node -e "const p=require('./package.json'); const pm=String(p.packageManager||'').replace(/^bun@/,''); const eb=(p.engines&&String(p.engines.bun))||''; const src=pm||eb; const m=String(src).match(/\\b\\d+\\.\\d+\\.\\d+\\b/); if(m){console.log(m[0]); process.exit(0);} process.stderr.write('Could not determine Bun version from package.json\\n'); process.exit(1);")
fi

# Optional custom tag as first arg; default to background-agent + bun version
image_tag="${1:-carabiner/background-agent:bun-${bun_version}}"

echo "Building image: ${image_tag} (Bun ${bun_version})"
docker build -f .cursor/Dockerfile . \
  --build-arg BUN_VERSION="${bun_version}" \
  -t "${image_tag}"

printf "\nBuilt %s successfully.\n" "${image_tag}"


