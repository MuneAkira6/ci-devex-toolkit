# devcontainer-io-ab

同じプロジェクトを「バインドマウントの上」と「named volume の上」で測り比べる計測器です。コンテナの中からは
ネットワークに一切出ません。

## できること

- 生成した 1,000 個のモジュールを読み込む Express サーバーを題材に、`install` / `build` /
  `first-request` の三つの所要時間を、両方の置きかたで交互に測ります。
- 結果を JSON と Markdown に書きます。中央値・最小・最大、バインド ÷ ボリュームの比、そして測った機械の
  素性（OS、CPU、メモリ、Docker、ストレージドライバ）が入ります。
- 測り終えたら、コンテナ・ボリューム・ネットワーク・イメージを片付けます。バインドマウントに書かれた
  root 所有のファイルは、コンテナ経由で消します（`sudo` は使いません）。

## 動かし方

```
pnpm ioab -- [--runs <n>] [--modules <m>] [--out <dir>] [--keep]
```

既定は 1 アーム 5 回、1,000 モジュール、出力先は `devcontainer-io-ab/results` です。Docker が要ります。
準備の `pnpm install --lockfile-only` と `pnpm fetch` だけがネットワークを使い、以後は使いません。

```
pnpm ioab                                      # 本番の計測
pnpm ioab -- --runs 1 --modules 50 --out out/  # 動作確認（この数字は結果ではありません）
```

## 入出力

- 入力は `sample/`（計測対象のプロジェクト）と、モジュール数だけです。生成器は同じ数なら同じファイルを書きます。
- 二つのアームの違いは `compose.bind.yml` と `compose.volume.yml` の差分がすべてです。`node_modules`、`dist`、
  pnpm のストア、メタデータキャッシュの四つを、バインドマウントの中に置くか named volume に移すかだけが
  違います。どちらも `network_mode: none` です。
- 出力は `results/<日付>-<プラットフォーム>.json` と `.md` です。別の日付・別のプラットフォームの結果を
  上書きすることはありません。

## 限界

- **Linux では、この差は出ません。** このホストでの計測では `build` と `first-request` は誤差の範囲で同じ、
  `install` は逆にバインドマウントのほうが速い、という結果でした。理由はここでは調べていません。
- **Windows（Docker Desktop）では差がはっきり出ます。** 実行の後に作者がこの計測器を Windows で回した結果が
  [`results/2026-10-01-win32-x64.md`](results/2026-10-01-win32-x64.md) です。中央値で、バインドマウント側が
  `install` で 2.0 倍、`build` で 2.0 倍、`first-request` で 23 倍の時間がかかりました。
- 計測対象は TypeScript 6.0.3 でビルドします。TypeScript 7 の native な実行ファイルは、Windows の
  バインドマウント上で置き換えに失敗することがあるためです。
- 数字は測った機械のものです。別の機械で測れば別の数字になります。結果ファイルに機械の素性が入っているのは
  そのためです。
- 結果ファイルの名前と `date` は UTC の日付です。Windows の結果は、日本時間では 2026-10-02 の朝に測りました。
