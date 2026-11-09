import { createEntry, DAY, emptyDeck, gradeEntry, mergeEntries, normalizeTerm, openVisit, readDeck, reviewQueue, validateBackup, deckKey } from './personalVocabulary';

test('preserves phrases and punctuation while detecting duplicates', () => {
  expect(normalizeTerm('  Don’t   sweat it! ')).toBe("don't sweat it!");
  const entry = createEntry({ term: 'read the room', definition: 'Notice the mood' }, 3, 1000);
  expect(entry.term).toBe('read the room');
  expect(entry.nextVisit).toBe(3);
});

test('reloads within 30 minutes do not advance the visit', () => {
  const first = openVisit(emptyDeck(), 100000);
  expect(openVisit(first, 100001).visit).toBe(1);
  expect(openVisit(first, 2000000).visit).toBe(2);
});

test('new words are due now; good and easy recall give more space', () => {
  const now = 100000;
  const entry = createEntry({ term: 'serendipity', definition: 'A fortunate discovery' }, 1, now);
  expect(reviewQueue({ visit: 1, entries: [entry] }, now)).toEqual([entry]);
  const good = gradeEntry(entry, 'good', 1, now);
  const easy = gradeEntry(entry, 'easy', 1, now);
  expect(reviewQueue({ visit: 1, entries: [good] }, now)).toHaveLength(0);
  expect(easy.nextVisit).toBeGreaterThan(good.nextVisit);
  expect(easy.dueAt).toBeGreaterThan(good.dueAt);
  expect(reviewQueue({ visit: good.nextVisit, entries: [good] }, now)).toHaveLength(1);
});

test('a long break brings back words even without frequent logins', () => {
  const entry = gradeEntry(createEntry({ term: 'eloquent', definition: 'Expressive' }, 1, 100), 'easy', 1, 100);
  expect(reviewQueue({ visit: 1, entries: [entry] }, 100 + 4 * DAY)).toHaveLength(1);
});

test('misses reset spacing and a queue stays bounded with no blank or removed cards', () => {
  const entry = gradeEntry({ ...createEntry({ term: 'a', definition: 'b' }, 3, 100), stage: 5 }, 'again', 3, 100);
  expect(entry.stage).toBe(0); expect(entry.lapses).toBe(1);
  const many = Array.from({ length: 20 }, (_, i) => ({ ...entry, id: String(i), createdAt: i }));
  expect(reviewQueue({ visit: 3, entries: many }, 100)).toHaveLength(5);
  expect(reviewQueue({ visit: 3, entries: [{ ...entry, deleted: true }, { ...entry, definition: '' }] }, 100)).toHaveLength(0);
});

test('newer edits and deletion markers survive a merge', () => {
  const a = createEntry({ term: 'a', definition: 'b' }, 1, 100);
  expect(mergeEntries([{ ...a, deleted: true, updatedAt: 200 }], [a])[0].deleted).toBe(true);
  expect(mergeEntries([a], [{ ...a, definition: 'new', updatedAt: 200 }])[0].definition).toBe('new');
});

test('guest and account storage are separate and broken backups fail safely', () => {
  localStorage.clear();
  localStorage.setItem(deckKey('user-a'), JSON.stringify({ ...emptyDeck(), visit: 9 }));
  expect(readDeck(localStorage, 'user-a').visit).toBe(9);
  expect(readDeck(localStorage, 'user-b').visit).toBe(0);
  expect(readDeck(localStorage).visit).toBe(0);
  expect(() => validateBackup({ version: 1, entries: [{ term: 'partial' }] })).toThrow();
  const entry = createEntry({ ...{ term: 'room', definition: 'place' }, examples: [], sources: [] }, 1, 100);
  expect(validateBackup({ version: 1, entries: [entry] })).toHaveLength(1);
});
