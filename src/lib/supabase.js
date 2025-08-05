// src/lib/supabase.js
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Helper functions for database operations
export const dbHelpers = {
  // Get user progress
  async getUserProgress(userId) {
    const { data, error } = await supabase
      .from('user_progress')
      .select('*')
      .eq('user_id', userId)
      .single()
    
    if (error && error.code !== 'PGRST116') {
      console.error('Error fetching user progress:', error)
      return null
    }
    
    return data
  },

  // Create or update user progress
  async upsertUserProgress(userId, progressData) {
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
      console.error('Error updating user progress:', error)
      return null
    }
    
    return data
  },

  // Get random words for daily session
  async getDailyWords(level = 1, count = 3, isPremium = false) {
    let query = supabase
      .from('words')
      .select('*')
    
    if (!isPremium) {
      query = query.eq('level', 1) // Free users only get level 1
    } else {
      query = query.lte('level', level) // Premium users get up to their level
    }
    
    const { data, error } = await query
    
    if (error) {
      console.error('Error fetching words:', error)
      return []
    }
    
    // Shuffle and return requested count
    const shuffled = data.sort(() => 0.5 - Math.random())
    return shuffled.slice(0, count)
  },

  // Save daily session
  async saveDailySession(userId, wordIds, completed = false) {
    const today = new Date().toISOString().split('T')[0]
    
    const { data, error } = await supabase
      .from('daily_sessions')
      .upsert({
        user_id: userId,
        session_date: today,
        words_shown: wordIds,
        completed
      })
      .select()
      .single()
    
    if (error) {
      console.error('Error saving daily session:', error)
      return null
    }
    
    return data
  },

  // Get today's session
  async getTodaySession(userId) {
    const today = new Date().toISOString().split('T')[0]
    
    const { data, error } = await supabase
      .from('daily_sessions')
      .select('*')
      .eq('user_id', userId)
      .eq('session_date', today)
      .single()
    
    if (error && error.code !== 'PGRST116') {
      console.error('Error fetching today session:', error)
      return null
    }
    
    return data
  },

  // Calculate streak
  calculateStreak(lastVisit) {
    if (!lastVisit) return 0
    
    const today = new Date()
    const last = new Date(lastVisit)
    const diffTime = today - last
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24))
    
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
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    })
    return { data, error }
  },

  async signIn(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })
    return { data, error }
  },

  async signOut() {
    const { error } = await supabase.auth.signOut()
    return { error }
  },

  async getCurrentUser() {
    const { data: { user } } = await supabase.auth.getUser()
    return user
  },

  // Listen to auth changes
  onAuthStateChange(callback) {
    return supabase.auth.onAuthStateChange(callback)
  }
}