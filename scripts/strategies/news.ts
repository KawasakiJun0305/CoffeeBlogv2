import 'dotenv/config';
import * as fs from 'fs';
import * as path from 'path';
import OpenAI from 'openai';
import type { GeneratedHistory, GeneratedNewsEntry } from '../../types/index';
import { fetchUnsplashImage, injectImageIntoMarkdown } from '../fetch-image';

const ROOT = path.join(__dirname, '..', '..');

// 利用する RSS フィード（農業・環境・ワールドニュース）
const RSS_FEEDS = [
  { url: 'https://www3.nhk.or.jp/nhkworld/en/news/rss.xml', label: 'NHK World' },
  { url: 'https://www.theguardian.com/environment/rss', label: 'Guardian Environment' },
  { url: 'https://feeds.bbci.co.uk/news/world/rss.xml', label: 'BBC World' },
];

interface NewsItem {
  title: string;
  description: string;
  source: string;
}

function extractCdataOrText(tag: string, xml: string): string {
  const cdataRe = new RegExp(`<${tag}[^>]*><!\\[CDATA\\[[\\s\\S]*?\\]\\]><\\/${tag}>`);
  const cdataMatch = xml.match(cdataRe);
  if (cdataMatch) {
    return cdataMatch[0].replace(/<[^>]+>|<!\[CDATA\[|\]\]>/g, '').trim();
  }
  const plainRe = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`);
  const plainMatch = xml.match(plainRe);
  return (plainMatch?.[1] ?? '').replace(/<[^>]+>/g, '').trim();
}

function parseRssItems(xml: string, source: string): NewsItem[] {
  const items: NewsItem[] = [];
  const itemRe = /<item[\s>][\s\S]*?<\/item>/g;
  let match: RegExpExecArray | null;

  while ((match = itemRe.exec(xml)) !== null) {
    const block = match[0];
    const title = extractCdataOrText('title', block);
    const desc = extractCdataOrText('description', block).slice(0, 300);
    if (title) items.push({ title, description: desc, source });
    if (items.length >= 5) break;
  }

  return items;
}

async function fetchRssFeeds(): Promise<NewsItem[]> {
  const all: NewsItem[] = [];

  for (const feed of RSS_FEEDS) {
    try {
      const res = await fetch(feed.url, { signal: AbortSignal.timeout(8000) });
      if (!res.ok) {
        console.warn(`[news] RSS 取得失敗 (${res.status}): ${feed.label}`);
        continue;
      }
      const xml = await res.text();
      const items = parseRssItems(xml, feed.label);
      all.push(...items);
      console.log(`[news] ${feed.label}: ${items.length}件取得`);
    } catch {
      console.warn(`[news] RSS タイムアウト / ネットワークエラー: ${feed.label}`);
    }
  }

  return all;
}

async function fetchOpenLibraryBooks(): Promise<NewsItem[]> {
  try {
    const res = await fetch(
      'https://openlibrary.org/search.json?subject=agriculture&limit=5&sort=new',
      { signal: AbortSignal.timeout(8000) }
    );
    if (!res.ok) return [];

    const json = await res.json() as {
      docs?: Array<{ title?: string; first_sentence?: { value?: string } }>;
    };

    return (json.docs ?? [])
      .filter(d => d.title)
      .slice(0, 5)
      .map(d => ({
        title: d.title!,
        description: d.first_sentence?.value ?? '',
        source: 'OpenLibrary',
      }));
  } catch {
    console.warn('[news] OpenLibrary 取得失敗');
    return [];
  }
}

function loadPrompt(): { system: string; userTemplate: string } {
  const content = fs.readFileSync(path.join(ROOT, 'prompts', 'coffee-article.md'), 'utf-8');
  const sections = content.split('\n\n---\n\n');

  const systemSection = sections.find(s => s.startsWith('## system\n'));
  const newsSection = sections.find(s => s.startsWith('## news\n'));

  const system = systemSection?.replace(/^## system\n\n?/, '').trim() ?? '';
  const userMatch = newsSection?.match(/### ユーザープロンプト\n\n([\s\S]+)/);
  const userTemplate = userMatch?.[1]?.trim() ?? '';

  return { system, userTemplate };
}

function extractTitleFromMarkdown(markdown: string): string {
  const fmMatch = markdown.match(/^---\n([\s\S]*?)\n---/);
  if (fmMatch) {
    const titleLine = fmMatch[1].split('\n').find(l => l.startsWith('title:'));
    if (titleLine) {
      const t = titleLine.replace(/^title:\s*/, '').replace(/^["']|["']$/g, '').trim();
      if (t) return t;
    }
  }
  const h1 = markdown.match(/^#\s+(.+)$/m);
  return h1?.[1]?.trim() ?? 'news-article';
}

export async function runNewsStrategy(): Promise<void> {
  // 1. ニュース収集
  const [rssItems, bookItems] = await Promise.all([
    fetchRssFeeds(),
    fetchOpenLibraryBooks(),
  ]);

  const allItems = [...rssItems, ...bookItems];

  if (allItems.length === 0) {
    console.error('[news] エラー: 全フィードからのニュース取得に失敗しました。');
    process.exit(1);
  }

  console.log(`[news] 合計 ${allItems.length} 件のニュースを収集`);

  // 2. ランダム選択
  const selected = allItems[Math.floor(Math.random() * allItems.length)];
  console.log(`[news] 選択: "${selected.title}" (${selected.source})`);

  // 3. プロンプト組み立て
  const { system, userTemplate } = loadPrompt();
  const today = new Date().toISOString().slice(0, 10);

  const newsItem = `タイトル: ${selected.title}\n出典: ${selected.source}\n概要: ${selected.description}`;

  const systemPrompt = system
    .replace(/\{\{DATE\}\}/g, today)
    .replace(/\{\{CATEGORY\}\}/g, 'culture')
    .replace(/\{\{STRATEGY\}\}/g, 'news');

  const userPrompt = userTemplate.replace(/\{\{NEWS_ITEM\}\}/g, newsItem);

  // 4. LLM 呼び出し
  const client = new OpenAI({
    baseURL: 'https://models.inference.ai.azure.com',
    apiKey: process.env.GITHUB_TOKEN,
  });

  console.log('[news] LLM に送信中...');
  const response = await client.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
  });

  let markdown = response.choices[0].message.content ?? '';

  // 5. Unsplash 画像取得（オプション）
  const imageResult = await fetchUnsplashImage(selected.title, 'culture');
  markdown = injectImageIntoMarkdown(markdown, imageResult);

  // 6. output/ に保存（生成記事のタイトルからスラグを作成）
  const articleTitle = extractTitleFromMarkdown(markdown);
  const slug = articleTitle
    .replace(/[！-～\s　、。・「」『』【】（）〔〕〈〉《》…—]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40);
  const filename = `${today}-news-${slug || 'article'}.md`;
  const outputDir = path.join(ROOT, 'output');
  fs.mkdirSync(outputDir, { recursive: true });
  const outputPath = path.join(outputDir, filename);
  fs.writeFileSync(outputPath, markdown, 'utf-8');

  // 7. generated.json を更新
  const generatedPath = path.join(ROOT, 'data', 'generated.json');
  const generatedData: GeneratedHistory = fs.existsSync(generatedPath)
    ? JSON.parse(fs.readFileSync(generatedPath, 'utf-8'))
    : { generated: [] };

  const entry: GeneratedNewsEntry = {
    strategy: 'news',
    date: today,
    file: path.relative(ROOT, outputPath).replace(/\\/g, '/'),
    noteUrl: null,
  };
  generatedData.generated.push(entry);
  fs.writeFileSync(generatedPath, JSON.stringify(generatedData, null, 2) + '\n', 'utf-8');

  console.log(`[news] 完了: ${filename}`);
  if (imageResult) {
    console.log(`[news] 画像: ${imageResult.creditText}`);
  }
}
