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

export async function runMatrixStrategy(): Promise<void> {
  // 1. マスタ読み込み
  const masterData = JSON.parse(
    fs.readFileSync(path.join(ROOT, 'data', 'topics-matrix.json'), 'utf-8')
  ) as TopicsMatrix;

  // 2. generated.json 読み込み
  const generatedPath = path.join(ROOT, 'data', 'generated.json');
  const generatedData: GeneratedHistory = fs.existsSync(generatedPath)
    ? JSON.parse(fs.readFileSync(generatedPath, 'utf-8'))
    : { generated: [] };

  // 3. 生成済み組み合わせを除外（bean__method__angle をキーにする）
  const generatedCombos = new Set(
    generatedData.generated
      .filter((e): e is GeneratedMatrixEntry => e.strategy === 'matrix')
      .map(e => `${e.bean}__${e.method}__${e.angle}`)
  );

  // 4. 全組み合わせを生成 → 未使用のみ抽出
  const allCombos: MatrixCombo[] = [];
  for (const bean of masterData.beans) {
    for (const method of masterData.methods) {
      for (const angle of masterData.angles) {
        allCombos.push({ bean, method, angle });
      }
    }
  }
  const ungenerated = allCombos.filter(
    c => !generatedCombos.has(`${c.bean}__${c.method}__${c.angle}`)
  );

  if (ungenerated.length === 0) {
    console.log('[matrix] 全組み合わせ生成済み。data/topics-matrix.json に豆・抽出方法・切り口を追加してください。');
    return;
  }

  // 5. ランダム選択
  const selected = ungenerated[Math.floor(Math.random() * ungenerated.length)];
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
