import type { ProjectStatus } from "../types/pm";

const status: ProjectStatus = {
  project: "CoffeeBlogv2",
  description: "AI 駆動コーヒーブログ記事生成パイプライン（仕様駆動開発）",
  goal: "3戦略での記事生成が安定稼働し、note.com への下書き投稿が動作し、仕様が明文化されメンテナンス可能な状態",
  updated: "2026-06-14",

  phases: [
    {
      id: "p0",
      name: "プロジェクト基盤",
      status: "done",
      target_date: "2026-06-14",
      tasks: [
        { id: "p0-1", name: "SPEC.md 作成（ヒアリング・仕様定義）", status: "done" },
        { id: "p0-2", name: "docs/spec/ への機能別分割", status: "done" },
        { id: "p0-3", name: "CLAUDE.md 作成（仕様優先ルール）", status: "done" },
        { id: "p0-4", name: "Claude フック・git フック設定", status: "done" },
        { id: "p0-5", name: "git init・GitHub リポジトリ作成・接続", status: "done" },
        { id: "p0-6", name: "PM as Code セットアップ", status: "done" },
      ],
    },
    {
      id: "p1",
      name: "環境構築",
      status: "todo",
      target_date: "2026-06-21",
      tasks: [
        { id: "p1-1", name: "package.json / tsconfig.json 作成", status: "done" },  // ✓ 2026-06-14
        { id: "p1-2", name: "types/index.ts（ドメイン型定義）作成", status: "todo" },
        { id: "p1-3", name: "prompts/coffee-article.md（プロンプトテンプレート）作成", status: "todo" },
        { id: "p1-4", name: "data/topics.json・topics-matrix.json・generated.json 作成", status: "todo" },
        { id: "p1-5", name: ".env.example 作成", status: "todo" },
      ],
    },
    {
      id: "p2",
      name: "記事生成パイプライン実装",
      status: "todo",
      target_date: "2026-06-28",
      tasks: [
        { id: "p2-1", name: "scripts/strategies/topics.ts（Topics 戦略）", status: "todo" },
        { id: "p2-2", name: "scripts/strategies/matrix.ts（Matrix 戦略）", status: "todo" },
        { id: "p2-3", name: "scripts/strategies/news.ts（News 戦略）", status: "todo" },
        { id: "p2-4", name: "scripts/generate.ts（エントリーポイント・auto 戦略）", status: "todo" },
        { id: "p2-5", name: "ドライラン動作確認", status: "todo" },
      ],
      notes: "仕様: docs/spec/01-generate.md",
    },
    {
      id: "p3",
      name: "品質スコアリング実装",
      status: "todo",
      target_date: "2026-07-05",
      tasks: [
        { id: "p3-1", name: "scripts/rank-articles.ts（4軸スコアリング）", status: "todo" },
        { id: "p3-2", name: "スコアリング動作確認（合格基準: 60点以上）", status: "todo" },
      ],
      notes: "仕様: docs/spec/02-scoring.md",
    },
    {
      id: "p4",
      name: "note.com 投稿実装",
      status: "todo",
      target_date: "2026-07-12",
      tasks: [
        { id: "p4-1", name: "scripts/post-to-note.ts（下書き投稿）", status: "todo" },
        { id: "p4-2", name: "NOTE_API_TOKEN 取得（DevTools）・動作確認", status: "todo" },
        { id: "p4-3", name: "scripts/pipeline.ts（生成→投稿 一括実行）", status: "todo" },
      ],
      notes: "仕様: docs/spec/03-note-post.md | トークンは Bearer、手動取得が必要",
    },
    {
      id: "p5",
      name: "GitHub Actions 自動化",
      status: "todo",
      target_date: "2026-07-19",
      tasks: [
        { id: "p5-1", name: ".github/workflows/pipeline.yml 作成", status: "todo" },
        { id: "p5-2", name: "GitHub Secrets に NOTE_API_TOKEN を登録", status: "todo" },
        { id: "p5-3", name: "自動実行テスト（月・水・金 09:00 JST）", status: "todo" },
      ],
      notes: "仕様: docs/spec/04-automation.md",
    },
  ],

  decisions: [
    {
      id: "d1",
      date: "2026-06-14",
      description: "LLM は GitHub Models（GPT-4o）を使用する",
      reason: "前作 CoffeeBlog と同じ構成。GITHUB_TOKEN で認証でき、個人利用で十分な品質",
    },
    {
      id: "d2",
      date: "2026-06-14",
      description: "note.com への投稿は下書きのみ自動化し、公開は手動とする",
      reason: "API が非公開のため不安定。品質確認を兼ねて公開は目視後に手動実施",
    },
    {
      id: "d3",
      date: "2026-06-14",
      description: "SPEC.md を docs/spec/ 以下の5ファイルに分割する",
      reason: "コンテキスト爆発防止。変更対象に対応する仕様ファイルだけを局所的に読み込む設計",
    },
  ],
};

export default status;
