import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { Simulate } from 'react-dom/test-utils';
import PersonalVocabulary from './PersonalVocabulary';
import { deckKey } from '../lib/personalVocabulary';
import lookupHandler from '../../api/vocabulary-lookup';

jest.mock('../lib/supabase', () => ({ isSupabaseConfigured: false, supabase: {} }));
let host, root;
beforeEach(() => {
  localStorage.clear();
  global.fetch = jest.fn(async () => ({ ok: false }));
  host = document.createElement('div'); document.body.appendChild(host); root = createRoot(host);
});
afterEach(() => { act(() => root.unmount()); host.remove(); jest.restoreAllMocks(); });
const click = text => {
  const button = [...host.querySelectorAll('button')].find(b => b.textContent.includes(text));
  if (!button) throw new Error(`Missing button: ${text}`);
  act(() => Simulate.click(button));
};
const fill = (placeholder, value) => {
  const node = [...host.querySelectorAll('input,textarea')].find(n => n.placeholder.includes(placeholder));
  act(() => { node.value = value; Simulate.change(node); });
};

test('a guest can choose a thesaurus sense, save it, and recall it in the existing deck', async () => {
  fetch.mockImplementation(async url => url.startsWith('/api/vocabulary-lookup?') ? {
    ok: true, json: async () => ({ dictionary: [{ meanings: [
      { partOfSpeech: 'noun', definitions: [{ definition: 'The edge of a river.', synonyms: ['riverside'] }] },
      { partOfSpeech: 'verb', definitions: [{ definition: 'Tilt while turning.', synonyms: ['tilt'], antonyms: ['level'] }] },
    ] }] }),
  } : { ok: false });
  await act(async () => root.render(<PersonalVocabulary initialTab="thesaurus" onClassic={() => {}}/>));
  const guide = document.querySelector('dialog.screen-guide-panel');
  guide.showModal = jest.fn();
  act(() => document.querySelector('button[aria-label="Help for this screen"]').click());
  expect(guide.showModal).toHaveBeenCalledTimes(1);
  expect(guide.querySelector('strong').textContent).toBe('broader, source-backed nuance guidance');
  expect([...guide.querySelectorAll('em')].map(term => term.textContent)).toEqual(['confident', 'assertive', 'arrogant']);
  fill('e.g. sharp', 'bank');
  await act(async () => Simulate.submit(host.querySelector('.vt-form')));
  const senses = host.querySelectorAll('.vt-card');
  expect(senses[0].textContent).toContain('riverside');
  expect(senses[0].textContent).not.toContain('Antonyms');
  expect(senses[1].textContent).toContain('Antonyms for this sense');
  act(() => Simulate.click(senses[1].querySelector('.pv-secondary')));
  await act(async () => Simulate.submit(host.querySelector('[role="dialog"] form')));
  expect(JSON.parse(localStorage.getItem(deckKey())).entries[0]).toMatchObject({ term: 'bank', definition: 'Tilt while turning.', partOfSpeech: 'verb' });
  click('A quick practice'); click('Reveal & compare');
  expect(host.textContent).toContain('Tilt while turning.');
});

test('a phrase can be captured offline, saved intact and recalled after remount', async () => {
  await act(async () => root.render(<PersonalVocabulary onClassic={() => {}}/>));
  click('Add a word or phrase');
  fill('e.g. read the room', 'read the room');
  fill('What does it mean', 'Notice how the people around you feel.');
  fill('Show, episode', 'A TV interview');
  await act(async () => Simulate.submit(host.querySelector('form')));
  const saved = JSON.parse(localStorage.getItem(deckKey()));
  expect(saved.entries[0].term).toBe('read the room');
  expect(host.textContent).toContain('1 word is ready');
  act(() => root.unmount()); root = createRoot(host);
  await act(async () => root.render(<PersonalVocabulary onClassic={() => {}}/>));
  expect(host.textContent).toContain('read the room');
  expect(JSON.parse(localStorage.getItem(deckKey())).visit).toBe(saved.visit);
  click('A quick practice');
  expect(host.textContent).toContain('WHAT DOES THIS MEAN?');
  expect(host.textContent).not.toContain('Notice how the people around you feel.');
  click('Reveal & compare');
  expect(host.textContent).toContain('Notice how the people around you feel.');
  click('Slipped away');
  expect(host.textContent).toContain('2 / 2');
  click('Reveal & compare'); click('Slipped away');
  expect(host.textContent).toContain('A little more yours.');
  expect(JSON.parse(localStorage.getItem(deckKey())).entries[0].reviews).toBe(2);
});

test('a missing meaning can be saved but is excluded from practice', async () => {
  await act(async () => root.render(<PersonalVocabulary onClassic={() => {}}/>));
  click('Add a word or phrase'); fill('e.g. read the room', 'new slang');
  await act(async () => Simulate.submit(host.querySelector('form')));
  expect(JSON.parse(localStorage.getItem(deckKey())).entries[0].term).toBe('new slang');
  const practice = [...host.querySelectorAll('button')].find(b => b.textContent.includes('A quick practice'));
  expect(practice.disabled).toBe(true);
});

test('duplicate phrases do not silently overwrite earlier entries', async () => {
  await act(async () => root.render(<PersonalVocabulary onClassic={() => {}}/>));
  click('Add a word or phrase'); fill('e.g. read the room', 'read the room');
  await act(async () => Simulate.submit(host.querySelector('form')));
  click('Add a word or phrase'); fill('e.g. read the room', 'READ  THE ROOM');
  await act(async () => Simulate.submit(host.querySelector('form')));
  expect(host.textContent).toContain('Already in your collection');
  expect(JSON.parse(localStorage.getItem(deckKey())).entries).toHaveLength(1);
});

test('removed entries can be restored after closing the undo dialog', async () => {
  await act(async () => root.render(<PersonalVocabulary onClassic={() => {}}/>));
  click('Add a word or phrase'); fill('e.g. read the room', 'keep this phrase');
  await act(async () => Simulate.submit(host.querySelector('form')));
  const card = host.querySelector('.pv-word-card');
  act(() => Simulate.click(card)); click('Remove');
  act(() => Simulate.click(host.querySelector('[aria-label="Close dialog"]')));
  expect(host.querySelectorAll('.pv-word-card')).toHaveLength(0);
  act(() => Simulate.click(host.querySelector('[aria-label="Restore removed entries"]')));
  click('Restore');
  act(() => Simulate.click(host.querySelector('[aria-label="Close dialog"]')));
  expect(host.querySelector('.pv-word-card').textContent).toContain('keep this phrase');
});

test('saving during a pending lookup stays enabled, cancels lookup, and survives reopening', async () => {
  let signal;
  fetch.mockImplementation((url, options) => {
    if (!url.startsWith('/api/vocabulary-lookup?')) return Promise.resolve({ ok: false });
    signal = options.signal;
    return new Promise((resolve, reject) => signal.addEventListener('abort', () => reject(new DOMException('Cancelled', 'AbortError')), { once: true }));
  });
  await act(async () => root.render(<PersonalVocabulary onClassic={() => {}}/>));
  click('Add a word or phrase'); fill('e.g. read the room', 'forte');
  click('Look it up');
  expect(signal.aborted).toBe(false);
  const saveButton = [...host.querySelectorAll('button')].find(b => b.textContent.includes('Save to my vocabulary'));
  expect(saveButton.disabled).toBe(false);
  await act(async () => Simulate.submit(host.querySelector('form')));
  expect(signal.aborted).toBe(true);
  expect(host.querySelector('form')).toBeNull();
  expect(host.textContent).toContain('saved on this browser');
  act(() => root.unmount()); root = createRoot(host);
  await act(async () => root.render(<PersonalVocabulary onClassic={() => {}}/>));
  expect(host.querySelector('.pv-word-card').textContent).toContain('forte');
  expect(JSON.parse(localStorage.getItem(deckKey())).entries).toHaveLength(1);
});

test('a full browser keeps the draft open and a retry saves exactly once', async () => {
  await act(async () => root.render(<PersonalVocabulary onClassic={() => {}}/>));
  click('Add a word or phrase'); fill('e.g. read the room', 'forte');
  fill('What does it mean', 'A strength or talent.');
  const storage = jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new DOMException('Full', 'QuotaExceededError'); });
  await act(async () => Simulate.submit(host.querySelector('form')));
  expect(host.querySelector('form')).not.toBeNull();
  expect(host.textContent).toContain('Your draft is still here');
  expect(host.textContent).toContain('Download this draft');
  expect(JSON.parse(localStorage.getItem(deckKey())).entries).toHaveLength(0);
  storage.mockRestore();
  await act(async () => Simulate.submit(host.querySelector('form')));
  expect(host.querySelector('form')).toBeNull();
  expect(JSON.parse(localStorage.getItem(deckKey())).entries).toHaveLength(1);
});

test('forte travels through the server fallback into a saved notebook entry', async () => {
  const upstream = async url => {
    if (url.startsWith('https://freedictionaryapi.com/')) throw new Error('provider down');
    return { ok: true, status: 200, json: async () => url.startsWith('https://api.dictionaryapi.dev/')
      ? [{ meanings: [{ partOfSpeech: 'noun', definitions: [{ definition: 'A strength or talent.', example: 'Speaking is her forte.' }] }] }] : {} };
  };
  const browserRequests = [];
  fetch.mockImplementation(async (url, options) => {
    if (url.startsWith('https://')) return upstream(url);
    browserRequests.push(url);
    if (!url.startsWith('/api/vocabulary-lookup?')) return { ok: false };
    const term = new URL(url, 'https://vocab-voyager.vercel.app').searchParams.get('term');
    const res = { setHeader() {}, status(code) { this.code = code; return this; }, json(data) { this.data = data; return this; } };
    await lookupHandler({ method: 'GET', query: { term } }, res);
    return { ok: res.code === 200, status: res.code, json: async () => res.data };
  });
  await act(async () => root.render(<PersonalVocabulary onClassic={() => {}}/>));
  click('Add a word or phrase'); fill('e.g. read the room', 'forte');
  await act(async () => { click('Look it up'); });
  expect([...host.querySelectorAll('textarea')].find(n => n.placeholder.includes('What does it mean')).value).toBe('A strength or talent.');
  await act(async () => Simulate.submit(host.querySelector('form')));
  const entry = JSON.parse(localStorage.getItem(deckKey())).entries[0];
  expect(entry.term).toBe('forte');
  expect(entry.definition).toBe('A strength or talent.');
  expect(entry.examples[0].text).toBe('Speaking is her forte.');
  expect(browserRequests.every(url => url.startsWith('/api/'))).toBe(true);
});
