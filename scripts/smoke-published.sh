#!/usr/bin/env bash
set -euo pipefail

NPM_REGISTRY="${NPM_REGISTRY:-https://npm.tangees.com/}"
SCAFFOLD_VERSION="${SCAFFOLD_VERSION:-latest}"
PACKAGE="@tungee/agent-workflow-scaffold@${SCAFFOLD_VERSION}"

TMP_ROOT="$(mktemp -d "${TMPDIR:-/tmp}/agent-workflow-published-smoke.XXXXXX")"
PROJECT_ROOT="${TMP_ROOT}/project"
WORKSPACE_ROOT="${TMP_ROOT}/HermesWorkspace"
INSTALL_ROOT="${TMP_ROOT}/runner"
CLI_BIN="${INSTALL_ROOT}/node_modules/.bin/agent-workflow"

cleanup() {
  rm -rf "$TMP_ROOT"
}
trap cleanup EXIT

run_cli() {
  "$CLI_BIN" "$@"
}

assert_file() {
  if [[ ! -f "$1" ]]; then
    echo "Missing expected file: $1" >&2
    exit 1
  fi
}

assert_contains() {
  local haystack="$1"
  local needle="$2"
  if [[ "$haystack" != *"$needle"* ]]; then
    echo "Expected output to contain: $needle" >&2
    echo "$haystack" >&2
    exit 1
  fi
}

mkdir -p "$PROJECT_ROOT" "$WORKSPACE_ROOT"
printf '# Published Smoke Project\n' > "${PROJECT_ROOT}/README.md"

echo "Smoke package: $PACKAGE"
echo "Registry: $NPM_REGISTRY"

npm install --silent --no-audit --no-fund --prefix "$INSTALL_ROOT" --registry="$NPM_REGISTRY" "$PACKAGE"
if [[ ! -x "$CLI_BIN" ]]; then
  echo "Missing executable: $CLI_BIN" >&2
  exit 1
fi

ANALYZE_OUTPUT="$(run_cli analyze --root "$PROJECT_ROOT" --json)"
assert_contains "$ANALYZE_OUTPUT" '"confidence"'

REGISTER_OUTPUT="$(run_cli hermes register --root "$PROJECT_ROOT" --workspace "$WORKSPACE_ROOT")"
assert_contains "$REGISTER_OUTPUT" "Hermes project registered"

TEAM_OUTPUT="$(run_cli hermes team init --workspace "$WORKSPACE_ROOT")"
assert_contains "$TEAM_OUTPUT" "Hermes team rules written"

LIST_OUTPUT="$(run_cli hermes list --workspace "$WORKSPACE_ROOT")"
assert_contains "$LIST_OUTPUT" "available"

DOCTOR_OUTPUT="$(run_cli hermes doctor --root "$PROJECT_ROOT" --workspace "$WORKSPACE_ROOT")"
assert_contains "$DOCTOR_OUTPUT" "Hermes doctor: OK"

TEAM_DOCTOR_OUTPUT="$(run_cli hermes team doctor --workspace "$WORKSPACE_ROOT")"
assert_contains "$TEAM_DOCTOR_OUTPUT" "Hermes team doctor: OK"

assert_file "${PROJECT_ROOT}/.hermes.md"
assert_file "${PROJECT_ROOT}/.agent-workflow/manifest.json"
assert_file "${WORKSPACE_ROOT}/HERMES.md"
assert_file "${WORKSPACE_ROOT}/.agent-workflow/hermes-team/rules.md"
assert_file "${WORKSPACE_ROOT}/.agent-workflow/hermes-team/delegation-playbook.md"
assert_file "${WORKSPACE_ROOT}/.agent-workflow/hermes-team/role-sources.md"
assert_file "${WORKSPACE_ROOT}/.agent-workflow/hermes-team/manifest.json"

grep -q "target=hermes-workspace" "${WORKSPACE_ROOT}/HERMES.md"
grep -q "target=hermes-team" "${WORKSPACE_ROOT}/HERMES.md"

echo "Published smoke passed for $PACKAGE"
