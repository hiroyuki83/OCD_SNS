# GitHub main Ruleset Setup

Production execution requires `main` to be protected by an active GitHub branch ruleset.

The repository workflows expect two stable required status-check contexts:

- `verify` — Security integration CI
- `e2e-required-gate` — CoCo E2E required gate

The browser E2E job itself is intentionally **not** the required status context.
For docs-only changes, browser E2E is skipped while `e2e-required-gate` still completes successfully.

## Recommended configuration

Open:

1. GitHub repository
2. **Settings**
3. **Rules**
4. **Rulesets**
5. **New ruleset**
6. **New branch ruleset**

Suggested ruleset name:

`main-protection`

Set enforcement to:

`Active`

### Target branches

Use one of:

- Include default branch
- or explicitly include `refs/heads/main`

Do not target temporary feature branches unless there is a separate reason to do so.

## Required branch rules

Enable all of the following.

### Restrict deletions

Enable the branch deletion restriction.

This is required by `Repository Main Guard Check`.

### Block force pushes

Enable non-fast-forward / force-push protection.

This is required by `Repository Main Guard Check`.

### Require a pull request before merging

Enable pull-request enforcement for `main`.

For this single-maintainer repository, the release tooling only requires that changes go through a PR.
A mandatory external approval count is not required by the CoCo release gate.

If review requirements are added later, make sure they do not make routine maintenance impossible.

### Require status checks to pass

Add exactly these stable check contexts:

- `verify`
- `e2e-required-gate`

Recommended:

- require branches to be up to date before merging, if GitHub offers that option for the selected ruleset
- do not use `browser-e2e` as the required context

`e2e-required-gate` behaves as follows:

- release-affecting code changed → browser E2E must pass
- docs-only change → browser E2E is skipped, but the gate still passes

This prevents docs-only PRs from getting stuck with a permanently missing required E2E check.

## Bypass actors

Prefer no permanent bypass actor for ordinary development.

If a bypass is configured for emergency administration, keep it as narrow as possible and do not use it for normal release work.

## After saving the ruleset

Confirm that GitHub reports `main` as protected.

Then run:

**Actions → Repository Main Guard Check → Run workflow**

Expected summary:

`Repository main guard: PASS`

The check verifies:

- `main protected = true`
- pull-request rule is active
- force-push protection is active
- branch deletion protection is active
- required status-check rules are active
- `verify` is required
- `e2e-required-gate` is required

## Production pre-execution sequence

Only after `Repository Main Guard Check` passes:

1. run `Production Neon API Access Check`
2. run `Production Vercel API Access Check`
3. run `Production Pre-execution Self Check`
4. require PASS
5. keep the accepted `main` SHA frozen for the release
6. only then consider explicit approval for the first state-changing Production operation

The Production self-check independently re-verifies the active rules on `main`.

## Current safety behavior

If `main` is unprotected, or if any required rule/check is missing:

- Production Pre-execution Self Check fails
- Production Rollback Point Create cannot obtain a valid pre-execution attestation
- Production Stage A Apply cannot obtain a valid pre-execution attestation

Therefore Production execution remains blocked until the repository guard is correctly configured.
