# CI/CD Rules

## GitHub Actions Workflows

### Workflow Structure

- Use composite actions for reusable workflows
- Matrix builds for multiple Node/Bun versions
- Separate workflows for PR validation vs deployment
- Use `workflow_call` for shared logic

### Bun in CI

```yaml
- uses: oven-sh/setup-bun@v2
  with:
    bun-version: 'latest'
```

### Turbo Remote Caching

- Configure remote caching for faster CI builds
- Use Vercel Remote Cache or custom solution
- Set `TURBO_TOKEN` and `TURBO_TEAM` in secrets
- Cache invalidation on lockfile changes

## Pipeline Stages

### PR Validation

1. **Install** - Use `bun install --frozen-lockfile`
2. **Lint** - Run `bun run lint` (Biome via Ultracite)
3. **Typecheck** - Run `bun run typecheck`
4. **Test** - Run `bun run test:ci` (sequential)
5. **Build** - Run `bun run build`

### Main Branch

- All PR validation steps
- Generate coverage reports
- Deploy previews for apps
- Package publishing for libraries

## Caching Strategy

### Dependencies

```yaml
- uses: actions/cache@v4
  with:
    path: ~/.bun/install/cache
    key: ${{ runner.os }}-bun-${{ hashFiles('**/bun.lockb') }}
```

### Turbo Cache

```yaml
- uses: actions/cache@v4
  with:
    path: .turbo
    key: ${{ runner.os }}-turbo-${{ github.sha }}
    restore-keys: |
      ${{ runner.os }}-turbo-
```

## Release Automation

### Changesets

- Use changesets for version management
- Automated PR creation for releases
- Publish to npm on merge
- GitHub release creation

### Deployment

- Preview deployments on PR
- Production deployment on main
- Environment-specific secrets
- Rollback strategies

## Performance Optimizations

### Parallel Jobs

- Split large test suites
- Parallel package builds
- Independent deployment jobs
- Use job dependencies wisely

### Conditional Execution

- Skip unchanged packages (Turbo handles this)
- Path filtering for workflows
- Skip docs-only changes for build
- Early exit on failures
