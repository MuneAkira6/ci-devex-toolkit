# ci-devex-toolkit — scope and contract

**Contract status: AS-BUILT 2026-10-01.** Drafted before the run, frozen unchanged in G0, and
rewritten here in G5 to say what was actually built. The frozen text is in git history; every place
where the build differs from it is marked **[AS-BUILT]** below, with its reason and the fact that
forced it. Nothing was quietly widened: each of these is a question the frozen wording left open,
not a requirement that was dropped. What a human changed after the run is listed in "Changes after the
run" at the end.

**The twelve differences, in one list.**

| # | Where | What the frozen contract said | What was built, and why |
|---|---|---|---|
| 1 | oss-inventory, `inventory.csv` `source` | the column is one of `declared`, `alias`, `override`, `unknown` | the order of precedence was not given; it is `override` > `unknown` > `alias` > `declared`, so a dependency that needed the alias table for any entry reads `alias` |
| 2 | oss-inventory, `inventory.csv` `licenses` | the ids joined with `;`, or the pnpm expression | an UNKNOWN dependency has no ids, so the cell reads `UNKNOWN` |
| 3 | oss-inventory, `inventory.csv` `declared` | the declared names and URLs joined with ` \| ` | a dependency whose report declares no license entry at all reads `(no license entry)` |
| 4 | oss-inventory, the `declared` column | — | an entry with a null name and only a URL is written `(url)`, and one with neither `(no name, no URL)` |
| 5 | two-repos-one-worktree, the assets whitelist | `/*`, then `!/<path>` per asset path, then `!/.ignore` | each parent directory of a nested path is also negated and its other contents re-excluded (`!/docs/`, `/docs/*`, `!/docs/assets/`): `/*` excludes the parent and git never descends into it, so the leaf negation is never reached and the asset is invisible to `git add` (F21) |
| 6 | two-repos-one-worktree, the `.ignore` block | `!/<path>` for each asset path | `!/.ignore` is in the block too: `.ignore` belongs to the assets repository and the product's exclude block hides it, so without this, check 3 ("every file the assets repository tracks is listed by `rg --files --hidden`") fails on the tool's own output (F22) |
| 7 | pr-compile-check, R5 | every job **that can run self-hosted** refuses a foreign-head pull request | R5 is checked on every job. Deciding which jobs can reach the self-hosted labels would make R5 depend on R4, and a planted R4 violation would then fail R5 as well; AC-18 asks each rule to fail alone |
| 8 | pr-compile-check, R4 | every job's `runs-on` is an expression that gives the self-hosted labels unless dispatched with the hosted choice | checked as: the value holds `${{`, names `self-hosted`, and mentions the dispatch input R1 found. Also checked on every job, for the same reason as 7 |
| 9 | pr-compile-check, R1 | `push` to **the default branch** | checked as `on.push.branches` being a non-empty list: a template cannot know the default branch of the repository it is copied into. The template uses `main` and says so |
| 10 | pr-compile-check, the relay test | it prints one line per assertion, five of them | it prints seven: the contract's five, plus the credential-leak count AC-23 asks for and a check that no container has a proxy variable in its environment (goal-brief.md, red line 5) |
| 11 | devcontainer-io-ab, emptying the volume arm | "the volumes are recreated" | only `ci-devex-ioab-node-modules` and `ci-devex-ioab-dist` are recreated per run; the store and metadata-cache volumes are preparation and survive, because a run that re-fetched them would not be measuring an offline install |
| 12 | README 「制約・既知の限界」 | "on Linux the A/B arms do not differ (F13)" | the README says what was measured: `build` and `first-request` do not differ, `install` is about 18 % **slower on the named volume**, in two full measurements with non-overlapping ranges, cause not investigated (F26, and the Superseded box under F13) |

Two smaller things that are not differences but are worth stating, because a reader will look for
them: `assets` uses no awk at all (the contract allowed either awk without intervals or no awk), and
`tools/shellcheck.ts` computes its file list from `git ls-files --cached --others --exclude-standard`
rather than walking the filesystem, so the files `.gitignore` ignores — the goal-bus hooks among
them — are not this repository's to lint.

Four small tools from the author's CI and developer-experience work, each rebuilt so that a reader can
run it and see why it is built that way:

| Tool | In one line |
|---|---|
| `oss-inventory/` | one license inventory from the reports of pnpm, sbt and Gradle, with full texts, that fails instead of guessing |
| `two-repos-one-worktree/` | a helper that lays a second, bare repository over a product repository's working tree, and checks that the two never overlap and that search still finds the assets |
| `pr-compile-check/` | a PR compile-check workflow for a self-hosted runner, a checker for the rules it must keep, and the relay proxy it needs, tested against a mock |
| `devcontainer-io-ab/` | a harness that measures the same project with its build outputs on a bind mount and on named volumes, with no network inside the containers |

The rules come from the author's practice, summarised in [materials/practice.md](materials/practice.md).
The measured facts are in [facts.md](facts.md); the run appends its own from F18 on. The example product
is **Acme Tasks**, a fictional task board.

## Deliverables

| Path | Content |
|---|---|
| `oss-inventory/src/*.ts` | the inventory CLI (`pnpm inventory`) |
| `oss-inventory/aliases.yml` | the alias table: license names and URLs → SPDX ids |
| `oss-inventory/fixtures/pnpm/acme-tasks-web.json` | the pnpm sample's report, produced live in G1, paths made relative |
| `oss-inventory/test/*.test.ts` | Vitest tests |
| `two-repos-one-worktree/assets` | the helper (bash) |
| `two-repos-one-worktree/test/selftest.sh` | its self-test (bash; `pnpm assets:selftest`) |
| `pr-compile-check/pr-compile-check.yml` | the workflow template |
| `pr-compile-check/tools/check-workflow.ts` | the rule checker (`pnpm workflow:check`) |
| `pr-compile-check/relay/` | the relay: `compose.yml`, `squid.conf.template`, the render script, `.env.example` |
| `pr-compile-check/relay/test/` | the relay test (`pnpm relay:test`): a mock upstream, a mock origin, a Compose file, the runner `run.ts` |
| `pr-compile-check/runbook.md` | the runbook (Japanese) |
| `pr-compile-check/test/*.test.ts` | Vitest tests of the checker |
| `devcontainer-io-ab/measure.ts` and its modules | the harness (`pnpm ioab`) |
| `devcontainer-io-ab/compose.bind.yml`, `compose.volume.yml`, `Dockerfile` | the two arms and the image |
| `devcontainer-io-ab/sample/` | the measured project: the given files, plus `tsconfig.json`, the server, the module generator and `pnpm-lock.yaml` |
| `devcontainer-io-ab/results/` | the harness's results on this host (JSON and Markdown) |
| `devcontainer-io-ab/test/*.test.ts` | Vitest tests |
| `tools/actionlint.ts`, `tools/shellcheck.ts` | wrappers that run the pinned images (`pnpm actionlint`, `pnpm shellcheck`) |
| `<tool>/README.md` | one short usage page per tool (Japanese) |
| `README.md`, `PUBLISHING.md`, `.github/workflows/ci.yml`, `pnpm-lock.yaml` | as described below |

**Given and not to be changed**: `LICENSE`, `.gitattributes`, `.gitignore`, `package.json`,
`pnpm-workspace.yaml`, `tsconfig.json`, `biome.json`, `vitest.config.ts`, everything under
`oss-inventory/samples/` (except `node_modules/` that `pnpm install` creates), everything under
`oss-inventory/fixtures/` except the pnpm fixture the run adds, `devcontainer-io-ab/sample/package.json`,
`devcontainer-io-ab/sample/pnpm-workspace.yaml`, entries F1–F17 of `goal-pack/facts.md`, and everything
under `goal-pack/materials/`. If one of them really has to change, record the reason under "Contract
changes" in PROGRESS.md first.

`package.json` fixes the script names and their entry files; the layout above follows from them.

## Images and ports

Every image is referenced **by digest**, everywhere in the repository (Compose files, Dockerfiles,
wrappers, the CI). All of them are on the host already (F5); the run pulls nothing.

| Image | Digest | Used by |
|---|---|---|
| `node:24.19.0-bookworm-slim` | `sha256:a9f5f7c91a432850b2a8a7797adf5eadb6c733ceed61167806cee7ea7fbc29df` | the A/B image; the relay test's mocks |
| `ubuntu/squid:6.6-24.04_edge` | `sha256:8a3baed477e2c282ab8aa5edad442f69873246964f225c5c2ae8364b6610963c` | the relay |
| `rhysd/actionlint` (1.7.12) | `sha256:b1934ee5f1c509618f2508e6eb47ee0d3520686341fec936f3b79331f9315667` | `pnpm actionlint` |
| `koalaman/shellcheck` (0.11.0) | `sha256:bb596a0d169b85ddd81d8b6d3a2ff6d5baf5fca10b97f575ebc647c3dff62b3d` | `pnpm shellcheck` |
| `alpine` | `sha256:28bd5fe8b56d1bd048e5babf5b10710ebe0bae67db86916198a6eec434943f8b` | removing root-owned files a container wrote into a bind mount; filling volumes |

Ports on the host: **18441** (the relay under test) and **18442** (the mock upstream, for the direct
check), both bound to `127.0.0.1`. Nothing else of the run listens on the host.

Docker objects of the run carry the prefix **`ci-devex-`**: Compose projects `ci-devex-relay-test`,
`ci-devex-ioab-bind` and `ci-devex-ioab-volume`, volumes `ci-devex-ioab-*`, the image
`ci-devex-ioab:local`. **No container of the run uses the network** (F7): the A/B runs with
`network_mode: none`, and the relay test's containers talk only to each other on the project's network.

---

## oss-inventory

```
pnpm inventory -- [--pnpm <report.json>]... [--pnpm-root <dir>] [--sbt <report.csv>]... [--gradle <index.json>]...
                  [--overrides <overrides.yml>] [--texts <dir>] --out <dir>
```

At least one report. Each input flag may repeat.

### Inputs

| Flag | Producer | Shape (facts) |
|---|---|---|
| `--pnpm` | `pnpm --filter <pkg> licenses list --json --prod` | object keyed by license string → entries `{ name, versions[], paths[], license, author?, homepage?, description? }` (F8). One row per name × version. A relative entry in `paths` is resolved against `--pnpm-root` (default: the current directory). |
| `--sbt` | `sbt dumpLicenseReport` (sbt-license-report 1.10.0) | CSV, header `Category,License,Dependency,Notes`; license `<name> (<url>)` or `<name>`; dependency `<group> # <artifact> # <version>` with an optional ` (<url>)` (F11). One license per row: the plugin's limit. |
| `--gradle` | jk1 dependency-license-report 3.1.4 with `JsonReportRenderer("index.json", false)` | `{ dependencies: [ { moduleName: "<group>:<artifact>", moduleVersion, moduleUrls?, moduleLicenses: [ { moduleLicense: string \| null, moduleLicenseUrl } ] } ], importedModules }` (F10). **The default renderer's shape** (a single `moduleLicense` per module) **is an input error**: it has already dropped licenses (F10). |

The identity of a dependency is `<ecosystem>:<name>@<version>`, with `ecosystem` one of `pnpm`, `sbt`,
`gradle`, and `name` the package name (pnpm) or `<group>:<artifact>` (sbt, Gradle).

### Normalisation — the tool never guesses

Each declared license (a name, a URL, or both) becomes an SPDX id, in this order:

1. the name is an SPDX license id that spdx-license-list knows (F9), compared case-insensitively and
   written in its canonical case;
2. pnpm only: the `license` string parses as an SPDX expression (spdx-expression-parse, F9); its ids
   are the dependency's ids, each checked as in step 1 or as a `LicenseRef-*` with a text, and the
   expression is kept as declared;
3. the name is in `oss-inventory/aliases.yml` under `names`;
4. the name is empty or null and the URL is in `aliases.yml` under `urls` (compared without scheme,
   without a leading `www.` and without a trailing `/`);
5. otherwise the entry is **UNKNOWN**, with the name or URL it carried.

A dependency's licenses are the sorted, de-duplicated ids of its entries. A dependency with no license
entry at all is UNKNOWN. **One UNKNOWN entry makes the dependency UNKNOWN**, even if its other entries
mapped (the H2 case, F10).

`aliases.yml` maps only names and URLs that denote exactly one license and version ("Apache 2.0",
"The MIT License"); an ambiguous one ("BSD", "GPL", "LGPL", "Apache License" without a version) is never
an alias. The file says so at the top. The run adds exactly the aliases the fixtures need, each one
quoted from a fixture in PROGRESS.md.

### Overrides

`--overrides` is a YAML list. Every entry has `id` (a dependency identity), `licenses` (a non-empty list
of SPDX ids or `LicenseRef-*`), `reason`, `source` and `reviewed` (`YYYY-MM-DD`). A missing or empty
field, an unknown ecosystem, a malformed id or a duplicate id is an input error that names the entry. An
override replaces the dependency's licenses and is reported as such; one that matches no dependency is
listed as **unused** and changes nothing else. The samples' overrides are given
(`oss-inventory/samples/overrides.yml`): two human rulings, on aopalliance and H2 (F17).

### Texts and notices

- Every license id in the result needs a full text: from spdx-license-list (F9), or, for a
  `LicenseRef-*`, from `<texts dir>/<id>.txt`. An id without a text is a **failure**.
- Files the inputs provide are copied as they are (byte for byte): for pnpm, the `LICENSE*`,
  `LICENCE*`, `COPYING*` and `NOTICE*` files at the root of each package path that exists; for Gradle,
  the files under `<artifact>-<version>.jar/META-INF/` next to `index.json` (F10). sbt provides none.

### Output (in `--out`, created if missing; only these files are written)

| File | Content |
|---|---|
| `inventory.csv` | header `ecosystem,name,version,licenses,source,declared,homepage`; `licenses` the ids joined with `;`, or the pnpm expression; `source` one of `declared`, `alias`, `override`, `unknown`; `declared` the declared names and URLs joined with ` \| `. **[AS-BUILT 1-4]** `source` precedence is `override` > `unknown` > `alias` > `declared`; `licenses` reads `UNKNOWN` for an UNKNOWN dependency; `declared` reads `(no license entry)` when the report declares none, `(url)` for a null-name entry and `(no name, no URL)` for an empty one |
| `inventory.md` | a summary (license → number of dependencies), the full table, then "Failures" and "Unused overrides" (each "None" when empty) |
| `licenses/<id>.txt` | one full text per license id used |
| `notices/<ecosystem>/<name>@<version>/<file>` | the copied files; `:` in a Gradle name becomes `__` |

Rows sorted by ecosystem, name, version; no timestamps; LF line ends: **two runs on the same inputs are
byte-identical.**

### Exit codes

`0` nothing failed · `1` at least one UNKNOWN dependency without an override, or a license without a
text (each listed on stdout and in `inventory.md`) · `3` an input error (a file that cannot be read or
parsed, the single-license Gradle shape, an invalid overrides entry, no input at all). The outputs are
written for exit 0 and 1.

### The samples

- `samples/pnpm-app` (a workspace member; `pnpm install` installs it) is read live:
  `pnpm --filter acme-tasks-web licenses list --json --prod`. A copy with every path made relative to
  the repository root is committed as `fixtures/pnpm/acme-tasks-web.json`; it holds no absolute path.
- `samples/gradle-app` and `samples/sbt-app` are the projects behind the given Gradle and sbt fixtures
  (`fixtures/PROVENANCE.md`). The run cannot build them (no JVM, F4; F12); the CI does.
- The full sample run — pnpm live, sbt and Gradle fixtures, `samples/overrides.yml`, `--texts
  samples/texts` — exits 0.
- The toolkit's own runtime dependencies (`pnpm --filter ci-devex-toolkit licenses list --json --prod`,
  F8) are inventoried the same way.

---

## two-repos-one-worktree

A product repository with its `.git`, and an assets repository (bare, anywhere) whose work tree is the
same directory. The product never tracks the assets; the assets repository tracks only them.

```
assets init  --git-dir <dir> <path>...     # run in the product repository's working tree
assets check [--git-dir <dir>] [--require-rg]
assets <git subcommand> [args...]           # = git --git-dir=<dir> --work-tree=<root> <subcommand> ...
```

`--git-dir` defaults to `$ASSETS_GIT_DIR`. The root is `git rev-parse --show-toplevel` of the product
repository. An asset path is relative to the root, without `..`; a directory is written with a trailing
`/`.

**init** (idempotent; running it again with the same paths changes nothing):
1. creates the bare repository if it does not exist;
2. writes its `info/exclude` as a whitelist: `/*`, then `!/<path>` for each asset path, and `!/.ignore`.
   **[AS-BUILT 5]** Each parent directory of a nested path is negated and its other contents
   re-excluded as well (`!/docs/`, `/docs/*`, `!/docs/assets/`): `/*` excludes the parent, git never
   descends into an excluded directory, and the leaf negation is otherwise never reached (F21);
3. writes a marked block into the product's `.git/info/exclude` — never into `.gitignore` — listing each
   asset path and `/.ignore`; the block is replaced, not appended to, on a second run;
4. writes a marked block into `.ignore` at the root, with `!/<path>` for each asset path, so that
   ripgrep does not hide what `info/exclude` hides. `.ignore` belongs to the assets repository.
   **[AS-BUILT 6]** The block also carries `!/.ignore`: the product's exclude block hides that file,
   and check 3 below asks that every file the assets repository tracks be listed by `rg` (F22).

**check** — exit `0` when all of these hold, `1` listing every violation, `3` on a usage error:
1. no path is tracked by both repositories;
2. every asset path in the product's exclude block has its negation in `.ignore`;
3. every file the assets repository tracks is listed by `rg --files --hidden` run at the root; when `rg`
   is not on `PATH` the check prints `search check skipped: rg not found` — with `--require-rg` that is
   a usage error (3) instead;
4. the product's `git status --porcelain` shows no asset path, and the assets repository's shows no
   product path.

**Portability**: bash 5.0 or later and git 2.25 or later (F3); the same script runs in Git Bash on
Windows, on the host and on ubuntu-24.04. No `git init -b`; no regular-expression interval
(`{n,m}`) in awk or sed — or no awk at all; paths with spaces work. ShellCheck is clean.

**selftest.sh** builds every case in temporary directories whose paths contain a space: init (and init
again), check passing, each of the four violations produced for real and reported by name with exit 1,
`--require-rg` without `rg` (exit 3), and the passthrough (`assets add`, `assets commit`,
`assets status`). It prints `<n> passed, <m> failed` and exits 1 on any failure. It forces mawk ahead of
gawk on `PATH` when mawk exists.

---

## pr-compile-check

### The workflow template — `pr-compile-check/pr-compile-check.yml`

For a repository with an sbt backend and a pnpm frontend (the practice's shape): a `backend` job that
runs `sbt stage` — the task packaging uses, not `compile` — and a `frontend` job that runs
`pnpm install --frozen-lockfile`, `pnpm lint` and `pnpm build`. On a self-hosted runner the JVM reaches
the network through the relay on `127.0.0.1` (system properties only; no credentials in the workflow).

**The rules**, each enforced by `check-workflow.ts` (rule ids R1–R9 in its output):

| Id | Rule |
|---|---|
| R1 | triggers: `pull_request`, `push` to the default branch, and `workflow_dispatch` with an input that picks the runner, default self-hosted. **[AS-BUILT 9]** "the default branch" is checked as `on.push.branches` being a non-empty list: a template cannot know the branch name of the repository it is copied into |
| R2 | top-level `permissions` is exactly `contents: read`; no job widens it |
| R3 | no `secrets.` anywhere, and no `pull_request_target` trigger |
| R4 | every job's `runs-on` is an expression that gives the self-hosted labels unless dispatched with the hosted choice. **[AS-BUILT 8]** checked as: the value holds `${{`, names `self-hosted` and mentions R1's dispatch input; checked on every job |
| R5 | every job that can run self-hosted refuses a pull request whose head repository is not this repository. **[AS-BUILT 7]** checked on **every** job: deciding which jobs can reach the self-hosted labels would make R5 depend on R4, and one planted violation would then fail two rules |
| R6 | `concurrency` grouped by the pull request (or the ref) with `cancel-in-progress: true` |
| R7 | every job has `timeout-minutes` |
| R8 | every `actions/checkout` step sets `persist-credentials: false` |
| R9 | every `uses:` is pinned to a 40-hex commit SHA with the version as a comment (F15) |

`pnpm workflow:check <file>...` prints one line per rule (`R1 ok` / `R1 FAIL <why>`) and exits `0` all
kept, `1` any rule broken, `3` a file that cannot be read or is not YAML. The tests plant each violation
in a copy and see that rule, and only that rule, fail.

`pnpm actionlint` runs the pinned actionlint image on the template and on `.github/workflows/ci.yml`.

### The relay — `pr-compile-check/relay/`

A Compose template for the runner machine: one squid service (the pinned image) whose configuration is
rendered at start from `squid.conf.template` and the environment (`UPSTREAM_HOST`, `UPSTREAM_PORT`,
`UPSTREAM_USER`, `UPSTREAM_PASSWORD` from a `.env` that is git-ignored; `.env.example` holds dummies),
forwarding everything to the upstream as a parent with its credentials (`never_direct`), caching nothing,
published on `127.0.0.1:${RELAY_PORT:-3128}` only. The render script refuses empty values and values with
whitespace, and never prints the rendered file.

### The relay test — `pnpm relay:test`

Compose project `ci-devex-relay-test`. The relay under test is started from the template's own files
(the render script and `squid.conf.template`), not from a copy, and published on 127.0.0.1:18441.
Beside it:

- a **mock upstream** proxy (Node): requires `Proxy-Authorization: Basic` with dummy credentials the
  test generates for this run; handles absolute-URI requests and `CONNECT`; forwards only to the mock
  origin and refuses any other target, so nothing leaves the host; logs one JSON line per request with
  whether the credentials matched; published on 127.0.0.1:18442 for the direct check;
- a **mock origin** (Node): an HTTP endpoint and a TCP echo.

The runner asserts, from the host:

1. an HTTP request through the relay reaches the origin, and the mock upstream logged it with the right
   credentials;
2. a `CONNECT` through the relay opens a tunnel to the echo (bytes sent come back), also authenticated;
3. a request straight to the mock upstream without credentials gets `407`;
4. the relay is published on 127.0.0.1 only (from `docker compose port`, and from `ss -ltn` where `ss`
   exists);
5. **the control**: with wrong upstream credentials the request through the relay does not succeed and
   the mock logged a rejection;

and removes the project with its volumes and network at the end, also on failure. It prints one line per
assertion and exits 0 only if all pass. **[AS-BUILT 10]** It reports seven lines, not five: the five
above, plus the count of the dummy password in `docker compose logs` (0) and a check that no container
of the run has a proxy variable in its environment. The dummy credentials exist only in the environment of that one
run; they are never written to a file in the repository. The test never touches a real proxy.

### The runbook — `pr-compile-check/runbook.md` (Japanese)

Sections: 目的 / 前提 / runner の登録 / 中継プロキシ / ワークフローのルール（R1–R9 と理由） / フォークからの PR /
runner が止まったとき / 点検（定期的に見ること）. The reasons come from the materials; general advice to
someone adopting the template is allowed, and is not attributed to the author's practice
(materials, section 6).

---

## devcontainer-io-ab

The practice moved build outputs and dependency caches from a bind mount to named volumes. The harness
measures that choice on one project, the same way on any machine.

```
pnpm ioab -- [--runs <n>] [--modules <m>] [--out <dir>] [--keep]
```

Defaults: 5 runs per arm, 1,000 generated modules, `devcontainer-io-ab/results`.

- **The project** (`sample/`): an Express server that imports every generated module and answers `GET /`
  with a value computed from all of them; compiled by TypeScript 6.0.3 (F14). The generator writes
  `sample/src/generated/` (git-ignored) from the module count alone — the same count gives the same files.
- **The arms**: `compose.bind.yml` keeps `node_modules`, `dist`, the pnpm store (`sample/.store/`) and
  the metadata cache (`sample/.cache/`) inside the bind-mounted `sample/`; `compose.volume.yml`
  bind-mounts the same `sample/` but puts the four of them on named volumes (`ci-devex-ioab-*`). Both
  use the image `ci-devex-ioab:local` and `network_mode: none`. Someone reading the two files sees the
  whole difference.
- **Preparation** (once, not timed): generate the modules; `pnpm install --lockfile-only` and
  `pnpm fetch --store-dir <tmp> --cache-dir <tmp>` on the host (F13); build the image from
  `Dockerfile` (`FROM` the pinned Node image, pnpm copied from the repository's own
  `node_modules/pnpm`) with `--network none`; fill each arm's store and metadata cache from the
  fetched ones, through a container with no network.
- **A run** (timed, inside the container, one JSON line per phase): `install`
  (`CI=true pnpm install --offline --frozen-lockfile` with the store and the cache, F13), `build`
  (`tsc -p .`), `first-request` (start the server, poll `GET /` until 200, check the body). Before each
  run the arm's `node_modules` and `dist` are emptied (bind: through a container, since the files belong
  to root, F13; volume: the volumes are recreated). **[AS-BUILT 11]** Only the `node_modules` and
  `dist` volumes are recreated; the store and metadata-cache volumes are preparation and survive,
  because a run that re-fetched them would not be measuring an offline install.
  The arms alternate: bind, volume, bind, volume, …
- **Output**: `results/<YYYY-MM-DD>-<platform>.json` (every run's phases and the machine: OS and
  release, CPU model and count, memory, Docker version and OS, storage driver, the module and file
  counts) and `.md` (per arm and phase: median, min and max in milliseconds; the ratio bind ÷ volume of
  the medians; the machine). It never overwrites a result of another date or platform.
- **Clean-up**: every container, volume and network of the run, the bind arm's files, and the image
  unless `--keep`.
- **Portability**: the harness is Node and spawns `docker` itself with paths it builds (F14); it runs on
  Linux and on Windows with Docker Desktop. It is tested here on Linux only; the author runs it on
  Windows after the run.

---

## Shared

- `tools/actionlint.ts` and `tools/shellcheck.ts` run the pinned images with the repository mounted
  read-only and the files to check named explicitly (`shellcheck`: `two-repos-one-worktree/assets`,
  `two-repos-one-worktree/test/selftest.sh` and every other `*.sh` in the repository).
- Every Node script resolves its paths with `node:path`, never by string concatenation, and spawns
  programs with an argument array, never through a shell.

## README.md — sections

The English summary (three to five lines), then exactly these seven sections, in this order and with
these names:

1. 何を示すか
2. 背景
3. 設計
4. 動かし方
5. 結果
6. 制約・既知の限界
7. 作り方

and, as the last line of the file, exactly:

```
設計・レビュー・検証：So Ryo ／ 実装：AI エージェント（Claude Code）との協働
```

That line is the author's signature and is required; the rule against person names (red line 9) does not
apply to it.

- 「背景」 links the case study:
  https://github.com/MuneAkira6/engineering-case-studies/blob/main/03-ci-and-developer-experience.md
- 「設計」, per tool: what the practice did and what this repository adds (materials, section 7), and the
  reasons for the rules.
- 「動かし方」: `pnpm i && pnpm test` first (offline, no Docker); then the per-tool commands, saying
  which need Docker.
- 「結果」 quotes this repository's own runs only: the sample inventory's summary, the self-test counts,
  the relay test's lines, the A/B table on this host with its machine line. The work figures are in the
  case study; link it, do not copy them.
- 「制約・既知の限界」 includes: sbt-license-report's one license per dependency (F11); the jk1 renderer
  setting (F10); the JVM reports are not produced in this environment (F12) and are regenerated by the CI;
  the A/B as measured here — **[AS-BUILT 12]** `build` and `first-request` do not differ, `install` is
  about 18 % slower on the named volume, in two full measurements with non-overlapping ranges, cause not
  investigated (F26, and the Superseded box under F13), which replaces the frozen wording "on Linux the
  A/B arms do not differ"; the Windows traps the author measured (F14), as the
  author's measurements.
- 「作り方」 says the repository was built by an unattended goal-bus run and links `goal-pack/`.

Each tool directory has a `README.md` (Japanese, short): what it does, how to run it, its inputs and
outputs, its limits.

## CI — `.github/workflows/ci.yml`

On ubuntu-24.04, every `uses:` pinned as in R9, `permissions: contents: read`, pnpm from
`pnpm/action-setup` (never `corepack enable`):

| Job | Steps |
|---|---|
| `checks` | install; lint; typecheck; test; `workflow:check` on the template; actionlint; shellcheck; the full sample inventory; the toolkit's own inventory; upload the outputs |
| `jvm-reports` | Java 21 (Temurin), Gradle 9.8.0, sbt 1.13.0; regenerate both reports from the samples; run the inventory on the fresh reports with the samples' overrides and texts; upload |
| `assets` | install ripgrep with apt; `pnpm assets:selftest` |
| `relay` | `pnpm relay:test` |
| `ioab` | `pnpm ioab -- --runs 1 --modules 50 --out out/ioab` (a smoke run; its numbers are not results) |

Run here every command of it that can run here, and say which cannot and why (the JVM job: F4, F12;
the setup actions and apt need GitHub's runner).

## PUBLISHING.md

A suggested GitHub description and topics, and the checklist before publishing (leak scan, the
README's links, that every image and action is still pinned).

## Rules for the content

- Japanese for the READMEs and the runbook (です・ます調); English for code, comments, test titles,
  tool output and the files under `goal-pack/`.
- No figures about the author's work; no employer, product, customer, team or person names (the
  signature line excepted); nothing about the host beyond what facts.md records.

## Out of scope

Running sbt or Gradle in this environment; a real upstream proxy; a real self-hosted runner;
publishing anything; Docker on Windows during the run (the author's step afterwards); other
ecosystems (Maven, pip, Cargo).

## Changes after the run

Made by a human on 2026-10-02, after the bus had answered DONE; not reviewed by the bus. The
measurements behind them are facts F27–F30.

1. **Redaction.** The run recorded the name and the image of a container on the host that has nothing
   to do with this repository (another squid, on port 3128). Both are replaced by `<host-squid>` and
   `<its image>` in PROGRESS.md, facts.md, BUS-LOG.md, BUS-REVIEWS.md and BUS-MEMORY.md; nothing else
   in those files changed.
2. **Verified again from a fresh tree on the run's host.** From a `git archive` of the run's commit:
   `pnpm i && pnpm test` (`Tests  143 passed (143)`, twice), `pnpm lint` (43 files), `pnpm typecheck`,
   the full sample inventory twice (exit 0, 56 dependencies, the two output trees identical), the
   toolkit's own inventory (exit 0), `pnpm workflow:check` (R1–R9 ok), `pnpm actionlint`, `pnpm
   shellcheck`, `pnpm assets:selftest` with gawk and with mawk (`11 passed, 0 failed`), `pnpm
   relay:test` (`7 passed, 0 failed`) and an A/B smoke run; afterwards no Docker object of the
   repository and no listener on 18440–18449.
3. **The JVM reports regenerated** from the committed samples, on the host, through a throwaway relay:
   all eleven files byte-identical to the fixtures, and the inventory over the fresh reports exits 0
   with 31 dependencies (F30). This is what the CI's `jvm-reports` job does; the job itself has not run
   yet.
4. **Windows, where the run could not go, showed four defects that Linux cannot show.** All fixed, each
   seen red before the fix and green after:
   - **The relay's render script corrupted a password holding `&`.** Since bash 5.2 an unquoted `&` in
     the replacement of `${var//pattern/replacement}` stands for the matched text, and the squid image
     runs the script under bash 5.2.21 (F27). The run's host has bash 5.0, where the unit test passed.
     The replacements are quoted now; the relay test's passwords carry an `&`, so the case runs under
     the image's own bash (with the old script: every request 407, the relay never ready; with the
     fix: `7 passed, 0 failed`).
   - **`assets check` reported every asset as hidden from search on Windows**: rg prints `\` there, and
     Git Bash rewrites a lone `/` passed to a Windows program (F28). rg is now called with
     `--path-separator /`, with Git Bash's path conversion switched off for that one command.
   - **The self-test's PATH without rg** (`/usr/bin:/bin`) lost git in Git Bash, and on ubuntu-24.04,
     where apt puts rg in `/usr/bin`, it would have kept rg, so the CI's `assets` job would have
     failed. The self-test now builds that PATH from the PATH it runs under (F28).
   - **Docker Desktop handed the machine's proxy settings, credentials included, to every container**
     (F29). Every Compose file now sets the six proxy variables to empty, and the relay test counts a
     proxy variable only when it holds a value.

   And one test adjusted, not a defect: the render test's `0600` assertion is skipped on Windows,
   where NTFS has no POSIX permission bits; the script runs inside the Linux container.
5. **The A/B on Windows.** `pnpm ioab` with the defaults on the author's Windows PC (Docker Desktop
   28.5.1): `devcontainer-io-ab/results/2026-10-01-win32-x64.{json,md}` (the harness names files by the
   UTC date; it was 2026-10-02 in Japan). A second full measurement into a temporary directory gave the
   same picture. The README's 「結果」 and 「制約・既知の限界」 and the tool's README now carry it.
6. **Verified on Windows** (Windows 11, Git Bash, Node v24.15.0, from a fresh tree): `pnpm i && pnpm
   test` (`143 passed`), `pnpm lint`, `pnpm typecheck`, the sample inventory (the same 56 dependencies),
   `pnpm workflow:check`, `pnpm shellcheck`, `pnpm actionlint`, `pnpm assets:selftest` with the ripgrep
   that ships with VS Code on `PATH` (`11 passed, 0 failed`) and `pnpm relay:test` (`7 passed, 0
   failed`).
