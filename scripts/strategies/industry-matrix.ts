import 'dotenv/config';
import * as fs from 'fs';
import * as path from 'path';
import OpenAI from 'openai';
import type {
  IndustryMatrix,
  IndustryMatrixCombo,
  GeneratedHistory,
  GeneratedIndustryMatrixEntry,
} from '../../types/index';
import { fetchUnsplashImage, injectImageIntoMarkdown } from '../fetch-image';

const ROOT = path.join(__dirname, '..', '..');

function loadPrompt(): { system: string; userTemplate: string } {
  const content = fs.readFileSync(path.join(ROOT, 'prompts', 'coffee-article.md'), 'utf-8');
  const sections = content.split('\n\n---\n\n');

  const systemSection = sections.find(s => s.startsWith('## system\n'));
  const strategySection = sections.find(s => s.startsWith('## industry-matrix\n'));

  const system = systemSection?.replace(/^## system\n\n?/, '').trim() ?? '';
  const userMatch = strategySection?.match(/### ユーザープロンプト\n\n([\s\S]+)/);
  const userTemplate = userMatch?.[1]?.trim() ?? '';

  return { system, userTemplate };
}

function loadUngenerated(): { ungenerated: IndustryMatrixCombo[]; generatedPath: string; generatedData: GeneratedHistory } {
  const masterData = JSON.parse(
    fs.readFileSync(path.join(ROOT, 'data', 'topics-industry-matrix.json'), 'utf-8')
  ) as IndustryMatrix;
  const generatedPath = path.join(ROOT, 'data', 'generated.json');
  const generatedData: GeneratedHistory = fs.existsSync(generatedPath)
    ? JSON.parse(fs.readFileSync(generatedPath, 'utf-8'))
    : { generated: [] };
  const generatedCombos = new Set(
    generatedData.generated
      .filter((e): e is GeneratedIndustryMatrixEntry => e.strategy === 'industry-matrix')
      .map(e => `${e.company}__${e.angle}`)
  );
  const allCombos: IndustryMatrixCombo[] = [];
  for (const companyEntry of masterData.companies) {
    for (const angle of masterData.angles) {
      allCombos.push({ company: companyEntry.name, angle });
    }
  }
  const ungenerated = allCombos.filter(c => !generatedCombos.has(`${c.company}__${c.angle}`));
  return { ungenerated, generatedPath, generatedData };
}

export function getIndustryMatrixCandidates(n: number): IndustryMatrixCombo[] {
  const { ungenerated } = loadUngenerated();
  return ungenerated.sort(() => Math.random() - 0.5).slice(0, n);
}

export async function runIndustryMatrixStrategy(preSelected?: IndustryMatrixCombo): Promise<void> {
  const { ungenerated, generatedPath, generatedData } = loadUngenerated();

  if (!preSelected && ungenerated.length === 0) {
    console.log('[industry-matrix] 全組み合わせ生成済み。data/topics-industry-matrix.json に企業または切り口を追加してください。');
    return;
  }

  const selected = preSelected ?? ungenerated[Math.floor(Math.random() * ungenerated.length)];
  const topic = `${selected.company}の${selected.angle}`;
  console.log(`[industry-matrix] 選択: ${topic} — 残り ${ungenerated.length} 件`);

  // 6. プロンプト組み立て
  const { system, userTemplate } = loadPrompt();
  const today = new Date().toISOString().slice(0, 10);

  const systemPrompt = system
    .replace(/\{\{DATE\}\}/g, today)
    .replace(/\{\{CATEGORY\}\}/g, 'industry')
    .replace(/\{\{STRATEGY\}\}/g, 'industry-matrix');

  const userPrompt = userTemplate
    .replace(/\{\{COMPANY\}\}/g, selected.company)
    .replace(/\{\{ANGLE\}\}/g, selected.angle)
    .replace(/\{\{TOPIC\}\}/g, topic);

  // 7. LLM 呼び出し
  const client = new OpenAI({
    baseURL: 'https://models.inference.ai.azure.com',
    apiKey: process.env.GITHUB_TOKEN,
  });

  console.log('[industry-matrix] LLM に送信中...');
  const response = await client.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
  });

  let markdown = response.choices[0].message.content ?? '';

  // 8. Unsplash 画像取得（オプション）
  const imageResult = await fetchUnsplashImage(topic, 'industry');
  markdown = injectImageIntoMarkdown(markdown, imageResult);

  // 9. output/ に保存
  const slug = `${selected.company}-${selected.angle}`
    .replace(/[（）【】「」\s]/g, '-')
    .replace(/-+/g, '-')
    .replace(/-$/, '');
  const filename = `${today}-industry-${slug}.md`;
  const outputDir = path.join(ROOT, 'output');
  fs.mkdirSync(outputDir, { recursive: true });
  const outputPath = path.join(outputDir, filename);
  fs.writeFileSync(outputPath, markdown, 'utf-8');

  // 10. generated.json を更新
  const entry: GeneratedIndustryMatrixEntry = {
    strategy: 'industry-matrix',
    company: selected.company,
    angle: selected.angle,
    topic,
    date: today,
    file: path.relative(ROOT, outputPath).replace(/\\/g, '/'),
    noteUrl: null,
  };
  generatedData.generated.push(entry);
  fs.writeFileSync(generatedPath, JSON.stringify(generatedData, null, 2) + '\n', 'utf-8');

  console.log(`[industry-matrix] 完了: ${filename}`);
  if (imageResult) {
    console.log(`[industry-matrix] 画像: ${imageResult.creditText}`);
  }
}
