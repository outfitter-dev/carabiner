# Repository Guidelines

## Project Structure & Module Organization
- Root workspace uses Bun + Turborepo. Workspaces live in `apps/*` and `packages/*`.
- Core libraries: `packages/hooks-core`, `packages/hooks-validators`, `packages/hooks-config`, `packages/hooks-testing`.
- CLI tools: `packages/hooks-cli` (binary `claude-hooks`). Examples: `packages/examples`.
- Docs in `docs/` (see `docs/resources/*`). Utility scripts in `scripts/`.

## Build, Test, and Development Commands
- Install: `bun install`
- Build all: `bun run build` (Turbo). Packages only: `bun run build:packages`
- Dev (watch): `bun run dev`
- Test: `bun run test` • CI mode: `bun run test:ci`
- Typecheck: `bun run typecheck` • All TS: `bun run typecheck:all`
- Lint/Format: `bun run lint` • Fix: `bun run lint:fix` • Format: `bun run format`
- Release helpers: `bun run changeset`, `bun run changeset:version`, `bun run changeset:publish`, `bun run release:check`
- Verify build artifacts: `bun run verify:build`

## Coding Style & Naming Conventions
- Indentation: 2 spaces (`.editorconfig`). EOL: `lf`; UTF‑8; final newline.
- Language: TypeScript (ES modules). Prefer explicit exports from `src/*` → build to `dist/*`.
- Lint/format via Ultracite + Biome/Prettier configs: run `bun run lint` and `bun run format` before committing.
- Package names: `@claude-code/<package>`. Filenames: kebab‑case; types/interfaces in PascalCase.

## Testing Guidelines
- Framework: Vitest. Write colocated tests as `*.test.ts` (or `*.spec.ts`).
- Run locally with `bun run test`; CI uses `bun run test:ci` (serialized).
- Prefer fast, deterministic unit tests; mock Claude Code context via `@claude-code/hooks-testing` utilities.
- Optional coverage: `vitest --coverage` (V8). Include critical path coverage with new features.

## Commit & Pull Request Guidelines
- Conventional Commits enforced by Commitlint (lower‑case type/scope/subject). Examples:
  - `feat(core): add hook builder middleware`
  - `fix(cli): handle missing config path`
- Pre-commit hooks (Lefthook) run format/lint/typecheck; pre-push runs tests.
- PRs must include: summary, scope (`packages/...`), linked issues, before/after notes, and confirm `bun run ci:full` and `bun run release:check` pass. Add a Changeset for any publishable change.

## Security & Configuration Tips
- Never commit secrets. Validate risky tool inputs with `@claude-code/hooks-validators` and prefer safer defaults in production.
- Keep exports stable: verify with `bun run verify:build` and `bun run lint:packages` before publishing.
- Consult `README.md` and `docs/resources/*` for hook lifecycle, env vars, and troubleshooting.

