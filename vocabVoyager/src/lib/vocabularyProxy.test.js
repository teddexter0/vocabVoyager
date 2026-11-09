import handler from '../../api/vocabulary-lookup';

const request = async (term, method = 'GET') => {
  const res = { headers: {}, setHeader(key, value) { this.headers[key] = value; },
    status(code) { this.statusCode = code; return this; }, json(data) { this.data = data; return this; } };
  await handler({ method, query: { term } }, res);
  return res;
};
const success = data => ({ ok: true, status: 200, json: async () => data });
beforeEach(() => { global.fetch = jest.fn(); });

test('rejects invalid input and unsupported methods without contacting providers', async () => {
  for (const term of ['', undefined, ['forte'], 'x'.repeat(121), 'line\nbreak']) {
    expect((await request(term)).statusCode).toBe(400);
  }
  const result = await request('forte', 'POST');
  expect(result.statusCode).toBe(405);
  expect(result.headers.Allow).toBe('GET');
  expect(fetch).not.toHaveBeenCalled();
});

test('a failed provider does not prevent the forte fallback from reaching the browser', async () => {
  const dictionary = [{ meanings: [{ partOfSpeech: 'noun', definitions: [{ definition: 'A strength or talent.' }] }] }];
  fetch.mockImplementation(async url => {
    if (url.startsWith('https://freedictionaryapi.com/')) throw new Error('provider failed');
    return success(url.startsWith('https://api.dictionaryapi.dev/') ? dictionary : {});
  });
  const result = await request('FORTE');
  expect(result.statusCode).toBe(200);
  expect(result.data.dictionary).toEqual(dictionary);
  expect(result.data.free).toBeNull();
  expect(result.headers['Cache-Control']).toContain('s-maxage=3600');
  expect(fetch.mock.calls.map(([url]) => new URL(url).hostname)).toEqual([
    'freedictionaryapi.com', 'api.dictionaryapi.dev', 'en.wiktionary.org'
  ]);
});

test('normalizes whole phrases and never treats the term as a proxy URL', async () => {
  fetch.mockImplementation(async () => success({}));
  await request(' Read   The Room ');
  expect(fetch.mock.calls[0][0]).toBe('https://freedictionaryapi.com/api/v1/entries/en/read%20the%20room');
  expect(new URL(fetch.mock.calls[2][0]).searchParams.get('page')).toBe('read the room');
  await request('https://example.com/private');
  expect(fetch.mock.calls[3][0]).toBe('https://freedictionaryapi.com/api/v1/entries/en/https%3A%2F%2Fexample.com%2Fprivate');
});

test('an outage is not cached so the next request can recover', async () => {
  fetch.mockRejectedValue(new Error('unreachable'));
  const failed = await request('recoverable lookup');
  expect(failed.statusCode).toBe(502);
  expect(failed.headers['Cache-Control']).toBe('no-store');
  expect(failed.data.error).toContain('still save');
  fetch.mockImplementation(async () => success({ entries: [] }));
  expect((await request('recoverable lookup')).statusCode).toBe(200);
  expect(fetch).toHaveBeenCalledTimes(6);
});

test('a genuinely missing entry is distinct from an outage', async () => {
  fetch.mockResolvedValue({ ok: false, status: 404 });
  const result = await request('unlisted phrase proxy test');
  expect(result.statusCode).toBe(200);
  expect(result.data.free).toBeNull();
  expect(result.data.statuses.dictionary).toBe(404);
});

test('concurrent and repeated normalized requests share provider work', async () => {
  fetch.mockImplementation(async () => success({ entries: [] }));
  const [first, second] = await Promise.all([request('shared lookup'), request('SHARED  LOOKUP')]);
  expect(first.data).toEqual(second.data);
  await request('shared lookup');
  expect(fetch).toHaveBeenCalledTimes(3);
});
