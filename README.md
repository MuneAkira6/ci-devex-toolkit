# ci-devex-toolkit

Four small tools rebuilt from one engineer's CI and developer-experience work, so that a reader can
run each of them and see why it is built the way it is: an OSS license inventory across pnpm, sbt and
Gradle that fails instead of guessing; a helper that keeps two git repositories in one working tree
from overlapping; a PR compile-check workflow for a self-hosted runner, with a checker for the rules
it must keep and the relay proxy it needs; and a harness that measures build I/O on a bind mount
against named volumes with no network inside its containers.

Every check in this repository has been seen to fail on a planted violation before its green count
was recorded.

## 何を示すか

このリポジトリは、CI と開発体験まわりの四つの小さな道具です。どれも「動く」ことより、**正しくないときに
ちゃんと止まる**ことを見せるために作ってあります。

| ディレクトリ | 一行で |
|---|---|
| [`oss-inventory/`](oss-inventory/README.md) | pnpm・sbt・Gradle の三つのレポートから、推測せずに失敗する OSS ライセンス一覧を作ります |
| [`two-repos-one-worktree/`](two-repos-one-worktree/README.md) | 製品リポジトリの作業ツリーに資産用の bare リポジトリを重ね、両者が重ならないことを確かめます |
| [`pr-compile-check/`](pr-compile-check/README.md) | self-hosted runner で PR ごとにビルドする雛形、その規則の検査、そして中継プロキシとその試験 |
| [`devcontainer-io-ab/`](devcontainer-io-ab/README.md) | バインドマウントと named volume を、ネットワーク無しで測り比べる計測器 |

四つに共通する考えかたが三つあります。**分からないものは推測しない**（ライセンスが引けなければ失敗させる）。
**チェックは必ず赤くしてみる**（違反をわざと仕込み、落ちるところを見てから緑を数える）。**数字は測ったものだけ**
（測っていないことは理由も含めて書きません）。

## 背景

もとになったのは、Scala / Play（sbt）のバックエンドと React（pnpm）の管理画面を持つプロダクトでの、CI と
開発体験の改善です。周辺に Gradle でビルドする小さな Java のプログラムがあり、開発は Windows 上の
devcontainer で行い、社外への通信は認証付きの社内プロキシを通る、という環境でした。

その実務の記録はこちらにあります。

- ケーススタディ: https://github.com/MuneAkira6/engineering-case-studies/blob/main/03-ci-and-developer-experience.md

実務での数値はケーススタディ側にあります。このリポジトリには転記せず、ここで測った数字だけを載せます。

## 設計

四つそれぞれについて、**実務で実施した点**（上のケーススタディにある、実際に行ったこと）と、**デモで追加した点**
（このリポジトリで新しく作ったもの）を分けて書きます。

### oss-inventory

**実務で実施した点。** 依存とライセンスの取り方が npm / pnpm、sbt、Gradle でばらばらで、毎回手で一覧を作って
いました。ワークフローと生成スクリプトで CSV・Markdown・第三者ライセンスの案内を出すようにし、フロントエンドは
依存を自動で解析、バックエンドと Gradle 側は整備した対応表を使いました。ライセンスの全文が欠けている依存が
あれば、ジョブを失敗させます。黙って一覧から落とすことはしません。

**デモで追加した点。** 三つのエコシステムすべての自動解析、別名表（綴りの違いだけを吸収する表）と、理由と出典を
持つ上書き、NOTICE の同梱、そして出力がバイト単位で再現することの確認です。

**規則の理由。** 別名表に入れてよいのは「一つのライセンスの一つの版」を一意に指す綴りだけです。`BSD` や
`GPL`、版の無い `Apache License` は、どれを指すか決まらないので別名になりません。そういう入力は UNKNOWN の
まま失敗させ、人が理由と出典を書いて上書きします。**一つでも引けない記載があれば、その依存全体を UNKNOWN に
します。** 他の記載が引けていても同じです。H2 がその例で、三つの記載のうち二つは引けますが、残る一つが
デュアルライセンスの説明ページを指しているので、人が読むまで確定しません。

### two-repos-one-worktree

**実務で実施した点。** AI 用の資産を製品リポジトリに混ぜたくない、ただし既存のパスは変えたくない、という
条件でした。資産用のリポジトリを bare で作り、製品リポジトリと同じ作業ツリーに重ね、ファイルは一つも
移動しませんでした。製品側は `.git/info/exclude` で資産を除外します（`.gitignore` に書くと製品側の差分に
出てしまうためです）。資産側はホワイトリスト式の exclude で自分の担当だけを拾います。ripgrep は
`.git/info/exclude` も読むので、何もしないと検索結果から資産が静かに消えます。ルートの `.ignore` でその除外を
打ち消しました。両方が同時に追跡しているパスが 0 件であることは、定期的に確かめていました。

**デモで追加した点。** その手順を `assets init` と `assets check` にまとめ、四つの違反それぞれを実際に作って
名前付きで報告させる自己テストを付けました。

**規則の理由。** 資産の置き場所は三つの条件で決まります。差分に出ないこと、検索から消えないこと、二つの
リポジトリで重ならないこと。`check` の四項目は、その三つを機械で確かめられる形にしたものです。

### pr-compile-check

**実務で実施した点。** コンパイルエラーに PR の段階で気づけず、デプロイのときに初めて分かることがありました。
チームの Linux 開発機を self-hosted runner として登録し、PR ごとにバックエンドとフロントエンドをビルドする
ようにしました。`runs-on` を式にして、既定は self-hosted、手動実行で選んだときだけ GitHub-hosted に振ります
（runner の機械が止まっているときの逃げ道です）。JVM は認証付きのプロキシをそのまま使えないので、runner 機の
上に中継プロキシを置き、`127.0.0.1` だけにバインドしました。認証情報を持つのは中継プロキシだけです。
ワークフローの権限は `contents: read` だけで、secret は一つも渡しません。公開リポジトリから取れない依存は
リポジトリ内に同梱し、secret なしで依存解決できるようにしました。同じ PR の古い実行はキャンセルし、ジョブには
タイムアウトを付け、ワークスペースは毎回きれいにして、デプロイと同じ全量のビルド（sbt の `stage`。`compile`
ではありません）をします。

**デモで追加した点。** 守るべき不変条件を R1–R9 として明文化し、それを検査するツールと、九つの違反を一つずつ
仕込んで「その規則だけが落ちる」ことを確かめる試験を付けました。中継プロキシは、モックの上流プロキシと宛先を
立てて、対照実験込みで試験します。

**規則の理由。** 要点は二つです。**self-hosted runner に secret を渡さない構成をまず作ること**（R2・R3）。
そして **他人のコードが自分の機械で特権付きに動かないようにすること**（R3 の `pull_request_target` 禁止、
R5 の fork 拒否、R8 の資格情報を残さない checkout、R9 のタグではなく SHA での固定）。中継プロキシが要るのは、
sbt の依存解決がプロキシの返す `407 Proxy Authentication Required` に自分で答えられないからです。

### devcontainer-io-ab

**実務で実施した点。** ローカルの起動が遅く、原因は Windows のバインドマウント越しにビルド成果物と依存の
キャッシュを読み書きする I/O でした。起動時の過剰なログも効いていました。ビルド成果物（sbt の `target/`）と
依存のキャッシュを named volume に移し、ログのレベルを直し、取得できない依存をリポジトリ内に置きました。
効果は、開発者が自分の端末で測りました。

**デモで追加した点。** 同じことを、どの機械でも同じ手順で測れる計測器にしました。コンテナの中からは
ネットワークに出ず、二つのアームの違いは Compose ファイルの差分だけで読み取れます。

**規則の理由。** 比べるものを揃えるためです。アームを交互に回し、各回の前に成果物を空にし、依存の取得は
オフラインに固定し、測った機械の素性を結果ファイルに必ず書きます。そうしないと、数字が何の数字なのか後から
分かりません。

## 動かし方

まずこれだけで通ります。ネットワークも Docker も要りません（依存の取得を除く）。

```
pnpm i && pnpm test
```

道具ごとのコマンドは次のとおりです。**Docker** と書いたものは Docker が必要です。

| コマンド | 何をするか | Docker |
|---|---|---|
| `pnpm test` | 全ツールの単体・結合テスト | 不要 |
| `pnpm lint` / `pnpm typecheck` | Biome と TypeScript | 不要 |
| `pnpm inventory -- …` | ライセンス一覧（[使い方](oss-inventory/README.md)） | 不要 |
| `pnpm workflow:check <file>...` | ワークフローの規則 R1–R9 の検査 | 不要 |
| `pnpm assets:selftest` | 二リポジトリ補助ツールの自己テスト | 不要 |
| `pnpm shellcheck` | シェルスクリプトの検査（固定したイメージ） | **要** |
| `pnpm actionlint` | ワークフローの検査（固定したイメージ） | **要** |
| `pnpm relay:test` | 中継プロキシの試験（対照実験込み） | **要** |
| `pnpm ioab` | バインドマウント対 named volume の計測 | **要** |

Docker を使うものは、127.0.0.1 の 18441 と 18442 以外にポートを公開せず、使うイメージはすべてダイジェストで
固定してあります。終わったあとに、このリポジトリが作ったコンテナ・ボリューム・ネットワーク・イメージは
残りません。

## 結果

ここに載せるのは、**このリポジトリ自身の実行の出力だけ**です。実務の数値はケーススタディ側にあります。

### ライセンス一覧（サンプル一式）

pnpm の実レポート（その場で生成）と、sbt・Gradle の実レポート（同梱）、そして二件の上書きを与えた実行です。

```
0BSD: 1
Apache-2.0: 14
BSD-2-Clause: 1
BSD-3-Clause: 1
EPL-1.0: 1
EPL-2.0: 2
ISC: 1
LGPL-2.1-only: 4
LicenseRef-Public-Domain: 1
MIT: 32
MPL-2.0: 1
56 dependencies
```

終了コードは 0 です。上書きを外すと、aopalliance と H2 の二件が UNKNOWN になり、終了コード 1 で失敗します。

### 二リポジトリ・一作業ツリーの自己テスト

```
11 passed, 0 failed
```

十一件には、四つの違反を実際に作って名前付きで報告させる対照実験が含まれます。gawk を先に置いた場合と、
mawk を先に強制した場合の両方で同じ結果になります。

### 中継プロキシの試験

```
ok   http through the relay reaches the origin, authenticated at the upstream: status 200, …
ok   CONNECT through the relay opens a tunnel to the echo, authenticated at the upstream: …
ok   a request straight to the upstream without credentials gets 407: status 407
ok   the relay is published on 127.0.0.1 only: docker compose port -> 127.0.0.1:18441; …
ok   no credential appears in the containers’ logs: 0 occurrence(s)
ok   no container of the run has a proxy variable in its environment: …
ok   control: with the wrong upstream credentials the request does not succeed: status 407, …

7 passed, 0 failed
```

このうち仕様で決めている表明は五つ（上の 1・2・3・4 と、最後の対照実験）です。残る二つ、資格情報がログに
出ないことと、コンテナにプロキシの環境変数が渡っていないことは、この実装が追加で報告しているものです。

### バインドマウント対 named volume

`pnpm ioab`（1 アーム 5 回、1,000 モジュール、アームは交互）を、二台の機械で回した結果です。どちらの機械でも
同じ計測をもう一度行い、同じ傾向になることを確かめています。

#### Linux（実装を行ったホスト）

| 工程 | bind 中央値 (ms) | volume 中央値 (ms) | bind ÷ volume |
|---|---:|---:|---:|
| install | 876 (870–894) | 1067 (1038–1103) | 0.82 |
| build | 1063 (1060–1064) | 1083 (1057–1102) | 0.98 |
| first-request | 222 (221–243) | 223 (222–240) | 1.00 |

測った機械:
`Linux 5.4.0-216-generic (x64), 12 × Intel(R) Xeon(R) E-2146G CPU @ 3.50GHz, 46.9 GiB, Docker 28.1.1
on Ubuntu 20.04.6 LTS, storage driver overlay2`

`build` と `first-request` は誤差の範囲で同じです。`install` は named volume のほうが約 18% 遅く、二回の
計測のどちらでも範囲が重なりませんでした。**この差の原因は、ここでは調べていません。**

#### Windows（Docker Desktop）

実行の後に、作者が同じ計測器を自分の Windows PC で回したものです。

| 工程 | bind 中央値 (ms) | volume 中央値 (ms) | bind ÷ volume |
|---|---:|---:|---:|
| install | 2821 (2717–4313) | 1396 (1159–1542) | 2.02 |
| build | 9255 (8632–12474) | 4729 (4256–6264) | 1.96 |
| first-request | 6291 (5841–9633) | 268 (210–297) | 23.47 |

測った機械:
`Windows_NT 10.0.26100 (x64), 14 × Intel(R) Core(TM) Ultra 5 235U, 31.4 GiB, Docker 28.5.1 on Docker
Desktop, storage driver overlayfs`

三つの工程のすべてで、バインドマウント側が遅くなりました。とくに `first-request`（サーバーが 1,000 個の
モジュールを読み込み、最初の応答を返すまで）は 23 倍です。二回目の計測では比が 2.83・2.17・25.75 で、
同じ傾向でした。ただし絶対値は、回によって 3 割ほど変わります。

結果ファイルは [`devcontainer-io-ab/results/`](devcontainer-io-ab/results/) にあり、どちらの機械の分も全 10
回の生の値が入っています。ファイル名の日付は UTC です（Windows の分は、日本時間では 2026-10-02 の朝に
測りました）。

### Windows での確認（実行の後）

作者の Windows PC（Windows 11、Git Bash、Node v24.15.0、Docker Desktop 28.5.1）でも、新しく展開した作業ツリーで
次を確かめました。`pnpm i && pnpm test`（143 件成功）、`pnpm lint`、`pnpm typecheck`、サンプル一式の一覧
（上と同じ 56 件）、`pnpm workflow:check`、`pnpm shellcheck`、`pnpm actionlint`、`pnpm assets:selftest`
（`11 passed, 0 failed`。`rg` は VS Code に同梱のものを `PATH` に置きました）、`pnpm relay:test`
（`7 passed, 0 failed`）。この確認で見つかった不具合と、その直し方は「作り方」に書きました。

## 制約・既知の限界

- **sbt-license-report は依存ごとに一つしかライセンスを書きません。** 実際には複数でも、CSV にはその旨が
  残りません。ツールは CSV が言っていることだけを読みます。
- **jk1 の dependency-license-report は、JSON レンダラーの既定だと最初の一つ以外のライセンスを黙って
  落とします。** このリポジトリのサンプルは `JsonReportRenderer("index.json", false)` を使い、ツールは既定の
  形のレポートを読むことを拒みます。
- **sbt と Gradle のレポートは、この実行環境では作っていません。** JVM が無く、同梱のレポートは事前に用意された
  実物です。CI の `jvm-reports` ジョブが毎回作り直し、できたてのレポートで一覧を作り直します。
- **Linux では、named volume に移す利点は出ませんでした。** このホストでの計測では `build` と
  `first-request` は誤差の範囲で同じ、`install` はむしろバインドマウントのほうが速いという結果です。
  原因はここでは調べていません。
- **Windows（Docker Desktop）では、named volume に移す効果がはっきり出ました**（「結果」の表）。ただし、測ったのは
  作者の PC 一台です。また、実行の前に作者が試作スクリプトで確かめたところ、TypeScript 7 の native な実行ファイルは
  バインドマウント上で置き換えに失敗しました。そのため、サンプルは TypeScript 6.0.3 でビルドします。Windows で
  埋めた pnpm のストアには linux 向けのパッケージが入らないため、サンプルは `supportedArchitectures` も指定して
  います（[`goal-pack/facts.md`](goal-pack/facts.md) の F14）。
- **`assets` の自己テストには `rg` が要ります。** 検索の確認を実際に通す二つのケースは、`PATH` に `rg` が無いと
  理由を書いて失敗します。
- **`assets check` は、名前に引用符そのものや改行が入ったファイルをまだ正しく扱えません。** git は
  `core.quotePath=false` でも、そうした名前を引用符で囲んで出力するためです。日本語などの非 ASCII 名は
  扱えます。
- このリポジトリの数字は、記載した二台の機械のものです。別の機械で測れば別の数字になります。

## 作り方

このリポジトリは、**人が見ていない状態で走る goal-bus 方式の実行**によって作られました。仕様（契約）を先に
凍結し、ゴールごとに受け入れ条件を立て、実行のたびに証拠付きで台帳を埋め、別のモデルがそれを検証してから
次のゴールに進む、という進め方です。契約・事実表・台帳・手順書はすべて [`goal-pack/`](goal-pack/) に
残っています。

- [`goal-pack/SCOPE.md`](goal-pack/SCOPE.md) — 契約（AS-BUILT）
- [`goal-pack/facts.md`](goal-pack/facts.md) — 測定したことと、そのコマンドと出力
- [`goal-pack/PROGRESS.md`](goal-pack/PROGRESS.md) — 受け入れ条件と、その判定と証拠

### 実行の後に人が行ったこと

実行が終わったあと、作者が次のことをしました。詳細は [`goal-pack/SCOPE.md`](goal-pack/SCOPE.md) の
"Changes after the run" と、[`goal-pack/facts.md`](goal-pack/facts.md) の F27〜F30 にあります。

- 実装を行ったホストで、新しく展開した作業ツリーから全コマンドを流し直しました。
- sbt と Gradle のレポートを、同梱のサンプルから作り直しました。11 ファイルすべてが同梱のものとバイト単位で
  一致し、できたてのレポートでの一覧も終了コード 0 でした。
- 実行環境では試せなかった Windows で確かめ、Linux では現れない不具合を四つ見つけて直しました。どれも、
  直す前に赤くなることを確かめてから直しています。
  1. 中継プロキシの設定を作るスクリプトが、`&` を含むパスワードを壊していました。bash 5.2 からは、
     `${var//pattern/replacement}` の置換文字列の中で引用符の外にある `&` が「一致した文字列」を表します。
     中継のイメージの bash は 5.2 です。実装を行ったホストの bash は 5.0 だったので、実行中のテストでは
     見えませんでした。置換文字列を引用符で囲み、中継の試験のパスワードに `&` を入れました。
  2. Windows では `rg` がパスの区切りに `\` を使うため、`assets check` が正しい配置でもすべての資産を
     「検索から消えている」と報告していました。
  3. 自己テストが `rg` を外すために使っていた `PATH`（`/usr/bin:/bin`）では、Git Bash だと git まで消えます。
     一方、ubuntu-24.04 では apt の `rg` が `/usr/bin` に入るので、`rg` が消えません（CI で失敗するところでした）。
  4. Docker Desktop が、PC のプロキシ設定（資格情報を含む）をすべてのコンテナに渡していました。Compose
     ファイルすべてで、プロキシの変数を空にしています。
- 実行が記録した、このリポジトリと無関係なコンテナの名前を伏せました。

公開前の確認事項は [`PUBLISHING.md`](PUBLISHING.md) にあります。

設計・レビュー・検証：So Ryo ／ 実装：AI エージェント（Claude Code）との協働
