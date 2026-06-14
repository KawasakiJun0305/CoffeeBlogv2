import 'dotenv/config';
import { runTopicsStrategy } from './strategies/topics';
import { runIndustryMatrixStrategy } from './strategies/industry-matrix';

const VALID_STRATEGIES = ['topics', 'matrix', 'industry-matrix', 'news', 'auto'] as const;
type StrategyInput = typeof VALID_STRATEGIES[number];

function parseArgs(): { isDryRun: boolean; strategy: StrategyInput } {
  const args = process.argv.slice(2);
  const isDryRun = args.includes('--dry-run');

  const flagArg = args.find(a => a.startsWith('--strategy='));
  const raw = flagArg ? flagArg.split('=')[1] : 'auto';
  const strategy = VALID_STRATEGIES.includes(raw as StrategyInput)
    ? (raw as StrategyInput)
    : 'auto';

  return { isDryRun, strategy };
}

function resolveAuto(strategy: StrategyInput): 'topics' | 'matrix' | 'industry-matrix' | 'news' {
  if (strategy !== 'auto') return strategy;
  const rand = Math.random();
  if (rand < 0.35) return 'topics';
  if (rand < 0.65) return 'industry-matrix';
  if (rand < 0.82) return 'matrix';
  return 'news';
}

async function main() {
  const { isDryRun, strategy } = parseArgs();
  const resolved = resolveAuto(strategy);

  if (strategy === 'auto') {
    console.log(`[generate] auto → ${resolved}`);
  }

  if (isDryRun) {
    console.log(`[generate] dry-run: strategy=${resolved}`);
    return;
  }

  if (!process.env.GITHUB_TOKEN) {
    console.error('エラー: GITHUB_TOKEN 環境変数が設定されていません。');
    process.exit(1);
  }

  switch (resolved) {
    case 'topics':
      await runTopicsStrategy();
      break;
    case 'industry-matrix':
      await runIndustryMatrixStrategy();
      break;
    case 'matrix':
      console.log('[generate] Matrix 戦略（brewing）は未実装です。');
      break;
    case 'news':
      console.log('[generate] News 戦略は未実装です。');
      break;
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
