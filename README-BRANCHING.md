# Branching & Workflow Guidelines

## Branching Strategy

- **`master`** = The stable, working production version.
  - Only updated by merging a thoroughly tested `dev` branch.
  - **Nobody commits to `master` directly.**

- **`dev`** = The active development branch.
  - Where all active feature work and bug fixes happen.
  - Both team members work directly on this branch.

---

## Team Workflow Rules

1. **Pull First Before Working**:
   - At the start of every work session, always run `git pull origin dev` first to retrieve the latest changes and avoid overwriting in-progress work from other team members.

2. **Commit & Push Frequently**:
   - Commit and push in small, frequent chunks rather than one large commit at the end of a session.
   - Frequent pushes keep team members in sync and allow conflicts to be spotted and resolved early.

3. **Merging to `master`**:
   - `dev` is merged into `master` **only after** a feature has been manually tested and confirmed working.
   - Never push code directly to `master`.
