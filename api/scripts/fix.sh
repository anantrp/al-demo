#!/bin/bash
# Auto-fix linting issues and format code

set -e

cd "$(dirname "$0")/.."

echo "🔧 Auto-fixing Ruff issues..."
uv run ruff check --fix

echo "✨ Formatting code..."
uv run ruff format

echo "✅ Done! Code has been fixed and formatted."
