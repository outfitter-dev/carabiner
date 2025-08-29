# Docker Development Environment for Cursor IDE

This directory contains Docker configuration for creating a consistent development environment for use with Cursor IDE and AI agents.

## Quick Start

```bash
# Build the development image
make build-agent-image

# Run container with interactive shell
make docker-shell

# Run container with mounted workspace
make docker-run
```

## Architecture

### Development Container

The Dockerfile creates a development-optimized container with:

- **Base**: Node.js 20 LTS on Debian Bookworm
- **Runtime**: Bun (version managed via package.json)
- **Security**: Non-root user execution, dumb-init for signal handling
- **Tools**: Git, build essentials, SSH client

### Security Features

1. **Package cleanup**: APT cache cleared in same layer as install
2. **Non-root execution**: Runs as `node` user (UID 1000)
3. **Signal handling**: Uses dumb-init to prevent zombie processes
4. **Version validation**: Bun version format validated before install
5. **Health checks**: Built-in container health monitoring

## Usage

### Building the Image

```bash
# Default build (uses Bun version from package.json)
make build-agent-image

# Custom tag
make build-agent-image TAG=myapp:latest

# Specific Bun version
make build-agent-image BUN_VERSION=1.2.21

# No cache build
make build-agent-image DOCKER_BUILD_ARGS="--no-cache"
```

### Running Containers

```bash
# Interactive shell with mounted workspace
docker run -it --rm -v $(pwd):/workspace carabiner-dev:latest

# Run specific command
docker run --rm carabiner-dev:latest bun --version

# With environment variables
docker run -it --rm \
  -v $(pwd):/workspace \
  -e NODE_ENV=production \
  carabiner-dev:latest
```

### Development Workflow

1. **Live Development**: Mount your workspace as a volume for live code changes
2. **Dependency Installation**: Run `bun install` inside container for consistent deps
3. **Testing**: Execute tests in isolated container environment
4. **Building**: Use container for reproducible builds

## Configuration

### Environment Variables

- `BUN_VERSION`: Bun runtime version (default: from package.json)
- `NODE_ENV`: Node environment (default: development)
- `CI`: Set to true for deterministic installs
- `TURBO_TELEMETRY_DISABLED`: Disables Turbo telemetry

### Dockerfile Customization

The Dockerfile is optimized for development. For production:

1. Use multi-stage builds to reduce image size
2. Switch to Alpine base for smaller footprint
3. Remove development tools (git, build-essential)
4. Copy only built artifacts, not source

## Production Dockerfile Example

```dockerfile
# Multi-stage production build
FROM oven/bun:1-alpine AS builder
WORKDIR /app
COPY package.json bun.lockb ./
RUN bun install --frozen-lockfile --production=false
COPY . .
RUN bun run build

FROM oven/bun:1-alpine AS runtime
RUN adduser -D appuser
USER appuser
WORKDIR /app
COPY --from=builder --chown=appuser /app/dist ./dist
COPY --from=builder --chown=appuser /app/node_modules ./node_modules
EXPOSE 3000
CMD ["bun", "start"]
```

## Troubleshooting

### Docker Not Found

```bash
Error: Docker is not installed or not in PATH
```

**Solution**: Install Docker Desktop from https://docs.docker.com/get-docker/

### Docker Daemon Not Running

```bash
Error: Docker daemon is not running
```

**Solution**: Start Docker Desktop application

### Bun Version Not Detected

```bash
Error: Could not determine Bun version from package.json
```

**Solution**: Set `BUN_VERSION` environment variable or ensure package.json has `packageManager` field

### Build Failures

```bash
Error: Docker build failed
```

**Solutions**:

1. Check Docker daemon status: `docker info`
2. Clear Docker cache: `docker system prune`
3. Rebuild without cache: `make build-agent-image DOCKER_BUILD_ARGS="--no-cache"`

## Best Practices

1. **Layer Caching**: Order Dockerfile commands from least to most frequently changing
2. **Security**: Always run as non-root user in production
3. **Size Optimization**: Use multi-stage builds and Alpine images for production
4. **Version Pinning**: Pin all dependency versions for reproducibility
5. **Health Checks**: Implement health checks for container orchestration

## CI/CD Integration

```yaml
# GitHub Actions example
- name: Build Docker image
  run: make build-agent-image TAG=ghcr.io/${{ github.repository }}:${{ github.sha }}

- name: Run tests in container
  run: docker run --rm ghcr.io/${{ github.repository }}:${{ github.sha }} bun test
```

## Resources

- [Docker Best Practices](https://docs.docker.com/develop/dev-best-practices/)
- [Node.js Docker Guide](https://github.com/nodejs/docker-node/blob/main/docs/BestPractices.md)
- [Bun Container Images](https://hub.docker.com/r/oven/bun)
- [Container Security](https://cheatsheetseries.owasp.org/cheatsheets/Docker_Security_Cheat_Sheet.html)
