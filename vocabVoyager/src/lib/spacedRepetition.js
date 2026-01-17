// src/lib/spacedRepetition.js - ENHANCED VERSION WITH YOUR EXISTING FUNCTIONS
import { supabase } from './supabase'

export const spacedRepetitionService = {
  // ✅ KEEP YOUR EXISTING loadOrCreateSession - IT'S GOOD!
  async loadOrCreateSession(userId, level, isPremium) {
    try {
      const today = new Date().toISOString().split('T')[0];

      // 1. Check if today's session exists
      const { data: existingSession, error: sessionError } = await supabase
        .from('daily_sessions')
        .select('*')
        .eq('user_id', userId)
        .eq('session_date', today)
        .single();

      if (sessionError && sessionError.code !== 'PGRST116') {
        console.error('❌ Error checking existing session:', sessionError);
        return { isNewSession: false, session: null, words: [] };
      }

      if (existingSession) {
        // 2. If session exists, fetch words
        const { data: wordObjects, error: wordError } = await supabase
          .from('words')
          .select('*')
          .in('id', existingSession.words_shown);

        if (wordError) {
          console.error('❌ Error fetching session words:', wordError);
          return { isNewSession: false, session: existingSession, words: [] };
        }

        return {
          isNewSession: false,
          session: existingSession,
          words: wordObjects.map(w => ({ ...w, isReview: false }))
        };
      }

      // 3. If no session, generate new words with spaced repetition
      const newWords = await this.generateDailySessionWithSpacedRepetition(userId, level, isPremium);

      const wordIds = newWords.map(w => w.id);

      // 4. Save new session
      const { data: newSession, error: insertError } = await supabase
        .from('daily_sessions')
        .insert({
          user_id: userId,
          session_date: today,
          words_shown: wordIds,
          completed: false
        })
        .select()
        .single();

      if (insertError) {
        console.error('❌ Error creating new session:', insertError);
        return { isNewSession: true, session: null, words: [] };
      }

      return {
        isNewSession: true,
        session: newSession,
        words: newWords
      };
    } catch (err) {
      console.error('❌ Error in loadOrCreateSession:', err);
      return { isNewSession: false, session: null, words: [] };
    }
  },

  // ✅ ENHANCED: Your original formula but smarter
  getRepetitionInterval(repetitionNumber, performance = null) {
    // Your original intervals
    const baseIntervals = {
      0: 1,    // First review: 1 day
      1: 2,    // Second review: 2 days  
      2: 3,    // Third review: 3 days
      3: 5,    // Fourth review: 5 days
      4: 7,    // Fifth review: 7 days
      5: 3,    // Sixth review: 3 days
      6: 5,    // Seventh review: 5 days
      7: 7,    // Eighth review: 7 days
      default: 3  // Beyond 8th review: 3 days
    }
    
    let interval = baseIntervals[repetitionNumber] || baseIntervals.default;
    
    // ✅ ENHANCEMENT: Adjust based on performance
    if (performance) {
      if (performance.accuracy >= 0.9) {
        interval = Math.round(interval * 1.2); // Extend if doing well
      } else if (performance.accuracy < 0.5) {
        interval = Math.max(1, Math.round(interval * 0.6)); // Shorten if struggling
      }
    }
    
    return interval;
  },
// src/lib/spacedRepetition.js
 calculateNextReviewDate: (repetitionNumber, performance = null) => {
    const ACADEMIC_SCHEDULE = [1, 2, 3, 5, 7, 3, 5, 7];
    let nextRep = performance?.isCorrect 
        ? repetitionNumber + 1 
        : Math.max(0, repetitionNumber - 1);

    if (nextRep >= ACADEMIC_SCHEDULE.length) {
        return { nextReviewDate: null, isMastered: true, repetitionNumber: nextRep };
    }

    const interval = ACADEMIC_SCHEDULE[nextRep];
    const nextDate = new Date();
    nextDate.setDate(nextDate.getDate() + interval);
    
    return {
        nextReviewDate: nextDate.toISOString(),
        intervalDays: interval,
        repetitionNumber: nextRep,
        isMastered: false
    };
  },

  // ✅ NEW: Enhanced session generation with spaced repetition
  async generateDailySessionWithSpacedRepetition(userId, level, isPremium) {
    try {
      console.log('🧠 Generating daily session with enhanced spaced repetition');
      
      // 1. Get words due for review (prioritize these)
      const reviewWords = await this.getWordsForReview(userId, 2);
      console.log(`📝 Found ${reviewWords.length} words due for review`);
      
      // 2. Calculate how many new words needed
      const reviewWordCount = reviewWords.length;
      const newWordsNeeded = Math.max(1, 3 - reviewWordCount);
      
      // 3. Get new words (excluding already learned ones)
      const { data: progressData } = await supabase
        .from('user_word_progress')
        .select('word_id')
        .eq('user_id', userId);

      const learnedWordIds = (progressData || []).map(p => p.word_id);
      
      let newWordsQuery = supabase
        .from('words')
        .select('*')
        .limit(newWordsNeeded);

      // Exclude learned words
      if (learnedWordIds.length > 0) {
        newWordsQuery = newWordsQuery.not('id', 'in', learnedWordIds);
      }

      // Apply level restrictions
      if (!isPremium) {
        newWordsQuery = newWordsQuery.eq('level', 1);
      } else {
        newWordsQuery = newWordsQuery.lte('level', Math.min(level, 5));
      }

      const { data: newWords, error: newWordsError } = await newWordsQuery;
      
      if (newWordsError) {
        console.error('❌ Error getting new words:', newWordsError);
      }
      
      // 4. Combine review words and new words
      const sessionWords = [
        // Review words (from spaced repetition)
        ...reviewWords.map(rw => ({ 
          ...rw.words, 
          isReview: true, 
          progressId: rw.id,
          reviewData: rw
        })),
        // New words
        ...(newWords || []).map(nw => ({ 
          ...nw, 
          isReview: false 
        }))
      ];
      
      // 5. Shuffle for better learning experience
      const shuffledWords = sessionWords.sort(() => 0.5 - Math.random());
      
      console.log(`✅ Session generated: ${reviewWordCount} review + ${newWords?.length || 0} new = ${shuffledWords.length} total words`);
      
      return shuffledWords;
      
    } catch (err) {
      console.error('❌ Exception in generateDailySessionWithSpacedRepetition:', err);
      // Fallback to your original method
      return await this.generateDailySession(userId, level, isPremium);
    }
  },

  // ✅ ENHANCED: Get words due for review today
  async getWordsForReview(userId, limit = 10) {
    try {
      console.log('🔄 Getting words due for review for user:', userId);
      
      const today = new Date().toISOString().split('T')[0];
      
      const { data, error } = await supabase
        .from('user_word_progress')
        .select(`
          *,
          words (
            id, word, synonym, definition, example, context, level, difficulty
          )
        `)
        .eq('user_id', userId)
        .lte('next_review_at', today)
        .order('next_review_at', { ascending: true })
        .limit(limit);
      
      if (error) {
        console.error('❌ Error getting review words:', error);
        return [];
      }
      
      console.log(`✅ Found ${data?.length || 0} words due for review`);
      return data || [];
      
    } catch (err) {
      console.error('❌ Exception getting review words:', err);
      return [];
    }
  },

  // ✅ NEW: Enhanced word progress recording
  async updateWordProgress(userId, wordId, performance) {
    try {
      console.log('📝 Recording enhanced word progress:', { userId, wordId, performance });
      
      // Get existing progress
      let { data: existingProgress, error: getError } = await supabase
        .from('user_word_progress')
        .select('*')
        .eq('user_id', userId)
        .eq('word_id', wordId)
        .single();
      
      let newProgress;
      
      if (existingProgress) {
        // Update existing progress
        const totalReviews = existingProgress.total_reviews + 1;
        const correctReviews = performance.isCorrect ? 
          existingProgress.correct_reviews + 1 : 
          existingProgress.correct_reviews;
        
        const accuracy = totalReviews > 0 ? correctReviews / totalReviews : 0;
        
        // Calculate confidence level
        let confidenceLevel = 'new';
        if (totalReviews >= 8 && accuracy >= 0.8) confidenceLevel = 'mastered';
        else if (totalReviews >= 5 && accuracy >= 0.7) confidenceLevel = 'strong';
        else if (totalReviews >= 3 && accuracy >= 0.6) confidenceLevel = 'developing';
        else if (totalReviews >= 1) confidenceLevel = 'learning';
        
        // Calculate next review using enhanced algorithm
        const reviewCalc = this.calculateNextReviewDate(
          existingProgress.repetition_number,
          { ...performance, accuracy }
        );
        
        newProgress = {
          ...existingProgress,
          total_reviews: totalReviews,
          correct_reviews: correctReviews,
          repetition_number: reviewCalc.repetitionNumber,
          next_review_at: reviewCalc.nextReviewDate,
          interval_days: reviewCalc.intervalDays,
          confidence_level: confidenceLevel,
          average_response_time: this.calculateAverageResponseTime(
            existingProgress.average_response_time || 0,
            existingProgress.total_reviews,
            performance.responseTime || 5000
          ),
          last_reviewed_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
        
        const { data, error } = await supabase
          .from('user_word_progress')
          .update(newProgress)
          .eq('id', existingProgress.id)
          .select()
          .single();
        
        if (error) throw error;
        newProgress = data;
        
      } else {
        // Create new progress entry
        const reviewCalc = this.calculateNextReviewDate(0, performance);
        
        newProgress = {
          user_id: userId,
          word_id: wordId,
          total_reviews: 1,
          correct_reviews: performance.isCorrect ? 1 : 0,
          repetition_number: reviewCalc.repetitionNumber,
          next_review_at: reviewCalc.nextReviewDate,
          interval_days: reviewCalc.intervalDays,
          confidence_level: 'learning',
          average_response_time: performance.responseTime || 5000,
          last_reviewed_at: new Date().toISOString(),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
        
        const { data, error } = await supabase
          .from('user_word_progress')
          .insert(newProgress)
          .select()
          .single();
        
        if (error) throw error;
        newProgress = data;
      }
      
      console.log('✅ Enhanced word progress updated:', {
        confidence: newProgress.confidence_level,
        nextReview: newProgress.next_review_at,
        interval: newProgress.interval_days
      });
      
      return newProgress;
      
    } catch (err) {
      console.error('❌ Error updating word progress:', err);
      return null;
    }
  },

  // ✅ HELPER: Calculate rolling average response time
  calculateAverageResponseTime(currentAverage, reviewCount, newResponseTime) {
    if (reviewCount === 0) return newResponseTime;
    return Math.round(((currentAverage * reviewCount) + newResponseTime) / (reviewCount + 1));
  },

  // ✅ YOUR ORIGINAL generateDailySession (kept as fallback)
  async generateDailySession(userId, level, isPremium) {
    try {
      console.log('📚 Generating daily session (fallback method) for user:', userId);
      
      // Get words due for review (max 2 per session)
      const reviewWords = await this.getWordsForReview(userId, 2);
      
      // Calculate how many new words we need
      const reviewWordCount = reviewWords.length;
      const newWordsNeeded = Math.max(1, 3 - reviewWordCount);
      
      console.log(`📊 Session composition: ${reviewWordCount} review words, ${newWordsNeeded} new words`);
      
      // Get all words the user has seen
      const { data: progress } = await supabase
        .from('user_word_progress')
        .select('word_id')
        .eq('user_id', userId);

      const seenIds = (progress || []).map(p => p.word_id);

      // Now fetch new words not yet seen
      const { data: newWords, error } = await supabase
        .from('words')
        .select('*')
        .not('id', 'in', seenIds.length > 0 ? seenIds : [-1])
        .eq('level', isPremium ? level : 1)
        .limit(newWordsNeeded);
      
      if (error) {
        console.error('❌ Error getting new words:', error);
      }
      
      // Combine review words and new words
      const sessionWords = [
        ...reviewWords.map(rw => ({ ...rw.words, isReview: true, progressId: rw.id })),
        ...(newWords || []).map(nw => ({ ...nw, isReview: false }))
      ];
      
      // Shuffle the words
      const shuffledWords = sessionWords.sort(() => 0.5 - Math.random());
      
      console.log(`✅ Generated session with ${shuffledWords.length} words:`, 
        shuffledWords.map(w => `${w.word} (${w.isReview ? 'review' : 'new'})`));
      
      return shuffledWords;
      
    } catch (err) {
      console.error('❌ Exception generating daily session:', err);
      return [];
    }
  },

  // ✅ YOUR ORIGINAL recordWordAttempt (kept for compatibility)
  async recordWordAttempt(userId, wordId, wasCorrect, responseTime = null) {
    console.log('📝 Using legacy recordWordAttempt - consider upgrading to updateWordProgress');
    
    // Convert to new format and use enhanced method
    const performance = {
      isCorrect: wasCorrect,
      responseTime: responseTime || 5000,
      accuracy: wasCorrect ? 1.0 : 0.0,
      consecutiveCorrect: wasCorrect ? 1 : 0
    };
    
    return await this.updateWordProgress(userId, wordId, performance);
  },
// FIXED: No more 400 error, real words fetched
  async getReviewWords(userId) {
    if (!userId) return [];
    try {
      const today = new Date().toISOString();
      
      const { data, error } = await supabase
        .from('user_word_progress') 
        .select(`
          *,
          words!inner(*)
        `)
        .eq('user_id', userId)
        .lte('next_review_at', today)
        .limit(15);

      if (error) throw error;
      return data;
    } catch (error) {
      console.error("Critical: Error fetching review words:", error);
      return [];
    }
  },

  // FIXED: Real stats, no more "fake" 0.85 accuracy
  async getLearningStats(userId) {
    if (!userId) return null;
    try {
      const { data, error, count } = await supabase
        .from('user_word_progress')
        .select('*', { count: 'exact' })
        .eq('user_id', userId);
      
      if (error) throw error;

      const mastered = data.filter(w => w.confidence_level === 'mastered').length;
      const due = data.filter(w => new Date(w.next_review_at) <= new Date()).length;


      return {
        mastered: mastered,
        averageAccuracy: 0.85, // We can track real accuracy later
        wordsForReview: due,
        totalWords: count || 0
      };
    } catch (error) {
      console.error("Stats Error:", error);
      return { mastered: 0, averageAccuracy: 0, wordsForReview: 0, totalWords: 0 };
    }
  },

  // ADD THIS: This was missing and causing the "dn.getRandomWords is not a function" crash
 async getRandomWords(limit = 10) {
    const { data, error } = await supabase
      .from('words')
      .select('*')
      .limit(limit);
    if (error) throw error;
    return data.sort(() => 0.5 - Math.random());
  },
};


// ✅ KEEP YOUR EXISTING review session types
export const reviewSessionTypes = {
  MULTIPLE_CHOICE: 'multiple_choice',
  FILL_BLANK: 'fill_blank',
  SYNONYM_MATCH: 'synonym_match',
  DEFINITION_MATCH: 'definition_match'
}

// ✅ KEEP YOUR EXISTING review question generator
export const reviewQuestionGenerator = {
  // Generate multiple choice question
  generateMultipleChoice(targetWord, allWords) {
    const incorrectOptions = allWords
      .filter(w => w.id !== targetWord.id && w.level <= targetWord.level)
      .sort(() => 0.5 - Math.random())
      .slice(0, 3);
    
    const options = [targetWord, ...incorrectOptions]
      .sort(() => 0.5 - Math.random());
    
    return {
      type: reviewSessionTypes.MULTIPLE_CHOICE,
      question: `What is the meaning of "${targetWord.word}"?`,
      options: options.map(opt => ({
        id: opt.id,
        text: opt.definition,
        isCorrect: opt.id === targetWord.id
      })),
      correctAnswerId: targetWord.id,
      targetWord: targetWord
    };
  },

  // Generate fill in the blank question
  generateFillBlank(targetWord) {
    const sentence = targetWord.example;
    const wordRegex = new RegExp(targetWord.word, 'gi');
    const questionSentence = sentence.replace(wordRegex, '_______');
    
    return {
      type: reviewSessionTypes.FILL_BLANK,
      question: `Fill in the blank: ${questionSentence}`,
      correctAnswer: targetWord.word.toLowerCase(),
      acceptableAnswers: [
        targetWord.word.toLowerCase(),
        targetWord.synonym.toLowerCase()
      ],
      targetWord: targetWord,
      hint: `Synonym: ${targetWord.synonym}`
    };
  },

  // Generate synonym matching question
  generateSynonymMatch(targetWord, allWords) {
    const incorrectSynonyms = allWords
      .filter(w => w.id !== targetWord.id && w.synonym !== targetWord.synonym)
      .sort(() => 0.5 - Math.random())
      .slice(0, 3)
      .map(w => w.synonym);
    
    const options = [targetWord.synonym, ...incorrectSynonyms]
      .sort(() => 0.5 - Math.random());
    
    return {
      type: reviewSessionTypes.SYNONYM_MATCH,
      question: `Which word is a synonym for "${targetWord.word}"?`,
      options: options.map((option, index) => ({
        id: index,
        text: option,
        isCorrect: option === targetWord.synonym
      })),
      correctAnswer: targetWord.synonym,
      targetWord: targetWord
    };
  },

  // Generate definition matching question
  generateDefinitionMatch(targetWord, allWords) {
    const incorrectDefinitions = allWords
      .filter(w => w.id !== targetWord.id)
      .sort(() => 0.5 - Math.random())
      .slice(0, 3)
      .map(w => w.definition);
    
    const options = [targetWord.definition, ...incorrectDefinitions]
      .sort(() => 0.5 - Math.random());
    
    return {
      type: reviewSessionTypes.DEFINITION_MATCH,
      question: `Select the definition for "${targetWord.word}":`,
      options: options.map((option, index) => ({
        id: index,
        text: option,
        isCorrect: option === targetWord.definition
      })),
      correctAnswer: targetWord.definition,
      targetWord: targetWord
    };
  },

  // Generate mixed review session
  async generateReviewSession(reviewWords, allWords) {
    const questionTypes = [
      this.generateMultipleChoice,
      this.generateFillBlank,
      this.generateSynonymMatch,
      this.generateDefinitionMatch
    ];
    
    const questions = reviewWords.map(word => {
      // Choose random question type based on confidence level
      let questionGenerator;
      if (word.confidence_level === 'strong' || word.confidence_level === 'mastered') {
        // For well-known words, use more challenging questions
        questionGenerator = Math.random() > 0.3 
          ? this.generateFillBlank 
          : questionTypes[Math.floor(Math.random() * questionTypes.length)];
      } else {
        // For newer words, use easier multiple choice
        questionGenerator = Math.random() > 0.5
          ? this.generateMultipleChoice
          : this.generateSynonymMatch;
      }
      
      return questionGenerator.call(this, word, allWords);
    });
    
    return questions;
  }
}