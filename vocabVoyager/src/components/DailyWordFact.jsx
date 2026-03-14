// src/components/DailyWordFact.jsx
import React, { useState, useEffect } from 'react';
import { Sparkles, X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { vocabAI } from '../lib/openAIAssistant';

const STORAGE_KEY = 'vv_last_fact_date';
const SEEN_KEY    = 'vv_seen_fact_word_ids';

const AI_ERROR_PATTERNS = [
  'api key not configured','authentication failed','model access error',
  'temporarily offline','ai error','ai system error','unavailable',
];
const isAIError = (text) =>
  AI_ERROR_PATTERNS.some(p => text?.toLowerCase().includes(p));

const DailyWordFact = ({ userId }) => {
  const [fact, setFact]               = useState(null);
  const [wordLabel, setWordLabel]     = useState('');
  const [visible, setVisible]         = useState(false);
  const [aiUnavailable, setAiUnavailable] = useState(false);

  useEffect(() => { if (userId) maybeShowFact(); }, [userId]);

  const maybeShowFact = async () => {
    const today = new Date().toISOString().slice(0, 10);
    if (localStorage.getItem(STORAGE_KEY) === today) return;
    await generateFact(today);
  };

  const generateFact = async (today) => {
    try {
      const { data: progress } = await supabase
        .from('user_word_progress').select('word_id').eq('user_id', userId).limit(100);
      if (!progress?.length) return;

      const wordIds = progress.map(p => p.word_id);
      const seen = JSON.parse(localStorage.getItem(SEEN_KEY) || '[]');
      const pool = wordIds.filter(id => !seen.includes(id));
      const source = pool.length > 0 ? pool : wordIds;
      const shuffled = [...source].sort(() => Math.random() - 0.5);
      const offset = (userId.charCodeAt(0) + userId.charCodeAt(1)) % shuffled.length;
      const chosenId = shuffled[offset] ?? shuffled[0];

      const { data: word } = await supabase.from('words').select('*').eq('id', chosenId).maybeSingle();
      if (!word) return;

      let factText = null;
      try {
        const { data: cached, error: ce } = await supabase
          .from('word_facts').select('fact').eq('word_id', chosenId).maybeSingle();
        if (!ce && cached?.fact) factText = cached.fact;
      } catch { /* word_facts table may not exist */ }

      if (!factText) {
        const result = await vocabAI.generateWordFact(word, seen);
        factText = result.fact;
        if (isAIError(factText)) {
          setAiUnavailable(true); setWordLabel(word.word); setVisible(true);
          localStorage.setItem(STORAGE_KEY, today); return;
        }
        try {
          await supabase.from('word_facts').upsert(
            { word_id: chosenId, fact: factText, created_at: new Date().toISOString() },
            { onConflict: 'word_id' }
          );
        } catch { /* silent — may be missing or RLS */ }
      }

      const newSeen = [...seen.filter(id => id !== chosenId), chosenId];
      localStorage.setItem(SEEN_KEY, JSON.stringify(newSeen.slice(-200)));
      localStorage.setItem(STORAGE_KEY, today);
      setWordLabel(word.word); setFact(factText); setVisible(true);
    } catch (err) {
      console.error('DailyWordFact error:', err);
    }
  };

  if (!visible) return null;

  return (
    /*
     * Positioning — industry-standard "floating notification card":
     *   All screens : 16px margin from every edge (mx-4 mb-4), centered horizontally
     *   sm (640px+) : pinned to bottom-right, fixed width 360px
     * The card itself is fully rounded on all screens (no half-sheet look).
     */
    <div className={`
      fixed z-40
      left-4 right-4 bottom-4
      sm:left-auto sm:right-5 sm:bottom-5 sm:w-[360px]
    `}>
      <div className="
        bg-white rounded-2xl overflow-hidden
        shadow-[0_8px_40px_rgba(99,102,241,0.18)]
        border border-purple-100
        animate-in slide-in-from-bottom-3 fade-in duration-300
      ">
        {/* Header */}
        <div className="
          bg-gradient-to-r from-purple-600 to-indigo-500
          px-4 py-2.5 flex items-center justify-between
        ">
          <div className="flex items-center gap-2 text-white">
            <Sparkles className="w-4 h-4 shrink-0" />
            <span className="text-sm font-semibold tracking-wide">Word Fact of the Day</span>
          </div>
          <button
            onClick={() => setVisible(false)}
            className="text-white/60 hover:text-white p-1 rounded transition-colors"
            aria-label="Dismiss"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 pt-4 pb-3">
          {aiUnavailable ? (
            <p className="text-sm text-gray-400 italic text-center py-2">
              AI fact engine is taking a breather — check back tomorrow!
            </p>
          ) : (
            <>
              {/* Styled word label */}
              <div className="mb-3 flex items-center gap-2">
                <span className="
                  text-xl font-black tracking-tight
                  bg-gradient-to-r from-purple-600 to-indigo-500
                  bg-clip-text text-transparent
                  uppercase
                ">
                  {wordLabel}
                </span>
                <span className="text-purple-200 text-lg">✦</span>
              </div>
              <p className="text-sm text-gray-700 leading-relaxed">{fact}</p>
            </>
          )}
        </div>

        <div className="px-5 pb-3.5 flex justify-end">
          <button
            onClick={() => setVisible(false)}
            className="text-xs font-medium text-indigo-400 hover:text-indigo-600 transition-colors"
          >
            Got it ✓
          </button>
        </div>
      </div>
    </div>
  );
};

export default DailyWordFact;
