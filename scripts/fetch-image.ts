import 'dotenv/config';

// カテゴリ別 Unsplash 検索クエリ
const CATEGORY_QUERIES: Record<string, string> = {
  beans: 'coffee beans',
  brewing: 'coffee brewing pour over',
  cafe: 'coffee shop cafe',
  equipment: 'coffee equipment grinder',
  culture: 'coffee culture',
  flavor: 'coffee tasting cup aroma',
  industry: 'coffee roastery supply chain',
};

export interface ImageResult {
  url: string;
  creditText: string;
  creditMarkdown: string;
}

interface UnsplashSearchResponse {
  results: Array<{
    urls: { regular: string };
    user: { name: string; links: { html: string } };
  }>;
}

/**
 * Unsplash API でカテゴリ + トピックに合った画像を1枚取得する。
 * UNSPLASH_ACCESS_KEY が未設定、または取得失敗時は null を返す（非ブロッキング）。
 */
export async function fetchUnsplashImage(
  topic: string,
  category: string
): Promise<ImageResult | null> {
  const accessKey = process.env.UNSPLASH_ACCESS_KEY;
  if (!accessKey) return null;

  const baseQuery = CATEGORY_QUERIES[category] ?? 'coffee';
  const query = topic ? `${baseQuery} ${topic}` : baseQuery;

  try {
    const url = new URL('https://api.unsplash.com/search/photos');
    url.searchParams.set('query', query);
    url.searchParams.set('per_page', '1');
    url.searchParams.set('orientation', 'landscape');

    const res = await fetch(url.toString(), {
      headers: { Authorization: `Client-ID ${accessKey}` },
    });

    if (!res.ok) {
      console.warn(`[fetch-image] Unsplash API error: ${res.status}`);
      return null;
    }

    const data = (await res.json()) as UnsplashSearchResponse;
    const photo = data.results[0];
    if (!photo) return null;

    const name = photo.user.name;
    const profileUrl = `${photo.user.links.html}?utm_source=CoffeeBlog&utm_medium=referral`;
    const unsplashUrl = 'https://unsplash.com/?utm_source=CoffeeBlog&utm_medium=referral';

    return {
      url: photo.urls.regular,
      creditText: `Photo by ${name} on Unsplash`,
      creditMarkdown: `*Photo by [${name}](${profileUrl}) on [Unsplash](${unsplashUrl})*`,
    };
  } catch (err) {
    console.warn('[fetch-image] Unsplash 取得失敗:', err);
    return null;
  }
}

/**
 * 記事 frontmatter と本文に画像ブロックを挿入する。
 * imageResult が null の場合は markdown をそのまま返す。
 */
export function injectImageIntoMarkdown(
  markdown: string,
  imageResult: ImageResult | null
): string {
  if (!imageResult) return markdown;

  // frontmatter（---...---）の末尾に imageUrl / imageCredit を追加
  const frontmatterEnd = markdown.indexOf('\n---', 3);
  if (frontmatterEnd === -1) return markdown;

  const beforeClose = markdown.slice(0, frontmatterEnd);
  const afterClose = markdown.slice(frontmatterEnd);

  const imageFields = `\nimageUrl: "${imageResult.url}"\nimageCredit: "${imageResult.creditText}"`;
  const imageBlock = `\n\n![コーヒー](${imageResult.url})\n${imageResult.creditMarkdown}`;

  // frontmatter 直後の本文先頭に画像ブロックを挿入
  const afterFrontmatter = afterClose.replace('\n---\n', '\n---' + imageBlock + '\n\n').replace('\n---\r\n', '\n---' + imageBlock + '\r\n\r\n');

  return beforeClose + imageFields + afterFrontmatter;
}
