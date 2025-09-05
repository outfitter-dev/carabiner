#!/bin/bash
set -euo pipefail

# Label PRs in the stack appropriately
echo "🏷️ Labeling stack PRs for optimized CI..."

# Bottom of stack
echo "Labeling PR #54 as stack-bottom..."
gh pr edit 54 --add-label "stack-bottom" 2>/dev/null || gh label create "stack-bottom" --description "Bottom PR in a Graphite stack" --color "0969DA" && gh pr edit 54 --add-label "stack-bottom"

# Top of stack  
echo "Labeling PR #63 as stack-top..."
gh pr edit 63 --add-label "stack-top" 2>/dev/null || gh label create "stack-top" --description "Top PR in a Graphite stack" --color "1F883D" && gh pr edit 63 --add-label "stack-top"

# Middle stack PRs
for pr in 55 56 57 58 59 60 61 62; do
  echo "Labeling PR #$pr with skip-optional-checks..."
  gh pr edit "$pr" --add-label "skip-optional-checks" 2>/dev/null || gh label create "skip-optional-checks" --description "Skip optional CI checks for middle-stack PRs" --color "FBCA04" && gh pr edit "$pr" --add-label "skip-optional-checks"
done

echo "✅ Stack labeling complete!"
echo ""
echo "Stack structure:"
echo "  #54 (bottom) → #55-62 (middle) → #63 (top)"
echo ""
echo "CI behavior:"
echo "  - Bottom (#54): Full CI validation"
echo "  - Middle (#55-62): Minimal checks only" 
echo "  - Top (#63): Full CI validation"