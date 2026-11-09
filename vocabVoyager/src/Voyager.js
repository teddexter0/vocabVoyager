import React, { lazy, Suspense, useEffect, useState } from 'react';
import PersonalVocabulary from './components/PersonalVocabulary';
import './components/ModeDestinations.css';

const Classic = lazy(() => import('./App'));

export function modeFromLocation(location = window.location) {
  const query = new URLSearchParams(location.search);
  const callback = location.hash.includes('access_token=') || query.has('code') ||
    ['OrderTrackingId', 'payment_success', 'payment_failed', 'dev_payment'].some(key => query.has(key));
  return !callback && query.get('mode') === 'personal' ? 'personal' : 'classic';
}

export default function Voyager() {
  const [mode, setMode] = useState(modeFromLocation);
  useEffect(() => {
    const back = () => setMode(modeFromLocation());
    window.addEventListener('popstate', back);
    return () => window.removeEventListener('popstate', back);
  }, []);

  const navigate = next => {
    const url = new URL(window.location.href);
    url.searchParams.delete('studio');
    if (next === 'personal') url.searchParams.set('mode', 'personal');
    else url.searchParams.delete('mode');
    window.history.pushState({}, '', url.pathname + url.search + url.hash);
    setMode(next);
    window.scrollTo({ top: 0 });
  };

  return mode === 'classic' ? (
    <Suspense fallback={<p className="voyager-opening">Opening VocabVoyager…</p>}>
      <Classic onPersonal={() => navigate('personal')}/>
    </Suspense>
  ) : <PersonalVocabulary initialTab={new URLSearchParams(window.location.search).get('studio') === 'thesaurus' ? 'thesaurus' : 'home'} onClassic={() => navigate('classic')}/>;
}
