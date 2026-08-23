# Repository governance

The repository records a preclinical structural prototype. A successful local
command is not a successful CI run.

## Required remote controls

The remote repository administrator must create a branch ruleset for `main`:

- require pull requests and one approving review;
- require CODEOWNER review;
- dismiss stale approvals;
- require the `quality / verify` status check;
- require resolution of review conversations;
- block force pushes and branch deletion;
- disallow bypass, including administrators where the hosting plan permits it.

These settings cannot be enforced by files in this repository. They remain
unverified until a remote exists and its ruleset is queried through the hosting
provider API.

## Claim policy

Clinical fixtures are contract fixtures unless an external clinical review
record identifies reviewer, scope, date, rubric, findings, and approved fixture
hash. Engineering tests and coverage do not constitute clinical validation.

The initial line/branch coverage gate is 75 percent. The current percentage is
reported by CI per module. Raising this threshold is required as defensive
branches and additional engines acquire contract tests; lowering it requires a
reviewed governance change.
