// src/App.js - FIXED VERSION
import React, { useState, useEffect } from 'react';
import { ChevronRight, Target, Calendar, Trophy, BookOpen, User, LogOut, Crown, Star, Loader, CreditCard, Brain, CheckCircle, XCircle } from 'lucide-react';
import { supabase, dbHelpers, authHelpers } from './lib/supabase';
import { pesapalService } from './lib/pesapal';
import { spacedRepetitionService, reviewQuestionGenerator, reviewSessionTypes } from './lib/spacedRepetition';

const VocabImprover = () => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [currentWords, setCurrentWords] = useState([]);
  const [showDefinitions, setShowDefinitions] = useState(false);
  const [currentSession, setCurrentSession] = useState(null);
  const [userProgress, setUserProgress] = useState({
    streak: 0,
    words_learned: 0,
    current_level: 1,
    total_days: 1,
    last_visit: null,
    is_premium: false
  });
  const [showAuth, setShowAuth] = useState(false);
  const [paymentLoading, setPaymentLoading] = useState(false);
  
  // Review session states
  const [reviewMode, setReviewMode] = useState(false);
  const [currentReviewQuestion, setCurrentReviewQuestion] = useState(null);
  const [reviewQuestions, setReviewQuestions] = useState([]);
  const [reviewAnswers, setReviewAnswers] = useState([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [showReviewResult, setShowReviewResult] = useState(false);
  const [learningStats, setLearningStats] = useState(null);

  // Initialize app
  useEffect(() => {
    initializeApp();
  }, []);

  const initializeApp = async () => {
    try {
      const currentUser = await authHelpers.getCurrentUser();
      
      if (currentUser) {
        setUser(currentUser);
        await loadUserData(currentUser.id);
        
        // Check for payment callback
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get('OrderTrackingId')) {
          await handlePaymentCallback(urlParams);
        }
      } else {
        setLoading(false);
      }
    } catch (error) {
      console.error('Error initializing app:', error);
      setLoading(false);
    }
  };

  // Auth state listener
  useEffect(() => {
    const { data: { subscription } } = authHelpers.onAuthStateChange(
      async (event, session) => {
        if (session?.user) {
          setUser(session.user);
          await loadUserData(session.user.id);
        } else {
          setUser(null);
          resetUserState();
          setLoading(false);
        }
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  const resetUserState = () => {
    setUserProgress({
      streak: 0,
      words_learned: 0,
      current_level: 1,
      total_days: 1,
      last_visit: null,
      is_premium: false
    });
    setCurrentWords([]);
    setCurrentSession(null);
    setReviewMode(false);
    setLearningStats(null);
  };

  // 🔥 FIXED: Load user data with proper function calls
  const loadUserData = async (userId) => {
    try {
      console.log('📊 Loading user data for:', userId);

      // Load user progress
      let progress = await dbHelpers.getUserProgress(userId);

      if (!progress) {
        progress = {
          streak: 1,
          words_learned: 0,
          current_level: 1,
          total_days: 1,
          last_visit: new Date().toISOString().split('T')[0],
          is_premium: false
        };
        await dbHelpers.upsertUserProgress(userId, progress);
      }

      setUserProgress(progress);
      console.log("✅ User progress loaded:", progress);

      // 🔥 FIXED: Use the correct function name from supabase.js
      const sessionResult = await dbHelpers.getTodaySessionOrCreate(userId, progress.current_level, progress.is_premium);
      
      console.log('📅 Session result:', sessionResult);

      if (sessionResult.session && sessionResult.words.length > 0) {
        setCurrentSession(sessionResult.session);
        setCurrentWords(sessionResult.words);
        setShowDefinitions(sessionResult.session.completed);
        
        console.log(`✅ Session loaded: ${sessionResult.isNewSession ? 'NEW' : 'EXISTING'} with ${sessionResult.words.length} words`);
      } else if (sessionResult.noWords) {
        console.warn('⚠️ No words available - check database');
        setCurrentWords([]);
      } else {
        console.warn('⚠️ No session or words loaded');
        setCurrentWords([]);
      }

      // Try to load learning statistics (will fail gracefully if tables don't exist)
      try {
        const stats = await spacedRepetitionService.getLearningStats(userId);
        setLearningStats(stats);
      } catch (statsError) {
        console.log('📊 Learning stats not available (tables may not exist yet):', statsError.message);
        setLearningStats(null);
      }

      setLoading(false);
    } catch (error) {
      console.error('Error loading user data:', error);
      setLoading(false);
    }
  };

  // Handle Pesapal payment callback
  const handlePaymentCallback = async (urlParams) => {
    try {
      const orderTrackingId = urlParams.get('OrderTrackingId');
      const merchantReference = urlParams.get('OrderMerchantReference');
      
      if (orderTrackingId) {
        console.log('💳 Processing payment callback:', orderTrackingId);
        
        // Get pending payment from localStorage
        const pendingPayment = localStorage.getItem('pending_payment');
        if (pendingPayment) {
          const paymentData = JSON.parse(pendingPayment);
          
          // Verify payment with Pesapal
          const verification = await pesapalService.getPaymentStatus(
            await pesapalService.getAccessToken(),
            orderTrackingId
          );
          
          if (verification.success && verification.confirmed) {
            // Payment successful - upgrade user
            const updatedProgress = {
              ...userProgress,
              is_premium: true,
              premium_until: new Date(Date.now() + (30 * 24 * 60 * 60 * 1000)).toISOString() // 30 days from now
            };
            
            await dbHelpers.upsertUserProgress(user.id, updatedProgress);
            setUserProgress(updatedProgress);
            
            // Clear pending payment
            localStorage.removeItem('pending_payment');
            
            alert('🎉 Payment successful! You now have Premium access!');
            
            // Reload session with premium access
            const sessionResult = await dbHelpers.getTodaySessionOrCreate(user.id, userProgress.current_level, true);
            if (sessionResult.session && sessionResult.words.length > 0) {
              setCurrentSession(sessionResult.session);
              setCurrentWords(sessionResult.words);
              setShowDefinitions(sessionResult.session.completed);
            }
          } else {
            alert('❌ Payment verification failed. Please contact support.');
          }
        }
        
        // Clean up URL
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    } catch (error) {
      console.error('❌ Payment callback error:', error);
      alert('❌ Payment processing error. Please contact support.');
    }
  };

  // Initiate Pesapal payment
  const handleUpgradeToPremium = async () => {
    if (!user) {
      alert('Please sign in first!');
      setShowAuth(true);
      return;
    }

    if (userProgress.is_premium) {
      alert('You already have Premium access!');
      return;
    }

    try {
      setPaymentLoading(true);
      
      const paymentResult = await pesapalService.initiatePayment(user.email, 'premium');
      
      if (paymentResult.success) {
        // Redirect to Pesapal payment page
        window.location.href = paymentResult.redirectUrl;
      } else {
        throw new Error(paymentResult.error);
      }
      
    } catch (error) {
      console.error('❌ Payment initiation failed:', error);
      alert('Payment failed: ' + error.message);
    } finally {
      setPaymentLoading(false);
    }
  };

  // Start review session
  const startReviewSession = async () => {
    try {
      console.log('🧠 Starting review session...');
      
      // Get review words and all words for generating questions
      const reviewWords = await spacedRepetitionService.getWordsForReview(user.id, 5);
      
      if (reviewWords.length === 0) {
        alert('No words are due for review today! Complete today\'s lesson first.');
        return;
      }
      
      const { data: allWords } = await supabase
        .from('words')
        .select('*')
        .lte('level', userProgress.is_premium ? 5 : 1);
      
      // Generate review questions
      const questions = await reviewQuestionGenerator.generateReviewSession(
        reviewWords.map(rw => rw.words),
        allWords || []
      );
      
      setReviewQuestions(questions);
      setCurrentQuestionIndex(0);
      setCurrentReviewQuestion(questions[0]);
      setReviewAnswers([]);
      setReviewMode(true);
      
    } catch (error) {
      console.error('❌ Error starting review session:', error);
      alert('Failed to start review session');
    }
  };

  // Handle review answer
  const handleReviewAnswer = async (answer, isCorrect) => {
    const currentQuestion = reviewQuestions[currentQuestionIndex];
    
    // Record the answer
    const answerRecord = {
      questionIndex: currentQuestionIndex,
      wordId: currentQuestion.targetWord.id,
      answer: answer,
      isCorrect: isCorrect,
      timestamp: Date.now()
    };
    
    setReviewAnswers(prev => [...prev, answerRecord]);
    
    // Update word progress in database (will fail gracefully if tables don't exist)
    try {
      await spacedRepetitionService.recordWordAttempt(
        user.id,
        currentQuestion.targetWord.id,
        isCorrect
      );
    } catch (error) {
      console.log('📝 Could not record word attempt (spaced repetition tables may not exist):', error.message);
    }
    
    // Show result briefly
    setShowReviewResult({ isCorrect, correctAnswer: currentQuestion.correctAnswer || currentQuestion.targetWord.synonym });
    
    setTimeout(() => {
      setShowReviewResult(false);
      
      // Move to next question or finish
      if (currentQuestionIndex < reviewQuestions.length - 1) {
        const nextIndex = currentQuestionIndex + 1;
        setCurrentQuestionIndex(nextIndex);
        setCurrentReviewQuestion(reviewQuestions[nextIndex]);
      } else {
        // Review session complete
        completeReviewSession();
      }
    }, 2000);
  };

  // Complete review session
  const completeReviewSession = async () => {
    const correctAnswers = reviewAnswers.filter(a => a.isCorrect).length;
    const totalQuestions = reviewAnswers.length;
    const accuracy = ((correctAnswers / totalQuestions) * 100).toFixed(1);
    
    alert(`🎉 Review session complete!\nAccuracy: ${accuracy}% (${correctAnswers}/${totalQuestions})`);
    
    setReviewMode(false);
    setCurrentReviewQuestion(null);
    setReviewQuestions([]);
    setReviewAnswers([]);
    
    // Refresh learning stats
    try {
      const stats = await spacedRepetitionService.getLearningStats(user.id);
      setLearningStats(stats);
    } catch (error) {
      console.log('📊 Could not refresh learning stats:', error.message);
    }
  };

  // Auth functions
  const handleAuth = async (email, password, isSignUp = false) => {
    try {
      const { data, error } = isSignUp 
        ? await authHelpers.signUp(email, password)
        : await authHelpers.signIn(email, password);
      
      if (error) throw error;
      setShowAuth(false);
      
      if (isSignUp) {
        alert('Check your email for verification link!');
      }
    } catch (error) {
      alert('Authentication failed: ' + error.message);
    }
  };

  const handleSignOut = async () => {
    try {
      await authHelpers.signOut();
    } catch (error) {
      console.error('Sign out error:', error);
    }
  };

  const handleRevealDefinitions = async () => {
    setShowDefinitions(true);
    
    if (user && currentSession) {
      try {
        // Mark session as completed and update progress
        const success = await dbHelpers.completeSession(
          currentSession.id, 
          user.id, 
          currentWords.length
        );
        
        if (success) {
          // Record each word as seen for spaced repetition (will fail gracefully if tables don't exist)
          try {
            for (const word of currentWords) {
              await spacedRepetitionService.recordWordAttempt(user.id, word.id, true);
            }
          } catch (srError) {
            console.log('📝 Could not record words for spaced repetition (tables may not exist):', srError.message);
          }
          
          // Refresh user progress
          const updatedProgress = await dbHelpers.getUserProgress(user.id);
          if (updatedProgress) {
            setUserProgress(updatedProgress);
          }
        }
      } catch (error) {
        console.error('Error completing session:', error);
      }
    }
  };

  // Review Question Component
  const ReviewQuestion = ({ question, onAnswer }) => {
    const [selectedAnswer, setSelectedAnswer] = useState('');
    
    const handleSubmit = () => {
      if (!selectedAnswer.trim()) {
        alert('Please provide an answer!');
        return;
      }
      
      let isCorrect = false;
      
      if (question.type === reviewSessionTypes.MULTIPLE_CHOICE) {
        const selectedOption = question.options.find(opt => opt.id.toString() === selectedAnswer);
        isCorrect = selectedOption?.isCorrect || false;
      } else if (question.type === reviewSessionTypes.FILL_BLANK) {
        isCorrect = question.acceptableAnswers.some(acceptable => 
          selectedAnswer.toLowerCase().trim() === acceptable
        );
      } else {
        const selectedOption = question.options.find(opt => opt.text === selectedAnswer);
        isCorrect = selectedOption?.isCorrect || false;
      }
      
      onAnswer(selectedAnswer, isCorrect);
      setSelectedAnswer('');
    };
    
    return (
      <div className="bg-white rounded-lg p-6 shadow-lg">
        <div className="mb-4">
          <span className="text-sm text-blue-600 font-medium">
            Question {currentQuestionIndex + 1} of {reviewQuestions.length}
          </span>
        </div>
        
        <h3 className="text-xl font-bold mb-4">{question.question}</h3>
        
        {question.type === reviewSessionTypes.FILL_BLANK ? (
          <div>
            <input
              type="text"
              value={selectedAnswer}
              onChange={(e) => setSelectedAnswer(e.target.value)}
              placeholder="Type your answer..."
              className="w-full p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 mb-4"
              onKeyPress={(e) => e.key === 'Enter' && handleSubmit()}
            />
            {question.hint && (
              <p className="text-sm text-gray-600 mb-4">💡 {question.hint}</p>
            )}
          </div>
        ) : (
          <div className="space-y-3 mb-6">
            {question.options.map((option, index) => (
              <label
                key={option.id || index}
                className="flex items-center p-3 border rounded-lg cursor-pointer hover:bg-gray-50"
              >
                <input
                  type="radio"
                  name="answer"
                  value={option.id || option.text}
                  checked={selectedAnswer === (option.id?.toString() || option.text)}
                  onChange={(e) => setSelectedAnswer(e.target.value)}
                  className="mr-3"
                />
                <span>{option.text}</span>
              </label>
            ))}
          </div>
        )}
        
        <button
          onClick={handleSubmit}
          disabled={!selectedAnswer.trim()}
          className="w-full py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium"
        >
          Submit Answer
        </button>
      </div>
    );
  };

  // Auth Modal Component
  const AuthModal = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isSignUp, setIsSignUp] = useState(false);
    const [authLoading, setAuthLoading] = useState(false);

    const handleSubmit = async (e) => {
      e.preventDefault();
      setAuthLoading(true);
      await handleAuth(email, password, isSignUp);
      setAuthLoading(false);
    };

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
        <div className="bg-white rounded-lg p-6 w-full max-w-sm">
          <h2 className="text-xl font-bold mb-4 text-center">
            {isSignUp ? 'Create Account' : 'Sign In'}
          </h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
            <input
              type="password"
              placeholder="Password (min 6 characters)"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              minLength="6"
              required
            />
            <button
              type="submit"
              disabled={authLoading}
              className="w-full py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {authLoading && <Loader className="w-4 h-4 animate-spin" />}
              {isSignUp ? 'Sign Up' : 'Sign In'}
            </button>
            <button
              type="button"
              onClick={() => setIsSignUp(!isSignUp)}
              className="w-full py-2 text-blue-600 hover:text-blue-800"
            >
              {isSignUp ? 'Already have an account? Sign In' : 'Need an account? Sign Up'}
            </button>
            <button
              type="button"
              onClick={() => setShowAuth(false)}
              className="w-full py-2 text-gray-600 hover:text-gray-800"
            >
              Cancel
            </button>
          </form>
        </div>
      </div>
    );
  };

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <div className="text-center">
          <Loader className="w-8 h-8 animate-spin mx-auto mb-4 text-blue-600" />
          <p className="text-gray-600">Loading your vocabulary journey...</p>
        </div>
      </div>
    );
  }

  // Landing page for non-authenticated users
  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
        <div className="max-w-4xl mx-auto text-center py-16">
          <h1 className="text-5xl font-bold text-gray-800 mb-6">
            📚 VocabVoyager
          </h1>
          <p className="text-xl text-gray-600 mb-8">
            Master vocabulary with AI-powered spaced repetition
          </p>
          
          <div className="grid md:grid-cols-2 gap-6 mb-8">
            <div className="bg-white p-6 rounded-lg shadow-lg">
              <h3 className="text-xl font-bold mb-2">🧠 Smart Learning</h3>
              <p className="text-gray-600">
                AI-powered spaced repetition adapts to your learning pace
              </p>
            </div>
            <div className="bg-white p-6 rounded-lg shadow-lg">
              <h3 className="text-xl font-bold mb-2">💳 Secure Payments</h3>
              <p className="text-gray-600">
                Pay securely with Pesapal - Kenya's trusted payment platform
              </p>
            </div>
          </div>

          <button
            onClick={() => setShowAuth(true)}
            className="inline-flex items-center gap-2 px-8 py-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-bold text-lg"
          >
            Start Learning Today
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
        
        {showAuth && <AuthModal />}
      </div>
    );
  }

  // Review mode interface
  if (reviewMode && currentReviewQuestion) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-100 p-4">
        <div className="max-w-2xl mx-auto">
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-2xl font-bold text-gray-800">🧠 Review Session</h1>
            <button
              onClick={() => setReviewMode(false)}
              className="px-4 py-2 text-gray-600 hover:text-gray-800"
            >
              Exit Review
            </button>
          </div>
          
          {showReviewResult ? (
            <div className={`bg-white rounded-lg p-8 text-center shadow-lg ${showReviewResult.isCorrect ? 'border-green-500 border-2' : 'border-red-500 border-2'}`}>
              {showReviewResult.isCorrect ? (
                <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
              ) : (
                <XCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
              )}
              <h3 className="text-2xl font-bold mb-2">
                {showReviewResult.isCorrect ? 'Correct!' : 'Not quite right'}
              </h3>
              {!showReviewResult.isCorrect && (
                <p className="text-gray-600">
                  The correct answer was: <strong>{showReviewResult.correctAnswer}</strong>
                </p>
              )}
            </div>
          ) : (
            <ReviewQuestion 
              question={currentReviewQuestion} 
              onAnswer={handleReviewAnswer}
            />
          )}
        </div>
      </div>
    );
  }

  // Main app for authenticated users
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-800">📚 VocabVoyager</h1>
            <p className="text-gray-600">Smart vocabulary learning with spaced repetition</p>
          </div>
          <div className="flex items-center gap-4">
            {/* Review button - only show if learning stats are available and have review words */}
            {learningStats && learningStats.wordsForReviewToday > 0 && (
              <button
                onClick={startReviewSession}
                className="flex items-center gap-2 px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-colors font-medium"
              >
                <Brain className="w-4 h-4" />
                Review ({learningStats.wordsForReviewToday})
              </button>
            )}
            
            {/* Upgrade button */}
            {!userProgress.is_premium && (
              <button
                onClick={handleUpgradeToPremium}
                disabled={paymentLoading}
                className="flex items-center gap-2 px-4 py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 transition-colors font-medium disabled:opacity-50"
              >
                {paymentLoading ? (
                  <Loader className="w-4 h-4 animate-spin" />
                ) : (
                  <CreditCard className="w-4 h-4" />
                )}
                {paymentLoading ? 'Processing...' : 'Upgrade KES 499'}
              </button>
            )}
            
            <div className="flex items-center gap-2 text-gray-600">
              <User className="w-4 h-4" />
              <span className="text-sm">{user.email}</span>
            </div>
            <button
              onClick={handleSignOut}
              className="p-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Progress Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-lg p-4 shadow-sm border">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-orange-100 rounded-lg">
                <Target className="w-5 h-5 text-orange-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Streak</p>
                <p className="text-2xl font-bold text-gray-800">{userProgress.streak}</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-lg p-4 shadow-sm border">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <BookOpen className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Words Learned</p>
                <p className="text-2xl font-bold text-gray-800">{learningStats?.totalWordsLearned || userProgress.words_learned}</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-lg p-4 shadow-sm border">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 rounded-lg">
                <Brain className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Mastery</p>
                <p className="text-2xl font-bold text-gray-800">{learningStats?.averageMastery || '0.0'}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg p-4 shadow-sm border">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Trophy className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Accuracy</p>
                <p className="text-2xl font-bold text-gray-800">{learningStats?.accuracyRate || '0'}%</p>
              </div>
            </div>
          </div>
        </div>

        {/* Learning Stats Card - only show if stats are available */}
        {learningStats && (
          <div className="bg-white rounded-lg p-6 mb-6 shadow-sm border">
            <h3 className="text-lg font-bold text-gray-800 mb-4">📊 Learning Progress</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
              <div>
                <p className="text-2xl font-bold text-blue-600">{learningStats.totalWordsLearned}</p>
                <p className="text-sm text-gray-600">Total Words</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-green-600">{learningStats.masteredWords}</p>
                <p className="text-sm text-gray-600">Mastered</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-purple-600">{learningStats.wordsForReviewToday}</p>
                <p className="text-sm text-gray-600">Due Today</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-orange-600">{learningStats.accuracyRate}%</p>
                <p className="text-sm text-gray-600">Accuracy</p>
              </div>
            </div>
          </div>
        )}

        {/* Premium Banner */}
        {!userProgress.is_premium && (
          <div className="bg-gradient-to-r from-yellow-400 to-orange-500 rounded-lg p-6 mb-6 text-white">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-xl font-bold mb-2">💎 Upgrade to Premium</h3>
                <p className="mb-2">• Access all 5 difficulty levels (450+ words)</p>
                <p className="mb-2">• Advanced spaced repetition algorithm</p>
                <p>• Detailed learning analytics & progress tracking</p>
              </div>
              <div className="text-center">
                <p className="text-3xl font-bold mb-2">KES 499</p>
                <p className="text-sm opacity-75 mb-4">per month</p>
                <button
                  onClick={handleUpgradeToPremium}
                  disabled={paymentLoading}
                  className="bg-white text-orange-600 px-6 py-3 rounded-lg font-bold hover:bg-gray-100 transition-colors w-full sm:w-auto disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {paymentLoading ? (
                    <>
                      <Loader className="w-4 h-4 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <CreditCard className="w-4 h-4" />
                      Pay with Pesapal
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Daily Words Session */}
        <div className="bg-white rounded-xl shadow-lg p-8 mb-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
              <Calendar className="w-6 h-6 text-blue-600" />
              Today's Learning Session
              {userProgress.is_premium && <Star className="w-5 h-5 text-yellow-500" />}
            </h2>
            <div className="text-sm text-gray-500">
              {userProgress.is_premium ? 'Premium • All Levels' : 'Free • Level 1 Only'}
            </div>
          </div>

          {currentWords.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-600 mb-4">Loading today's words...</p>
              <Loader className="w-6 h-6 animate-spin mx-auto text-blue-600" />
            </div>
          ) : (
            <div className="space-y-6">
              {currentWords.map((wordData, index) => (
                <div key={wordData.id} className={`border-l-4 pl-6 py-4 ${wordData.isReview ? 'border-purple-500 bg-purple-50' : 'border-blue-500'}`}>
                  {wordData.isReview && (
                    <div className="mb-2">
                      <span className="px-2 py-1 bg-purple-100 text-purple-700 rounded-full text-xs font-medium">
                        🧠 REVIEW
                      </span>
                    </div>
                  )}
                  
                  <div className="mb-4">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-4 mb-2">
                      <span className="text-3xl font-bold text-gray-800">
                        {wordData.word}
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-medium">
                          ≈ {wordData.synonym}
                        </span>
                        <span className="px-2 py-1 bg-gray-100 text-gray-600 rounded text-xs">
                          Level {wordData.level}
                        </span>
                      </div>
                    </div>
                    <p className="text-gray-600 italic">
                      {wordData.isReview 
                        ? `Review this word you learned before...`
                        : `Think of it as: "${wordData.synonym}" but with more depth...`
                      }
                    </p>
                  </div>

                  {showDefinitions && (
                    <div className="mt-4 space-y-3">
                      <div className="bg-gray-50 rounded-lg p-4">
                        <h4 className="font-semibold text-gray-800 mb-1">Definition:</h4>
                        <p className="text-gray-700">{wordData.definition}</p>
                      </div>
                      
                      <div className="bg-green-50 rounded-lg p-4">
                        <h4 className="font-semibold text-gray-800 mb-1">Example:</h4>
                        <p className="text-gray-700 italic">"{wordData.example}"</p>
                      </div>
                      
                      <div className="bg-blue-50 rounded-lg p-4">
                        <h4 className="font-semibold text-gray-800 mb-1">Context:</h4>
                        <p className="text-gray-700">{wordData.context}</p>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {!showDefinitions && currentWords.length > 0 && (
            <div className="mt-8 text-center">
              <button
                onClick={handleRevealDefinitions}
                className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
              >
                Reveal Definitions & Examples
                <ChevronRight className="w-5 h-5" />
              </button>
              <p className="text-sm text-gray-500 mt-2">
                First, try to guess the meanings based on the synonyms above
              </p>
            </div>
          )}

          {showDefinitions && currentWords.length > 0 && (
            <div className="mt-8 p-4 bg-green-50 rounded-lg border border-green-200">
              <h3 className="font-semibold text-green-800 mb-2">🎉 Session Complete!</h3>
              <p className="text-green-700 mb-4">
                You've completed today's vocabulary session. These words are now in your spaced repetition system.
              </p>
              
              {learningStats && learningStats.wordsForReviewToday > 0 && (
                <div className="flex items-center justify-between">
                  <p className="text-green-700">
                    You have {learningStats.wordsForReviewToday} words ready for review.
                  </p>
                  <button
                    onClick={startReviewSession}
                    className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium"
                  >
                    Start Review
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* App Info */}
        <div className="bg-white rounded-lg p-6 text-center text-sm text-gray-600">
          <p className="mb-2">
            <strong>🧠 Smart Learning:</strong> Spaced repetition algorithm optimizes your retention
          </p>
          <p className="mb-2">
            <strong>📈 Progress:</strong> Level {userProgress.current_level} • {learningStats?.totalWordsLearned || userProgress.words_learned} words learned • {userProgress.streak} day streak
          </p>
          <p className="text-xs text-gray-500">
            {userProgress.is_premium 
              ? '💎 Premium Account - Full Access' 
              : '🆓 Free Account - Upgrade for advanced features'
            }
          </p>
        </div>
      </div>
    </div>
  );
};

export default VocabImprover;