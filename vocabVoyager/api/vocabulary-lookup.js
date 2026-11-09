// Same-origin, keyless lookup. URLs are fixed so this cannot proxy arbitrary sites.
const cache = new Map();
const inFlight = new Map();
const normalize = value => value.normalize('NFKC').trim().replace(/[‘’]/g, "'").replace(/\s+/g, ' ').toLowerCase();

async function sourceJSON(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 6500);
  try {
    const response = await fetch(url, { signal: controller.signal, headers: {
      Accept: 'application/json', 'User-Agent': 'VocabVoyager/1.0 (+https://vocab-voyager.vercel.app)'
    } });
    if (!response.ok) return { data: null, status: response.status };
    const reader = response.body?.getReader?.();
    let data;
    if (reader) {
      const decoder = new TextDecoder(); let text = '', size = 0;
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          size += value.byteLength;
          if (size > 1200000) { controller.abort(); throw new Error('Source response is too large'); }
          text += decoder.decode(value, { stream: true });
        }
        text += decoder.decode(); data = JSON.parse(text);
      } finally { reader.releaseLock(); }
    } else data = await response.json();
    return { data, status: 200 };
  } catch { return { data: null, status: 503 }; }
  finally { clearTimeout(timer); }
}

async function fetchSources(term) {
  const word = encodeURIComponent(term);
  const urls = [
    `https://freedictionaryapi.com/api/v1/entries/en/${word}`,
    `https://api.dictionaryapi.dev/api/v2/entries/en/${word}`,
    `https://en.wiktionary.org/w/api.php?${new URLSearchParams({ action: 'parse', page: term, prop: 'text', format: 'json', origin: '*' })}`
  ];
  const results = await Promise.all(urls.map(sourceJSON));
  return { free: results[0].data, dictionary: results[1].data, wiktionary: results[2].data,
    statuses: { free: results[0].status, dictionary: results[1].status, wiktionary: results[2].status } };
}

export default async function handler(req, res) {
  if (req.method !== 'GET') { res.setHeader('Allow', 'GET'); return res.status(405).json({ error: 'Use GET for dictionary lookup.' }); }
  const raw = req.query?.term;
  if (typeof raw !== 'string' || !raw.trim() || raw.length > 120 || /[\x00-\x1f\x7f]/.test(raw)) {
    return res.status(400).json({ error: 'Enter one word or phrase, up to 120 characters.' });
  }
  const term = normalize(raw), now = Date.now();
  const cached = cache.get(term);
  if (cached && cached.expires > now) {
    res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400');
    return res.status(200).json(cached.value);
  }
  if (cached) cache.delete(term);
  if (!inFlight.has(term)) inFlight.set(term, fetchSources(term).finally(() => inFlight.delete(term)));
  const value = await inFlight.get(term);
  const available = value.free || value.dictionary || value.wiktionary;
  if (!available && Object.values(value.statuses).every(status => status !== 404 && status !== 200)) {
    res.setHeader('Cache-Control', 'no-store');
    return res.status(502).json({ error: 'The free sources could not be reached. You can still save this word and add a meaning later.' });
  }
  if (cache.size >= 50) cache.delete(cache.keys().next().value);
  cache.set(term, { value, expires: now + 3600000 });
  res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400');
  return res.status(200).json(value);
}
