// src/lib/supabase.js - FIXED DAILY SESSION LOGIC
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  }
})

// Helper functions for database operations
export const dbHelpers = {
  // Get user progress
  async getUserProgress(userId) {
    console.log('🔍 Fetching user progress for:', userId)
    try {
      const { data, error } = await supabase
        .from('user_progress')
        .select('*')
        .eq('user_id', userId)
        .single()
      
      if (error && error.code !== 'PGRST116') {
        console.error('❌ Error fetching user progress:', error)
        return null
      }
      
      console.log('✅ User progress:', data)
      return data
    } catch (err) {
      console.error('❌ Exception in getUserProgress:', err)
      return null
    }
  },

  // Create or update user progress
  async upsertUserProgress(userId, progressData) {
    console.log('💾 Upserting user progress:', { userId, progressData })
    try {
      const { data, error } = await supabase
        .from('user_progress')
        .upsert({
          user_id: userId,
          ...progressData,
          updated_at: new Date().toISOString()
        })
        .select()
        .single()
      
      if (error) {
        console.error('❌ Error updating user progress:', error)
        return null
      }
      
      console.log('✅ Updated user progress:', data)
      return data
    } catch (err) {
      console.error('❌ Exception in upsertUserProgress:', err)
      return null
    }
  },

  // 🔥 FIXED: Get today's session FIRST, then create if needed
  async getTodaySessionOrCreate(userId, level, isPremium) {
    console.log('📅 Getting or creating today\'s session for:', userId)
    
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
        console.log('✅ Found existing session:', existingSession)
        
        // Load the words for this session
        const { data: words, error: wordsError } = await supabase
          .from('words')
          .select('*')
          .in('id', existingSession.words_shown)
        
        if (wordsError) {
          console.error('❌ Error loading session words:', wordsError)
          return { session: null, words: [] }
        }
        
        console.log('✅ Loaded existing session words:', words.length)
        return { 
          session: existingSession, 
          words: words || [],
          isNewSession: false
        }
      }
      
      // If no session exists, create new one
      if (sessionError && sessionError.code === 'PGRST116') {
        console.log('📝 Creating new daily session')
        
        // Get words for new session
        const newWords = await this.getDailyWordsForNewSession(level, 3, isPremium)
        
if (newWords.length === 0) {
  return { session: null, words: [], isNewSession: false, noWords: true }
}

        
        const wordIds = newWords.map(w => w.id)
        
        // Create the session
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
          console.error('❌ Error creating session:', createError)
          return { session: null, words: [], isNewSession: false }
        }
        
        console.log('✅ Created new session with words:', newWords.map(w => w.word))
        return { 
          session: newSession, 
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

  // 🔥 FIXED: Separate function for getting words (only called when creating new session)
  async getDailyWordsForNewSession(level = 1, count = 3, isPremium = false) {
    console.log('🆕 Getting words for NEW session:', { level, count, isPremium })
    
    try {
      let query = supabase
        .from('words')
        .select('*')
      
      if (!isPremium) {
        console.log('🆓 Free user - limiting to level 1')
        query = query.eq('level', 1)
      } else {
        console.log('💎 Premium user - up to level', level)
        query = query.lte('level', level)
      }
      
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
      
      console.log('🎲 Selected words for new session:', selectedWords.map(w => w.word))
      return selectedWords
      
    } catch (err) {
      console.error('❌ Exception in getDailyWordsForNewSession:', err)
      return []
    }
  },

  // Mark session as completed
  async completeSession(sessionId, userId, wordsCount) {
    try {
      console.log('✅ Completing session:', sessionId)
      
      // Mark session as completed
      const { error: sessionError } = await supabase
        .from('daily_sessions')
        .update({ completed: true })
        .eq('id', sessionId)
      
      if (sessionError) {
        console.error('❌ Error completing session:', sessionError)
        return false
      }
      
      // Update user progress
      const currentProgress = await this.getUserProgress(userId)
      if (currentProgress) {
        const updatedProgress = {
          ...currentProgress,
          words_learned: currentProgress.words_learned + wordsCount
        }
        
        await this.upsertUserProgress(userId, updatedProgress)
      }
      
      return true
    } catch (err) {
      console.error('❌ Exception in completeSession:', err)
      return false
    }
  },

  // Calculate streak
  calculateStreak(lastVisit) {
    if (!lastVisit) {
      console.log('🔄 No previous visit - starting fresh')
      return { isConsecutive: false, shouldIncrement: false }
    }
    
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    
    const last = new Date(lastVisit)
    last.setHours(0, 0, 0, 0)
    
    const diffTime = today - last
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24))
    
    console.log('🔄 Streak calculation:', { lastVisit, diffDays })
    
    if (diffDays === 1) {
      return { isConsecutive: true, shouldIncrement: true }
    } else if (diffDays === 0) {
      return { isConsecutive: true, shouldIncrement: false } // Same day
    } else {
      return { isConsecutive: false, shouldIncrement: false } // Streak broken
    }
  }
}

// Auth helpers
export const authHelpers = {
  async signUp(email, password) {
    console.log('🔐 Signing up user:', email)
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    })
    if (error) console.error('❌ Sign up error:', error)
    return { data, error }
  },

  async signIn(email, password) {
    console.log('🔐 Signing in user:', email)
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })
    if (error) console.error('❌ Sign in error:', error)
    return { data, error }
  },

  async signOut() {
    console.log('🔐 Signing out user')
    const { error } = await supabase.auth.signOut()
    if (error) console.error('❌ Sign out error:', error)
    return { error }
  },

  async getCurrentUser() {
    try {
      const { data: { user }, error } = await supabase.auth.getUser()
      if (error) {
        console.error('❌ Error getting current user:', error)
        return null
      }
      console.log('👤 Current user:', user?.email || 'None')
      return user
    } catch (err) {
      console.error('❌ Exception getting current user:', err)
      return null
    }
  },

  onAuthStateChange(callback) {
    return supabase.auth.onAuthStateChange((event, session) => {
      console.log('🔄 Auth state change:', event, session?.user?.email || 'None')
      callback(event, session)
    })
  }
}