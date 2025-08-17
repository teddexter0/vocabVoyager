// src/App.js - FIXED AUTH HANDLING
import React, { useState, useEffect } from 'react';
import { ChevronRight, Target, Calendar, Trophy, BookOpen, User, LogOut, Crown, Star, Loader, CreditCard, Brain, CheckCircle, XCircle } from 'lucide-react';
import { supabase, dbHelpers, authHelpers } from './lib/supabase';
import { pesapalService } from './lib/pesapal';
import { spacedRepetitionService, reviewQuestionGenerator, reviewSessionTypes } from './lib/spacedRepetition';

const VocabImprover = () => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authChecked, setAuthChecked] = useState(false);
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
  const [paymentProcessing, setPaymentProcessing] = useState(false);
  // Review session states
  const [reviewMode, setReviewMode] = useState(false);
  const [currentReviewQuestion, setCurrentReviewQuestion] = useState(null);
  const [reviewQuestions, setReviewQuestions] = useState([]);
  const [reviewAnswers, setReviewAnswers] = useState([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [showReviewResult, setShowReviewResult] = useState(false);
  const [learningStats, setLearningStats] = useState(null);

  // FIXED: Better initialization
  useEffect(() => {
    initializeApp();
  }, []); 
const initializeApp = async () => {
  try {
    // Check auth state first
    const currentUser = await authHelpers.getCurrentUser();
    setAuthChecked(true);
    
    if (currentUser) {
      setUser(currentUser);
      await loadUserData(currentUser.id);
      
      // ✅ FIXED: Only check payment callback AFTER user is loaded
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get('OrderTrackingId') || urlParams.get('dev_payment')) {
        await handlePaymentCallback(urlParams, currentUser);
      }
    }
  } catch (error) {
    console.error('Error initializing app:', error);
    setAuthChecked(true);
  } finally {
    setLoading(false);
  }
};

  // FIXED: Auth state listener
  useEffect(() => {
    const { data: { subscription } } = authHelpers.onAuthStateChange(
      async (event, session) => {
        console.log('Auth event:', event);
        
        if (session?.user && session.user.id !== user?.id) {
          setUser(session.user);
          if (authChecked) {
            await loadUserData(session.user.id);
          }
        } else if (!session && user) {
          // User signed out
          setUser(null);
          resetUserState();
        }
      }
    );

    return () => subscription.unsubscribe();
  }, [user, authChecked]);

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

  // Load user data
  const loadUserData = async (userId) => {
    try {
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

      // Load session
      const sessionResult = await dbHelpers.getTodaySessionOrCreate(userId, progress.current_level, progress.is_premium);
      
      if (sessionResult.session && sessionResult.words.length > 0) {
        setCurrentSession(sessionResult.session);
        setCurrentWords(sessionResult.words);
        setShowDefinitions(sessionResult.session.completed);
      } else {
        setCurrentWords([]);
      }

      // Try to load learning statistics
      try {
        const stats = await spacedRepetitionService.getLearningStats(userId);
        setLearningStats(stats);
      } catch (statsError) {
        // This is fine - spaced repetition might not be set up yet
        setLearningStats(null);
      }

    } catch (error) {
      console.error('Error loading user data:', error);
    }
  };

  // Session state management
  const getSessionState = () => {
    if (loading) return 'loading';
    if (!currentSession && currentWords.length === 0) return 'no_words';
    if (currentSession?.completed && showDefinitions) return 'completed_today';
    if (currentWords.length > 0 && !showDefinitions) return 'ready_to_learn';
    if (currentWords.length > 0 && showDefinitions) return 'just_completed';
    return 'unknown';
  };

  // Session status message component
  const SessionStatusMessage = () => {
    const sessionState = getSessionState();
    
    const messages = {
      loading: {
        icon: "⏳",
        title: "Loading your learning session...",
        message: "Preparing today's vocabulary words",
        action: null
      },
      no_words: {
        icon: "📚",
        title: "Words loading...",
        message: "If this persists, please refresh the page.",
        action: { text: "Refresh", onPress: () => window.location.reload() }
      },
      completed_today: {
        icon: "🎉",
        title: "You've completed today's session!",
        message: "Excellent work! Come back tomorrow for 3 new words to master.",
        action: { 
          text: "Set Daily Reminder", 
          onPress: () => alert("💡 Bookmark this page and visit daily to build a strong learning habit!\n\nTip: Visit at the same time each day for best results.") 
        }
      },
      ready_to_learn: {
        icon: "🚀",
        title: "Ready to learn today's words?",
        message: "Try to guess the meanings from the synonyms before revealing definitions!",
        action: null
      },
      just_completed: {
        icon: "✅",
        title: "Session complete!",
        message: "Great job! These words are now in your spaced repetition queue.",
        action: null
      }
    };

    const config = messages[sessionState] || messages.loading;

    return (
      <div className="bg-white rounded-xl shadow-lg p-8 mb-6 text-center">
        <div className="text-4xl mb-4">{config.icon}</div>
        <h2 className="text-2xl font-bold text-gray-800 mb-2">{config.title}</h2>
        <p className="text-gray-600 mb-4">{config.message}</p>
        {config.action && (
          <button
            onClick={config.action.onPress}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
          >
            {config.action.text}
          </button>
        )}
      </div>
    );
  };
  
  
  // ✅ UPDATED: Add guard to prevent multiple payment processing
  const handlePaymentCallback = async (urlParams, currentUser = null) => {
    // Prevent multiple simultaneous payment processing
    if (paymentProcessing) {
      console.log('⚠️ Payment already being processed, skipping...');
      return;
    }

    try {
      const orderTrackingId = urlParams.get('OrderTrackingId');
      const isDevPayment = urlParams.get('dev_payment') === 'success';
      
      // Use passed user or fall back to state
      const userToUse = currentUser || user;
      
      if (!userToUse) {
        console.log('⚠️ No user found for payment callback, skipping...');
        return;
      }
      
      if (orderTrackingId) {
        setPaymentProcessing(true); // ✅ Set guard
        
        console.log('💳 Processing payment callback:', orderTrackingId);
        
        // Check for pending payment data
        const pendingPayment = localStorage.getItem('pending_payment') || localStorage.getItem('dev_payment_success');
        
        if (pendingPayment) {
          const paymentData = JSON.parse(pendingPayment);
          
          let verification;
          
          // Handle development mode payment
          if (orderTrackingId.startsWith('DEV_') || isDevPayment) {
            verification = {
              success: true,
              confirmed: true,
              isDevelopment: true
            };
          } else {
            // Handle real Pesapal payment
            verification = await pesapalService.getPaymentStatus(
              await pesapalService.getAccessToken(),
              orderTrackingId
            );
          }
          
          if (verification.success && verification.confirmed) {
            // Payment successful - upgrade user
            const updatedProgress = {
              ...userProgress,
              is_premium: true,
              premium_until: new Date(Date.now() + (30 * 24 * 60 * 60 * 1000)).toISOString()
            };
            
            await dbHelpers.upsertUserProgress(userToUse.id, updatedProgress);
            setUserProgress(updatedProgress);
            
            // Clean up storage
            localStorage.removeItem('pending_payment');
            localStorage.removeItem('dev_payment_success');
            
            // Show success message
            const message = verification.isDevelopment 
              ? '🔧 Development Payment Successful!\n\nYou now have Premium access!\n\n(This was a simulation - no real money was charged)'
              : '🎉 Payment Successful!\n\nWelcome to VocabVoyager Premium!\n\n✅ All 5 difficulty levels unlocked\n✅ Advanced spaced repetition\n✅ Detailed learning analytics\n\nThank you for your support!';
            
            alert(message);
            
            // Clean up URL and reload
            window.history.replaceState({}, document.title, window.location.pathname);
            window.location.reload();
            
            return; // Exit early
          } else {
            alert('❌ Payment verification failed. Please contact support if money was deducted.');
          }
        } else {
          console.log('⚠️ No pending payment data found');
        }
      }
      
      // Clean up URL 
      window.history.replaceState({}, document.title, window.location.pathname);
      
    } catch (error) {
      console.error('❌ Payment callback error:', error);
      
      if (error.message.includes('Cannot read properties of null')) {
        console.log('⚠️ Payment callback called before user loaded');
      } else {
        alert('❌ Payment processing error.');
      }
      
      // Clean up URL on error too
      window.history.replaceState({}, document.title, window.location.pathname);
    } finally {
      setPaymentProcessing(false); // ✅ Always clear guard
    }
  };



  // Payment handling
  const handleUpgradeToPremium = async () => {
    if (!user) {
      alert('Please sign in first to upgrade to Premium!');
      setShowAuth(true);
      return;
    }

    if (userProgress.is_premium) {
      alert('You already have Premium access! 🎉');
      return;
    }

    const confirmed = window.confirm(
      '💎 Upgrade to VocabVoyager Premium\n\n' +
      '✅ Access all 5 difficulty levels (450+ words)\n' +
      '✅ Advanced spaced repetition algorithm\n' +
      '✅ Detailed learning analytics\n\n' +
      'Amount: KES 499 per month\n\n' +
      'Proceed to secure Pesapal payment?'
    );

    if (!confirmed) return;

    try {
      setPaymentLoading(true);
      
      const paymentResult = await pesapalService.initiatePayment(user.email, 'premium');
      
      if (paymentResult.success) {
        window.location.href = paymentResult.redirectUrl;
      } else {
        throw new Error(paymentResult.error);
      }
      
    } catch (error) {
      console.error('❌ Payment failed:', error);
      alert('Payment failed: ' + error.message);
    } finally {
      setPaymentLoading(false);
    }
  };

  // Review session functions (simplified for space)
  const startReviewSession = async () => {
    try {
      const reviewWords = await spacedRepetitionService.getWordsForReview(user.id, 5);
      
      if (reviewWords.length === 0) {
        alert('No words are due for review today!\n\nComplete today\'s lesson first.');
        return;
      }
      
      const { data: allWords } = await supabase
        .from('words')
        .select('*')
        .lte('level', userProgress.is_premium ? 5 : 1);
      
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
      console.error('❌ Error starting review:', error);
      alert('Failed to start review session.');
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
        alert('📧 Check your email for verification link!');
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
        const success = await dbHelpers.completeSession(
          currentSession.id, 
          user.id, 
          currentWords.length
        );
        
        if (success) {
          try {
            for (const word of currentWords) {
              await spacedRepetitionService.recordWordAttempt(user.id, word.id, true);
            }
          } catch (srError) {
            // This is fine - spaced repetition might not be set up
          }
          
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

  // Auth Modal Component (simplified)
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
  if (loading || !authChecked) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <div className="text-center">
          <Loader className="w-8 h-8 animate-spin mx-auto mb-4 text-blue-600" />
          <p className="text-gray-600">Loading VocabVoyager...</p>
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
          
          <div className="grid md:grid-cols-3 gap-6 mb-8">
            <div className="bg-white p-6 rounded-lg shadow-lg">
              <h3 className="text-xl font-bold mb-2">🧠 Smart Learning</h3>
              <p className="text-gray-600">
                Science-backed spaced repetition algorithm
              </p>
            </div>
            <div className="bg-white p-6 rounded-lg shadow-lg">
              <h3 className="text-xl font-bold mb-2">📚 Rich Content</h3>
              <p className="text-gray-600">
                450+ carefully curated words with examples
              </p>
            </div>
            <div className="bg-white p-6 rounded-lg shadow-lg">
              <h3 className="text-xl font-bold mb-2">💳 Secure Payments</h3>
              <p className="text-gray-600">
                Powered by Pesapal - Kenya's trusted platform
              </p>
            </div>
          </div>

          <button
            onClick={() => setShowAuth(true)}
            className="inline-flex items-center gap-2 px-8 py-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-bold text-lg"
          >
            Start Learning Today - Free
            <ChevronRight className="w-5 h-5" />
          </button>
          
          <p className="text-sm text-gray-500 mt-4">
            No credit card required • Start with Level 1 words • Upgrade anytime
          </p>
        </div>
        
        {showAuth && <AuthModal />}
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
            <p className="text-gray-600">Smart vocabulary learning platform</p>
          </div>
          <div className="flex items-center gap-4">
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
                <p className="text-2xl font-bold text-gray-800">{userProgress.words_learned}</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-lg p-4 shadow-sm border">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 rounded-lg">
                <Brain className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Level</p>
                <p className="text-2xl font-bold text-gray-800">{userProgress.current_level}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg p-4 shadow-sm border">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Trophy className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Days</p>
                <p className="text-2xl font-bold text-gray-800">{userProgress.total_days}</p>
              </div>
            </div>
          </div>
        </div>

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

          {/* Session Status Message */}
          <SessionStatusMessage />

          {/* Show words if in learning mode */}
          {getSessionState() === 'ready_to_learn' && (
            <div className="space-y-6">
              {currentWords.map((wordData, index) => (
                <div key={wordData.id} className="border-l-4 border-blue-500 pl-6 py-4">
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
                      Think of it as: "{wordData.synonym}" but with more depth...
                    </p>
                  </div>
                </div>
              ))}
              
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
            </div>
          )}

          {/* Show definitions if just completed */}
          {getSessionState() === 'just_completed' && (
            <div className="space-y-6">
              {currentWords.map((wordData, index) => (
                <div key={wordData.id} className="border-l-4 border-green-500 pl-6 py-4 bg-green-50">
                  <div className="mb-4">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-4 mb-2">
                      <span className="text-2xl font-bold text-gray-800">
                        {wordData.word}
                      </span>
                      <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm font-medium">
                        ≈ {wordData.synonym}
                      </span>
                    </div>
                  </div>
                  
                  <div className="space-y-3">
                    <div className="bg-white rounded-lg p-4">
                      <h4 className="font-semibold text-gray-800 mb-1">Definition:</h4>
                      <p className="text-gray-700">{wordData.definition}</p>
                    </div>
                    
                    <div className="bg-green-100 rounded-lg p-4">
                      <h4 className="font-semibold text-gray-800 mb-1">Example:</h4>
                      <p className="text-gray-700 italic">"{wordData.example}"</p>
                    </div>
                    
                    <div className="bg-blue-50 rounded-lg p-4">
                      <h4 className="font-semibold text-gray-800 mb-1">Context:</h4>
                      <p className="text-gray-700">{wordData.context}</p>
                    </div>
                  </div>
                </div>
              ))}
              
              <div className="mt-8 p-4 bg-green-50 rounded-lg border border-green-200">
                <h3 className="font-semibold text-green-800 mb-2">🎉 Excellent work!</h3>
                <p className="text-green-700 mb-4">
                  You've completed today's vocabulary session. These words are now saved to your learning progress. Come back tomorrow for 3 new words!
                </p>
              </div>
            </div>
          )}
        </div>

        {/* App Info */}
        <div className="bg-white rounded-lg p-6 text-center text-sm text-gray-600">
          <p className="mb-2">
            <strong>🧠 Smart Learning:</strong> Scientifically designed spaced repetition
          </p>
          <p className="mb-2">
            <strong>📈 Progress:</strong> Level {userProgress.current_level} • {userProgress.words_learned} words learned • {userProgress.streak} day streak
          </p>
          <p className="text-xs text-gray-500">
            {userProgress.is_premium 
              ? '💎 Premium Account - Full Access to all 450+ words' 
              : '🆓 Free Account - Upgrade to unlock 450+ advanced words'
            }
          </p>
        </div>
      </div>
    </div>
  );
};

export default VocabImprover;