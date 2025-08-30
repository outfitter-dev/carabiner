# Binary Distribution System

This document outlines the comprehensive CI/CD pipeline for binary distribution of the Grapple monorepo's `carabiner` CLI tool.

## Overview

The binary distribution system provides production-ready, standalone executables for the Claude Hooks CLI across all major platforms, eliminating the need for users to install Bun, Node.js, or any dependencies.

## Supported Platforms

| Platform | Architecture | Binary Name             | Runner           |
| -------- | ------------ | ----------------------- | ---------------- |
| Linux    | x64          | `carabiner-linux`       | `ubuntu-latest`  |
| macOS    | ARM64 (M1+)  | `carabiner-macos-arm64` | `macos-latest`   |
| macOS    | x64 (Intel)  | `carabiner-macos-x64`   | `macos-13`       |
| Windows  | x64          | `carabiner-windows.exe` | `windows-latest` |

## Workflows

### 1. Build Binaries Workflow (`.github/workflows/build-binaries.yml`)

**Triggers:**

- Manual dispatch (`workflow_dispatch`)
- Pull requests affecting CLI code
- Pushes to main branch with CLI changes

**Features:**

- Cross-platform matrix builds
- Comprehensive smoke testing
- Artifact upload for testing
- Build summary reports

**Smoke Tests:**

- Version command (`--version`)
- Help commands (`--help`, `validate --help`, `config --help`)
- Invalid command handling
- Verbose mode testing

### 2. Release Workflow Enhancement (`.github/workflows/release.yml`)

**Integration:**

- Builds binaries as part of release process
- Attaches all platform binaries to GitHub releases
- Comprehensive binary verification
- Automated changelog with binary information

## Local Development

### Build Single Binary

```bash
# Build for current platform
bun run build:binary

# Build with options
bun scripts/build-binary.ts --target linux --verbose

# Build with custom output
bun scripts/build-binary.ts --output my-cli --no-minify
```

### Build All Platforms

```bash
# Build for all platforms (requires appropriate toolchain)
bun run build:binary:all
```

### Build Script Options

| Option           | Description                                      | Default        |
| ---------------- | ------------------------------------------------ | -------------- |
| `--target`       | Platform: `current`, `linux`, `macos`, `windows` | `current`      |
| `--no-minify`    | Disable minification                             | `false`        |
| `--no-sourcemap` | Disable sourcemap generation                     | `false`        |
| `--verbose`      | Enable verbose output                            | `false`        |
| `--output`       | Custom output filename                           | Auto-generated |
| `--help`         | Show help message                                | -              |

## Binary Features

### Production Optimizations

- **Minification**: Code is minified for smaller binary size
- **Sourcemap**: External sourcemap for debugging (development)
- **Tree Shaking**: Unused code is eliminated
- **Dependency Bundling**: All dependencies are included
- **Version Injection**: Accurate version reporting from package.json

### Runtime Features

- **Self-Contained**: No external dependencies required
- **Fast Startup**: Compiled binary with optimized startup time
- **Cross-Platform**: Native execution on all supported platforms
- **Security**: Input validation and workspace security checks
- **Logging**: Configurable logging levels (warn, info, debug)

### Security Considerations

- **Input Validation**: Command arguments are sanitized
- **Workspace Validation**: Secure workspace path validation
- **Path Traversal Protection**: Prevention of directory traversal attacks
- **Command Validation**: Structured command validation system

## CI/CD Pipeline Details

### Build Process

1. **Environment Setup**: Install Bun and dependencies
2. **Dependency Build**: Build all required packages
3. **Version Injection**: Read version from package.json
4. **Binary Compilation**: Use `bun build --compile` with optimizations
5. **Smoke Testing**: Run comprehensive functionality tests
6. **Artifact Upload**: Store binaries for release attachment

### Quality Gates

- **Build Verification**: Ensure all binaries build successfully
- **Functionality Tests**: Test core CLI commands
- **Size Verification**: Monitor binary size growth
- **Cross-Platform Compatibility**: Test on all target platforms

### Performance Optimizations

- **Caching**: Dependency and build caching
- **Parallel Builds**: Matrix strategy for concurrent builds
- **Fail-Fast**: Quick feedback on build failures
- **Artifact Optimization**: Compressed artifact storage

## Monitoring and Troubleshooting

### Build Monitoring

- **GitHub Actions Summary**: Detailed build reports
- **Binary Size Tracking**: Monitor size growth over time
- **Test Results**: Comprehensive smoke test results
- **Artifact Verification**: Ensure all binaries are present

### Common Issues

1. **Missing Dependencies**: Ensure `bun run build` completes successfully
2. **Version Mismatch**: Check package.json version sync
3. **Platform-Specific Failures**: Review platform-specific build logs
4. **Binary Size Growth**: Monitor and optimize dependencies

### Debugging

- **Local Testing**: Use `bun run build:binary --verbose`
- **CI Logs**: Check detailed build logs in GitHub Actions
- **Smoke Test Failures**: Review specific command failures
- **Version Issues**: Verify version injection in binaries

## Release Process Integration

### Automatic Release

1. **Version Bump**: Conventional commit-based versioning
2. **Binary Builds**: Cross-platform binary compilation
3. **Testing**: Comprehensive smoke tests
4. **Asset Attachment**: Binaries attached to GitHub release
5. **NPM Publishing**: Package publishing (excluding binaries)

### Manual Release Testing

```bash
# Test local binary build
bun run build:binary --verbose

# Test specific platform
bun scripts/build-binary.ts --target linux

# Clean and rebuild
bun run clean && bun run build:binary
```

## Distribution Strategy

### GitHub Releases

- **Primary Distribution**: GitHub Releases with attached binaries
- **Version Tagging**: Semantic versioning with git tags
- **Release Notes**: Automated changelog generation
- **Asset Organization**: Clear binary naming and organization

### Future Considerations

- **Package Managers**: Integration with Homebrew, Chocolatey, etc.
- **Docker Images**: Containerized distribution
- **Auto-Updates**: In-app update mechanism
- **Telemetry**: Usage analytics and crash reporting

## Binary Usage Examples

### Installation

```bash
# Download from GitHub Releases
curl -L -o carabiner https://github.com/outfitter-dev/carabiner/releases/latest/download/carabiner-linux
chmod +x carabiner

# Test installation
./carabiner --version
```

### Basic Usage

```bash
# Show help
./carabiner --help

# Initialize hooks
./carabiner init

# Validate configuration
./carabiner validate

# Configure settings
./carabiner config set workspace /path/to/project
```

## Performance Metrics

### Binary Sizes (Approximate)

- **Linux x64**: ~45MB
- **macOS ARM64**: ~48MB
- **macOS x64**: ~47MB
- **Windows x64**: ~46MB

### Build Times (CI)

- **Single Platform**: ~3-5 minutes
- **All Platforms**: ~8-12 minutes (parallel)
- **Release Process**: ~15-20 minutes (including NPM)

## Conclusion

The binary distribution system provides a robust, secure, and efficient way to distribute the Claude Hooks CLI across all major platforms. The comprehensive CI/CD pipeline ensures quality, reliability, and ease of use for end users while maintaining security and performance standards.
