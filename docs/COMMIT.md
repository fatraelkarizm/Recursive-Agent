# Commit Protocol And Branch Workflow

The Recursive Agent repository keeps history readable by treating each logical change as a reviewable unit.

## Commit Principles
1. One logical change per commit.
2. Verify the change before committing.
3. Never commit secrets, tokens, or generated credentials.
4. Keep documentation updates separate from code changes when possible.
5. Prefer small, understandable commits over large mixed changes.

## What Counts As One Logical Change
A single commit should usually cover one of these:
- a UI panel
- an agent behavior change
- a fix for a tool integration
- a documentation update
- a test or validation improvement

If a change spans unrelated areas, split it.

## Commit Flow
Before committing:
1. Run the relevant validation command.
2. Inspect the diff.
3. Confirm that the change matches the intended scope.
4. Stage only the files that belong in that commit.
5. Write a clear commit message.

## Commit Message Format
Use Conventional Commits:

`<type>[optional scope]: <description>`

### Types
- feat: new user-facing behavior or capability
- fix: bug fix
- docs: documentation changes only
- refactor: code structure change without feature or bug intent
- test: new or updated tests
- chore: build, tooling, or maintenance work
- perf: performance improvement
- style: formatting only

### Examples
- `feat(agent): add mission state tracking`
- `fix(ui): prevent graph canvas overflow on mobile`
- `docs: expand setup instructions`
- `chore: update dependency registry`

## Branch Strategy
- `main` for the stable baseline
- `agent/<task-name>` for short-lived work branches when a task is large enough to isolate

it is acceptable to work on a single branch as long as commit messages stay clean and the history stays readable.

## Validation Rules
Choose the smallest relevant validation that proves the change works:
- lint for docs or UI changes that affect formatting or structure
- unit tests for logic changes
- build for integration changes
- smoke test for anything user-visible

## Do Not Commit
- `.env` or `.env.local`
- API keys
- generated secrets
- large binary artifacts unless the repository explicitly needs them
- experimental debug output that is not meant to stay

## Review Discipline
If a commit introduces a broad architectural change, note the reason in the commit body or in the pull request description so the next person can understand the tradeoff.

## Suggested Hackathon Cadence
For a short hackathon window:
- commit after each stable slice
- keep docs changes separate from working code when possible
- checkpoint before risky refactors
- make it easy to revert a bad idea without losing the rest of the work
