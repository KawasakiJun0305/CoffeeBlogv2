# 仕様: データスキーマ

> 関連ファイル: `types/index.ts`, `data/*.json`

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

---

## 生成記事 Markdown — v1 (2026-06-14)

```markdown
---
title: 記事タイトル（30文字以内推奨）
date: YYYY-MM-DD
category: beans | brewing | cafe | equipment | culture
strategy: topics | matrix | news
---

記事本文...
```

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
