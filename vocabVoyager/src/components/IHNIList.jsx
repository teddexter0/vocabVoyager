// src/components/IHNIList.jsx — "I Had No Idea!" 🔥
// Drop words you stumbled on in real life — VocabVoyager looks them up,
// fuzzy-matches typos, and adds found words to your spaced-repetition queue.
import React, { useState } from 'react';
import { Flame, Search, Plus, CheckCircle, XCircle, Loader, BookOpen, Trash2, Sparkles } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { spacedRepetitionService } from '../lib/spacedRepetition';
import { vocabAI } from '../lib/openAIAssistant';

// ── Input limits ─────────────────────────────────────────────────────────────
const MAX_CHARS = 2000;
const MAX_WORDS = 50;

// ── Sanitise one token: lowercase, only a-z and internal hyphens ─────────────
const sanitiseWord = (raw) =>
  raw
    .toLowerCase()
    .replace(/[^a-z-]/g, '')          // strip anything that isn't a letter or hyphen
    .replace(/^-+|-+$/g, '')          // strip leading/trailing hyphens
    .replace(/-{2,}/g, '-');          // collapse consecutive hyphens

const parseWords = (text) => {
  // Hard-cap on raw input length to prevent abuse
  const capped = text.slice(0, MAX_CHARS);
  return [
    ...new Set(
      capped
        .split(/[\n,;|/\s]+/)
        .map(sanitiseWord)
        .filter(w => w.length >= 2 && w.length <= 40)
    )
  ].slice(0, MAX_WORDS);
};

// ── Levenshtein edit distance ─────────────────────────────────────────────────
const levenshtein = (a, b) => {
  const m = a.length, n = b.length;
  const dp = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  );
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j - 1], dp[i - 1][j], dp[i][j - 1]);
  return dp[m][n];
};
// Tolerance: 1 edit for ≤6 chars, 2 for longer words
const fuzzyThreshold = (w) => (w.length <= 6 ? 1 : 2);
// ─────────────────────────────────────────────────────────────────────────────

const IHNIList = ({ userId }) => {
  const [inputText, setInputText]   = useState('');
  const [results, setResults]       = useState([]);
  const [loading, setLoading]       = useState(false);
  const [savedCount, setSavedCount] = useState(0);
  const [aiLookups, setAiLookups]   = useState({}); // { raw: { text, loading } }

  // ── DB lookup ───────────────────────────────────────────────────────────────
  const lookupWords = async () => {
    const words = parseWords(inputText);
    if (words.length === 0) return;
    setLoading(true);
    setResults([]);
    setSavedCount(0);
    setAiLookups({});

    try {
      // Exact match
      const { data: exact } = await supabase.from('words').select('*').in('word', words);
      const exactMap = {};
      (exact || []).forEach(w => { exactMap[w.word.toLowerCase()] = w; });

      // Fuzzy match for misses
      const misses = words.filter(w => !exactMap[w]);
      const fuzzyMap = {};
      for (const raw of misses) {
        const prefix = raw.replace(/-/g, '').slice(0, Math.max(3, raw.length - 2));
        const { data: cands } = await supabase
          .from('words').select('*').ilike('word', `${prefix}%`).limit(20);
        if (cands?.length) {
          let best = null, bestDist = Infinity;
          for (const c of cands) {
            const dist = levenshtein(raw, c.word.toLowerCase());
            if (dist < bestDist && dist <= fuzzyThreshold(raw)) { bestDist = dist; best = c; }
          }
          if (best) fuzzyMap[raw] = { wordData: best, dist: bestDist };
        }
      }

      setResults(words.map(w => {
        if (exactMap[w]) return { raw: w, found: true,  wordData: exactMap[w],          fuzzy: false, queued: false };
        if (fuzzyMap[w]) return { raw: w, found: true,  wordData: fuzzyMap[w].wordData,  fuzzy: true,  queued: false };
        return              { raw: w, found: false, wordData: null,                  fuzzy: false, queued: false };
      }));
    } catch (err) {
      console.error('IHNI lookup error:', err);
    } finally {
      setLoading(false);
    }
  };

  // ── Queue found words for spaced-repetition ─────────────────────────────────
  const queueAll = async () => {
    if (!userId) return;
    setLoading(true);
    let count = 0;
    const toQueue = results.filter(r => r.found && !r.queued);
    for (const r of toQueue) {
      try {
        await spacedRepetitionService.updateWordProgress(userId, r.wordData.id, { isCorrect: false });
        count++;
      } catch { /* skip */ }
    }
    setResults(prev => prev.map(r => r.found ? { ...r, queued: true } : r));
    setSavedCount(count);
    setLoading(false);
  };

  // ── AI lookup for a word NOT in the word bank ───────────────────────────────
  const aiLookupWord = async (raw) => {
    setAiLookups(prev => ({ ...prev, [raw]: { text: null, loading: true } }));
    try {
      const response = await vocabAI.generateChatResponse(null,
        `Give me a concise definition (2 sentences max) and one example sentence for the word "${raw}". Format: Definition: ... | Example: ...`,
        {}
      );
      setAiLookups(prev => ({ ...prev, [raw]: { text: response.content, loading: false } }));
    } catch {
      setAiLookups(prev => ({ ...prev, [raw]: { text: 'Could not load AI definition.', loading: false } }));
    }
  };

  const removeResult = (i) => setResults(prev => prev.filter((_, idx) => idx !== i));

  const foundCount    = results.filter(r => r.found && !r.queued).length;
  const notFoundCount = results.filter(r => !r.found).length;
  const charCount     = inputText.length;

  return (
    <div className="max-w-2xl mx-auto p-4">
      {/* Header */}
      <div className="flex items-center gap-3 mb-2">
        <div className="p-3 bg-orange-100 rounded-xl">
          <Flame className="w-7 h-7 text-orange-500" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-gray-800">IHNI! <span className="text-orange-500">🔥</span></h2>
          <p className="text-gray-500 text-sm">I Had No Idea — words from real life → your review queue</p>
        </div>
      </div>

      {/* How it works */}
      <div className="mb-4 px-4 py-3 bg-orange-50 border border-orange-100 rounded-xl text-xs text-orange-800 leading-relaxed">
        <strong>How it works:</strong> Paste any words you stumbled on and had no idea about.
        VocabVoyager looks them up (typos OK — fuzzy matching handles it), shows you the definition,
        and adds them to your daily spaced-repetition review so you actually remember them.
      </div>

      {/* Input */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 mb-4">
        <label className="block text-sm font-semibold text-gray-700 mb-2">
          Drop your mystery words
        </label>
        <textarea
          value={inputText}
          onChange={e => setInputText(e.target.value.slice(0, MAX_CHARS))}
          placeholder={"ephemeral, sycophant\nambivalent\npernicious, verbose\n..."}
          rows={5}
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-orange-400 resize-none"
        />
        <div className="flex items-center justify-between mt-1">
          <p className="text-xs text-gray-400">
            Separate with commas, spaces, or new lines · max {MAX_WORDS} words
          </p>
          <span className={`text-xs ${charCount > MAX_CHARS * 0.9 ? 'text-orange-500' : 'text-gray-300'}`}>
            {charCount}/{MAX_CHARS}
          </span>
        </div>

        <button
          onClick={lookupWords}
          disabled={loading || !inputText.trim()}
          className="mt-3 flex items-center gap-2 px-5 py-2.5 bg-orange-500 text-white rounded-lg hover:bg-orange-600 disabled:opacity-50 transition-colors font-semibold"
        >
          {loading ? <Loader className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
          {loading ? 'Looking up…' : 'Look them up'}
        </button>
      </div>

      {/* Results */}
      {results.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex gap-3 text-sm">
              {results.filter(r => r.found).length > 0 && (
                <span className="text-emerald-600 font-semibold">
                  {results.filter(r => r.found).length} found
                </span>
              )}
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
                Add {foundCount} to review
              </button>
            )}
          </div>

          {savedCount > 0 && (
            <div className="mb-3 p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-sm text-emerald-700 font-medium">
              ✓ {savedCount} word{savedCount > 1 ? 's' : ''} added — they'll appear in tomorrow's review session!
            </div>
          )}

          <div className="space-y-2">
            {results.map((r, i) => {
              const ai = aiLookups[r.raw];
              return (
                <div
                  key={i}
                  className={`rounded-lg border transition-all ${
                    r.queued    ? 'bg-emerald-50 border-emerald-200' :
                    r.found     ? 'bg-gray-50 border-gray-200' :
                                  'bg-red-50/60 border-red-100'
                  }`}
                >
                  <div className="flex items-start gap-3 p-3">
                    <div className="mt-0.5 shrink-0">
                      {r.queued   ? <CheckCircle className="w-5 h-5 text-emerald-500" /> :
                       r.found    ? <BookOpen    className="w-5 h-5 text-blue-500" /> :
                                    <XCircle     className="w-5 h-5 text-red-400" />}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-gray-800">{r.raw}</span>
                        {r.fuzzy && r.wordData && (
                          <span className="text-[10px] px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded font-medium">
                            matched → {r.wordData.word}
                          </span>
                        )}
                      </div>

                      {r.found && r.wordData && !r.queued && (
                        <p className="text-xs text-gray-500 mt-0.5">
                          <span className="font-medium text-blue-600">≈ {r.wordData.synonym}</span>
                          {' '}— {r.wordData.definition?.slice(0, 90)}{r.wordData.definition?.length > 90 ? '…' : ''}
                        </p>
                      )}

                      {r.queued && (
                        <p className="text-xs text-emerald-600 mt-0.5 font-medium">
                          In your review queue ✓ — comes up based on spaced repetition
                        </p>
                      )}

                      {!r.found && !ai && (
                        <div className="flex items-center gap-2 mt-1">
                          <p className="text-xs text-red-400">Not in VocabVoyager's word bank yet.</p>
                          <button
                            onClick={() => aiLookupWord(r.raw)}
                            className="flex items-center gap-1 text-[10px] px-2 py-0.5 bg-purple-100 text-purple-600 rounded hover:bg-purple-200 transition-colors font-semibold shrink-0"
                          >
                            <Sparkles className="w-3 h-3" /> AI define
                          </button>
                        </div>
                      )}

                      {!r.found && ai?.loading && (
                        <div className="mt-1 flex items-center gap-1 text-xs text-purple-500">
                          <Loader className="w-3 h-3 animate-spin" /> Looking up with AI…
                        </div>
                      )}

                      {!r.found && ai?.text && !ai?.loading && (
                        <p className="mt-1 text-xs text-gray-600 bg-purple-50 rounded p-2 leading-relaxed">
                          {ai.text}
                        </p>
                      )}
                    </div>

                    <button
                      onClick={() => removeResult(i)}
                      className="p-1 text-gray-300 hover:text-red-400 transition-colors shrink-0"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {!userId && (
        <p className="text-center text-sm text-gray-400 mt-4">Sign in to add words to your review queue.</p>
      )}
    </div>
  );
};

export default IHNIList;
