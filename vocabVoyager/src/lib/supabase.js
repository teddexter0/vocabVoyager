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

export const dbHelpers = {
  async getRandomWords(limit = 3, level = 1) {
    try {
      console.log(`🎲 Fetching ${limit} random words for level ${level}`);

      const { data, error } = await supabase
        .from('words')
        .select('*')
        .eq('level', level)
        .limit(limit * 5);

      if (error) {
        console.error('❌ Error fetching random words:', error);
        return [];
      }

      if (!data || data.length === 0) {
        console.warn('⚠️ No words found for level', level);
        return [];
      }

      const shuffled = [...data].sort(() => Math.random() - 0.5);
      const selected = shuffled.slice(0, limit);

      console.log(`✅ Selected ${selected.length} random words:`, selected.map(w => w.word));
      return selected;

    } catch (error) {
      console.error('❌ Exception in getRandomWords:', error);
      return [];
    }
  },

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

  async getTodaySessionOrCreate(userId, level, isPremium) {
    if (!userId) {
      console.error('❌ No userId provided');
      return { session: null, words: [], error: 'No user ID' };
    }

    try {
      const today = new Date().toISOString().split('T')[0];

      console.log(`📅 Checking for session on ${today}`);

      const { data: existingSessions, error: sessionError } = await supabase
        .from('daily_sessions')
        .select('*')
        .eq('user_id', userId)
        .eq('session_date', today)
        .order('created_at', { ascending: false })
        .limit(1);

      if (sessionError) {
        console.error('❌ Session query error:', sessionError);
        return { session: null, words: [], error: sessionError.message };
      }

      if (existingSessions && existingSessions.length > 0) {
        const existingSession = existingSessions[0];
        console.log('♻️ Found existing session:', existingSession.id);

        const { data: words, error: wordsError } = await supabase
          .from('words')
          .select('*')
          .in('id', existingSession.words_shown);

        if (wordsError) {
          console.error('❌ Error loading words:', wordsError);
          return { session: existingSession, words: [] };
        }

        console.log(`✅ Loaded ${words.length} words:`, words.map(w => w.word));

        return {
          session: existingSession,
          words: words || [],
          isNewSession: false
        };
      }

      console.log('🆕 Creating NEW session for TODAY...');

      const newWords = await this.getRandomWords(3, level);

      if (newWords.length === 0) {
        console.error('❌ No words available');
        return { session: null, words: [], noWords: true };
      }

      const wordIds = newWords.map(w => w.id);

      console.log(`🎲 New words for today:`, newWords.map(w => w.word));

      const { data: newSession, error: createError } = await supabase
        .from('daily_sessions')
        .insert({
          user_id: userId,
          session_date: today,
          words_shown: wordIds,
          completed: false,
          created_at: new Date().toISOString()
        })
        .select()
        .single();

      if (createError) {
        console.error('❌ Create session error:', createError);
        return { session: null, words: newWords, error: createError.message };
      }

      console.log('✅ NEW session created:', newSession.id);

      return {
        session: newSession,
        words: newWords,
        isNewSession: true
      };

    } catch (err) {
      console.error('❌ Exception:', err);
      return { session: null, words: [], error: err.message };
    }
  },

  async completeSession(sessionId, userId, wordsCount) {
    if (!sessionId || !userId) {
      console.error('❌ Missing parameters');
      return false;
    }

    try {
      const { error: sessionError } = await supabase
        .from('daily_sessions')
        .update({
          completed: true,
          completed_at: new Date().toISOString()
        })
        .eq('id', sessionId)
        .eq('user_id', userId);

      if (sessionError) {
        console.error('❌ Session update error:', sessionError);
        return false;
      }

      const { data: currentProgress, error: progressError } = await supabase
        .from('user_progress')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (progressError || !currentProgress) {
        console.error('❌ Progress fetch error:', progressError);
        return false;
      }

      const today = new Date().toISOString().split('T')[0];
      const lastVisit = currentProgress.last_visit;
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];

      let newStreak = currentProgress.streak;
      if (lastVisit === yesterday) {
        newStreak += 1;
      } else if (lastVisit !== today) {
        newStreak = 1;
      }

      let newWordsLearned = currentProgress.words_learned;

      if (lastVisit !== today) {
        newWordsLearned += wordsCount;
        console.log(`✅ First session today - adding ${wordsCount} words (${currentProgress.words_learned} → ${newWordsLearned})`);
      } else {
        console.log(`⚠️ Already completed today - keeping words_learned at ${newWordsLearned}`);
      }

      const { data: result, error: updateError } = await supabase
        .from('user_progress')
        .update({
          streak: newStreak,
          words_learned: newWordsLearned,
          total_days: Math.max(currentProgress.total_days, newStreak),
          last_visit: today,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', userId)
        .select()
        .single();

      if (updateError) {
        console.error('❌ Progress update error:', updateError);
        return false;
      }

      console.log('✅ Session completed:', {
        wordsLearned: result.words_learned,
        streak: result.streak,
        added: lastVisit !== today ? wordsCount : 0
      });

      return true;
    } catch (err) {
      console.error('❌ Exception:', err);
      return false;
    }
  }
};

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
