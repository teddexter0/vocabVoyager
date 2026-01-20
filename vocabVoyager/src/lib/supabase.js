// src/lib/supabase.js - PRODUCTION READY VERSION WITH ALL MISSING METHODS
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables. Please check your .env file.')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    onError: (error) => {
      console.error('🔐 Supabase auth error:', error);
    }
  },
  db: {
    schema: 'public'
  },
  global: {
    headers: {
      'X-Client-Info': 'vocabvoyager-web@1.0.0'
    }
  }
})

// Enhanced database helpers with ALL required methods
export const dbHelpers = {
  // ✅ ADDED: This was missing and causing "getRandomWords is not a function"
  async getRandomWords(limit = 3, level = 1) {
    try {
      console.log(`🎲 Fetching ${limit} random words for level ${level}`);
      
      const { data, error } = await supabase
        .from('words')
        .select('*')
        .eq('level', level)
        .limit(limit * 2); // Get extra to shuffle from
      
      if (error) {
        console.error('❌ Error fetching random words:', error);
        return [];
      }
      
      if (!data || data.length === 0) {
        console.warn('⚠️ No words found for level', level);
        return [];
      }
      
      // Shuffle and return requested count
      const shuffled = [...data].sort(() => 0.5 - Math.random());
      const selected = shuffled.slice(0, limit);
      
      console.log(`✅ Selected ${selected.length} random words`);
      return selected;
      
    } catch (error) {
      console.error('❌ Exception in getRandomWords:', error);
      return [];
    }
  },

  // Get user progress with retry logic
  async getUserProgress(userId, retries = 3) {
    if (!userId) {
      console.error('❌ getUserProgress: No userId provided');
      return null;
    }

    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        const { data, error } = await supabase
          .from('user_progress')
          .select('*')
          .eq('user_id', userId)
          .single()
        
        if (error && error.code !== 'PGRST116') {
          if (attempt === retries) {
            console.error('❌ Error fetching user progress:', error);
            return null;
          }
          await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
          continue;
        }
        
        return data
      } catch (err) {
        if (attempt === retries) {
          console.error('❌ Exception in getUserProgress:', err);
          return null;
        }
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
      }
    }
    return null;
  },

  // Enhanced upsert with validation
  async upsertUserProgress(userId, progressData) {
    if (!userId) return null;

    try {
      const validatedData = {
        user_id: userId,
        streak: progressData.streak || 0,
        words_learned: progressData.words_learned || 0,
        current_level: progressData.current_level || 1,
        total_days: progressData.total_days || 1,
        is_premium: Boolean(progressData.is_premium),
        premium_until: progressData.premium_until || null,
        last_visit: progressData.last_visit || new Date().toISOString().split('T')[0],
        updated_at: new Date().toISOString()
      };

      const { data, error } = await supabase
        .from('user_progress')
        .upsert(validatedData, { onConflict: 'user_id' })
        .select()
        .single();
      
      if (error) {
        console.error('❌ Error updating user progress:', error);
        return null;
      }
      
      return data;
    } catch (err) {
      console.error('❌ Exception in upsertUserProgress:', err);
      return null;
    }
  },

  // Enhanced session management
  // Enhanced session management
async getTodaySessionOrCreate(userId, level, isPremium) {
  if (!userId) {
    console.error('❌ getTodaySessionOrCreate: No userId provided');
    return { session: null, words: [] };
  }

  try {
    const today = new Date().toISOString().split('T')[0];
    
    console.log(`📅 Checking for session on ${today} for user ${userId}`);

    // Try to get existing session
    const { data: existingSession, error: sessionError } = await supabase
      .from('daily_sessions')
      .select('*')
      .eq('user_id', userId)
      .eq('session_date', today)
      .maybeSingle(); // ✅ Changed from .single() to .maybeSingle()
    
    // ✅ FIX: Check for real errors (not just "no rows found")
    if (sessionError) {
      console.error('❌ Error checking for session:', sessionError);
      return { session: null, words: [] };
    }

    // ✅ If session exists, load its words
    if (existingSession) {
      console.log('✅ Found existing session:', existingSession.id);
      
      const { data: words, error: wordsError } = await supabase
        .from('words')
        .select('*')
        .in('id', existingSession.words_shown);
      
      if (wordsError) {
        console.error('❌ Error loading session words:', wordsError);
        return { session: existingSession, words: [] };
      }
      
      console.log(`📚 Loaded ${words?.length || 0} words from existing session`);
      
      return { 
        session: existingSession, 
        words: words || [],
        isNewSession: false
      };
    }
    
    // ✅ No session exists, create a new one
    console.log('🆕 No session found, creating new session...');
    
    const newWords = await this.getRandomWords(3, level);
    
    if (newWords.length === 0) {
      console.error('❌ No words available for new session');
      return { session: null, words: [], noWords: true };
    }
    
    const wordIds = newWords.map(w => w.id);
    console.log(`📝 Creating session with word IDs:`, wordIds);
    
    // ✅ Create new session with retry logic
    let sessionData = null;
    let lastError = null;
    
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const { data: newSession, error: createError } = await supabase
          .from('daily_sessions')
          .insert({
            user_id: userId,
            session_date: today,
            words_shown: wordIds,
            completed: false
          })
          .select()
          .single();
        
        if (createError) {
          console.warn(`⚠️ Attempt ${attempt}/3 failed:`, createError.message);
          lastError = createError;
          
          if (attempt < 3) {
            await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
            continue;
          }
        } else {
          sessionData = newSession;
          console.log('✅ Session created:', newSession.id);
          break;
        }
      } catch (err) {
        console.error(`❌ Exception on attempt ${attempt}:`, err);
        lastError = err;
        
        if (attempt < 3) {
          await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
        }
      }
    }
    
    // ✅ If all retries failed
    if (!sessionData) {
      console.error('❌ Failed to create session after 3 attempts:', lastError);
      return { session: null, words: newWords, isNewSession: true, error: lastError };
    }
    
    return { 
      session: sessionData, 
      words: newWords,
      isNewSession: true
    };
    
  } catch (err) {
    console.error('❌ Exception in getTodaySessionOrCreate:', err);
    return { session: null, words: [] };
  }
},
  // Enhanced session completion
  async completeSession(sessionId, userId, wordsCount) {
    if (!sessionId || !userId) {
      console.error('❌ completeSession: Missing required parameters');
      return false;
    }

    try {
      // ✅ Mark session as completed
      const { error: sessionError } = await supabase
        .from('daily_sessions')
        .update({ 
          completed: true,
          completed_at: new Date().toISOString()
        })
        .eq('id', sessionId);
      
      if (sessionError) {
        console.error('❌ Error completing session:', sessionError);
        return false;
      }
      
      // ✅ Get current progress
      const currentProgress = await this.getUserProgress(userId);
      if (!currentProgress) {
        console.error('❌ No user progress found');
        return false;
      }
      
      const today = new Date().toISOString().split('T')[0];
      const lastVisit = currentProgress.last_visit;
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      
      // ✅ Calculate new streak
      let newStreak = currentProgress.streak;
      if (lastVisit === yesterday) {
        newStreak += 1; // Continue streak
      } else if (lastVisit !== today) {
        newStreak = 1; // New streak
      }
      // If lastVisit === today, keep streak the same (already visited today)
      
      // ✅ THIS IS THE KEY FIX: Increment words_learned
      const updatedProgress = {
        user_id: userId,
        streak: newStreak,
        words_learned: currentProgress.words_learned + wordsCount, // ✅ ADD the words
        current_level: currentProgress.current_level,
        total_days: Math.max(currentProgress.total_days, newStreak),
        is_premium: currentProgress.is_premium,
        premium_until: currentProgress.premium_until,
        last_visit: today,
        updated_at: new Date().toISOString()
      };
      
      // ✅ Save it
      const result = await this.upsertUserProgress(userId, updatedProgress);
      
      if (!result) {
        console.error('❌ Failed to update progress');
        return false;
      }
      
      console.log('✅ Session completed:', {
        wordsLearned: result.words_learned,
        streak: result.streak
      });
      
      return true;
    } catch (err) {
      console.error('❌ Exception in completeSession:', err);
      return false;
    }
  }
}

// Enhanced auth helpers
export const authHelpers = {
  async signUp(email, password) {
    try {
      if (!email || !password) {
        throw new Error('Email and password are required');
      }

      if (password.length < 6) {
        throw new Error('Password must be at least 6 characters long');
      }

      const { data, error } = await supabase.auth.signUp({
        email: email.trim().toLowerCase(),
        password,
      })
      
      if (error) {
        console.error('❌ Sign up error:', error);
        throw error;
      }
      
      console.log('✅ Sign up successful');
      return { data, error: null }
    } catch (error) {
      console.error('❌ Sign up exception:', error);
      return { data: null, error }
    }
  },

  async signIn(email, password) {
    try {
      if (!email || !password) {
        throw new Error('Email and password are required');
      }

      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      })
      
      if (error) {
        console.error('❌ Sign in error:', error);
        throw error;
      }
      
      console.log('✅ Sign in successful');
      return { data, error: null }
    } catch (error) {
      console.error('❌ Sign in exception:', error);
      return { data: null, error }
    }
  },

  async signOut() {
    try {
      const { error } = await supabase.auth.signOut()
      if (error) {
        console.error('❌ Sign out error:', error);
        throw error;
      }
      console.log('✅ Sign out successful');
      return { error: null }
    } catch (error) {
      console.error('❌ Sign out exception:', error);
      return { error }
    }
  },

  async getCurrentUser() {
    try {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession()
      
      if (sessionError) {
        console.error('❌ Session error:', sessionError)
        return null
      }
      
      return session?.user || null
    } catch (err) {
      console.error('❌ Exception getting current user:', err)
      return null
    }
  },

  onAuthStateChange(callback) {
    return supabase.auth.onAuthStateChange((event, session) => {
      console.log('🔐 Auth state changed:', event);
      callback(event, session)
    })
  }
}