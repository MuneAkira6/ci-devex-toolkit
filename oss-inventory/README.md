# oss-inventory

pnpm・sbt・Gradle の三つのレポートから、OSS ライセンスの一覧を一つ作るツールです。**分からないものは
推測せず、失敗させます。**

## できること

- 三つのエコシステムのレポートを読み、依存ごとのライセンスを SPDX の識別子に正規化します。
- 正規化できない名前や URL は UNKNOWN として扱い、終了コード 1 で失敗します。黙って一覧から落としません。
- 別名表（`aliases.yml`）は「綴りの違い」だけを吸収します。判断が要るものは、理由と出典を書いた上書き
  （overrides）で人が決めます。
- 使われた識別子すべてについてライセンス全文を出力します。全文が無い識別子があれば失敗します。
- 依存に同梱されている LICENSE / NOTICE をバイト列のまま複製します。

## 動かし方

```
pnpm inventory -- [--pnpm <report.json>]... [--pnpm-root <dir>]
                  [--sbt <report.csv>]... [--gradle <index.json>]...
                  [--overrides <overrides.yml>] [--texts <dir>] --out <dir>
```

サンプル一式を読む例です。pnpm のレポートはその場で作ります。

```
pnpm --filter acme-tasks-web licenses list --json --prod > out/pnpm.json
pnpm inventory -- \
  --pnpm out/pnpm.json \
  --sbt oss-inventory/fixtures/sbt/acme-tasks-api-licenses.csv \
  --gradle oss-inventory/fixtures/gradle/index.json \
  --overrides oss-inventory/samples/overrides.yml \
  --texts oss-inventory/samples/texts \
  --out out/inventory
```

## 入力

| 指定 | 作り方 | 形 |
|---|---|---|
| `--pnpm` | `pnpm --filter <pkg> licenses list --json --prod` | ライセンス文字列をキーにしたオブジェクト。ワークスペースの根では `--filter` が要ります。 |
| `--sbt` | `sbt dumpLicenseReport`（sbt-license-report 1.10.0） | `Category,License,Dependency,Notes` の CSV |
| `--gradle` | jk1 dependency-license-report 3.1.4、`JsonReportRenderer("index.json", false)` | `moduleLicenses` を持つ JSON |

`--pnpm` の `paths` が相対のときは `--pnpm-root`（既定は現在のディレクトリ）から解決します。

## 出力（`--out` の下）

| ファイル | 内容 |
|---|---|
| `inventory.csv` | `ecosystem,name,version,licenses,source,declared,homepage` |
| `inventory.md` | 要約（ライセンス→件数）、全依存の表、「Failures」「Unused overrides」 |
| `licenses/<id>.txt` | 使われた識別子ごとのライセンス全文 |
| `notices/<ecosystem>/<name>@<version>/<file>` | 同梱ファイルの複製（Gradle 名の `:` は `__` になります） |

行は ecosystem・name・version の順に並び、時刻は入りません。同じ入力で二回動かすと、出力の全ファイルが
1 バイトも違いません。

終了コードは、0 が問題なし、1 が上書きのない UNKNOWN か全文の無いライセンス、3 が入力エラー
（読めない・解析できない、Gradle の単一ライセンス形式、上書きの不備、入力が一つも無い）です。

## 限界

- **sbt-license-report は依存ごとに一つしかライセンスを書きません。** 実際には複数でも、CSV にはその旨が
  残りません。ツールは CSV が言っていることだけを読みます。
- **jk1 の JSON レンダラーは既定だと最初の一つ以外を落とします。** ツールはその形を読むことを拒み、
  `JsonReportRenderer("index.json", false)` を使うよう促します。
- 別名表の URL 比較は、スキーム・先頭の `www.`・末尾のスラッシュ一つだけを取り除きます。
  `.../LICENSE-2.0` と `.../LICENSE-2.0.txt` は別のキーです。
- 別名表の名前比較は、前後の空白を落としたうえでの完全一致です。
