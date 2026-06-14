import 'dotenv/config';
import * as fs from 'fs';
import * as path from 'path';
import OpenAI from 'openai';

const ROOT = path.join(__dirname, '..');
const OUTPUT_DIR = path.join(ROOT, 'output');
const DEFAULT_N = 5;

interface ScoreResult {
  titleHook: number;
  originality: number;
  concreteness: number;
  readerFit: number;
  total: number;
  suggestions: string[];
}

function parseArgs(): { n: number } {
  const args = process.argv.slice(2);
  const nArg = args.find(a => a.startsWith('--n='));
  const n = nArg ? parseInt(nArg.split('=')[1], 10) : DEFAULT_N;
  return { n: isNaN(n) || n < 1 ? DEFAULT_N : n };
}

function getLatestMarkdownFiles(n: number): string[] {
  if (!fs.existsSync(OUTPUT_DIR)) return [];

  const files = fs.readdirSync(OUTPUT_DIR)
    .filter(f => f.endsWith('.md'))
    .map(f => ({
      name: f,
      mtime: fs.statSync(path.join(OUTPUT_DIR, f)).mtimeMs,
    }))
    .sort((a, b) => b.mtime - a.mtime)
    .slice(0, n)
    .map(f => path.join(OUTPUT_DIR, f.name));

  return files;
}

const SCORING_SYSTEM = `あなたはコーヒーブログ記事の品質評価者です。
記事を以下の4軸で評価し、必ずJSON形式のみで返してください（マークダウンや説明文は不要）。

評価軸（各25点満点、合計100点）:
- titleHook: タイトルのクリック誘引性（読者が思わず読みたくなるか）
- originality: オリジナリティ・独自性（他にない切り口か）
- concreteness: 具体性（数値・地名・固有名詞が豊富か）
- readerFit: 読者適合度（20〜40代コーヒー初中級者に適しているか）

出力フォーマット（このJSONのみ返すこと）:
{
  "titleHook": <0-25の整数>,
  "originality": <0-25の整数>,
  "concreteness": <0-25の整数>,
  "readerFit": <0-25の整数>,
  "suggestions": ["改善提案1", "改善提案2"]
}`;

async function scoreArticle(
  client: OpenAI,
  filepath: string
): Promise<ScoreResult | null> {
  const content = fs.readFileSync(filepath, 'utf-8');

  try {
    const response = await client.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: SCORING_SYSTEM },
        { role: 'user', content: content },
      ],
      response_format: { type: 'json_object' },
    });

    const raw = response.choices[0].message.content ?? '{}';
    const parsed = JSON.parse(raw);

    const titleHook = Math.max(0, Math.min(25, Number(parsed.titleHook) || 0));
    const originality = Math.max(0, Math.min(25, Number(parsed.originality) || 0));
    const concreteness = Math.max(0, Math.min(25, Number(parsed.concreteness) || 0));
    const readerFit = Math.max(0, Math.min(25, Number(parsed.readerFit) || 0));
    const suggestions: string[] = Array.isArray(parsed.suggestions)
      ? parsed.suggestions.map(String)
      : [];

    return {
      titleHook,
      originality,
      concreteness,
      readerFit,
      total: titleHook + originality + concreteness + readerFit,
      suggestions,
    };
  } catch (err) {
    console.error(`  スコアリングエラー: ${(err as Error).message}`);
    return null;
  }
}

function printResult(filename: string, score: ScoreResult): void {
  const pass = score.total >= 60;
  const badge = pass ? '✅ 合格' : '❌ 要改善';

  console.log(`\n${'─'.repeat(60)}`);
  console.log(`📄 ${filename}`);
  console.log(`${'─'.repeat(60)}`);
  console.log(`  タイトル誘引性  : ${score.titleHook.toString().padStart(2)} / 25`);
  console.log(`  オリジナリティ  : ${score.originality.toString().padStart(2)} / 25`);
  console.log(`  具体性          : ${score.concreteness.toString().padStart(2)} / 25`);
  console.log(`  読者適合度      : ${score.readerFit.toString().padStart(2)} / 25`);
  console.log(`  ─────────────────────`);
  console.log(`  総合スコア      : ${score.total.toString().padStart(2)} / 100  ${badge}`);
  if (score.suggestions.length > 0) {
    console.log(`  改善提案:`);
    score.suggestions.forEach(s => console.log(`    • ${s}`));
  }
}

async function main(): Promise<void> {
  const { n } = parseArgs();
  const files = getLatestMarkdownFiles(n);

  if (files.length === 0) {
    console.log('評価対象の記事がありません。先に generate.ts を実行してください。');
    return;
  }

  if (!process.env.GITHUB_TOKEN) {
    console.error('エラー: GITHUB_TOKEN 環境変数が設定されていません。');
    process.exit(1);
  }

  const client = new OpenAI({
    baseURL: 'https://models.inference.ai.azure.com',
    apiKey: process.env.GITHUB_TOKEN,
  });

  console.log(`[rank-articles] 最新 ${files.length} 件を評価中...\n`);

  const results: Array<{ filename: string; score: ScoreResult }> = [];

  for (const filepath of files) {
    const filename = path.basename(filepath);
    process.stdout.write(`  評価中: ${filename} ... `);
    const score = await scoreArticle(client, filepath);
    if (score) {
      process.stdout.write(`${score.total}点\n`);
      results.push({ filename, score });
    } else {
      process.stdout.write('スキップ\n');
    }
  }

  results.forEach(({ filename, score }) => printResult(filename, score));

  if (results.length > 0) {
    const avg = Math.round(results.reduce((s, r) => s + r.score.total, 0) / results.length);
    const passed = results.filter(r => r.score.total >= 60).length;
    console.log(`\n${'═'.repeat(60)}`);
    console.log(`📊 サマリー: ${results.length}件評価 / 平均${avg}点 / 合格${passed}件`);
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
