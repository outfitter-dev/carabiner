# NPM Package Name Availability

This document tracks the availability status of @carabiner/\* package names on the npm registry.

## Status Overview

**Last checked:** September 15, 2025 **Total packages:** 14 **Available:** 14 **Unavailable:** 0

## Package List

All @carabiner/\* package names are currently **available** on npm:

| Package Name                | Status       | Notes           |
| --------------------------- | ------------ | --------------- |
| @carabiner/hooks-testing    | ✅ Available |                 |
| @carabiner/hooks-core       | ✅ Available |                 |
| @carabiner/types            | ✅ Available |                 |
| @carabiner/hooks-validators | ✅ Available |                 |
| @carabiner/plugins          | ✅ Available |                 |
| @carabiner/hooks-registry   | ✅ Available |                 |
| @carabiner/protocol         | ✅ Available |                 |
| @carabiner/schemas          | ✅ Available |                 |
| @carabiner/error-management | ✅ Available |                 |
| @carabiner/execution        | ✅ Available |                 |
| @carabiner/hooks-examples   | ✅ Available | Private package |
| @carabiner/registry         | ✅ Available |                 |
| @carabiner/hooks-cli        | ✅ Available |                 |
| @carabiner/hooks-config     | ✅ Available |                 |

## Checking Script

A script is available to re-check availability: `scripts/check-npm-availability.ts`

```bash
bun run scripts/check-npm-availability.ts
```

## Next Steps

1. **Ready for publishing:** All package names are available and can be published
2. **Registry configuration:** All packages are configured with `publishConfig.registry: "https://registry.npmjs.org/"`
3. **Publishing workflow:** GitHub Actions workflow is set up for automated publishing on releases
4. **Private packages:** @carabiner/hooks-examples is marked as private and will not be published

## Publishing Readiness

✅ **All packages are ready for npm publishing**

- [x] Package names available on npm
- [x] publishConfig.access set to "public"
- [x] publishConfig.registry set to "https://registry.npmjs.org/"
- [x] Required files (dist, README.md, LICENSE) included
- [x] GitHub Actions workflow configured
- [x] NODE_AUTH_TOKEN secret expected for authentication

---

_This document is automatically generated. Run the availability check script to update._
