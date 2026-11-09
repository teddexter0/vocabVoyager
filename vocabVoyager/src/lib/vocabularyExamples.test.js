import handler, { validateExamples } from '../../api/vocabulary-examples';
import { createClient } from '@supabase/supabase-js';
jest.mock('@supabase/supabase-js', () => ({ createClient: jest.fn() }));

const request = (method = 'POST', body = { term: 'read the room', definition: 'Notice the mood', register: 'informal' }) => ({ method, body, headers: { authorization: 'Bearer test-token' } });
const response = () => ({ code: 200, body: null, setHeader: jest.fn(), status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; } });
let env;
beforeEach(() => {
  env = { ...process.env };
  process.env.GEMINI_API_KEY = 'test-only'; process.env.GEMINI_MODEL = 'test-model';
  process.env.REACT_APP_SUPABASE_URL = 'https://test.supabase.co'; process.env.REACT_APP_SUPABASE_ANON_KEY = 'test-only';
  createClient.mockReturnValue({ auth: { getUser: jest.fn(async () => ({ data: { user: { id: 'test-user' } } })) } });
  global.fetch = jest.fn();
});
afterEach(() => { process.env = env; });

test('missing optional key returns a clear unavailable state without calling AI', async () => {
  delete process.env.GEMINI_API_KEY;
  const res = response(); await handler(request(), res);
  expect(res.code).toBe(503); expect(fetch).not.toHaveBeenCalled();
  const status = response(); await handler(request('GET'), status); expect(status.body.available).toBe(false);
});
test('rejects missing authentication and oversized requests before calling upstream', async () => {
  const req = request(); req.headers = {};
  const res = response(); await handler(req, res); expect(res.code).toBe(401);
  const invalid = response(); await handler(request('POST', { term: 'a'.repeat(121), definition: 'a' }), invalid);
  expect(invalid.code).toBe(400); expect(fetch).not.toHaveBeenCalled();
});
test('invalid credentials cannot call the model', async () => {
  createClient.mockReturnValue({ auth: { getUser: jest.fn(async () => ({ data: {}, error: new Error('invalid') })) } });
  const res = response(); await handler(request(), res);
  expect(res.code).toBe(401); expect(fetch).not.toHaveBeenCalled();
});
test('returns exactly three labelled original practice scenes', async () => {
  fetch.mockResolvedValue({ ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text: JSON.stringify({ examples: [{ text: 'Read the room before making that joke.' }, { text: 'I read the room before proposing another meeting.' }, { text: 'She read the room and changed the subject.' }] }) }] } }] }) });
  const res = response(); await handler(request(), res);
  expect(res.code).toBe(200);
  expect(res.body.examples.map(e => e.scenario)).toEqual(['With friends', 'At school or work', 'Telling a story']);
  expect(res.body.examples.every(e => e.kind === 'ai')).toBe(true);
  const payload = JSON.parse(fetch.mock.calls[0][1].body);
  expect(payload.systemInstruction.parts[0].text).toContain('Do not invent origins');
});
test('rejects duplicate and incomplete generated scenes', () => {
  expect(() => validateExamples({ examples: [{ text: 'a' }, { text: 'a' }, { text: 'b' }] })).toThrow();
  expect(() => validateExamples({ examples: [{ text: 'one' }] })).toThrow();
});
