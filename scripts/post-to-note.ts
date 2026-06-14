import 'dotenv/config';
import * as fs from 'fs';
import * as path from 'path';
import type { GeneratedHistory, NotePostResult } from '../types/index';

const ROOT = path.join(__dirname, '..');
const NOTE_API_URL = 'https://note.com/api/v1/text_notes';

function parseArgs(): { filePath: string | null } {
  const args = process.argv.slice(2);
  const fileArg = args.find(a => a.startsWith('--file='));
  return { filePath: fileArg ? fileArg.split('=').slice(1).join('=') : null };
}

function extractTitle(markdown: string): string | null {
  // 1. frontmatter の title:
  const fmMatch = markdown.match(/^---\n([\s\S]*?)\n---/);
  if (fmMatch) {
    const titleLine = fmMatch[1].split('\n').find(l => l.startsWith('title:'));
    if (titleLine) {
      const title = titleLine.replace(/^title:\s*/, '').replace(/^["']|["']$/g, '').trim();
      if (title) return title;
    }
  }

  // 2. Markdown 見出し（# タイトル）
  const h1Match = markdown.match(/^#\s+(.+)$/m);
  if (h1Match) return h1Match[1].trim();

  return null;
}

function extractBody(markdown: string): string {
  return markdown.replace(/^---\n[\s\S]*?\n---\n?/, '').trim();
}

function findLatestUnpostedFile(): string | null {
  const generatedPath = path.join(ROOT, 'data', 'generated.json');
  if (!fs.existsSync(generatedPath)) return null;

  const data: GeneratedHistory = JSON.parse(fs.readFileSync(generatedPath, 'utf-8'));
  const unposted = data.generated
    .filter(e => e.noteUrl === null && e.file)
    .sort((a, b) => b.date.localeCompare(a.date));

  if (unposted.length === 0) return null;
  return path.join(ROOT, unposted[0].file);
}

async function postToNote(title: string, body: string, token: string): Promise<NotePostResult> {
  const res = await fetch(NOTE_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({
      name: title,
      body_note_version: 2,
      body: body,
      status: 'draft',
    }),
  });

  const text = await res.text();

  if (!res.ok) {
    if (res.status === 401) {
      throw new Error(`認証エラー (401): トークンの再取得が必要です。\n${text}`);
    }
    throw new Error(`note.com API エラー (${res.status}): ${text}`);
  }

  let json: Record<string, unknown>;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(`レスポンスの JSON パースに失敗しました: ${text}`);
  }

  const data = json['data'] as Record<string, unknown> | undefined;
  if (!data) throw new Error(`予期しないレスポンス形式です: ${text}`);

  const key = String(data['key'] ?? '');
  // note.com のレスポンスでは noteUrl または user.urlname + key からURLを組み立てる
  const noteUrl =
    (data['noteUrl'] as string | undefined) ??
    (data['url'] as string | undefined) ??
    buildNoteUrl(data, key);

  return { noteId: key, noteUrl };
}

function buildNoteUrl(data: Record<string, unknown>, key: string): string {
  const user = data['user'] as Record<string, unknown> | undefined;
  const urlname = user?.['urlname'] as string | undefined;
  if (urlname && key) return `https://note.com/${urlname}/n/${key}`;
  if (key) return `https://note.com/n/${key}`;
  return 'https://note.com/';
}

function updateGeneratedJson(filePath: string, noteUrl: string): void {
  const generatedPath = path.join(ROOT, 'data', 'generated.json');
  if (!fs.existsSync(generatedPath)) return;

  const data: GeneratedHistory = JSON.parse(fs.readFileSync(generatedPath, 'utf-8'));
  const relPath = path.relative(ROOT, filePath).replace(/\\/g, '/');
  const entry = data.generated.find(e => e.file === relPath);

  if (entry) {
    entry.noteUrl = noteUrl;
    fs.writeFileSync(generatedPath, JSON.stringify(data, null, 2) + '\n', 'utf-8');
  } else {
    console.warn(`[post-to-note] generated.json に対応エントリなし: ${relPath}`);
  }
}

async function main(): Promise<void> {
  const token = process.env.NOTE_API_TOKEN;
  if (!token) {
    console.error('エラー: NOTE_API_TOKEN 環境変数が設定されていません。');
    process.exit(1);
  }

  const { filePath: argFilePath } = parseArgs();
  const filePath = argFilePath
    ? path.resolve(ROOT, argFilePath)
    : findLatestUnpostedFile();

  if (!filePath) {
    console.error('投稿対象のファイルが見つかりません。--file= で指定するか、先に generate.ts を実行してください。');
    process.exit(1);
  }

  if (!fs.existsSync(filePath)) {
    console.error(`ファイルが見つかりません: ${filePath}`);
    process.exit(1);
  }

  const markdown = fs.readFileSync(filePath, 'utf-8');
  const title = extractTitle(markdown);

  if (!title) {
    console.error('タイトルを抽出できませんでした。frontmatter に title: を追加してください。');
    process.exit(1);
  }

  const body = extractBody(markdown);

  console.log(`[post-to-note] 投稿中: ${path.basename(filePath)}`);
  console.log(`[post-to-note] タイトル: ${title}`);

  const result = await postToNote(title, body, token);

  console.log('[post-to-note] 完了!');
  console.log(`[post-to-note] 記事ID : ${result.noteId}`);
  console.log(`[post-to-note] URL    : ${result.noteUrl}`);

  updateGeneratedJson(filePath, result.noteUrl);
  console.log('[post-to-note] generated.json を更新しました。');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
