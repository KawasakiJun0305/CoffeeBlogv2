import 'dotenv/config';
import * as fs from 'fs';
import * as path from 'path';
import OpenAI from 'openai';
import type { GeneratedHistory, LegalRiskLevel, LegalFlag } from '../types/index';

const ROOT = path.join(__dirname, '..');

interface RuleResult {
  level: LegalRiskLevel;
  flags: LegalFlag[];
}

interface AiCheckResult {
  riskLevel: LegalRiskLevel;
  flags: string[];
  summary: string;
}

function parseArgs(): { filePath: string | null; skipLegal: boolean } {
  const args = process.argv.slice(2);
  const fileArg = args.find(a => a.startsWith('--file='));
  return {
    filePath: fileArg ? fileArg.split('=').slice(1).join('=') : null,
    skipLegal: args.includes('--skip-legal'),
  };
}

function findLatestUnpostedFile(): string | null {
  const generatedPath = path.join(ROOT, 'data', 'generated.json');
  if (!fs.existsSync(generatedPath)) return null;

  const data: GeneratedHistory = JSON.parse(fs.readFileSync(generatedPath, 'utf-8'));
  const unposted = data.generated
    .filter(e => e.noteUrl === null && e.file);

  if (unposted.length === 0) return null;
  return path.join(ROOT, unposted[unposted.length - 1].file);
}

function parseFrontmatterValue(content: string, key: string): string | null {
  const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
  if (!fmMatch) return null;
  const line = fmMatch[1].split('\n').find(l => l.startsWith(key + ':'));
  if (!line) return null;
  return line.replace(new RegExp(`^${key}:\\s*`), '').replace(/^["']|["']$/g, '').trim();
}

function runRuleChecks(content: string, strategy: string | null): RuleResult {
  const body = content.replace(/^---\n[\s\S]*?\n---\n?/, '');
  const flags: LegalFlag[] = [];

  // R4: 法的断定（即 High）
  if (/という判決|という判断|が訴訟|は違法|は犯罪|に違反する/.test(body)) {
    return { level: 'high', flags: ['legal-assertion'] };
  }

  // R1: 医療・健康断言
  if (/に効く|を予防する|を治す|医学的に証明|科学的に証明|がん予防|血圧を下げる|ダイエット効果がある/.test(body)) {
    flags.push('health-claim');
  }

  // R2: 企業批判（industry-matrix のみ）
  if (strategy === 'industry-matrix') {
    if (/倒産|不祥事|詐欺|違法|訴訟|炎上|問題|危険|欠陥/.test(body)) {
      flags.push('company-negative');
    }
  }

  // R3: 過剰引用（鉤括弧テキストが本文の 30% 超）
  const quoteMatches = body.match(/「[^」]{10,}」|"[^"]{10,}"/g) ?? [];
  const quoteLen = quoteMatches.reduce((s, m) => s + m.length, 0);
  if (body.length > 0 && quoteLen / body.length > 0.3) {
    flags.push('overquote');
  }

  return { level: flags.length === 0 ? 'low' : 'medium', flags };
}

async function runAiCheck(content: string): Promise<AiCheckResult> {
  const token = process.env.GITHUB_TOKEN;
  if (!token) throw new Error('GITHUB_TOKEN が未設定です');

  const client = new OpenAI({
    baseURL: 'https://models.inference.ai.azure.com',
    apiKey: token,
  });

  const systemPrompt = `あなたは日本の著作権法・不法行為法を踏まえたコンテンツリスク評価AIです。
以下のコーヒーブログ記事について次の観点でリスクを評価してください。
- 著作権侵害の可能性（引用の適正性）
- 名誉毀損・信用毀損の可能性（実在企業・人物への否定的な言及）
- 医療・法律の断定的表現による誤情報リスク

リスクレベル基準:
- low: 問題なし
- medium: 軽微な懸念（誤解を与えうる表現だが法的リスクは低い）
- high: 重大な懸念（名誉毀損・断定的医療情報・過剰引用など）

JSONのみ返却（説明文なし）:
{ "riskLevel": "low|medium|high", "flags": ["flag1", ...], "summary": "日本語の簡潔な評価" }`;

  const body = content.replace(/^---\n[\s\S]*?\n---\n?/, '').slice(0, 3000);

  const response = await client.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: body },
    ],
    response_format: { type: 'json_object' },
  });

  const text = response.choices[0]?.message?.content ?? '{}';
  return JSON.parse(text) as AiCheckResult;
}

function updateFrontmatter(
  filePath: string,
  legalRisk: LegalRiskLevel,
  legalFlags: string[],
): void {
  const content = fs.readFileSync(filePath, 'utf-8');
  const now = new Date().toISOString();
  const flagsYaml = legalFlags.length > 0
    ? `[${legalFlags.map(f => `"${f}"`).join(', ')}]`
    : '[]';

  const legalLines = `legalRisk: "${legalRisk}"\nlegalFlags: ${flagsYaml}\nlegalCheckedAt: "${now}"`;

  // 既存の legal フィールドを除去してから差し込む
  const cleaned = content
    .replace(/^legalRisk:.*\n/m, '')
    .replace(/^legalFlags:.*\n/m, '')
    .replace(/^legalCheckedAt:.*\n/m, '');

  const updated = cleaned.replace(/^(---\n[\s\S]*?)(---)/m, `$1${legalLines}\n$2`);
  fs.writeFileSync(filePath, updated, 'utf-8');
}

async function main(): Promise<void> {
  const { filePath: argFilePath, skipLegal } = parseArgs();

  const filePath = argFilePath
    ? path.resolve(ROOT, argFilePath)
    : findLatestUnpostedFile();

  if (!filePath) {
    console.error('[legal-check] 対象ファイルが見つかりません。');
    process.exit(1);
  }

  if (!fs.existsSync(filePath)) {
    console.error(`[legal-check] ファイルが見つかりません: ${filePath}`);
    process.exit(1);
  }

  const basename = path.basename(filePath);

  if (skipLegal) {
    console.log(`[legal-check] --skip-legal: チェックをスキップしました (${basename})`);
    return;
  }

  const content = fs.readFileSync(filePath, 'utf-8');
  const strategy = parseFrontmatterValue(content, 'strategy');

  // 一次評価（ルールベース）
  const ruleResult = runRuleChecks(content, strategy);

  let finalLevel: LegalRiskLevel = ruleResult.level;
  let finalFlags: string[] = ruleResult.flags;

  // 二次評価（AI）: medium 以上のみ
  if (ruleResult.level !== 'low') {
    try {
      console.log('[legal-check] AI 二次評価中...');
      const aiResult = await Promise.race([
        runAiCheck(content),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('timeout')), 30000)
        ),
      ]);
      finalLevel = aiResult.riskLevel as LegalRiskLevel;
      finalFlags = aiResult.flags;
      if (aiResult.summary) console.log(`[legal-check] AI 評価: ${aiResult.summary}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[legal-check] AI 二次評価失敗（一次結果を採用）: ${msg}`);
    }
  }

  updateFrontmatter(filePath, finalLevel, finalFlags);

  const flagStr = finalFlags.length > 0 ? ` [${finalFlags.join(', ')}]` : '';

  if (finalLevel === 'low') {
    console.log(`[legal-check] ✓ low  — ${basename}`);
  } else if (finalLevel === 'medium') {
    console.warn(`[legal-check] ⚠ medium${flagStr} — ${basename}`);
  } else {
    console.error(`[legal-check] ✗ high${flagStr} — 投稿をブロックしました`);
    process.exit(1);
  }
}

main().catch(err => {
  console.error('[legal-check]', err);
  process.exit(1);
});
