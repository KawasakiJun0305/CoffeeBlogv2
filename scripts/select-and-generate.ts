import 'dotenv/config';
import * as readline from 'readline';
import { getTopicsCandidates, runTopicsStrategy } from './strategies/topics';
import { getMatrixCandidates, runMatrixStrategy } from './strategies/matrix';
import { getIndustryMatrixCandidates, runIndustryMatrixStrategy } from './strategies/industry-matrix';
import type { TopicEntry, MatrixCombo, IndustryMatrixCombo } from '../types/index';

const CATEGORY_JA: Record<string, string> = {
  beans: '豆・産地', brewing: '抽出・レシピ', cafe: 'カフェ情報',
  equipment: '道具・機器', culture: 'コーヒー文化',
  flavor: 'テイスト・フレーバー', industry: '業界・企業・流通',
};

type Candidate =
  | { strategy: 'topics'; data: TopicEntry; label: string }
  | { strategy: 'matrix'; data: MatrixCombo; label: string }
  | { strategy: 'industry-matrix'; data: IndustryMatrixCombo; label: string };

const TOTAL = 10;
const PER_STRATEGY = Math.ceil(TOTAL / 3);

function buildCandidates(): Candidate[] {
  const topics: Candidate[] = getTopicsCandidates(PER_STRATEGY).map(d => ({
    strategy: 'topics' as const,
    data: d,
    label: `${d.topic}（${CATEGORY_JA[d.category] ?? d.category}）`,
  }));
  const matrix: Candidate[] = getMatrixCandidates(PER_STRATEGY).map(d => ({
    strategy: 'matrix' as const,
    data: d,
    label: `${d.bean} × ${d.method} × ${d.angle}`,
  }));
  const industry: Candidate[] = getIndustryMatrixCandidates(PER_STRATEGY).map(d => ({
    strategy: 'industry-matrix' as const,
    data: d,
    label: `${d.company}の${d.angle}`,
  }));

  return [...topics, ...matrix, ...industry]
    .sort(() => Math.random() - 0.5)
    .slice(0, TOTAL);
}

async function promptSelection(candidates: Candidate[]): Promise<Candidate[]> {
  const SEP = '─'.repeat(64);
  console.log('\n未生成トピック候補');
  console.log(SEP);
  candidates.forEach((c, i) => {
    const tag = `[${c.strategy}]`.padEnd(20);
    console.log(`${String(i + 1).padStart(2)}. ${tag} ${c.label}`);
  });
  console.log(SEP);

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const answer = await new Promise<string>(resolve => {
    rl.question('生成する番号を入力（例: 1,3,5 / all / q でキャンセル）: ', resolve);
  });
  rl.close();

  const trimmed = answer.trim().toLowerCase();
  if (trimmed === 'q' || trimmed === '') {
    console.log('キャンセルしました。');
    return [];
  }
  if (trimmed === 'all') return candidates;

  const indices = trimmed.split(',')
    .map(s => parseInt(s.trim(), 10) - 1)
    .filter(i => !isNaN(i) && i >= 0 && i < candidates.length);

  if (indices.length === 0) {
    console.log('有効な番号が入力されませんでした。');
    return [];
  }
  return indices.map(i => candidates[i]);
}

async function main(): Promise<void> {
  if (!process.env.GITHUB_TOKEN) {
    console.error('エラー: GITHUB_TOKEN 環境変数が設定されていません。');
    process.exit(1);
  }

  const candidates = buildCandidates();
  if (candidates.length === 0) {
    console.log('生成可能な候補がありません。');
    return;
  }

  const selected = await promptSelection(candidates);
  if (selected.length === 0) return;

  console.log(`\n${selected.length} 件を生成します...\n`);
  for (const c of selected) {
    if (c.strategy === 'topics') {
      await runTopicsStrategy(c.data);
    } else if (c.strategy === 'matrix') {
      await runMatrixStrategy(c.data);
    } else {
      await runIndustryMatrixStrategy(c.data);
    }
    console.log('');
  }
  console.log('[select-and-generate] 完了。');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
