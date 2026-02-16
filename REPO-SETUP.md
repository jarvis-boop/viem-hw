# Repository Setup

This document explains how to configure GitHub secrets and variables to enable automated releases.

## CI (Always Active)

The CI workflow runs on every push and PR:
- Format check (oxfmt)
- Lint (oxlint)
- Type check (tsc)
- Tests (bun test)
- Build (zile)

No configuration needed — works out of the box.

## Release Workflow (Disabled by Default)

The release workflow uses [Changesets](https://github.com/changesets/changesets) to manage versions and publish to npm.

### Enable Releases

1. **Set up npm token:**
   - Go to [npmjs.com](https://www.npmjs.com/) → Access Tokens → Generate New Token
   - Select "Automation" type (for CI/CD)
   - Copy the token

2. **Add secrets to GitHub:**
   - Go to repo → Settings → Secrets and variables → Actions
   - Add secret: `NPM_TOKEN` = your npm automation token

3. **Enable the workflow:**
   - Go to repo → Settings → Secrets and variables → Actions → Variables
   - Add variable: `ENABLE_RELEASE` = `true`

### How Changesets Works

1. **Create a changeset** when making changes:
   ```bash
   bun changeset
   ```
   This creates a file in `.changeset/` describing the change and version bump type.

2. **On push to main**, if `ENABLE_RELEASE=true`:
   - If changesets exist: Creates a "Version Packages" PR
   - If that PR is merged: Publishes to npm and creates GitHub releases

### Required Secrets

| Secret | Required | Description |
|--------|----------|-------------|
| `GITHUB_TOKEN` | Auto | Provided by GitHub Actions automatically |
| `NPM_TOKEN` | Yes | npm automation token for publishing |

### Required Variables

| Variable | Value | Description |
|----------|-------|-------------|
| `ENABLE_RELEASE` | `true` | Enables the release workflow |

## Local Development

```bash
# Install dependencies
bun install

# Run all checks
bun run check

# Create a changeset (before PR)
bun changeset

# Preview version bump
bun run version

# Build
bun run build
```

## Package Visibility

The package is configured as `"access": "public"` in `.changeset/config.json` for npm publishing.
