// src/components/AILearningAssistant.jsx - AI Assistant Interface
import React, { useState, useEffect } from 'react';
import { Brain, MessageCircle, Target, TrendingUp, Lightbulb, Loader, Sparkles, BookOpen } from 'lucide-react';
// AI logic moved to /api/ai/quiz
import { spacedRepetitionService } from '../lib/spacedRepetition';

const AILearningAssistant = ({ userId, userProgress, isVisible, onClose }) => {
  const [activeTab, setActiveTab] = useState('insights');
  const [aiContent, setAIContent] = useState({});
  const [loading, setLoading] = useState({});
  const [chatMessages, setChatMessages] = useState([]);
  const [userMessage, setUserMessage] = useState('');

  useEffect(() => {
    if (isVisible && userId) {
      loadInitialInsights();
    }
  }, [isVisible, userId]);

  const loadInitialInsights = async () => {
    try {
      setLoading(prev => ({ ...prev, insights: true }));
      
      // Get user's learning stats
      const learningStats = await spacedRepetitionService.getLearningStats(userId);
      
      // Generate AI insights
      const insights = await vocabAI.generateLearningInsights(userId, learningStats);
      
      setAIContent(prev => ({
        ...prev,
        insights: insights
      }));
      
    } catch (error) {
      console.error('Error loading AI insights:', error);
    } finally {
      setLoading(prev => ({ ...prev, insights: false }));
    }
  };

  const generateHints = async () => {
    try {
      setLoading(prev => ({ ...prev, hints: true }));
      
      // Get user's current learning words
      const reviewWords = await spacedRepetitionService.getWordsForReview(userId, 3);
      const hints = [];
      
      for (const wordProgress of reviewWords) {
        const hint = await vocabAI.generateContextualHint(
          wordProgress.words, 
          [], // Could include user's previous mistakes
          'medium'
        );
        hints.push(hint);
      }
      
      setAIContent(prev => ({
        ...prev,
        hints: hints
      }));
      
    } catch (error) {
      console.error('Error generating hints:', error);
    } finally {
      setLoading(prev => ({ ...prev, hints: false }));
    }
  };

  const generatePracticeQuestions = async () => {
    try {
      setLoading(prev => ({ ...prev, practice: true }));
      
      // Get recent words for practice
      const reviewWords = await spacedRepetitionService.getWordsForReview(userId, 5);
      const words = reviewWords.map(rw => rw.words);
      
      if (words.length > 0) {
        const questions = await vocabAI.generatePracticeQuestions(
          words, 
          userProgress,
          userProgress.is_premium ? 'medium' : 'easy'
        );
        
        setAIContent(prev => ({
          ...prev,
          practice: questions
        }));
      }
      
    } catch (error) {
      console.error('Error generating practice questions:', error);
    } finally {
      setLoading(prev => ({ ...prev, practice: false }));
    }
  };

  const sendChatMessage = async () => {
    if (!userMessage.trim()) return;
    
    const newMessage = {
      id: Date.now(),
      type: 'user',
      content: userMessage,
      timestamp: new Date()
    };
    
    setChatMessages(prev => [...prev, newMessage]);
    setUserMessage('');
    setLoading(prev => ({ ...prev, chat: true }));
    
    try {
      // Generate AI response based on user message
      const response = await vocabAI.generateMotivationalMessage(userId, {
        achieved: userMessage,
        streak: userProgress.streak,
        summary: `User message: ${userMessage}`
      });
      
      const aiMessage = {
        id: Date.now() + 1,
        type: 'ai',
        content: response.content,
        timestamp: new Date()
      };
      
      setChatMessages(prev => [...prev, aiMessage]);
      
    } catch (error) {
      console.error('Error getting AI response:', error);
      const errorMessage = {
        id: Date.now() + 1,
        type: 'ai',
        content: 'I\'m having trouble responding right now, but keep up the great work with your vocabulary learning!',
        timestamp: new Date()
      };
      setChatMessages(prev => [...prev, errorMessage]);
    } finally {
      setLoading(prev => ({ ...prev, chat: false }));
    }
  };

  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-0 md:p-4 z-50 backdrop-blur-sm">
      {/* Main Container: Full screen on mobile, 5/6 height on desktop */}
      <div className="bg-white rounded-none md:rounded-xl shadow-2xl w-full max-w-4xl h-full md:h-5/6 flex flex-col overflow-hidden">
        
        {/* Header - Fixed to top */}
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
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/20 rounded-lg transition-all active:scale-95"
          >
            <span className="text-xl md:text-2xl">✕</span>
          </button>
        </div>

        {/* Tabs - Scrollable horizontally on small screens */}
        <div className="flex border-b bg-gray-50 overflow-x-auto no-scrollbar shrink-0">
          {[
            { id: 'insights', label: 'Learning Insights', icon: TrendingUp },
            { id: 'hints', label: 'Smart Hints', icon: Lightbulb },
            { id: 'practice', label: 'AI Practice', icon: Target },
            { id: 'chat', label: 'Ask VocabAI', icon: MessageCircle }
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

        {/* Content Area - Independent Scroll */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6 bg-white min-h-0">
          {/* Learning Insights Tab */}
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
                        <Brain className="w-4 h-4 sm:hidden" />
                        VocabAI Analysis
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

          {/* Smart Hints Tab */}
          {activeTab === 'hints' && (
            <div className="space-y-6 animate-in fade-in duration-300">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <h3 className="text-lg font-semibold text-gray-800">AI-Generated Study Hints</h3>
                <button
                  onClick={generateHints}
                  disabled={loading.hints}
                  className="flex items-center justify-center gap-2 px-4 py-2.5 bg-amber-500 text-white rounded-lg hover:bg-amber-600 disabled:opacity-50 transition-colors w-full sm:w-auto shadow-md"
                >
                  {loading.hints ? <Loader className="w-4 h-4 animate-spin" /> : <Lightbulb className="w-4 h-4" />}
                  {loading.hints ? 'Generating...' : 'Get Hints'}
                </button>
              </div>

              {aiContent.hints ? (
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
                  <p className="text-sm">Need a mnemonic? Generate hints for your words.</p>
                </div>
              )}
            </div>
          )}

          {/* AI Practice Tab */}
          {activeTab === 'practice' && (
            <div className="space-y-6 animate-in fade-in duration-300">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <h3 className="text-lg font-semibold text-gray-800">AI Practice Questions</h3>
                <button
                  onClick={generatePracticeQuestions}
                  disabled={loading.practice}
                  className="flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 transition-colors w-full sm:w-auto shadow-md"
                >
                  {loading.practice ? <Loader className="w-4 h-4 animate-spin" /> : <Target className="w-4 h-4" />}
                  {loading.practice ? 'Creating...' : 'Start Practice'}
                </button>
              </div>

              {aiContent.practice ? (
                <div className="space-y-4">
                  {aiContent.practice.questions.map((question, index) => (
                    <div key={index} className="bg-white rounded-xl p-5 border-2 border-emerald-50 shadow-sm hover:border-emerald-100 transition-colors">
                      <div className="flex items-start gap-4">
                        <div className="flex flex-col items-center shrink-0">
                          <div className="p-2 bg-emerald-100 rounded-lg mb-2">
                            <Target className="w-5 h-5 text-emerald-600" />
                          </div>
                          <span className="text-[10px] font-bold text-emerald-800 uppercase">Q{index + 1}</span>
                        </div>
                        <div className="flex-1">
                          <div className="text-gray-800 font-medium mb-3 text-sm md:text-base">
                            {question.content}
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                              question.type === 'multiple_choice' ? 'bg-blue-100 text-blue-700' :
                              question.type === 'fill_blank' ? 'bg-purple-100 text-purple-700' :
                              'bg-orange-100 text-orange-700'
                            }`}>
                              {question.type.replace('_', ' ')}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-16 text-gray-400">
                  <Target className="w-12 h-12 mx-auto mb-4 opacity-20" />
                  <p className="text-sm">Ready to test your knowledge? Generate a custom quiz.</p>
                </div>
              )}
            </div>
          )}

          {/* Chat Tab */}
          {activeTab === 'chat' && (
            <div className="flex flex-col h-full min-h-[450px] md:min-h-0 animate-in fade-in duration-300">
              <h3 className="text-lg font-semibold text-gray-800 mb-4 shrink-0">Chat with VocabAI</h3>
              
              {/* Chat Messages */}
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
                    {chatMessages.map((message) => (
                      <div
                        key={message.id}
                        className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
                      >
                        <div
                          className={`max-w-[85%] sm:max-w-[75%] px-4 py-2.5 rounded-2xl text-sm md:text-base shadow-sm ${
                            message.type === 'user'
                              ? 'bg-purple-600 text-white rounded-tr-none'
                              : 'bg-white border border-gray-200 text-gray-800 rounded-tl-none'
                          }`}
                        >
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

              {/* Chat Input - Stays visible above mobile keyboard */}
              <div className="flex gap-2 p-1 shrink-0">
                <input
                  type="text"
                  value={userMessage}
                  onChange={(e) => setUserMessage(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && sendChatMessage()}
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

        {/* Footer - Stats Bar */}
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