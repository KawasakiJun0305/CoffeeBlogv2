# 仕様: ソース明示（ソース引用付与）

> 関連ファイル: `scripts/source-citation.ts`

---

## 機能概要 — v1 (2026-06-14)

生成された記事 Markdown に対して、出典・ソース情報を三層で付与する。
パイプライン上の位置: `generate → source-citation → fact-check → format-check → legal-check → post-to-note`

**挙動**: 常に続行（ブロックしない）。AI 処理失敗時はスキップして後続に渡す。

---

## 入力 / 前提条件

- 生成済み Markdown ファイルのパス（`output/YYYY-MM-DD-*.md`）
- `GITHUB_TOKEN` 環境変数（AI による本文修正で使用）
- `data/generated.json`（News 戦略時の RSS ソース URL 取得に使用）

---

## 三層の付与内容

### 層1: frontmatter への `sources` フィールド追記

記事が参照したソース URL・情報源を配列で記録する。

```yaml
---
sources:
  - "https://example-rss.com/coffee-news/2026-06-14"
  - "AI生成（GitHub Models / GPT-4o）"
---
```

- News 戦略: 生成時に参照した RSS フィード URL（`generated.json` の `sourceUrls` フィールドから取得）
- 全戦略共通: `"AI生成（GitHub Models / GPT-4o）"` を必ず含める

### 層2: 本文中のインライン引用挿入（AI）

具体的な数値・統計・固有名詞の主張の直後に、括弧書きで出典注を挿入する。

**例（挿入前）:**
```
エチオピアはコーヒーの発祥地として知られ、世界の生産量の約4%を占めます。
```

**例（挿入後）:**
```
エチオピアはコーヒーの発祥地として知られ、世界の生産量の約4%を占めます（ICO, 2023年推計）。
```

**AI への指示骨子:**
```
以下のコーヒーブログ記事の本文中で、具体的な数値・統計・特定の事実主張の直後に
出典注（括弧書き）を最大5か所追加してください。
出典が不明な場合は「（一般的に知られる情報）」と記載してください。
frontmatter と画像クレジット行は変更しないでください。
本文のみを修正した完全な Markdown を返してください。
```

**追加上限**: 1記事あたり最大5か所

### 層3: 記事末尾への「参考情報」セクション追加

```markdown
---

## 参考情報

- 本記事はAI（GitHub Models / GPT-4o）を使用して生成されました。
- 記載の数値・統計は公開情報をもとにしており、最新情報は各公式ソースをご確認ください。
```

News 戦略の場合は RSS フィードの記事タイトル・URLも列挙する:

```markdown
## 参考情報

- 本記事はAI（GitHub Models / GPT-4o）を使用して生成されました。
- 参考にしたニュース: [記事タイトル](https://example.com/article)
```

---

## 処理フロー

```
1. Markdown ファイルを読み込む
2. frontmatter から strategy を取得
3. News 戦略の場合: generated.json から sourceUrls を取得
4. frontmatter に sources フィールドを書き込む（層1）
5. AI に本文を送信し、インライン引用を挿入させる（層2）
   → 失敗・タイムアウト時はこのステップをスキップ
6. 記事末尾に「参考情報」セクションを追加する（層3）
7. ファイルを上書き保存
```

---

## 出力 / 事後状態

### frontmatter への書き込み

```yaml
---
sources:
  - "https://example-rss.com/article"
  - "AI生成（GitHub Models / GPT-4o）"
sourceAddedAt: "2026-06-14T10:00:00Z"
---
```

### コンソール出力

```
[source-citation] ✓ ソース付与完了 — output/2026-06-14-foo.md（インライン3か所追加）
[source-citation] ⚠ AI インライン引用スキップ（timeout） — frontmatter と末尾セクションのみ付与
```

---

## News 戦略のソース URL 取得

`data/generated.json` の最新 News エントリに `sourceUrls: string[]` フィールドが存在する場合に使用する。

`sourceUrls` が存在しない場合（旧エントリ）は `sources: ["AI生成（GitHub Models / GPT-4o）"]` のみを記録する。

---

## 異常系・エッジケース

| 条件 | 期待される挙動 |
|------|--------------|
| AI 呼び出しが API エラー | 層1・層3のみ付与してスキップ（ブロックしない） |
| AI タイムアウト（30秒） | 同上 |
| frontmatter が壊れている | layers 1・3 のみ付与（frontmatter 修正はしない） |
| `--skip-citation` フラグ | 全処理をスキップ |
| 既に `## 参考情報` セクションが存在する | 末尾セクションの重複追加をしない |

---

## スコープ外

- DOI・学術論文データベースとの連携
- URL の有効性チェック（リンク切れ確認）
- 引用フォーマットの標準化（APA・MLA 等）

---

## 変更履歴

| 日付 | バージョン | 変更内容 |
|------|-----------|---------|
| 2026-06-14 | v1 | 初版作成（frontmatter sources / AI インライン引用 / 末尾セクション の三層実装） |
