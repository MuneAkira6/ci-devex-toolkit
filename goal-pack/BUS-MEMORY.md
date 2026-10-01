# Bus memory — ci-devex-toolkit

**This is a complement, not a summary.** Anything in PROGRESS.md, BUS-LOG.md or the goal brief does not
belong here. When a later measurement corrects an entry, come back and rewrite it. Marks: 🆕 new ·
✅ verified · 🔴 warning · ~~struck~~ no longer true.

## Environment facts across goals

- 🆕 Measured while the pack was written (2026-10-01; facts.md F1–F17): Node `v24.19.0`; pnpm
  `11.28.0` selected by `packageManager` (global 11.22.0, corepack not enabled); bash 5.0.17, git
  2.25.1, gawk 5.0.1 as `awk`, mawk 1.3.4; `rg` 15.2.0 on the run's `PATH`; no ShellCheck, actionlint or
  Java installed.
- 🆕 Every image the run may use is present and referenced by digest (SCOPE.md, F5). Nothing is pulled.
- 🆕 Containers here have no useful network (F7). The run's containers use none; the relay test's talk
  only to each other.
- 🆕 Ports 18440–18449 were free; the run uses 18441 and 18442 on 127.0.0.1. Other services listen on
  this machine and must not be touched.
- 🆕 An HTTPS proxy is configured through environment variables. Nobody unsets or prints them, and
  nobody passes them into a container.
- 🆕 The run uses its own Claude configuration directory, so no user-level skills, memory or MCP servers
  are loaded. That is intended.

## Doubts to re-check

## The worker's habits

## Proven along the way — later goals may cite

## What the bus verified itself

## Rulings the bus made

## Watch closely

- 🔴 The tool never guesses: no alias for an ambiguous name, no override or default added to make a run
  green. The two sample overrides are human rulings and are given; any other needs a ruling.
- 🔴 The parsers follow the real fixtures (F10, F11), not a format remembered from documentation; the
  single-license Gradle shape is refused, not read.
- 🔴 Every check has a control that really went red, in a real run.
- 🔴 On Linux the A/B arms come out the same (F13). That is a result to report as it is, not something
  to tune away or explain with numbers that were not measured here.
- 🔴 No JVM here, and the proxy's credentials are not the run's: the sbt and Gradle reports are given,
  and the CI regenerates them (F12). A row that needs a JVM says so; it does not fake one.
- 🔴 Files a container wrote into a bind mount belong to root: removed through a container, never left
  behind, never with sudo.
- 🔴 Your own probes stay in the OS temp directory, follow the Docker red line, and are cleaned up.
