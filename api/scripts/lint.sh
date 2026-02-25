#!/bin/bash
# Linting and formatting script for the API

set -e

cd "$(dirname "$0")/.."

echo "🔍 Running Ruff checks..."
uv run ruff check

echo "✨ Running Ruff formatter..."
uv run ruff format --check

echo "✅ All checks passed!"
