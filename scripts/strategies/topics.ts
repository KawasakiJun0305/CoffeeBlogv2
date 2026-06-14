import 'dotenv/config';
import * as fs from 'fs';
import * as path from 'path';
import OpenAI from 'openai';
import type { TopicEntry, GeneratedHistory, GeneratedTopicsEntry } from '../../types/index';
import { fetchUnsplashImage, injectImageIntoMarkdown } from '../fetch-image';

const ROOT = path.join(__dirname, '..', '..');

function stripCodeFences(s: string): string {
  return s.replace(/^```[^\n]*\n/, '').replace(/\n```$/, '').trim();
}

const CATEGORY_JA: Record<string, string> = {
  beans: '豆・産地',
  brewing: '抽出・レシピ',
  cafe: 'カフェ情報',
  equipment: '道具・機器',
  culture: 'コーヒー文化',
  flavor: 'テイスト・フレーバー',
  industry: '業界・企業・流通',
};

function loadTopicsPrompt(): { system: string; userTemplate: string } {
  const content = fs.readFileSync(path.join(ROOT, 'prompts', 'coffee-article.md'), 'utf-8');
  // セクションは \n\n---\n\n で区切られる（コードブロック内の --- は空行なしなので安全）
  const sections = content.split('\n\n---\n\n');

  const systemSection = sections.find(s => s.startsWith('## system\n'));
  const topicsSection = sections.find(s => s.startsWith('## topics\n'));

  const system = systemSection?.replace(/^## system\n\n?/, '').trim() ?? '';
  const userMatch = topicsSection?.match(/### ユーザープロンプト\n\n([\s\S]+)/);
  const userTemplate = userMatch?.[1]?.trim() ?? '';

  return { system, userTemplate };
}

function loadUngenerated(): { ungenerated: TopicEntry[]; generatedPath: string; generatedData: GeneratedHistory } {
  const topicsData = JSON.parse(
    fs.readFileSync(path.join(ROOT, 'data', 'topics.json'), 'utf-8')
  ) as { topics: TopicEntry[] };
  const generatedPath = path.join(ROOT, 'data', 'generated.json');
  const generatedData: GeneratedHistory = fs.existsSync(generatedPath)
    ? JSON.parse(fs.readFileSync(generatedPath, 'utf-8'))
    : { generated: [] };
  const generatedTopics = new Set(
    generatedData.generated
      .filter((e): e is GeneratedTopicsEntry => e.strategy === 'topics')
      .map(e => e.topic)
  );
  const ungenerated = topicsData.topics.filter(t => !generatedTopics.has(t.topic));
  return { ungenerated, generatedPath, generatedData };
}

export function getTopicsCandidates(n: number): TopicEntry[] {
  const { ungenerated } = loadUngenerated();
  return ungenerated.sort(() => Math.random() - 0.5).slice(0, n);
}

export async function runTopicsStrategy(preSelected?: TopicEntry): Promise<void> {
  const { ungenerated, generatedPath, generatedData } = loadUngenerated();

  if (!preSelected && ungenerated.length === 0) {
    console.log('全トピック生成済み。新しいトピックを data/topics.json に追加してください。');
    return;
  }

  // ランダム選択（preSelected が提供された場合はスキップ）
  const selected = preSelected ?? ungenerated[Math.floor(Math.random() * ungenerated.length)];
  console.log(`[topics] 選択: ${selected.topic} (${selected.category}) — 残り ${ungenerated.length} 件`);

  // 5. プロンプト組み立て
  const { system, userTemplate } = loadTopicsPrompt();
  const today = new Date().toISOString().slice(0, 10);
  const categoryJa = CATEGORY_JA[selected.category] ?? selected.category;

  const systemPrompt = system
    .replace(/\{\{DATE\}\}/g, today)
    .replace(/\{\{CATEGORY\}\}/g, selected.category)
    .replace(/\{\{STRATEGY\}\}/g, 'topics');

  const userPrompt = userTemplate
    .replace(/\{\{TOPIC\}\}/g, selected.topic)
    .replace(/\{\{CATEGORY_JA\}\}/g, categoryJa);

  // 6. LLM 呼び出し
  const client = new OpenAI({
    baseURL: 'https://models.inference.ai.azure.com',
    apiKey: process.env.GITHUB_TOKEN,
  });

  console.log('[topics] LLM に送信中...');
  const response = await client.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
  });

  let markdown = stripCodeFences(response.choices[0].message.content ?? '');

  // 7. Unsplash 画像取得（オプション）
  const imageResult = await fetchUnsplashImage(selected.topic, selected.category);
  markdown = injectImageIntoMarkdown(markdown, imageResult);

  // 8. output/ に保存
  const slug = selected.topic.replace(/\s+/g, '-');
  const filename = `${today}-${slug}.md`;
  const outputDir = path.join(ROOT, 'output');
  fs.mkdirSync(outputDir, { recursive: true });
  const outputPath = path.join(outputDir, filename);
  fs.writeFileSync(outputPath, markdown, 'utf-8');

  // 9. generated.json を更新
  const entry: GeneratedTopicsEntry = {
    strategy: 'topics',
    topic: selected.topic,
    category: selected.category,
    date: today,
    file: path.relative(ROOT, outputPath).replace(/\\/g, '/'),
    noteUrl: null,
  };
  generatedData.generated.push(entry);
  fs.writeFileSync(generatedPath, JSON.stringify(generatedData, null, 2) + '\n', 'utf-8');

  console.log(`[topics] 完了: ${filename}`);
  if (imageResult) {
    console.log(`[topics] 画像: ${imageResult.creditText}`);
  }
}
