// File: src/utils/spacedRepetition.js
// Final Optimized Spaced Repetition System for VocabVoyager

import { supabase } from './supabase';

export class SmartSpacedRepetition {
  constructor() {
    // Enhanced intervals based on cognitive science research
    this.baseIntervals = [
      { rep: 0, days: 1, confidence: 'initial' },      // First exposure
      { rep: 1, days: 2, confidence: 'learning' },     // Second review
      { rep: 2, days: 4, confidence: 'building' },     // Building familiarity
      { rep: 3, days: 7, confidence: 'developing' },   // Week review
      { rep: 4, days: 14, confidence: 'strengthening' }, // Two week review
      { rep: 5, days: 30, confidence: 'consolidating' }, // Monthly review
      { rep: 6, days: 60, confidence: 'mastered' },    // Bi-monthly
      { rep: 7, days: 120, confidence: 'expert' },     // Quarterly
      { rep: 8, days: 180, confidence: 'permanent' }   // Semi-annual
    ];
    
    // Performance multipliers for adaptive learning
    this.performanceMultipliers = {
      excellent: 1.5,  // 90%+ accuracy - extend intervals
      good: 1.2,       // 70-89% accuracy - slight extension
      average: 1.0,    // 50-69% accuracy - standard intervals
      poor: 0.6,       // 30-49% accuracy - shorter intervals
      terrible: 0.3    // <30% accuracy - much shorter intervals
    };
  }

  // Calculate next review date with adaptive intelligence
  calculateNextReview(wordId, userId, currentRep, performance) {
    try {
      // Get base interval for current repetition
      const baseInterval = this.getBaseInterval(currentRep);
      
      // Calculate performance modifier
      const performanceModifier = this.calculatePerformanceModifier(performance);
      
      // Apply user-specific learning velocity
      const personalModifier = this.getPersonalLearningModifier(userId, performance.responseTime);
      
      // Calculate final interval
      const finalDays = Math.max(1, Math.round(baseInterval * performanceModifier * personalModifier));
      
      // Calculate next review date
      const nextReviewDate = new Date();
      nextReviewDate.setDate(nextReviewDate.getDate() + finalDays);
      
      return {
        nextReviewDate,
        intervalDays: finalDays,
        confidence: this.getConfidenceLevel(currentRep, performance),
        nextRep: performance.isCorrect ? currentRep + 1 : Math.max(0, currentRep - 1)
      };
      
    } catch (error) {
      console.error('Error calculating next review:', error);
      // Fallback to simple interval
      return this.fallbackCalculation(currentRep);
    }
  }

  // Get base interval from your original formula (improved)
  getBaseInterval(repNumber) {
    if (repNumber >= this.baseIntervals.length) {
      // For advanced repetitions, use exponential growth with cap
      return Math.min(365, 180 + (repNumber - 8) * 30);
    }
    
    return this.baseIntervals[repNumber]?.days || 1;
  }

  // Smart performance modifier based on accuracy and speed
  calculatePerformanceModifier(performance) {
    const { accuracy, responseTime, consecutiveCorrect } = performance;
    
    let modifier = 1.0;
    
    // Accuracy-based adjustment
    if (accuracy >= 0.9) {
      modifier *= this.performanceMultipliers.excellent;
    } else if (accuracy >= 0.7) {
      modifier *= this.performanceMultipliers.good;
    } else if (accuracy >= 0.5) {
      modifier *= this.performanceMultipliers.average;
    } else if (accuracy >= 0.3) {
      modifier *= this.performanceMultipliers.poor;
    } else {
      modifier *= this.performanceMultipliers.terrible;
    }
    
    // Response time bonus (quick correct answers get longer intervals)
    if (performance.isCorrect && responseTime < 3000) { // Under 3 seconds
      modifier *= 1.1;
    } else if (performance.isCorrect && responseTime > 10000) { // Over 10 seconds
      modifier *= 0.9;
    }
    
    // Consecutive correct bonus
    if (consecutiveCorrect >= 3) {
      modifier *= 1.2;
    }
    
    return modifier;
  }

  // Personal learning velocity modifier
  getPersonalLearningModifier(userId, responseTime) {
    // This would typically come from user analytics
    // For now, use response time as a proxy for cognitive load
    
    if (responseTime < 2000) return 1.1;      // Quick learner
    if (responseTime < 5000) return 1.0;      // Average pace
    if (responseTime < 10000) return 0.95;    // Needs more time
    return 0.9;                               // Requires additional support
  }

  // Determine confidence level for UI feedback
  getConfidenceLevel(repNumber, performance) {
    if (repNumber >= 8) return 'mastered';
    if (repNumber >= 6) return 'strong';
    if (repNumber >= 4) return 'developing';
    if (repNumber >= 2) return 'learning';
    return 'new';
  }

  // Fallback calculation if main algorithm fails
  fallbackCalculation(repNumber) {
    const fallbackDays = Math.min(30, Math.pow(2, repNumber));
    const nextReviewDate = new Date();
    nextReviewDate.setDate(nextReviewDate.getDate() + fallbackDays);
    
    return {
      nextReviewDate,
      intervalDays: fallbackDays,
      confidence: 'unknown',
      nextRep: repNumber + 1
    };
  }

  // Update word progress in database
  async updateWordProgress(userId, wordId, performance) {
    try {
      // Get current progress
      const { data: currentProgress, error: fetchError } = await supabase
        .from('user_word_progress')
        .select('*')
        .eq('user_id', userId)
        .eq('word_id', wordId)
        .single();

      let currentRep = 0;
      if (currentProgress && !fetchError) {
        currentRep = currentProgress.repetition_number || 0;
      }

      // Calculate next review
      const nextReview = this.calculateNextReview(wordId, userId, currentRep, performance);

      // Update or insert progress
      const progressData = {
        user_id: userId,
        word_id: wordId,
        repetition_number: nextReview.nextRep,
        next_review_at: nextReview.nextReviewDate.toISOString(),
        interval_days: nextReview.intervalDays,
        confidence_level: nextReview.confidence,
        last_reviewed_at: new Date().toISOString(),
        total_reviews: (currentProgress?.total_reviews || 0) + 1,
        correct_reviews: performance.isCorrect ? 
          (currentProgress?.correct_reviews || 0) + 1 : 
          (currentProgress?.correct_reviews || 0),
        average_response_time: this.calculateAverageResponseTime(
          currentProgress?.average_response_time || 0,
          currentProgress?.total_reviews || 0,
          performance.responseTime
        )
      };

      const { error: upsertError } = await supabase
        .from('user_word_progress')
        .upsert(progressData);

      if (upsertError) throw upsertError;

      return {
        success: true,
        nextReview: nextReview.nextReviewDate,
        confidence: nextReview.confidence,
        intervalDays: nextReview.intervalDays
      };

    } catch (error) {
      console.error('Error updating word progress:', error);
      return { success: false, error: error.message };
    }
  }

  // Calculate rolling average response time
  calculateAverageResponseTime(currentAverage, reviewCount, newResponseTime) {
    if (reviewCount === 0) return newResponseTime;
    return ((currentAverage * reviewCount) + newResponseTime) / (reviewCount + 1);
  }

  // Get words due for review
  async getWordsForReview(userId, limit = 10) {
    try {
      const now = new Date().toISOString();
      
      const { data: dueWords, error } = await supabase
        .from('user_word_progress')
        .select(`
          *,
          words (*)
        `)
        .eq('user_id', userId)
        .lte('next_review_at', now)
        .order('next_review_at', { ascending: true })
        .limit(limit);

      if (error) throw error;

      return {
        success: true,
        words: dueWords || [],
        count: dueWords?.length || 0
      };

    } catch (error) {
      console.error('Error getting words for review:', error);
      return { success: false, words: [], count: 0 };
    }
  }

  // Get learning statistics
  async getLearningStats(userId) {
    try {
      const { data: stats, error } = await supabase
        .from('user_word_progress')
        .select('confidence_level, repetition_number, correct_reviews, total_reviews')
        .eq('user_id', userId);

      if (error) throw error;

      const analysis = {
        totalWords: stats.length,
        mastered: stats.filter(s => s.confidence_level === 'mastered').length,
        learning: stats.filter(s => s.confidence_level === 'learning').length,
        developing: stats.filter(s => s.confidence_level === 'developing').length,
        averageAccuracy: this.calculateOverallAccuracy(stats),
        wordsForReview: stats.filter(s => new Date(s.next_review_at) <= new Date()).length
      };

      return { success: true, stats: analysis };

    } catch (error) {
      console.error('Error getting learning stats:', error);
      return { success: false, stats: null };
    }
  }

  calculateOverallAccuracy(stats) {
    const totalReviews = stats.reduce((sum, s) => sum + (s.total_reviews || 0), 0);
    const totalCorrect = stats.reduce((sum, s) => sum + (s.correct_reviews || 0), 0);
    return totalReviews > 0 ? (totalCorrect / totalReviews) : 0;
  }
}

// Export singleton instance
export const spacedRepetition = new SmartSpacedRepetition();

// React hook for easy component integration
export const useSpacedRepetition = () => {
  const [reviewWords, setReviewWords] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);

  const getReviewWords = async (userId, limit = 10) => {
    setLoading(true);
    const result = await spacedRepetition.getWordsForReview(userId, limit);
    setReviewWords(result.words);
    setLoading(false);
    return result;
  };

  const updateProgress = async (userId, wordId, performance) => {
    return await spacedRepetition.updateWordProgress(userId, wordId, performance);
  };

  const getStats = async (userId) => {
    const result = await spacedRepetition.getLearningStats(userId);
    setStats(result.stats);
    return result;
  };

  return {
    reviewWords,
    stats,
    loading,
    getReviewWords,
    updateProgress,
    getStats
  };
};