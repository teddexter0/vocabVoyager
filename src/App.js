// src/App.js - Mobile Optimized Version
import React, { useState, useEffect } from 'react';
import { ChevronRight, Target, Calendar, Trophy, BookOpen, User, LogOut, Crown, Star, Loader } from 'lucide-react';
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
        <div className="bg-white rounded-lg p-6 w-full max-w-sm mx-4">
          <h2 className="text-xl font-bold mb-4 text-center">
            {isSignUp ? 'Create Account' : 'Sign In'}
          </h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              required
            />
            <input
              type="password"
              placeholder="Password (min 6 characters)"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              minLength="6"
              required
            />
            <button
              type="submit"
              disabled={authLoading}
              className="w-full py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2 text-sm font-medium"
            >
              {authLoading && <Loader className="w-4 h-4 animate-spin" />}
              {isSignUp ? 'Sign Up' : 'Sign In'}
            </button>
            <button
              type="button"
              onClick={() => setIsSignUp(!isSignUp)}
              className="w-full py-2 text-blue-600 hover:text-blue-800 text-sm"
            >
              {isSignUp ? 'Already have an account? Sign In' : 'Need an account? Sign Up'}
            </button>
            <button
              type="button"
              onClick={() => setShowAuth(false)}
              className="w-full py-2 text-gray-600 hover:text-gray-800 text-sm"
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
        <div className="max-w-4xl mx-auto">
          {/* Mobile-first header */}
          <div className="text-center py-8 sm:py-16">
            <h1 className="text-3xl sm:text-5xl lg:text-6xl font-bold text-gray-800 mb-4">
              📚 Daily Vocab Booster
            </h1>
            <p className="text-base sm:text-lg lg:text-xl text-gray-600 mb-8 px-4">
              Master 3 powerful words every day with our science-backed learning method
            </p>
            
            {/* Mobile-optimized feature cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 mb-8 px-4">
              <div className="bg-white p-4 sm:p-6 rounded-lg shadow-lg">
                <h3 className="text-lg sm:text-xl font-bold mb-2">🎯 Simple Synonyms First</h3>
                <p className="text-sm sm:text-base text-gray-600">
                  Learn with easy-to-remember synonyms before diving into full definitions
                </p>
              </div>
              <div className="bg-white p-4 sm:p-6 rounded-lg shadow-lg">
                <h3 className="text-lg sm:text-xl font-bold mb-2">🧠 Spaced Repetition</h3>
                <p className="text-sm sm:text-base text-gray-600">
                  Scientific learning method that optimizes retention over time
                </p>
              </div>
            </div>

            {/* Mobile-optimized pricing */}
            <div className="bg-white rounded-lg p-4 sm:p-6 mb-8 mx-4">
              <h2 className="text-xl sm:text-2xl font-bold mb-4">Choose Your Plan</h2>
              <div className="space-y-4 sm:grid sm:grid-cols-2 sm:gap-4 sm:space-y-0">
                <div className="border rounded-lg p-4">
                  <h3 className="text-lg font-bold mb-2">Free Trial</h3>
                  <p className="text-2xl sm:text-3xl font-bold text-blue-600 mb-3">$0</p>
                  <ul className="text-left text-sm space-y-1 mb-4">
                    <li>✅ Level 1 (30 words)</li>
                    <li>✅ Daily 3-word sessions</li>
                    <li>✅ Basic progress tracking</li>
                    <li>❌ Advanced levels</li>
                  </ul>
                </div>
                <div className="border-2 border-blue-500 rounded-lg p-4 relative">
                  <div className="absolute -top-2 left-1/2 transform -translate-x-1/2">
                    <span className="bg-blue-500 text-white px-3 py-1 rounded-full text-xs font-bold">
                      POPULAR
                    </span>
                  </div>
                  <h3 className="text-lg font-bold mb-2 mt-2">Premium</h3>
                  <p className="text-2xl sm:text-3xl font-bold text-blue-600 mb-3">$4.99/mo</p>
                  <ul className="text-left text-sm space-y-1 mb-4">
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
              className="inline-flex items-center gap-2 px-6 sm:px-8 py-3 sm:py-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-bold text-base sm:text-lg mx-4"
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
        {/* Mobile-optimized header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-800">📚 Daily Vocab Booster</h1>
            <p className="text-sm sm:text-base text-gray-600">Welcome back! Ready for today's words?</p>
          </div>
          <div className="flex items-center gap-2 sm:gap-4 w-full sm:w-auto">
            {!userProgress.is_premium && (
              <button
                onClick={upgradeToPremium}
                className="flex items-center gap-1 sm:gap-2 px-3 py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 transition-colors text-sm"
              >
                <Crown className="w-4 h-4" />
                Upgrade
              </button>
            )}
            <div className="flex items-center gap-1 sm:gap-2 text-gray-600 min-w-0">
              <User className="w-4 h-4 flex-shrink-0" />
              <span className="text-xs sm:text-sm truncate">{user.email}</span>
            </div>
            <button
              onClick={handleSignOut}
              className="p-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Mobile-optimized progress stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
          <div className="bg-white rounded-lg p-3 sm:p-4 shadow-sm border border-gray-200">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="p-1.5 sm:p-2 bg-orange-100 rounded-lg">
                <Target className="w-4 h-4 sm:w-5 sm:h-5 text-orange-600" />
              </div>
              <div className="min-w-0">
                <p className="text-xs sm:text-sm text-gray-600">Streak</p>
                <p className="text-lg sm:text-xl lg:text-2xl font-bold text-gray-800">{userProgress.streak}</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-lg p-3 sm:p-4 shadow-sm border border-gray-200">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="p-1.5 sm:p-2 bg-green-100 rounded-lg">
                <BookOpen className="w-4 h-4 sm:w-5 sm:h-5 text-green-600" />
              </div>
              <div className="min-w-0">
                <p className="text-xs sm:text-sm text-gray-600">Words</p>
                <p className="text-lg sm:text-xl lg:text-2xl font-bold text-gray-800">{userProgress.words_learned}</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-lg p-3 sm:p-4 shadow-sm border border-gray-200">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="p-1.5 sm:p-2 bg-purple-100 rounded-lg">
                <Trophy className="w-4 h-4 sm:w-5 sm:h-5 text-purple-600" />
              </div>
              <div className="min-w-0">
                <p className="text-xs sm:text-sm text-gray-600">Level</p>
                <p className="text-lg sm:text-xl lg:text-2xl font-bold text-gray-800">{userProgress.current_level}/5</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg p-3 sm:p-4 shadow-sm border border-gray-200">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="p-1.5 sm:p-2 bg-blue-100 rounded-lg">
                <Calendar className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600" />
              </div>
              <div className="min-w-0">
                <p className="text-xs sm:text-sm text-gray-600">Days</p>
                <p className="text-lg sm:text-xl lg:text-2xl font-bold text-gray-800">{userProgress.total_days}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Mobile-optimized premium banner */}
        {!userProgress.is_premium && (
          <div className="bg-gradient-to-r from-yellow-400 to-orange-500 rounded-lg p-4 sm:p-6 mb-6 text-white">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-lg sm:text-xl font-bold mb-2">🔒 Unlock All 5 Levels</h3>
                <p className="text-sm sm:text-base">Get access to 450+ advanced vocabulary words</p>
              </div>
              <button
                onClick={upgradeToPremium}
                className="bg-white text-orange-600 px-4 sm:px-6 py-2 sm:py-3 rounded-lg font-bold hover:bg-gray-100 transition-colors text-sm sm:text-base w-full sm:w-auto"
              >
                Upgrade Now
              </button>
            </div>
          </div>
        )}

        {/* Mobile-optimized daily words */}
        <div className="bg-white rounded-xl shadow-lg p-4 sm:p-6 lg:p-8 mb-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-4 sm:mb-6 gap-2">
            <h2 className="text-xl sm:text-2xl font-bold text-gray-800 flex items-center gap-2">
              <Calendar className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600" />
              Today's Words
              {userProgress.is_premium && <Star className="w-4 h-4 sm:w-5 sm:h-5 text-yellow-500" />}
            </h2>
            <div className="text-xs sm:text-sm text-gray-500">
              {userProgress.is_premium ? 'Premium • All Levels' : 'Free • Level 1 Only'}
            </div>
          </div>

          {currentWords.length === 0 ? (
            <div className="text-center py-8">
              <Loader className="w-6 h-6 sm:w-8 sm:h-8 animate-spin mx-auto mb-4 text-blue-600" />
              <p className="text-sm sm:text-base text-gray-600">Loading today's words...</p>
            </div>
          ) : (
            <div className="space-y-4 sm:space-y-6">
              {currentWords.map((wordData, index) => (
                <div key={wordData.id} className="border-l-4 border-blue-500 pl-4 sm:pl-6 py-3 sm:py-4">
                  <div className="mb-3 sm:mb-4">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-4 mb-2">
                      <span className="text-2xl sm:text-3xl font-bold text-gray-800">
                        {wordData.word}
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="px-2 sm:px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-xs sm:text-sm font-medium">
                          ≈ {wordData.synonym}
                        </span>
                        <span className="px-2 py-1 bg-gray-100 text-gray-600 rounded text-xs">
                          Level {wordData.level}
                        </span>
                      </div>
                    </div>
                    <p className="text-sm sm:text-base text-gray-600 italic">
                      Think of it as: "{wordData.synonym}" but with more depth...
                    </p>
                  </div>

                  {showDefinitions && (
                    <div className="mt-3 sm:mt-4 space-y-3 animate-in slide-in-from-top duration-500">
                      <div className="bg-gray-50 rounded-lg p-3 sm:p-4">
                        <h4 className="font-semibold text-sm sm:text-base text-gray-800 mb-1">Definition:</h4>
                        <p className="text-sm sm:text-base text-gray-700">{wordData.definition}</p>
                      </div>
                      
                      <div className="bg-green-50 rounded-lg p-3 sm:p-4">
                        <h4 className="font-semibold text-sm sm:text-base text-gray-800 mb-1">Example:</h4>
                        <p className="text-sm sm:text-base text-gray-700 italic">"{wordData.example}"</p>
                      </div>
                      
                      <div className="bg-blue-50 rounded-lg p-3 sm:p-4">
                        <h4 className="font-semibold text-sm sm:text-base text-gray-800 mb-1">Context:</h4>
                        <p className="text-sm sm:text-base text-gray-700">{wordData.context}</p>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {!showDefinitions && currentWords.length > 0 && (
            <div className="mt-6 sm:mt-8 text-center">
              <button
                onClick={handleRevealDefinitions}
                className="inline-flex items-center gap-2 px-4 sm:px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium text-sm sm:text-base"
              >
                Reveal Definitions & Examples
                <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>
              <p className="text-xs sm:text-sm text-gray-500 mt-2 px-4">
                First, try to guess the meanings based on the synonyms above
              </p>
            </div>
          )}

          {showDefinitions && currentWords.length > 0 && (
            <div className="mt-6 sm:mt-8 p-4 bg-green-50 rounded-lg border border-green-200">
              <h3 className="font-semibold text-green-800 mb-2 text-sm sm:text-base">🎉 Great job!</h3>
              <p className="text-sm sm:text-base text-green-700">
                You've completed today's vocabulary session. These words will appear in your 
                spaced repetition reviews. Come back tomorrow for 3 new words!
              </p>
            </div>
          )}
        </div>

        {/* Mobile-optimized app info */}
        <div className="bg-white rounded-lg p-4 sm:p-6 text-center text-xs sm:text-sm text-gray-600">
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