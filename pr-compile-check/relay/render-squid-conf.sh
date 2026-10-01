#!/usr/bin/env bash
#
# render-squid-conf.sh <template> <output>
#
# Substitutes the four upstream settings into squid.conf.template and writes the result with mode
# 0600. It is run inside the relay container at start, so the rendered file never exists on the
# host and never reaches an image layer.
#
# UPSTREAM_HOST, UPSTREAM_PORT, UPSTREAM_USER and UPSTREAM_PASSWORD come from the environment
# (compose reads them from .env, which is git-ignored; .env.example holds dummies).
#
# It refuses an empty value and a value holding whitespace: squid's `login=user:password` has no
# quoting, so a value with a space in it would silently become something else, and an empty one
# would render a configuration that authenticates with nothing and fails at the first request with
# a 407 nobody can explain.
#
# It never prints the rendered file, and never prints a value.

set -uo pipefail

die() {
  printf 'render-squid-conf: %s\n' "$*" >&2
  exit 1
}

[ $# -eq 2 ] || die 'usage: render-squid-conf.sh <template> <output>'
template=$1
output=$2
[ -f "$template" ] || die "the template $template does not exist"

require() { # require <name>
  local name=$1 value
  value=${!name-}
  [ -n "${!name+set}" ] || die "$name is not set"
  [ -n "$value" ] || die "$name is empty"
  case $value in
    *[[:space:]]*) die "$name holds whitespace" ;;
  esac
}

for name in UPSTREAM_HOST UPSTREAM_PORT UPSTREAM_USER UPSTREAM_PASSWORD; do
  require "$name"
done

case $UPSTREAM_PORT in
  '' | *[!0-9]*) die 'UPSTREAM_PORT must be a number' ;;
esac

# Substituted in bash, never with sed: a password may hold any character a sed script would treat
# as syntax, and a bash replacement takes the value literally.
umask 077
: >"$output" || die "cannot write $output"
while IFS= read -r line || [ -n "$line" ]; do
  line=${line//@UPSTREAM_HOST@/$UPSTREAM_HOST}
  line=${line//@UPSTREAM_PORT@/$UPSTREAM_PORT}
  line=${line//@UPSTREAM_USER@/$UPSTREAM_USER}
  line=${line//@UPSTREAM_PASSWORD@/$UPSTREAM_PASSWORD}
  printf '%s\n' "$line" >>"$output"
done <"$template"

# The count, never the content.
printf 'render-squid-conf: wrote %s (%s lines, mode 0600)\n' "$output" "$(wc -l <"$output")"
