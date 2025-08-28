# syntax=docker/dockerfile:1.7

# ============================================
# DEVELOPMENT CONTAINER FOR CURSOR/AGENT USE
# ============================================
# This container is designed for development with Cursor IDE and AI agents.
# For production deployments, use a multi-stage build with minimal base images.

# Base image with Node 20 (LTS) on Debian Bookworm for compatibility
FROM node:20-bookworm

# Install dependencies and clean up in single layer to reduce image size
# Security: Clean package cache immediately after install
RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    git \
    curl \
    ca-certificates \
    bash \
    openssh-client \
    build-essential \
    dumb-init \
  && apt-get clean \
  && rm -rf /var/lib/apt/lists/* /tmp/* /var/tmp/*

# Install Bun with version validation and secure download
ARG BUN_VERSION=1.2.20
# Optional SHA256 checksum for integrity verification
ARG BUN_SHA256=
ENV BUN_VERSION=${BUN_VERSION}
ARG TARGETARCH

# Validate Bun version format and install with optional checksum verification
RUN set -eux; \
  # Validate version format (X.Y.Z)
  if ! echo "${BUN_VERSION}" | grep -qE '^[0-9]+\.[0-9]+\.[0-9]+$'; then \
    echo "Error: Invalid Bun version format: ${BUN_VERSION}" >&2; \
    exit 1; \
  fi; \
  # Map Docker TARGETARCH to Bun arch
  case "${TARGETARCH:-amd64}" in \
    amd64) BUN_ARCH="x64-baseline" ;; \
    arm64) BUN_ARCH="aarch64" ;; \
    *) echo "Unsupported arch: ${TARGETARCH}" >&2; exit 1 ;; \
  esac; \
  # Download Bun with retry logic
  for i in 1 2 3; do \
    curl -fsSL --retry 3 --retry-delay 5 -o /tmp/bun.tgz \
      "https://github.com/oven-sh/bun/releases/download/bun-v${BUN_VERSION}/bun-linux-${BUN_ARCH}.tar.gz" && break || \
    if [ $i -eq 3 ]; then exit 1; fi; \
    sleep 10; \
  done; \
  # Verify checksum if provided
  if [ -n "${BUN_SHA256}" ]; then \
    echo "${BUN_SHA256}  /tmp/bun.tgz" | sha256sum -c -; \
  fi; \
  # Extract and install
  mkdir -p /opt/bun && \
    tar -xzf /tmp/bun.tgz -C /opt/bun --strip-components=1; \
  ln -sf /opt/bun/bin/bun /usr/local/bin/bun; \
  ln -sf /opt/bun/bin/bunx /usr/local/bin/bunx; \
  # Verify installation
  bun --version; \
  # Clean up
  rm -f /tmp/bun.tgz

# Use existing node user instead of creating new one (reduces image size)
# The node user already exists in the base image with proper permissions
USER node
WORKDIR /home/node

# Set up PATH for node user
ENV PATH="/home/node/.local/bin:/opt/bun/bin:/usr/local/bin:${PATH}"

# Default shell with proper init system
SHELL ["/bin/bash", "-lc"]

# Development environment variables
ENV CI=true \
    TURBO_TELEMETRY_DISABLED=1 \
    NODE_ENV=development \
    BUN_INSTALL="/home/node/.bun"

# Health check for container monitoring (can be overridden)
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD bun --version || exit 1

# Use dumb-init to handle signals properly (prevents zombie processes)
ENTRYPOINT ["dumb-init", "--"]

# Default command opens a shell for development
CMD ["bash"]


