# Goal brief — ci-devex-toolkit

> This file is the worker's only entry point. Read all of it before you start.
> Contract: [SCOPE.md](SCOPE.md). Facts: [facts.md](facts.md). Ledger: [PROGRESS.md](PROGRESS.md).
> Human manual: [runbook.md](runbook.md). Source material: [materials/practice.md](materials/practice.md).

## Mission

Build four small, honest tools from the author's CI and developer-experience work, so that a reader can
run each one and see why it is built that way: a license inventory across pnpm, sbt and Gradle that
fails instead of guessing; a helper that keeps two repositories in one working tree from overlapping; a
PR compile-check workflow for a self-hosted runner with a checker for its rules and a relay proxy tested
against a mock; and a harness that measures bind mounts against named volumes with no network inside its
containers. Every check is shown to fail on a planted violation before its green counts.

| Goal | Scope | In one line |
|---|---|---|
| G0 | skeleton | toolchain, the environment re-measured, the fixtures read, the contract frozen |
| G1 | oss-inventory | three parsers, normalisation, overrides, texts and notices, exit codes, the live pnpm sample |
| G2 | two-repos-one-worktree | `assets` init / check / passthrough, its self-test on gawk and mawk, ShellCheck |
| G3 | pr-compile-check | the template, the rule checker with planted violations, actionlint, the relay and its test, the runbook |
| G4 | devcontainer-io-ab | the sample, the arms, the harness, a full measurement on this host, clean-up |
| G5 | finish | READMEs, CI, PUBLISHING.md, the contract → AS-BUILT |

Every row is already listed in PROGRESS.md. Do not add or remove rows; to change a plan, write the
reason in PROGRESS.md first.

## Required reading

| Resource | Why |
|---|---|
| [SCOPE.md](SCOPE.md) | the only authority for the interfaces, formats, exit codes, rules, images and ports |
| [facts.md](facts.md) | what was measured before the run, with the commands; you append yours from F18 on |
| [materials/practice.md](materials/practice.md) | the rules and their reasons, and everything you may say about the author's practice |
| [PROGRESS.md](PROGRESS.md) | the rows you judge |

## Facts already verified — use them, do not re-investigate

Each has its entry in [facts.md](facts.md) with the command and the output.

- **F1, F2**: Ubuntu 20.04.6, 12 CPUs, Docker 28.1.1. Node `v24.19.0`; inside the repository pnpm is
  `11.28.0` (the global one is 11.22.0 and switches itself; corepack is not enabled here and stays so).
  This skeleton installs in about 2 s with no build script; `erasableSyntaxOnly` is on, so write
  erasable TypeScript only (no enums, namespaces or parameter properties). Node runs `.ts` directly;
  local imports carry the `.ts` suffix and types use `import type`.
- **F3**: bash 5.0.17, git **2.25.1** (no `git init -b`; `init.defaultBranch` is ignored), `awk` is
  gawk 5.0.1, and mawk 1.3.4 is at `/usr/bin/mawk`.
- **F4**: no ripgrep, ShellCheck, actionlint or Java on the system. `rg` 15.2.0 is on your `PATH` from a
  directory of this run; ShellCheck and actionlint run from their images. **There is no JVM: you do not
  run sbt or Gradle.**
- **F5**: the images of SCOPE.md are present, by digest. The Node image has no curl and no openssl; the
  squid image starts as root and has `sed`. **Nothing is pulled.**
- **F6**: ports 18440–18449 are free; the run uses 18441 and 18442 on 127.0.0.1 only. Other services
  listen on this machine (3128 among them) and are not touched.
- **F7**: containers here get no proxy and cannot usefully reach the internet. **No container of the run
  uses the network**; never pass the proxy variables into one.
- **F8, F9**: the shape of `pnpm licenses list --json --prod`, and `--filter <name>` in this workspace;
  spdx-license-list carries 727 full texts; spdx-expression-parse parses expressions.
- **F10, F11**: the real Gradle and sbt reports, their shapes and their quirks: the jk1 renderer's
  default drops licenses, a Gradle entry may have a null name, Apache is spelled five ways, sbt keeps one
  license per dependency, a license file ships with CRLF.
- **F12**: why the JVM reports are given rather than produced here, and why a relay exists at all: sbt's
  resolver cannot answer a 407 by itself.
- **F13**: the A/B recipe that works here with `--network none` (`CI=true`, the store **and** the
  metadata cache), and that on Linux the arms come out the same — a result, not a failure.
- **F14**: three Windows traps the author measured (linux packages missing from a store filled on
  Windows; TypeScript 7's native binary failing on a bind mount; Git Bash path conversion). The harness
  must be Node; the sample uses TypeScript 6.0.3.
- **F15**: the GitHub Actions and their commit SHAs. **F16**: TypeScript versions. **F17**: the sources
  of the two sample overrides.

Two rules of this machine, not measurements:

- The HTTPS proxy comes from environment variables: **never unset or print them, and never hand them to
  a container.**
- Files a container writes into a bind mount belong to root on the host: remove them through a
  container (the pinned `alpine`), never with `sudo`.

## Facts you measure

When you measure something a decision depends on (the toolkit's own inventory, an image's behaviour, a
format detail), append it to facts.md as a new entry from F18 on, in the form of the entries above it:
the date, the command, the output as printed (no secret, no absolute path under the home directory),
what follows, and the decisions that depend on it. Quote the id in the PROGRESS row. When a measurement
contradicts an entry, add a "Superseded" box under that entry — never edit its text — and record it
under "Contract changes" if the contract depended on it.

## How to build this repository

- **The contract decides expectations, never the code.** A test expects what SCOPE.md says. If the code
  disagrees, the code is wrong, unless the run proves the contract wrong — then it is a contract change,
  recorded with its reason before anything else changes.
- **The tool never guesses.** An input it cannot map is UNKNOWN and fails; an override is a human
  ruling with a reason and a source. Do not add an alias, an override or a default to make a run green.
- **Controls before greens.** Every check is seen to fail on a planted violation, in a real run: the
  inventory on an UNKNOWN and on a missing text; `assets check` on each of its four violations; each rule
  R1–R9 of the workflow checker; the relay with wrong credentials. A control says it is a control.
- **Real inputs.** The parsers are tested on the given real fixtures first and on hand-written cases
  second; the pnpm report is produced live from the sample.
- **Measured, not assumed.** The A/B numbers come from the harness on this host; their machine is
  recorded. Do not explain a number you did not measure.
- **Two runs agree.** A count, a pass or an output's bytes are quoted from two consecutive runs.

## Definition of done for each goal

1. **Read first.** Read the current state before changing a file.
2. **It runs.** `pnpm test`, `pnpm lint` and `pnpm typecheck` pass, and each goal's own commands as its
   rows require; paste the output.
3. **The build under test is pinned.** Once the goal's code is done and before its final verification,
   write one line under the goal's heading in PROGRESS.md:
   `Build under test: <commit> + tree <fingerprint>`, with the commit from `git rev-parse --short HEAD`
   and the fingerprint from
   `{ git rev-parse HEAD; git diff HEAD; git ls-files -o --exclude-standard -z | sort -z | xargs -0 -r sha256sum; } | sha256sum | cut -c1-12`.
   The goal's two final runs are made on that build; if anything changes after them, write the new line
   and run them again.
4. **Every row has a verdict** from the table below; nothing is left unexplained.
5. **The tally is written.** Under the goal's last table, one line:
   `Tally: <n> rows · <m> verdicts (PASS a · FAIL b · BLOCKED c · DEFERRED d)`. A split verdict counts
   once per arm, so m can exceed n; an annotated PASS counts as one PASS.
6. **PROGRESS.md first, report second.**
7. **Leave nothing behind.** Temporary files go to the OS temp directory and are removed; stop every
   process you started; remove every container, volume, network and image of the run before the goal
   ends (`docker ps -a`, `docker volume ls`, `docker network ls` and `docker image ls`, each filtered by
   `ci-devex-`, print nothing), unless a row says otherwise.

### Verdicts

| Verdict | Meaning | Required |
|---|---|---|
| PASS | you observed what the row describes | quote the observation (command output with the exit code, the lines of a file with their numbers) |
| FAIL | the observation contradicts the row | `expected "<X>" / actual "<Y>"`; if you cannot write that, it is not a FAIL |
| BLOCKED | you could not verify it | say what is missing; a result that needed the environment fixed by hand is BLOCKED too |
| DEFERRED | it depends on an open decision | name the decision |

Two forms are allowed:

- **Annotated PASS**: `PASS (note: <the condition>)` when it passed under a condition; the note stays in
  the row.
- **Split verdict**: when a row has two paths and only one could be verified, write both, verified arm
  first, for example `PASS (Linux) / BLOCKED (Windows)`, with the evidence of each arm in the evidence
  cell. Do not split a row just to avoid a FAIL.

The auxiliary words (N/A, INFO, INCONCLUSIVE) are not verdicts in this ledger; use them only inside the
evidence. "Works as expected", "no issues" and "looks fine" count as unverified. When in doubt, BLOCKED —
never round an uncertainty up to PASS.

### The evidence gate is mechanical

`.claude/hooks/evidence-gate.sh` runs at the end of every turn while `goal-pack/.gate-armed` exists.
It blocks the turn when a PASS has empty evidence, a weasel phrase or no quotation mark; when a FAIL is
not "expected / actual"; when a BLOCKED or DEFERRED gives no reason; or when a verdict word is unknown.
It reads the file, not the conversation: **never invent a quotation to pass it.** After 5 blocks in a
row it lets the turn end to avoid a loop; say so plainly in your report.

### Run things one at a time

One Docker-using command at a time: never the relay test and the A/B together, never two A/B runs. Wait
for a long command with one blocking call; do not start it in the background. Keep every single command
under ten minutes; split a longer one.

## Red lines — stop and report if you are about to cross one

1. Do not create, switch or modify branches.
2. Do not commit or push; the human commits after the run.
3. **Read and write only inside this repository and the OS temp directory**, and run `rg` from your
   `PATH`. Do not open, list or search anything else on this machine — not the home directory, not
   other repositories, not the directory `rg` lives in.
4. **Docker only as SCOPE.md describes**: the images listed there, by digest; Compose projects, volumes,
   networks and the image named with the `ci-devex-` prefix, all created by this run; `docker run --rm`
   only for the pinned tools (actionlint, ShellCheck, `alpine` for removing and copying files) and the
   harness. No `--network host`, no published port except 18441 and 18442 on 127.0.0.1, no bind mount
   outside this repository and the OS temp directory, no `docker pull`, no `prune`, nothing done to a
   container, image, volume or network the run did not create. Docker on this host is root-equivalent;
   treat it that way.
5. No secret in any file of the repository; dummy values only in `.env.example`; the relay test's
   credentials are generated per run and never written to a file. Do not unset or print the proxy
   environment variables, and never pass them into a container.
6. Do not fix unrelated problems; record them under "Incidental findings". A defect **your own change**
   introduced is not unrelated: fix it in the same goal.
7. Do not edit the given files listed in SCOPE.md.
8. Network: only `pnpm install`, `pnpm install --lockfile-only` and `pnpm fetch`, in this repository and
   in `devcontainer-io-ab/sample`. Nothing else reaches the network: no `curl`, no `npm view`, no
   `git fetch`. No `sudo`.
   **Nothing that installs or enables a tool outside this repository**: no `corepack enable`, no
   `npm install -g`, no `pnpm add -g`, no `apt`, no downloaded binaries. The Node installation on this
   machine is shared, and `corepack enable` rewrites its `pnpm` (another run on this host did so and lost
   `pnpm` until it was repaired by hand). A CI workflow may contain setup steps; they run on CI only.
   Here, verify only the project's own commands.
9. No employer, product, customer, team or person names; no figures about the author's work. The
   README's signature line is required and is not a person name in this sense.

### There is a bus above you

While `goal-pack/.bus-armed` exists, every turn you end meets the goal-bus Stop hook:
- **Inside a goal** it sends you back ("Continue Gn: N row(s)…"). The hook reads PROGRESS.md, not the
  conversation: a table where every row has a verdict is the only way out.
- **When you print `PROGRESS: <goal> COMPLETE`** it checks the table and the evidence, then wakes the
  bus. The bus answers PASS (the next goal's instructions) or REJECT (what to fix).
- **The bus sees every earlier goal** and re-runs checks itself. An invented quotation will not survive
  it; BLOCKED will.

## Turn rhythm and progress protocol

- Each turn closes at least one row end to end, including writing it to PROGRESS.md.
- End the turn with: `PROGRESS: <goal> ac_done=X/Y pass=a fail=c blocked=d deferred=e`
- When every row of the goal has a verdict and PROGRESS.md is written: `PROGRESS: <goal> COMPLETE`
- When you are blocked: `PROGRESS: <goal> BLOCKED <reason>` — goal name first.
- The numbers must match PROGRESS.md.

**A turn must end on one of these lines. This is not formatting; it is what keeps the chain alive.**
The hooks run only when a turn ends, and they recognise you and your boundary by this line. End on
anything else and nobody is woken: your process ends and the chain stops silently. It follows that
starting a long task in the background and ending the turn throws its result away, and that a long task
is awaited with **one blocking call**, anchored on its output.

## After context compaction

1. Read PROGRESS.md and take the next empty verdict of the current goal.
2. If this brief is no longer in your context, read it again, completely, then SCOPE.md.
3. Check that SCOPE.md still says FROZEN (or AS-BUILT after G5).
4. Check that nothing of yours is still running (`docker ps --filter name=ci-devex-`), and run
   `pnpm test` once before going on.
