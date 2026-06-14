# 仕様: データスキーマ

> 関連ファイル: `types/index.ts`, `data/*.json`

---

## topics.json — v1 (2026-06-14)

Topics 戦略で使用するトピック一覧。記事生成時にランダム選択される。手動追加可能。

```json
{
  "topics": [
    { "topic": "エチオピア イルガチェフェ", "category": "beans" }
  ]
}
```

**フィールド定義**

| フィールド | 型 | 説明 |
|-----------|-----|------|
| `topic` | `string` | 記事テーマの日本語トピック名 |
| `category` | `Category` | カテゴリ識別子（`types/index.ts` の `Category` 型参照） |

**現在のトピック数（2026-06-14時点）**

| カテゴリ | 件数 | 備考 |
|---------|------|------|
| `beans` | 63 | 産地・品種・グレード別に体系化（8件→63件に充実） |
| `industry` | 54 | 企業・流通・認証制度・ロースタービジネス |
| `culture` | 41 | 歴史・ムーブメント・偉人（偉人トピック35件追加） |
| `equipment` | 36 | グラインダー・ケトル・ドリッパー等（3件→36件に充実） |
| `flavor` | 24 | テイスト・カッピング・フレーバー評価 |
| `brewing` | 6 | 抽出・レシピ |
| `cafe` | 3 | カフェ情報 |
| **合計** | **227** | |

**トピック追加ルール**

- `category` は `types/index.ts` の `Category` 型の値のみ使用可（現在 7 種）
- トピック名は記事タイトルのテーマとして自然な日本語で記述
- 重複チェックは `scripts/strategies/topics.ts` が `generated.json` を参照して自動実施
- 追加時は上記件数テーブルと変更履歴を更新すること

---

## topics-industry-matrix.json — v1 (2026-06-14)

Industry Matrix 戦略で使用するマスタデータ。企業・ブランド × ビジネス切り口の直積でトピックを動的生成する。トピック文字列は `{company}の{angle}` テンプレートで構築される。

```json
{
  "companies": ["スターバックス", "ブルーボトルコーヒー"],
  "angles": ["ビジネスモデルと収益構造", "成長戦略と市場展開"]
}
```

**フィールド定義**

| フィールド | 型 | 説明 |
|-----------|-----|------|
| `companies` | `string[]` | 企業・ブランド名の一覧 |
| `angles` | `string[]` | ビジネス切り口の一覧 |

**組み合わせ数**: `companies.length × angles.length`（初期: 19社 × 10切り口 = 190件）

**マスタ追加ルール**
- 企業・ブランドは一意の表記で統一する（例: `Hario（ハリオ）` で固定）
- 切り口は `{company}の{angle}` として自然な日本語になるよう体言止めで記述
- 追加時は上記組み合わせ数を更新すること

---

## generated.json — v1 (2026-06-14)

生成済み記事の履歴ファイル。重複排除に使用する。手動編集不要。

```json
{
  "generated": [
    {
      "topic": "エチオピア イルガチェフェ",
      "category": "豆・産地",
      "strategy": "topics",
      "date": "2026-06-14",
      "file": "output/2026-06-14-エチオピア-イルガチェフェ.md",
      "noteUrl": "https://note.com/xxx/n/xxx"
    },
    {
      "bean": "ケニア AA",
      "method": "フレンチプレス",
      "angle": "プロのコツを自宅で再現",
      "strategy": "matrix",
      "date": "2026-06-14",
      "file": "output/2026-06-14-matrix-ケニア-AA.md",
      "noteUrl": null
    }
  ]
}
```

**フィールド定義**

| フィールド | 型 | 説明 |
|-----------|-----|------|
| `strategy` | `"topics" \| "matrix" \| "news"` | 使用した生成戦略 |
| `date` | `YYYY-MM-DD` | 生成日 |
| `file` | `string` | `output/` からの相対パス |
| `noteUrl` | `string \| null` | note.com 投稿後に設定。未投稿は `null` |
| `topic` | `string` | topics 戦略のみ |
| `category` | `string` | topics 戦略のみ |
| `bean` / `method` / `angle` | `string` | matrix 戦略のみ |
| `company` / `angle` / `topic` | `string` | industry-matrix 戦略のみ。`topic` は `{company}の{angle}` |

---

## 生成記事 Markdown — v2 (2026-06-14)

```markdown
---
title: 記事タイトル（30文字以内推奨）
date: YYYY-MM-DD
category: beans | brewing | cafe | equipment | culture
strategy: topics | matrix | news
imageUrl: https://images.unsplash.com/photo-xxx  # 任意。UNSPLASH_ACCESS_KEY 未設定時は省略
imageCredit: "Photo by John Doe on Unsplash"      # imageUrl が存在する場合のみ付与
---

![コーヒー](https://images.unsplash.com/photo-xxx)
*Photo by [John Doe](https://unsplash.com/@johndoe?utm_source=CoffeeBlog&utm_medium=referral) on [Unsplash](https://unsplash.com/?utm_source=CoffeeBlog&utm_medium=referral)*

記事本文...
```

**注意:** `imageUrl` が存在しない場合（API キー未設定 / 取得失敗）は、frontmatter の `imageUrl` / `imageCredit` フィールドおよび本文冒頭の画像ブロックは省略される。

**category 値と日本語カテゴリの対応**

| 値 | 日本語 | スコープ |
|----|-------|---------|
| `beans` | 豆・産地 | 産地・品種・グレード・スペシャルティ認定 |
| `brewing` | 抽出・レシピ | 淹れ方・抽出レシピ・バリスタ技術 |
| `cafe` | カフェ情報 | 店舗・カフェめぐり |
| `equipment` | 道具・機器 | グラインダー・ドリッパー・マシン等 |
| `culture` | コーヒー文化 | 歴史・ムーブメント・精製技術（プロセス視点） |
| `flavor` | テイスト・フレーバー | 感覚体験・味の科学・テイスティング・カッピング評価 |
| `industry` | 業界・企業・流通 | コーヒー企業・チェーン・ロースター経営・サプライチェーン・フェアトレード・機器メーカーブランド・小売市場・認証制度 |

---

## 変更履歴

| 日付 | バージョン | 変更内容 |
|------|-----------|---------|
| 2026-06-14 | v1 | 初版作成 |
| 2026-06-14 | v2 | `flavor` カテゴリ追加（テイスト・フレーバー・カッピング） |
| 2026-06-14 | v3 | `industry` カテゴリ追加（企業・サプライチェーン・メーカー・小売り・認証）。`Category` 型に `flavor` と `industry` を反映。 |
| 2026-06-14 | v4 | 生成記事 Markdown に `imageUrl` / `imageCredit` frontmatter フィールドと本文冒頭画像ブロックを追加（Unsplash 対応） |
| 2026-06-14 | v5 | `topics.json` セクション追加。beans 63件・culture 41件（偉人35件含む）・equipment 36件・industry 54件・flavor 24件 で合計 227件に充実。 |
| 2026-06-14 | v6 | `topics-industry-matrix.json` セクション追加（19社×10切り口=190件の動的生成）。`generated.json` に `industry-matrix` エントリ定義追加。 |
