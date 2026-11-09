import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { deckKey, emptyDeck, mergeEntries, openVisit, readDeck, validateBackup } from '../lib/personalVocabulary';

export default function usePersonalVocabulary(owner) {
  const [deck, setDeck] = useState(emptyDeck);
  const [status, setStatus] = useState('Saved on this browser');
  const [error, setError] = useState('');
  const [ready, setReady] = useState(false);
  const [revision, setRevision] = useState(0);
  const ref = useRef(deck);
  const generation = useRef(0);
  const locked = useRef(false);
  const flights = useRef(new Map());

  useEffect(() => {
    generation.current += 1;
    setReady(false); locked.current = false;
    try {
      const loaded = openVisit(readDeck(localStorage, owner));
      ref.current = loaded; setDeck(loaded); setError('');
      try { localStorage.setItem(deckKey(owner), JSON.stringify(loaded)); }
      catch { setError('Your saved words were opened, but browser storage is full or unavailable. Export a backup before leaving.'); }
    } catch {
      locked.current = true; ref.current = emptyDeck(); setDeck(ref.current);
      setError('Browser storage could not be opened. Existing data has not been overwritten. Export any unsaved work before leaving.');
    }
    setStatus('Saved on this browser'); setReady(true);
  }, [owner]);

  const update = useCallback((change, { requirePersistence = false } = {}) => {
    const next = change(ref.current);
    if (next === ref.current) return { persisted: !locked.current, changed: false };
    let failure = null;
    try {
      if (locked.current) throw new Error('Storage unavailable');
      localStorage.setItem(deckKey(owner), JSON.stringify(next));
      setError(''); setStatus(owner ? 'Saved here · sync pending' : 'Saved on this browser');
    } catch {
      const message = 'Changes are only in memory: browser storage is unavailable or full. Export a backup before leaving.';
      setError(message); setStatus('Not saved to this browser');
      failure = message;
    }
    if (failure && requirePersistence) return { persisted: false, changed: false, error: failure };
    ref.current = next; setDeck(next); setRevision(v => v + 1);
    return { persisted: !failure, changed: true, error: failure };
  }, [owner]);

  const sync = useCallback(async function synchronize() {
    if (!owner || !isSupabaseConfigured) return;
    const current = generation.current;
    if (flights.current.has(current)) { flights.current.get(current).pending = true; return; }
    const flight = { pending: false }; flights.current.set(current, flight);
    setStatus('Syncing…');
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);
      let result;
      try { result = await supabase.from('personal_vocabulary').select('entry_id,payload').eq('user_id', owner).abortSignal(controller.signal); }
      finally { clearTimeout(timeout); }
      if (result.error) throw result.error;
      if (generation.current !== current) return;
      const incoming = validateBackup({ version: 1, entries: (result.data || []).map(r => ({ ...r.payload, id: r.entry_id, nextVisit: ref.current.visit + 1 })) });
      const merged = mergeEntries(ref.current.entries, incoming);
      const next = { ...ref.current, entries: merged };
      ref.current = next; setDeck(next);
      if (!locked.current) localStorage.setItem(deckKey(owner), JSON.stringify(next));
      if (merged.length) {
        const pushController = new AbortController();
        const pushTimeout = setTimeout(() => pushController.abort(), 10000);
        try {
          const { error: pushError } = await supabase.from('personal_vocabulary').upsert(merged.map(e => ({ user_id: owner, entry_id: e.id, payload: e })), { onConflict: 'user_id,entry_id' }).abortSignal(pushController.signal);
          if (pushError) throw pushError;
        } finally { clearTimeout(pushTimeout); }
      }
      if (generation.current === current) setStatus('Synced to your account');
    } catch (error) {
      if (generation.current === current) setStatus(['42P01', 'PGRST205'].includes(error.code)
        ? 'Saved here · account sync needs setup' : 'Saved here · cloud unavailable');
    }
    finally {
      flights.current.delete(current);
      if (flight.pending && generation.current === current) void synchronize();
    }
  }, [owner]);

  useEffect(() => {
    if (!ready || !owner) return;
    const timer = setTimeout(sync, 1500);
    return () => clearTimeout(timer);
    // Only local edits trigger syncing; the merge itself must not start a sync loop.
  }, [ready, owner, revision, sync]);

  useEffect(() => {
    if (!ready) return;
    const resume = () => { if (document.visibilityState === 'visible') update(d => openVisit(d)); };
    const changed = event => {
      if (event.key !== deckKey(owner) || !event.newValue || locked.current) return;
      try {
        const other = JSON.parse(event.newValue);
        if (other.version !== 1 || !Array.isArray(other.entries)) return;
        // A storage event already represents a persisted edit; do not echo it back.
        const next = { ...ref.current, visit: Math.max(ref.current.visit, other.visit), lastOpenedAt: Math.max(ref.current.lastOpenedAt, other.lastOpenedAt), entries: mergeEntries(ref.current.entries, other.entries) };
        ref.current = next; setDeck(next);
      } catch { /* Leave the current notebook intact. */ }
    };
    window.addEventListener('focus', resume); document.addEventListener('visibilitychange', resume); window.addEventListener('storage', changed);
    return () => { window.removeEventListener('focus', resume); document.removeEventListener('visibilitychange', resume); window.removeEventListener('storage', changed); };
  }, [ready, owner, update]);

  return { deck, update, status, error, ready, sync };
}
