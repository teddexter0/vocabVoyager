// src/lib/supabase.js - FIXED VERSION (No infinite loops)
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
      
      return data
    } catch (err) {
      console.error('❌ Exception in getUserProgress:', err)
      return null
    }
  },

  // Create or update user progress
  async upsertUserProgress(userId, progressData) {
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
      
      return data
    } catch (err) {
      console.error('❌ Exception in upsertUserProgress:', err)
      return null
    }
  },

  // Get today's session or create new one
  async getTodaySessionOrCreate(userId, level, isPremium) {
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

  // Get words for new session only
  async getDailyWordsForNewSession(level = 1, count = 3, isPremium = false) {
    try {
      let query = supabase
        .from('words')
        .select('*')
      
      if (!isPremium) {
        query = query.eq('level', 1)
      } else {
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
      
      return selectedWords
      
    } catch (err) {
      console.error('❌ Exception in getDailyWordsForNewSession:', err)
      return []
    }
  },

  // Mark session as completed
  async completeSession(sessionId, userId, wordsCount) {
    try {
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
  }
}

// Auth helpers - FIXED VERSION
export const authHelpers = {
  async signUp(email, password) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    })
    if (error) console.error('❌ Sign up error:', error)
    return { data, error }
  },

  async signIn(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })
    if (error) console.error('❌ Sign in error:', error)
    return { data, error }
  },

  async signOut() {
    const { error } = await supabase.auth.signOut()
    if (error) console.error('❌ Sign out error:', error)
    return { error }
  },

  // FIXED: Better session handling
  async getCurrentUser() {
    try {
      // First check if we have a session
      const { data: { session }, error: sessionError } = await supabase.auth.getSession()
      
      if (sessionError) {
        console.error('❌ Session error:', sessionError)
        return null
      }
      
      if (!session) {
        // No session = not logged in
        return null
      }
      
      // If we have a session, return the user
      return session.user
      
    } catch (err) {
      console.error('❌ Exception getting current user:', err)
      return null
    }
  },

  onAuthStateChange(callback) {
    return supabase.auth.onAuthStateChange((event, session) => {
      callback(event, session)
    })
  }
}