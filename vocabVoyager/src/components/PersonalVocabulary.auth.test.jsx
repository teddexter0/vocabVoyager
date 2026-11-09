import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { Simulate } from 'react-dom/test-utils';
import PersonalVocabulary from './PersonalVocabulary';
import { supabase } from '../lib/supabase';
import { createEntry, deckKey, emptyDeck } from '../lib/personalVocabulary';

jest.mock('../lib/supabase', () => ({ isSupabaseConfigured: true, supabase: {
  auth: { getSession: jest.fn(), onAuthStateChange: jest.fn() }, from: jest.fn()
} }));
let host, root, arriveSession;
beforeEach(() => {
  localStorage.clear();
  global.fetch = jest.fn(async () => ({ ok: false }));
  supabase.auth.getSession.mockImplementation(() => new Promise(resolve => { arriveSession = resolve; }));
  supabase.auth.onAuthStateChange.mockReturnValue({ data: { subscription: { unsubscribe: jest.fn() } } });
  supabase.from.mockReturnValue({ select: () => ({ eq: () => ({ abortSignal: async () => ({ data: [], error: null }) }) }),
    upsert: () => ({ abortSignal: async () => ({ error: null }) }) });
  host = document.createElement('div'); document.body.appendChild(host); root = createRoot(host);
});
afterEach(() => { act(() => root.unmount()); host.remove(); jest.clearAllMocks(); });
const click = text => act(() => Simulate.click([...host.querySelectorAll('button')].find(b => b.textContent.includes(text))));
const fill = (placeholder, value) => {
  const field = [...host.querySelectorAll('input,textarea')].find(n => n.placeholder.includes(placeholder));
  act(() => { field.value = value; Simulate.change(field); });
};

test('a late cached login preserves the capture draft and saves it to that account', async () => {
  await act(async () => root.render(<PersonalVocabulary onClassic={() => {}}/>));
  click('Add a word or phrase'); fill('e.g. read the room', 'forte');
  fill('What does it mean', 'A strength or talent.');
  await act(async () => arriveSession({ data: { session: { user: { id: 'alice' } } } }));
  expect(host.querySelector('form')).not.toBeNull();
  expect([...host.querySelectorAll('input')].find(n => n.placeholder.includes('e.g. read the room')).value).toBe('forte');
  await act(async () => Simulate.submit(host.querySelector('form')));
  expect(JSON.parse(localStorage.getItem(deckKey('alice'))).entries[0].definition).toBe('A strength or talent.');
  expect(JSON.parse(localStorage.getItem(deckKey())).entries).toHaveLength(0);
});

test('words saved before login are discoverable and can be brought into the account explicitly', async () => {
  const entry = createEntry({ term: 'guest phrase', definition: 'A useful phrase.' }, 1);
  localStorage.setItem(deckKey(), JSON.stringify({ ...emptyDeck(), entries: [entry] }));
  await act(async () => root.render(<PersonalVocabulary onClassic={() => {}}/>));
  expect(host.querySelector('.pv-word-card').textContent).toContain('guest phrase');
  await act(async () => arriveSession({ data: { session: { user: { id: 'alice' } } } }));
  expect(host.textContent).toContain('saved before signing in');
  expect(JSON.parse(localStorage.getItem(deckKey('alice'))).entries).toHaveLength(0);
  click('Bring my words here');
  expect(host.querySelector('.pv-word-card').textContent).toContain('guest phrase');
  expect(JSON.parse(localStorage.getItem(deckKey('alice'))).entries).toHaveLength(1);
  expect(JSON.parse(localStorage.getItem(deckKey())).entries).toHaveLength(1);
});
