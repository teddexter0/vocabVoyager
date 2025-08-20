// src/components/AILearningAssistant.jsx - AI Assistant Interface
import React, { useState, useEffect } from 'react';
import { Brain, MessageCircle, Target, TrendingUp, Lightbulb, Loader, Sparkles, BookOpen } from 'lucide-react';
import { vocabAI } from '../lib/openAIAssistant';
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
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl h-5/6 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-t-xl">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white bg-opacity-20 rounded-lg">
              <Brain className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold">VocabAI Assistant</h2>
              <p className="text-sm opacity-90">Your personal learning companion</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white hover:bg-opacity-20 rounded-lg transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b bg-gray-50">
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
                className={`flex items-center gap-2 px-6 py-3 font-medium transition-colors ${
                  activeTab === tab.id
                    ? 'text-purple-600 border-b-2 border-purple-600 bg-white'
                    : 'text-gray-600 hover:text-purple-600'
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Learning Insights Tab */}
          {activeTab === 'insights' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-800">Personalized Learning Analysis</h3>
                <button
                  onClick={loadInitialInsights}
                  disabled={loading.insights}
                  className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
                >
                  {loading.insights ? <Loader className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                  {loading.insights ? 'Analyzing...' : 'Refresh Analysis'}
                </button>
              </div>

              {aiContent.insights ? (
                <div className="bg-gradient-to-br from-purple-50 to-blue-50 rounded-lg p-6 border border-purple-200">
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-purple-100 rounded-lg">
                      <Brain className="w-5 h-5 text-purple-600" />
                    </div>
                    <div className="flex-1">
                      <h4 className="font-semibold text-purple-800 mb-2">VocabAI Analysis</h4>
                      <div className="text-gray-700 whitespace-pre-line leading-relaxed">
                        {aiContent.insights.content}
                      </div>
                      <div className="mt-4 text-xs text-gray-500">
                        Generated {new Date(aiContent.insights.timestamp).toLocaleString()}
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-12 text-gray-500">
                  <Brain className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>Click "Refresh Analysis" to get personalized learning insights!</p>
                </div>
              )}
            </div>
          )}

          {/* Smart Hints Tab */}
          {activeTab === 'hints' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-800">AI-Generated Study Hints</h3>
                <button
                  onClick={generateHints}
                  disabled={loading.hints}
                  className="flex items-center gap-2 px-4 py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 disabled:opacity-50"
                >
                  {loading.hints ? <Loader className="w-4 h-4 animate-spin" /> : <Lightbulb className="w-4 h-4" />}
                  {loading.hints ? 'Generating...' : 'Generate Hints'}
                </button>
              </div>

              {aiContent.hints ? (
                <div className="space-y-4">
                  {aiContent.hints.map((hint, index) => (
                    <div key={index} className="bg-yellow-50 rounded-lg p-4 border border-yellow-200">
                      <div className="flex items-start gap-3">
                        <div className="p-2 bg-yellow-100 rounded-lg">
                          <Lightbulb className="w-4 h-4 text-yellow-600" />
                        </div>
                        <div className="flex-1">
                          <h4 className="font-semibold text-yellow-800 mb-1">{hint.word}</h4>
                          <p className="text-gray-700">{hint.hint}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 text-gray-500">
                  <Lightbulb className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>Generate smart hints for your learning words!</p>
                </div>
              )}
            </div>
          )}

          {/* AI Practice Tab */}
          {activeTab === 'practice' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-800">AI-Generated Practice Questions</h3>
                <button
                  onClick={generatePracticeQuestions}
                  disabled={loading.practice}
                  className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                >
                  {loading.practice ? <Loader className="w-4 h-4 animate-spin" /> : <Target className="w-4 h-4" />}
                  {loading.practice ? 'Creating...' : 'Generate Questions'}
                </button>
              </div>

              {aiContent.practice ? (
                <div className="space-y-4">
                  {aiContent.practice.questions.map((question, index) => (
                    <div key={index} className="bg-green-50 rounded-lg p-4 border border-green-200">
                      <div className="flex items-start gap-3">
                        <div className="p-2 bg-green-100 rounded-lg">
                          <Target className="w-4 h-4 text-green-600" />
                        </div>
                        <div className="flex-1">
                          <h4 className="font-semibold text-green-800 mb-2">Question {question.id}</h4>
                          <div className="text-gray-700 whitespace-pre-line">
                            {question.content}
                          </div>
                          <div className="mt-2">
                            <span className={`px-2 py-1 rounded text-xs font-medium ${
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
                <div className="text-center py-12 text-gray-500">
                  <Target className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>Generate personalized practice questions based on your learning progress!</p>
                </div>
              )}
            </div>
          )}

          {/* Chat Tab */}
          {activeTab === 'chat' && (
            <div className="flex flex-col h-full">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">Chat with VocabAI</h3>
              
              {/* Chat Messages */}
              <div className="flex-1 bg-gray-50 rounded-lg p-4 mb-4 overflow-y-auto min-h-0">
                {chatMessages.length === 0 ? (
                  <div className="text-center text-gray-500 py-8">
                    <MessageCircle className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p className="mb-2">Ask VocabAI anything about vocabulary learning!</p>
                    <p className="text-sm">Try: "How can I remember difficult words?" or "What's my learning progress?"</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {chatMessages.map((message) => (
                      <div
                        key={message.id}
                        className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
                      >
                        <div
                          className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                            message.type === 'user'
                              ? 'bg-purple-600 text-white'
                              : 'bg-white border border-gray-200 text-gray-800'
                          }`}
                        >
                          <p className="whitespace-pre-line">{message.content}</p>
                          <p className={`text-xs mt-1 opacity-70`}>
                            {message.timestamp.toLocaleTimeString()}
                          </p>
                        </div>
                      </div>
                    ))}
                    {loading.chat && (
                      <div className="flex justify-start">
                        <div className="bg-white border border-gray-200 rounded-lg px-4 py-2">
                          <div className="flex items-center gap-2">
                            <Loader className="w-4 h-4 animate-spin text-purple-600" />
                            <span className="text-gray-600">VocabAI is thinking...</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Chat Input */}
              <div className="flex gap-2">
                <input
                  type="text"
                  value={userMessage}
                  onChange={(e) => setUserMessage(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && sendChatMessage()}
                  placeholder="Ask VocabAI about your learning..."
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
                <button
                  onClick={sendChatMessage}
                  disabled={loading.chat || !userMessage.trim()}
                  className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 transition-colors"
                >
                  Send
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t bg-gray-50 px-6 py-4 rounded-b-xl">
          <div className="flex items-center justify-between text-sm text-gray-600">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-green-400 rounded-full"></div>
              <span>AI Assistant Active</span>
            </div>
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1">
                <BookOpen className="w-4 h-4" />
                {userProgress.words_learned || 0} words learned
              </span>
              <span className="flex items-center gap-1">
                <Target className="w-4 h-4" />
                Level {userProgress.current_level || 1}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AILearningAssistant;