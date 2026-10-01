You are the worker for ci-devex-toolkit. First read goal-pack/goal-brief.md completely, then
goal-pack/SCOPE.md, goal-pack/facts.md, goal-pack/materials/practice.md and goal-pack/PROGRESS.md.

This goal is G0: the toolchain, the environment re-measured and the contract freeze. Work inside this
repository and the OS temp directory only.

1. Record in the Environment table of PROGRESS.md, each with its command and output: `node --version`,
   `pnpm --version` (in the repository root, so packageManager decides), `bash --version | head -n 1`,
   `git --version`, `readlink -f "$(command -v awk)"`, `mawk -W version 2>&1 | head -n 1`,
   `rg --version | head -n 1`, and `docker version --format '{{.Server.Version}}'`. Compare them with
   facts F2–F4.
2. Run `pnpm install` without changing pnpm-workspace.yaml. Record the result and how long it took, and
   that the pnpm sample's dependencies are installed (`pnpm --filter acme-tasks-web list --prod`).
3. For each of the five images in SCOPE.md, run
   `docker image inspect --format '{{index .RepoDigests 0}}' <image>` and compare with the digest SCOPE.md
   lists. Do not pull anything.
4. Run the port check of fact F6 and quote it.
5. Read the given fixtures as facts F10 and F11 describe them: count the dependencies of
   `oss-inventory/fixtures/gradle/index.json` and `gradle-single/index.json` with `jq`, the data lines
   of the sbt CSV, the files under `fixtures/gradle`, and compare `sha256sum` of the fixtures with
   `oss-inventory/fixtures/PROVENANCE.md`.
6. Write a first Vitest test in `oss-inventory/test/` (for example, that the sbt fixture's header is the
   one F11 shows), and run `pnpm test`, `pnpm lint` and `pnpm typecheck`; quote their last lines,
   including Biome's file count and which files it covered.
7. Mark SCOPE.md as FROZEN with today's date, changing nothing else in it.
8. Quote `git status --short`.

Judge every G0 row in PROGRESS.md with the output you quote. End every turn on a progress line such as
`PROGRESS: G0 ac_done=2/8 pass=2 fail=0 blocked=0 deferred=0`, and when every G0 row has a verdict and
the tally line is written, end with `PROGRESS: G0 COMPLETE`.
