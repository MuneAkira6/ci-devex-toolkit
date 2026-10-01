# PUBLISHING

公開する前に見ることと、リポジトリの説明文・トピックの案です。

## GitHub の説明文（案）

> Four small CI / developer-experience tools, each shown failing on a planted violation before its
> green count: a license inventory across pnpm, sbt and Gradle that fails instead of guessing, a
> two-repositories-one-worktree helper, a PR compile-check workflow for a self-hosted runner with
> its relay proxy, and a bind-mount vs named-volume I/O harness.

日本語で出す場合の案です。

> 推測せずに失敗する OSS ライセンス一覧（pnpm / sbt / Gradle）、二リポジトリ・一作業ツリーの補助ツール、
> self-hosted runner 向け PR コンパイルチェックと中継プロキシ、バインドマウント対 named volume の計測器。
> どのチェックも、違反を仕込んで赤くなるところを見てから緑を数えています。

## トピック（案）

`ci` `developer-experience` `github-actions` `self-hosted-runner` `pnpm` `sbt` `gradle`
`license-compliance` `spdx` `devcontainer` `docker` `squid` `typescript` `bash` `git`

## 公開前のチェックリスト

### 1. 漏れていないか

- [ ] 認証情報が一つも入っていないこと。少なくとも次を見ます。
      `git grep -nEi 'password|secret|token|api[_-]?key|BEGIN [A-Z ]*PRIVATE KEY'`
      — 出てくるのは変数名・ダミー・説明文だけであることを確認します。
- [ ] `pr-compile-check/relay/.env` が存在しないこと、`.gitignore` に入っていること
      （`git check-ignore -v pr-compile-check/relay/.env`）。
- [ ] `.env.example` の値がすべてダミーであること（`proxy.example.invalid`, `dummy-user`,
      `dummy-password`）。
- [ ] この機械の絶対パスが入っていないこと。
      `git grep -nE '(^|[ "'"'"'(=])/(home|root|Users)/'`
- [ ] 会社名・製品名・顧客名・チーム名・個人名が入っていないこと。README 末尾の署名行だけが例外です。
- [ ] 実務の数値が入っていないこと。数字はケーススタディ側にあります。

### 2. リンクが生きているか

- [ ] README の「背景」のケーススタディへのリンク。
- [ ] README から各ツールの README へのリンク四本、`goal-pack/` と `PUBLISHING.md` へのリンク。
- [ ] 各ツールの README から相互に張ったリンク。

### 3. 固定がほどけていないか

- [ ] すべてのイメージがダイジェストで固定されていること。
      `git grep -n 'image:\|^FROM ' -- '*.yml' '*.ts' 'devcontainer-io-ab/Dockerfile'`
      — `@sha256:` が付いていない行が無いことを確認します。
- [ ] すべての `uses:` が 40 桁のコミット SHA で、版がコメントで添えてあること。
      `pnpm workflow:check pr-compile-check/pr-compile-check.yml` が `R9 ok` を出すこと。
      `.github/workflows/ci.yml` についても、同じ検査の R9 が ok であることを見ます
      （R1・R4・R5 は self-hosted runner 向けの規則なので、GitHub-hosted 専用の CI では落ちます）。
- [ ] `pnpm actionlint` が両方のワークフローで clean。

### 4. 動くか

- [ ] `pnpm i && pnpm test` が通ること。
- [ ] `pnpm lint`、`pnpm typecheck`、`pnpm shellcheck` が通ること。
- [ ] `pnpm assets:selftest` が `0 failed` であること。
- [ ] `pnpm relay:test` が `0 failed` で、終わったあとにコンテナ・ボリューム・ネットワークが
      残っていないこと。
- [ ] `pnpm ioab -- --runs 1 --modules 50 --out out/ioab` が通り、後片付けされること。

### 5. 残っていないか

- [ ] `git status --short` が成果物だけであること。
- [ ] `docker ps -a`、`docker volume ls`、`docker network ls`、`docker image ls` を
      `ci-devex-` で絞って、どれも何も出ないこと。
