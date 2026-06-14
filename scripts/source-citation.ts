import 'dotenv/config';
import * as fs from 'fs';
import * as path from 'path';
import OpenAI from 'openai';
import type { GeneratedHistory } from '../types/index';

const ROOT = path.join(__dirname, '..');
const AI_TIMEOUT_MS = 30000;

function parseArgs(): { filePath: string | null; skipCitation: boolean } {
  const args = process.argv.slice(2);
  const fileArg = args.find(a => a.startsWith('--file='));
  return {
    filePath: fileArg ? fileArg.split('=').slice(1).join('=') : null,
    skipCitation: args.includes('--skip-citation'),
  };
}

function findLatestUnpostedFile(): string | null {
  const generatedPath = path.join(ROOT, 'data', 'generated.json');
  if (!fs.existsSync(generatedPath)) return null;

  const data: GeneratedHistory = JSON.parse(fs.readFileSync(generatedPath, 'utf-8'));
  const unposted = data.generated
    .filter(e => e.noteUrl === null && e.file)
    .sort((a, b) => b.date.localeCompare(a.date));

  return unposted.length === 0 ? null : path.join(ROOT, unposted[0].file);
}

function parseFrontmatterValue(content: string, key: string): string | null {
  const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
  if (!fmMatch) return null;
  const line = fmMatch[1].split('\n').find(l => l.startsWith(key + ':'));
  if (!line) return null;
  return line.replace(new RegExp(`^${key}:\\s*`), '').replace(/^["']|["']$/g, '').trim();
}

function getNewsSourceUrls(filePath: string): string[] {
  const generatedPath = path.join(ROOT, 'data', 'generated.json');
  if (!fs.existsSync(generatedPath)) return [];

  const data: GeneratedHistory = JSON.parse(fs.readFileSync(generatedPath, 'utf-8'));
  const basename = path.basename(filePath);
  const entry = data.generated.find(e => e.file && path.basename(e.file) === basename);

  if (!entry || entry.strategy !== 'news') return [];

  // sourceUrls は news エントリに将来追加される拡張フィールド
  const extended = entry as unknown as Record<string, unknown>;
  if (Array.isArray(extended['sourceUrls'])) {
    return extended['sourceUrls'] as string[];
  }
  return [];
}

function buildSources(strategy: string | null, newsUrls: string[]): string[] {
  const sources: string[] = [];
  if (strategy === 'news' && newsUrls.length > 0) {
    sources.push(...newsUrls);
  }
  sources.push('AI生成（GitHub Models / GPT-4o）');
  return sources;
}

function updateFrontmatter(filePath: string, sources: string[]): string {
  let content = fs.readFileSync(filePath, 'utf-8');
  const now = new Date().toISOString();

  // 既存の source フィールドを除去
  content = content
    .replace(/^sourceAddedAt:.*\n/m, '')
    .replace(/^sources:\n(  - .*\n)*/m, '');

  const sourcesYaml = sources.map(s => `  - "${s}"`).join('\n');
  const newFields = `sources:\n${sourcesYaml}\nsourceAddedAt: "${now}"`;

  const updated = content.replace(/^(---\n[\s\S]*?)(---)/m, `$1${newFields}\n$2`);
  fs.writeFileSync(filePath, updated, 'utf-8');
  return updated;
}

async function addInlineCitations(body: string): Promise<{ text: string; count: number }> {
  const token = process.env.GITHUB_TOKEN;
  if (!token) throw new Error('GITHUB_TOKEN が未設定です');

  const client = new OpenAI({
    baseURL: 'https://models.inference.ai.azure.com',
    apiKey: token,
  });

  const systemPrompt = `あなたはコーヒーブログ記事の編集者です。
以下の記事本文中で、具体的な数値・統計・特定の事実主張の直後に出典注（括弧書き）を最大5か所追加してください。

ルール:
- 出典が公知の事実なら「（一般的に知られる情報）」と記載
- 出典が業界団体なら「（ICO, SCAJ 等の公開データより）」と記載
- 企業の設立年・売上など公開情報なら「（公式情報より）」と記載
- 追加は最大5か所まで。過剰に追加しない
- frontmatter（---で囲まれた部分）と画像クレジット行（*Photo by...）は変更しない
- 本文のみ修正した完全な Markdown テキストを返す（説明文なし）`;

  const response = await client.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: body },
    ],
  });

  const result = response.choices[0]?.message?.content ?? body;
  const addedCount = (result.match(/（[^）]{3,60}）/g) ?? []).length;
  return { text: result, count: addedCount };
}

function hasReferencesSection(content: string): boolean {
  return /^## 参考情報/m.test(content);
}

function buildReferencesSection(strategy: string | null, newsUrls: string[]): string {
  const lines = [
    '',
    '---',
    '',
    '## 参考情報',
    '',
    '- 本記事はAI（GitHub Models / GPT-4o）を使用して生成されました。',
    '- 記載の数値・統計は公開情報をもとにしており、最新情報は各公式ソースをご確認ください。',
  ];

  if (strategy === 'news' && newsUrls.length > 0) {
    for (const url of newsUrls) {
      lines.push(`- 参考情報: ${url}`);
    }
  }

  return lines.join('\n');
}

function applyInlineCitationsToFile(filePath: string, citedBody: string): void {
  const content = fs.readFileSync(filePath, 'utf-8');
  const fmMatch = content.match(/^(---\n[\s\S]*?\n---\n?)/);
  if (!fmMatch) {
    fs.writeFileSync(filePath, citedBody, 'utf-8');
    return;
  }
  const fm = fmMatch[1];
  const updated = fm + citedBody;
  fs.writeFileSync(filePath, updated, 'utf-8');
}

async function main(): Promise<void> {
  const { filePath: argFilePath, skipCitation } = parseArgs();

  const filePath = argFilePath
    ? path.resolve(ROOT, argFilePath)
    : findLatestUnpostedFile();

  if (!filePath) {
    console.error('[source-citation] 対象ファイルが見つかりません。');
    process.exit(1);
  }

  if (!fs.existsSync(filePath)) {
    console.error(`[source-citation] ファイルが見つかりません: ${filePath}`);
    process.exit(1);
  }

  const basename = path.basename(filePath);

  if (skipCitation) {
    console.log(`[source-citation] --skip-citation: スキップしました (${basename})`);
    return;
  }

  const content = fs.readFileSync(filePath, 'utf-8');
  const strategy = parseFrontmatterValue(content, 'strategy');
  const newsUrls = getNewsSourceUrls(filePath);
  const sources = buildSources(strategy, newsUrls);

  // 層1: frontmatter に sources を書き込む
  updateFrontmatter(filePath, sources);

  // 層2: AI によるインライン引用挿入
  const fmMatch = content.match(/^(---\n[\s\S]*?\n---\n?)([\s\S]*)/);
  const bodyOnly = fmMatch ? fmMatch[2] : content;
  let inlineCount = 0;

  try {
    const result = await Promise.race([
      addInlineCitations(bodyOnly),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('timeout')), AI_TIMEOUT_MS)
      ),
    ]);
    applyInlineCitationsToFile(filePath, result.text);
    inlineCount = result.count;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[source-citation] ⚠ AI インライン引用スキップ（${msg}） — frontmatter と末尾セクションのみ付与`);
  }

  // 層3: 記事末尾に「参考情報」セクションを追加
  const currentContent = fs.readFileSync(filePath, 'utf-8');
  if (!hasReferencesSection(currentContent)) {
    const refSection = buildReferencesSection(strategy, newsUrls);
    fs.writeFileSync(filePath, currentContent.trimEnd() + '\n' + refSection + '\n', 'utf-8');
  }

  const countMsg = inlineCount > 0 ? `（インライン${inlineCount}か所追加）` : '';
  console.log(`[source-citation] ✓ ソース付与完了 — ${basename}${countMsg}`);
}

main().catch(err => {
  console.error('[source-citation]', err);
  process.exit(1);
});
