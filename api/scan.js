// Vercel Serverless Function — /api/scan
// 纯 Tavily 搜索，无需 LLM，关键词情感分析

const QUERIES = [
  '"Roco Kingdom World" latest 2026',
  '"Roco Kingdom World" controversy Pokemon copy',
  '"Roco Kingdom World" global release reaction',
  '洛克王国世界 overseas TikTok Reddit 2026',
];

// 关键词情感分析
const NEG_WORDS = ['controversy','copy','copycat','plagiarism','stolen','sue','lawsuit','ban','disappointed','angry','boring','scam','p2w','pay to win','predatory','gacha','cashgrab','rip-off','ripoff','theft','terrible','awful','negative','backlash','outrage','furious','trash','garbage','flop','dead','抄袭','骗','垃圾','差评','失望','愤怒','无聊','氪金','圈钱'];
const POS_WORDS = ['amazing','beautiful','love','incredible','awesome','excited','hype','best','stunning','gorgeous','masterpiece','fantastic','great','wonderful','promising','impressive','recommend','fun','enjoy','addicted','can\'t wait','hyped','好玩','期待','惊艳','漂亮','好评','推荐','喜欢','治愈','沉迷','优秀'];

function detectSentiment(text) {
  const t = text.toLowerCase();
  let pos = 0, neg = 0;
  NEG_WORDS.forEach(w => { if (t.includes(w)) neg++; });
  POS_WORDS.forEach(w => { if (t.includes(w)) pos++; });
  if (neg > pos) return 'neg';
  if (pos > neg) return 'pos';
  return 'neu';
}

function detectPlatform(url) {
  if (!url) return 'media';
  if (url.includes('x.com') || url.includes('twitter.com')) return 'x';
  if (url.includes('reddit.com')) return 'reddit';
  if (url.includes('youtube.com') || url.includes('youtu.be')) return 'youtube';
  if (url.includes('tiktok.com')) return 'tiktok';
  if (url.includes('threads.net')) return 'threads';
  if (url.includes('taptap.io') || url.includes('resetera.com') || url.includes('gamefaqs.')) return 'forum';
  return 'media';
}

function detectLanguage(text) {
  if (/[\u4e00-\u9fff]/.test(text)) return '中文';
  if (/[\u3040-\u309f\u30a0-\u30ff]/.test(text)) return '日语';
  if (/[\u0e00-\u0e7f]/.test(text)) return '泰语';
  if (/[\u1e00-\u1eff]/.test(text) && /ư|ơ|ă|đ/.test(text)) return '越南语';
  return '英语';
}

function extractUsername(url, title) {
  try {
    const u = new URL(url);
    if (u.hostname.includes('reddit.com')) {
      const m = u.pathname.match(/\/r\/([^/]+)/);
      return m ? 'r/' + m[1] : 'Reddit';
    }
    if (u.hostname.includes('x.com') || u.hostname.includes('twitter.com')) {
      const m = u.pathname.match(/\/([^/]+)/);
      return m ? '@' + m[1] : 'X';
    }
    if (u.hostname.includes('youtube.com')) return title?.split(/[-–|]/).pop()?.trim()?.slice(0, 20) || 'YouTube';
    if (u.hostname.includes('tiktok.com')) {
      const m = u.pathname.match(/@([^/]+)/);
      return m ? '@' + m[1] : 'TikTok';
    }
    // Media: use hostname
    return u.hostname.replace('www.', '').split('.')[0];
  } catch { return 'Unknown'; }
}

function truncate(str, max) {
  if (!str) return '';
  return str.length > max ? str.slice(0, max - 1) + '…' : str;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const tavilyKey = process.env.TAVILY_API_KEY;
  if (!tavilyKey) return res.status(500).json({ error: 'TAVILY_API_KEY not configured' });

  const logs = [];

  try {
    const allResults = [];
    const seenUrls = new Set();

    for (const q of QUERIES) {
      logs.push(`🔍 Searching: ${q}`);
      try {
        const searchRes = await fetch('https://api.tavily.com/search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            api_key: tavilyKey,
            query: q,
            search_depth: 'advanced',
            max_results: 10,
            include_raw_content: false,
          }),
        });

        if (!searchRes.ok) {
          logs.push(`❌ Tavily failed: ${searchRes.status}`);
          continue;
        }

        const data = await searchRes.json();
        const results = data.results || [];
        logs.push(`✅ Got ${results.length} results`);

        for (const r of results) {
          if (!r.url || !r.url.startsWith('https://')) continue;
          if (seenUrls.has(r.url)) continue;
          seenUrls.add(r.url);

          const combined = (r.title || '') + ' ' + (r.content || '');
          // Skip irrelevant results
          if (!/roco|洛克|kingdom/i.test(combined)) continue;

          const dateMatch = (r.published_date || '').match(/(\d{4}-\d{2}-\d{2})/);
          const date = dateMatch ? dateMatch[1] : new Date().toISOString().slice(0, 10);

          allResults.push({
            p: detectPlatform(r.url),
            u: extractUsername(r.url, r.title),
            t: truncate(r.title || r.content, 60),
            d: date,
            s: detectSentiment(combined),
            l: detectLanguage(combined),
            url: r.url,
          });
        }
      } catch (e) {
        logs.push(`❌ Error: ${e.message}`);
      }
    }

    logs.push(`📦 Processed ${allResults.length} unique relevant results`);

    return res.status(200).json({
      posts: allResults,
      issues: [],
      logs,
    });

  } catch (e) {
    logs.push(`❌ Fatal: ${e.message}`);
    return res.status(200).json({ posts: [], issues: [], logs });
  }
}
