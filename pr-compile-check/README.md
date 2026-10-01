# pr-compile-check

self-hosted runner で PR ごとにコンパイルを確かめるためのワークフロー雛形と、その不変条件を検査する
ツール、そして JVM のために置く中継プロキシの一式です。

## できること

| もの | 役割 |
|---|---|
| `pr-compile-check.yml` | sbt のバックエンドと pnpm のフロントエンドを PR ごとにビルドする雛形 |
| `tools/check-workflow.ts` | 雛形が守るべき九つの規則 R1–R9 の検査 |
| `relay/` | 認証付きプロキシへ中継する squid 一式（`127.0.0.1` だけに公開） |
| `relay/test/` | 中継プロキシの試験。モックの上流プロキシと宛先を立て、対照実験まで行います |
| `runbook.md` | 運用手順書（規則の理由、fork からの PR、runner が止まったとき、点検） |

## 動かし方

```
pnpm workflow:check pr-compile-check/pr-compile-check.yml   # 規則の検査（Docker 不要）
pnpm actionlint                                             # actionlint（Docker が要ります）
pnpm relay:test                                             # 中継プロキシの試験（Docker が要ります）
```

中継プロキシを runner 機で動かすときは、`relay/.env.example` を `.env` に写して値を入れ、
`docker compose up -d` です。`.env` は git 管理外で、認証情報を持つのは中継プロキシだけです。

## 入出力

- `pnpm workflow:check <file>...` は一行ずつ `R1 ok` / `R1 FAIL <理由>` を印字します。終了コードは
  0（全部守られている）、1（一つ以上破れている）、3（読めないか YAML でない）です。
- `pnpm relay:test` は Compose プロジェクト `ci-devex-relay-test` を 127.0.0.1:18441 と 18442 に立て、
  表明ごとに一行印字し、最後に `<n> passed, <m> failed` を出します。終了時には、失敗したときも、
  コンテナ・ネットワーク・ボリュームを残しません。
- 中継プロキシの描画スクリプトは、値が空のときと空白を含むときに描画を拒み、描画結果を決して表示しません。

## 限界

- 雛形は「sbt のバックエンド＋ pnpm のフロントエンド」という形を前提にしています。`runs-on` のラベルや
  既定ブランチ名は、写した先に合わせて書き換えてください。
- R4 と R5 は、self-hosted で動きうるジョブを式から判定するのではなく、すべてのジョブに対して検査します。
  規則どうしが連鎖して落ちないようにするためです。
- 試験で使う上流プロキシと宛先はモックです。本物のプロキシには一度も接続しません。
- 試験の資格情報は実行ごとに生成され、その実行の環境にしか存在しません。ファイルには書きません。
