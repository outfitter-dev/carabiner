#!/usr/bin/env bash
set -euo pipefail

# Color output for better visibility
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Run from repo root regardless of invocation dir
cd "$(dirname "$0")/.."

# Function to print colored messages
print_error() {
  printf "%bError: %s%b\n" "${RED}" "$1" "${NC}" >&2
}

print_success() {
  printf "%b✓ %s%b\n" "${GREEN}" "$1" "${NC}"
}

print_info() {
  printf "%bℹ %s%b\n" "${YELLOW}" "$1" "${NC}"
}

# Check Docker availability
if ! command -v docker &> /dev/null; then
  print_error "Docker is not installed or not in PATH"
  echo "Please install Docker from https://docs.docker.com/get-docker/"
  exit 1
fi

# Check if Docker daemon is running
if ! docker info &> /dev/null; then
  print_error "Docker daemon is not running"
  echo "Please start Docker and try again"
  exit 1
fi

# Determine Bun version: prefer $BUN_VERSION, else parse from package.json
if [[ -n "${BUN_VERSION:-}" ]]; then
  bun_version="$BUN_VERSION"
  print_info "Using Bun version from environment: ${bun_version}"
else
  # Check if Node.js is available for parsing package.json
  if ! command -v node &> /dev/null; then
    print_error "Node.js is required to parse package.json when BUN_VERSION is not set"
    echo "Either install Node.js or set BUN_VERSION environment variable"
    exit 1
  fi
  
  bun_version=$(node -e "const p=require('./package.json'); const pm=String(p.packageManager||'').replace(/^bun@/,''); const eb=(p.engines&&String(p.engines.bun))||''; const src=pm||eb; const m=String(src).match(/\\b\\d+\\.\\d+\\.\\d+\\b/); if(m){console.log(m[0]); process.exit(0);} process.stderr.write('Could not determine Bun version from package.json\\n'); process.exit(1);" 2>/dev/null) || {
    print_error "Could not determine Bun version from package.json"
    echo "Please set BUN_VERSION environment variable or ensure package.json contains valid packageManager or engines.bun field"
    exit 1
  }
  print_info "Detected Bun version from package.json: ${bun_version}"
fi

# Validate Bun version format
if ! echo "${bun_version}" | grep -qE '^[0-9]+\.[0-9]+\.[0-9]+$'; then
  print_error "Invalid Bun version format: ${bun_version}"
  echo "Expected format: X.Y.Z (e.g., 1.2.20)"
  exit 1
fi

# Optional custom tag as first arg; default to carabiner-dev + bun version
image_tag="${1:-carabiner-dev:bun-${bun_version}}"

# Check if .cursor/Dockerfile exists
if [[ ! -f .cursor/Dockerfile ]]; then
  print_error "Dockerfile not found at .cursor/Dockerfile"
  exit 1
fi

# Build the image with progress output
print_info "Building Docker image: ${image_tag}"
print_info "Bun version: ${bun_version}"
echo ""

# Build with buildkit for better caching and performance
DOCKER_BUILDKIT=1 docker build \
  -f .cursor/Dockerfile \
  --build-arg BUN_VERSION="${bun_version}" \
  ${DOCKER_BUILD_ARGS:-} \
  -t "${image_tag}" \
  --progress=plain \
  . || {
    print_error "Docker build failed"
    exit 1
  }

echo ""
print_success "Successfully built ${image_tag}"

# Verify the image was created
if docker image inspect "${image_tag}" &> /dev/null; then
  # Get image size
  size_bytes=$(docker image inspect "${image_tag}" --format='{{.Size}}')
  if command -v numfmt >/dev/null 2>&1; then
    image_size=$(printf "%s" "${size_bytes}" | numfmt --to=iec)
  else
    image_size="${size_bytes} bytes"
  fi
  print_info "Image size: ${image_size}"
  
  # Provide usage instructions
  echo ""
  echo "To run the container:"
  echo "  docker run -it --rm ${image_tag}"
  echo ""
  echo "To run with mounted workspace:"
  echo "  docker run -it --rm -v \$(pwd):/workspace ${image_tag}"
else
  print_error "Failed to verify image creation"
  exit 1
fi


