# two-repos-one-worktree

製品リポジトリの作業ツリーに、もう一つのリポジトリ（bare）を重ねるための補助ツールです。ファイルは一つも
移動せず、製品側の差分にも出ません。

AI 用の仕様やスキルといった「製品のコードではない資産」を、既存のパスを変えずに別のリポジトリで管理したい、
という状況のための道具です。

## できること

```
assets init  --git-dir <dir> <path>...     # 製品リポジトリの作業ツリーで実行します
assets check [--git-dir <dir>] [--require-rg]
assets <git のサブコマンド> [args...]       # = git --git-dir=<dir> --work-tree=<root> ...
```

`--git-dir` の既定値は `$ASSETS_GIT_DIR` です。

- **init** は、bare リポジトリを作り、その `info/exclude` をホワイトリストとして書き、製品側の
  `.git/info/exclude`（`.gitignore` ではありません）に印付きのブロックを書き、ルートの `.ignore` に打ち消しを
  書きます。同じ引数でもう一度実行しても 1 バイトも変わりません。
- **check** は四つのことを確かめます。両方が追跡しているパスが無いこと、除外に対応する打ち消しが `.ignore` に
  あること、資産側が追跡している全ファイルを `rg --files --hidden` が拾えること、どちらの `git status` も
  相手のパスに踏み込んでいないこと。違反は名前付きで列挙し、終了コード 1 です。
- **その他のサブコマンド**は資産リポジトリへそのまま渡ります。`assets add`、`assets commit`、`assets status`
  などが、製品リポジトリのインデックスに触れずに動きます。

## 動かし方

```
export ASSETS_GIT_DIR=/path/to/assets.git
assets init --git-dir "$ASSETS_GIT_DIR" 'docs/assets' 'ai assets'
assets add -A && assets commit -m '資産を追加'
assets check
pnpm assets:selftest          # 自己テスト（一時ディレクトリだけを使います）
```

## 入出力

init が書くのは次の三つだけです。

| ファイル | 内容 |
|---|---|
| `<git-dir>/info/exclude` | `/*` で全部を外し、資産パスとその親を打ち消すホワイトリスト |
| 製品の `.git/info/exclude` | 資産パスと `/.ignore` を除外する印付きブロック |
| ルートの `.ignore` | 同じパスの打ち消し。ripgrep が資産を見失わないようにするためです |

`.ignore` は資産リポジトリのものです。

## 限界

- **git は ASCII の外にある名前を引用符で囲んで八進表記にします。** check は `core.quotePath=false` で読むので
  日本語のファイル名は扱えますが、名前に引用符そのものや改行が入っている場合は、まだ正しく比較できません。
- ネストした資産パス（`docs/assets/` など）では、`/*` が親ディレクトリも外してしまい git がその中に降りません。
  init は親の打ち消しと再除外を書くことでこれを避けています。
- `rg` が `PATH` に無いときは検索の確認を飛ばします。`--require-rg` を付けると、その場合は使用法エラー
  （終了コード 3）になります。
- bash 5.0 と git 2.25 で動きます。`git init -b` は使いません。
