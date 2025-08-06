// src/lib/supabase.js - FIXED VERSION
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

  // Get random words for daily session
  async getDailyWords(level = 1, count = 3, isPremium = false) {
    console.log('📚 Fetching daily words:', { level, count, isPremium })
    
    try {
      // First check if words exist at all
      const { data: allWords, error: countError } = await supabase
        .from('words')
        .select('id, level')
      
      if (countError) {
        console.error('❌ Error checking words:', countError)
        return []
      }
      
      console.log('📊 Total words in database:', allWords?.length || 0)
      console.log('📊 Words by level:', allWords?.reduce((acc, word) => {
        acc[`level_${word.level}`] = (acc[`level_${word.level}`] || 0) + 1
        return acc
      }, {}))

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
      
      console.log('✅ Available words for selection:', data?.length || 0)
      
      if (!data || data.length === 0) {
        console.warn('⚠️ No words found matching criteria')
        return []
      }
      
      // Shuffle and return requested count
      const shuffled = [...data].sort(() => 0.5 - Math.random())
      const selectedWords = shuffled.slice(0, Math.min(count, data.length))
      
      console.log('🎲 Selected words:', selectedWords.map(w => w.word))
      return selectedWords
      
    } catch (err) {
      console.error('❌ Exception in getDailyWords:', err)
      return []
    }
  },

  // Save daily session
  async saveDailySession(userId, wordIds, completed = false) {
    console.log('💾 Saving daily session:', { userId, wordIds, completed })
    
    try {
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
        console.error('❌ Error saving daily session:', error)
        return null
      }
      
      console.log('✅ Saved daily session:', data)
      return data
      
    } catch (err) {
      console.error('❌ Exception in saveDailySession:', err)
      return null
    }
  },

  // Get today's session
  async getTodaySession(userId) {
    console.log('🔍 Fetching today\'s session for:', userId)
    
    try {
      const today = new Date().toISOString().split('T')[0]
      
      const { data, error } = await supabase
        .from('daily_sessions')
        .select('*')
        .eq('user_id', userId)
        .eq('session_date', today)
        .single()
      
      if (error && error.code !== 'PGRST116') {
        console.error('❌ Error fetching today session:', error)
        return null
      }
      
      console.log('✅ Today\'s session:', data)
      return data
      
    } catch (err) {
      console.error('❌ Exception in getTodaySession:', err)
      return null
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

  // Listen to auth changes
  onAuthStateChange(callback) {
    return supabase.auth.onAuthStateChange((event, session) => {
      console.log('🔄 Auth state change:', event, session?.user?.email || 'None')
      callback(event, session)
    })
  }
}