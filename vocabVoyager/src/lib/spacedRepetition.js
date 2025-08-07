// src/lib/spacedRepetition.js - Spaced Repetition Algorithm
import { supabase } from './supabase'

export const spacedRepetitionService = {
  // Add this to your spacedRepetitionService object in spacedRepetition.js

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

    // 3. If no session, generate new words
    const newWords = await this.generateDailySession(userId, level, isPremium);

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
  // Your custom spaced repetition intervals (in days)
  getRepetitionInterval(repetitionNumber) {
    const intervals = {
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
    
    return intervals[repetitionNumber] || intervals.default
  },

  // Calculate next review date
  calculateNextReviewDate(repetitionNumber, masteryLevel = 0, wasCorrect = true) {
    let interval = this.getRepetitionInterval(repetitionNumber)
    
    // Adjust interval based on performance
    if (!wasCorrect) {
      // If answered incorrectly, reduce interval
      interval = Math.max(1, Math.floor(interval / 2))
    } else if (masteryLevel >= 3) {
      // If high mastery, slightly increase interval
      interval = Math.floor(interval * 1.2)
    }
    
    const nextDate = new Date()
    nextDate.setDate(nextDate.getDate() + interval)
    
    return nextDate.toISOString().split('T')[0]
  },

  // Get words due for review today
  async getWordsForReview(userId, limit = 10) {
    try {
      console.log('🔄 Getting words due for review for user:', userId)
      
      const today = new Date().toISOString().split('T')[0]
      
      const { data, error } = await supabase
        .from('user_word_progress')
        .select(`
          *,
          words (
            id, word, synonym, definition, example, context, level, difficulty
          )
        `)
        .eq('user_id', userId)
        .lte('next_review', today)
        .order('next_review', { ascending: true })
        .limit(limit)
      
      if (error) {
        console.error('❌ Error getting review words:', error)
        return []
      }
      
      console.log(`✅ Found ${data?.length || 0} words due for review`)
      return data || []
      
    } catch (err) {
      console.error('❌ Exception getting review words:', err)
      return []
    }
  },

  // Record word learning/review attempt
  async recordWordAttempt(userId, wordId, wasCorrect, responseTime = null) {
    try {
      console.log('📝 Recording word attempt:', { userId, wordId, wasCorrect })
      
      // Get existing progress or create new
      let { data: existingProgress, error: getError } = await supabase
        .from('user_word_progress')
        .select('*')
        .eq('user_id', userId)
        .eq('word_id', wordId)
        .single()
      
      let newProgress
      
      if (existingProgress) {
        // Update existing progress
        const timesCorrect = wasCorrect ? existingProgress.times_correct + 1 : existingProgress.times_correct
        const timesSeen = existingProgress.times_seen + 1
        const accuracyRate = timesCorrect / timesSeen
        
        // Calculate new mastery level (0-5 scale)
        let masteryLevel = existingProgress.mastery_level
        if (wasCorrect) {
          masteryLevel = Math.min(5, masteryLevel + (accuracyRate > 0.8 ? 1 : 0.5))
        } else {
          masteryLevel = Math.max(0, masteryLevel - 0.5)
        }
        
        const repetitionNumber = wasCorrect ? existingProgress.times_correct : existingProgress.times_correct
        const nextReview = this.calculateNextReviewDate(repetitionNumber, masteryLevel, wasCorrect)
        
        newProgress = {
          ...existingProgress,
          times_seen: timesSeen,
          times_correct: timesCorrect,
          mastery_level: masteryLevel,
          next_review: nextReview,
          last_reviewed: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }
        
        const { data, error } = await supabase
          .from('user_word_progress')
          .update(newProgress)
          .eq('id', existingProgress.id)
          .select()
          .single()
        
        if (error) throw error
        newProgress = data
        
      } else {
        // Create new progress entry
        const nextReview = this.calculateNextReviewDate(0, 0, wasCorrect)
        
        newProgress = {
          user_id: userId,
          word_id: wordId,
          times_seen: 1,
          times_correct: wasCorrect ? 1 : 0,
          mastery_level: wasCorrect ? 1 : 0,
          next_review: nextReview,
          last_reviewed: new Date().toISOString(),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }
        
        const { data, error } = await supabase
          .from('user_word_progress')
          .insert(newProgress)
          .select()
          .single()
        
        if (error) throw error
        newProgress = data
      }
      
      console.log('✅ Word progress updated:', newProgress)
      return newProgress
      
    } catch (err) {
      console.error('❌ Error recording word attempt:', err)
      return null
    }
  },

  // Generate review session (mix of review words and new words)
  async generateDailySession(userId, level, isPremium) {
    try {
      console.log('📚 Generating daily session with spaced repetition for user:', userId)
      
      // Get words due for review (max 2 per session)
      const reviewWords = await this.getWordsForReview(userId, 2)
      
      // Calculate how many new words we need
      const reviewWordCount = reviewWords.length
      const newWordsNeeded = Math.max(1, 3 - reviewWordCount) // Ensure at least 1 new word
      
      console.log(`📊 Session composition: ${reviewWordCount} review words, ${newWordsNeeded} new words`)
      
      // Get new words that user hasn't seen
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
  .not('id', 'in', seenIds.length > 0 ? seenIds : [-1]) // [-1] ensures valid SQL even if empty
  .eq('level', isPremium ? level : 1)
  .limit(newWordsNeeded);
      
      if (error) {
        console.error('❌ Error getting new words:', error)
      }
      
      // Combine review words and new words
      const sessionWords = [
        ...reviewWords.map(rw => ({ ...rw.words, isReview: true, progressId: rw.id })),
        ...(newWords || []).map(nw => ({ ...nw, isReview: false }))
      ]
      
      // Shuffle the words
      const shuffledWords = sessionWords.sort(() => 0.5 - Math.random())
      
      console.log(`✅ Generated session with ${shuffledWords.length} words:`, 
        shuffledWords.map(w => `${w.word} (${w.isReview ? 'review' : 'new'})`))
      
      return shuffledWords
      
    } catch (err) {
      console.error('❌ Exception generating daily session:', err)
      return []
    }
  },

  // Get user's learning statistics
  async getLearningStats(userId) {
    try {
      const { data, error } = await supabase
        .from('user_word_progress')
        .select('*')
        .eq('user_id', userId)
      
      if (error) throw error
      
      const stats = {
        totalWordsLearned: data.length,
        masteredWords: data.filter(w => w.mastery_level >= 4).length,
        averageMastery: data.length > 0 
          ? (data.reduce((sum, w) => sum + w.mastery_level, 0) / data.length).toFixed(1)
          : 0,
        accuracyRate: data.length > 0
          ? ((data.reduce((sum, w) => sum + w.times_correct, 0) / data.reduce((sum, w) => sum + w.times_seen, 0)) * 100).toFixed(1)
          : 0,
        wordsForReviewToday: data.filter(w => w.next_review <= new Date().toISOString().split('T')[0]).length,
        streakData: {
          longestStreak: 0, // This would need additional tracking
          currentStreak: 0  // This would need additional tracking
        }
      }
      
      return stats
      
    } catch (err) {
      console.error('❌ Error getting learning stats:', err)
      return {
        totalWordsLearned: 0,
        masteredWords: 0,
        averageMastery: 0,
        accuracyRate: 0,
        wordsForReviewToday: 0,
        streakData: { longestStreak: 0, currentStreak: 0 }
      }
    }
  }
}

// Review session types
export const reviewSessionTypes = {
  MULTIPLE_CHOICE: 'multiple_choice',
  FILL_BLANK: 'fill_blank',
  SYNONYM_MATCH: 'synonym_match',
  DEFINITION_MATCH: 'definition_match'
}

// Generate review questions for spaced repetition
export const reviewQuestionGenerator = {
  // Generate multiple choice question
  generateMultipleChoice(targetWord, allWords) {
    const incorrectOptions = allWords
      .filter(w => w.id !== targetWord.id && w.level <= targetWord.level)
      .sort(() => 0.5 - Math.random())
      .slice(0, 3)
    
    const options = [targetWord, ...incorrectOptions]
      .sort(() => 0.5 - Math.random())
    
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
    }
  },

  // Generate fill in the blank question
  generateFillBlank(targetWord) {
    const sentence = targetWord.example
    const wordRegex = new RegExp(targetWord.word, 'gi')
    const questionSentence = sentence.replace(wordRegex, '_______')
    
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
    }
  },

  // Generate synonym matching question
  generateSynonymMatch(targetWord, allWords) {
    const incorrectSynonyms = allWords
      .filter(w => w.id !== targetWord.id && w.synonym !== targetWord.synonym)
      .sort(() => 0.5 - Math.random())
      .slice(0, 3)
      .map(w => w.synonym)
    
    const options = [targetWord.synonym, ...incorrectSynonyms]
      .sort(() => 0.5 - Math.random())
    
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
    }
  },

  // Generate definition matching question
  generateDefinitionMatch(targetWord, allWords) {
    const incorrectDefinitions = allWords
      .filter(w => w.id !== targetWord.id)
      .sort(() => 0.5 - Math.random())
      .slice(0, 3)
      .map(w => w.definition)
    
    const options = [targetWord.definition, ...incorrectDefinitions]
      .sort(() => 0.5 - Math.random())
    
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
    }
  },

  // Generate mixed review session
  async generateReviewSession(reviewWords, allWords) {
    const questionTypes = [
      this.generateMultipleChoice,
      this.generateFillBlank,
      this.generateSynonymMatch,
      this.generateDefinitionMatch
    ]
    
    const questions = reviewWords.map(word => {
      // Choose random question type, but prefer fill_blank for higher mastery
      let questionGenerator
      if (word.mastery_level >= 3) {
        // For well-known words, use more challenging fill-blank questions
        questionGenerator = Math.random() > 0.3 
          ? this.generateFillBlank 
          : questionTypes[Math.floor(Math.random() * questionTypes.length)]
      } else {
        // For newer words, use easier multiple choice
        questionGenerator = Math.random() > 0.5
          ? this.generateMultipleChoice
          : this.generateSynonymMatch
      }
      
      return questionGenerator.call(this, word, allWords)
    })
    
    return questions
  }
}