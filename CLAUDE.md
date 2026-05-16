# ScrollGuard — Claude Instructions

## Git workflow rules

- **Never commit automatically.** Only commit when the user explicitly says "git commit" or equivalent.
- **Never push automatically.** Only push when the user explicitly says "git push" or equivalent.
- When committing, always include Claude as co-author:
  ```
  Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
  ```
- All changes go to branch `claude/eloquent-greider-3f5c08` and land on **PR #2** until the user says otherwise.
- After making code changes, stop and let the user review. Do not stage, commit, or push unless asked.

## Project context

ScrollGuard is an Android digital wellbeing companion app built with React Native + Expo bare workflow.
PRD is in `README.md`. Full context is in memory files under `.claude/projects/`.
