# syntax=docker/dockerfile:1.7

# Base image with Node 20 (LTS) on Debian Bookworm for compatibility
FROM node:20-bookworm

# Install dependencies: git, curl, ca-certificates, bash, and build essentials
RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    git \
    curl \
    ca-certificates \
    bash \
    openssh-client \
    build-essential \
  && rm -rf /var/lib/apt/lists/*

# Install Bun (version controlled via build-arg with secure checksum verification)
ARG BUN_VERSION=1.2.20
ARG BUN_SHA256=
ENV BUN_VERSION=${BUN_VERSION}

# Download and verify Bun release tarball
RUN set -eux; \
  curl -fsSL -o /tmp/bun.tgz \
    "https://github.com/oven-sh/bun/releases/download/bun-v${BUN_VERSION}/bun-linux-x64-baseline.tar.gz"; \
  if [ -n "${BUN_SHA256}" ]; then \
    echo "${BUN_SHA256}  /tmp/bun.tgz" | sha256sum -c -; \
  fi; \
  mkdir -p /opt/bun && \
    tar -xzf /tmp/bun.tgz -C /opt/bun --strip-components=1; \
  ln -sf /opt/bun/bin/bun /usr/local/bin/bun; \
  ln -sf /opt/bun/bin/bunx /usr/local/bin/bunx; \
  rm -f /tmp/bun.tgz

# Create non-root user with home and switch
RUN useradd -ms /bin/bash ubuntu
USER ubuntu
WORKDIR /home/ubuntu

# Ensure common user-local bin and system bin are on PATH
ENV PATH="/home/ubuntu/.local/bin:/usr/local/bin:${PATH}"

# Default shell
SHELL ["/bin/bash", "-lc"]

# Set recommended environment variables for CI-like deterministic installs
ENV CI=true \
    TURBO_TELEMETRY_DISABLED=1

# Build step is optional; leave as a separate target to speed up dev cycles
# RUN bun run build

# Default command opens a shell; tools can override
CMD ["bash"]


