// src/App.js - COMPLETE VERSION WITH AI INTEGRATION
import React, { useState, useEffect } from 'react';
import { ChevronRight, Target, Calendar, Trophy, BookOpen, User, LogOut, Crown, Star, Loader, CreditCard, Brain, CheckCircle, XCircle, Users } from 'lucide-react';
import { supabase, dbHelpers, authHelpers } from './lib/supabase';
import { pesapalService } from './lib/pesapal';
import { spacedRepetitionService, reviewQuestionGenerator, reviewSessionTypes } from './lib/spacedRepetition';
import AILearningAssistant from './components/AILearningAssistant';
import PrivacyPolicy from './components/legal/PrivacyPolicy';
import ContactUs from './components/legal/ContactUs';
import ReviewDashboard from './components/ReviewDashboard';
import Pricing from './components/Pricing';
import TermsOfService from './components/legal/TermsOfService';
import IHNIList from './components/IHNIList';
import Leaderboard from './components/Leaderboard';
import Friends from './components/Friends';
import DailyWordFact from './components/DailyWordFact';


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
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [paymentProcessing, setPaymentProcessing] = useState(false);
  const [showAIAssistant, setShowAIAssistant] = useState(false);
  
  // Review session states
  const [reviewMode, setReviewMode] = useState(false);
  const [reviewWords, setReviewWords] = useState([]); // ✅ ADD THIS
  const [currentReviewQuestion, setCurrentReviewQuestion] = useState(null);
  const [reviewQuestions, setReviewQuestions] = useState([]);
  const [reviewAnswers, setReviewAnswers] = useState([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [showReviewResult, setShowReviewResult] = useState(false);
  const [learningStats, setLearningStats] = useState(null);
  const [currentView, setCurrentView] = useState('dashboard');
  const [userDisplayName, setUserDisplayName] = useState('');

  useEffect(() => {
  if (user) {
    setCurrentView('dashboard');
  } else {
    setCurrentView('landing');
  }
}, [user]);


  // Initialize app
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
        
        // Check payment callback AFTER user is loaded
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get('OrderTrackingId') || urlParams.get('dev_payment') || urlParams.get('payment_success') || urlParams.get('payment_failed')) {
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

  // Auth state listener
  useEffect(() => {
    const { data: { subscription } } = authHelpers.onAuthStateChange(
      async (event, session) => {
        console.log('Auth event:', event);

        if (event === 'PASSWORD_RECOVERY') {
          setShowNewPassword(true);
          return;
        }

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
    setShowAIAssistant(false);
  };

  // 🔒 Check real premium status from database
  // src/App.js - REPLACE checkPremiumStatusFromDatabase function

const checkPremiumStatusFromDatabase = async (userId) => {
  try {
    console.log('🔍 Checking premium status for user:', userId);
    
    // Get user's email from auth
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      console.error('❌ Error getting user:', userError);
      return false;
    }
    
    console.log('📧 User email:', user.email);
    
    // Check BOTH user_id AND email (Pesapal might use either)
    const { data, error } = await supabase
      .from('payment_transactions')
      .select('*')
      .or(`user_id.eq.${userId},email.eq.${user.email}`)
      .eq('status', 'completed')
      .gte('created_at', new Date(Date.now() - (30 * 24 * 60 * 60 * 1000)).toISOString())
      .order('created_at', { ascending: false });

    if (error) {
      console.error('❌ Error checking payment_transactions:', error);
      return false;
    }

    console.log('💳 Found payment records:', data?.length || 0);
    if (data && data.length > 0) {
      console.log('✅ Payment details:', data[0]);
    }

    const hasValidPayment = data && data.length > 0;

    if (hasValidPayment) {
      console.log('✅ Valid premium payment found!');
      return true;
    }

    console.log('⚠️ No valid premium payment found');
    return false;
    
  } catch (error) {
    console.error('❌ Exception checking premium status:', error);
    return false;
  }
};

// ✅ ALSO ADD: Call this when app loads
const loadUserData = async (userId) => {
  try {
      setLoading(true);
      
      console.log('🔄 Loading user data for:', userId);
      
      // 1. Check premium status FIRST
      const isPremium = await checkPremiumStatusFromDatabase(userId);
      console.log('💎 Premium status:', isPremium);
      
      // 2. Fetch User Progress + sync words_learned from user_word_progress
      const [progress, stats] = await Promise.all([
        dbHelpers.getUserProgress(userId),
        spacedRepetitionService.getLearningStats(userId)
      ]);

      const actualWordsLearned = stats?.totalWords ?? 0;

      if (progress) {
        const syncedProgress = {
          ...progress,
          is_premium: isPremium || progress.is_premium,
          words_learned: actualWordsLearned
        };
        setUserProgress(syncedProgress);

        // Persist the corrected count if it drifted
        if (progress.words_learned !== actualWordsLearned) {
          await dbHelpers.upsertUserProgress(userId, syncedProgress);
        }
      } else {
        console.warn('⚠️ No user progress found, creating default');
        const defaultProgress = {
          user_id: userId,
          streak: 1,
          words_learned: 0,
          current_level: 1,
          total_days: 1,
          is_premium: isPremium,
          last_visit: new Date().toISOString().split('T')[0]
        };
        const created = await dbHelpers.upsertUserProgress(userId, defaultProgress);
        if (created) setUserProgress(created);
      }

      // 3. Load today's session and words
      const level = (progress?.current_level) || 1;
      const premiumStatus = isPremium || progress?.is_premium || false;

      const { session, words, isNewSession } = await dbHelpers.getTodaySessionOrCreate(
        userId,
        level,
        premiumStatus
      );

      if (session) {
        setCurrentSession(session);
        setShowDefinitions(session.completed);
      }

      if (words && words.length > 0) {
        setCurrentWords(words);
      }

      // 4. Auto-seed user_profiles with Google display name (silently)
      try {
        const { data: { user: authUser } } = await supabase.auth.getUser();
        const googleName = authUser?.user_metadata?.full_name
          || authUser?.user_metadata?.name
          || '';
        if (googleName) setUserDisplayName(googleName);

        const { data: existingProfile } = await supabase
          .from('user_profiles')
          .select('user_id, display_name')
          .eq('user_id', userId)
          .maybeSingle();

        if (!existingProfile && googleName) {
          await supabase.from('user_profiles').insert({
            user_id: userId,
            display_name: googleName,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          });
        } else if (existingProfile?.display_name) {
          setUserDisplayName(existingProfile.display_name);
        }
      } catch { /* user_profiles table not yet created — silent */ }

  } catch (err) {
      console.error("❌ Critical error loading app data:", err);
  } finally {
      setLoading(false);
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
  
  // 🔒 Secure payment callback handler
  const handlePaymentCallback = async (urlParams, currentUser = null) => {
    if (paymentProcessing) {
      console.log('⚠️ Payment already being processed, skipping...');
      return;
    }

    try {
      setPaymentProcessing(true);

      const userToUse = currentUser || user;
      if (!userToUse) {
        console.log('⚠️ No user found for payment callback, skipping...');
        return;
      }

      // 🔒 HANDLE SECURE PAYMENT RESPONSES
      if (urlParams.get('payment_success') === '1') {
        const orderTrackingId = urlParams.get('OrderTrackingId');
        
        // ✅ PAYMENT SUCCESS - Refresh user data
        await loadUserData(userToUse.id);
        
        alert('🎉 Payment Successful!\n\nWelcome to VocabVoyager Premium!\n\n✅ All 5 difficulty levels unlocked\n✅ Advanced spaced repetition\n✅ Detailed learning analytics\n\nThank you for your support!');
        
      } else if (urlParams.get('payment_failed') === '1') {
        // ❌ PAYMENT FAILED
        alert('❌ Payment Failed!\n\nYour payment could not be processed. Please try again or contact support if money was deducted.');
        
      } else if (urlParams.get('payment_error') === '1') {
        // ❌ PAYMENT ERROR
        alert('❌ Payment Error!\n\nThere was an error processing your payment. Please try again later.');
        
      } else {
        // Legacy handling for old callback format
        const orderTrackingId = urlParams.get('OrderTrackingId');
        const isDevPayment = urlParams.get('dev_payment') === 'success';
        
        if (orderTrackingId || isDevPayment) {
          // Handle as before for backward compatibility
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
              
              // Reload to refresh data
              await loadUserData(userToUse.id);
            } else {
              alert('❌ Payment verification failed. Please contact support if money was deducted.');
            }
          }
        }
      }
      
      // Clean up URL
      window.history.replaceState({}, document.title, window.location.pathname);
      
    } catch (error) {
      console.error('❌ Payment callback error:', error);
      alert('❌ Payment processing error. Please contact support if needed.');
      window.history.replaceState({}, document.title, window.location.pathname);
    } finally {
      setPaymentProcessing(false);
    }
  };
  
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

    // ✅ COLLECT CUSTOMER'S M-PESA NUMBER (NOT YOURS)
    const customerPhone = prompt(
      '📱 Enter YOUR M-Pesa number for payment:\n\n' +
      'Format: 0722555444 or 254722555444\n\n' +
      'This is the number you will pay FROM.\n' +
      'Example: 0722555444'
    );

    if (!customerPhone) {
      alert('Your M-Pesa number is required for payment.');
      return;
    }

    // Validate customer's phone number
    const cleanPhone = customerPhone.replace(/\D/g, '');
    if (cleanPhone.length < 9 || cleanPhone.length > 12) {
      alert('Please enter a valid M-Pesa number.\nExample: 0722555444');
      return;
    }

    // Format to international format
    let formattedPhone = cleanPhone;
    if (formattedPhone.startsWith('0')) {
      formattedPhone = '254' + formattedPhone.substring(1);
    } else if (!formattedPhone.startsWith('254')) {
      formattedPhone = '254' + formattedPhone;
    }

    const confirmed = window.confirm(
      '💎 Upgrade to VocabVoyager Premium\n\n' +
      '✅ Access all 5 difficulty levels (450+ words)\n' +
      '✅ Advanced spaced repetition algorithm\n' +
      '✅ AI Learning Assistant\n' +
      '✅ Detailed learning analytics\n\n' +
      `Amount: KES 499 per month\n` +
      `Your M-Pesa: ${customerPhone}\n\n` +
      'Proceed to secure payment?'
    );

    if (!confirmed) return;

    try {
      setPaymentLoading(true);
      
      // ✅ SEND CUSTOMER'S PHONE TO PESAPAL
      const paymentResult = await pesapalService.initiatePayment(
        user.email, 
        'premium',
        formattedPhone  // Customer's real phone
      );
      
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
      // Sign-up path is unchanged
      if (isSignUp) {
        const { data, error } = await authHelpers.signUp(email, password);
        if (error) throw error;
        setShowAuth(false);
        alert('📧 Check your email for a verification link!');
        return;
      }

      // --- Smart sign-in ---
      const { error: signInError } = await authHelpers.signIn(email, password);
      if (!signInError) {
        setShowAuth(false);
        return;
      }

      // Sign-in failed: probe whether the email is already registered
      // Supabase returns identities:[] when the email already exists (prevents enumeration)
      const { data: probeData, error: probeError } = await supabase.auth.signUp({
        email: email.trim().toLowerCase(),
        password
      });

      if (probeError) {
        // Probe failed for an unrelated reason — surface the original sign-in error
        throw new Error('Incorrect password. Please try again.');
      }

      if (probeData?.user?.identities?.length === 0) {
        // Email IS registered — must be a wrong password
        throw new Error('Incorrect password. Please try again.');
      }

      // Email was NOT registered — account was just created by the probe
      setShowAuth(false);
      alert('✨ No account found for this email — we\'ve created one for you!\n\n📧 Check your email to verify before signing in.');

    } catch (error) {
      alert('❌ ' + error.message);
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
          // ✅ ENHANCED: Record spaced repetition progress for each word
          for (const word of currentWords) {
            const performance = {
              isCorrect: true, // They completed the session
              responseTime: 5000, // Estimate - could track real time later
              accuracy: 1.0,
              consecutiveCorrect: 1
            };
            
            try {
              await spacedRepetitionService.updateWordProgress(user.id, word.id, performance);
            } catch (srError) {
              console.log('Spaced repetition will start working once enhanced system is deployed');
            }
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

  // Auth Modal Component
  const AuthModal = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isSignUp, setIsSignUp] = useState(false);
    const [authLoading, setAuthLoading] = useState(false);
    const [step, setStep] = useState('login'); // 'login' | 'forgot' | 'sent'
    const [resetMsg, setResetMsg] = useState('');

    const handleSubmit = async (e) => {
      e.preventDefault();
      setAuthLoading(true);
      await handleAuth(email, password, isSignUp);
      setAuthLoading(false);
    };

    const handleForgotPassword = async (e) => {
      e.preventDefault();
      if (!email.trim()) return;
      setAuthLoading(true);
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: window.location.origin
      });
      setAuthLoading(false);
      if (error) {
        setResetMsg('Something went wrong. Please try again.');
      } else {
        setStep('sent');
      }
    };

    if (step === 'sent') {
      return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl p-8 w-full max-w-sm text-center space-y-4">
            <div className="text-5xl">📧</div>
            <h2 className="text-xl font-bold text-gray-800">Check your inbox</h2>
            <p className="text-gray-500 text-sm">
              We sent a password reset link to <span className="font-semibold text-gray-700">{email}</span>.
              Click the link in the email to set a new password.
            </p>
            <button
              onClick={() => setShowAuth(false)}
              className="w-full py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold"
            >
              Done
            </button>
          </div>
        </div>
      );
    }

    if (step === 'forgot') {
      return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-sm space-y-4">
            <h2 className="text-xl font-bold text-center text-gray-800">Reset Password</h2>
            <p className="text-sm text-gray-500 text-center">
              Enter your email and we'll send you a reset link.
            </p>
            <form onSubmit={handleForgotPassword} className="space-y-3">
              <input
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
                autoFocus
              />
              {resetMsg && <p className="text-sm text-red-500">{resetMsg}</p>}
              <button
                type="submit"
                disabled={authLoading || !email.trim()}
                className="w-full py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2 font-semibold"
              >
                {authLoading && <Loader className="w-4 h-4 animate-spin" />}
                Send Reset Link
              </button>
              <button
                type="button"
                onClick={() => setStep('login')}
                className="w-full py-2 text-gray-500 hover:text-gray-700 text-sm"
              >
                ← Back to Sign In
              </button>
            </form>
          </div>
        </div>
      );
    }

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
        <div className="bg-white rounded-xl p-6 w-full max-w-sm">
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
            <div className="space-y-1">
              <input
                type="password"
                placeholder="Password (min 6 characters)"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                minLength="6"
                required
              />
              {!isSignUp && (
                <div className="text-right">
                  <button
                    type="button"
                    onClick={() => setStep('forgot')}
                    className="text-xs text-blue-500 hover:text-blue-700"
                  >
                    Forgot password?
                  </button>
                </div>
              )}
            </div>
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

  // New Password Modal — shown after user clicks the reset link in their email
  const NewPasswordModal = () => {
    const [password, setPassword] = useState('');
    const [confirm, setConfirm] = useState('');
    const [saving, setSaving] = useState(false);
    const [msg, setMsg] = useState('');

    const handleSave = async (e) => {
      e.preventDefault();
      if (password !== confirm) { setMsg("Passwords don't match."); return; }
      if (password.length < 6) { setMsg('Password must be at least 6 characters.'); return; }
      setSaving(true);
      const { error } = await supabase.auth.updateUser({ password });
      setSaving(false);
      if (error) {
        setMsg(error.message || 'Failed to update password.');
      } else {
        setShowNewPassword(false);
        alert('✅ Password updated! You are now signed in.');
      }
    };

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
        <div className="bg-white rounded-xl p-6 w-full max-w-sm space-y-4">
          <h2 className="text-xl font-bold text-center text-gray-800">Set New Password</h2>
          <form onSubmit={handleSave} className="space-y-3">
            <input
              type="password"
              placeholder="New password (min 6 characters)"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              minLength="6"
              required
              autoFocus
            />
            <input
              type="password"
              placeholder="Confirm new password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className="w-full p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              minLength="6"
              required
            />
            {msg && <p className="text-sm text-red-500">{msg}</p>}
            <button
              type="submit"
              disabled={saving}
              className="w-full py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2 font-semibold"
            >
              {saving && <Loader className="w-4 h-4 animate-spin" />}
              Update Password
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

  // REPLACE your current landing page section (lines ~620-670) with this:

  // ===============================
// NON-AUTHENTICATED (GUEST) VIEW
// ===============================
if (!user) {
  console.log('GUEST VIEW:', currentView);

  const renderGuestView = () => {
    switch (currentView) {
      case 'pricing':
        return <Pricing />;
      case 'terms':
        return <TermsOfService />;
      case 'privacy':
        return <PrivacyPolicy />;
      case 'contact':
        return <ContactUs />;
      default:
        return (
          <>
            {/* ===== NAV ===== */}
            <nav className="bg-white shadow-sm border-b">
              <div className="max-w-6xl mx-auto px-4 py-4 flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">📚</span>
                  <span className="text-xl font-bold">VocabVoyager</span>
                </div>

                <div className="flex items-center gap-4">
                  <button
                    onClick={() => setCurrentView('pricing')}
                    className="text-gray-600 hover:text-gray-800 font-medium"
                  >
                    Pricing
                  </button>

                  <button
                    onClick={() => setShowAuth(true)}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    Sign In
                  </button>
                </div>
              </div>
            </nav>

            {/* ===== LANDING CONTENT ===== */}
            <div className="max-w-6xl mx-auto px-4 py-16 text-center">
              <h1 className="text-5xl font-bold mb-6">
                Master Vocabulary with AI
              </h1>
              <p className="text-xl text-gray-600 mb-8">
                Learn smarter with spaced repetition + AI.
              </p>

              <div className="flex justify-center gap-4">
                <button
                  onClick={() => setShowAuth(true)}
                  className="px-8 py-4 bg-blue-600 text-white rounded-lg font-bold"
                >
                  Start Free
                </button>

                <button
                  onClick={() => setCurrentView('pricing')}
                  className="px-8 py-4 bg-yellow-500 text-white rounded-lg font-bold"
                >
                  View Pricing
                </button>
              </div>
            </div>

            {/* ===== FOOTER ===== */}
            <footer className="bg-white border-t py-8">
              <div className="flex justify-center gap-8 text-sm text-gray-600 mb-4">
                <button onClick={() => setCurrentView('pricing')}>Pricing</button>
                <button onClick={() => setCurrentView('terms')}>Terms</button>
                <button onClick={() => setCurrentView('privacy')}>Privacy</button>
                <button onClick={() => setCurrentView('contact')}>Contact</button>
              </div>
              <div className="flex flex-col items-center gap-2 mt-4">
                <span className="text-xs text-gray-400">Developed by</span>
                <img src="/dexdev-logo.png" alt="DexDev Solutions" className="w-full max-w-[260px] h-auto" />
              </div>
            </footer>

            {showAuth && <AuthModal />}
            {showNewPassword && <NewPasswordModal />}
          </>
        );
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {renderGuestView()}
    </div>
  );
}

  // Main app for authenticated users
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
<div className="flex flex-wrap justify-between items-center mb-6 gap-3">
  {/* Brand */}
  <div className="shrink-0">
    <h1
      className="text-2xl sm:text-3xl font-bold text-gray-800 cursor-pointer leading-tight"
      onClick={() => setCurrentView('dashboard')}
    >
      📚 VocabVoyager
    </h1>
    <p className="text-gray-500 text-xs sm:text-sm">Smart vocabulary learning</p>
  </div>

  {/* Actions — wraps gracefully on narrow screens */}
  <div className="flex items-center gap-2 flex-wrap justify-end">
    <button
      onClick={() => setCurrentView('ihni')}
      className="flex items-center gap-1.5 px-3 py-2 bg-orange-100 text-orange-600 rounded-lg hover:bg-orange-200 transition-colors font-medium text-sm"
      title="I Had No Idea!"
    >
      🔥 IHNI!
    </button>
    <button
      onClick={() => setCurrentView('leaderboard')}
      className="flex items-center gap-1.5 px-3 py-2 bg-yellow-100 text-yellow-700 rounded-lg hover:bg-yellow-200 transition-colors font-medium text-sm"
    >
      <Trophy className="w-4 h-4" />
      <span className="hidden sm:inline">Board</span>
    </button>
    <button
      onClick={() => setCurrentView('friends')}
      className="flex items-center gap-1.5 px-3 py-2 bg-blue-100 text-blue-600 rounded-lg hover:bg-blue-200 transition-colors font-medium text-sm"
    >
      <Users className="w-4 h-4" />
      <span className="hidden sm:inline">Friends</span>
    </button>

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

    {userProgress.is_premium && (
      <button
        onClick={() => setShowAIAssistant(true)}
        className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-500 to-blue-500 text-white rounded-lg hover:from-purple-600 hover:to-blue-600 transition-colors font-medium"
      >
        <Brain className="w-4 h-4" />
        AI Assistant
      </button>
    )}

    <div className="flex items-center gap-2 text-gray-600 min-w-0">
      <User className="w-4 h-4 shrink-0" />
      <span className="text-sm truncate max-w-[140px]">
        {userDisplayName || user.email}
      </span>
    </div>

    <button
      onClick={handleSignOut}
      className="p-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
    >
      <LogOut className="w-4 h-4" />
    </button>
  </div>
</div>

{/* Main */}
<main className="flex-grow container mx-auto px-4 py-8">
  {currentView === 'privacy' && <PrivacyPolicy />}
  {currentView === 'contact' && <ContactUs userId={user?.id} />}
  {currentView === 'terms' && <TermsOfService />}
  {currentView === 'pricing' && <Pricing onUpgrade={handleUpgradeToPremium} isPremium={userProgress.is_premium} />}
  {currentView === 'ihni' && <IHNIList userId={user?.id} />}
  {currentView === 'leaderboard' && <Leaderboard userId={user?.id} userDisplayName={userDisplayName} />}
  {currentView === 'friends' && <Friends userId={user?.id} userEmail={user?.email} userDisplayName={userDisplayName} />}
  {currentView === 'dashboard' && (
  <div onError={() => setCurrentView('contact')}> 
    <ReviewDashboard userId={user?.id} />
  </div>
)}
</main>


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
                <p className="mb-2">• AI Learning Assistant with personalized insights</p>
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
              {userProgress.is_premium ? 'Premium • All Levels + AI' : 'Free • Level 1 Only'}
            </div>
          </div>

          {/* Session Status Message */}
          <SessionStatusMessage />

          {/* Show words if in learning mode */}
          {getSessionState() === 'ready_to_learn' && (
            <div className="space-y-6">
            {currentWords.map((wordData, index) => (
  <div key={wordData.id} className="relative">
    {/* Index badge */}
    <div className="flex items-start gap-4 p-5 bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold text-sm mt-1">
        {index + 1}
      </div>
      <div className="flex-1 min-w-0">
        {/* Word + badges row */}
        <div className="flex flex-wrap items-center gap-2 mb-2">
          <span style={{fontFamily: "'DM Serif Display', serif"}} className="text-3xl sm:text-4xl text-gray-900 leading-tight">
            {wordData.word}
          </span>
          <span className="px-2.5 py-1 bg-indigo-50 text-indigo-700 rounded-full text-xs font-semibold tracking-wide uppercase">
            Lv {wordData.level}
          </span>
        </div>
        {/* Synonym pill */}
        <div className="flex items-center gap-2 mb-3">
          <span className="text-xs text-gray-400 font-medium uppercase tracking-wider">Think:</span>
          <span className="px-3 py-1.5 bg-gradient-to-r from-violet-100 to-purple-100 text-purple-700 rounded-full text-sm font-semibold border border-purple-100">
            {wordData.synonym}
          </span>
        </div>
        <p className="text-gray-400 text-sm italic">
          Can you guess the full meaning before revealing?
        </p>
      </div>
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
          {currentWords.map((wordData, index) => (
  <div key={wordData.id} className="bg-white rounded-2xl border border-emerald-100 shadow-sm overflow-hidden">
    {/* Header strip */}
    <div className="px-5 pt-5 pb-3 flex flex-wrap items-center gap-2 border-b border-gray-50">
      <span style={{fontFamily: "'DM Serif Display', serif"}} className="text-3xl text-gray-900">
        {wordData.word}
      </span>
      <span className="px-2.5 py-1 bg-emerald-100 text-emerald-700 rounded-full text-xs font-semibold">
        {wordData.synonym}
      </span>
      <span className="ml-auto px-2 py-1 bg-gray-100 text-gray-500 rounded-full text-xs">
        Lv {wordData.level}
      </span>
    </div>
    {/* Definition + example */}
    <div className="p-5 space-y-3">
      <div>
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Definition</p>
        <p className="text-gray-800 text-sm leading-relaxed">{wordData.definition}</p>
      </div>
      <div className="bg-gray-50 rounded-xl p-4">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Example</p>
        <p className="text-gray-700 text-sm italic leading-relaxed">"{wordData.example}"</p>
      </div>
      {wordData.context && (
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Context</p>
          <p className="text-gray-600 text-sm leading-relaxed">{wordData.context}</p>
        </div>
      )}
    </div>
  </div>
))}
        </div>

        {/* App Info — styled card */}
        <div className="relative overflow-hidden rounded-2xl border border-indigo-100 bg-gradient-to-br from-indigo-50 via-white to-purple-50 p-5">
          {/* decorative blobs */}
          <div className="pointer-events-none absolute -top-6 -right-6 w-24 h-24 bg-indigo-200/30 rounded-full blur-2xl" />
          <div className="pointer-events-none absolute -bottom-4 -left-4 w-20 h-20 bg-purple-200/30 rounded-full blur-2xl" />

          <div className="relative flex flex-col sm:flex-row sm:items-center gap-4">
            {/* Stat pills */}
            <div className="flex flex-wrap gap-2 flex-1">
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-indigo-100 rounded-full text-xs font-semibold text-indigo-700 shadow-sm">
                🧠 Lvl {userProgress.current_level}
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-green-100 rounded-full text-xs font-semibold text-green-700 shadow-sm">
                📚 {userProgress.words_learned} words
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-orange-100 rounded-full text-xs font-semibold text-orange-600 shadow-sm">
                🔥 {userProgress.streak}-day streak
              </span>
            </div>

            {/* Account badge */}
            <div className={`shrink-0 inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold shadow-sm border ${
              userProgress.is_premium
                ? 'bg-yellow-400/20 border-yellow-300 text-yellow-800'
                : 'bg-white border-gray-200 text-gray-600'
            }`}>
              {userProgress.is_premium
                ? <><span>💎</span> Premium — all 450+ words</>
                : <><span>🆓</span> Free <span className="font-normal text-gray-400">· upgrade to unlock more</span></>
              }
            </div>
          </div>

          <p className="relative mt-3 text-sm text-indigo-500 font-semibold tracking-wide">
            ✦ Spaced repetition · AI-powered insights · Level up every day ✦
          </p>
        </div>
      </div> 
      
      {/* Footer - Includes the Terms link */} 
<footer className="mt-auto py-8 border-t border-gray-200 text-center bg-white/50">
  <div className="flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm text-gray-500">
    {[
      ['dashboard', 'Dashboard'],
      ['ihni', 'IHNI! 🔥'],
      ['leaderboard', 'Leaderboard'],
      ['friends', 'Friends'],
      ['pricing', 'Pricing'],
      ['terms', 'Terms'],
      ['privacy', 'Privacy'],
      ['contact', 'Contact'],
    ].map(([view, label]) => (
      <button
        key={view}
        onClick={() => { setCurrentView(view); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
        className="hover:text-blue-600 hover:underline cursor-pointer transition-all font-medium"
      >
        {label}
      </button>
    ))}
  </div>
  <div className="mt-4 flex flex-col items-center gap-2">
    <span className="text-xs text-gray-400">© 2026 VocabVoyager · Developed by</span>
    <img src="/dexdev-logo.png" alt="DexDev Solutions" className="w-full max-w-[260px] h-auto" />
  </div>
</footer>
      
{/* AI Assistant Modal */}
      {showAIAssistant && (
        <AILearningAssistant
          userId={user?.id}
          userProgress={userProgress}
          isVisible={showAIAssistant}
          onClose={() => setShowAIAssistant(false)}
        />
      )}

      {/* Daily Word Fact popup */}
      <DailyWordFact userId={user?.id} />

      {/* Password reset modal — shown when user returns via reset email link */}
      {showNewPassword && <NewPasswordModal />}
    </div>
  );
};

export default VocabImprover;