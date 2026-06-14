# プロジェクト仕様書 — CoffeeBlogv2（インデックス）

> **原則**: このファイルはコードより先に更新される。仕様が変わればここを先に書き換える。
> 機能ごとの詳細は `docs/spec/` 以下の各ファイルを参照すること。

---

## プロジェクト概要

- **目的**: コーヒー記事を AI で自動生成し note.com に下書き投稿する CLI パイプライン
- **主なユーザー**: 個人（自分一人）
- **LLM**: GitHub Models / GPT-4o（`GITHUB_TOKEN` で認証）
- **成功の定義**: 3戦略での記事生成が安定稼働し、下書き投稿が動作し、仕様が明文化されメンテナンス可能な状態

---

## 仕様ファイル一覧（機能別）

| ファイル | 対象機能 | 関連コード |
|---------|---------|----------|
| [docs/spec/01-generate.md](docs/spec/01-generate.md) | 記事生成パイプライン・3戦略 | `scripts/generate.ts`, `scripts/strategies/*.ts` |
| [docs/spec/02-scoring.md](docs/spec/02-scoring.md) | 品質スコアリング | `scripts/rank-articles.ts` |
| [docs/spec/03-note-post.md](docs/spec/03-note-post.md) | note.com 下書き投稿 | `scripts/post-to-note.ts` |
| [docs/spec/04-automation.md](docs/spec/04-automation.md) | GitHub Actions 自動実行 | `.github/workflows/pipeline.yml` |
| [docs/spec/05-data.md](docs/spec/05-data.md) | データスキーマ（JSON・Markdown） | `types/index.ts`, `data/*.json` |

---

## スコープ外（やらないこと）

| 除外項目 | 理由 |
|---------|------|
| Web フロントエンド | CLI のみで十分 |
| SNS 自動投稿 | スコープ外 |
| 複数ユーザー対応 | 個人ツールのため不要 |
| note.com 以外のプラットフォーム | v1 スコープ外 |
| note.com への自動公開 | 下書きまで自動化、公開は手動 |

---

## 環境変数

| 変数名 | 説明 | 取得方法 |
|-------|------|---------|
| `GITHUB_TOKEN` | GitHub Models API 認証 | Actions では自動提供。ローカルは PAT を `.env` に記載 |
| `NOTE_API_TOKEN` | note.com 非公開 API 認証 | DevTools の Network タブで Bearer トークンを手動取得 |

---

## 技術スタック

| 項目 | 採用技術 |
|------|---------|
| 言語 | TypeScript 5.x |
| ランタイム | Node.js + ts-node |
| LLM クライアント | OpenAI SDK（GitHub Models エンドポイント） |
| 自動化 | GitHub Actions |
| パッケージ管理 | npm |

---

## ディレクトリ構成

```
CoffeeBlogv2/
├── SPEC.md                      # ← このファイル（インデックス）
├── docs/spec/
│   ├── 01-generate.md           # 記事生成パイプライン・3戦略
│   ├── 02-scoring.md            # 品質スコアリング
│   ├── 03-note-post.md          # note.com 下書き投稿
│   ├── 04-automation.md         # GitHub Actions
│   └── 05-data.md               # データスキーマ
├── scripts/
│   ├── generate.ts              # 記事生成エントリーポイント
│   ├── strategies/
│   │   ├── topics.ts            # Topics 戦略
│   │   ├── matrix.ts            # Matrix 戦略
│   │   └── news.ts              # News 戦略
│   ├── post-to-note.ts          # note.com 投稿
│   ├── rank-articles.ts         # 品質スコアリング
│   └── pipeline.ts              # 生成 → 投稿 一括実行
├── prompts/
│   └── coffee-article.md        # カテゴリ別プロンプトテンプレート（集約）
├── data/
│   ├── topics.json              # Topics 戦略のトピック一覧（手動追加可）
│   ├── topics-matrix.json       # Matrix 戦略の3次元データ（豆・抽出・角度）
│   └── generated.json           # 生成済み履歴（手動編集不要）
├── output/                      # 生成記事（.gitignore 対象）
├── types/
│   └── index.ts                 # 型定義
├── .github/workflows/
│   └── pipeline.yml             # 定期自動実行
├── .githooks/
│   └── pre-commit               # SPEC.md 遵守チェック
├── .claude/
│   └── settings.json            # Claude Code フック設定
├── CLAUDE.md                    # Claude 作業指示
├── .env.example
├── package.json
└── tsconfig.json
```

---

## 変更履歴

| 日付 | バージョン | 変更内容 |
|------|-----------|---------|
| 2026-06-14 | v1 | 初版作成（ヒアリングベース） |
| 2026-06-14 | v1.1 | 戦略仕様に具体ユースケース例を追加、定量値を参考値として明示 |
| 2026-06-14 | v2 | docs/spec/ に分割。SPEC.md はインデックスのみに変更 |
