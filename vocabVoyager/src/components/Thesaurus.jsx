import React, { useEffect, useRef, useState } from 'react';
import { lookupVocabulary, safeUrl } from '../lib/vocabularyLookup';
import { groups, nuances, nuanceFields, replacement, wordplay, wordsIn } from '../lib/thesaurus';
import './Thesaurus.css';

const discoveryModes = [
  ['synonyms', 'Ranked synonyms across senses'], ['antonyms', 'Antonyms across senses'],
  ['related', 'Related words'], ['collocations', 'Common followers'],
  ['rhymes', 'Rhymes'], ['nearRhymes', 'Near-rhymes'], ['homophones', 'Homophones'],
];
const historyKey = 'vv-thesaurus-history';
const recentSearches = () => {
  try {
    const data = JSON.parse(localStorage.getItem(historyKey));
    return Array.isArray(data) ? data.filter(item => typeof item === 'string').slice(0, 8) : [];
  } catch { return []; }
};

function WordButtons({ words, onPick }) {
  return <div className="vt-chips">{words.map(word =>
    <button type="button" key={word} onClick={() => onPick(word)}>{word}</button>
  )}</div>;
}

export default function Thesaurus({ onCapture }) {
  const [view, setView] = useState('look');
  const [query, setQuery] = useState('');
  const [history, setHistory] = useState(recentSearches);
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [discovery, setDiscovery] = useState(null);
  const [comparison, setComparison] = useState('confident, assertive, arrogant, conceited');
  const [compared, setCompared] = useState([]);
  const [sentence, setSentence] = useState('He was very angry.');
  const [token, setToken] = useState(null);
  const [contextSenses, setContextSenses] = useState([]);
  const [senseIndex, setSenseIndex] = useState('');
  const [exercise, setExercise] = useState(0);
  const [answer, setAnswer] = useState('');
  const request = useRef(null);
  const discoveryRequest = useRef(null);
  useEffect(() => () => { request.current?.abort(); discoveryRequest.current?.abort(); }, []);

  const run = async action => {
    request.current?.abort();
    discoveryRequest.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setBusy(true);
    setError('');
    setDiscovery(null);
    try { await action(controller.signal); }
    catch (err) { if (!controller.signal.aborted) setError(err.message); }
    finally { if (!controller.signal.aborted) setBusy(false); }
  };

  const search = word => {
    const term = word.trim();
    if (!term) return;
    setView('look');
    setQuery(term);
    setResult(null);
    run(async signal => {
      const entry = await lookupVocabulary(term, { signal });
      if (signal.aborted) return;
      setResult(entry);
      const next = [term, ...history.filter(item => item.toLowerCase() !== term.toLowerCase())].slice(0, 8);
      setHistory(next);
      try { localStorage.setItem(historyKey, JSON.stringify(next)); } catch {}
    });
  };

  const discover = async (mode, label) => {
    discoveryRequest.current?.abort();
    const controller = new AbortController();
    discoveryRequest.current = controller;
    setDiscovery({ label, status: 'Finding words…', words: [] });
    const timer = setTimeout(() => controller.abort('timeout'), 7000);
    try {
      const params = new URLSearchParams({ term: result.term, mode });
      const response = await fetch(`/api/word-discovery?${params}`, { signal: controller.signal });
      const data = await response.json();
      if (!response.ok || !Array.isArray(data.words)) throw new Error(data.error || 'Discovery unavailable.');
      if (!controller.signal.aborted) setDiscovery({ label, words: data.words, status: data.words.length ? '' : 'No results from this source.' });
    } catch {
      if (discoveryRequest.current === controller && (!controller.signal.aborted || controller.signal.reason === 'timeout')) {
        setDiscovery({ label, words: [], status: 'Word discovery is temporarily unavailable. Dictionary lookup is still available.' });
      }
    } finally { clearTimeout(timer); }
  };

  const compare = value => {
    const words = [...new Set(value.split(',').map(word => word.trim().toLowerCase()).filter(Boolean))].slice(0, 5);
    if (words.length < 2) { setError('Enter at least two different words, separated by commas.'); return; }
    setCompared([]);
    run(async signal => {
      const entries = await Promise.all(words.map(word => lookupVocabulary(word, { signal })));
      if (!signal.aborted) setCompared(entries);
    });
  };

  const chooseWord = next => {
    setToken(next);
    setSenseIndex('');
    setContextSenses([]);
    run(async signal => {
      const entry = await lookupVocabulary(next.word, { signal });
      if (signal.aborted) return;
      setContextSenses(entry.senses);
      if (!entry.senses.length && !nuances[next.word.toLowerCase()]) setError(entry.message);
    });
  };

  const tabs = [['look', 'Explore'], ['compare', 'Compare nuances'], ['context', 'In a sentence'], ['play', 'Wordplay']];
  const chosen = token?.word.toLowerCase();
  const alternatives = groups.find(group => group.includes(chosen))?.filter(word => word !== chosen) || [];
  const contextual = senseIndex !== '' ? contextSenses[Number(senseIndex)]?.synonyms || [] : [];
  const challenge = wordplay[exercise];

  return <section className="vt-studio" aria-label="Intelligent Thesaurus">
    <span className="pv-eyebrow">FIND THE WORD THAT FITS</span>
    <h1>Intelligent Thesaurus</h1>
    <p>Explore meanings, compare tone, and keep the words you want to practise.</p>
    <div className="vt-chips" aria-label="Thesaurus tools">{tabs.map(([id, label]) => <button key={id} aria-pressed={view === id} onClick={() => {
      request.current?.abort();
      discoveryRequest.current?.abort();
      setBusy(false); setDiscovery(null); setError(''); setView(id);
    }}>{label}</button>)}</div>

    {view === 'look' && <>
      <form className="vt-form" onSubmit={event => { event.preventDefault(); search(query); }}>
        <label className="pv-field">Word or phrase<input value={query} maxLength={120} onChange={event => setQuery(event.target.value)} required placeholder="e.g. sharp" /></label>
        <button className="pv-primary">Look up</button>
      </form>
      {history.length > 0 && <><h3>Recent searches on this browser</h3><WordButtons words={history} onPick={search}/></>}
      {result && <>
        <h2>{result.term}</h2>
        {'speechSynthesis' in window && <button className="pv-secondary" onClick={() => {
          const utterance = new SpeechSynthesisUtterance(result.term);
          utterance.lang = 'en';
          window.speechSynthesis.speak(utterance);
        }}>Listen to browser pronunciation</button>}
        <p role="status">{result.message}</p>
        {result.senses.map((sense, index) => <article className="vt-card" key={index}>
          <span className="pv-eyebrow">{sense.partOfSpeech || 'Sense'} {index + 1} {sense.phonetic}</span>
          <h3>{sense.definition}</h3>
          {sense.register && <p>Usage labels · {sense.register}</p>}
          {sense.examples.map((example, i) => <blockquote key={i}>{example.text}</blockquote>)}
          {[['Synonyms for this sense', sense.synonyms], ['Antonyms for this sense', sense.antonyms], ['Related vocabulary', sense.related]].map(([label, words]) =>
            Boolean(words?.length) && <div key={label}><h4>{label}</h4><WordButtons words={words} onPick={search}/></div>)}
          <button className="pv-secondary" onClick={() => onCapture(result, sense)}>Make a recall card</button>
        </article>)}
        {!result.senses.length && <><button className="pv-secondary" onClick={() => discover('spelling', 'Possible spellings')}>Check spelling</button>{' '}
          <button className="pv-secondary" onClick={() => onCapture(result)}>Save a draft</button></>}
        {result.origin && <details><summary>Recorded etymology</summary><p className="pv-prewrap">{result.origin}</p></details>}
        {result.usage && <details><summary>Dictionary usage notes</summary><p className="pv-prewrap">{result.usage}</p></details>}
        {result.expressions?.length > 0 && <details><summary>Expressions and compounds</summary>
          <WordButtons words={result.expressions} onPick={search}/>
          <a href={result.wiki} target="_blank" rel="noreferrer">Wiktionary</a> · <a href="https://creativecommons.org/licenses/by-sa/4.0/" target="_blank" rel="noreferrer">CC BY-SA 4.0</a>
        </details>}
        {result.sources.map(source => <p className="vt-source" key={source.label}>
          <a href={safeUrl(source.url) || undefined} target="_blank" rel="noreferrer">{source.label}</a>
          {source.license && <> · <a href={safeUrl(source.licenseUrl) || undefined} target="_blank" rel="noreferrer">{source.license}</a></>}
        </p>)}
        <h3>Explore word connections</h3>
        <p>Cross-sense results are ranked by the provider. Check the definition before using a word as a substitute.</p>
        <div className="vt-chips">{discoveryModes.map(([id, label]) => <button key={id} onClick={() => discover(id, label)}>{label}</button>)}</div>
        {discovery && <div className="vt-card" aria-live="polite"><h4>{discovery.label}</h4><p>{discovery.status}</p>
          <WordButtons words={discovery.words} onPick={search}/>
          <a href="https://www.datamuse.com/api/" target="_blank" rel="noreferrer">Datamuse</a></div>}
      </>}
    </>}

    {view === 'compare' && <>
      <form className="vt-form" onSubmit={event => { event.preventDefault(); compare(comparison); }}>
        <label className="pv-field">Two to five words, separated by commas<input value={comparison} maxLength={240} onChange={event => setComparison(event.target.value)}/></label>
        <button className="pv-primary">Compare</button>
      </form>
      <div className="vt-grid">{compared.map(entry => {
        const word = entry.term.toLowerCase();
        const note = Object.hasOwn(nuances, word) ? nuances[word] : null;
        return <article className="vt-card" key={entry.term}><h2>{entry.term}</h2>
          {note ? <><p className="pv-eyebrow">EDITORIAL USAGE GUIDE</p><dl>{note.map((value, i) => <React.Fragment key={i}><dt>{nuanceFields[i]}</dt><dd>{value}</dd></React.Fragment>)}</dl></>
            : <p>Editorial nuance notes are unavailable for this word. Compare the dictionary senses and usage labels below.</p>}
          {entry.senses.length > 0 ? <details open={!note}><summary>Dictionary senses</summary><ul>{entry.senses.map((sense, index) => <li key={index}>{sense.partOfSpeech} · {sense.definition}{sense.register && ` (${sense.register})`}</li>)}</ul></details> : <p>{entry.message}</p>}
        </article>;
      })}</div>
    </>}

    {view === 'context' && <>
      <label className="pv-field">Your sentence<textarea rows={3} maxLength={300} value={sentence} onChange={event => {
        request.current?.abort(); setBusy(false); setError(''); setSentence(event.target.value); setToken(null);
      }}/></label>
      <p>Choose the exact occurrence you want to replace.</p>
      <div className="vt-chips">{wordsIn(sentence).map(item => <button aria-pressed={token?.index === item.index} key={item.index} onClick={() => chooseWord(item)}>{item.word}</button>)}</div>
      {token && <>
        {contextSenses.length > 0 && <label className="pv-field">Which meaning of “{token.word}” fits here?
          <select value={senseIndex} onChange={event => setSenseIndex(event.target.value)}>
            <option value="">Choose a dictionary sense</option>
            {contextSenses.map((sense, index) => <option value={index} key={index}>{sense.partOfSpeech} · {sense.definition}</option>)}
          </select>
        </label>}
        {alternatives.length > 0 && <h3>Editorial alternatives for “{token.word}”</h3>}
        {[...new Set([...alternatives, ...contextual])].map(word => <article className="vt-card" key={word}>
          <h4>{word}</h4><blockquote>{replacement(sentence, token, word)}</blockquote>
          <p>{Object.hasOwn(nuances, word) ? `${nuances[word][0]}. ${nuances[word][4]}` : 'Candidate from the selected dictionary sense. Check tone, grammar, and meaning in this sentence.'}</p>
        </article>)}
        {senseIndex !== '' && !contextual.length && <p>This dictionary sense lists no synonyms.</p>}
      </>}
    </>}

    {view === 'play' && <article className="vt-card">
      <span className="pv-eyebrow">EXERCISE {exercise + 1} OF {wordplay.length}</span>
      <h2>{challenge.title}</h2><p>{challenge.clue}</p><WordButtons words={challenge.choices} onPick={setAnswer}/>
      {answer && <p role="status">{answer === challenge.answer ? 'Correct. ' + challenge.why : 'Try another answer.'}</p>}
      <button className="pv-secondary" onClick={() => { setAnswer(''); setExercise((exercise + 1) % wordplay.length); }}>Next exercise</button>
    </article>}
    {busy && <p role="status">Checking free dictionary sources…</p>}
    {error && <p role="alert">{error}</p>}
  </section>;
}
