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
- 🆕 Re-measured by the bus after G0 (2026-10-01, ~18:20 JST): `node --version` `v24.19.0`;
  `pnpm --version` `11.28.0` in the repository root and **`11.22.0` in `/tmp`** — the shared Node
  install was not rewritten, so corepack was not enabled (red line 8 holds). All five image digests
  equal SCOPE.md; listeners `22 53 139 445 631 3128 3350 3389`, nothing in 18440–18449.
- 🔴 A squid container that is **not the run's** exists on this host: `<host-squid>`
  (`<its image>`), the listener on 3128. Never touch it; the run's own relay is
  `ci-devex-relay-test` on 18441.
- 🆕 Vitest leaves a `/tmp/<random>/ssr/` cache directory (~20 KB) behind on every run — mine included.
  Harmless, but "no temporary file was created" is too strong a claim; scope the G5 clean-up row to the
  repository, the ports and the Docker objects.
- 🆕 Outputs can go anywhere named `out/` (root `.gitignore` has `out/`), e.g. `oss-inventory/out/`.
  `reports/` is ignored too. `pnpm-lock.yaml` is still untracked (the human commits it).
- 🔴 **The Vitest suite leaves `/tmp/ci-devex-*` directories behind** — one per `mkdtempSync` call, no
  `afterAll`/`rmSync` anywhere in `oss-inventory/test/`. After my two review runs there were 38. G1's
  change-set row says the OS temp directory holds none, which can only have been momentarily true. I
  asked for the cleanup in G2 (it is this run's own defect, brief red line 6). Until it is fixed, do not
  read "no `ci-devex-*` in /tmp" as evidence of anything.
- 🆕 `/tmp/<random>/ssr/` (Vitest) and `/tmp/ci-devex-*` (the suite's scratch) are the only temp
  residue so far. Nothing of the run writes outside the repository otherwise.
- ✅ **The `/tmp/ci-devex-*` leak is fixed** (G2): all four `oss-inventory/test/*` files go through
  `oss-inventory/test/tmp.ts`, whose `afterAll` removes what it handed out, and `selftest.sh` uses a
  `trap … EXIT INT TERM`. I measured 0 before and 0 after a full `pnpm test`, and the 38 old
  directories are gone. The G1 entry above is superseded by this one.
- 🔴 Vite still leaves `/tmp/<random>/ssr/` per `pnpm test` — 170 of them by the end of G2. It cannot be
  fixed without touching `vitest.config.ts`, which SCOPE.md lists as **given**. So do not ask for it;
  have G5 record it under "Incidental findings" instead, and never let a row claim the OS temp
  directory is empty.
- 🆕 `/tmp/bus.config.0613.sh`, `/tmp/bus-probe`, `/tmp/bus-state.07.bak`, `/tmp/bus-tabprobe.mjs` are
  **not** the run's and not mine — they predate it (the operator's goal-bus testing). Leave them.
- 🆕 `.claude/settings.local.json` really does deny `Bash(git commit:*)`, which is why the worker
  committed only through `assets commit` inside throwaway repositories. HEAD is still `eb37b68` with one
  commit; nothing has been committed in this repository.
- ✅ **The relay test runs clean on this host and leaves nothing** (I ran it myself after G3):
  `7 passed, 0 failed`, then the four `ci-devex-` Docker filters empty, no listener in 18440–18449, no
  `.env` created, and `<host-squid>` still `Up 3 weeks` on 127.0.0.1:3128 — untouched.
- 🆕 The `rhysd/actionlint` image runs as a **non-root** user: a probe file in a `mktemp -d` directory
  (mode 700) gives `permission denied`. `chmod 755` on the directory fixes it. Mine to remember when I
  lint something of my own in /tmp; the repository mount is fine.
- 🆕 actionlint checks action inputs from metadata bundled in the image, so `--network none` is enough:
  on a file with `bogus-input:` it exits 1 and names the valid inputs. The wrapper's "clean" means
  something.
- 🆕 **The repository and Docker's volume root are on the same filesystem**: `df -h /var/lib/docker .`
  gives `/dev/sdb2 916G … /` for both, `DockerRootDir` is `/var/lib/docker`, driver overlay2. So a
  named volume here is a directory on the **same device** as the bind mount — which is why "the volume
  adds a layer" is not an available explanation for the install gap (see the doubt below).
- 🆕 A full `pnpm ioab` (5 runs per arm, 1,000 modules) takes **58 s** on this host; `--runs 3` took
  about 45 s. The ten-minute ceiling was never in danger. Preparation is ~16 s of it, including the
  only online step (`pnpm fetch`: store 55M/1729 files, cache 35M/99 files).

## Doubts to re-check

- 🆕 **The build fingerprint cannot be re-verified by me.** `Build under test: <commit> + tree <fp>`
  covers `git diff HEAD` plus untracked files, and PROGRESS.md is itself in it, so editing the ledger
  after pinning changes the fingerprint for good. For G0 I could only corroborate it indirectly with
  mtimes (PROGRESS.md 18:18 newest; facts.md 18:15, SCOPE.md 18:15, the test 18:14, the lockfile
  18:13). From G1 on I ask for the sha256 of each deliverable file next to that line — that part is
  checkable. Re-read this if a later goal's quoted output ever looks older than its code.
- 🆕 E2's "no build script ran" is an inference (`strictDepBuilds: true` + exit 0), not an observation.
  Sound, and F2 agrees, but if a dependency is ever added, ask for the install's own wording.
- 🆕 Biome's `Files processed` list includes `biome.json`, which no pattern in `files.includes` matches,
  so "Checked 3 files" = 2 real sources + the config. The count must grow as G1–G4 land code; if
  `pnpm lint` still says 3 files after G1, Biome is not seeing the new directory.
- 🆕 **Contract readings that SCOPE.md does not state, now baked into the build.** The worker recorded
  one (the `source` precedence: `override` > `unknown` > `alias` > `declared`) under the G1 heading.
  Four more are in the code and nowhere in the contract: the `licenses` cell is `UNKNOWN` for an
  UNKNOWN dependency; the `declared` cell is `(no license entry)` when a report declares none; a
  null-name entry renders as `(url)`; an entry with neither renders as `(no name, no URL)`. All five
  must appear in G5's AS-BUILT SCOPE.md. None of them is a contract change, so no "Contract changes"
  row is due.
- 🆕 AC-3 compared the live report's per-license counts with the parser's counts taken from the
  *committed fixture*, not from the same file. It holds only because fixture ≡ live apart from `paths`,
  which I verified myself. If a later row pairs two sides like that again, check the equivalence.
- 🔴 **Found by me in G2 and still open: `assets check` fails on a correct layout when a filename is
  not ASCII.** `git ls-files` and `git status --porcelain` octal-quote such paths
  (`"docs/assets/\346\227\245…"`), while `rg --files --hidden` prints them raw, so check 3 reports a
  false `hidden-from-search` for a tracked Japanese filename and check 4 a false `stray-status` for an
  untracked one — exit 1 on a layout that is right. `git -c core.quotePath=false …` prints the path raw
  and fixes both; I verified that much. Demanded as the first item of G3. G2's rows stand: SCOPE.md's
  portability clause promises spaces, not UTF-8 — but a toolkit whose own documents are Japanese must
  not fail on Japanese filenames.
- 🆕 Smaller, not demanded: check 4 strips the porcelain prefix with `${line:3}`, so a rename entry
  (`R  old -> new`) would be compared as the string `old -> new`. Harmless for the cases the contract
  names; mention it in G5's 「制約」 only if it still holds.
- 🆕 **Readings for G5's AS-BUILT now number ten.** G1's five (source precedence; `licenses` = `UNKNOWN`;
  `declared` = `(no license entry)`; a null-name entry as `(url)`; `(no name, no URL)`), G2's two (parent
  negations for a nested asset path, F21; `!/.ignore` inside the `.ignore` block, F22) and G3's three
  (R4 and R5 checked on every job; R1's default branch read as a non-empty `push.branches`; the relay
  test reporting two lines beyond the contract's five). G5 must carry all of them.
- 🆕 The runbook says the relay test confirms 五つのこと while the tool prints **seven** `ok` lines. Both
  are defensible (five are the contract's), but G5's README 「結果」 quotes the tool's output — keep the
  two consistent or say which five are the contract's.
- 🆕 Still open, by design, and bound for G5's 「制約・既知の限界」: `core.quotePath=false` does not help a
  filename holding a literal `"` or a newline. I measured it — a file named `wi"th.md` under an asset path
  still produces a false `stray-status`. The worker named exactly this limit.
- 🆕 Not required by the contract, worth one sentence somewhere: the relay test's Compose network is an
  ordinary bridge. Nothing leaves the host because the mock upstream refuses any target but
  `mock-origin`, which is behaviour, not structure. `internal: true` would make it structural.
- 🔴 **F26 carries one clause that is not measured and is probably wrong**, and G5 must not let it reach
  the README: "the volume adds a layer that the install, which writes 891 files, pays for". The same
  paragraph correctly says the reason is not measured — then offers a mechanism anyway. I checked:
  Docker's volume root and the repository are on the same `/dev/sdb2`, so a local named volume is a
  directory on the same device, not a layer. The **result** is solid (I reproduced it); the sentence is
  the problem. Demanded as the first item of G5.
- 🆕 The A/B finding changes what SCOPE.md told the README to say, and the worker opened the run's first
  "Contract changes" row for it. Correct call. Watch that G5's 「結果」 and 「制約」 use the measured
  wording (install differs ~18 %, build and first-request do not) and still keep F13's conclusion — named
  volumes buy nothing on Linux; the practice's move was a Windows answer to a Windows cost (F14).
- ✅ **Resolved: the G5 tally.** Corrected on the next turn; my own recount now agrees with all six
  tally lines (8, 14, 9, 14, 10, 10 = 65 rows, every one PASS) and the row records that it was wrong
  when first written and who found it. The run is DONE. Kept here for the history:
- ~~🔴 **G5 was rejected once, for its tally only.**~~ The G5 section holds **10** judged rows (AC-33…AC-37
  plus five closing conditions, all PASS) while `goal-pack/PROGRESS.md:345` says `9 rows · 9 verdicts`,
  and line 343 repeats `G5 9/9`. The run total is therefore 65 rows (8+14+9+14+10+10), which is exactly
  what `runbook.md` section 0 predicted. **Nothing else in G5 needs work** — I verified the whole goal
  before rejecting, so when the corrected count comes back, the right answer is DONE unless something
  else moved. Re-read this before the next verdict.

## The worker's habits

- 🆕 G0's worker writes long, genuinely quoted evidence cells, reports its own failures unprompted
  (Biome rejected the test's formatting once, exit 1, before the green run it quotes), and annotated
  E8 rather than stretching the row — the annotation was honest: `goal-pack/.gitignore` (18:10:42) and
  `goal-pack/BUS-LOG.md` (18:12:00) predate its first write (`pnpm-lock.yaml`, 18:13:05).
- 🆕 It does arithmetic and set comparisons correctly: I re-ran its counts and checksums and found no
  discrepancy. Keep recounting anyway — nothing has been hard yet.
- 🆕 G1 confirmed G0's pattern: the quotations are real. Every figure I re-ran came out identical,
  including the 47-file determinism digest `77dadbf6…`, which I reproduced from a **fresh** live pnpm
  report in my own temp directory — stronger than the row claimed.
- 🆕 It volunteers the readings it had to make instead of hiding them (the `source` precedence note),
  and it annotates a change-set row rather than stretching it. It does not, so far, notice side effects
  of its own tests (the `/tmp/ci-devex-*` leak).
- 🆕 It writes controls as named tests ("control: …") as well as running them at the CLI. The CLI
  controls I reproduced all behaved exactly as quoted.
- ✅ G2 fixed the defect I named in G1 without argument, measured the fix (`rm -rf /tmp/ci-devex*`,
  `pnpm test`, count `0`) and said plainly that its earlier row had been true only at the instant it was
  measured. It also disclosed, unprompted, that control 1 produces **two** violations rather than one,
  and that its first `shellcheck` wrapper had reached `.claude/hooks/*.sh` — then narrowed the file list
  instead of editing the harness. When a deny rule blocked `git commit`, it restructured rather than
  routing around the rule.
- 🆕 It writes bash the way the contract asks: no awk and no sed at all in `assets`, so no mawk/gawk
  interval question can arise, and `git init -q --bare --` rather than `git init -b`.
- ✅ G3 fixed the non-ASCII defect exactly as diagnosed, kept the passthrough deliberately unchanged
  (`assets ls-files` is git and should behave like git — a judgement I agree with), and volunteered the
  limit that remains. It also reported two cycles it lost (actionlint's shellcheck pass rejecting a
  line continuation, SC2140; squid dying on `/dev/stdout` because it drops to the user `proxy`) and
  turned both into facts F24/F25 instead of hiding them.
- 🆕 Its `biome-ignore` comments are legitimate: three `noTemplateCurlyInString` on GitHub Actions
  expressions inside plain strings, each with the reason in the comment. No rule was switched off.
- 🆕 It anticipates my recounts now — it says in the row when one control legitimately trips two things.
  So far every such disclosure has been accurate.
- ✅ G4 did the thing I most wanted to see: it measured a result that contradicted the pack's own
  wording, did **not** tune it away, left F13's text untouched with a Superseded box under it, opened a
  Contract changes row, and said plainly that the mechanism is unmeasured. It also did the wall-clock
  arithmetic before committing to the long run, as asked (21 s for one run → 41 s estimate → 58 s
  actual).
- 🔴 Its one weakness is the sentence that goes one step past the data (F26's "adds a layer"). Keep
  reading the *explanations* as closely as the numbers — the numbers have been right every time.
- ✅ G5 corrected F26 and verified my `df` premise itself instead of taking it on trust, reconciled both
  wording traps, and volunteered two things against its own interest: that the repository's own CI fails
  R1, R4 and R5 (correctly), and that its first draft of the AC-35 cell had claimed `grep -c corepack`
  → 0 when the real count is 2 in comments. That is the behaviour this ledger is for.
- 🔴 Its weak spot is arithmetic *about* the ledger rather than in it: G0's change-set row needed an
  annotation, and G5's tally is off by one. Recount every tally, every time — it is the one check that
  has actually caught something twice.

## Proven along the way — later goals may cite

- ✅ **F2–F6, F10 and F11 still hold on this host** (bus-verified, 2026-10-01): Node, pnpm, bash
  5.0.17, git 2.25.1, gawk/mawk, rg 15.2.0, Docker 28.1.1, the five digests, the free ports. A later
  goal may cite this rather than re-measuring, except where its own row asks for a measurement.
- ✅ **The fixtures are the bytes PROVENANCE.md names** (bus-verified): `sha256sum -c` on the nine
  `META-INF` files printed `OK` nine times, and `gradle/index.json`
  `6f2d879f…`, `gradle-single/index.json` `83dfca86…`, `sbt/acme-tasks-api-licenses.csv` `44952c7b…`
  match the table. 15 dependencies in each Gradle report, `importedModules` empty in both, 16 sbt data
  lines, 10 files under `fixtures/gradle`, `gradle/slf4j-api-2.0.20.jar/META-INF/LICENSE.txt` is
  `ASCII text, with CRLF line terminators`, H2's names are `[null,"EPL 1.0","MPL 2.0"]`.
- ✅ The pnpm sample's production dependencies are installed and are exactly five:
  `qs@6.16.0 react@19.3.0 react-dom@19.3.0 rxjs@7.8.2 yaml@2.9.1` (`5 packages`).
- ✅ SCOPE.md was frozen with its content unchanged: the whole diff is the status line plus its
  100-column wrap. `facts.md` grew by F18 only — the diff is a pure append after line 613, so F1–F17
  are untouched.
- ✅ `pnpm test` `Tests 7 passed (7)`, `pnpm lint` `Checked 3 files`, `pnpm typecheck` silent — all
  exit 0 when I ran them myself, on the tree as the worker left it.
- ✅ **oss-inventory works as the contract says** (bus-verified after G1, on the pinned build whose 28
  deliverable sha256 I re-checked): no-overrides run → exit 1, `UNKNOWN: 2` (aopalliance "Public
  Domain", h2's dual-license URL), `56 dependencies`; full sample run → exit 0, 11 ids, `56
  dependencies`; two runs → 47 identical files, manifest digest
  `77dadbf60cc17b85f190e69f9b231d38261a43a64e69fba40f8b2d9903565704`.
- ✅ Exit 3 comes out of: the single-license Gradle shape (message names
  `JsonReportRenderer("index.json", false)`), no input, an overrides entry with no `reason`, a duplicate
  id, an unknown ecosystem, an empty `licenses` list, a non-id license, an alias target in the wrong
  case, and an sbt CSV with the wrong header. Exit 1 out of a missing text and out of an UNKNOWN. An
  unused override is listed and leaves the exit code at 0. G5 may cite this instead of re-running.
- ✅ The pnpm expression path (step 2), which **no fixture exercises**, works: my own report with
  `(MIT OR Apache-2.0)` kept the expression in the `licenses` cell with `source` `declared`, counted
  the dependency under both ids in the summary and wrote both texts; `SEE LICENSE IN LICENSE.md`
  stayed UNKNOWN and failed the run.
- ✅ `oss-inventory/aliases.yml` holds exactly eight names and one URL — nothing ambiguous, `Public
  Domain` and the H2 page deliberately absent. The committed pnpm fixture equals the live report apart
  from `paths` (25 relative, 0 absolute) and resolves notices with the default `--pnpm-root`.
- ✅ `oss-inventory/fixtures/` is otherwise untouched: the only addition is `fixtures/pnpm/`.
- ✅ **two-repos-one-worktree works** (bus-verified after G2 on the pinned build, all 8 deliverable
  sha256 `OK`). In my own `/tmp/bus g2.XXXXXX/my product` I reproduced: `init` writing `/*`, `!/docs/`,
  `/docs/*`, `!/docs/assets/`, `!/ai assets/`, `!/.ignore`; the product block in `.git/info/exclude`
  only, with no `.gitignore` written; `.ignore` with the three negations; a second `init` byte-identical
  — and the three sha256 I computed in my own directory match the worker's quoted values
  (`7eb4472baf04afb8…`, `95cfeba93b275ac3…`, `5e7099d85db03b92…`), which also proves those files carry
  no absolute path. `check` → `check passed: 2 asset path(s), 0 violations`; `assets ls-files` 3 files
  including the nested one, `rg --files --hidden` 22, nothing tracked-but-unsearched.
- ✅ **All four violations go red, reproduced by me**, each from a real break and each restored:
  `tracked-by-both` (plus the honest second line `stray-status`, 2 violations), `missing-negation`,
  `hidden-from-search` (via a deeper `docs/assets/.ignore`), `stray-status` (`!/src/` in the whitelist);
  `--require-rg` under `PATH=/usr/bin:/bin` → exit 3, and without the flag `search check skipped: rg not
  found` then exit 0. Usage errors (`..`, an absolute path, an unknown argument, no git dir) all exit 3.
- ✅ **The self-test can fail**: I copied the tool, neutered the `tracked-by-both` call and the copied
  `selftest.sh` printed `9 passed, 1 failed`, exit 1. Both arms pass as shipped — `10 passed, 0 failed`
  with mawk forced and with `ASSETS_SELFTEST_NO_MAWK=1` (gawk).
- ✅ Reading 1 generalises further than the rows show: I measured two-level nesting with spaces in both
  components (`a/b/c assets/`), a single-file asset path (`a/one file.md`) and a shared parent — the
  whitelist emits `!/a/`, `/a/*`, `!/a/b/`, `/a/b/*` once each, both repositories stay disjoint, and
  `check` passes.
- ✅ `pnpm shellcheck` works and leaves nothing: pinned digest, `--rm --network none`,
  `--volume <repo>:/repo:ro`, file list from `git ls-files --cached --others --exclude-standard` plus
  the extensionless `assets`, so G3's render script joins it without an edit. `shellcheck: clean`,
  exit 0, no container left. **This was the run's first container and it behaved.**
- ✅ **pr-compile-check works** (bus-verified after G3; all 17 deliverable sha256 `OK`).
  `pnpm workflow:check` on the template → `R1 ok` … `R9 ok`, exit 0. I planted all nine violations
  myself, independently, in my own temp directory: each exits 1, fails **only** its own rule, and the
  message matches the ledger word for word. I then planted seven variants of my own the rows do not
  cover — a SHA with no version comment, `pull_request_target`, a job widening `permissions`, a
  `workflow_dispatch` default of `github-hosted`, no `concurrency`, `push` with no `branches`, and an
  `if: always()` guard — and each was caught by the right rule. Unparseable YAML, a YAML list and a
  missing file each exit 3.
- ✅ Every `uses:` SHA in the template is one of F15's with the right version comment; the backend runs
  `sbt stage` and the frontend `pnpm install --frozen-lockfile` / `pnpm lint` / `pnpm build`.
- ✅ **The render script behaves** (my own runs): refuses an empty value, a value with whitespace, an
  unset variable, a non-numeric port and the wrong argument count (exit 1 each, with the reason); writes
  mode 600; substitutes `a&b$c/d\e*f`g|h` literally; and a password of
  `p4ssw0rd-must-not-appear` appears **zero** times in its stdout and stderr.
- ✅ **The relay test's seven assertions** including the control (wrong upstream password → 407 and
  `credentialsMatched:false`): reproduced by me, `7 passed, 0 failed`. The relay is started from the
  template's own files mounted `:ro`, the images are pinned by digest, the mocks restrict forwarding to
  `ALLOWED_HOST=mock-origin`, ports are `127.0.0.1:18441` and `127.0.0.1:18442`, and the credentials are
  `randomBytes` per run, passed through the environment, never written to a file.
- ✅ **The runbook's Japanese holds up.** Eight headings in SCOPE.md's order, です・ます調, R1–R9 each with
  a reason. I checked every 実務では sentence against materials section 2: the 407/relay on 127.0.0.1,
  `contents: read` with no secret, the bundled local repository, the `runs-on` expression, cancelling
  older runs of a PR, job timeouts, `stage` rather than `compile`, and the failure triage by step and
  error signature — all nine are in the material. The advice sentences (専用の OS ユーザー, 手で一度流す,
  fork を自分のリポジトリに取り込む, ディスクの確認, 同梱依存の一覧) use とよいでしょう／おすすめします and
  claim nothing about the author. No employer, product, customer, team or person name; no figures.
- ✅ `pnpm actionlint` and `pnpm shellcheck` both work from pinned digests with `--rm --network none` and
  a read-only mount; the render script joined the shellcheck list with no edit to the wrapper.
- ✅ **The A/B finding is real; I reproduced it independently.** My own `pnpm ioab -- --runs 3 --modules
  1000` into a temp directory: `install` bind 884 (869–886) against volume 1075 (1049–1157), ratio
  **0.82**; `build` 0.99; `first-request` 1. That is a third measurement agreeing with the worker's two
  (0.82 and 0.83), with the install ranges never overlapping. The direction is bind-faster for install
  and equal elsewhere.
- ✅ **The committed results file is internally honest.** I recomputed every median, min, max and ratio
  from the raw `runs` array with my own code: install bind `[876, 873, 894, 894, 870]` → 876/870/894,
  install volume `[1067, 1079, 1103, 1044, 1038]` → 1067/1038/1103, build 1063 vs 1083, first-request
  222 vs 223, ratios 0.82 / 0.98 / 1.0 — all exactly as the Markdown table and the ledger say. Ten runs,
  order `bind volume ×5`, machine block complete (Linux 5.4.0-216-generic, 12 × Xeon E-2146G, 46.9 GiB,
  Docker 28.1.1 on Ubuntu 20.04.6, overlay2).
- ✅ The generator is deterministic: with the worker's own method (`cd src/generated`, `find … | xargs
  sha256sum | sha256sum`) I got `9c43a390059922aed6cac267d953c56194fa69509dafb5305c2908301baebd4b`,
  1001 files — their value exactly — and a different digest at 999 modules.
- ✅ The expected body is genuinely cross-checked: `sum((i*7919) % 10007 for i in 1..1000)` is
  **5010524**, which I computed in Python; the harness computes it on the host and the server computes
  it from the 1,000 generated modules.
- ✅ Both arms resolve to the same effective config apart from storage (`docker compose config`): same
  image, same `working_dir`, same `IOAB_STORE=/w/.store` and `IOAB_CACHE=/w/.cache`, `network_mode:
  none` in both, the same `./sample:/w` bind — and in arm B four volume mounts over it. The timed
  phases are one file (`phases.ts`) shared by both arms, so nothing is measured asymmetrically.
- ✅ The harness refuses to overwrite a results file of the same date and platform (it logs and returns
  1), and it removes `ci-devex-ioab:local` unless `--keep`. After my own run: the four `ci-devex-`
  filters empty, `find devcontainer-io-ab/sample ! -user "$(id -u)"` silent, the two given sample files
  unchanged.

## What the bus verified itself

### After G0 (PASS)

I read the G0 table, the F18 entry, `oss-inventory/test/fixtures.test.ts`, `biome.json`,
`tsconfig.json`, `vitest.config.ts`, `pnpm-workspace.yaml`, `package.json`, the root `.gitignore`,
`fixtures/PROVENANCE.md`, `samples/overrides.yml` and `samples/texts/`. I ran: `pnpm test`, `pnpm lint`,
`pnpm typecheck`, `biome check --verbose`, `node --version`, `pnpm --version` in the root **and in
`/tmp`**, `docker image inspect` on all five images, the two `ss` port commands, the four `ci-devex-`
Docker filters (all empty), `jq` on both Gradle reports, `awk`/`find` on the sbt and Gradle fixtures,
`sha256sum -c` against PROVENANCE.md, `file` on the CRLF text, `git diff` on SCOPE.md and facts.md,
`git status --short`, `ls -l` for mtimes, and `find /tmp -maxdepth 1 -user $(id -u) -newermt …`.
I started no container and wrote nothing outside `goal-pack/BUS-MEMORY.md`.

Two slips of my own, for the record: my first `jq` pipeline put `.importedModules` after `.dependencies`
and errored (the worker's counts were right), and my first `file` call omitted the `gradle/` prefix.
Neither changed a conclusion.
### After G1 (PASS)

I re-checked all 28 deliverable sha256 (`sha256sum -c`, every line `OK`), so the tree I reviewed is the
pinned build. I read `aliases.yml`, `resolve.ts`, `spdx.ts`, `csv.ts`, `report.ts`, `types.ts`, the test
titles of all nine files, and F19. I ran, in my own `/tmp` directory: the no-overrides inventory; a
fresh `pnpm --filter acme-tasks-web licenses list --json --prod` and the full sample run twice from it,
then `find … | xargs sha256sum` manifests of both; `head -n 1` on the CSV, `grep -n '^## '` on the
Markdown, a `LC_ALL=C sort` diff of the data rows, `tr -cd '\r'` on both; `find` counts and `sha256sum`
on the CRLF notice, the pnpm notice and the LicenseRef text; `jq` comparisons of the committed fixture
against the live report; ten control runs (`gradle-single`, no input, missing `--texts`, missing
`reason`, duplicate id, unknown ecosystem, empty `licenses`, non-id license, wrong-case alias target,
bad sbt header) and an unused-override run; a hand-made pnpm report for the SPDX-expression path;
`pnpm test` twice, `pnpm lint`, `pnpm typecheck`; `git diff` hunk headers on facts.md; a `grep` sweep
for absolute paths over the 29 added files; and `ls -d /tmp/ci-devex*`. I removed my probe directory and
left the suite's `ci-devex-*` scratch alone, since it is the worker's to fix.

My own misread, for the record: I thought `Apache-2.0` was missing from the expression probe's summary —
my `tail -n 6` had cut the line; the Markdown table holds both ids. Nothing followed from it.
### After G2 (PASS)

I re-checked the 8 deliverable sha256 (all `OK`), read `assets` end to end, `tools/shellcheck.ts`,
`oss-inventory/test/tmp.ts`, the self-test's structure and F21/F22. I ran: `pnpm test` (101/101, with
`ls -d /tmp/ci-devex*` before and after → 0 and 0); both self-test arms, twice; `pnpm shellcheck`; and in
my own temp directory whose every component holds a space, a full layout of my own — `init` twice,
`git add -A` on the product, `assets add/commit/status/ls-files/log` on the assets side, `check`, all
four violations with restores, `--require-rg` with and without the flag, four usage errors, a neutered
copy of the tool against the copied self-test, a two-level nested path, a single-file asset path, and a
non-ASCII filename (which is where I found the open defect above). I also confirmed `git log` still shows
the single commit `eb37b68`, that `facts.md` grew by one append-only hunk, and that `pnpm lint` counts 30
files. I removed my probe directories; `/tmp/ci-devex*` is empty and no `ci-devex-` Docker object exists.
### After G3 (PASS)

All 17 deliverable sha256 `OK`. I read the template, `check-workflow.ts`'s behaviour through 16 runs of
my own, `render-squid-conf.sh`, `squid.conf.template`, `.env.example`, `relay/test/compose.yml`, the
mock upstream's target restriction, `run.ts`'s credential handling and teardown, and all 141 lines of
`runbook.md` against `materials/practice.md` section 2. I ran: `pnpm workflow:check` on the template, on
nine controls I planted myself and on seven adversarial variants of my own, plus three input errors;
`pnpm actionlint` and the actionlint image on a deliberately broken workflow (exit 1, so the lint is not
vacuous); `pnpm relay:test` end to end (7/7) followed by the four Docker filters, the port sweep and a
check that the host's squid was untouched; five render-script refusals and a password-leak probe;
`pnpm test` (129/129), `pnpm lint` (38 files), `pnpm typecheck`, `pnpm shellcheck` (3 files); both
self-test arms (11/11); and my own non-ASCII layout to confirm the G2 fix (`check passed`, exit 0, with
the stray control still firing) and the limit that remains (a filename holding `"` still fails).
`facts.md` is still one append-only hunk, now through F25. I removed both probe directories;
`/tmp/ci-devex*` is empty and no `ci-devex-` Docker object exists.
### After G4 (PASS)

All 15 deliverable sha256 `OK`. I read `measure.ts`'s run loop and results guard, `phases.ts`,
`stats.ts`, `machine.ts`'s output, both Compose files and their resolved `config`, the `Dockerfile`,
`stats.test.ts`, the committed JSON and Markdown, the Superseded box under F13 and F26. I ran: my own
three-run 1,000-module measurement (the finding reproduced), a full recomputation of the committed
table from its raw runs, the generator twice at 1,000 and once at 999 modules with the worker's own
hashing method, `sum((i*7919)%10007)` in Python, `docker compose config` on both arms, `df -h
/var/lib/docker .` (same device — the finding that undermines F26's "layer" clause), the four
`ci-devex-` Docker filters and `find … ! -user`, `pnpm test` (143/143), `pnpm lint` (43 files),
`pnpm typecheck`. `facts.md` has exactly two hunks now: the Superseded box inserted under F13 (F13's own
text untouched — no `-` line in the diff) and the append from F18 on. I removed my probe directory and
left `src/generated` regenerated at 1,000 modules, which is git-ignored.
### After G5 (REJECTED for the tally only — everything else verified)

All 10 deliverable sha256 `OK`. I checked: the seven README sections by `grep -n '^## '` (names and
order exactly SCOPE.md's), the signature line by `diff` against the contract's own string and by `xxd`
(file ends `…e583 8d0a`, one trailing newline, 243 lines); the case-study link; 設計's per-tool
実務で実施した点／デモで追加した点／規則の理由, with every 実務 claim traced to
`materials/practice.md` sections 1, 3, 4 and 5 (section 2 I had already traced in G3) and no figure
copied; 「結果」 quoting only this repository's runs, including the reconciliation of the relay test's
seven lines against the contract's five, and the A/B table with its machine line and
「この差の原因は、ここでは調べていません。」; 「制約」 carrying F10, F11, F12, the measured A/B, F14 as
**作者の計測**, and the quote/newline limit. The four tool READMEs: Japanese, です・ます調, four or five
sections each, each ending on real limits. `.github/workflows/ci.yml`: five jobs, `permissions:
contents: read`, every `uses:` a 40-hex SHA that I matched one by one against F15 with its version
comment, `corepack` only twice and only in the header comment (no `run:` step). I ran `pnpm actionlint`
(both files clean), `pnpm workflow:check` on the template (nine `ok`) and on the CI file (R1, R4, R5 fail
— correct and disclosed), `pnpm test` (143/143), `pnpm lint` (43), `pnpm typecheck`. My own leak scan
over 112 files: no `$HOME`, no `/home|/root|/Users` path, no real secret; `relay/.env` absent;
`git diff --stat -- LICENSE` empty; one commit, branch `main`, nothing committed. The AS-BUILT contract:
twelve differences in a table and nine `[AS-BUILT n]` marks in the body, which I checked line by line.
F26's mechanism clause is withdrawn with my `df`/`docker info` measurement quoted inside the entry, and
`facts.md` still shows **no** `-` line, so F1–F17 are intact. Handover has five items in fact/impact/
decision form; Incidental findings has four, including the Vite directories and the three CI rules.
Then I counted the judged rows per goal with my own script: 8, 14, 9, 14, 10, **10** — and the last
tally says 9.
### The closing verdict (DONE)

After the corrected tally I recounted every goal's rows with my own script once more: `G0 8, G1 14,
G2 9, G3 14, G4 10, G5 10`, total **65**, all PASS, which is what the six `Tally:` lines now say and what
`runbook.md` section 0 predicted. `goal-pack/SCOPE.md` and `goal-pack/facts.md` still hash to the values
in the G5 deliverable list (`ee6abc7a…`, `58b908b0…`), and all ten G5 checksums still verify, so only
`PROGRESS.md` moved on that turn. Final sweep by me: the four `ci-devex-` Docker filters empty, no
listener in 18440–18449, no `/tmp/ci-devex*`, one commit (`eb37b68`), branch `main`, nothing committed or
pushed by the run.

**What is left is the human's**, as PROGRESS.md's Handover says: commit with the six proposed messages
(and `git add --chmod=+x two-repos-one-worktree/assets` if committing from Windows), disarm the latch,
regenerate the JVM reports and run the inventory on them, run `pnpm ioab` and `pnpm assets:selftest` on
Windows/Git Bash, and do the publishing leak scan.

## Rulings the bus made

- 🆕 **G0 E8 may stand at five entries.** The row names three, but E7 requires editing SCOPE.md and the
  brief requires appending F18, so `goal-pack/SCOPE.md` and `goal-pack/facts.md` belong to the change
  set; `goal-pack/.gitignore` and `goal-pack/BUS-LOG.md` are the bus kit's. No "Contract changes" entry
  is needed for this: the row's list was incomplete, the contract was not changed. Later goals may
  include `goal-pack/PROGRESS.md`, `goal-pack/facts.md` and the bus's own files in their change set
  without an annotation; anything else still needs one.
- 🆕 **The `source` precedence note stays where the worker put it.** Filling a gap SCOPE.md leaves open
  is a reading, not a contract change, so it belongs under the goal heading and needs no "Contract
  changes" row — but G5 must carry it, and the four other readings listed above, into the AS-BUILT
  contract.
- 🆕 **The `/tmp/ci-devex-*` leak is fixed in G2, not by reopening G1.** It is a side effect of G1's own
  tests (red line 6 makes it the run's to fix), but every G1 row stands on evidence I reproduced, so the
  goal is accepted and the fix rides with the next goal's change set.
- 🆕 **The two G2 readings stay as readings.** Negating the parents of a nested asset path (F21) and
  negating `/.ignore` inside the `.ignore` block (F22) are both forced by what git and ripgrep do, and
  neither contradicts SCOPE.md's wording — so they belong under the goal heading, not in "Contract
  changes". G5's AS-BUILT must state both, next to G1's five.
- 🆕 **The non-ASCII quoting defect does not reopen G2.** Every G2 row is evidenced and I reproduced all
  of it; the contract promises spaces, not UTF-8. The fix rides with G3, as the `/tmp` leak rode with
  G2 — same precedent, and that one worked.
- 🆕 **G3's three readings stand as readings.** Checking R4 and R5 on every job is the only way to keep
  each rule's failure its own, which is what AC-18 requires; a template cannot know the default branch;
  and the two extra reported lines are additive to the contract's five. None contradicts SCOPE.md, so
  none is a contract change — all three go into the AS-BUILT contract in G5.
- 🆕 **The passthrough keeps git's quoting.** `assets ls-files` is git with a different `--git-dir`, so it
  should print what git prints; only the tool's own checks normalise. The worker decided this and I
  agree.
- 🆕 **The Superseded box and the Contract changes row are both correct.** A measurement that refines
  F13's wording without overturning its conclusion is exactly what the box is for, and because SCOPE.md
  told the README to say something now false, the contract row is due as well. F13's text stays as it
  was — I verified no existing line changed.
- 🆕 **G4's reading stands**: recreating only `ci-devex-ioab-node-modules` and `ci-devex-ioab-dist`
  between runs, and leaving the store and cache volumes filled, is the only way the install stays
  offline. That makes twelve readings for the AS-BUILT contract.

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
- 🔴 G1's aliases decide AC-4's "exactly two UNKNOWN". From the fixture I read myself, the names that
  need an alias are `Apache License, Version 2.0`, `The Apache Software License, Version 2.0`,
  `Apache 2.0`, `The Apache License, Version 2.0`, `EPL 1.0`, `MPL 2.0` (Gradle) and `MIT License`,
  `The MIT License` (sbt); the only URL alias the fixtures need is jspecify's null-name entry
  (`https://www.apache.org/licenses/LICENSE-2.0`). `Public Domain` and
  `https://h2database.com/html/license.html` must **not** be aliased — they are what makes aopalliance
  and H2 UNKNOWN. If an alias table is wider than that, ask which fixture line pays for each extra one.
- 🔴 **G2's whitelist is the trap to watch.** SCOPE.md says the assets repository's `info/exclude` is
  `/*` then `!/<path>` per asset path. With git, `/*` also excludes the parent directories of a nested
  asset path, and git does not descend into an excluded directory — so a path like `docs/assets/` needs
  its parents negated as well, or the file is never seen. Ask for a measurement on a nested path, not
  only a top-level one. If parent negations are needed, that is a reading to record under the G2
  heading; if SCOPE.md's wording is actually wrong, it is a contract change with a reason.
- 🔴 `pnpm shellcheck` does not exist yet: AC-16 needs `tools/shellcheck.ts` as well as the script, and
  it is the run's **first container**. Pinned digest, `--rm`, repository mounted read-only, files named
  explicitly, no network, nothing left behind.
- 🔴 git here is 2.25.1: `git init -b` fails and `init.defaultBranch` is silently ignored, so a fresh
  repository is on `master` (F3). A script or test that assumes `main` will pass on the author's machine
  and fail here.
- 🔴 G3 is the goal to watch most: it is the first with containers that talk to each other, ports on
  127.0.0.1, and credentials. The dummy credentials must be generated per run and never written into a
  file in the repository; `.env` is git-ignored and `.env.example` holds dummies only; nothing of
  `ci-devex-relay-test` may survive, including after the control run. The host's own squid
  (`<host-squid>`, port 3128) is not the run's — the relay under test is 18441, the mock upstream 18442.
- 🔴 R1–R9: nine controls, each breaking exactly one rule. Expect me to plant all nine myself.
- 🔴 **G4's hazard is wall-clock, not correctness.** The brief forbids background work and caps a single
  command at ten minutes, while AC-29 and AC-30 each ask for a five-run, 1,000-module measurement. If
  the estimate does not fit, I would rather read a BLOCKED row with the measured timing than a result
  obtained by backgrounding a run. Ask for the timing of one run before the full one.
- 🔴 F13 is the recipe that works here (`CI=true`, the store **and** the metadata cache, `--network
  none`) and F13 is also the result: **on Linux the two arms come out the same.** That is what the rows
  must report. Watch for any explanation of a difference that was not measured on this host, and for
  F14's Windows numbers being quoted as this repository's results — they are the author's probe, 300
  modules, and the README must not present them as the harness's output.
- 🔴 Files a container writes into the bind arm belong to root: removed through the pinned `alpine`
  digest, never with sudo. AC-32's `find … ! -user "$(id -u)"` must print nothing, and the image
  `ci-devex-ioab:local` must be gone unless `--keep`.
- 🔴 **G5 is where honesty gets tested by prose, not by exit codes.** The README's 「結果」 may quote only
  this repository's own runs: the inventory summary, the self-test counts (now `11 passed, 0 failed`),
  the relay test's lines (seven `ok`, while the runbook says 五つ — reconcile), and the A/B table with
  its machine line. F14's Windows numbers are the author's 300-module probe and must be labelled as the
  author's measurements, never as this harness's results. No figures about the author's work anywhere;
  the signature line is the one allowed name.
- 🔴 The AS-BUILT contract must carry **twelve** readings (G1 five, G2 two, G3 three, G4 one, plus the
  Contract changes row's wording) and mark every difference with its reason.
- 🔴 `pnpm actionlint` already lists `.github/workflows/ci.yml` as a candidate, so the moment G5 writes
  the CI file the wrapper lints it with no edit — and R9's pinning applies to it too.
