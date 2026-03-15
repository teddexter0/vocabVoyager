// src/components/DailyWordFact.jsx
import React, { useState, useEffect } from 'react';
import { Sparkles, X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { vocabAI } from '../lib/openAIAssistant';

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

    try {
      // ── Check Supabase for today's word (works across all devices) ──────
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('daily_fact_date, daily_fact_word_id')
        .eq('user_id', userId)
        .maybeSingle();

      if (profile?.daily_fact_date === today && profile?.daily_fact_word_id) {
        // Already picked today's word — just fetch and display it
        await showFact(profile.daily_fact_word_id);
        return;
      }

      // ── Pick a new word for today ────────────────────────────────────────
      const { data: progress } = await supabase
        .from('user_word_progress').select('word_id').eq('user_id', userId).limit(100);
      if (!progress?.length) return;

      // Use word_facts table to know which words have already been featured
      const { data: featuredRows } = await supabase
        .from('word_facts').select('word_id');
      const featured = new Set((featuredRows || []).map(r => r.word_id));

      const wordIds = progress.map(p => p.word_id);
      const pool = wordIds.filter(id => !featured.has(id));
      const source = pool.length > 0 ? pool : wordIds;
      const shuffled = [...source].sort(() => Math.random() - 0.5);
      const chosenId = shuffled[0];

      // Persist today's choice to Supabase so other devices see the same word
      await supabase.from('user_profiles').upsert(
        { user_id: userId, daily_fact_date: today, daily_fact_word_id: chosenId, updated_at: new Date().toISOString() },
        { onConflict: 'user_id' }
      );

      await showFact(chosenId);
    } catch (err) {
      console.error('DailyWordFact error:', err);
    }
  };

  const showFact = async (wordId) => {
    try {
      const { data: word } = await supabase.from('words').select('*').eq('id', wordId).maybeSingle();
      if (!word) return;

      // Check cache first
      let factText = null;
      try {
        const { data: cached, error: ce } = await supabase
          .from('word_facts').select('fact').eq('word_id', wordId).maybeSingle();
        if (!ce && cached?.fact) factText = cached.fact;
      } catch { /* word_facts may not exist yet */ }

      if (!factText) {
        const result = await vocabAI.generateWordFact(word, []);
        factText = result.fact;
        if (isAIError(factText)) {
          setAiUnavailable(true); setWordLabel(word.word); setVisible(true);
          return;
        }
        try {
          await supabase.from('word_facts').upsert(
            { word_id: wordId, fact: factText, created_at: new Date().toISOString() },
            { onConflict: 'word_id' }
          );
        } catch { /* silent */ }
      }

      setWordLabel(word.word); setFact(factText); setVisible(true);
    } catch (err) {
      console.error('showFact error:', err);
    }
  };

  if (!visible) return null;

  return (
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
