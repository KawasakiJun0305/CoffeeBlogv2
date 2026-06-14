# Git Hooks セットアップ

git リポジトリ初期化後に以下を実行してフックを有効化する:

```sh
git config core.hooksPath .githooks
```

## pre-commit フック

TypeScript ファイル（`.ts`）が変更されているのに `SPEC.md` が更新されていない場合に警告してコミットをブロックする。

仕様に沿った実装でスキップしたい場合:

```sh
git commit --no-verify -m "..."
```
