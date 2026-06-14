# topic-stats — トピック統計を表示する

## このスキルの目的

`data/topics.json` の現在のトピック構成を集計し、カテゴリ別件数・合計・薄いカテゴリを報告する。トピック補充計画の立案に使う。

## 手順

1. **データ読み込み**: `data/topics.json` を Read する

2. **集計**: カテゴリ別件数・合計件数を計算する
   - Bash で `node -e` を使って集計してよい:
     ```bash
     node -e "const d=require('./data/topics.json'); const cats={}; d.topics.forEach(t=>{ cats[t.category]=(cats[t.category]||0)+1; }); console.log('total:', d.topics.length); Object.entries(cats).sort((a,b)=>b[1]-a[1]).forEach(([k,v])=>console.log(' ',k,':',v));"
     ```

3. **結果を整形して報告**: 以下の形式で出力する
   - カテゴリ別件数テーブル（件数降順）
   - 合計件数
   - 件数が少ない（10件未満の）カテゴリを「要補充」として強調
   - 直近コミットで追加されたトピック数（任意、git log から確認）

4. **仕様との差分チェック**: `docs/spec/05-data.md` の「現在のトピック数」テーブルと実データが一致しているか確認し、ズレがあれば指摘する

## 出力イメージ

```
## トピック統計（data/topics.json）

| カテゴリ     | 件数 | 状態   |
|------------|------|--------|
| beans      |  63  |        |
| industry   |  54  |        |
| culture    |  41  |        |
| equipment  |  36  |        |
| flavor     |  24  |        |
| brewing    |   6  | 要補充 |
| cafe       |   3  | 要補充 |
| **合計**   | **227** |     |

要補充カテゴリ: brewing (6件), cafe (3件)
```
