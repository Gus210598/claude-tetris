---
description: Create a git worktree under .trees/<name> and execute given instructions inside it, isolated from main working tree
---

Instructions to execute: $ARGUMENTS

Steps:

1. Derive a short kebab-case name (2-4 words max) summarizing the instructions above. Use that as `<name>`.
2. Check `.trees/<name>` doesn't already exist. If it does, append `-2`, `-3`, etc.
3. Run: `git worktree add .trees/<name>`
   - This creates a new branch `<name>` (or reuses one if it exists) checked out at `.trees/<name>`, based on current HEAD.
4. `cd` into `.trees/<name>` for all subsequent work in this task.
5. Execute the instructions from $ARGUMENTS entirely within `.trees/<name>`, without touching files in the main working tree.
6. When done, report the worktree path and branch name so the user can review, merge, or remove it (`git worktree remove .trees/<name>`).
