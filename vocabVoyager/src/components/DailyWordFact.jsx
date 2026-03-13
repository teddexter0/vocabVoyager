// src/components/DailyWordFact.jsx
// A dismissible popup shown once per day with a fresh AI-generated word fact.
// Facts rotate through the user's learned words, never repeating.
import React, { useState, useEffect } from 'react';
import { Sparkles, X, Loader } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { vocabAI } from '../lib/openAIAssistant';

const STORAGE_KEY = 'vv_last_fact_date';
const SEEN_KEY = 'vv_seen_fact_word_ids';

const DailyWordFact = ({ userId }) => {
  const [fact, setFact] = useState(null);
  const [wordLabel, setWordLabel] = useState('');
  const [loading, setLoading] = useState(true);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (userId) maybeShowFact();
  }, [userId]);

  const maybeShowFact = async () => {
    const today = new Date().toISOString().slice(0, 10);
    const lastDate = localStorage.getItem(STORAGE_KEY);
    if (lastDate === today) return; // Already shown today

    await generateFact(today);
  };

  const generateFact = async (today) => {
    setLoading(true);
    try {
      // Get user's learned words
      const { data: progress } = await supabase
        .from('user_word_progress')
        .select('word_id')
        .eq('user_id', userId)
        .limit(100);

      if (!progress || progress.length === 0) {
        setLoading(false);
        return;
      }

      const wordIds = progress.map(p => p.word_id);

      // Track seen word IDs in localStorage to avoid repeats
      const seenRaw = localStorage.getItem(SEEN_KEY);
      const seen = seenRaw ? JSON.parse(seenRaw) : [];

      // Pick an unseen word ID; if all seen, reset the cycle
      const unseen = wordIds.filter(id => !seen.includes(id));
      const pool = unseen.length > 0 ? unseen : wordIds;

      // Shuffle and pick one — different per user because pools differ
      const shuffled = pool.sort(() => Math.random() - 0.5);
      // Offset by userId hash so users don't all see the same word today
      const offset = (userId.charCodeAt(0) + userId.charCodeAt(1)) % shuffled.length;
      const chosenId = shuffled[offset] || shuffled[0];

      // Fetch the word data
      const { data: word } = await supabase
        .from('words')
        .select('*')
        .eq('id', chosenId)
        .maybeSingle();

      if (!word) { setLoading(false); return; }

      // Check Supabase cache first (word_facts table)
      const { data: cached } = await supabase
        .from('word_facts')
        .select('fact')
        .eq('word_id', chosenId)
        .maybeSingle();

      let factText;
      if (cached?.fact) {
        factText = cached.fact;
      } else {
        const result = await vocabAI.generateWordFact(word, seen);
        factText = result.fact;

        // Cache it for other users / future days
        try {
          await supabase.from('word_facts').upsert({
            word_id: chosenId,
            fact: factText,
            created_at: new Date().toISOString()
          }, { onConflict: 'word_id' });
        } catch {
          // table might not exist yet — fail silently
        }
      }

      // Mark as seen
      const newSeen = [...seen.filter(id => id !== chosenId), chosenId];
      localStorage.setItem(SEEN_KEY, JSON.stringify(newSeen.slice(-200)));
      localStorage.setItem(STORAGE_KEY, today);

      setWordLabel(word.word);
      setFact(factText);
      setVisible(true);
    } catch (err) {
      console.error('DailyWordFact error:', err);
    } finally {
      setLoading(false);
    }
  };

  const dismiss = () => setVisible(false);

  if (!visible || loading) return null;

  return (
    <div className="fixed bottom-4 right-4 max-w-sm w-full z-40 animate-in slide-in-from-bottom-5 fade-in duration-500">
      <div className="bg-white rounded-2xl shadow-2xl border border-purple-100 overflow-hidden">
        {/* Header strip */}
        <div className="bg-gradient-to-r from-purple-500 to-indigo-500 px-4 py-2 flex items-center justify-between">
          <div className="flex items-center gap-2 text-white">
            <Sparkles className="w-4 h-4" />
            <span className="text-sm font-semibold">Word Fact of the Day</span>
          </div>
          <button
            onClick={dismiss}
            className="text-white/70 hover:text-white transition-colors p-1 rounded"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4">
          <p className="text-xs font-bold text-purple-500 uppercase tracking-wider mb-1">
            {wordLabel}
          </p>
          <p className="text-sm text-gray-700 leading-relaxed">{fact}</p>
        </div>

        <div className="px-4 pb-3 text-right">
          <button
            onClick={dismiss}
            className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
          >
            Got it — close
          </button>
        </div>
      </div>
    </div>
  );
};

export default DailyWordFact;
