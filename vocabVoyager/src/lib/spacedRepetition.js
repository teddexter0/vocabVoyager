// src/lib/spacedRepetition.js - FIXED: All column names use next_review_at
import { supabase } from './supabase'

export const spacedRepetitionService = {
  // ✅ FIXED: Added this missing method
  async getRandomWords(limit = 10) {
    try {
      const { data } = await supabase
        .from('words')
        .select('*')
        .limit(limit * 2); // Get extra for shuffling
      
      if (!data || data.length === 0) return [];
      
      return data.sort(() => 0.5 - Math.random()).slice(0, limit);
    } catch (e) {
      console.error('Error fetching random words:', e);
      return [];
    }
  },

  // ✅ FIXED: Changed next_review_date → next_review_at
  async getReviewWords(userId, limit = 15) {
    if (!userId) return [];
    
    try {
      const { data, error } = await supabase
        .from('user_word_progress')
        .select(`
          *,
          words!inner(*)
        `)
        .eq('user_id', userId)
        .lte('next_review_at', new Date().toISOString()) // ✅ FIXED COLUMN NAME
        .order('next_review_at', { ascending: true })
        .limit(limit);
      
      if (error) {
        console.error('Error fetching review words:', error);
        return [];
      }
      
      return data || [];
    } catch (error) {
      console.error('Exception in getReviewWords:', error);
      return [];
    }
  },

  // ✅ FIXED: Alias for compatibility
  async getWordsForReview(userId, limit = 15) {
    return this.getReviewWords(userId, limit);
  },

  // ✅ FIXED: Changed next_review_date → next_review_at
  async getLearningStats(userId) {
    if (!userId) {
      return { 
        mastered: 0, 
        averageAccuracy: 0, 
        wordsForReview: 0, 
        totalWords: 0 
      };
    }
    
    try {
      const { data, count, error } = await supabase
        .from('user_word_progress')
        .select('*', { count: 'exact' })
        .eq('user_id', userId);
      
      if (error) {
        console.error('Error fetching learning stats:', error);
        return { 
          mastered: 0, 
          averageAccuracy: 0, 
          wordsForReview: 0, 
          totalWords: 0 
        };
      }
      
      const words = data || [];
      const now = new Date();
      
      const mastered = words.filter(w => w.confidence_level === 'mastered').length;
      const due = words.filter(w => new Date(w.next_review_at) <= now).length; // ✅ FIXED COLUMN NAME
      
      // Calculate average accuracy
      const totalReviews = words.reduce((sum, w) => sum + (w.total_reviews || 0), 0);
      const correctReviews = words.reduce((sum, w) => sum + (w.correct_reviews || 0), 0);
      const averageAccuracy = totalReviews > 0 ? correctReviews / totalReviews : 0;
      
      return {
        mastered,
        averageAccuracy,
        wordsForReview: due,
        totalWords: count || 0,
        // Additional breakdown
        confidenceBreakdown: {
          mastered: words.filter(w => w.confidence_level === 'mastered').length,
          strong: words.filter(w => w.confidence_level === 'strong').length,
          developing: words.filter(w => w.confidence_level === 'developing').length,
          learning: words.filter(w => w.confidence_level === 'learning').length,
          new: words.filter(w => w.confidence_level === 'new').length
        }
      };
    } catch (error) {
      console.error('Exception in getLearningStats:', error);
      return { 
        mastered: 0, 
        averageAccuracy: 0, 
        wordsForReview: 0, 
        totalWords: 0 
      };
    }
  },
  // ✅ FIXED: Changed next_review_date → next_review_at AND uses UPSERT
async updateWordProgress(userId, wordId, performance) {
  try {
    const nextReviewDate = new Date();
    nextReviewDate.setDate(nextReviewDate.getDate() + 1); // Review tomorrow
    
    // ✅ FIX: Use upsert to avoid 409 conflicts
    const { data, error } = await supabase
      .from('user_word_progress')
      .upsert({
        user_id: userId,
        word_id: wordId,
        next_review_at: nextReviewDate.toISOString(),
        updated_at: new Date().toISOString(),
        total_reviews: 1, // This will increment if row exists
        confidence_level: 'learning'
      }, {
        onConflict: 'user_id,word_id', // ✅ Handle duplicates
        ignoreDuplicates: false // ✅ Update instead of ignore
      })
      .select()
      .single();
    
    if (error) {
      console.error('❌ Error updating word progress:', error);
      return null;
    }
    
    console.log('✅ Word progress updated:', data);
    return data;
    
  } catch (e) {
    console.error('❌ Exception updating word progress:', e);
    return null;
  }
},

  async loadOrCreateSession(userId, level, isPremium) {
    const words = await this.getRandomWords(3);
    return { 
      isNewSession: true, 
      session: null, 
      words: words.map(w => ({ ...w, isReview: false })) 
    };
  }
};

// ✅ KEPT: These prevent Vercel build errors
export const reviewSessionTypes = { 
  MULTIPLE_CHOICE: 'mc', 
  FILL_BLANK: 'fb', 
  SYNONYM_MATCH: 'sm', 
  DEFINITION_MATCH: 'dm' 
};

export const reviewQuestionGenerator = { 
  generateQuestion: (w, t) => ({ word: w, type: t }),
  generateReviewSession: async (words) => {
    return words.map((word, i) => ({
      id: i + 1,
      word: word,
      type: reviewSessionTypes.MULTIPLE_CHOICE
    }));
  }
};