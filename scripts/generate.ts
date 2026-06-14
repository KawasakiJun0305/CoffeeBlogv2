import 'dotenv/config';
import { runTopicsStrategy } from './strategies/topics';

const VALID_STRATEGIES = ['topics', 'matrix', 'news', 'auto'] as const;
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

function resolveAuto(strategy: StrategyInput): 'topics' | 'matrix' | 'news' {
  if (strategy !== 'auto') return strategy;
  const rand = Math.random();
  if (rand < 0.3) return 'topics';
  if (rand < 0.7) return 'matrix';
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
    case 'matrix':
      console.log('[generate] Matrix 戦略は未実装です（p2-2 で実装予定）。');
      break;
    case 'news':
      console.log('[generate] News 戦略は未実装です（p2-3 で実装予定）。');
      break;
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
