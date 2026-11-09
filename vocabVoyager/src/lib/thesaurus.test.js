import { replacement, wordsIn } from './thesaurus';
import discover from '../../api/word-discovery';

test('replaces the selected occurrence without changing the other words or punctuation', () => {
  const sentence = 'Angry? She was angry.';
  const tokens = wordsIn(sentence);
  expect(replacement(sentence, tokens[3], 'indignant')).toBe('Angry? She was indignant.');
  expect(replacement(sentence, tokens[0], 'furious')).toBe('Furious? She was angry.');
});

test('discovery bounds requests, validates the mode, and keeps upstream failures separate', async () => {
  const res = { setHeader: jest.fn(), status: jest.fn().mockReturnThis(), json: jest.fn() };
  const previous = global.fetch;
  global.fetch = jest.fn().mockResolvedValueOnce({ ok: true, json: async () => [{ word: 'serendipity' }, { word: null }] })
    .mockResolvedValueOnce({ ok: false });
  try {
    await discover({ method: 'GET', query: { mode: 'constructor', term: 'word' } }, res);
    expect(res.status).toHaveBeenLastCalledWith(400);
    expect(fetch).not.toHaveBeenCalled();
    await discover({ method: 'GET', query: { mode: 'spelling', term: 'serendipty' } }, res);
    expect(res.json).toHaveBeenLastCalledWith({ words: ['serendipity'] });
    const url = new URL(fetch.mock.calls[0][0]);
    expect(url.origin).toBe('https://api.datamuse.com');
    expect(url.searchParams.get('max')).toBe('8');
    await discover({ method: 'GET', query: { mode: 'rhymes', term: 'forte' } }, res);
    expect(res.status).toHaveBeenLastCalledWith(502);
  } finally { global.fetch = previous; }
});
