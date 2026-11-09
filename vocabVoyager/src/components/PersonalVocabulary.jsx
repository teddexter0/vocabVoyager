import ScreenGuide from './ScreenGuide';
import React, { useEffect, useRef, useState } from 'react';
import { ArrowUpRight, ArrowRight, BookOpen, Plus, Search, Volume2, RefreshCw, Download, Upload, X, Check, LogIn, LogOut, Bookmark, Sparkles, Headphones, Trash2 } from 'lucide-react';
import usePersonalVocabulary from '../hooks/usePersonalVocabulary';
import { createEntry, gradeEntry, mergeEntries, normalizeTerm, readDeck, reviewQueue, validateBackup } from '../lib/personalVocabulary';
import { lookupVocabulary, safeUrl } from '../lib/vocabularyLookup';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import './PersonalVocabulary.css';
import Thesaurus from './Thesaurus';

const SCENARIOS = ['With friends', 'At school or work', 'Telling a story'];
const blankForm = () => ({ term: '', definition: '', heardIn: '', quote: '', register: '', origin: '', usage: '', popularity: '', examples: SCENARIOS.map(scenario => ({ scenario, text: '', kind: 'personal' })), sources: [] });
const Link = ({ url, children }) => safeUrl(url) ? <a href={safeUrl(url)} target="_blank" rel="noreferrer">{children}<ArrowUpRight size={13}/></a> : <span>{children}</span>;

function Sources({ sources = [] }) {
  return <div className="pv-sources">{sources.map((s, i) => <span key={i}><Link url={s.url}>{s.label}</Link>{s.license && <> · <Link url={s.licenseUrl}>{s.license}</Link></>}</span>)}{sources.some(s => s.label.includes('FreeDictionaryAPI')) && <Link url="https://freedictionaryapi.com">Powered by FreeDictionaryAPI.com</Link>}</div>;
}

function EntryDetails({ entry }) {
  return <>
    <p className="pv-meaning">{entry.definition || 'Meaning still to explore. Edit this entry to add one before practising.'}</p>
    <div className="pv-tags">{entry.partOfSpeech && <span>{entry.partOfSpeech}</span>}{entry.register && <span>{entry.register}</span>}</div>
    {(entry.quote || entry.heardIn) && <div className="pv-quote"><p>{entry.quote ? `“${entry.quote}”` : 'Your memory anchor'}</p><small>{entry.heardIn}</small></div>}
    <h3>Where it fits</h3><p>{entry.usage || 'Check the register above and the original scene. Who is speaking, to whom, and how formal is it?'}</p>
    <h3>Origin & evolution</h3><p className="pv-prewrap">{entry.origin || 'An origin was not found in the free sources. Use the research links to investigate.'}</p>
    <h3>Popularity & cultural context</h3><p>{entry.popularity || 'Current popularity has not been verified. A dictionary entry does not show how common something is today.'}</p>
    <div className="pv-research"><Link url={`https://trends.google.com/trends/explore?q=${encodeURIComponent(entry.term)}`}>Explore search interest</Link><Link url={`https://www.google.com/search?q=${encodeURIComponent(`"${entry.term}" origin usage expression`)}`}>Research usage & history</Link><Link url={`https://youglish.com/pronounce/${encodeURIComponent(entry.term)}/english`}>Hear it in real speech</Link></div>
    <h3>Put it in a scene</h3>
    <div className="pv-scenarios">{(entry.examples || []).filter(e => e.text).map((example, i) => <div key={i}><small>{example.scenario} · {example.kind === 'source' ? 'dictionary / published usage' : example.kind === 'ai' ? 'AI practice example' : 'your example'}</small><p>“{example.text}”</p></div>)}</div>
    <Sources sources={entry.sources}/>
  </>;
}

export default function PersonalVocabulary({ onClassic, initialTab = 'home' }) {
  const [user, setUser] = useState(null);
  const [tab, setTab] = useState(initialTab);
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState(blankForm);
  const [senses, setSenses] = useState([]);
  const [lookupMessage, setLookupMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [query, setQuery] = useState('');
  const [review, setReview] = useState(null);
  const [revealed, setRevealed] = useState(false);
  const [answer, setAnswer] = useState('');
  const [authBusy, setAuthBusy] = useState(false);
  const [authMessage, setAuthMessage] = useState('');
  const [examplesAvailable, setExamplesAvailable] = useState(false);
  const [browserWords, setBrowserWords] = useState(0);
  const lookupRef = useRef(null);
  const modalRef = useRef(null);
  const importRef = useRef(null);
  const editingRef = useRef(null);
  const { deck, update, status, error, ready, sync } = usePersonalVocabulary(user?.id);
  const entries = deck.entries.filter(e => !e.deleted);
  const removed = deck.entries.filter(e => e.deleted);
  const due = reviewQueue(deck);

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    // Cached auth lets the local notebook open even when the remote project is paused.
    let active = true;
    supabase.auth.getSession().then(({ data }) => { if (active) setUser(data.session?.user || null); }).catch(() => {});
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => setUser(session?.user || null));
    return () => { active = false; subscription.unsubscribe(); };
  }, []);

  useEffect(() => {
    setReview(null);
    // A cached session may arrive after typing begins. Keep the capture draft.
    setModal(current => current === 'capture' ? current : null);
    editingRef.current = null;
    try { setBrowserWords(user?.id ? readDeck(localStorage).entries.filter(entry => !entry.deleted).length : 0); }
    catch { setBrowserWords(0); }
  }, [user?.id]);
  useEffect(() => {
    if (!modal) return;
    const previous = document.activeElement;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const timer = setTimeout(() => modalRef.current?.querySelector('input,button,textarea,select')?.focus(), 0);
    const keys = event => {
      if (event.key === 'Escape') { lookupRef.current?.abort(); setModal(null); }
      if (event.key === 'Tab') {
        const targets = [...modalRef.current.querySelectorAll('button,input,select,textarea,a[href]')].filter(n => !n.disabled);
        const first = targets[0], last = targets[targets.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }
    };
    document.addEventListener('keydown', keys);
    return () => { clearTimeout(timer); document.body.style.overflow = overflow; document.removeEventListener('keydown', keys); previous?.focus(); };
  }, [modal]);

  useEffect(() => () => lookupRef.current?.abort(), []);
  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    fetch('/api/vocabulary-examples', { signal: controller.signal }).then(r => r.ok ? r.json() : null)
      .then(data => setExamplesAvailable(Boolean(data?.available))).catch(() => {});
    return () => { clearTimeout(timer); controller.abort(); };
  }, []);

  const openCapture = (term = '', entry = null) => {
    lookupRef.current?.abort(); setBusy(false); setLookupMessage(''); setSenses([]);
    editingRef.current = entry?.id || null;
    setForm(entry ? { ...blankForm(), ...entry } : { ...blankForm(), term }); setModal('capture');
  };
  const captureSense = (result, sense) => {
    openCapture(result.term);
    setForm({
      ...blankForm(), term: result.term, origin: result.origin, usage: result.usage, sources: result.sources,
      definition: sense?.definition || '', register: sense?.register || '', partOfSpeech: sense?.partOfSpeech || '',
      phonetic: sense?.phonetic || '', examples: sense?.examples?.length ? sense.examples : blankForm().examples,
    });
  };
  const close = () => { lookupRef.current?.abort(); setBusy(false); setModal(null); };
  const change = (key, value) => setForm(f => ({ ...f, [key]: value }));
  const chooseSense = sense => setForm(f => ({ ...f, ...sense, examples: sense.examples.length ? sense.examples : blankForm().examples }));

  const lookup = async () => {
    lookupRef.current?.abort();
    const controller = new AbortController(); lookupRef.current = controller;
    setBusy(true); setLookupMessage(''); setSenses([]);
    try {
      const result = await lookupVocabulary(form.term, { signal: controller.signal });
      if (controller.signal.aborted || lookupRef.current !== controller) return;
      setSenses(result.senses); setLookupMessage(result.message);
      setForm(f => ({ ...f, sources: result.sources, origin: result.origin, usage: result.usage,
        ...(result.senses[0] || {}), examples: result.senses[0]?.examples.length ? result.senses[0].examples : f.examples }));
    } catch (err) { if (err.name !== 'AbortError') setLookupMessage(err.message); }
    finally { if (lookupRef.current === controller) setBusy(false); }
  };

  const save = event => {
    event.preventDefault();
    const id = normalizeTerm(form.term);
    if (!id) return;
    if (entries.some(e => e.id === id && e.id !== editingRef.current)) { setLookupMessage('Already in your collection. Open the existing entry to edit it.'); return; }
    const previous = deck.entries.find(e => e.id === editingRef.current);
    const saved = previous ? { ...previous, ...form, id, updatedAt: Date.now() } : createEntry(form, deck.visit);
    const result = update(d => ({ ...d, entries: [saved, ...d.entries.filter(e => e.id !== id).map(e => e.id === editingRef.current ? { ...e, deleted: true, updatedAt: Date.now() } : e)] }), { requirePersistence: true });
    if (!result.persisted) {
      setLookupMessage('This browser could not save the word. Your draft is still here. Free some browser storage or download this draft before leaving.');
      return;
    }
    setNotice(`“${form.term.trim()}” saved on this browser. ${form.definition ? 'Ready to practise.' : 'Add a meaning whenever you are ready.'}`);
    setTab('home'); setQuery(''); close();
  };

  const generateExamples = async () => {
    if (!user) { setLookupMessage('Sign in using Account sync to generate three practice scenes. You can save your phrase first.'); return; }
    lookupRef.current?.abort(); const controller = new AbortController(); lookupRef.current = controller;
    setBusy(true); setLookupMessage('');
    const timeout = setTimeout(() => controller.abort(), 25000);
    try {
      const { data } = await supabase.auth.getSession();
      const response = await fetch('/api/vocabulary-examples', { method: 'POST', signal: controller.signal,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${data.session?.access_token || ''}` },
        body: JSON.stringify({ term: form.term, definition: form.definition, register: form.register }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Practice scenes are unavailable.');
      if (lookupRef.current === controller) setForm(f => ({ ...f, examples: result.examples }));
    } catch (err) { if (err.name !== 'AbortError') setLookupMessage(err.message); }
    finally { clearTimeout(timeout); if (lookupRef.current === controller) setBusy(false); }
  };

  const startReview = () => { setReview({ queue: due, index: 0, retry: [], results: 0 }); setRevealed(false); setAnswer(''); setTab('practice'); };
  const grade = rating => {
    const entry = review.queue[review.index];
    update(d => ({ ...d, entries: d.entries.map(e => e.id === entry.id ? gradeEntry(e, rating, d.visit) : e) }));
    // Missed cards return after other cards, with a maximum of one retry per session.
    const retry = rating === 'again' && !review.retry.includes(entry.id);
    setReview(r => ({ ...r, queue: retry ? [...r.queue, entry] : r.queue, retry: retry ? [...r.retry, entry.id] : r.retry,
      index: r.index + 1, results: r.results + 1 }));
    setRevealed(false); setAnswer('');
  };

  const exportDeck = () => {
    const blob = new Blob([JSON.stringify(deck, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob); const link = document.createElement('a');
    link.href = url; link.download = `vocab-voyager-${new Date().toISOString().slice(0, 10)}.json`; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const exportDraft = () => {
    const draft = createEntry(form, deck.visit);
    const backup = { ...deck, entries: mergeEntries(deck.entries, [draft]) };
    const url = URL.createObjectURL(new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' }));
    const link = document.createElement('a'); link.href = url; link.download = 'vocab-voyager-draft.json'; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const bringBrowserWords = () => {
    try {
      const previous = readDeck(localStorage).entries.filter(entry => !entry.deleted);
      const result = update(d => ({ ...d, entries: mergeEntries(d.entries, previous) }), { requirePersistence: true });
      if (result.persisted) { setBrowserWords(0); setNotice("Your browser words are now in this account's collection. Cloud sync runs separately."); }
    } catch { setNotice('Those browser words could not be opened. Your existing collection was kept.'); }
  };
  const importDeck = async event => {
    const file = event.target.files[0]; event.target.value = '';
    if (!file) return;
    try {
      if (file.size > 10000000) throw new Error('Choose a backup smaller than 10 MB.');
      const imported = validateBackup(JSON.parse(await file.text()));
      update(d => ({ ...d, entries: mergeEntries(d.entries, imported.map(e => ({ ...e, nextVisit: d.visit }))) }));
      setNotice('Backup imported. Newer versions of matching words were kept.');
    } catch (err) { setNotice(err.message); }
  };
  const authenticate = async event => {
    event.preventDefault(); setAuthBusy(true); setAuthMessage('');
    const values = new FormData(event.target);
    let timer;
    try {
      if (!isSupabaseConfigured) throw new Error('Account sync is not configured. Your local notebook is ready to use.');
      const { error: authError } = await Promise.race([
        supabase.auth.signInWithPassword({ email: values.get('email'), password: values.get('password') }),
        new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('Sign-in took too long')), 10000); })
      ]);
      if (authError) throw authError;
      setModal(null);
    } catch { setAuthMessage('Could not sign in. Check your credentials; the database may also be unavailable. You can keep using this browser.'); }
    finally { clearTimeout(timer); setAuthBusy(false); }
  };
  const speak = text => {
    if (!window.speechSynthesis) { setNotice('Text-to-speech is unavailable in this browser. Try “Hear it in real speech” in the entry.'); return; }
    window.speechSynthesis.cancel(); const speech = new SpeechSynthesisUtterance(text); speech.lang = 'en-US'; window.speechSynthesis.speak(speech);
  };

  const activeEntry = modal && typeof modal === 'object' ? deck.entries.find(e => e.id === modal.id) : null;
  const current = review?.queue[review.index];
  const filtered = entries.filter(e => `${e.term} ${e.definition} ${e.heardIn}`.toLowerCase().includes(query.toLowerCase()));
  const field = (key, label, placeholder, multiline = false) => <label className="pv-field">{label}{multiline ? <textarea rows={3} value={form[key] || ''} maxLength={6000} onChange={e => change(key, e.target.value)} placeholder={placeholder}/> : <input value={form[key] || ''} maxLength={key === 'term' ? 120 : 500} onChange={e => change(key, e.target.value)} placeholder={placeholder}/>}</label>;

  return <div className="pv-app">
    {!modal && (
      <ScreenGuide title="What’s next for My Vocabulary" kicker="PRODUCT NOTE">
        <p className="screen-guide-note">
          The next improvement I’d prioritize is <strong>broader, source-backed nuance guidance</strong> so uncommon words get the same depth of comparison as <em>confident</em>, <em>assertive</em>, and <em>arrogant</em>.
        </p>
      </ScreenGuide>
    )}
    <aside className="pv-sidebar"><a className="pv-brand" href="#home" onClick={e => { e.preventDefault(); setTab('home'); }}><span className="pv-brand-icon"><BookOpen size={22}/></span><span>vocab<span className="pv-brand-bottom">voyager<span className="pv-brand-dot">.</span></span></span></a>
      <p className="pv-sidebar-label">YOUR WORDS, YOUR WORLD</p>
      <nav aria-label="Vocabulary modes">{[['home', BookOpen, 'My vocabulary'], ['practice', RefreshCw, 'Recall studio'], ['thesaurus', Search, 'Thesaurus']].map(([key, Icon, label]) => <button key={key} className={tab === key ? 'active' : ''} onClick={() => setTab(key)}><Icon size={19}/>{label}{key === 'practice' && due.length > 0 && <span className="pv-count">{due.length}</span>}</button>)}<button onClick={() => openCapture()}><Plus size={19}/>Capture a phrase</button></nav>
      <div className="pv-sidebar-note"><Headphones size={22}/><p>Heard it.<br/>Loved it.<br/><em>Make it yours.</em></p><small>A little less “I know that word.”<br/>A little more “I use that word.”</small></div>
      <div className="pv-sidebar-bottom"><button onClick={onClassic}><ArrowUpRight size={17}/>Original learning mode</button><a href="https://aave-ebon.vercel.app/" target="_blank" rel="noreferrer">Explore AAVE Ebon <ArrowUpRight size={15}/></a><span>Made for your own pace.</span></div>
    </aside>

    <div className="pv-body"><header className="pv-topbar"><span>THE PERSONAL VOCABULARY NOTEBOOK</span><div><span className="pv-storage"><i/>{status}</span>{user ? <button className="pv-icon-button" aria-label="Sign out" onClick={async () => { await supabase.auth.signOut({ scope: 'local' }); setUser(null); }}><LogOut size={18}/></button> : <button className="pv-account" onClick={() => { setAuthMessage(''); setModal('auth'); }}><LogIn size={16}/>Account sync</button>}</div></header>
    <main className="pv-main">
      {(notice || error) && <div role="status" className="pv-notice"><span>{error || notice}</span><button aria-label="Dismiss message" onClick={() => setNotice('')}><X size={16}/></button></div>}
      {browserWords > 0 && <div className="pv-notice"><span>You have {browserWords} {browserWords === 1 ? 'word' : 'words'} saved before signing in.</span><button className="pv-secondary" onClick={bringBrowserWords}>Bring my words here</button></div>}
      {tab === 'thesaurus' ? <Thesaurus onCapture={captureSense}/> : tab === 'home' ? <>
        <section className="pv-hero"><div className="pv-eyebrow"><span/> COLLECT LANGUAGE. FIND YOUR VOICE.</div><h1>From the screen.<br/><em>Into your vocabulary.</em></h1><p>That perfect phrase from a show. The word that made you pause.<br className="pv-desktop-break"/> Keep it here. Learn its story. Make it part of yours.</p><button className="pv-primary" onClick={() => openCapture()}><Plus size={19}/>Add a word or phrase <ArrowUpRight size={18}/></button><span className="pv-hero-foot">Free lookups · Your pace · No daily streak to keep</span><div className="pv-hero-decoration" aria-hidden="true"><span>on the<br/><em>tip of<br/>my tongue</em></span><Bookmark size={34}/><i>FOUND IN THE WILD ↗</i></div></section>
        <section className="pv-return"><div className="pv-return-icon"><Sparkles size={24}/></div><div><span className="pv-eyebrow">A LITTLE RECALL GOES A LONG WAY</span><h2>{due.length ? `${due.length} ${due.length === 1 ? 'word is' : 'words are'} ready to come back to you.` : entries.length ? 'Your next good word is out there.' : 'Come back whenever. We’ll pick up here.'}</h2><p>{due.length ? 'Recall the meaning. Say it in a scene. See what sticks.' : 'New and tricky words return sooner; familiar ones get more space.'}</p></div><button className="pv-secondary" onClick={startReview} disabled={!due.length || !ready}>A quick practice <ArrowRight size={17}/></button></section>
        <section className="pv-collection"><div className="pv-section-heading"><div><span className="pv-eyebrow">THE WORDS YOU WANT TO KEEP</span><h2>Your collection <span>{entries.length.toString().padStart(2, '0')}</span></h2></div><div className="pv-tools">{removed.length > 0 && <button title="Restore removed entries" aria-label="Restore removed entries" onClick={() => setModal('trash')}><Trash2 size={18}/></button>}<button title="Export backup" aria-label="Export backup" onClick={exportDeck}><Download size={18}/></button><button title="Import backup" aria-label="Import backup" onClick={() => importRef.current.click()}><Upload size={18}/></button>{user && <button aria-label="Retry cloud sync" onClick={sync}><RefreshCw size={18}/></button>}</div></div>
        {entries.length > 0 && <label className="pv-search"><Search size={18}/><input placeholder="Find a word, meaning, or show…" value={query} onChange={e => setQuery(e.target.value)}/></label>}
        {!entries.length ? <div className="pv-empty"><span className="pv-empty-icon"><Bookmark size={30}/></span><h3>Start with something you actually heard.</h3><p>A word. An idiom. A whole expression.<br/>Your collection starts with your curiosity.</p><div className="pv-suggestions">{['read the room', 'serendipity', 'the plot thickens'].map(term => <button key={term} onClick={() => openCapture(term)}>{term}<Plus size={14}/></button>)}</div><button className="pv-text-button" onClick={() => openCapture()}>Capture your first phrase <ArrowRight size={16}/></button></div> : <div className="pv-grid">{filtered.map((entry, i) => <button className="pv-word-card" key={entry.id} onClick={() => setModal({ id: entry.id })}><div className="pv-card-top"><span>{entry.term.includes(' ') ? 'EXPRESSION' : entry.partOfSpeech?.toUpperCase() || 'WORD'}</span><span>{String(i + 1).padStart(2, '0')}</span></div><h3>{entry.term}</h3><p>{entry.definition || 'A meaning waiting to be found.'}</p><div className="pv-card-bottom"><span>{entry.heardIn || 'Found in the wild'}</span><ArrowUpRight size={18}/></div></button>)}{!filtered.length && <p>No matches in your collection.</p>}</div>}
        </section><div className="pv-bottom-note"><span>01. NOTICE IT</span><span>02. UNDERSTAND IT</span><span>03. RECALL IT</span><span>04. MAKE IT YOURS</span></div>
      </> : <section className="pv-practice"><span className="pv-eyebrow">THE RECALL STUDIO</span><h1>Less memorising.<br/><em>More remembering.</em></h1><p>Try recalling before you reveal. Then use it out loud in your own scene.</p>
        {!review ? <div className="pv-practice-start"><RefreshCw size={32}/><h2>{due.length ? `${due.length} ready for a quick return.` : 'You’re caught up for this visit.'}</h2><p>{due.length ? 'Up to five words, with one extra pass for anything that slips away.' : 'Come back later, capture something new, or revisit your collection.'}</p><button className="pv-primary" disabled={!due.length} onClick={startReview}>Start recall <ArrowRight size={17}/></button><p className="pv-fineprint">Visit intervals + elapsed time help words return even after a long break. These are practice heuristics, not a guarantee of retention.</p></div> : !current ? <div className="pv-practice-start"><Check size={38}/><h2>A little more yours.</h2><p>You made {review.results} recall {review.results === 1 ? 'attempt' : 'attempts'}. The words you struggled with will return sooner.</p><button className="pv-primary" onClick={() => { setReview(null); setTab('home'); }}>Back to my vocabulary <ArrowRight size={17}/></button></div> : <div className="pv-recall-card"><div className="pv-card-top"><span>{review.index + 1} / {review.queue.length}</span><span>{current.reviews % 2 ? 'MEANING → PHRASE' : 'PHRASE → MEANING'}</span></div><p className="pv-eyebrow">{current.reviews % 2 ? 'WHICH WORD OR PHRASE MEANS…' : 'WHAT DOES THIS MEAN?'}</p><h2>{current.reviews % 2 ? current.definition : current.term}</h2>{!revealed ? <><label className="pv-field">Your recall (optional)<textarea rows={3} placeholder="Think it, say it, or type it here…" value={answer} onChange={e => setAnswer(e.target.value)}/></label><button className="pv-primary" onClick={() => setRevealed(true)}>Reveal & compare <ArrowRight size={17}/></button></> : <><div className="pv-reveal"><h3>{current.term}<button aria-label="Listen to phrase" onClick={() => speak(current.term)}><Volume2 size={20}/></button></h3><p>{current.definition}</p>{current.examples?.find(e => e.text) && <blockquote>{current.examples.find(e => e.text).text}</blockquote>}<p className="pv-use-prompt">Now say it {['to a friend', 'at school or work', 'while telling a story'][current.reviews % 3]}. Does it fit the register?</p></div><p>How well could you recall it? Your own honest check.</p><div className="pv-grades"><button onClick={() => grade('again')}>Slipped away<small>Try again this session</small></button><button onClick={() => grade('good')}>Got the gist<small>A little more space</small></button><button onClick={() => grade('easy')}>Comes naturally<small>More space next time</small></button></div></>}</div>}
      </section>}
      <footer className="pv-footer"><span>vocab voyager. <em>A notebook for the way you learn.</em></span><span>Saved locally first. Export a backup to keep another copy.</span></footer>
    </main></div>
    <input ref={importRef} type="file" accept="application/json,.json" onChange={importDeck} hidden/>

    {modal && <div className="pv-overlay" onMouseDown={e => { if (e.target === e.currentTarget) close(); }}><section className="pv-modal" ref={modalRef} role="dialog" aria-modal="true" aria-labelledby="pv-dialog-title"><button className="pv-close" onClick={close} aria-label="Close dialog"><X size={22}/></button>
      {modal === 'capture' ? <form onSubmit={save}><span className="pv-eyebrow">FOUND IN THE WILD</span><h2 id="pv-dialog-title">{editingRef.current ? 'Keep making it yours.' : 'What caught your ear?'}</h2><p>A whole phrase stays a whole phrase. Capture the scene, too.</p>
        <label className="pv-field">Word or phrase<input required autoComplete="off" value={form.term} maxLength={120} placeholder="e.g. read the room" onChange={e => { const term = e.target.value; lookupRef.current?.abort(); setBusy(false); setSenses([]); setLookupMessage(''); setForm(f => ({ ...blankForm(), term, heardIn: f.heardIn, quote: f.quote })); }}/></label>
        <button className="pv-secondary pv-lookup" type="button" disabled={busy || !form.term.trim()} onClick={lookup}>{busy ? <RefreshCw className="pv-spin" size={17}/> : <Search size={17}/>} {busy ? 'Checking free sources…' : 'Look it up for free'}</button>
        {lookupMessage && <p className="pv-notice" role="status">{lookupMessage}</p>}
        {senses.length > 1 && <label className="pv-field">Pick the meaning that fits your scene<select defaultValue="0" key={senses.map(s => s.definition).join()} onChange={e => chooseSense(senses[Number(e.target.value)])}>{senses.map((s, i) => <option key={i} value={i}>{s.partOfSpeech} · {s.definition}</option>)}</select></label>}
        {field('definition', 'Meaning in your own words', 'What does it mean in the scene you heard? You can save first and fill this later.', true)}
        <div className="pv-form-grid">{field('heardIn', 'Where did you hear it?', 'Show, episode, interview, or channel')}{field('register', 'Where / with whom it fits', 'Casual, formal, regional, AAVE…')}</div>
        {field('quote', 'The line or moment', 'A short line, timestamp, or a note about the scene', true)}
        <details className="pv-expand" open={Boolean(form.origin)}><summary>Origin, culture & usage</summary>{field('origin', 'Origin / evolution', 'Only add a specific origin when a source supports it.', true)}{field('usage', 'Usage notes', 'Who uses it? When would it sound natural?', true)}{field('popularity', 'Popularity / cultural context', 'Add a source-backed note. Leave blank if unverified.', true)}</details>
        <div className="pv-example-header"><h3>Three different scenes</h3><span>Dictionary examples appear when available.</span></div><p className="pv-fineprint">Write a natural line for each situation. Free dictionaries may have fewer than three examples; empty fields are practice prompts.</p>
        {examplesAvailable ? <><button className="pv-secondary" type="button" disabled={busy || !form.definition.trim()} onClick={generateExamples}><Sparkles size={16}/>Generate three practice scenes</button><p className="pv-fineprint">Sends this phrase, meaning and register to Google Gemini. Examples are AI written and can need correction. Free tier quotas apply.</p></> : <p className="pv-fineprint">Automatic scene generation is not connected on this installation. Dictionary lookup is free without a key.</p>}
        {[0, 1, 2].map(i => <label key={i} className="pv-field">{form.examples[i]?.scenario || SCENARIOS[i]}{form.examples[i]?.kind === 'source' ? ' · sourced' : form.examples[i]?.kind === 'ai' ? ' · AI practice example' : ' · your practice example'}<textarea rows={2} maxLength={2000} value={form.examples[i]?.text || ''} placeholder={`Use “${form.term || 'your phrase'}” ${['with a friend', 'at school or work', 'while telling a story'][i]}.`} onChange={e => { const examples = [...form.examples]; examples[i] = { scenario: SCENARIOS[i], text: e.target.value, kind: 'personal' }; change('examples', examples); }}/></label>)}
        <Sources sources={form.sources}/><div className="pv-modal-actions"><button type="button" className="pv-text-button" onClick={close}>Cancel</button><button className="pv-primary" type="submit" disabled={!form.term.trim() || !ready}><Bookmark size={17}/>Save to my vocabulary</button></div><p className="pv-fineprint pv-save-note">Saves on this browser immediately. No sign-in needed. Account sync is optional.</p>{error && <button type="button" className="pv-secondary" onClick={exportDraft}><Download size={17}/>Download this draft</button>}
      </form> : modal === 'auth' ? <form onSubmit={authenticate}><span className="pv-eyebrow">TAKE YOUR WORDS WITH YOU</span><h2 id="pv-dialog-title">Your existing account.</h2><p>Sign in to sync your private notebook. Guest words stay separate; export and import them to move them into your account.</p><label className="pv-field">Email<input name="email" type="email" required autoComplete="email"/></label><label className="pv-field">Password<input name="password" type="password" required autoComplete="current-password"/></label>{authMessage && <p role="alert">{authMessage}</p>}<button className="pv-primary" disabled={authBusy}>{authBusy ? 'Signing in…' : 'Sign in'}</button><p className="pv-fineprint">Create an account or reset a password in Original learning mode.</p></form> : modal === 'trash' ? <><span className="pv-eyebrow">YOUR REMOVED WORDS</span><h2 id="pv-dialog-title">Nothing has to stay lost.</h2><p>Restore a phrase to your collection whenever you want.</p>{removed.map(entry => <div className="pv-modal-actions" key={entry.id}><span>{entry.term}</span><button className="pv-secondary" onClick={() => { update(d => ({ ...d, entries: d.entries.map(e => e.id === entry.id ? { ...e, deleted: false, updatedAt: Date.now() } : e) })); setNotice('Entry restored.'); }}>Restore <RefreshCw size={15}/></button></div>)}</> : activeEntry && <><span className="pv-eyebrow">YOUR PERSONAL DICTIONARY</span><h2 id="pv-dialog-title">{activeEntry.term}<button className="pv-listen" onClick={() => speak(activeEntry.term)} aria-label="Listen to phrase"><Volume2 size={23}/></button></h2><EntryDetails entry={activeEntry}/><div className="pv-modal-actions"><button className="pv-text-button" onClick={() => { update(d => ({ ...d, entries: d.entries.map(e => e.id === activeEntry.id ? { ...e, deleted: true, updatedAt: Date.now() } : e) })); setNotice(`“${activeEntry.term}” removed. Undo is available until you leave this page.`); setModal({ undo: activeEntry }); }}><Trash2 size={16}/>Remove</button><button className="pv-primary" onClick={() => openCapture('', activeEntry)}>Edit entry <ArrowRight size={17}/></button></div></>}
      {modal?.undo && <><h2 id="pv-dialog-title">Entry removed.</h2><p>Changed your mind?</p><button className="pv-primary" onClick={() => { const entry = modal.undo; update(d => ({ ...d, entries: d.entries.map(e => e.id === entry.id ? { ...e, deleted: false, updatedAt: Date.now() } : e) })); setModal(null); setNotice('Entry restored.'); }}>Undo removal</button></>}
    </section></div>}
  </div>;
}
