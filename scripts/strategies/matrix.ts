import 'dotenv/config';
import * as fs from 'fs';
import * as path from 'path';
import OpenAI from 'openai';
import type {
  TopicsMatrix,
  MatrixCombo,
  GeneratedHistory,
  GeneratedMatrixEntry,
} from '../../types/index';
import { fetchUnsplashImage, injectImageIntoMarkdown } from '../fetch-image';

const ROOT = path.join(__dirname, '..', '..');

function loadPrompt(): { system: string; userTemplate: string } {
  const content = fs.readFileSync(path.join(ROOT, 'prompts', 'coffee-article.md'), 'utf-8');
  const sections = content.split('\n\n---\n\n');

  const systemSection = sections.find(s => s.startsWith('## system\n'));
  const matrixSection = sections.find(s => s.startsWith('## matrix\n'));

  const system = systemSection?.replace(/^## system\n\n?/, '').trim() ?? '';
  const userMatch = matrixSection?.match(/### ユーザープロンプト\n\n([\s\S]+)/);
  const userTemplate = userMatch?.[1]?.trim() ?? '';

  return { system, userTemplate };
}

function loadUngenerated(): { ungenerated: MatrixCombo[]; generatedPath: string; generatedData: GeneratedHistory } {
  const masterData = JSON.parse(
    fs.readFileSync(path.join(ROOT, 'data', 'topics-matrix.json'), 'utf-8')
  ) as TopicsMatrix;
  const generatedPath = path.join(ROOT, 'data', 'generated.json');
  const generatedData: GeneratedHistory = fs.existsSync(generatedPath)
    ? JSON.parse(fs.readFileSync(generatedPath, 'utf-8'))
    : { generated: [] };
  const generatedCombos = new Set(
    generatedData.generated
      .filter((e): e is GeneratedMatrixEntry => e.strategy === 'matrix')
      .map(e => `${e.bean}__${e.method}__${e.angle}`)
  );
  const allCombos: MatrixCombo[] = [];
  for (const bean of masterData.beans) {
    for (const method of masterData.methods) {
      for (const angle of masterData.angles) {
        allCombos.push({ bean, method, angle });
      }
    }
  }
  const ungenerated = allCombos.filter(c => !generatedCombos.has(`${c.bean}__${c.method}__${c.angle}`));
  return { ungenerated, generatedPath, generatedData };
}

export function getMatrixCandidates(n: number): MatrixCombo[] {
  const { ungenerated } = loadUngenerated();
  return ungenerated.sort(() => Math.random() - 0.5).slice(0, n);
}

export async function runMatrixStrategy(preSelected?: MatrixCombo): Promise<void> {
  const { ungenerated, generatedPath, generatedData } = loadUngenerated();

  if (!preSelected && ungenerated.length === 0) {
    console.log('[matrix] 全組み合わせ生成済み。data/topics-matrix.json に豆・抽出方法・切り口を追加してください。');
    return;
  }

  const selected = preSelected ?? ungenerated[Math.floor(Math.random() * ungenerated.length)];
  console.log(
    `[matrix] 選択: ${selected.bean} × ${selected.method} × ${selected.angle} — 残り ${ungenerated.length} 件`
  );

  // 6. プロンプト組み立て
  const { system, userTemplate } = loadPrompt();
  const today = new Date().toISOString().slice(0, 10);

  const systemPrompt = system
    .replace(/\{\{DATE\}\}/g, today)
    .replace(/\{\{CATEGORY\}\}/g, 'brewing')
    .replace(/\{\{STRATEGY\}\}/g, 'matrix');

  const userPrompt = userTemplate
    .replace(/\{\{BEAN\}\}/g, selected.bean)
    .replace(/\{\{METHOD\}\}/g, selected.method)
    .replace(/\{\{ANGLE\}\}/g, selected.angle);

  // 7. LLM 呼び出し
  const client = new OpenAI({
    baseURL: 'https://models.inference.ai.azure.com',
    apiKey: process.env.GITHUB_TOKEN,
  });

  console.log('[matrix] LLM に送信中...');
  const response = await client.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
  });

  let markdown = response.choices[0].message.content ?? '';

  // 8. Unsplash 画像取得（オプション）
  const imageResult = await fetchUnsplashImage(selected.bean, 'brewing');
  markdown = injectImageIntoMarkdown(markdown, imageResult);

  // 9. output/ に保存
  const slug = `${selected.bean}-${selected.method}`
    .replace(/[（）【】「」\s]/g, '-')
    .replace(/-+/g, '-')
    .replace(/-$/, '');
  const filename = `${today}-matrix-${slug}.md`;
  const outputDir = path.join(ROOT, 'output');
  fs.mkdirSync(outputDir, { recursive: true });
  const outputPath = path.join(outputDir, filename);
  fs.writeFileSync(outputPath, markdown, 'utf-8');

  // 10. generated.json を更新
  const entry: GeneratedMatrixEntry = {
    strategy: 'matrix',
    bean: selected.bean,
    method: selected.method,
    angle: selected.angle,
    date: today,
    file: path.relative(ROOT, outputPath).replace(/\\/g, '/'),
    noteUrl: null,
  };
  generatedData.generated.push(entry);
  fs.writeFileSync(generatedPath, JSON.stringify(generatedData, null, 2) + '\n', 'utf-8');

  console.log(`[matrix] 完了: ${filename}`);
  if (imageResult) {
    console.log(`[matrix] 画像: ${imageResult.creditText}`);
  }
}
