---
name: git-workflow
description: >
  Handles git workflow: creating branches, atomic commits with conventional prefixes,
  PR creation with structured summaries, keeping PR descriptions updated on follow-up pushes,
  and post-merge cleanup.
  Use when the user asks to commit, create or update a PR, push changes, address PR feedback,
  or says a PR was merged.
---

# Git Workflow

Manage the git workflow for this project. Follow these conventions strictly.

## Branch Naming

Create descriptive branch names using category prefixes:

- `feat/short-description` — new features
- `fix/short-description` — bug fixes
- `refactor/short-description` — code restructuring
- `chore/short-description` — maintenance, deps, config
- `security/short-description` — security fixes
- `ui/short-description` — UI/UX changes
- `improve/short-description` — improvements and optimizations

## Commit Conventions

Each commit must be **atomic** — one logical change per commit.

Commit message format: `prefix: short imperative description`

Prefixes: `fix:`, `feat:`, `refactor:`, `chore:`, `ci:`, `docs:`, `test:`

Use `feat!:` or `fix!:` for breaking changes.

Rules:
- If this is the first commit in a batch, run `npm run build && npm run lint && npm run test` before creating commits. If any step fails, abort immediately and return the failure to the caller. Do not attempt to fix unrelated issues from inside this skill.
- One logical change per commit — do not bundle unrelated changes
- Keep the subject line under 72 characters
- No period at the end of the subject line
- Always include this trailer at the end of every commit message:
  `Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>`

Before creating any commit, review staged changes with `git diff --cached` to ensure only intended changes are included.

## PR Creation and Updates

After all commits are ready and pushed:

1. Push the branch: `git push -u origin <branch-name>`
2. Create a PR with `gh pr create`
3. PR body must include a **summary table** of all commits:

```markdown
| Commit | Change |
|--------|--------|
| `fix:` description | What was fixed and why |
| `feat:` description | What was added |
```

When reporting success back to the user, include the branch name, relevant commit SHA(s), and PR URL.

## PR Follow-Up Pushes

When a branch already has an open PR and you push additional commits:

1. Read the current PR body with `gh pr view --json body -q .body` and use that exact content as the base for your update. Do not generate a fresh PR description from scratch.
2. Push the branch updates.
3. Refresh the PR description with `gh pr edit` so it reflects the latest state of the branch.
4. Treat the PR body as a surgical update, not a full rewrite:
   - preserve existing sections such as summary prose, validation steps, and other reviewer context
   - update the **summary table** to include new commits
   - remove or rewrite outdated entries when the implementation changed
   - mention review feedback fixes in the description when the new commits address PR comments
5. If the PR body does not already contain a summary table, add one without removing the rest of the description.
6. Before running `gh pr edit`, verify the updated body still contains the important sections from the original PR description.

Never leave the PR description stale after pushing fixes to an existing PR.

## History Rewrites

If the user explicitly asks to redo commits, split a monolithic commit, or force-push a corrected branch:

1. Rebuild the branch history into atomic commits that match the conventions above.
2. Use `git push --force-with-lease` only when the user explicitly requested rewriting remote history.
3. After the push, make sure the PR description still matches the new commit set.

## Post-Merge Cleanup

When told a PR is merged:

1. `git checkout main`
2. `git pull origin main`
3. Delete the merged branch locally: `git branch -d <branch-name>`
4. Confirm the local main is up to date
