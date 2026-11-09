import { lookupVocabulary, parseFreeDictionary, parseWiktionary, safeUrl } from './vocabularyLookup';

const data = { entries: [{ language: { code: 'en' }, partOfSpeech: 'phrase', senses: [
  { definition: '<b>Notice</b> the mood', tags: ['informal'], examples: ['Read the room, please.'] },
  { definition: 'Another sense', tags: [], examples: [] }
] }], source: { url: 'https://en.wiktionary.org/wiki/read_the_room', license: { name: 'CC BY-SA 4.0' } } };

test('keeps separate meanings with their own examples and register', () => {
  const senses = parseFreeDictionary(data);
  expect(senses[0].definition).toBe('Notice the mood');
  expect(senses[0].register).toBe('informal');
  expect(senses[0].examples[0].kind).toBe('source');
  expect(senses[1].examples).toHaveLength(0);
});

test('extracts English history without borrowing another language or inventing popularity', () => {
  expect(parseWiktionary('<h2>French</h2><h3>Etymology</h3><p>French history</p><h2>English</h2><h3>Etymology</h3><p>Recorded origin.</p><h3>Usage notes</h3><p>Informal.</p><h2>German</h2><p>Different text.</p>'))
    .toEqual({ origin: 'Recorded origin.', usage: 'Informal.' });
  expect(safeUrl('javascript:alert(1)')).toBeNull();
});

test('looks up the complete phrase and keeps source attribution', async () => {
  global.fetch = jest.fn(async () => ({ ok: true, json: async () => ({ free: data, dictionary: [], wiktionary: {} }) }));
  const result = await lookupVocabulary('read the room');
  expect(fetch).toHaveBeenCalledTimes(1);
  const request = new URL(fetch.mock.calls[0][0], 'https://vocab-voyager.vercel.app');
  expect(request.origin).toBe('https://vocab-voyager.vercel.app');
  expect(request.pathname).toBe('/api/vocabulary-lookup');
  expect(request.searchParams.get('term')).toBe('read the room');
  expect(result.senses).toHaveLength(2);
  expect(result.sources[0].license).toBe('CC BY-SA 4.0');
});

test('collects expressions only from the English expression sections', () => {
  const result = parseWiktionary('<h2>English</h2><h5>Derived terms</h5><ul><li><a href="/wiki/on_edge" title="on edge">on edge</a></li></ul><h2>French</h2><h5>Derived terms</h5><ul><li><a href="/wiki/au_bord" title="au bord">au bord</a></li></ul>');
  expect(result.expressions).toEqual(['on edge']);
  expect(result.origin).toBe('');
});

test('network errors allow manual saving and never claim a verified meaning', async () => {
  global.fetch = jest.fn().mockRejectedValue(new Error('offline'));
  const result = await lookupVocabulary('some new phrase');
  expect(result.senses).toEqual([]); expect(result.message).toContain('could not be reached');
});

test('an absent dictionary entry remains absent instead of matching unrelated slang', async () => {
  global.fetch = jest.fn(async () => ({ ok: true, json: async () => ({ free: { entries: [] } }) }));
  const result = await lookupVocabulary('unlisted expression');
  expect(result.senses).toEqual([]); expect(result.message).toContain('No exact dictionary');
});

test('uses the dictionary fallback through the same-origin endpoint for forte', async () => {
  global.fetch = jest.fn(async () => ({ ok: true, json: async () => ({ free: null, dictionary: [{
    meanings: [{ partOfSpeech: 'noun', definitions: [{ definition: 'A strength or talent.', example: 'Speaking is her forte.' }] }],
    sourceUrls: ['https://en.wiktionary.org/wiki/forte']
  }], wiktionary: null }) }));
  const result = await lookupVocabulary('forte');
  expect(result.senses[0].definition).toBe('A strength or talent.');
  expect(result.senses[0].examples[0].text).toBe('Speaking is her forte.');
  expect(result.sources[0].label).toBe('DictionaryAPI.dev');
  expect(fetch).toHaveBeenCalledTimes(1);
});

test('a server outage explains that saving is still available', async () => {
  global.fetch = jest.fn(async () => ({ ok: false, status: 502, json: async () => ({ error: 'Sources are unavailable. You can still save this word.' }) }));
  const result = await lookupVocabulary('forte');
  expect(result.senses).toEqual([]);
  expect(result.message).toContain('still save');
});

test('a cancelled lookup does not return a result that can replace a newer draft', async () => {
  const controller = new AbortController();
  global.fetch = jest.fn((_url, { signal }) => new Promise((resolve, reject) => {
    signal.addEventListener('abort', () => reject(new DOMException('Cancelled', 'AbortError')), { once: true });
  }));
  const pending = lookupVocabulary('forte', { signal: controller.signal });
  controller.abort();
  await expect(pending).rejects.toHaveProperty('name', 'AbortError');
});
