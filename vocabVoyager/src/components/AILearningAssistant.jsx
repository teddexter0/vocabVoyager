// src/components/AILearningAssistant.jsx
import React, { useState, useEffect, useRef } from 'react';
import { Brain, MessageCircle, Target, TrendingUp, Lightbulb, Loader, Sparkles, BookOpen, RefreshCw } from 'lucide-react';
import { spacedRepetitionService } from '../lib/spacedRepetition';
import { vocabAI } from '../lib/openAIAssistant';
import { supabase } from '../lib/supabase'; 

const MAX_REFRESHES = 3; // per session

const AILearningAssistant = ({ userId, userProgress, isVisible, onClose }) => {
  const [activeTab, setActiveTab] = useState('insights');
  const [aiContent, setAIContent] = useState({});
  const [loading, setLoading] = useState({});
  const [chatMessages, setChatMessages] = useState([]);
  const [userMessage, setUserMessage] = useState('');
  const [practiceAnswers, setPracticeAnswers] = useState({});
  const [practiceRevealed, setPracticeRevealed] = useState({});

  // One shared word pool for both Hints and Practice — guaranteed to be the same
  const [sharedWords, setSharedWords] = useState([]);
  const [wordsLoading, setWordsLoading] = useState(false);
  const [refreshesLeft, setRefreshesLeft] = useState(MAX_REFRESHES);

  // Track which tabs have been auto-generated so we only fire once per set
  const generatedFor = useRef({ hints: null, practice: null }); // stores the sharedWords ref

  // ── Pick words when modal first opens ──────────────────────────────────
  useEffect(() => {
    if (isVisible && userId) {
      if (!aiContent.insights) loadInitialInsights();
      if (sharedWords.length === 0 && !wordsLoading) pickSharedWords();
    }
  }, [isVisible, userId]);

  // ── Auto-generate for active tab whenever words become available ────────
  useEffect(() => {
    if (!isVisible || sharedWords.length === 0) return;

    if (activeTab === 'hints' && !aiContent.hints && !loading.hints) {
      runGenerateHints(sharedWords);
    }
    if (activeTab === 'practice' && !aiContent.practice && !loading.practice) {
      runGeneratePractice(sharedWords);
    }
  }, [activeTab, sharedWords, isVisible]); // eslint-disable-line

  // ── Pick a fresh set of shared words ───────────────────────────────────
  const pickSharedWords = async () => {
    setWordsLoading(true);
    try {
      const pool = await spacedRepetitionService.getWordsForReview(userId, 20);
      const shuffled = [...pool].sort(() => Math.random() - 0.5).slice(0, 5);
      setSharedWords(shuffled);
    } catch (e) {
      console.error('pickSharedWords error:', e);
    } finally {
      setWordsLoading(false);
    }
  };

  // ── Refresh: new word set, clear both tabs, decrement quota ────────────
  const handleNewSet = async () => {
    if (refreshesLeft <= 0) return;
    setRefreshesLeft(r => r - 1);
    setSharedWords([]);
    setAIContent(prev => ({ ...prev, hints: null, practice: null }));
    setPracticeAnswers({});
    setPracticeRevealed({});
    await pickSharedWords(); // await so words are ready before effect fires
  };

  // ── Shared word labels (for display) ───────────────────────────────────
  const wordLabels = sharedWords.map(rw => rw.words?.word).filter(Boolean);

  // ── Insights ───────────────────────────────────────────────────────────
  const loadInitialInsights = async () => {
    try {
      setLoading(prev => ({ ...prev, insights: true }));
      const learningStats = await spacedRepetitionService.getLearningStats(userId);
      const insights = await vocabAI.generateLearningInsights(userId, learningStats);
      setAIContent(prev => ({ ...prev, insights }));
    } catch (error) {
      console.error('Error loading AI insights:', error);
    } finally {
      setLoading(prev => ({ ...prev, insights: false }));
    }
  };

  // ── Hints (uses sharedWords passed as arg to avoid stale closure) ───────
  const runGenerateHints = async (words) => {
    if (!words.length) return;
    try {
      setLoading(prev => ({ ...prev, hints: true }));
      const hints = [];
      for (const wordProgress of words) {
        const hint = await vocabAI.generateContextualHint(wordProgress.words, [], 'medium');
        hints.push(hint);
      }
      setAIContent(prev => ({ ...prev, hints }));
    } catch (error) {
      console.error('Error generating hints:', error);
    } finally {
      setLoading(prev => ({ ...prev, hints: false }));
    }
  };

  // ── Practice (uses sharedWords passed as arg — same set as hints) ───────
  const runGeneratePractice = async (words) => {
    if (!words.length) return;
    try {
      setLoading(prev => ({ ...prev, practice: true }));
      const wordObjs = words.map(rw => rw.words);
      const questions = await vocabAI.generatePracticeQuestions(
        wordObjs,
        userProgress,
        userProgress.is_premium ? 'medium' : 'easy'
      );
      setAIContent(prev => ({ ...prev, practice: questions }));
      setPracticeAnswers({});
      setPracticeRevealed({});
    } catch (error) {
      console.error('Error generating practice:', error);
    } finally {
      setLoading(prev => ({ ...prev, practice: false }));
    }
  };

  // ── Chat ────────────────────────────────────────────────────────────────
  const sendChatMessage = async () => {
    if (!userMessage.trim()) return;
    const newMessage = { id: Date.now(), type: 'user', content: userMessage, timestamp: new Date() };
    setChatMessages(prev => [...prev, newMessage]);
    setUserMessage('');
    setLoading(prev => ({ ...prev, chat: true }));
    try {
      const response = await vocabAI.generateChatResponse(userId, userMessage, userProgress);
      setChatMessages(prev => [...prev, { id: Date.now() + 1, type: 'ai', content: response.content, timestamp: new Date() }]);
    } catch {
      setChatMessages(prev => [...prev, { id: Date.now() + 1, type: 'ai', content: "I'm having a moment — ask me about any word or your progress!", timestamp: new Date() }]);
    } finally {
      setLoading(prev => ({ ...prev, chat: false }));
    }
  };

  if (!isVisible) return null;

  // ── Shared header for Hints + Practice tabs ─────────────────────────────
  const SharedWordHeader = ({ title, color }) => (
    <div className="flex flex-col gap-2 mb-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-800">{title}</h3>
        {refreshesLeft > 0 ? (
          <button
            onClick={handleNewSet}
            disabled={wordsLoading || loading.hints || loading.practice}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors disabled:opacity-40
              ${color === 'amber'
                ? 'border-amber-300 text-amber-700 hover:bg-amber-50'
                : 'border-emerald-300 text-emerald-700 hover:bg-emerald-50'}`}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${wordsLoading ? 'animate-spin' : ''}`} />
            New Set · {refreshesLeft} left
          </button>
        ) : (
          <span className="text-xs text-gray-400 italic">No refreshes left this session</span>
        )}
      </div>
      {/* Word pills — both tabs show the same words */}
      {wordLabels.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {wordLabels.map(w => (
            <span key={w} className="px-2.5 py-0.5 bg-gray-100 text-gray-600 text-xs font-medium rounded-full border border-gray-200">
              {w}
            </span>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-0 md:p-4 z-50 backdrop-blur-sm">
      <div className="bg-white rounded-none md:rounded-xl shadow-2xl w-full max-w-4xl h-full md:h-5/6 flex flex-col overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between p-4 md:p-6 border-b bg-gradient-to-r from-purple-600 to-blue-600 text-white shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/20 rounded-lg hidden xs:block">
              <Brain className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg md:text-xl font-bold">VocabAI Assistant</h2>
              <p className="text-xs opacity-90">Your personal learning companion</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-lg transition-all active:scale-95">
            <span className="text-xl md:text-2xl">✕</span>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b bg-gray-50 overflow-x-auto no-scrollbar shrink-0">
          {[
            { id: 'insights', label: 'Learning Insights', icon: TrendingUp },
            { id: 'hints',    label: 'Smart Hints',       icon: Lightbulb  },
            { id: 'practice', label: 'AI Practice',       icon: Target     },
            { id: 'chat',     label: 'Ask VocabAI',       icon: MessageCircle },
          ].map(tab => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 md:px-6 py-3 font-medium transition-colors whitespace-nowrap text-sm md:text-base border-b-2 ${
                  activeTab === tab.id
                    ? 'text-purple-600 border-purple-600 bg-white'
                    : 'text-gray-600 border-transparent hover:text-purple-600 hover:bg-gray-100/50'
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6 bg-white min-h-0">

          {/* Learning Insights */}
          {activeTab === 'insights' && (
            <div className="space-y-6 animate-in fade-in duration-300">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <h3 className="text-lg font-semibold text-gray-800">Personalized Learning Analysis</h3>
                <button
                  onClick={loadInitialInsights}
                  disabled={loading.insights}
                  className="flex items-center justify-center gap-2 px-4 py-2.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 transition-colors w-full sm:w-auto shadow-md"
                >
                  {loading.insights ? <Loader className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                  {loading.insights ? 'Analyzing...' : 'Refresh Analysis'}
                </button>
              </div>
              {aiContent.insights ? (
                <div className="bg-gradient-to-br from-purple-50 to-blue-50 rounded-xl p-4 md:p-6 border border-purple-100 shadow-sm">
                  <div className="flex items-start gap-4">
                    <div className="p-2.5 bg-white rounded-lg shadow-sm hidden sm:block">
                      <Brain className="w-5 h-5 text-purple-600" />
                    </div>
                    <div className="flex-1">
                      <h4 className="font-bold text-purple-900 mb-3 flex items-center gap-2">
                        <Brain className="w-4 h-4 sm:hidden" />VocabAI Analysis
                      </h4>
                      <div className="text-gray-700 whitespace-pre-line leading-relaxed text-sm md:text-base">
                        {aiContent.insights.content}
                      </div>
                      <div className="mt-6 pt-4 border-t border-purple-200/50 text-[10px] md:text-xs text-gray-400 flex items-center justify-between">
                        <span>Analysis valid for current session</span>
                        <span>{new Date(aiContent.insights.timestamp).toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-16 text-gray-400">
                  <div className="bg-gray-50 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Brain className="w-10 h-10 opacity-20" />
                  </div>
                  <p className="text-sm">Click "Refresh Analysis" to see your learning patterns!</p>
                </div>
              )}
            </div>
          )}

          {/* Smart Hints */}
          {activeTab === 'hints' && (
            <div className="space-y-4 animate-in fade-in duration-300">
              <SharedWordHeader title="AI-Generated Study Hints" color="amber" />

              {loading.hints || wordsLoading ? (
                <div className="flex flex-col items-center justify-center py-20 gap-3 text-amber-500">
                  <Loader className="w-8 h-8 animate-spin" />
                  <p className="text-sm text-gray-400">Generating hints for your words…</p>
                </div>
              ) : aiContent.hints ? (
                <div className="grid gap-4">
                  {aiContent.hints.map((hint, index) => (
                    <div key={index} className="bg-amber-50/50 rounded-xl p-4 border border-amber-100 hover:border-amber-200 transition-colors">
                      <div className="flex items-start gap-3">
                        <div className="p-2 bg-amber-100 rounded-lg shrink-0">
                          <Lightbulb className="w-4 h-4 text-amber-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="font-bold text-amber-900 mb-1 truncate">{hint.word}</h4>
                          <p className="text-gray-700 text-sm md:text-base leading-snug">{hint.hint}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-16 text-gray-400">
                  <Lightbulb className="w-12 h-12 mx-auto mb-4 opacity-20" />
                  <p className="text-sm">No review words yet — keep learning to unlock hints!</p>
                </div>
              )}
            </div>
          )}

          {/* AI Practice */}
          {activeTab === 'practice' && (
            <div className="space-y-4 animate-in fade-in duration-300">
              <SharedWordHeader title="AI Practice Questions" color="emerald" />

              {loading.practice || wordsLoading ? (
                <div className="flex flex-col items-center justify-center py-20 gap-3 text-emerald-500">
                  <Loader className="w-8 h-8 animate-spin" />
                  <p className="text-sm text-gray-400">Building your practice quiz…</p>
                </div>
              ) : aiContent.practice ? (
                // Parse practice questions
                <div className="space-y-5">
                  {aiContent.practice.questions.map((question, index) => {
                    const chosen = practiceAnswers[index];
                    const revealed = practiceRevealed[index];
                    const isCorrect = chosen === question.correctAnswer;
                    return (
                      <div key={index} className="bg-white rounded-xl p-5 border-2 border-emerald-50 shadow-sm">
                        <div className="flex items-start gap-3 mb-4">
                          <div className="p-2 bg-emerald-100 rounded-lg shrink-0">
                            <Target className="w-5 h-5 text-emerald-600" />
                          </div>
                          <p className="text-gray-800 font-medium text-sm md:text-base">
                            <span className="text-emerald-700 font-bold mr-1">Q{index + 1}.</span>
                            {question.question}
                          </p>
                        </div>
                        {question.options ? (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-3">
                            {Object.entries(question.options).map(([letter, text]) => {
                              if (!text) return null;
                              const isChosen = chosen === letter;
                              const isAnswer = question.correctAnswer === letter;
                              let btnClass = 'border-gray-200 bg-gray-50 text-gray-700 hover:border-emerald-300 hover:bg-emerald-50';
                              if (revealed) {
                                if (isAnswer) btnClass = 'border-emerald-500 bg-emerald-50 text-emerald-800 font-semibold';
                                else if (isChosen && !isAnswer) btnClass = 'border-red-400 bg-red-50 text-red-700 line-through';
                              } else if (isChosen) {
                                btnClass = 'border-emerald-400 bg-emerald-50 text-emerald-800 font-semibold';
                              }
                              return (
                                <button
                                  key={letter}
                                  onClick={() => { if (!revealed) setPracticeAnswers(prev => ({ ...prev, [index]: letter })); }}
                                  className={`flex items-center gap-2 px-4 py-2.5 rounded-lg border-2 text-sm text-left transition-all ${btnClass}`}
                                >
                                  <span className="font-bold shrink-0">{letter})</span>
                                  <span>{text}</span>
                                </button>
                              );
                            })}
                          </div>
                        ) : (
                          <p className="text-sm text-gray-500 italic mb-3">Open-ended — think about your answer.</p>
                        )}
                        {question.options && (
                          <div className="flex items-center gap-3">
                            {!revealed ? (
                              <button
  onClick={async () => {
    setPracticeRevealed(prev => ({ ...prev, [index]: true }));
    // Actually persist the result to spaced repetition
    if (userId && question.targetWord) {
      const { data: wordRow } = await supabase
        .from('words').select('id').eq('word', question.targetWord).maybeSingle();
      if (wordRow) {
        const isRight = chosen === question.correctAnswer;
        await spacedRepetitionService.updateWordProgress(userId, wordRow.id, {
          isCorrect: isRight,
          responseTime: 3000,
          accuracy: isRight ? 1.0 : 0.0,
          consecutiveCorrect: isRight ? 1 : 0
        });
      }
    }
  }}
  disabled={!chosen}
  className="px-4 py-2 text-sm bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
>
  Check Answer
</button>
                            ) : (
                              <span className={`text-sm font-semibold px-3 py-1 rounded-full ${isCorrect ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                                {isCorrect ? '✓ Correct!' : `✗ Answer: ${question.correctAnswer}`}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-16 text-gray-400">
                  <Target className="w-12 h-12 mx-auto mb-4 opacity-20" />
                  <p className="text-sm">No review words yet — keep learning to unlock practice!</p>
                </div>
              )}
            </div>
          )}

          {/* Chat */}
          {activeTab === 'chat' && (
            <div className="flex flex-col h-full min-h-[450px] md:min-h-0 animate-in fade-in duration-300">
              <h3 className="text-lg font-semibold text-gray-800 mb-4 shrink-0">Chat with VocabAI</h3>
              <div className="flex-1 bg-gray-50/50 rounded-xl p-4 mb-4 overflow-y-auto min-h-0 border border-gray-100 shadow-inner">
                {chatMessages.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center text-gray-400 p-6">
                    <div className="p-4 bg-white rounded-full shadow-sm mb-4">
                      <MessageCircle className="w-10 h-10 opacity-20" />
                    </div>
                    <p className="text-sm font-medium text-gray-500 mb-1">I'm your AI Vocabulary Coach</p>
                    <p className="text-xs max-w-[250px]">Ask me to explain a word, give you examples, or quiz you on your current list.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {chatMessages.map(message => (
                      <div key={message.id} className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[85%] sm:max-w-[75%] px-4 py-2.5 rounded-2xl text-sm md:text-base shadow-sm ${
                          message.type === 'user'
                            ? 'bg-purple-600 text-white rounded-tr-none'
                            : 'bg-white border border-gray-200 text-gray-800 rounded-tl-none'
                        }`}>
                          <p className="whitespace-pre-line leading-relaxed">{message.content}</p>
                          <p className={`text-[10px] mt-1.5 font-medium ${message.type === 'user' ? 'text-purple-200' : 'text-gray-400'}`}>
                            {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>
                      </div>
                    ))}
                    {loading.chat && (
                      <div className="flex justify-start">
                        <div className="bg-white border border-gray-100 rounded-2xl rounded-tl-none px-4 py-3 shadow-sm">
                          <div className="flex items-center gap-3">
                            <div className="flex gap-1">
                              <div className="w-1.5 h-1.5 bg-purple-400 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                              <div className="w-1.5 h-1.5 bg-purple-500 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                              <div className="w-1.5 h-1.5 bg-purple-600 rounded-full animate-bounce"></div>
                            </div>
                            <span className="text-xs font-medium text-gray-500">VocabAI is thinking...</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
              <div className="flex gap-2 p-1 shrink-0">
                <input
                  type="text"
                  value={userMessage}
                  onChange={e => setUserMessage(e.target.value)}
                  onKeyPress={e => e.key === 'Enter' && sendChatMessage()}
                  placeholder="Ask something..."
                  className="flex-1 px-4 py-3 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm shadow-sm"
                />
                <button
                  onClick={sendChatMessage}
                  disabled={loading.chat || !userMessage.trim()}
                  className="px-5 py-3 bg-purple-600 text-white rounded-xl hover:bg-purple-700 disabled:opacity-50 transition-all shadow-md active:scale-95 flex items-center justify-center shrink-0"
                >
                  <MessageCircle className="w-5 h-5" />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t bg-gray-50/80 backdrop-blur-sm px-4 md:px-6 py-3 shrink-0">
          <div className="flex items-center justify-between text-[10px] md:text-xs font-bold uppercase tracking-wider text-gray-500">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.5)]"></div>
              <span>AI Engine Ready</span>
            </div>
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1.5">
                <BookOpen className="w-3.5 h-3.5 text-purple-600" />
                {userProgress.words_learned || 0} WORDS
              </span>
              <span className="flex items-center gap-1.5">
                <Target className="w-3.5 h-3.5 text-blue-600" />
                LVL {userProgress.current_level || 1}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AILearningAssistant;
