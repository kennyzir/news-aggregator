// ClawHub Local Skill - runs entirely in your agent, no API key required
// News Aggregator API - Fetch top news by topic using free RSS feeds

const RSS_FEEDS: Record<string, string[]> = {
  'technology': ['https://feeds.arstechnica.com/arstechnica/index', 'https://www.theverge.com/rss/index.xml'],
  'business': ['https://feeds.bloomberg.com/markets/news.rss', 'https://www.cnbc.com/id/100003114/device/rss/rss.html'],
  'science': ['https://www.sciencedaily.com/rss/all.xml', 'https://phys.org/rss-feed/'],
  'world': ['https://feeds.bbci.co.uk/news/world/rss.xml', 'https://rss.nytimes.com/services/xml/rss/nyt/World.xml'],
  'health': ['https://feeds.bbci.co.uk/news/health/rss.xml'],
  'sports': ['https://feeds.bbci.co.uk/sport/rss.xml'],
  'general': ['https://feeds.bbci.co.uk/news/rss.xml', 'https://rss.nytimes.com/services/xml/rss/nyt/HomePage.xml'],
};

interface NewsItem { title: string; link: string; description: string; pubDate: string | null; source: string; }

function parseRSSItems(xml: string, source: string): NewsItem[] {
  const items: NewsItem[] = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>|<entry>([\s\S]*?)<\/entry>/gi;
  let match;
  while ((match = itemRegex.exec(xml)) !== null) {
    const block = match[1] || match[2];
    const title = block.match(/<title[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/i)?.[1]?.trim() || '';
    const link = block.match(/<link[^>]*href=["']([^"']*)["']/i)?.[1] || block.match(/<link[^>]*>([\s\S]*?)<\/link>/i)?.[1]?.trim() || '';
    const desc = block.match(/<description[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/description>/i)?.[1]?.trim()
      || block.match(/<summary[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/summary>/i)?.[1]?.trim() || '';
    const pubDate = block.match(/<pubDate[^>]*>([\s\S]*?)<\/pubDate>/i)?.[1]?.trim()
      || block.match(/<published[^>]*>([\s\S]*?)<\/published>/i)?.[1]?.trim() || null;
    if (title) items.push({ title: title.replace(/<[^>]+>/g, ''), link, description: desc.replace(/<[^>]+>/g, '').substring(0, 300), pubDate, source });
  }
  return items;
}

export async function run(input: { topic?: string; max_results?: number }) {
  const t = (input.topic || 'general').toLowerCase();
  const feeds = RSS_FEEDS[t] || RSS_FEEDS['general'];
  const limit = Math.min(input.max_results || 10, 50);

  const startTime = Date.now();
  const allItems: NewsItem[] = [];
  for (const feedUrl of feeds) {
    try {
      const resp = await fetch(feedUrl, { signal: AbortSignal.timeout(8000), headers: { 'User-Agent': 'Claw0x-News/1.0' } });
      if (resp.ok) { const xml = await resp.text(); allItems.push(...parseRSSItems(xml, new URL(feedUrl).hostname)); }
    } catch {}
  }
  allItems.sort((a, b) => { if (!a.pubDate || !b.pubDate) return 0; return new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime(); });
  const results = allItems.slice(0, limit);

  return {
    articles: results, total: results.length, topic: t, sources: [...new Set(results.map(r => r.source))],
    _meta: { skill: 'news-aggregator', latency_ms: Date.now() - startTime, feeds_queried: feeds.length },
  };
}

export default run;
