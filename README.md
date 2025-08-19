# 📚 VocabVoyager

> Master 3 powerful words every day with science-backed spaced repetition learning

[![License: All Rights Reserved](https://img.shields.io/badge/License-All%20Rights%20Reserved-red.svg)](LICENSE)
[![React](https://img.shields.io/badge/React-18.2.0-blue.svg)](https://reactjs.org/)
[![Supabase](https://img.shields.io/badge/Supabase-2.53.0-green.svg)](https://supabase.com/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4.1.11-38B2AC.svg)](https://tailwindcss.com/)

## 🎯 **What is VocabVoyager?**

VocabVoyager is a revolutionary vocabulary learning app that uses **science-backed spaced repetition** to help you master advanced English vocabulary. Unlike traditional flashcard apps, we use a unique **two-step learning approach**:

1. **Simple Synonyms First** - Learn with easy-to-remember one-word synonyms
2. **Rich Context Later** - Dive deep into definitions, examples, and contextual usage

### ✨ **Key Features**

- 📅 **Daily 3-Word Sessions** - Bite-sized learning that fits your schedule
- 🧠 **Spaced Repetition Algorithm** - Scientifically optimized review intervals
- 🔥 **Streak Tracking** - Build consistent learning habits
- 📊 **Progress Analytics** - Track your vocabulary growth over time
- 🎓 **5 Difficulty Levels** - From basic to advanced (450+ words total)
- 💎 **Freemium Model** - Start free, upgrade for advanced features

## 🚀 **Live Demo** [https://vocab-voyager.vercel.app/]

**📱 Mobile App:** Coming Q2 2025

## 🛠️ **Tech Stack**

| Frontend | Backend | Database | Deployment |
|----------|---------|----------|------------|
| React 18 | Supabase | PostgreSQL | Vercel |
| Tailwind CSS | Supabase Auth | Row Level Security | GitHub Actions |
| Lucide Icons | Supabase Realtime | Supabase Storage | - |

## 📋 **Prerequisites**

- **Node.js** 16.0 or higher
- **npm** or **yarn**
- **Supabase account** (free tier available)

## ⚡ **Quick Start**

### 1. Clone the Repository
```bash
git clone https://github.com/teddexter0/vocabVoyager.git
cd vocabVoyager
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Environment Setup
Create `.env.local` in the root directory:
```env
REACT_APP_SUPABASE_URL=your_supabase_project_url
REACT_APP_SUPABASE_ANON_KEY=your_supabase_anon_key
REACT_APP_SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
```

### 4. Database Setup
1. Create a new Supabase project
2. Run the SQL commands from `database/schema.sql`
3. Import sample words: `npm run import-words`

### 5. Start Development Server
```bash
npm start
```

Open [http://localhost:3000](http://localhost:3000) to view the app.

## 📊 **Database Schema**

```sql
-- Core tables
words (id, word, synonym, definition, example, context, level, difficulty)
user_progress (user_id, streak, words_learned, current_level, is_premium)
daily_sessions (user_id, session_date, words_shown, completed)
user_word_progress (user_id, word_id, mastery_level, next_review)
```

## 🎮 **How It Works**

### Learning Flow
1. **Sign Up** → Create your account
2. **Daily Session** → Get 3 curated words based on your level
3. **Guess First** → Try to understand words using simple synonyms
4. **Learn Deep** → Reveal definitions, examples, and context
5. **Spaced Repetition** → Words reappear based on your mastery level

### Progression System
- **Level 1:** Basic words (Difficulty 4-6) - FREE
- **Level 2:** Intermediate words (Difficulty 6-7) - PREMIUM
- **Level 3:** Advanced words (Difficulty 7-8) - PREMIUM
- **Level 4:** Expert words (Difficulty 8-9) - PREMIUM
- **Level 5:** Master words (Difficulty 9-10) - PREMIUM

## 💰 **Business Model**

| Plan | Price | Features |
|------|-------|----------|
| **Free** | $0 | Level 1, Basic tracking, 3 words/day |
| **Premium** | $4.99/mo | All 5 levels, Advanced analytics, Spaced repetition |

## 🔒 **Security & Privacy**

- **Authentication:** Supabase Auth with JWT tokens
- **Database:** Row Level Security (RLS) policies
- **Privacy:** No tracking, minimal data collection
- **GDPR Compliant:** Data export/deletion available

## 📱 **Mobile App Roadmap**

- **Q1 2025:** Web app launch
- **Q2 2025:** React Native iOS/Android app
- **Q3 2025:** Push notifications & offline mode
- **Q4 2025:** Advanced personalization features

## 🤝 **Contributing**

This is a **proprietary project**. Contributions are not accepted.

For bug reports or feature requests, please contact: [support@vocabvoyager.com]

## 📄 **License**

**All Rights Reserved** © 2025 VocabVoyager

This software and its source code are proprietary and confidential. Unauthorized copying, distribution, or use is strictly prohibited.

## 📞 **Contact & Support**

- **Website:** [Coming Soon]
- **Email:** support@vocabvoyager.com
- **Twitter:** @VocabVoyager

---

**Built with 🧠 for language learners worldwide**

*Master vocabulary, expand your mind, transform your communication. Or if you just find it cool saying these words!*
