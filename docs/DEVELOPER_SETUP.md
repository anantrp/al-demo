# Developer Setup

Complete setup guide for the project monorepo. Format-on-save and linting are pre-configured.

## Quick Start

1. **Open workspace file** (required for proper IDE integration):

   ```bash
   cursor project.code-workspace
   ```

2. **Install extensions** (if not already installed):
   - **Ruff** (charliermarsh.ruff)
   - **ESLint** (dbaeumer.vscode-eslint)
   - **Prettier** (esbenp.prettier-vscode)

3. **Reload window**: `Ctrl+Shift+P` → "Developer: Reload Window"

4. **Install dependencies**:

   ```bash
   # Root (required for Husky pre-commit hooks)
   npm install

   # Python API
   cd api && uv sync

   # Next.js App
   cd apps/web && npm install
   ```

That's it! Format-on-save is now active for all files.

## Project Structure

```
project/
├── api/                      # Python FastAPI (Ruff)
├── apps/web/                 # Next.js (ESLint + Prettier)
├── docs/                     # Documentation
└── project.code-workspace    # Pre-configured IDE settings
```

## What's Already Configured

**Python** (`api/pyproject.toml`):

- Ruff formatter (100 char line length)
- Python 3.13 + PEP 8 rules
- Format & auto-fix on save
- Pre-commit hooks via Husky

**TypeScript/JavaScript** (`apps/web/`):

- Prettier formatter (100 char line length)
- ESLint with Next.js rules
- Format & auto-fix on save
- Pre-commit hooks via Husky

## Environment Configuration

### Environment Variables

Each project keeps its own `.env` file in its directory:

```
api/.env                  # Python API environment variables
apps/web/.env.local       # Next.js app environment variables (gitignored)
```

**Note**: These files are gitignored. Never commit secrets to the repository.

### Service Account JSON

For local development, place service account JSON files in their respective project directories:

```
api/service-account.json        # For Python API
apps/web/service-account.json   # For Next.js app (if needed)
```

**Note**: Service account JSON files should be gitignored and never committed.

## Package Management

### Installing Packages

**Root level** (Husky, shared tooling):

```bash
# From repository root
npm install <package-name>
```

**Next.js app** (`apps/web`):

```bash
# Option 1: From root using workspace
npm install <package-name> -w apps/web

# Option 2: From apps/web directory
cd apps/web && npm install <package-name>
```

**Python API** (`api`):

```bash
cd api && uv add <package-name>
```

## Development Commands

### Python API

```bash
cd api

# Dev server
uv run uvicorn app.main:app --reload

# Lint & format (use scripts)
./scripts/lint.sh              # Check only
./scripts/fix.sh               # Auto-fix & format

# Or use Ruff directly
uv run ruff check              # Check
uv run ruff check --fix        # Fix
uv run ruff format             # Format
```

### Next.js App

```bash
cd apps/web

# Dev server
npm run dev

# Lint & format
npm run lint                   # Check
npm run lint:fix               # Auto-fix
npm run format                 # Format with Prettier
npm run format:check           # Check formatting
npm run build                  # Production build
```

## Pre-commit Hooks

Pre-commit hooks are **automatically configured** using Husky + lint-staged. They were set up during `npm install`.

**What happens on commit:**

1. **Python files** (`api/**/*.py`):
   - Ruff checks and auto-fixes issues
   - Ruff formats code

2. **TypeScript/JavaScript files** (`apps/web/**/*.{ts,tsx,js,jsx}`):
   - ESLint checks and auto-fixes issues
   - Prettier formats code

3. **Other files** (`apps/web/**/*.{json,css,md}`):
   - Prettier formats code

**Configuration**: See `lint-staged` section in root `package.json`

**To skip hooks** (not recommended):

```bash
git commit --no-verify
```

## Troubleshooting

**Ruff crashes**: Disable extension, use CLI (`./scripts/fix.sh`)

**Linting not working**: Open via workspace file, then reload window

**TypeScript version conflicts**: Accept "Use Workspace Version" prompt

**Python interpreter wrong**: Set to `api/.venv/bin/python`

## CI/CD

### Python

```yaml
- run: |
    cd api
    uv run ruff check --no-fix
    uv run ruff format --check
```

### Next.js

```yaml
- run: |
    cd apps/web
    npm ci
    npm run lint
    npm run format:check
```

## Key Files

- `project.code-workspace` - IDE settings (format-on-save, linters)
- `api/pyproject.toml` - Ruff configuration
- `apps/web/eslint.config.mjs` - ESLint rules
- `apps/web/.prettierrc.json` - Prettier config
- `api/scripts/*.sh` - Convenience lint/fix scripts
