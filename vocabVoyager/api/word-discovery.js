const modes = { spelling: 's', synonyms: 'rel_syn', antonyms: 'rel_ant', related: 'rel_trg', collocations: 'rel_bga', rhymes: 'rel_rhy', nearRhymes: 'rel_nry', homophones: 'rel_hom' };
const cache = new Map();
const pending = new Map();
let windowEndsAt = 0;
let upstreamRequests = 0;

async function discover(term, mode) {
  const url = new URL(mode === 'spelling' ? 'https://api.datamuse.com/sug' : 'https://api.datamuse.com/words');
  url.searchParams.set(modes[mode], term);
  url.searchParams.set('max', '8');
  if (process.env.DATAMUSE_API_KEY) url.searchParams.set('key', process.env.DATAMUSE_API_KEY);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 4500);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) throw new Error('Word discovery unavailable');
    const rows = await response.json();
    if (!Array.isArray(rows)) throw new Error('Invalid discovery result');
    return [...new Set(rows.slice(0, 8).map(row => row?.word)
      .filter(word => typeof word === 'string' && word.length <= 100 && word.toLowerCase() !== term))];
  } finally { clearTimeout(timer); }
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Use GET for word discovery.' });
  }
  const { term: raw, mode } = req.query || {};
  if (typeof raw !== 'string' || typeof mode !== 'string' || !Object.hasOwn(modes, mode) ||
      !/^[\p{L}][\p{L} ’'-]{0,79}$/u.test(raw.trim())) {
    return res.status(400).json({ error: 'Enter a word or short phrase for discovery.' });
  }
  const term = raw.trim().toLowerCase();
  const key = `${mode}:${term}`;
  try {
    let entry = cache.get(key);
    if (!entry || entry.expires < Date.now()) {
      if (!pending.has(key)) {
        if (Date.now() >= windowEndsAt) {
          windowEndsAt = Date.now() + 60000;
          upstreamRequests = 0;
        }
        if (pending.size >= 12 || upstreamRequests >= 60) {
          res.setHeader('Retry-After', '60');
          return res.status(429).json({ error: 'Word discovery is busy. Try again shortly.' });
        }
        upstreamRequests++;
        pending.set(key, discover(term, mode).finally(() => pending.delete(key)));
      }
      entry = { words: await pending.get(key), expires: Date.now() + 3600000 };
      if (cache.size >= 150) cache.delete(cache.keys().next().value);
      cache.set(key, entry);
    }
    res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400');
    return res.status(200).json({ words: entry.words });
  } catch {
    res.setHeader('Cache-Control', 'no-store');
    return res.status(502).json({ error: 'Word discovery is temporarily unavailable.' });
  }
}
