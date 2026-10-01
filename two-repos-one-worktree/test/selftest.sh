#!/usr/bin/env bash
#
# selftest.sh — the self-test of `assets`, run by `pnpm assets:selftest`.
#
# Every case is built for real in its own throwaway directory, and every directory in the path
# contains a space. The four violations of `assets check` are produced by breaking a working
# layout, not simulated: a check that has never been seen to fail proves nothing.
#
# When mawk exists it is forced ahead of gawk on PATH, so that the run exercises the more limited
# awk. Set ASSETS_SELFTEST_NO_MAWK=1 to run with the system's own awk instead; the two runs are
# expected to agree.
#
# Everything it creates is under one temporary directory, removed on exit, also on failure.

set -uo pipefail

SELF_DIR=$(cd -- "$(dirname -- "$0")" && pwd) || exit 1
ASSETS="$SELF_DIR/../assets"
[ -f "$ASSETS" ] || {
  printf 'selftest: cannot find %s\n' "$ASSETS" >&2
  exit 1
}

PASSED=0
FAILED=0
WORK=''

cleanup() {
  [ -z "$WORK" ] || rm -rf -- "$WORK"
}
trap cleanup EXIT INT TERM

WORK=$(mktemp -d "${TMPDIR:-/tmp}/ci-devex-assets selftest.XXXXXX") || exit 1

# --- reporting ------------------------------------------------------------------------------------

pass() { # pass <case>
  PASSED=$((PASSED + 1))
  printf 'ok   %s\n' "$1"
}

fail() { # fail <case> <why>
  FAILED=$((FAILED + 1))
  printf 'FAIL %s: %s\n' "$1" "$2"
}

check_status() { # check_status <case> <expected> <actual>
  [ "$2" = "$3" ] || {
    fail "$1" "expected exit $2, got exit $3"
    return 1
  }
  return 0
}

check_contains() { # check_contains <case> <needle> <haystack>
  case $3 in
    *"$2"*) return 0 ;;
  esac
  fail "$1" "expected the output to contain \"$2\", got: $(printf '%s' "$3" | tr '\n' '|')"
  return 1
}

check_equal() { # check_equal <case> <what> <expected> <actual>
  [ "$3" = "$4" ] || {
    fail "$1" "$2: expected \"$3\", got \"$4\""
    return 1
  }
  return 0
}

# --- the awk the run uses ---------------------------------------------------------------------

force_mawk() {
  local mawk_path
  if [ -n "${ASSETS_SELFTEST_NO_MAWK:-}" ]; then
    printf 'awk: %s (mawk not forced, ASSETS_SELFTEST_NO_MAWK is set)\n' "$(command -v awk)"
    return 0
  fi
  mawk_path=$(command -v mawk 2>/dev/null) || {
    printf 'awk: %s (no mawk on this machine)\n' "$(command -v awk)"
    return 0
  }
  mkdir -p -- "$WORK/awk first" || return 1
  # A wrapper rather than a symlink: Git Bash on Windows cannot always make one.
  printf '#!/bin/sh\nexec %s "$@"\n' "$mawk_path" >"$WORK/awk first/awk" || return 1
  chmod +x -- "$WORK/awk first/awk" || return 1
  PATH="$WORK/awk first:$PATH"
  export PATH
  printf 'awk: %s (mawk forced ahead of gawk)\n' "$(awk -W version 2>&1 | head -n 1)"
}

# --- fixtures -------------------------------------------------------------------------------------

FIX_PRODUCT=''
FIX_GITDIR=''

fixture() { # fixture <name>  — a product repository and an assets repository, paths with spaces
  local root="$WORK/case $1"
  FIX_PRODUCT="$root/my product"
  FIX_GITDIR="$root/my assets.git"
  mkdir -p -- "$FIX_PRODUCT/src" "$FIX_PRODUCT/docs/assets" "$FIX_PRODUCT/ai assets" || return 1
  git -C "$FIX_PRODUCT" init -q . || return 1
  git -C "$FIX_PRODUCT" config user.email 'selftest@example.invalid' || return 1
  git -C "$FIX_PRODUCT" config user.name 'assets selftest' || return 1
  printf 'the product\n' >"$FIX_PRODUCT/src/app.txt"
  printf 'a nested asset\n' >"$FIX_PRODUCT/docs/assets/spec.md"
  printf 'a top-level asset\n' >"$FIX_PRODUCT/ai assets/skill.md"
  # A name outside ASCII: git quotes such a path in ls-files and status unless core.quotePath is
  # off, while ripgrep prints it raw, and the two lists are compared line by line (F23).
  printf 'an asset with a Japanese name\n' >"$FIX_PRODUCT/docs/assets/日本語 仕様.md"
}

OUT=''
STATUS=0

assets_run() { # assets_run <args...> — in FIX_PRODUCT, with FIX_GITDIR
  OUT=$(cd -- "$FIX_PRODUCT" && ASSETS_GIT_DIR="$FIX_GITDIR" bash "$ASSETS" "$@" 2>&1)
  STATUS=$?
}

assets_run_without_rg() { # the same, with a PATH that has no rg on it
  OUT=$(cd -- "$FIX_PRODUCT" &&
    PATH='/usr/bin:/bin' ASSETS_GIT_DIR="$FIX_GITDIR" bash "$ASSETS" "$@" 2>&1)
  STATUS=$?
}

# A working layout: initialised, the product tracking its own files, the assets committed.
working_layout() { # working_layout <name>
  fixture "$1" || return 1
  assets_run init --git-dir "$FIX_GITDIR" 'docs/assets' 'ai assets' || true
  [ "$STATUS" -eq 0 ] || {
    printf 'selftest: init failed in fixture %s: %s\n' "$1" "$OUT" >&2
    return 1
  }
  git -C "$FIX_PRODUCT" add -A || return 1
  assets_run add -A
  assets_run config user.email 'selftest@example.invalid'
  assets_run config user.name 'assets selftest'
  assets_run commit -q -m 'the assets'
  [ "$STATUS" -eq 0 ] || {
    printf 'selftest: the assets commit failed in fixture %s: %s\n' "$1" "$OUT" >&2
    return 1
  }
}

digest_three() { # the three files init writes, as one string
  sha256sum -- "$FIX_GITDIR/info/exclude" "$FIX_PRODUCT/.git/info/exclude" \
    "$FIX_PRODUCT/.ignore" | cut -d' ' -f1 | tr '\n' ' '
}

# --- the cases --------------------------------------------------------------------------------

case_init() {
  local name='init writes the whitelist, the exclude block and .ignore'
  fixture 'init' || {
    fail "$name" 'the fixture could not be built'
    return
  }
  assets_run init --git-dir "$FIX_GITDIR" 'docs/assets' 'ai assets'
  check_status "$name" 0 "$STATUS" || return
  local whitelist product ignore
  whitelist=$(cat -- "$FIX_GITDIR/info/exclude")
  product=$(cat -- "$FIX_PRODUCT/.git/info/exclude")
  ignore=$(cat -- "$FIX_PRODUCT/.ignore")
  check_contains "$name" '/*' "$whitelist" || return
  check_contains "$name" '!/docs/assets/' "$whitelist" || return
  check_contains "$name" '!/ai assets/' "$whitelist" || return
  check_contains "$name" '!/.ignore' "$whitelist" || return
  # the nested path needs its parent negated and the parent's other contents re-excluded
  check_contains "$name" '!/docs/
/docs/*' "$whitelist" || return
  check_contains "$name" '/docs/assets/' "$product" || return
  check_contains "$name" '/ai assets/' "$product" || return
  check_contains "$name" '/.ignore' "$product" || return
  check_contains "$name" '!/docs/assets/' "$ignore" || return
  check_contains "$name" '!/ai assets/' "$ignore" || return
  # .gitignore is never touched: the assets must not show up in the product's diff
  [ ! -f "$FIX_PRODUCT/.gitignore" ] || {
    fail "$name" 'init wrote a .gitignore'
    return
  }
  pass "$name"
}

case_init_again() {
  local name='a second init with the same paths changes no byte'
  fixture 'init again' || {
    fail "$name" 'the fixture could not be built'
    return
  }
  assets_run init --git-dir "$FIX_GITDIR" 'docs/assets' 'ai assets'
  check_status "$name" 0 "$STATUS" || return
  local before after
  before=$(digest_three)
  assets_run init --git-dir "$FIX_GITDIR" 'docs/assets' 'ai assets'
  check_status "$name" 0 "$STATUS" || return
  after=$(digest_three)
  check_equal "$name" 'the sha256 of the three files' "$before" "$after" || return
  pass "$name"
}

case_check_passes() {
  local name='check passes on a working layout, and search finds every asset'
  working_layout 'check passes' || {
    fail "$name" 'the fixture could not be built'
    return
  }
  assets_run check
  check_status "$name" 0 "$STATUS" || return
  check_contains "$name" '0 violations' "$OUT" || return
  # the nested asset really is tracked, which the whitelist as SCOPE.md words it would not do
  assets_run ls-files
  check_contains "$name" 'docs/assets/spec.md' "$OUT" || return
  check_contains "$name" 'ai assets/skill.md' "$OUT" || return
  check_contains "$name" '.ignore' "$OUT" || return
  pass "$name"
}

case_non_ascii() {
  local name='check passes when an asset file has a name outside ASCII'
  working_layout 'non ascii' || {
    fail "$name" 'the fixture could not be built'
    return
  }
  if ! command -v rg >/dev/null 2>&1; then
    fail "$name" 'rg is not on PATH, so the search check cannot be exercised'
    return
  fi
  # tracked by the assets repository
  assets_run check
  check_status "$name" 0 "$STATUS" || return
  check_contains "$name" '0 violations' "$OUT" || return
  # and untracked, under an asset path, which must not look like a stray product path either
  printf 'not committed yet\n' >"$FIX_PRODUCT/docs/assets/未追跡.md"
  assets_run check
  check_status "$name" 0 "$STATUS" || return
  check_contains "$name" '0 violations' "$OUT" || return
  pass "$name"
}

case_violation_tracked_by_both() {
  local name='control: a path tracked by both repositories is reported'
  working_layout 'tracked by both' || {
    fail "$name" 'the fixture could not be built'
    return
  }
  git -C "$FIX_PRODUCT" add -f -- 'docs/assets/spec.md' >/dev/null 2>&1
  assets_run check
  check_status "$name" 1 "$STATUS" || return
  check_contains "$name" 'tracked-by-both: docs/assets/spec.md' "$OUT" || return
  pass "$name"
}

case_violation_missing_negation() {
  local name='control: an asset path with no negation in .ignore is reported'
  working_layout 'missing negation' || {
    fail "$name" 'the fixture could not be built'
    return
  }
  # a path added to the product's exclude block by hand, with .ignore left behind
  mkdir -p -- "$FIX_PRODUCT/notes"
  printf 'a note\n' >"$FIX_PRODUCT/notes/n.md"
  local exclude line
  exclude="$FIX_PRODUCT/.git/info/exclude"
  while IFS= read -r line; do
    printf '%s\n' "$line"
    [ "$line" != '/ai assets/' ] || printf '/notes/\n'
  done <"$exclude" >"$exclude.new"
  mv -- "$exclude.new" "$exclude"
  assets_run check
  check_status "$name" 1 "$STATUS" || return
  check_contains "$name" 'missing-negation: notes/' "$OUT" || return
  pass "$name"
}

case_violation_hidden_from_search() {
  local name='control: an asset the search cannot find is reported'
  working_layout 'hidden from search' || {
    fail "$name" 'the fixture could not be built'
    return
  }
  if ! command -v rg >/dev/null 2>&1; then
    fail "$name" 'rg is not on PATH, so the search check cannot be exercised'
    return
  fi
  # a deeper .ignore, which ripgrep honours over the one at the root
  printf 'spec.md\n' >"$FIX_PRODUCT/docs/assets/.ignore"
  assets_run check
  check_status "$name" 1 "$STATUS" || return
  check_contains "$name" 'hidden-from-search: docs/assets/spec.md' "$OUT" || return
  pass "$name"
}

case_violation_stray_status() {
  local name='control: a status that strays into the other repository is reported'
  working_layout 'stray status' || {
    fail "$name" 'the fixture could not be built'
    return
  }
  # the whitelist drifts and starts picking up the product's own directory
  printf '!/src/\n' >>"$FIX_GITDIR/info/exclude"
  assets_run check
  check_status "$name" 1 "$STATUS" || return
  check_contains "$name" "stray-status: the assets repository's status shows the product path src/" \
    "$OUT" || return
  pass "$name"
}

case_require_rg() {
  local name='--require-rg without rg on PATH is a usage error'
  working_layout 'require rg' || {
    fail "$name" 'the fixture could not be built'
    return
  }
  if PATH='/usr/bin:/bin' command -v rg >/dev/null 2>&1; then
    fail "$name" 'rg is reachable from /usr/bin:/bin, so the arm cannot be exercised'
    return
  fi
  assets_run_without_rg check
  check_status "$name" 0 "$STATUS" || return
  check_contains "$name" 'search check skipped: rg not found' "$OUT" || return
  assets_run_without_rg check --require-rg
  check_status "$name" 3 "$STATUS" || return
  check_contains "$name" 'rg is not on PATH' "$OUT" || return
  pass "$name"
}

case_passthrough() {
  local name='the passthrough acts on the assets repository and leaves the product alone'
  fixture 'passthrough' || {
    fail "$name" 'the fixture could not be built'
    return
  }
  assets_run init --git-dir "$FIX_GITDIR" 'docs/assets' 'ai assets'
  check_status "$name" 0 "$STATUS" || return
  git -C "$FIX_PRODUCT" add -A
  local before after
  before=$(git -C "$FIX_PRODUCT" status --porcelain)
  assets_run config user.email 'selftest@example.invalid'
  assets_run config user.name 'assets selftest'
  assets_run add -A
  check_status "$name" 0 "$STATUS" || return
  assets_run commit -q -m 'the assets'
  check_status "$name" 0 "$STATUS" || return
  assets_run status --porcelain
  check_status "$name" 0 "$STATUS" || return
  check_equal "$name" "the assets repository's status after the commit" '' "$OUT" || return
  after=$(git -C "$FIX_PRODUCT" status --porcelain)
  check_equal "$name" "the product's status, before and after" "$before" "$after" || return
  assets_run log --oneline
  check_contains "$name" 'the assets' "$OUT" || return
  pass "$name"
}

case_usage_errors() {
  local name='a usage error exits 3'
  fixture 'usage' || {
    fail "$name" 'the fixture could not be built'
    return
  }
  assets_run init --git-dir "$FIX_GITDIR" '../outside'
  check_status "$name" 3 "$STATUS" || return
  check_contains "$name" 'must not contain ".."' "$OUT" || return
  assets_run init --git-dir "$FIX_GITDIR"
  check_status "$name" 3 "$STATUS" || return
  assets_run check --git-dir "$FIX_GITDIR/absent"
  check_status "$name" 3 "$STATUS" || return
  pass "$name"
}

# --- the run ----------------------------------------------------------------------------------

force_mawk
printf 'bash: %s\n' "${BASH_VERSION}"
printf 'git:  %s\n' "$(git --version)"
printf '\n'

case_init
case_init_again
case_check_passes
case_non_ascii
case_violation_tracked_by_both
case_violation_missing_negation
case_violation_hidden_from_search
case_violation_stray_status
case_require_rg
case_passthrough
case_usage_errors

printf '\n%s passed, %s failed\n' "$PASSED" "$FAILED"
[ "$FAILED" -eq 0 ] || exit 1
