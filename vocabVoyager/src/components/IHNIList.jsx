// src/components/IHNIList.jsx — "I Had No Idea!" 🔥
// Add a whole list of words you stumbled on and had zero clue about.
// They get looked up in the word bank and queued for spaced-repetition review.
import React, { useState } from 'react';
import { Flame, Search, Plus, CheckCircle, XCircle, Loader, BookOpen, Trash2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { spacedRepetitionService } from '../lib/spacedRepetition';

const IHNIList = ({ userId }) => {
  const [inputText, setInputText] = useState('');
  const [results, setResults] = useState([]); // [{word, found, wordData, queued}]
  const [loading, setLoading] = useState(false);
  const [savedCount, setSavedCount] = useState(0);

  const parseWords = (text) =>
    text
      .split(/[\n,;]+/)
      .map(w => w.trim().toLowerCase())
      .filter(w => w.length > 1 && /^[a-z]+$/.test(w));

  const lookupWords = async () => {
    const words = parseWords(inputText);
    if (words.length === 0) return;
    setLoading(true);
    setResults([]);
    setSavedCount(0);

    try {
      // Look up each word in the words table
      const { data: foundWords } = await supabase
        .from('words')
        .select('*')
        .in('word', words);

      const foundMap = {};
      (foundWords || []).forEach(w => { foundMap[w.word.toLowerCase()] = w; });

      const lookup = words.map(w => ({
        raw: w,
        found: !!foundMap[w],
        wordData: foundMap[w] || null,
        queued: false
      }));

      setResults(lookup);
    } catch (err) {
      console.error('IHNI lookup error:', err);
    } finally {
      setLoading(false);
    }
  };

  const queueAll = async () => {
    if (!userId) return;
    setLoading(true);
    let count = 0;

    const toQueue = results.filter(r => r.found && !r.queued);
    for (const r of toQueue) {
      try {
        // Add to user_word_progress as a fresh entry (mastery 0, review tomorrow)
        await spacedRepetitionService.updateWordProgress(userId, r.wordData.id, { isCorrect: false });
        count++;
      } catch (err) {
        console.error('Failed to queue word:', r.raw, err);
      }
    }

    setResults(prev => prev.map(r => r.found ? { ...r, queued: true } : r));
    setSavedCount(count);
    setLoading(false);
  };

  const removeResult = (index) => {
    setResults(prev => prev.filter((_, i) => i !== index));
  };

  const foundCount = results.filter(r => r.found && !r.queued).length;
  const notFoundCount = results.filter(r => !r.found).length;

  return (
    <div className="max-w-2xl mx-auto p-4">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="p-3 bg-orange-100 rounded-xl">
          <Flame className="w-7 h-7 text-orange-500" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-gray-800">IHNI! <span className="text-orange-500">🔥</span></h2>
          <p className="text-gray-500 text-sm">I Had No Idea — paste words you stumbled on and queue them for review.</p>
        </div>
      </div>

      {/* Input */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 mb-4">
        <label className="block text-sm font-semibold text-gray-700 mb-2">
          Drop your mystery words here
        </label>
        <textarea
          value={inputText}
          onChange={e => setInputText(e.target.value)}
          placeholder={"ephemeral, sycophant\nambivalent\npernicious, verbose\n..."}
          rows={5}
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-orange-400 resize-none"
        />
        <p className="text-xs text-gray-400 mt-1">Separate with commas, semicolons, or new lines.</p>

        <button
          onClick={lookupWords}
          disabled={loading || !inputText.trim()}
          className="mt-3 flex items-center gap-2 px-5 py-2.5 bg-orange-500 text-white rounded-lg hover:bg-orange-600 disabled:opacity-50 transition-colors font-semibold"
        >
          {loading ? <Loader className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
          {loading ? 'Looking up...' : 'Look them up'}
        </button>
      </div>

      {/* Results */}
      {results.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex gap-3 text-sm">
              <span className="text-emerald-600 font-semibold">{results.filter(r => r.found).length} found</span>
              {notFoundCount > 0 && (
                <span className="text-red-400 font-semibold">{notFoundCount} not in word bank</span>
              )}
            </div>
            {foundCount > 0 && userId && (
              <button
                onClick={queueAll}
                disabled={loading}
                className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 transition-colors text-sm font-semibold"
              >
                <Plus className="w-4 h-4" />
                Queue all {foundCount} for review
              </button>
            )}
          </div>

          {savedCount > 0 && (
            <div className="mb-3 p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-sm text-emerald-700 font-medium">
              ✓ {savedCount} word{savedCount > 1 ? 's' : ''} added to your review queue — they'll start showing up tomorrow!
            </div>
          )}

          <div className="space-y-2">
            {results.map((r, i) => (
              <div
                key={i}
                className={`flex items-start gap-3 p-3 rounded-lg border ${
                  r.queued
                    ? 'bg-emerald-50 border-emerald-200'
                    : r.found
                    ? 'bg-gray-50 border-gray-200'
                    : 'bg-red-50 border-red-100'
                }`}
              >
                <div className="mt-0.5 shrink-0">
                  {r.queued ? (
                    <CheckCircle className="w-5 h-5 text-emerald-500" />
                  ) : r.found ? (
                    <BookOpen className="w-5 h-5 text-blue-500" />
                  ) : (
                    <XCircle className="w-5 h-5 text-red-400" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <span className="font-semibold text-gray-800">{r.raw}</span>
                  {r.found && r.wordData && (
                    <p className="text-xs text-gray-500 mt-0.5 truncate">
                      ≈ {r.wordData.synonym} — {r.wordData.definition?.slice(0, 80)}…
                    </p>
                  )}
                  {!r.found && (
                    <p className="text-xs text-red-400 mt-0.5">Not yet in VocabVoyager's word bank.</p>
                  )}
                  {r.queued && (
                    <p className="text-xs text-emerald-600 mt-0.5">Queued for review ✓</p>
                  )}
                </div>
                <button onClick={() => removeResult(i)} className="p-1 text-gray-400 hover:text-red-400 transition-colors shrink-0">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {!userId && (
        <p className="text-center text-sm text-gray-400 mt-4">Sign in to save words to your review queue.</p>
      )}
    </div>
  );
};

export default IHNIList;
