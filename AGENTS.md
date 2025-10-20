# AGENTS.md

> **Current Work**:
> - Provider adapter rollout: `.agents/notes/hook-adapter-architecture.md`
> - Logger & fixture plan (unified logger, fixtures, docs, lefthook): `.agents/notes/logger-and-tests-plan.md`

## About Matt

- Name: Matt Galligan
  - "Matt" for short
  - `@galligan` on GitHub
- Profile:
  - Full-stack product builder who leverages (and depends on) AI agents
  - Working on "Outfitter"
    - GitHub: https://github.com/outfitter-dev
    - NPM: https://www.npmjs.com/outfitter
  - Relevant links:
    - Github: https://github.com/galligan
    - X/Twitter: https://x.com/mg

## Technology Stack

I default to using TypeScript (via Bun) for most projects. Where speed is a priority, I'll use Rust. Simply put, use the best tool for the job.

### TypeScript

- **Preference**: Strongly typed (strict settings)
- **Runtime**: Bun
- **Package Manager**: Bun
- **Server**: Hono preferred, Express, Fastify, etc.

### Rust

- **Preference**: Speed, performance, and safety
- **Runtime**: Rust
- **Package Manager**: Cargo
- **Server**: Axum, Actix, etc.

### Frontends

- **Framework**: React + TanStack Router/TanStack Start or Next.js
- **CSS/Styling**: Tailwind CSS 4
- **Components**: shadcn/ui, components stored in `packages/ui/components`
  - DRY, reusable, and accessible components

### Database

- **Starting Projects**: SQLite by default (use Bun.SQL if TypeScript)
- **Production**: PostgreSQL (with Supabase or Neon) or Convex
- **Redis Alternative**: Upstash when relevant

### API Design

- **Preference Order**: tRPC > REST > GraphQL
- **Requirements**: OpenAPI + Swagger documentation
- **Priority**: MCP server compatibility

### Deployment

- **Primary**: Cloudflare preferred, Vercel
- **Alternatives**: Open to Fly.io

### Testing

- **Frameworks**: Vitest, Playwright
- **Priority**: Compatibility with MCP servers for agent automation

### Authentication

- **Primary**: BetterAuth
- **Alternative**: Clerk

### CI/CD

- **Primary**: GitHub Actions (complex actions with Cloudflare runners)
- **Alternative**: Vercel/Cloudflare integrated CI when deploying there

## Development Practices

### Project Organization

- **Repository Structure**: Prefer monorepo approach
- **Organization Method**: Start with flat structure, nest only when painful

### Configuration Management

- **Methods**:
  - Environment files (.env) with different versions per environment
  - Environment variables set in deployment platform

### Internationalization

- **Future Consideration**: AI-driven translation in build pipeline when needed

## Version Control

We use a trunk-based development approach.

### Use Graphite

- Use `gt` or the `graphite` mcp server to manage branches, pull requests, and commits.
- Before doing anything, make sure you are familiar with the current stack by running `gt log`.
- Prefer `gt` to `git` or `gh` for version control tasks.
- Prefer submitting branches in a stack
- By default Graphite submits PRs as drafts
- Remember:
  - `log`: a graphical representation of the current stack
  - `stack`: a sequence of pull requests, each building off of its parent e.g. (`main` <- PR "add API" <- PR "update frontend" <- PR "docs")
  - `trunk`: the branch that stacks are merged into by default, e.g. `main`
  - `downstack`: the PRs below the given PR in a stack, i.e. its ancestors
  - `upstack`: the PRs above the given PR in a stack, i.e. its descendants
  - Docs available at https://graphite.dev/docs/

### How We Work

- `main` always releasable
- Short-lived branches off main
  - (hours, maybe a couple of days)
  - Opened as PRs immediately
- Feature flags/kill-switches guard incomplete work
  - This instead of long-running branches
- Merge via squash-merge after checks pass, auto-delete the branch

### Trunk + Release Branches (for predictable releases)

- Purpose: cutting stable releases on a cadence
- Do exactly as [stated above](#trunk-based-development)
- On release, cut `release/x.y[.z][-beta]`
  - Hotfixes and cherry-picks land here
- Tag from the release branch; hotfixes go to `main` first, then merged to `release/…` branch

### Stacked PRs (for larger work with low risk)

- Purpose: when a feature is too big for one PR, but we still want rapid review/merge
- Use: Graphite (`gt` command or `graphite` mcp server)
- Break work into slices:
  - `feat/[name]-0-base` → `feat/[name]-1-api` → `feat/[name]-2-ui`, etc.
- Each PR is sequential, rebase to collapse the stack onto `main`
- If bigger work, use `feat/[name]` as root, contributions branch from there (see slicing above)

### Exploratory/Experimental Work

- `exp/[codename]` - Tracks `main` (at least daily)
- Experiment work goes into `exp/…` branches exclusively.
  - CI stricter
- Periodically cherry-pick clean commits from `exp/…` branch → `main`
- Auto-rebase `exp/[codename]` on `main` to limit drift

### Monorepo Package-Specific Work

- Purpose: Continuous delivery across multiple packages, avoid lockfile collisions
- Owners per package (if applicable)
- Changes land via package-scoped branches & PRs (e.g. `fix/[package]/[slug])
- Versioning via Changesets; release trains publish independent packages
- CI runs targeted tests only for touched packages

### Git hygiene

- **Keep branches short-lived**
  - Enforce TTL: auto-close PRs > 5 days stale unless labeled `wip` or branch name begins `exp/`
  - Require branches to be up-to-date with `main` at merge time
- **Prefer rebase over merge for PRs**
  - Keep linear history: "Update branch" = rebase; default to **squash-merge**
  - Auto-rebase `[agent name]/` or `exp/` PRs on push; don't allow merge commits from agents
- **Name branches predictably**
  - `feat/area/[slug]`
  - `fix/area/[slug]`
  - `fix/issue-[n]`
  - Other
- **Block bypassing of reviews on protected paths**
- **Require signed commits for `main`**
- **Lockfiles (e.g. bun.lockb)**: treat as generated
  - Take `main` during merges; regenerate in CI
- **Barrel/index files, route registries, root config**: refactor to avoid central registries (auto-discovery, file-system routing) or generate them deterministically in CI.
- **JSON/YAML**: enforce key-sorting and stable formatters to minimize diffs.

### Pull Request Management

- After updating any code to address PR feedback from `@coderabbitai` (`coderabbitai[bot]` in GitHub), follow up with a comment on the PR with your changes and make sure to mention `@coderabbitai` in the body to check it out.

### `.gitattributes` examples

```text
# Binary lockfile: always favor ours on merge (then regenerate)
bun.lockb merge=ours

# Markdown/CHANGELOG: prefer union to keep both additions
*.md merge=union

# Use a custom JSON merge driver (stable sort + minimal diffs)
*.json merge=json-clean
```

### Record & reuse conflict resolutions

Help git remember how we resolve conflicts and auto-apply them next time

```bash
git config --global rerere.enabled true
```

### Format everything, always

- Pre-commit hooks: `ultracite format, prettier, markdownlint --fix`, etc.
- Identical toolchain in CI so agents & humans produce the same diffs

### Turn on a merge queue

- Turn on a queue (GitHub Merge Queue or Mergify) to batch, rebase, re-run checks in a temporary branch to guarantee `main` stays green

### Worktrees for parallelism

- Each agent can be run in their own `git worktree` to avoid local cross-branch contamination

### Operating Agreement

1. `main` is always releasable, all work done via PRs
2. Default branch TTL < 3 days; PR size target < 300 lines
3. Required checks: typecheck, lint, unit tests, smoke E2E, preview link
4. Squash-merge; linear history; merge queue required
5. Lockfiles are regenerated, not hand-merged
6. Agents commit only to agent/* branches; humans must approve protected paths
7. Feature flags for incomplete work; no long-running feature branches
8. Release trains: tag weekly; cut release/* only if you need staged QA

### Workflow Decision Tree

- Need fast iteration, comfy with flags → Trunk-Based Development
- Predictable, testable "cuts" → Trunk + Release Branches (for predictable releases)
- Big changes, still continuously integrated → Stacked PRs (for larger work with low risk)
- Experimenting → Exploratory/Experimental Work
- Monorepo with separate package releases → Monorepo Package-Specific Work
