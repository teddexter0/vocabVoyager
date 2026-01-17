// src/lib/openAIAssistant.js - FIXED: No more .trim() errors, secured API calls

import { supabase } from './supabase';

class VocabAIAssistant {
  constructor() {
    // API calls now go through backend proxy (see api/anthropic.js)
    this.baseURL = '/api/anthropic';
    console.log('✅ VocabAI initialized (using backend proxy)');
  }

  // ✅ FIXED: Returns STRING, not object
  async makeOpenAIRequest(messages, options = {}) {
    try {
      const response = await fetch(this.baseURL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages })
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const data = await response.json();
      return data.text || "AI response temporarily unavailable"; // ✅ Returns string
      
    } catch (error) {
      console.error('AI request failed:', error);
      return "AI features are temporarily offline. Your learning continues below!"; // ✅ Returns string
    }
  }

  // ✅ FIXED: No more .trim() errors
  async generateLearningInsights(userId, learningStats, recentMistakes = []) {
    try {
      const userProfile = await this.getUserLearningProfile(userId);
      
      const prompt = `
You are VocabAI, an expert vocabulary learning assistant. Analyze this student's learning data and provide personalized insights and recommendations.

STUDENT PROFILE:
- Total words learned: ${learningStats.totalWords || 0}
- Mastered words: ${learningStats.mastered || 0}
- Average accuracy: ${Math.round((learningStats.averageAccuracy || 0) * 100)}%
- Words for review: ${learningStats.wordsForReview || 0}
- Current level: ${userProfile.current_level || 1}
- Premium user: ${userProfile.is_premium ? 'Yes' : 'No'}

RECENT MISTAKES:
${recentMistakes.length > 0 ? 
  recentMistakes.map(m => `- ${m.word}: confused with "${m.incorrectAnswer}"`).join('\n') :
  'No recent mistakes recorded'
}

Please provide:
1. A brief encouraging assessment of their progress
2. 2-3 specific learning patterns you notice
3. 2-3 personalized study recommendations
4. One motivational insight

Keep it friendly, supportive, and actionable. Limit to 200 words.
`;

      const messages = [
        {
          role: 'user',
          content: prompt
        }
      ];

      const insights = await this.makeOpenAIRequest(messages);

      // Save insights to database (graceful failure)
      await this.saveAIInsight(userId, 'learning_analysis', insights);

      return {
        type: 'learning_insights',
        content: insights, // ✅ Already a string, safe to use
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      console.error('❌ Error generating learning insights:', error);
      return {
        type: 'learning_insights',
        content: 'I\'m having trouble analyzing your progress right now, but I can see you\'re making great progress with your vocabulary learning! Keep up the excellent work and come back later for detailed insights.',
        error: true
      };
    }
  }

  // ✅ FIXED: No more .trim() errors
  async generateContextualHint(word, userMistakes = [], difficulty = 'medium') {
    try {
      const mistakeContext = userMistakes.length > 0 
        ? `The student often confuses this with: ${userMistakes.join(', ')}`
        : 'No previous mistakes recorded';

      const prompt = `
Create a helpful, memorable hint for the word "${word.word}" (meaning: ${word.definition}).

CONTEXT:
- Synonym: ${word.synonym}
- Example: "${word.example}"
- Difficulty level: ${difficulty}
- ${mistakeContext}

Create a hint that:
1. Uses a memorable association or mnemonic
2. Connects to the synonym "${word.synonym}"
3. Is encouraging and easy to remember
4. Helps avoid common confusions

Format: Just give the hint in 1-2 sentences, no extra text.
`;

      const messages = [
        {
          role: 'user',
          content: prompt
        }
      ];

      const hint = await this.makeOpenAIRequest(messages);

      return {
        type: 'contextual_hint',
        word: word.word,
        hint: hint, // ✅ Already a string, safe to use
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      console.error('❌ Error generating contextual hint:', error);
      return {
        type: 'contextual_hint',
        word: word.word,
        hint: `Think of "${word.synonym}" - ${word.word} means the same thing but sounds more sophisticated!`,
        error: true
      };
    }
  }

  // ✅ FIXED: Better question parsing
  async generatePracticeQuestions(words, userProfile, difficulty = 'medium') {
    try {
      const wordsText = words.map(w => 
        `${w.word} (${w.synonym}) - ${w.definition}`
      ).join('\n');

      const prompt = `
Create 3 engaging practice questions for these vocabulary words. Adapt difficulty to ${difficulty} level.

WORDS:
${wordsText}

USER PROFILE:
- Accuracy: ${Math.round((userProfile.averageAccuracy || 0.7) * 100)}%
- Level: ${userProfile.current_level || 1}

Create questions that:
1. Test true understanding, not just memorization
2. Use different question types (multiple choice, fill-in-blank, context)
3. Are appropriately challenging for their level

Format each question as:
Q1: [question]
A) [option] B) [option] C) [option] D) [option]
Correct: [letter]
`;

      const messages = [
        {
          role: 'user',
          content: prompt
        }
      ];

      const questionsText = await this.makeOpenAIRequest(messages);

      return {
        type: 'practice_questions',
        questions: this.parsePracticeQuestions(questionsText),
        rawContent: questionsText,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      console.error('❌ Error generating practice questions:', error);
      return {
        type: 'practice_questions',
        questions: [],
        error: true
      };
    }
  }

  // ✅ FIXED: Better error handling
  parsePracticeQuestions(rawText) {
    try {
      // Ensure rawText is a string
      if (typeof rawText !== 'string') {
        console.error('parsePracticeQuestions received non-string:', typeof rawText);
        return [];
      }

      const questions = [];
      const sections = rawText.split(/Q\d+:/).filter(section => section.trim());

      sections.forEach((section, index) => {
        const lines = section.trim().split('\n').filter(line => line.trim());
        if (lines.length > 0) {
          questions.push({
            id: index + 1,
            question: lines[0].trim(),
            content: section.trim(),
            type: section.includes('A)') ? 'multiple_choice' : 
                  section.includes('_____') ? 'fill_blank' : 'context'
          });
        }
      });

      return questions;
    } catch (error) {
      console.error('❌ Error parsing questions:', error);
      return [];
    }
  }

  // ✅ FIXED: No more .trim() errors
  async generateMotivationalMessage(userId, recentProgress) {
    try {
      const context = recentProgress.achieved || 'continuing your learning journey';
      const streak = recentProgress.streak || 0;
      
      const prompt = `
Create an encouraging, personalized message for a vocabulary learner.

RECENT ACHIEVEMENT: ${context}
CURRENT STREAK: ${streak} days
PROGRESS: ${recentProgress.summary || 'Making steady progress'}

Create a motivational message that:
1. Celebrates their specific achievement
2. Encourages consistency
3. Is warm and supportive
4. Is 1-2 sentences only
`;

      const messages = [
        {
          role: 'user',
          content: prompt
        }
      ];

      const message = await this.makeOpenAIRequest(messages);

      return {
        type: 'motivation',
        content: message, // ✅ Already a string, safe to use
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      console.error('❌ Error generating motivational message:', error);
      return {
        type: 'motivation',
        content: 'Great job on your vocabulary journey! Every word you learn makes you a more effective communicator. Keep it up! 🌟',
        error: true
      };
    }
  }

  // Helper methods
  async getUserLearningProfile(userId) {
    try {
      const { data, error } = await supabase
        .from('user_progress')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (error) {
        console.error('Error fetching user profile:', error);
        return {};
      }

      return data || {};
    } catch (error) {
      console.error('Error fetching user profile:', error);
      return {};
    }
  }

  async saveAIInsight(userId, type, content) {
    try {
      await supabase
        .from('ai_insights')
        .upsert({
          user_id: userId,
          insight_type: type,
          content: content,
          created_at: new Date().toISOString()
        });
    } catch (error) {
      // Fail silently - table might not exist yet
      console.log('AI insights table not available');
    }
  }
}

// Export singleton instance
export const vocabAI = new VocabAIAssistant();