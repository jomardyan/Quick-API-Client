#!/usr/bin/env bash
# release.sh — bump version, run tests, and package the extension for publishing.
# Usage:
#   ./release.sh            # patch bump (1.1.0 → 1.1.1)
#   ./release.sh minor      # minor bump (1.1.0 → 1.2.0)
#   ./release.sh major      # major bump (1.1.0 → 2.0.0)
#   ./release.sh --no-bump  # skip version bump

set -euo pipefail
cd "$(dirname "$0")"

# ──────────────────────────────────────────────
# Config
# ──────────────────────────────────────────────
BUMP_TYPE="${1:-patch}"
MANIFEST="manifest.json"
PKG="package.json"
DIST_DIR="${DIST_DIR:-dist/generated}"
NODE_BIN="${NODE:-node}"
NPM_BIN="${NPM:-npm}"
ZIP_BIN="${ZIP_BIN:-zip}"
JQ_BIN="${JQ:-jq}"

# Files/dirs to include in the ZIP (relative to project root)
INCLUDE_FILES=(
  manifest.json
  popup.html
  popup.js
  popup.css
  options.html
  options.js
  options.css
  background.js
  defaults.js
  popup/
  LICENSE
  COPYRIGHT.md
  PRIVACY_POLICY.md
  icons/
)

# ──────────────────────────────────────────────
# Helpers
# ──────────────────────────────────────────────
require_cmd() {
  command -v "$1" >/dev/null 2>&1 || { echo "ERROR: '$1' is required but not installed."; exit 1; }
}

bump_semver() {
  local version="$1"
  local type="$2"
  local major minor patch
  IFS='.' read -r major minor patch <<< "$version"
  case "$type" in
    major) major=$((major + 1)); minor=0; patch=0 ;;
    minor) minor=$((minor + 1)); patch=0 ;;
    patch) patch=$((patch + 1)) ;;
    --no-bump) echo "$version"; return ;;
    *) echo "ERROR: Unknown bump type '$type'. Use major, minor, patch, or --no-bump." >&2; exit 1 ;;
  esac
  echo "${major}.${minor}.${patch}"
}

# ──────────────────────────────────────────────
# Pre-flight checks
# ──────────────────────────────────────────────
require_cmd "$NODE_BIN"
"$NODE_BIN" scripts/make-support.mjs guard "$DIST_DIR"
require_cmd "$NPM_BIN"
require_cmd "$ZIP_BIN"
require_cmd "$JQ_BIN"

# ──────────────────────────────────────────────
# Read current version from manifest.json
# ──────────────────────────────────────────────
CURRENT_VERSION=$("$JQ_BIN" -r '.version' "$MANIFEST")
echo "Current version : $CURRENT_VERSION"

NEW_VERSION=$(bump_semver "$CURRENT_VERSION" "$BUMP_TYPE")
echo "New version     : $NEW_VERSION"

# Validate source before changing version metadata.
"$NPM_BIN" run lint
"$NPM_BIN" run test:dependencies
"$NPM_BIN" test -- --runInBand

if [[ "$BUMP_TYPE" != "--no-bump" ]]; then
  "$NODE_BIN" - "$NEW_VERSION" <<'NODE'
const fs = require("fs");
const version = process.argv[2];
for (const file of ["manifest.json", "package.json", "package-lock.json"]) {
  const json = JSON.parse(fs.readFileSync(file, "utf8"));
  json.version = version;
  if (json.packages && json.packages[""]) json.packages[""].version = version;
  fs.writeFileSync(file, JSON.stringify(json, null, 2) + "\n");
}
NODE
fi

# ──────────────────────────────────────────────
# Build output directory and zip archive
# ──────────────────────────────────────────────
ZIP_NAME="quick-api-client-v${NEW_VERSION}.zip"
ZIP_PATH="${DIST_DIR}/${ZIP_NAME}"

mkdir -p "$DIST_DIR"
rm -f "$ZIP_PATH"

# Build the zip directly from source — no staging copy needed
"$ZIP_BIN" -r "$ZIP_PATH" "${INCLUDE_FILES[@]}" \
  --exclude "*.DS_Store" \
  --exclude "__MACOSX/*"

# Never report success for a missing archive or a ZIP with corrupt members.
[[ -f "$ZIP_PATH" ]] || { echo "ERROR: Package was not created: $ZIP_PATH" >&2; exit 1; }
"$ZIP_BIN" -T "$ZIP_PATH"

echo ""
echo "Package created : $ZIP_PATH"
echo "Size            : $(du -sh "$ZIP_PATH" | cut -f1)"

# ──────────────────────────────────────────────
# Git tag (optional — only when NOT skipping bump)
# ──────────────────────────────────────────────
if [[ "$BUMP_TYPE" != "--no-bump" ]] && command -v git >/dev/null 2>&1; then
  if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    echo ""
    read -r -p "Create git tag v${NEW_VERSION} and commit version bump? [y/N] " CONFIRM
    if [[ "${CONFIRM,,}" == "y" ]]; then
      git add "$MANIFEST" "$PKG" package-lock.json
      git commit -m "chore: bump version to v${NEW_VERSION}"
      git tag "v${NEW_VERSION}"
      echo "Tagged: v${NEW_VERSION}"
      echo "Push with: git push && git push --tags"
    fi
  fi
fi

echo ""
echo "Done. Ready to publish: $ZIP_PATH"
