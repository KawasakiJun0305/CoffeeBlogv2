# CoffeeBlogv2 — Claude 作業指示

## 最重要ルール: 仕様書優先原則

**実装を始める前に、変更対象に対応する仕様ファイルを必ず Read すること。**

### ファイル→仕様のマッピング（どのファイルを変更するとき、何を読むか）

| 変更するファイル | 読む仕様ファイル |
|----------------|----------------|
| `scripts/generate.ts`, `scripts/strategies/*.ts` | [docs/spec/01-generate.md](docs/spec/01-generate.md) |
| `scripts/rank-articles.ts` | [docs/spec/02-scoring.md](docs/spec/02-scoring.md) |
| `scripts/post-to-note.ts` | [docs/spec/03-note-post.md](docs/spec/03-note-post.md) |
| `.github/workflows/*.yml` | [docs/spec/04-automation.md](docs/spec/04-automation.md) |
| `types/index.ts`, `data/*.json` | [docs/spec/05-data.md](docs/spec/05-data.md) |
| `scripts/legal-check.ts` | [docs/spec/06-legal-check.md](docs/spec/06-legal-check.md) |
| スコープ・技術スタック・環境変数の確認 | [SPEC.md](SPEC.md)（インデックス） |

### やってはいけないこと

- 仕様ファイルを読まずに実装する
- 仕様に記載されていない機能を実装する
- 仕様ファイルを更新せずにコードの機能・インターフェースを変更する

### やること

1. **変更対象のファイルを確認し、上記マッピングから対応する仕様ファイルを Read する**
2. 実装内容が仕様のどのセクションに対応するかを確認する
3. 仕様にない変更が必要な場合は、**コードを書く前に** 対象の仕様ファイルを更新してユーザーに確認を取る
4. `data/*.json` のスキーマ変更時は `docs/spec/05-data.md` も同時に更新する

### 実装前チェックリスト

- [ ] 対応する仕様ファイルを Read した
- [ ] 実装する機能が仕様に記載されている
- [ ] 入力・出力の形式が `docs/spec/05-data.md` と一致している
- [ ] スコープ外（SPEC.md 参照）の項目を実装しようとしていない

---

## プロジェクト概要

AI 駆動コーヒーブログ記事生成パイプライン。CLI ツール。

- 生成戦略: Topics / Matrix / News（詳細: docs/spec/01-generate.md）
- 投稿先: note.com（下書きのみ、公開は手動）
- LLM: GitHub Models / GPT-4o（`GITHUB_TOKEN` で認証）

---

## コーディング規約

- 言語: TypeScript strict mode
- プロンプトテンプレート: `prompts/coffee-article.md` に集約（各スクリプトに散在させない）
- データファイル: `data/` 以下（`topics.json` / `topics-matrix.json` / `generated.json`）
- 生成記事: `output/` 以下（`.gitignore` 対象）
