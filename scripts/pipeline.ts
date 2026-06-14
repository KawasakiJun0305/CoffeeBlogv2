import 'dotenv/config';
import { execSync } from 'child_process';
import * as path from 'path';

const ROOT = path.join(__dirname, '..');

function parseArgs(): { isDryRun: boolean } {
  return { isDryRun: process.argv.includes('--dry-run') };
}

function runScript(script: string, extraArgs: string[] = []): boolean {
  try {
    const command = ['npx', 'ts-node', `scripts/${script}`, ...extraArgs].join(' ');
    execSync(command, { stdio: 'inherit', cwd: ROOT });
    return true;
  } catch {
    return false;
  }
}

async function main(): Promise<void> {
  const { isDryRun } = parseArgs();

  console.log('[pipeline] ステップ1: 記事生成');
  const generateArgs = isDryRun ? ['--dry-run'] : [];
  const generated = runScript('generate.ts', generateArgs);

  if (!generated) {
    console.error('[pipeline] 記事生成に失敗しました。投稿をスキップします。');
    process.exit(1);
  }

  if (isDryRun) {
    console.log('[pipeline] dry-run のため投稿をスキップします。');
    console.log('[pipeline] パイプライン完了（dry-run）。');
    return;
  }

  console.log('\n[pipeline] ステップ2: リーガルチェック');
  const legalOk = runScript('legal-check.ts');

  if (!legalOk) {
    console.error('[pipeline] High リスク検出により投稿をスキップします。記事を確認してください。');
    process.exit(1);
  }

  console.log('\n[pipeline] ステップ3: note.com 投稿');
  const posted = runScript('post-to-note.ts');

  if (!posted) {
    console.error('[pipeline] note.com 投稿に失敗しました。');
    process.exit(1);
  }

  console.log('\n[pipeline] パイプライン完了。');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
