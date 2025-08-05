// src/App.js
import React, { useState, useEffect } from 'react';
import { ChevronRight, RotateCcw, Target, Calendar, Trophy, BookOpen, User, LogOut, Crown, Star, Loader } from 'lucide-react';
import { supabase, dbHelpers, authHelpers } from './lib/supabase';

const VocabImprover = () => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [currentWords, setCurrentWords] = useState([]);
  const [showDefinitions, setShowDefinitions] = useState(false);
  const [userProgress, setUserProgress] = useState({
    streak: 0,
    words_learned: 0,
    current_level: 1,
    total_days: 0,
    last_visit: null,
    is_premium: false
  });
  const [showAuth, setShowAuth] = useState(false);
  const [todaySession, setTodaySession] = useState(null);

  // Initialize auth state
  useEffect(() => {
    // Get initial session
    authHelpers.getCurrentUser().then(user => {
      setUser(user);
      setLoading(false);
    });

    // Listen for auth changes
    const { data: { subscription } } = authHelpers.onAuthStateChange(
      async (event, session) => {
        setUser(session?.user ?? null);
        setLoading(false);
        
        if (session?.user) {
          await loadUserData(session.user.id);
        } else {
          // Reset state when user logs out
          setUserProgress({
            streak: 0,
            words_learned: 0,
            current_level: 1,
            total_days: 0,
            last_visit: null,
            is_premium: false
          });
          setCurrentWords([]);
          setTodaySession(null);
        }
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  // Load user data when authenticated
  const loadUserData = async (userId) => {
    try {
      // Load user progress
      let progress = await dbHelpers.getUserProgress(userId);
      
      if (!progress) {
        // New user - create initial progress
        progress = {
          streak: 0,
          words_learned: 0,
          current_level: 1,
          total_days: 0,
          last_visit: null,
          is_premium: false
        };
        await dbHelpers.upsertUserProgress(userId, progress);
      }

      // Calculate and update streak
      const today = new Date().toISOString().split('T')[0];
      const streakInfo = dbHelpers.calculateStreak(progress.last_visit);
      
      if (progress.last_visit !== today) {
        // New day visit
        const updatedProgress = {
          ...progress,
          streak: streakInfo.shouldIncrement ? progress.streak + 1 : 
                 streakInfo.isConsecutive ? progress.streak : 0,
          total_days: progress.total_days + 1,
          last_visit: today
        };
        
        progress = await dbHelpers.upsertUserProgress(userId, updatedProgress);
      }

      setUserProgress(progress);

      // Load today's session
      await loadTodaySession(userId, progress.current_level, progress.is_premium);

    } catch (error) {
      console.error('Error loading user data:', error);
    }
  };

  // Load or create today's word session
  const loadTodaySession = async (userId, level, isPremium) => {
    try {
      let session = await dbHelpers.getTodaySession(userId);
      
      if (!session) {
        // Create new daily session
        const dailyWords = await dbHelpers.getDailyWords(level, 3, isPremium);
        const wordIds = dailyWords.map(w => w.id);
        
        session = await dbHelpers.saveDailySession(userId, wordIds, false);
        setCurrentWords(dailyWords);
        setShowDefinitions(false);
      } else {
        // Load existing session words
        const { data: words, error } = await supabase
          .from('words')
          .select('*')
          .in('id', session.words_shown);
        
        if (!error) {
          setCurrentWords(words);
          setShowDefinitions(session.completed);
        }
      }
      
      setTodaySession(session);
    } catch (error) {
      console.error('Error loading today session:', error);
    }
  };

  // Authentication functions
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
    await authHelpers.signOut();
  };

  // Complete today's session
  const handleRevealDefinitions = async () => {
    if (!user || !todaySession) return;
    
    setShowDefinitions(true);
    
    try {
      // Mark session as completed
      await dbHelpers.saveDailySession(user.id, todaySession.words_shown, true);
      
      // Update user progress
      const updatedProgress = {
        ...userProgress,
        words_learned: userProgress.words_learned + currentWords.length
      };
      
      await dbHelpers.upsertUserProgress(user.id, updatedProgress);
      setUserProgress(updatedProgress);
      
    } catch (error) {
      console.error('Error completing session:', error);
    }
  };

  // Upgrade to premium (mock for now)
  const upgradeToPremium = async () => {
    if (!user) return;
    
    try {
      const updatedProgress = { 
        ...userProgress, 
        is_premium: true 
      };
      
      await dbHelpers.upsertUserProgress(user.id, updatedProgress);
      setUserProgress(updatedProgress);
      
      // Reload today's session with premium access
      await loadTodaySession(user.id, userProgress.current_level, true);
      
      alert('🎉 Upgraded to Premium! You now have access to all 5 levels.');
    } catch (error) {
      console.error('Error upgrading to premium:', error);
    }
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
        <div className="bg-white rounded-lg p-6 w-full max-w-md">
          <h2 className="text-2xl font-bold mb-4">
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
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
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
        <div className="max-w-4xl mx-auto text-center">
          <div className="py-20">
            <h1 className="text-6xl font-bold text-gray-800 mb-6">
              📚 Daily Vocab Booster
            </h1>
            <p className="text-xl text-gray-600 mb-8">
              Master 3 powerful words every day with our science-backed learning method
            </p>
            
            <div className="grid md:grid-cols-2 gap-8 mb-12">
              <div className="bg-white p-6 rounded-lg shadow-lg">
                <h3 className="text-2xl font-bold mb-4">🎯 Simple Synonyms First</h3>
                <p className="text-gray-600">
                  Learn with easy-to-remember synonyms before diving into full definitions
                </p>
              </div>
              <div className="bg-white p-6 rounded-lg shadow-lg">
                <h3 className="text-2xl font-bold mb-4">🧠 Spaced Repetition</h3>
                <p className="text-gray-600">
                  Scientific learning method that optimizes retention over time
                </p>
              </div>
            </div>

            <div className="bg-white rounded-lg p-8 mb-8">
              <h2 className="text-3xl font-bold mb-6">Choose Your Plan</h2>
              <div className="grid md:grid-cols-2 gap-6">
                <div className="border rounded-lg p-6">
                  <h3 className="text-xl font-bold mb-2">Free Trial</h3>
                  <p className="text-3xl font-bold text-blue-600 mb-4">$0</p>
                  <ul className="text-left space-y-2 mb-6">
                    <li>✅ Level 1 (30 words)</li>
                    <li>✅ Daily 3-word sessions</li>
                    <li>✅ Basic progress tracking</li>
                    <li>❌ Advanced levels</li>
                  </ul>
                </div>
                <div className="border-2 border-blue-500 rounded-lg p-6 relative">
                  <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                    <span className="bg-blue-500 text-white px-4 py-1 rounded-full text-sm font-bold">
                      POPULAR
                    </span>
                  </div>
                  <h3 className="text-xl font-bold mb-2">Premium</h3>
                  <p className="text-3xl font-bold text-blue-600 mb-4">$4.99/mo</p>
                  <ul className="text-left space-y-2 mb-6">
                    <li>✅ All 5 levels (450 words)</li>
                    <li>✅ Advanced spaced repetition</li>
                    <li>✅ Detailed progress analytics</li>
                    <li>✅ Personalized contexts</li>
                  </ul>
                </div>
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
        </div>
        
        {showAuth && <AuthModal />}
      </div>
    );
  }

  // Main app for authenticated users
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-4xl mx-auto">
        {/* Header with user info */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-4xl font-bold text-gray-800">📚 Daily Vocab Booster</h1>
            <p className="text-gray-600">Welcome back! Ready for today's words?</p>
          </div>
          <div className="flex items-center gap-4">
            {!userProgress.is_premium && (
              <button
                onClick={upgradeToPremium}
                className="flex items-center gap-2 px-4 py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 transition-colors"
              >
                <Crown className="w-4 h-4" />
                Upgrade
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
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-200">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-orange-100 rounded-lg">
                <Target className="w-5 h-5 text-orange-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Current Streak</p>
                <p className="text-2xl font-bold text-gray-800">{userProgress.streak} days</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-200">
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
          
          <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-200">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 rounded-lg">
                <Trophy className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Level</p>
                <p className="text-2xl font-bold text-gray-800">{userProgress.current_level}/5</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-200">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Calendar className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Total Days</p>
                <p className="text-2xl font-bold text-gray-800">{userProgress.total_days}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Premium upgrade banner for free users */}
        {!userProgress.is_premium && (
          <div className="bg-gradient-to-r from-yellow-400 to-orange-500 rounded-lg p-6 mb-8 text-white">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xl font-bold mb-2">🔒 Unlock All 5 Levels</h3>
                <p>Get access to 450+ advanced vocabulary words with personalized learning</p>
              </div>
              <button
                onClick={upgradeToPremium}
                className="bg-white text-orange-600 px-6 py-3 rounded-lg font-bold hover:bg-gray-100 transition-colors"
              >
                Upgrade Now
              </button>
            </div>
          </div>
        )}

        {/* Daily Words */}
        <div className="bg-white rounded-xl shadow-lg p-8 mb-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
              <Calendar className="w-6 h-6 text-blue-600" />
              Today's Words
              {userProgress.is_premium && <Star className="w-5 h-5 text-yellow-500" />}
            </h2>
            <div className="text-sm text-gray-500">
              {userProgress.is_premium ? 'Premium • All Levels' : 'Free • Level 1 Only'}
            </div>
          </div>

          {currentWords.length === 0 ? (
            <div className="text-center py-8">
              <Loader className="w-8 h-8 animate-spin mx-auto mb-4 text-blue-600" />
              <p className="text-gray-600">Loading today's words...</p>
            </div>
          ) : (
            <div className="space-y-6">
              {currentWords.map((wordData, index) => (
                <div key={wordData.id} className="border-l-4 border-blue-500 pl-6 py-4">
                  <div className="mb-4">
                    <div className="flex items-center gap-4 mb-2">
                      <span className="text-3xl font-bold text-gray-800">
                        {wordData.word}
                      </span>
                      <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-medium">
                        ≈ {wordData.synonym}
                      </span>
                      <span className="px-2 py-1 bg-gray-100 text-gray-600 rounded text-xs">
                        Level {wordData.level}
                      </span>
                    </div>
                    <p className="text-gray-600 italic">
                      Think of it as: "{wordData.synonym}" but with more depth...
                    </p>
                  </div>

                  {showDefinitions && (
                    <div className="mt-4 space-y-3 animate-in slide-in-from-top duration-500">
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
              <h3 className="font-semibold text-green-800 mb-2">🎉 Great job!</h3>
              <p className="text-green-700">
                You've completed today's vocabulary session. These words will appear in your 
                spaced repetition reviews. Come back tomorrow for 3 new words!
              </p>
            </div>
          )}
        </div>

        {/* App Info */}
        <div className="bg-white rounded-lg p-6 text-center text-sm text-gray-600">
          <p className="mb-2">
            <strong>📈 Learning Method:</strong> Simple synonyms → Full context → Spaced repetition
          </p>
          <p className="mb-2">
            <strong>🎯 Progress:</strong> Level {userProgress.current_level} • {userProgress.words_learned} words learned • {userProgress.streak} day streak
          </p>
          <p className="text-xs text-gray-500">
            {userProgress.is_premium ? 'Premium Account - Full Access to All Levels' : 'Free Account - Upgrade for advanced levels'}
          </p>
        </div>
      </div>
    </div>
  );
};

export default VocabImprover;