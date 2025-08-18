// src/lib/supabase.js - PRODUCTION READY VERSION
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
    // ✅ Better error handling
    onError: (error) => {
      console.error('🔐 Supabase auth error:', error);
    }
  },
  // ✅ Production optimizations
  db: {
    schema: 'public'
  },
  global: {
    headers: {
      'X-Client-Info': 'vocabvoyager-web@1.0.0'
    }
  }
})

// Enhanced database helpers with better error handling
export const dbHelpers = {
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
          // Wait before retrying
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
    if (!userId) {
      console.error('❌ upsertUserProgress: No userId provided');
      return null;
    }

    if (!progressData || typeof progressData !== 'object') {
      console.error('❌ upsertUserProgress: Invalid progressData');
      return null;
    }

    try {
      // Validate required fields
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
        .upsert(validatedData)
        .select()
        .single()
      
      if (error) {
        console.error('❌ Error updating user progress:', error);
        return null;
      }
      
      console.log('✅ User progress updated successfully');
      return data
    } catch (err) {
      console.error('❌ Exception in upsertUserProgress:', err);
      return null;
    }
  },

  // Enhanced session management
  async getTodaySessionOrCreate(userId, level, isPremium) {
    if (!userId) {
      console.error('❌ getTodaySessionOrCreate: No userId provided');
      return { session: null, words: [] };
    }

    try {
      const today = new Date().toISOString().split('T')[0]
      
      // First, try to get existing session
      const { data: existingSession, error: sessionError } = await supabase
        .from('daily_sessions')
        .select('*')
        .eq('user_id', userId)
        .eq('session_date', today)
        .single()
      
      if (existingSession) {
        // Load the words for this session
        const { data: words, error: wordsError } = await supabase
          .from('words')
          .select('*')
          .in('id', existingSession.words_shown)
        
        if (wordsError) {
          console.error('❌ Error loading session words:', wordsError)
          return { session: null, words: [] }
        }
        
        return { 
          session: existingSession, 
          words: words || [],
          isNewSession: false
        }
      }
      
      // If no session exists, create new one
      if (sessionError && sessionError.code === 'PGRST116') {
        // Get words for new session
        const newWords = await this.getDailyWordsForNewSession(level, 3, isPremium)
        
        if (newWords.length === 0) {
          console.warn('⚠️ No words available for session');
          return { session: null, words: [], isNewSession: false, noWords: true }
        }
        
        const wordIds = newWords.map(w => w.id)
        
        // Create the session with retry logic
        let sessionData = null;
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
              .single()
            
            if (createError) {
              if (attempt === 3) {
                console.error('❌ Error creating session:', createError);
                return { session: null, words: [], isNewSession: false };
              }
              await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
              continue;
            }
            
            sessionData = newSession;
            break;
          } catch (err) {
            if (attempt === 3) {
              console.error('❌ Exception creating session:', err);
              return { session: null, words: [], isNewSession: false };
            }
            await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
          }
        }
        
        return { 
          session: sessionData, 
          words: newWords,
          isNewSession: true
        }
      }
      
      console.error('❌ Unexpected error getting session:', sessionError)
      return { session: null, words: [], isNewSession: false }
      
    } catch (err) {
      console.error('❌ Exception in getTodaySessionOrCreate:', err)
      return { session: null, words: [], isNewSession: false }
    }
  },

  // Enhanced word fetching with better filtering
  async getDailyWordsForNewSession(level = 1, count = 3, isPremium = false) {
    try {
      let query = supabase.from('words').select('*')
      
      // Apply level filtering based on premium status
      if (!isPremium) {
        query = query.eq('level', 1)
      } else {
        query = query.lte('level', Math.min(level, 5)) // Cap at level 5
      }
      
      // Add ordering for consistency
      query = query.order('difficulty', { ascending: true })
      
      const { data, error } = await query
      
      if (error) {
        console.error('❌ Error fetching words:', error)
        return []
      }
      
      if (!data || data.length === 0) {
        console.warn('⚠️ No words found matching criteria')
        return []
      }
      
      // Shuffle and return requested count
      const shuffled = [...data].sort(() => 0.5 - Math.random())
      const selectedWords = shuffled.slice(0, Math.min(count, data.length))
      
      console.log(`✅ Selected ${selectedWords.length} words for session`)
      return selectedWords
      
    } catch (err) {
      console.error('❌ Exception in getDailyWordsForNewSession:', err)
      return []
    }
  },

  // Enhanced session completion with better error handling
  async completeSession(sessionId, userId, wordsCount) {
    if (!sessionId || !userId) {
      console.error('❌ completeSession: Missing required parameters');
      return false;
    }

    try {
      // Mark session as completed
      const { error: sessionError } = await supabase
        .from('daily_sessions')
        .update({ 
          completed: true,
          completed_at: new Date().toISOString()
        })
        .eq('id', sessionId)
      
      if (sessionError) {
        console.error('❌ Error completing session:', sessionError)
        return false
      }
      
      // Update user progress
      const currentProgress = await this.getUserProgress(userId)
      if (currentProgress) {
        const today = new Date().toISOString().split('T')[0];
        const lastVisit = currentProgress.last_visit;
        const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        
        // Calculate new streak
        let newStreak = currentProgress.streak;
        if (lastVisit === yesterday) {
          newStreak += 1; // Continue streak
        } else if (lastVisit !== today) {
          newStreak = 1; // Start new streak
        }
        
        const updatedProgress = {
          ...currentProgress,
          words_learned: currentProgress.words_learned + wordsCount,
          streak: newStreak,
          last_visit: today,
          total_days: Math.max(currentProgress.total_days, newStreak)
        }
        
        await this.upsertUserProgress(userId, updatedProgress)
      }
      
      console.log('✅ Session completed successfully');
      return true
    } catch (err) {
      console.error('❌ Exception in completeSession:', err)
      return false
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