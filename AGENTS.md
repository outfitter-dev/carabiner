# Repository Guidelines

## Project Structure & Module Organization
- Monorepo managed by Turborepo + Bun. Workspaces live in `apps/*` and `packages/*`.
- Core libraries: `packages/hooks-core`, `packages/hooks-validators`, `packages/hooks-config`, `packages/hooks-testing`.
- CLI: `packages/hooks-cli` (binary: `claude-hooks`). Examples: `packages/examples`.
- Docs in `docs/` (see `docs/resources/*`). Utility scripts in `scripts/`.
- Source lives in `src/*` and builds to `dist/*`. Tests are colocated with code as `*.test.ts` or `*.spec.ts`.

## Build, Test, and Development Commands
- Install: `bun install` — install workspace dependencies.
- Dev (watch): `bun run dev` — turbo-run dev tasks across packages.
- Build all: `bun run build` — full workspace build. Packages only: `bun run build:packages`.
- Test: `bun run test` — run Vitest locally. CI mode: `bun run test:ci`.
- Typecheck: `bun run typecheck` (package) • `bun run typecheck:all` (workspace).
- Lint/Format: `bun run lint` • fix: `bun run lint:fix` • format: `bun run format`.
- Releases: `bun run changeset`, `changeset:version`, `changeset:publish`. Verify artifacts: `bun run verify:build`.

## Coding Style & Naming Conventions
- Language: TypeScript (ES modules). Prefer explicit exports from `src/*` to `dist/*`.
- Indentation 2 spaces; EOL `lf`; UTF‑8; final newline (`.editorconfig`).
- Filenames kebab-case; package names `@claude-code/<package>`; types/interfaces in PascalCase.
- Lint/format via Ultracite + Biome/Prettier. Run `bun run lint` and `bun run format` before commits.

## Testing Guidelines
- Framework: Vitest. Keep tests fast and deterministic.
- Naming: `*.test.ts` or `*.spec.ts`, colocated with source.
- Utilities: mock Claude Code context with `@claude-code/hooks-testing`.
- Coverage (optional): `vitest --coverage`.

## Commit & Pull Request Guidelines
- Conventional Commits enforced by Commitlint (lower‑case type/scope/subject).
  - Examples: `feat(core): add hook builder middleware` • `fix(cli): handle missing config path)`
- Git hooks (Lefthook): pre-commit runs format/lint/typecheck; pre-push runs tests.
- PRs include: summary, scope (`packages/...`), linked issues, before/after notes, and confirmation that `bun run ci:full` and `bun run release:check` pass. Add a Changeset for publishable changes.

## Security & Configuration Tips
- Never commit secrets. Validate risky tool inputs with `@claude-code/hooks-validators`; prefer safe defaults.
- Keep exports stable; verify with `bun run verify:build` (and `bun run lint:packages` if configured).
- See `README.md` and `docs/resources/*` for hook lifecycle, env vars, and troubleshooting.

