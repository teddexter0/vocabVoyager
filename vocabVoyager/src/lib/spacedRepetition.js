// src/lib/spacedRepetition.js - FIXED FOR YOUR ACTUAL SCHEMA
import { supabase } from './supabase'

export const spacedRepetitionService = {
  async getRandomWords(limit = 10) {
    try {
      const { data } = await supabase
        .from('words')
        .select('*')
        .limit(limit * 2);
      
      if (!data || data.length === 0) return [];
      
      return data.sort(() => 0.5 - Math.random()).slice(0, limit);
    } catch (e) {
      console.error('Error fetching random words:', e);
      return [];
    }
  },

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
        .lte('next_review_at', new Date().toISOString())
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

  async getWordsForReview(userId, limit = 15) {
    return this.getReviewWords(userId, limit);
  },

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
      
      const mastered = words.filter(w => w.mastery_level >= 5).length;
      const due = words.filter(w => new Date(w.next_review_at) <= now).length;
      
      const totalReviews = words.reduce((sum, w) => sum + (w.review_count || 0), 0);
      const correctReviews = words.reduce((sum, w) => sum + (w.correct_count || 0), 0);
      const averageAccuracy = totalReviews > 0 ? correctReviews / totalReviews : 0;
      
      return {
        mastered,
        averageAccuracy,
        wordsForReview: due,
        totalWords: count || 0,
        confidenceBreakdown: {
          mastered: words.filter(w => w.mastery_level >= 5).length,
          strong: words.filter(w => w.mastery_level >= 3 && w.mastery_level < 5).length,
          developing: words.filter(w => w.mastery_level >= 1 && w.mastery_level < 3).length,
          learning: words.filter(w => w.mastery_level === 0).length,
          new: 0
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

  async updateWordProgress(userId, wordId, performance) {
    try {
      const nextReviewDate = new Date();
      nextReviewDate.setDate(nextReviewDate.getDate() + 1);
      
      const { data, error } = await supabase
        .from('user_word_progress')
        .upsert({
          user_id: userId,
          word_id: wordId,
          next_review_at: nextReviewDate.toISOString(),
          last_seen_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          times_seen: 1,
          times_correct: performance?.isCorrect ? 1 : 0,
          review_count: 1,
          correct_count: performance?.isCorrect ? 1 : 0,
          mastery_level: 0,
          status: 'learning'
        }, {
          onConflict: 'user_id,word_id',
          ignoreDuplicates: false
        })
        .select()
        .maybeSingle();
      
      if (error) {
        console.error('❌ Error updating word progress:', error);
        return null;
      }
      
      console.log('✅ Word progress updated');
      return data;
      
    } catch (e) {
      console.error('❌ Exception:', e);
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