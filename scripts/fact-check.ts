import 'dotenv/config';
import * as fs from 'fs';
import * as path from 'path';
import OpenAI from 'openai';
import type { GeneratedHistory, FactRiskLevel, FactFlag } from '../types/index';

const ROOT = path.join(__dirname, '..');
const AI_TIMEOUT_MS = 30000;

interface RuleResult {
  level: FactRiskLevel;
  flags: FactFlag[];
}

interface AiFactResult {
  riskLevel: FactRiskLevel;
  flags: string[];
  summary: string;
}

function parseArgs(): { filePath: string | null; skipFact: boolean } {
  const args = process.argv.slice(2);
  const fileArg = args.find(a => a.startsWith('--file='));
  return {
    filePath: fileArg ? fileArg.split('=').slice(1).join('=') : null,
    skipFact: args.includes('--skip-fact'),
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

function runRuleChecks(body: string): RuleResult {
  const flags: FactFlag[] = [];

  // F3: 数値の極端な誇張（即 High）
  // カフェイン量 1,000mg 超
  const caffeineMatch = body.match(/(\d[\d,]*)\s*mg.*カフェイン|カフェイン.*?(\d[\d,]*)\s*mg/);
  if (caffeineMatch) {
    const val = parseInt((caffeineMatch[1] ?? caffeineMatch[2]).replace(/,/g, ''), 10);
    if (val > 1000) {
      return { level: 'high', flags: ['extreme-value'] };
    }
  }

  // 価格 10万円超（1杯あたりの文脈）
  const priceMatch = body.match(/(\d+)万円/g);
  if (priceMatch) {
    for (const m of priceMatch) {
      const val = parseInt(m.replace('万円', ''), 10);
      if (val >= 10) {
        return { level: 'high', flags: ['extreme-value'] };
      }
    }
  }

  // F1: 抽出温度の異常値
  const tempMatches = [...body.matchAll(/(\d+)\s*℃/g)];
  for (const m of tempMatches) {
    const temp = parseInt(m[1], 10);
    // 抽出温度として不自然な範囲（文脈が曖昧なため Medium のみ）
    if (temp < 70 || temp > 100) {
      flags.push('temp-out-of-range');
      break;
    }
  }

  // F2: 根拠なしの「世界一」「最高」断言
  if (/世界一(美味しい|高品質|人気|有名)|世界最高の(コーヒー|豆|品質)/.test(body)) {
    flags.push('unsupported-superlative');
  }

  return { level: flags.length === 0 ? 'low' : 'medium', flags };
}

async function runAiCheck(body: string): Promise<AiFactResult> {
  const token = process.env.GITHUB_TOKEN;
  if (!token) throw new Error('GITHUB_TOKEN が未設定です');

  const client = new OpenAI({
    baseURL: 'https://models.inference.ai.azure.com',
    apiKey: token,
  });

  const systemPrompt = `あなたはコーヒー業界の専門知識を持つファクトチェッカーです。
以下のコーヒーブログ記事について、事実的な主張の正確性を評価してください。

評価観点:
- 産地・品種・農園に関する主張の妥当性
- 抽出方法・温度・時間などの数値の妥当性（エスプレッソは90-96℃、ドリップは85-95℃が標準）
- 企業・ブランドに関する事実（設立年、国籍、規模等）
- 健康効果に関する主張（科学的根拠の有無）

リスクレベル基準:
- low: 事実的な問題なし
- medium: 要確認の主張あり（検証不能だが明確な誤りとは言えない）
- high: 明確な誤り・虚偽の断言（客観的事実と矛盾する）

JSONのみ返却（説明文なし）:
{ "riskLevel": "low|medium|high", "flags": ["flag1", ...], "summary": "日本語の簡潔な評価" }

使用可能フラグ: unverifiable-claim, contradictory-claim, temp-out-of-range, unsupported-superlative, extreme-value`;

  const response = await client.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: body.slice(0, 3000) },
    ],
    response_format: { type: 'json_object' },
  });

  const text = response.choices[0]?.message?.content ?? '{}';
  return JSON.parse(text) as AiFactResult;
}

function updateFrontmatter(
  filePath: string,
  factRisk: FactRiskLevel,
  factFlags: string[],
): void {
  const content = fs.readFileSync(filePath, 'utf-8');
  const now = new Date().toISOString();
  const flagsYaml = factFlags.length > 0
    ? `[${factFlags.map(f => `"${f}"`).join(', ')}]`
    : '[]';

  const factLines = `factRisk: "${factRisk}"\nfactFlags: ${flagsYaml}\nfactCheckedAt: "${now}"`;

  const cleaned = content
    .replace(/^factRisk:.*\n/m, '')
    .replace(/^factFlags:.*\n/m, '')
    .replace(/^factCheckedAt:.*\n/m, '');

  const updated = cleaned.replace(/^(---\n[\s\S]*?)(---)/m, `$1${factLines}\n$2`);
  fs.writeFileSync(filePath, updated, 'utf-8');
}

async function main(): Promise<void> {
  const { filePath: argFilePath, skipFact } = parseArgs();

  const filePath = argFilePath
    ? path.resolve(ROOT, argFilePath)
    : findLatestUnpostedFile();

  if (!filePath) {
    console.error('[fact-check] 対象ファイルが見つかりません。');
    process.exit(1);
  }

  if (!fs.existsSync(filePath)) {
    console.error(`[fact-check] ファイルが見つかりません: ${filePath}`);
    process.exit(1);
  }

  const basename = path.basename(filePath);

  if (skipFact) {
    console.log(`[fact-check] --skip-fact: チェックをスキップしました (${basename})`);
    return;
  }

  const content = fs.readFileSync(filePath, 'utf-8');
  const body = content.replace(/^---\n[\s\S]*?\n---\n?/, '');
  const strategy = parseFrontmatterValue(content, 'strategy');

  if (!strategy) {
    console.warn(`[fact-check] ⚠ frontmatter を解析できません — スキップ (${basename})`);
    return;
  }

  // 一次評価（ルールベース）
  const ruleResult = runRuleChecks(body);

  let finalLevel: FactRiskLevel = ruleResult.level;
  let finalFlags: string[] = ruleResult.flags;

  // 二次評価（AI）: medium 以上のみ実行
  if (ruleResult.level !== 'low') {
    try {
      console.log('[fact-check] AI 二次評価中...');
      const aiResult = await Promise.race([
        runAiCheck(body),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('timeout')), AI_TIMEOUT_MS)
        ),
      ]);
      finalLevel = aiResult.riskLevel as FactRiskLevel;
      finalFlags = aiResult.flags;
      if (aiResult.summary) console.log(`[fact-check] AI 評価: ${aiResult.summary}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[fact-check] AI 二次評価失敗（一次結果を採用）: ${msg}`);
    }
  }

  updateFrontmatter(filePath, finalLevel, finalFlags);

  const flagStr = finalFlags.length > 0 ? ` [${finalFlags.join(', ')}]` : '';

  if (finalLevel === 'low') {
    console.log(`[fact-check] ✓ low  — ${basename}`);
  } else if (finalLevel === 'medium') {
    console.warn(`[fact-check] ⚠ medium${flagStr} — ${basename}`);
  } else {
    console.error(`[fact-check] ✗ high${flagStr} — 投稿をブロックしました`);
    process.exit(1);
  }
}

main().catch(err => {
  console.error('[fact-check]', err);
  process.exit(1);
});
