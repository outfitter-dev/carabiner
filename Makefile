# Default goal
.DEFAULT_GOAL := help

# Phony targets
.PHONY: all help clean test build-agent-image docker-run docker-shell docker-clean

# Variables
DOCKER_IMAGE_TAG ?= carabiner-dev:latest
DOCKER_RUN_OPTS ?= --rm -it
DOCKER_MOUNT_OPTS ?= -v $(PWD):/workspace:cached

# Default target
all: build-agent-image

# Help target
help:
	@echo "Available targets:"
	@echo "  make build-agent-image  - Build Docker development image"
	@echo "  make docker-run        - Run container with mounted workspace"
	@echo "  make docker-shell      - Start interactive shell in container"
	@echo "  make docker-clean      - Remove Docker image and dangling images"
	@echo "  make test              - Run tests (placeholder)"
	@echo "  make clean             - Clean build artifacts"
	@echo ""
	@echo "Options:"
	@echo "  TAG=<tag>             - Custom Docker image tag"
	@echo "  BUN_VERSION=<version> - Bun version (default: from package.json)"
	@echo "  DOCKER_BUILD_ARGS=... - Additional Docker build arguments"

# Build Docker image for Cursor's background agent environment
# Usage: make build-agent-image [TAG=custom-tag] [BUN_VERSION=1.x.x] [DOCKER_BUILD_ARGS="--no-cache"]
build-agent-image:
	@echo "Building Docker development image..."
	@BUN_VERSION=$(BUN_VERSION) DOCKER_BUILD_ARGS="$(DOCKER_BUILD_ARGS)" scripts/build-agent-image.sh $(TAG)

# Run the Docker container with workspace mounted
docker-run: build-agent-image
	@echo "Running Docker container with mounted workspace..."
	docker run $(DOCKER_RUN_OPTS) $(DOCKER_MOUNT_OPTS) -w /workspace $(or $(TAG),$(DOCKER_IMAGE_TAG))

# Open an interactive shell in the Docker container
docker-shell: build-agent-image
	@echo "Starting interactive shell in Docker container..."
	docker run $(DOCKER_RUN_OPTS) $(DOCKER_MOUNT_OPTS) -w /workspace $(or $(TAG),$(DOCKER_IMAGE_TAG)) bash

# Clean Docker images
docker-clean:
	@echo "Cleaning Docker images..."
	@docker rmi $(or $(TAG),$(DOCKER_IMAGE_TAG)) 2>/dev/null || true
	@docker image prune -f
	@echo "Docker cleanup complete"

# Test target (placeholder for CI compatibility)
test:
	@echo "No specific tests for Docker tooling"
	@echo "Run 'bun test' for project tests"

# Clean target (placeholder for CI compatibility)
clean:
	@echo "No build artifacts to clean for Docker tooling"
	@echo "Use 'make docker-clean' to remove Docker images"