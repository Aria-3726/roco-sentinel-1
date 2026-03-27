// Vercel Serverless Function — /api/scan
// 调用 Anthropic API + Web Search 搜索最新舆情

const QUERIES = [
  '"Roco Kingdom World" latest 2026',
  '"Roco Kingdom World" controversy Pokemon copy',
  '"Roco Kingdom World" global release reaction',
  '洛克王国世界 overseas TikTok Reddit 2026',
];

const SYS = `You are a bilingual gaming sentiment analyst for "Roco Kingdom: World" (洛克王国：世界).
Return ONLY valid JSON. No backticks, markdown, or preamble.
{"posts":[{"p":"x|reddit|youtube|tiktok|media|forum|threads","u":"name","t":"Chinese summary max 60 chars","d":"YYYY-MM-DD","s":"pos|neg|neu","l":"language","url":"full https URL"}],"issues":[{"title":"Chinese max 25 chars","sev":"critical|warning|watch","desc":"Chinese max 100 chars","plats":["names"],"tip":"Chinese max 50 chars"}]}
Only include items with real complete https:// URLs. Deduplicate. Summarize in Chinese. 2-5 issues.`;

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'ANTHROPIC_API_KEY not configured' });

  const logs = [];

  try {
    // Step 1: Search via Anthropic API + web_search tool
    const chunks = [];
    for (const q of QUERIES) {
      logs.push(`🔍 Searching: ${q}`);
      try {
        const searchRes = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
          },
          body: JSON.stringify({
            model: 'claude-sonnet-4-20250514',
            max_tokens: 1024,
            tools: [{ type: 'web_search_20250305', name: 'web_search' }],
            messages: [{
              role: 'user',
              content: `Search for: ${q}\nReturn all results with full URLs, titles, dates, content summaries. Be thorough.`
            }],
          }),
        });

        if (!searchRes.ok) {
          logs.push(`❌ Search failed: ${searchRes.status}`);
          continue;
        }

        const data = await searchRes.json();
        const txt = (data.content || [])
          .map(c => c.type === 'text' ? c.text : '')
          .filter(Boolean)
          .join('\n');

        if (txt.length > 50) {
          chunks.push(`[WebSearch: ${q}]\n${txt}`);
          logs.push(`✅ Got ${(txt.length / 1000).toFixed(1)}KB`);
        } else {
          logs.push('⚠️ Too few results');
        }
      } catch (e) {
        logs.push(`❌ Error: ${e.message}`);
      }
    }

    if (chunks.length === 0) {
      return res.status(200).json({ posts: [], issues: [], logs });
    }

    // Step 2: Analyze with Claude
    logs.push(`📦 Analyzing ${chunks.length} result sets...`);
    const analysisRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1024,
        system: SYS,
        messages: [{
          role: 'user',
          content: chunks.join('\n\n===\n\n').slice(0, 15000),
        }],
      }),
    });

    if (!analysisRes.ok) {
      logs.push(`❌ Analysis failed: ${analysisRes.status}`);
      return res.status(200).json({ posts: [], issues: [], logs });
    }

    const analysisData = await analysisRes.json();
    const jsonStr = (analysisData.content || [])
      .map(c => c.type === 'text' ? c.text : '')
      .filter(Boolean)
      .join('\n')
      .replace(/```json|```/g, '')
      .trim();

    const parsed = JSON.parse(jsonStr);
    logs.push(`🎉 Found ${(parsed.posts || []).length} posts, ${(parsed.issues || []).length} issues`);

    return res.status(200).json({
      posts: (parsed.posts || []).filter(p => p.url && p.url.startsWith('https://')),
      issues: parsed.issues || [],
      logs,
    });

  } catch (e) {
    logs.push(`❌ Fatal: ${e.message}`);
    return res.status(200).json({ posts: [], issues: [], logs });
  }
}
