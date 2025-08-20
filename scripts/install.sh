#!/bin/bash

# Claude Hooks CLI Installation Script
# Downloads and installs the latest binary release for the current platform

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
REPO="outfitter-dev/carabiner"
BINARY_NAME="claude-hooks"
INSTALL_DIR="${INSTALL_DIR:-$HOME/.local/bin}"

# Functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

detect_platform() {
    local os="$(uname -s)"
    local arch="$(uname -m)"
    
    case "$os" in
        Linux*)
            if [ "$arch" = "x86_64" ]; then
                echo "linux"
            else
                log_error "Unsupported architecture: $arch on Linux"
                exit 1
            fi
            ;;
        Darwin*)
            if [ "$arch" = "arm64" ]; then
                echo "macos-arm64"
            elif [ "$arch" = "x86_64" ]; then
                echo "macos-x64"
            else
                log_error "Unsupported architecture: $arch on macOS"
                exit 1
            fi
            ;;
        CYGWIN*|MINGW*|MSYS*)
            echo "windows"
            ;;
        *)
            log_error "Unsupported operating system: $os"
            exit 1
            ;;
    esac
}

get_latest_version() {
    log_info "Fetching latest release information..."
    
    if command -v curl >/dev/null 2>&1; then
        curl -s "https://api.github.com/repos/${REPO}/releases/latest" | \
        grep '"tag_name":' | \
        sed -E 's/.*"([^"]+)".*/\1/'
    elif command -v wget >/dev/null 2>&1; then
        wget -qO- "https://api.github.com/repos/${REPO}/releases/latest" | \
        grep '"tag_name":' | \
        sed -E 's/.*"([^"]+)".*/\1/'
    else
        log_error "Neither curl nor wget is available. Please install one of them."
        exit 1
    fi
}

download_binary() {
    local platform="$1"
    local version="$2"
    
    # Normalize version (strip leading 'v' for filename suffix)
    local ver_no_prefix="${version#v}"
    local binary_filename
    if [ "$platform" = "windows" ]; then
        binary_filename="${BINARY_NAME}-windows-v${ver_no_prefix}.exe"
    else
        binary_filename="${BINARY_NAME}-${platform}-v${ver_no_prefix}"
    fi
    
    local download_url="https://github.com/${REPO}/releases/download/${version}/${binary_filename}"
    local temp_file="/tmp/${binary_filename}"
    
    log_info "Downloading ${binary_filename}..."
    log_info "URL: ${download_url}"
    
    if command -v curl >/dev/null 2>&1; then
        if ! curl -L -f -o "$temp_file" "$download_url"; then
            log_error "Failed to download binary"
            exit 1
        fi
    elif command -v wget >/dev/null 2>&1; then
        if ! wget -O "$temp_file" "$download_url"; then
            log_error "Failed to download binary"
            exit 1
        fi
    else
        log_error "Neither curl nor wget is available"
        exit 1
    fi
    
    echo "$temp_file"
}

install_binary() {
    local temp_file="$1"
    local platform="$2"
    
    # Create install directory if it doesn't exist
    mkdir -p "$INSTALL_DIR"
    
    local install_path="$INSTALL_DIR/$BINARY_NAME"
    if [ "$platform" = "windows" ]; then
        install_path="${install_path}.exe"
    fi
    
    # Copy and make executable
    cp "$temp_file" "$install_path"
    chmod +x "$install_path"
    
    # Clean up temp file
    rm -f "$temp_file"
    
    log_success "Installed to: $install_path"
    
    # Verify installation
    if "$install_path" --version >/dev/null 2>&1; then
        local version=$("$install_path" --version | head -1)
        log_success "Installation verified: $version"
    else
        log_warn "Installation may have issues - binary doesn't respond to --version"
    fi
    
    echo "$install_path"
}

update_path_instructions() {
    local install_dir="$1"
    
    # Check if install directory is in PATH
    case ":$PATH:" in
        *":$install_dir:"*) 
            log_success "Install directory is already in PATH"
            return
            ;;
    esac
    
    log_warn "Install directory is not in PATH"
    echo
    echo "To use ${BINARY_NAME} from anywhere, add the following to your shell profile:"
    echo "  export PATH=\"$install_dir:\$PATH\""
    echo
    echo "Shell profile files:"
    echo "  bash: ~/.bashrc or ~/.bash_profile"
    echo "  zsh: ~/.zshrc"
    echo "  fish: ~/.config/fish/config.fish"
    echo
    echo "Or run the binary directly: $install_dir/$BINARY_NAME"
}

main() {
    echo "Claude Hooks CLI Installer"
    echo "========================="
    echo
    
    # Check for help flag
    if [ "$1" = "--help" ] || [ "$1" = "-h" ]; then
        echo "Usage: $0 [OPTIONS]"
        echo
        echo "Options:"
        echo "  --help, -h          Show this help message"
        echo "  --dir DIR           Install directory (default: $HOME/.local/bin)"
        echo "  --version VERSION   Install specific version (default: latest)"
        echo
        echo "Environment variables:"
        echo "  INSTALL_DIR         Override default install directory"
        echo
        echo "Examples:"
        echo "  $0                  # Install latest to $HOME/.local/bin"
        echo "  $0 --dir /usr/local/bin  # Install to /usr/local/bin"
        echo "  $0 --version v1.0.0      # Install specific version"
        exit 0
    fi
    
    # Parse arguments
    while [ $# -gt 0 ]; do
        case "$1" in
            --dir)
                INSTALL_DIR="$2"
                shift 2
                ;;
            --version)
                VERSION="$2"
                shift 2
                ;;
            *)
                log_error "Unknown option: $1"
                echo "Use --help for usage information"
                exit 1
                ;;
        esac
    done
    
    # Detect platform
    local platform=$(detect_platform)
    log_info "Detected platform: $platform"
    
    # Get version
    local version="${VERSION:-$(get_latest_version)}"
    if [ -z "$version" ]; then
        log_error "Could not determine version to install"
        exit 1
    fi
    log_info "Installing version: $version"
    
    # Download binary
    local temp_file=$(download_binary "$platform" "$version")
    
    # Install binary
    local install_path=$(install_binary "$temp_file" "$platform")
    
    # Show PATH instructions
    update_path_instructions "$INSTALL_DIR"
    
    echo
    log_success "Claude Hooks CLI installed successfully!"
    echo
    echo "Quick start:"
    echo "  $install_path --help"
    echo "  $install_path init"
    echo "  $install_path validate"
    echo
}

# Run main function with all arguments
main "$@"
