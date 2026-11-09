import { normalizeTerm } from './personalVocabulary';

export const safeUrl = value => {
  try { const url = new URL(value); return ['https:', 'http:'].includes(url.protocol) ? url.href : null; } catch { return null; }
};
const plain = value => {
  const doc = new DOMParser().parseFromString(String(value || ''), 'text/html');
  doc.querySelectorAll('script,style,sup,.mw-editsection,.citation-needed').forEach(n => n.remove());
  return (doc.body.textContent || '').replace(/\s+/g, ' ').trim();
};

const terms = values => Array.isArray(values) ? [...new Set(values.map(value =>
  typeof value === 'string' ? plain(value) : typeof value?.word === 'string' ? plain(value.word) : ''
).filter(Boolean))].slice(0, 16) : [];

async function getJSON(url, signal) {
  let response;
  try { response = await fetch(url, { signal }); }
  catch (error) {
    if (error.name === 'AbortError') throw error;
    throw new Error('The free sources could not be reached. You can still save this word and add a meaning later.');
  }
  let data;
  try { data = await response.json(); } catch { throw new Error('The lookup service is unavailable. You can still save this word and add a meaning later.'); }
  if (!response.ok) throw new Error(data.error || (response.status === 429 ? 'The free dictionary is busy. Try again later.' : 'The free sources could not be reached. You can still save this word.'));
  return data;
}

export function parseFreeDictionary(data) {
  return (data.entries || []).filter(e => e.language?.code === 'en').flatMap(entry =>
    (entry.senses || []).filter(s => s.definition).map(s => ({
      definition: plain(s.definition), partOfSpeech: entry.partOfSpeech || '',
      register: [...new Set([...(s.tags || [])])].join(', '),
      phonetic: entry.pronunciations?.find(p => p.type === 'ipa')?.text || '',
      synonyms: terms(s.synonyms),
      antonyms: terms(s.antonyms),
      related: terms(s.relatedTerms || s.related),
      examples: [...(s.examples || []).map(text => ({ scenario: 'Dictionary example', text: plain(text), kind: 'source' })),
        ...(s.quotes || []).map(q => ({ scenario: q.reference || 'Published usage', text: plain(q.text), kind: 'source' }))].slice(0, 6)
    })));
}

export function parseWiktionary(html) {
  const doc = new DOMParser().parseFromString(html || '', 'text/html');
  let english = false, section = '', origin = [], usage = [];
  const expressions = [];
  for (const node of doc.querySelectorAll('h2,h3,h4,h5,h6,p,li a[title]')) {
    if (node.tagName === 'H2') { english = /\bEnglish\b/.test(node.textContent); section = ''; }
    else if (/^H[3-6]$/.test(node.tagName)) section = node.textContent.trim();
    else if (english && node.tagName === 'P' && /^etymology\b/i.test(section)) origin.push(plain(node.textContent));
    else if (english && node.tagName === 'P' && /^usage notes\b/i.test(section)) usage.push(plain(node.textContent));
    else if (english && node.tagName === 'A' && /^(derived terms|idioms|phrases|collocations)\b/i.test(section) &&
        node.getAttribute('href')?.startsWith('/wiki/') && !node.title.includes(':') && /\s/u.test(node.title)) {
      expressions.push(node.title);
    }
  }
  return { origin: origin.filter(Boolean).slice(0, 3).join('\n\n'), usage: usage.filter(Boolean).slice(0, 3).join('\n\n'),
    ...(expressions.length ? { expressions: terms(expressions) } : {}) };
}

export async function lookupVocabulary(raw, { signal } = {}) {
  const term = normalizeTerm(raw);
  if (!term || term.length > 120) throw new Error('Enter one word or phrase, up to 120 characters.');
  const controller = new AbortController();
  const abort = () => controller.abort();
  signal?.addEventListener('abort', abort, { once: true });
  if (signal?.aborted) controller.abort();
  const timer = setTimeout(abort, 12000);
  const wiki = `https://en.wiktionary.org/wiki/${encodeURIComponent(term.replace(/ /g, '_'))}#English`;
  try {
    let payload;
    try { payload = await getJSON(`/api/vocabulary-lookup?${new URLSearchParams({ term })}`, controller.signal); }
    catch (error) {
      if (signal?.aborted) throw new DOMException('Cancelled', 'AbortError');
      return { term: raw.trim(), senses: [], origin: '', usage: '', sources: [], lookedUpAt: Date.now(),
        message: error.name === 'AbortError' ? 'Lookup took too long. You can save now and try again later.' : error.message || 'The free sources could not be reached. You can still save this word.' };
    }
    if (signal?.aborted) throw new DOMException('Cancelled', 'AbortError');
    const { free, dictionary, wiktionary } = payload;
    let senses = free ? parseFreeDictionary(free) : [];
    const sources = [];
    if (senses.length) sources.push({ label: 'FreeDictionaryAPI.com · Wiktionary', url: safeUrl(free.source?.url) || wiki,
      license: free.source?.license?.name || 'CC BY-SA 4.0', licenseUrl: safeUrl(free.source?.license?.url) || 'https://creativecommons.org/licenses/by-sa/4.0/' });
    if (!senses.length && Array.isArray(dictionary)) {
      senses = dictionary.flatMap(e => (e.meanings || []).flatMap(m => (m.definitions || []).map(d => ({
        definition: d.definition, partOfSpeech: m.partOfSpeech, phonetic: e.phonetic || '', register: '',
        synonyms: terms(d.synonyms), antonyms: terms(d.antonyms),
        related: terms(m.synonyms),
        examples: d.example ? [{ scenario: 'Dictionary example', text: d.example, kind: 'source' }] : []
      }))));
      if (senses.length) sources.push({ label: 'DictionaryAPI.dev', url: safeUrl(dictionary[0].sourceUrls?.[0]) || 'https://dictionaryapi.dev',
        license: dictionary[0].license?.name || '', licenseUrl: safeUrl(dictionary[0].license?.url) });
    }
    const history = parseWiktionary(wiktionary?.parse?.text?.['*']);
    if (history.origin || history.usage) sources.push({ label: 'Wiktionary · history & usage', url: wiki, license: 'CC BY-SA 4.0', licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/' });
    return { term: raw.trim(), senses, ...history, sources, wiki, lookedUpAt: Date.now(),
      message: senses.length ? '' : 'No exact dictionary entry found. Keep the phrase intact and add your own meaning, or check the research links.' };
  } finally { clearTimeout(timer); signal?.removeEventListener('abort', abort); }
}
