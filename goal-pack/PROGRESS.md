# ci-devex-toolkit — progress ledger

<!-- Structure the hooks rely on: goals are h2 sections; machine-checked tables have a "Verdict" column
     and an "Evidence" column; the environment table uses "Proof" and the change ledger has no Verdict
     column, so the gate leaves them alone. An empty verdict means "not done yet". -->

**Status: not started.**

Verdicts: PASS / FAIL / BLOCKED / DEFERRED (defined in goal-brief.md). The "Plan" column is fixed before
the run; to change a plan, write the reason here first. "measure" means run it and quote the output,
including the exit code where the row is about one. A "control" is a planted violation that must turn
the check red.

## Environment (filled in G0; every row with the command and its output)

| Item | Value | Proof |
| --- | --- | --- |
| Node | | |
| pnpm (selected by packageManager) | | |
| bash, git, awk, mawk | | |
| ripgrep (from PATH) | | |
| Docker | | |
| Images and digests (SCOPE.md) | | |

## Environment change ledger (before → change → restored)

| # | Goal | Object | Before | Change | Restored |
| --- | --- | --- | --- | --- | --- |

## Contract changes (frozen in G0; any later rename or reshape goes here)

| Date | Entry | Content |
| --- | --- | --- |

---

## G0 — toolchain, the environment re-measured, the contract frozen

| Condition | Verdict | Evidence |
| --- | --- | --- |
| E1 Node, pnpm (11.28.0 inside the repository), bash, git, awk, mawk and `rg` recorded with the commands' output, and compared with F2–F4 | | |
| E2 `pnpm install` succeeds with pnpm-workspace.yaml unchanged and no build script; the pnpm sample's dependencies are installed (`pnpm --filter acme-tasks-web list --prod`) | | |
| E3 the five images of SCOPE.md are present with exactly the listed digests (one `docker image inspect` per image) | | |
| E4 ports 18440–18449 are free (the `ss` check of F6) | | |
| E5 the given fixtures read as facts.md says: 15 dependencies in each Gradle report, 16 data lines in the sbt CSV, 10 files under `fixtures/gradle`, and the checksums of `fixtures/PROVENANCE.md` | | |
| E6 a first Vitest test passes, and `pnpm lint` and `pnpm typecheck` are clean over every directory that holds code (quote Biome's file count and the files it covers) | | |
| E7 SCOPE.md marked FROZEN with the date, its content otherwise unchanged | | |
| E8 the change set is limited to `pnpm-lock.yaml`, the first test and this ledger (`git status --short`) | | |

## G1 — oss-inventory

| AC | Item | Plan | Verdict | Evidence |
| --- | --- | --- | --- | --- |
| AC-1 | the Gradle parser reads `fixtures/gradle`: 15 dependencies, each with the entries of `index.json` (quote aopalliance, logback-classic, h2 and jspecify as parsed); `fixtures/gradle-single` is an input error, exit 3, with a message that names `JsonReportRenderer("index.json", false)` | measure | | |
| AC-2 | the sbt parser reads `fixtures/sbt`: 16 dependencies with group, artifact, version, license name and URL (quote three, one of them without a home page) | measure | | |
| AC-3 | the pnpm sample read live (`pnpm --filter acme-tasks-web licenses list --json --prod`): the parser's count per license equals the report's; `fixtures/pnpm/acme-tasks-web.json` is committed with no absolute path (a `jq` count of `paths` starting with `/` is 0) | measure | | |
| AC-4 | normalisation on the fixtures without overrides: exit 1 and exactly two UNKNOWN dependencies, aopalliance and h2, each with the entry that failed; every alias in `aliases.yml` is quoted next to the fixture line that needs it; the file's header states the "one license, one version" rule | measure | | |
| AC-5 | overrides: with `samples/overrides.yml` both rulings apply (`source` = `override` in the CSV); controls: an entry without `reason`, and a duplicate id, each exit 3 naming the entry; an override that matches nothing is listed as unused and the exit code does not change | measure | | |
| AC-6 | texts: one `licenses/<id>.txt` per id in the result, `LicenseRef-Public-Domain` from `samples/texts`; control: an id with no text exits 1 naming it | measure | | |
| AC-7 | notices: the pnpm packages' license files and the 9 Gradle `META-INF` files are copied, byte for byte (sha256 of the CRLF `slf4j-api` file, source and copy) | measure | | |
| AC-8 | output: the CSV header and the `inventory.md` sections are exactly as SCOPE.md says, rows sorted; two runs on the same inputs are byte-identical (sha256 of every output file, twice) | measure | | |
| AC-9 | the full sample run (pnpm live, sbt, Gradle, overrides, texts) exits 0; quote its summary (license → number of dependencies) | measure | | |
| AC-10 | the toolkit's own runtime dependencies inventoried (`pnpm --filter ci-devex-toolkit ...`): quote the summary and the exit code; exit codes 0, 1 and 3 have each been produced by a real CLI run in this goal (cite the three rows) | measure | | |

### G1 checks

| Check | Verdict | Evidence |
| --- | --- | --- |
| `pnpm test` passes (quote the count), twice in a row with the same count | | |
| `pnpm lint` and `pnpm typecheck` are clean | | |
| No absolute path of this machine in any committed file of the goal (`grep -rn` for the home directory and `/tmp/` over the changed files) | | |
| The change set is limited to the deliverables and this ledger (`git status --short`) | | |

## G2 — two-repos-one-worktree

| AC | Item | Plan | Verdict | Evidence |
| --- | --- | --- | --- | --- |
| AC-11 | `assets init` in a fresh product repository whose path contains a space: quote the whitelist, the product's exclude block and `.ignore`; a second `init` changes no byte (sha256 of the three, before and after) | measure | | |
| AC-12 | `assets check` passes on a correct layout with assets committed: exit 0, and `rg --files --hidden` lists every file `assets ls-files` lists (quote both counts) | measure | | |
| AC-13 | controls: each of the four violations produced for real is reported by name with exit 1 (quote four runs); `--require-rg` with `rg` off `PATH` exits 3 | measure | | |
| AC-14 | the passthrough: `assets add`, `assets commit` and `assets status` act on the assets repository and leave the product's index untouched (`git status --short` of the product, before and after) | measure | | |
| AC-15 | `pnpm assets:selftest` prints `<n> passed, 0 failed` with gawk first and with mawk forced first, on bash 5.0.17 and git 2.25.1 (quote both) | measure | | |
| AC-16 | `pnpm shellcheck` is clean on every shell file of the repository (quote the file list and the exit code) | measure | | |

### G2 checks

| Check | Verdict | Evidence |
| --- | --- | --- |
| `pnpm test`, `pnpm lint` and `pnpm typecheck` pass | | |
| Two consecutive self-test runs give the same counts | | |
| The change set is limited to the deliverables and this ledger (`git status --short`) | | |

## G3 — pr-compile-check

| AC | Item | Plan | Verdict | Evidence |
| --- | --- | --- | --- | --- |
| AC-17 | `pnpm workflow:check pr-compile-check/pr-compile-check.yml` prints R1–R9 ok and exits 0; quote the lines of the template that keep R4, R5 and R9 | measure | | |
| AC-18 | controls: each of R1–R9 broken in its own copy fails that rule and no other, exit 1 (quote the nine results); a file that is not YAML exits 3 | measure | | |
| AC-19 | `pnpm actionlint` is clean on the template (exit 0) | measure | | |
| AC-20 | relay test, assertions 1 and 2: HTTP and `CONNECT` through the relay reach the origin and the echo, and the mock upstream logged both with the right credentials (quote the log lines; the dummy password masked) | measure | | |
| AC-21 | relay test, assertions 3 and 4: straight to the mock upstream without credentials is `407`; the relay is published on 127.0.0.1:18441 only (`docker compose port` and `ss -ltn`) | measure | | |
| AC-22 | relay test, the control: with wrong upstream credentials the request through the relay does not succeed and the mock logged a rejection | measure | | |
| AC-23 | the relay template: the render script refuses an empty value and a value with whitespace (two runs); no credential appears in the relay's logs (count of the dummy password in `docker compose logs` is 0); `.env.example` holds dummies only | measure | | |
| AC-24 | `runbook.md` has the eight sections of SCOPE.md in order, every rule R1–R9 with its reason, and no general advice attributed to the author's practice (quote the headings and the advice sentences) | read + quote | | |
| AC-25 | after the relay test, nothing of `ci-devex-relay-test` is left (containers, networks, volumes), also after the control run | measure | | |

### G3 checks

| Check | Verdict | Evidence |
| --- | --- | --- |
| `pnpm test` passes (quote the count) | | |
| `pnpm lint` and `pnpm typecheck` are clean | | |
| `pnpm relay:test` run twice in a row gives the same results | | |
| `pnpm shellcheck` is clean, the relay's render script included (quote the file list) | | |
| The change set is limited to the deliverables and this ledger (`git status --short`) | | |

## G4 — devcontainer-io-ab

| AC | Item | Plan | Verdict | Evidence |
| --- | --- | --- | --- | --- |
| AC-26 | preparation: the generator gives the same files for the same count (sha256 of the generated tree, twice); the image is built with `--network none` and runs pnpm 11.28.0; the stores and caches are filled through a container with no network | measure | | |
| AC-27 | the arms: a diff of the two Compose files shows only the storage lines; both have `network_mode: none`; a request to the internet from inside the container fails (quote the error) | measure | | |
| AC-28 | one run per arm completes `install`, `build` and `first-request`, with the expected body (quote the JSON lines) | measure | | |
| AC-29 | the full measurement on this host (`pnpm ioab`, 5 runs per arm, 1,000 modules): the results JSON and Markdown are written; quote the table, the machine line and the order of the runs (alternating) | measure | | |
| AC-30 | a second full measurement (into a temporary directory): both runs' medians and ratios quoted side by side; the README will cite the committed one and say a second was made | measure | | |
| AC-31 | the statistics are tested with planted values (median, min, max, ratio; odd and even run counts), and one median of the committed JSON recomputed by hand matches its table | measure | | |
| AC-32 | clean-up: no container, volume, network or image with the `ci-devex-ioab` prefix is left; no file under `devcontainer-io-ab/sample` belongs to another user than the run's (`find ... ! -user "$(id -u)"` prints nothing) | measure | | |

### G4 checks

| Check | Verdict | Evidence |
| --- | --- | --- |
| `pnpm test` passes (quote the count) | | |
| `pnpm lint` and `pnpm typecheck` are clean | | |
| The change set is limited to the deliverables and this ledger (`git status --short`) | | |

## G5 — READMEs, CI and closing

| AC | Item | Plan | Verdict | Evidence |
| --- | --- | --- | --- | --- |
| AC-33 | README.md: the English summary; the seven sections with exactly the names of SCOPE.md, in order (quote `grep -n '^## '`); the signature line exactly, as the last line (quote `tail -n 1`); 「背景」 links case study 03; 「設計」 separates 実務で実施した点 and デモで追加した点 for each tool; 「結果」 quotes only this repository's runs | read + quote | | |
| AC-34 | the four tool READMEs exist, in Japanese, each with what it does, how to run it, inputs and outputs, and limits (quote the headings) | read + quote | | |
| AC-35 | `.github/workflows/ci.yml` has the jobs of SCOPE.md; every `uses:` is a SHA of F15 with its version comment; `permissions: contents: read`; no `corepack enable`; `pnpm actionlint` is clean on it; every command of it that can run here was run and is quoted, and the ones that cannot are named with the reason | measure | | |
| AC-36 | PUBLISHING.md has a description, topics and the checklist; LICENSE is unchanged (`git diff --stat -- LICENSE` empty) | measure + read | | |
| AC-37 | the README's first command line (`pnpm i && pnpm test`) from a clean `node_modules` exits 0 (quote the last lines of each step) | measure | | |

### G5 closing

| Condition | Verdict | Evidence |
| --- | --- | --- |
| SCOPE.md rewritten as AS-BUILT, every difference from the frozen contract marked with a reason | | |
| Change list, and one proposed commit message per goal (G0–G5) | | |
| Nothing temporary left in the repository (`git status --short` shows deliverables only; outputs are ignored) | | |
| Nothing of the run left: no listener on 18440–18449, and `docker ps -a`, `docker volume ls`, `docker network ls` and `docker image ls` filtered by `ci-devex-` print nothing | | |
| No unexplained empty verdict anywhere | | |

---

## Handover (filled at the end; each item = fact, impact, the decision needed)

## Incidental findings (recorded, not fixed)

| # | Finding | Where | Note |
| --- | --- | --- | --- |
