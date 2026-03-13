// src/components/DailyWordFact.jsx
// Shown once per day — AI-generated word fact, rotates through learned words, non-repeating.
import React, { useState, useEffect } from 'react';
import { Sparkles, X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { vocabAI } from '../lib/openAIAssistant';

const STORAGE_KEY = 'vv_last_fact_date';
const SEEN_KEY = 'vv_seen_fact_word_ids';

// Strings returned by the API proxy when there's a quota/auth/config error
const AI_ERROR_PATTERNS = [
  'API key not configured',
  'authentication failed',
  'model access error',
  'temporarily offline',
  'AI error',
  'AI system error',
  'unavailable',
];
const isAIError = (text) =>
  AI_ERROR_PATTERNS.some(p => text?.toLowerCase().includes(p.toLowerCase()));

const DailyWordFact = ({ userId }) => {
  const [fact, setFact] = useState(null);
  const [wordLabel, setWordLabel] = useState('');
  const [visible, setVisible] = useState(false);
  const [aiUnavailable, setAiUnavailable] = useState(false);

  useEffect(() => {
    if (userId) maybeShowFact();
  }, [userId]);

  const maybeShowFact = async () => {
    const today = new Date().toISOString().slice(0, 10);
    if (localStorage.getItem(STORAGE_KEY) === today) return;
    await generateFact(today);
  };

  const generateFact = async (today) => {
    try {
      const { data: progress } = await supabase
        .from('user_word_progress')
        .select('word_id')
        .eq('user_id', userId)
        .limit(100);

      if (!progress || progress.length === 0) return;

      const wordIds = progress.map(p => p.word_id);
      const seenRaw = localStorage.getItem(SEEN_KEY);
      const seen = seenRaw ? JSON.parse(seenRaw) : [];

      const unseen = wordIds.filter(id => !seen.includes(id));
      const pool = unseen.length > 0 ? unseen : wordIds;
      const shuffled = pool.sort(() => Math.random() - 0.5);
      const offset = (userId.charCodeAt(0) + userId.charCodeAt(1)) % shuffled.length;
      const chosenId = shuffled[offset] || shuffled[0];

      const { data: word } = await supabase
        .from('words').select('*').eq('id', chosenId).maybeSingle();
      if (!word) return;

      // Try DB cache first — silently skip if table doesn't exist
      let factText = null;
      try {
        const { data: cached, error: cacheErr } = await supabase
          .from('word_facts').select('fact').eq('word_id', chosenId).maybeSingle();
        if (!cacheErr && cached?.fact) factText = cached.fact;
      } catch { /* table not yet created */ }

      if (!factText) {
        const result = await vocabAI.generateWordFact(word, seen);
        factText = result.fact;

        if (isAIError(factText)) {
          setAiUnavailable(true);
          setWordLabel(word.word);
          setVisible(true);
          localStorage.setItem(STORAGE_KEY, today);
          return;
        }

        // Cache for other users
        try {
          await supabase.from('word_facts').upsert(
            { word_id: chosenId, fact: factText, created_at: new Date().toISOString() },
            { onConflict: 'word_id' }
          );
        } catch { /* table not yet created — silent */ }
      }

      const newSeen = [...seen.filter(id => id !== chosenId), chosenId];
      localStorage.setItem(SEEN_KEY, JSON.stringify(newSeen.slice(-200)));
      localStorage.setItem(STORAGE_KEY, today);

      setWordLabel(word.word);
      setFact(factText);
      setVisible(true);
    } catch (err) {
      console.error('DailyWordFact error:', err);
    }
  };

  const dismiss = () => setVisible(false);

  if (!visible) return null;

  return (
    /*
     * Mobile  : anchored to bottom edge, full width, no margin
     * Desktop (sm+): bottom-right corner, 340px wide, with margin
     */
    <div className="
      fixed z-40
      bottom-0 left-0 right-0
      sm:bottom-4 sm:right-4 sm:left-auto sm:w-[340px]
      animate-in slide-in-from-bottom duration-400
    ">
      <div className="bg-white shadow-2xl border border-purple-100
        rounded-t-2xl sm:rounded-2xl overflow-hidden">

        {/* Gradient header */}
        <div className="bg-gradient-to-r from-purple-500 to-indigo-500
          px-4 py-2.5 flex items-center justify-between">
          <div className="flex items-center gap-2 text-white">
            <Sparkles className="w-4 h-4 shrink-0" />
            <span className="text-sm font-semibold">Word Fact of the Day</span>
          </div>
          <button
            onClick={dismiss}
            className="text-white/70 hover:text-white p-1 rounded transition-colors"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4">
          {aiUnavailable ? (
            <div className="text-center py-2">
              <p className="text-sm font-semibold text-purple-500 uppercase tracking-wider mb-1">
                {wordLabel}
              </p>
              <p className="text-sm text-gray-500 italic">
                The AI word-fact engine is taking a quick break — check back tomorrow for a fresh fact!
              </p>
            </div>
          ) : (
            <>
              <p className="text-[11px] font-bold text-purple-500 uppercase tracking-wider mb-1.5">
                {wordLabel}
              </p>
              <p className="text-sm text-gray-700 leading-relaxed">{fact}</p>
            </>
          )}
        </div>

        <div className="px-4 pb-3 flex justify-end">
          <button
            onClick={dismiss}
            className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
};

export default DailyWordFact;
