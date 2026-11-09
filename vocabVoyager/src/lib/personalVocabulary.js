export const normalizeTerm = value => value.normalize('NFKC').trim().replace(/[‘’]/g, "'").replace(/\s+/g, ' ').toLowerCase();
export const DAY = 86400000;
export const emptyDeck = () => ({ version: 1, visit: 0, lastOpenedAt: 0, entries: [] });
export const deckKey = owner => `vv.personal.v1.${owner || 'guest'}`;

export function openVisit(deck, now = Date.now()) {
  // A reload or a second tab is not another learning visit.
  if (deck.lastOpenedAt && now - deck.lastOpenedAt < 30 * 60000) return deck;
  return { ...deck, visit: deck.visit + 1, lastOpenedAt: now };
}

export function createEntry(fields, visit, now = Date.now()) {
  return { ...fields, term: fields.term.trim().replace(/\s+/g, ' '),
    id: normalizeTerm(fields.term), createdAt: now, updatedAt: now,
    stage: 0, reviews: 0, lapses: 0, nextVisit: visit, dueAt: now, lastReviewedAt: 0, deleted: false };
}

export function gradeEntry(entry, grade, visit, now = Date.now()) {
  const stage = grade === 'again' ? 0 : Math.min(6, (entry.stage || 0) + (grade === 'easy' ? 2 : 1));
  const visits = [1, 1, 2, 4, 7, 12, 20][stage];
  const days = [0, 1, 3, 7, 14, 30, 60][stage];
  return { ...entry, stage, reviews: (entry.reviews || 0) + 1,
    lapses: (entry.lapses || 0) + (grade === 'again' ? 1 : 0),
    lastReviewedAt: now, updatedAt: now, nextVisit: visit + visits, dueAt: now + days * DAY };
}

export function reviewQueue(deck, now = Date.now(), limit = 5) {
  return deck.entries.filter(e => !e.deleted && e.definition &&
    (e.nextVisit <= deck.visit || e.dueAt <= now))
    .sort((a, b) => (a.lastReviewedAt || 0) - (b.lastReviewedAt || 0) || b.createdAt - a.createdAt)
    .slice(0, limit);
}

export function mergeEntries(local, remote) {
  const all = new Map();
  [...remote, ...local].forEach(entry => {
    const old = all.get(entry.id);
    if (!old || entry.updatedAt >= old.updatedAt) all.set(entry.id, entry);
  });
  return [...all.values()].sort((a, b) => b.createdAt - a.createdAt);
}

export function readDeck(storage, owner) {
  const raw = storage.getItem(deckKey(owner));
  if (!raw) return emptyDeck();
  const value = JSON.parse(raw);
  if (value.version !== 1 || !Array.isArray(value.entries) || !Number.isInteger(value.visit) || value.visit < 0 || !Number.isFinite(value.lastOpenedAt)) throw new Error('Unrecognised vocabulary backup.');
  return { ...value, entries: validateBackup(value) };
}

export function validateBackup(value) {
  if (value?.version !== 1 || !Array.isArray(value.entries) || value.entries.length > 5000) throw new Error('Choose a VocabVoyager JSON backup (up to 5,000 entries).');
  return value.entries.map(e => {
    if (!e || typeof e.term !== 'string' || !e.term.trim() || e.term.length > 120 ||
      typeof e.definition !== 'string' || e.definition.length > 6000 || !Number.isFinite(e.updatedAt) ||
      !Number.isFinite(e.createdAt) || !Number.isFinite(e.dueAt) || !Number.isInteger(e.nextVisit) ||
      ['heardIn', 'quote', 'register', 'origin', 'usage', 'popularity', 'partOfSpeech', 'phonetic'].some(key => e[key] !== undefined && typeof e[key] !== 'string')) throw new Error('This backup contains an invalid entry. Nothing was imported.');
    return { ...e, id: normalizeTerm(e.term), stage: Math.max(0, Math.min(6, Number(e.stage) || 0)),
      examples: Array.isArray(e.examples) ? e.examples.filter(x => typeof x?.text === 'string' && typeof x?.scenario === 'string').slice(0, 12) : [],
      sources: Array.isArray(e.sources) ? e.sources.filter(x => typeof x?.url === 'string' && typeof x?.label === 'string') : [] };
  });
}
