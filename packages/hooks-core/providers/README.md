# Provider Adapter Layer

This directory now houses the provider abstraction for Carabiner hooks. The initial implementation ships with:

- [x] Provider adapter TypeScript interfaces and registry utilities.
- [x] Default Claude adapter that translates between Claude Code payloads and the normalized Carabiner context.
- [x] Translation-focused unit tests that snapshot normalized contexts and ensure round-tripping through the Claude adapter.

Further provider implementations can live alongside the Claude adapter within `src/providers` and register themselves through the shared registry helpers.
