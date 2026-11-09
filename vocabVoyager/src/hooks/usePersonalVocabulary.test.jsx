import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import usePersonalVocabulary from './usePersonalVocabulary';
import { supabase } from '../lib/supabase';
import { createEntry, deckKey, emptyDeck } from '../lib/personalVocabulary';

jest.mock('../lib/supabase', () => ({ isSupabaseConfigured: true, supabase: { from: jest.fn() } }));
let host, root, notebook;
function Harness({ owner }) { notebook = usePersonalVocabulary(owner); return <span>{notebook.status}</span>; }
beforeEach(() => {
  jest.useFakeTimers(); localStorage.clear();
  host = document.createElement('div'); document.body.appendChild(host); root = createRoot(host);
  supabase.from.mockImplementation(() => ({
    select: () => ({ eq: () => ({ abortSignal: async () => ({ data: [], error: null }) }) }),
    upsert: () => ({ abortSignal: async () => ({ error: null }) })
  }));
});
afterEach(() => { act(() => root.unmount()); host.remove(); jest.useRealTimers(); jest.restoreAllMocks(); jest.clearAllMocks(); });

test('switching accounts does not copy another account or guest words', async () => {
  const entry = createEntry({ term: 'private phrase', definition: 'a private meaning' }, 1, 100);
  localStorage.setItem(deckKey('alice'), JSON.stringify({ ...emptyDeck(), entries: [entry] }));
  await act(async () => root.render(<Harness owner="alice"/>));
  expect(notebook.deck.entries[0].term).toBe('private phrase');
  await act(async () => root.render(<Harness owner="bob"/>));
  expect(notebook.deck.entries).toEqual([]);
  expect(JSON.parse(localStorage.getItem(deckKey('alice'))).entries).toHaveLength(1);
});

test('an unavailable cloud leaves a newly saved phrase in browser storage', async () => {
  supabase.from.mockImplementation(() => ({ select: () => ({ eq: () => ({ abortSignal: async () => ({ error: new Error('paused') }) }) }) }));
  await act(async () => root.render(<Harness owner="alice"/>));
  act(() => notebook.update(d => ({ ...d, entries: [createEntry({ term: 'saved offline', definition: 'still here' }, d.visit)] })));
  await act(async () => { jest.advanceTimersByTime(1600); });
  expect(notebook.status).toContain('cloud unavailable');
  expect(JSON.parse(localStorage.getItem(deckKey('alice'))).entries[0].term).toBe('saved offline');
});

test('a successful cloud merge does not trigger an endless sync loop', async () => {
  await act(async () => root.render(<Harness owner="alice"/>));
  await act(async () => { jest.advanceTimersByTime(1600); });
  expect(notebook.status).toBe('Synced to your account');
  const calls = supabase.from.mock.calls.length;
  await act(async () => { jest.advanceTimersByTime(60000); });
  expect(supabase.from.mock.calls).toHaveLength(calls);
});

test('a corrupted notebook is not silently overwritten', async () => {
  localStorage.setItem(deckKey(), '{broken');
  await act(async () => root.render(<Harness/>));
  act(() => notebook.update(d => ({ ...d, entries: [createEntry({ term: 'new phrase', definition: 'new' }, 1)] })));
  expect(localStorage.getItem(deckKey())).toBe('{broken');
  expect(notebook.error).toContain('only in memory');
});

test('a failed durable save keeps the collection intact and can be retried', async () => {
  await act(async () => root.render(<Harness/>));
  const entry = createEntry({ term: 'forte', definition: 'A strength.' }, notebook.deck.visit);
  const storage = jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new DOMException('Full', 'QuotaExceededError'); });
  let result;
  act(() => { result = notebook.update(d => ({ ...d, entries: [entry] }), { requirePersistence: true }); });
  expect(result.persisted).toBe(false);
  expect(notebook.deck.entries).toHaveLength(0);
  expect(JSON.parse(localStorage.getItem(deckKey())).entries).toHaveLength(0);
  storage.mockRestore();
  act(() => { result = notebook.update(d => ({ ...d, entries: [entry] }), { requirePersistence: true }); });
  expect(result.persisted).toBe(true);
  expect(JSON.parse(localStorage.getItem(deckKey())).entries[0].term).toBe('forte');
});

test('a failure to write the visit counter does not hide previously saved words', async () => {
  const entry = createEntry({ term: 'already saved', definition: 'Kept safe.' }, 1);
  localStorage.setItem(deckKey(), JSON.stringify({ ...emptyDeck(), entries: [entry] }));
  jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new DOMException('Full', 'QuotaExceededError'); });
  await act(async () => root.render(<Harness/>));
  expect(notebook.deck.entries[0].term).toBe('already saved');
  expect(notebook.error).toContain('saved words were opened');
});

test('a missing cloud table is reported as sync setup while browser words stay saved', async () => {
  supabase.from.mockImplementation(() => ({ select: () => ({ eq: () => ({ abortSignal: async () => ({ error: { code: 'PGRST205' } }) }) }) }));
  await act(async () => root.render(<Harness owner="alice"/>));
  act(() => notebook.update(d => ({ ...d, entries: [createEntry({ term: 'local first', definition: 'Saved here.' }, d.visit)] })));
  await act(async () => { jest.advanceTimersByTime(1600); });
  expect(notebook.status).toContain('account sync needs setup');
  expect(JSON.parse(localStorage.getItem(deckKey('alice'))).entries[0].term).toBe('local first');
});
