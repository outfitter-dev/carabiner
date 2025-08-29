# v0.1.0-alpha Release Preflight

**CLOSES: #41**

## Release Target: 2025-08-28

This branch serves as the base for all v0.1.0-alpha release preparations.

## Stack Structure

All PRs for v0.1 release are stacked on top of this branch:

1. **v0.1-preflight** (this branch) - Base for all release work
2. **cb-8-tests-fail-when-run-through-turbo-but-pass-with-direct-bun** - Fix test execution issues  
3. **feat/add-examples** - Comprehensive example hooks
4. **08-27-fix_implement_proper_timeout_cleanup_in_executor_to_prevent_memory_leaks** - Timeout cleanup
5. **08-27-docs_add_turbo_removal_impact_analysis_for_mvp_decision** - Documentation

## Pre-Release Checklist

- [ ] All tests passing (currently 3 failures)
- [ ] No merge conflicts in stack
- [ ] CodeRabbit feedback addressed
- [ ] npm publishing configured
- [ ] Getting Started documentation created
- [ ] Package versions updated to 0.1.0-alpha
- [ ] GitHub release notes prepared

## Critical Fixes Needed

1. **Test Failures**: 3 tests currently failing
2. **Merge Conflicts**: PRs #23 and #37 have conflicts
3. **Code Review**: Address CodeRabbit feedback from PR #36
4. **Cherry-pick**: Unique fixes from PR #36/37 need to be integrated

## Release Process

1. Complete all checklist items
2. Merge entire stack to main via Graphite
3. Tag as v0.1.0-alpha
4. Publish all packages to npm
5. Create GitHub release with changelog