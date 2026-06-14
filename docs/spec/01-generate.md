# 仕様: 記事生成パイプライン

> 関連ファイル: `scripts/generate.ts`, `scripts/strategies/*.ts`

---

## 機能概要 — v1 (2026-06-14)

コーヒーに関する記事を AI で自動生成し、`output/` に Markdown として保存する。

---

## 入力 / 前提条件

- `GITHUB_TOKEN` 環境変数が設定されている
- `data/topics.json` または `data/topics-matrix.json` が存在する（Topics/Matrix 戦略の場合）
- `data/generated.json` が存在する（初回は `{"generated":[]}` で自動生成）
- 戦略の指定: `topics` / `matrix` / `news` / `auto`

## 処理フロー（正常系）

1. 戦略を決定する（引数指定、または `auto` で重み付き抽選: topics 30% / matrix 40% / news 30%）
2. `data/generated.json` を読み込み、重複を排除してトピック/組み合わせを選択する
3. LLM（GitHub Models / GPT-4o、`baseURL: https://models.inference.ai.azure.com`）にプロンプトを送信して記事を生成する
4. Unsplash API でカテゴリ + トピックに合った画像を1枚取得する（`UNSPLASH_ACCESS_KEY` が設定されている場合のみ。失敗時はスキップして続行）
5. 生成された記事を `output/YYYY-MM-DD-[識別子].md` に保存する（画像がある場合は本文先頭に埋め込み + frontmatter に `imageUrl` / `imageCredit` を追加）
6. `data/generated.json` に生成履歴を追記する
7. 生成完了をコンソールに出力する

## 出力 / 事後状態

- `output/` に Markdown ファイルが1件保存される（スキーマは [05-data.md](05-data.md) 参照）
- `data/generated.json` に1件追記される

## 異常系・エッジケース

| 条件 | 期待される挙動 |
|------|--------------|
| `GITHUB_TOKEN` が未設定 | 起動時にエラーを表示して終了 |
| LLM API がエラーを返す | エラー内容をコンソール出力して終了（リトライなし） |
| 全トピックが生成済み（topics 戦略） | 「全トピック生成済み」と表示して終了（エラーではない） |
| 全マトリクス組み合わせが生成済み | 同上 |
| RSS フィード取得失敗（news 戦略） | 取得できたフィードのみで継続。全フィード失敗時はエラー終了 |

## 画像取得仕様（Unsplash）

`scripts/fetch-image.ts` に実装する。

**検索クエリ（カテゴリ別）:**

| カテゴリ | Unsplash 検索クエリ |
|---------|-------------------|
| `beans` | `coffee beans {topic}` |
| `brewing` | `coffee brewing {topic}` |
| `cafe` | `coffee shop cafe` |
| `equipment` | `coffee equipment {topic}` |
| `culture` | `coffee culture` |
| `flavor` | `coffee tasting cup` |

**Markdown 埋め込み形式:**

```markdown
---
title: ...
imageUrl: https://images.unsplash.com/photo-xxx
imageCredit: "Photo by John Doe on Unsplash"
---

![コーヒー](https://images.unsplash.com/photo-xxx)
*Photo by [John Doe](https://unsplash.com/@johndoe?utm_source=CoffeeBlog&utm_medium=referral) on [Unsplash](https://unsplash.com/?utm_source=CoffeeBlog&utm_medium=referral)*

{記事本文}
```

**Unsplash クレジット表記（利用規約上の必須要件）:**
- 写真家名へのリンク（`utm_source=CoffeeBlog&utm_medium=referral` 付き）
- Unsplash へのリンク（同上）
- 記事本文の先頭（画像直下）に配置

## スコープ外

- リトライロジック（API エラー時は即終了）
- 複数記事の同時生成（1回の実行で1記事）
- 記事の自動公開
- 画像の note.com へのアップロード（URL 埋め込みのみ）
- 複数画像の選択・比較（1記事1枚）

---

## 戦略詳細

> 各戦略の「件数」「種類数」は参考値。固定仕様は「動作フロー」のみ。具体的な数値は `data/` 以下のデータファイルを正とする。

### Topics 戦略

**入力**: `data/topics.json`（トピック名 + カテゴリのリスト）
**処理**: 未生成のトピックをランダムに1件選択 → カテゴリ別プロンプトで記事生成
**カテゴリ（例）**: `豆・産地` / `抽出・レシピ` / `カフェ情報` / `道具・機器` / `コーヒー文化`

ユースケース例:
- 入力: `{ "topic": "エチオピア イルガチェフェ", "category": "豆・産地" }`
- 出力: `output/2026-06-14-エチオピア-イルガチェフェ.md`（frontmatter + 記事本文 約1,500字）

### Matrix 戦略

**入力**: `data/topics-matrix.json`（豆 × 抽出方法 × 切り口の3次元データ）
**処理**: 未生成の組み合わせをランダムに1件選択 → 切り口別プロンプトで記事生成

ユースケース例:
- 入力: `{ "bean": "ケニア AA", "method": "フレンチプレス", "angle": "プロのコツを自宅で再現" }`
- 出力: `output/2026-06-14-matrix-ケニア-AA-フレンチプレス.md`

### News 戦略

**入力**: RSS フィード（複数ソース、URL は実装時に決定）+ OpenLibrary API（最新書籍情報）
**処理**: ニュース・書籍情報を取得 → コーヒーとの「意外な接点」を探索して記事生成
**補助利用**: `data/topics.json` に手動でニュース起点トピックを追加することも可

ユースケース例:
- 入力: RSS から「インド発のサステナブル農業が話題」
- 出力: `output/2026-06-14-news-インド農業とコーヒー.md`

---

## 変更履歴

| 日付 | バージョン | 変更内容 |
|------|-----------|---------|
| 2026-06-14 | v1 | 初版作成 |
| 2026-06-14 | v2 | Unsplash 画像取得ステップ（ステップ4）と画像仕様セクションを追加 |
