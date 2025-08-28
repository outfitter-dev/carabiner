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

# Install Bun (version controlled via build-arg with sensible default)
ARG BUN_VERSION=1.2.20
ENV BUN_VERSION=${BUN_VERSION}
RUN curl -fsSL https://bun.sh/install | bash -s -- bun-v${BUN_VERSION} \
  && ln -s /root/.bun/bin/bun /usr/local/bin/bun \
  && ln -s /root/.bun/bin/bunx /usr/local/bin/bunx

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


