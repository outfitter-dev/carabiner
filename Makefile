.PHONY: build-agent-image

# Usage:
#   make build-agent-image
#   make build-agent-image TAG=outfitter/carabiner-agent:latest
#   make build-agent-image BUN_VERSION=1.2.21

build-agent-image:
	BUN_VERSION=$(BUN_VERSION) scripts/build-agent-image.sh $(TAG)


