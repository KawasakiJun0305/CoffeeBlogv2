import 'dotenv/config';
import * as fs from 'fs';
import * as path from 'path';
import type { GeneratedHistory, FormatIssue } from '../types/index';

const ROOT = path.join(__dirname, '..');

const BODY_MIN_CHARS = 800;
const BODY_MAX_CHARS = 3000;
const TITLE_MAX_CHARS = 50;
const LIST_CONSECUTIVE_MAX = 10;

function parseArgs(): { filePath: string | null; skipFormat: boolean } {
  const args = process.argv.slice(2);
  const fileArg = args.find(a => a.startsWith('--file='));
  return {
    filePath: fileArg ? fileArg.split('=').slice(1).join('=') : null,
    skipFormat: args.includes('--skip-format'),
  };
}

function findLatestUnpostedFile(): string | null {
  const generatedPath = path.join(ROOT, 'data', 'generated.json');
  if (!fs.existsSync(generatedPath)) return null;

  const data: GeneratedHistory = JSON.parse(fs.readFileSync(generatedPath, 'utf-8'));
  const unposted = data.generated
    .filter(e => e.noteUrl === null && e.file);

  return unposted.length === 0 ? null : path.join(ROOT, unposted[unposted.length - 1].file);
}

function parseFrontmatterAndBody(content: string): { fm: string; body: string } | null {
  const match = content.match(/^(---\n[\s\S]*?\n---\n?)([\s\S]*)$/);
  if (!match) return null;
  return { fm: match[1], body: match[2] };
}

function parseFrontmatterValue(fm: string, key: string): string | null {
  const line = fm.split('\n').find(l => l.startsWith(key + ':'));
  if (!line) return null;
  return line.replace(new RegExp(`^${key}:\\s*`), '').replace(/^["']|["']$/g, '').trim();
}

function stripImageCredit(body: string): string {
  // Unsplash クレジット行（*Photo by ... on Unsplash*）を除去してから文字数を計測
  return body.replace(/^\*Photo by .*\*\n?/m, '');
}

function runFormatChecks(content: string): FormatIssue[] {
  const issues: FormatIssue[] = [];
  const parsed = parseFrontmatterAndBody(content);

  if (!parsed) {
    // frontmatter が壊れている場合は本文全体を対象に最低限チェック
    return issues;
  }

  const { fm, body } = parsed;
  const strippedBody = stripImageCredit(body);

  // P3: タイトルチェック
  const title = parseFrontmatterValue(fm, 'title');
  if (!title) {
    issues.push('no-title');
  } else if (title.length > TITLE_MAX_CHARS) {
    issues.push('title-too-long');
  }

  // P1: 本文文字数
  const bodyLen = strippedBody.replace(/\s/g, '').length;
  if (bodyLen < BODY_MIN_CHARS) {
    issues.push('too-short');
  } else if (bodyLen > BODY_MAX_CHARS) {
    issues.push('too-long');
  }

  // P2: 見出し構造
  if (!/^## /m.test(body)) {
    issues.push('no-heading');
  }
  if (/^# /m.test(body)) {
    issues.push('h1-in-body');
  }

  // P4: 過剰なリスト（連続する箇条書き10行超）
  if (/(\n[-*] .+){10,}/.test(body)) {
    issues.push('excessive-list');
  }

  // P5: 空の見出しセクション（## の直後が別の ## or EOF）
  if (/^## .*\n\n## /m.test(body) || /^## .*\n## /m.test(body)) {
    issues.push('empty-section');
  }

  return issues;
}

function updateFrontmatter(filePath: string, issues: FormatIssue[]): void {
  const content = fs.readFileSync(filePath, 'utf-8');
  const now = new Date().toISOString();
  const issuesYaml = issues.length > 0
    ? `[${issues.map(i => `"${i}"`).join(', ')}]`
    : '[]';

  const formatLines = `formatIssues: ${issuesYaml}\nformatCheckedAt: "${now}"`;

  const cleaned = content
    .replace(/^formatIssues:.*\n/m, '')
    .replace(/^formatCheckedAt:.*\n/m, '');

  const updated = cleaned.replace(/^(---\n[\s\S]*?)(---)/m, `$1${formatLines}\n$2`);
  fs.writeFileSync(filePath, updated, 'utf-8');
}

function main(): void {
  const { filePath: argFilePath, skipFormat } = parseArgs();

  const filePath = argFilePath
    ? path.resolve(ROOT, argFilePath)
    : findLatestUnpostedFile();

  if (!filePath) {
    console.error('[format-check] 対象ファイルが見つかりません。');
    process.exit(1);
  }

  if (!fs.existsSync(filePath)) {
    console.error(`[format-check] ファイルが見つかりません: ${filePath}`);
    process.exit(1);
  }

  const basename = path.basename(filePath);

  if (skipFormat) {
    console.log(`[format-check] --skip-format: チェックをスキップしました (${basename})`);
    return;
  }

  const content = fs.readFileSync(filePath, 'utf-8');
  const parsed = parseFrontmatterAndBody(content);

  if (!parsed) {
    console.warn(`[format-check] ⚠ frontmatter を解析できません — スキップ (${basename})`);
    return;
  }

  const issues = runFormatChecks(content);
  updateFrontmatter(filePath, issues);

  const strippedBody = stripImageCredit(parsed.body);
  const bodyLen = strippedBody.replace(/\s/g, '').length;

  if (issues.length === 0) {
    console.log(`[format-check] ✓ 問題なし — ${basename}（${bodyLen}字）`);
  } else {
    const issueStr = issues.join(', ');
    console.warn(`[format-check] ⚠ ${issues.length}件の体裁問題 [${issueStr}] — ${basename}（${bodyLen}字）`);
  }
}

main();
