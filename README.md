# 📚 VocabVoyager

> New: a personal vocabulary notebook for the words and whole phrases you hear in media. Capture, look up, and practise when you return.

## Personal vocabulary notebook (October 2026)

The original VocabVoyager homepage remains the default. The links above
"Master Vocabulary with AI" open **My Vocabulary** (`?mode=personal`),
**Intelligent Thesaurus** (`?mode=personal&studio=thesaurus`), and **AAVE Ebon**.
The floating **?** button in My Vocabulary explains the next planned improvement
to source-backed word comparisons. Original learning screens use it for quick
guides. Close either panel with **Got it** or **Esc**.

The personal web mode collects the words and **whole phrases** you actually hear
in shows, films, documentaries, interviews, and conversations. Save the meaning,
register, original line, show/episode, history, and examples together. Original
learning mode is available at the main URL or `?mode=classic`.
The mobile app is unchanged.

- **Capture:** one word or expression per entry, preserving spaces and punctuation.
- **Explore:** free, keyless lookups through the same-origin Vercel endpoint
  `/api/vocabulary-lookup`, which contacts FreeDictionaryAPI.com, DictionaryAPI.dev,
  and Wiktionary on the server to avoid browser CORS failures. Provider failures
  fall back independently; requests have timeouts and bounded responses. Choose
  the meaning that fits your scene. Use Vercel locally to run the API alongside
  the app; CRA's `npm start` alone serves the frontend only.
  Available register, examples, etymology and usage notes keep attribution and
  source/license links. Missing facts are shown as missing.
- **Recall:** up to five due entries when you return, alternating phrase-to-meaning
  and meaning-to-phrase. Try before revealing, self-assess, and say it in a scene.
  A missed card returns once more in the session.
- **Timing:** visits separated by 30 minutes advance the visit counter. Reloads
  and rapid tab switches do not. Returning to an existing tab is detected too.
  Growing visit gaps (1, 2, 4, 7, 12, 20) and day thresholds (1, 3, 7, 14, 30, 60)
  bring words back; either threshold can make an entry due. These are transparent
  practice heuristics, not a validated personalised memory model.
- **Persistence:** Save writes to browser storage immediately, including while a
  lookup is running. No login is required. A failed browser write keeps the draft
  open for retry or download instead of showing a false save confirmation. Late
  login/session changes preserve capture drafts. Guest/account notebooks are separate.
  Search, edit, export/import JSON, undo, and restore removed words. Entries with
  no meaning are saved but excluded from practice. Browser storage can be cleared
  by the browser/device, so export backups of anything important.
- **Account sync:** uses the existing **Supabase** project, not Firebase. Apply
  [personal_vocabulary.sql](vocabVoyager/sql/personal_vocabulary.sql) when setting
  up a database. It adds a separate table with owner-only RLS and explicit grants;
  the legacy word bank is unchanged. Guest words stay separate: after signing in,
  use **Bring my words here** or export/import to copy them into an account.
  Cloud sync status is separate from browser saving. Entry merges keep the latest timestamp, including
  recoverable removal markers. Simultaneous edits use last-write-wins; this is
  not a collaborative editor. The collection toolbar includes manual retry.
  [verify_personal_vocabulary.sql](vocabVoyager/sql/verify_personal_vocabulary.sql)
  checks saving, upserts, removals and account isolation with the authenticated
  database role. It requires an existing account and rolls back all test writes.

### Automatic examples in three situations (optional)

Free dictionaries may have fewer than three examples. The capture form always
provides three editable practice slots, clearly labelled as prompts when empty.
Optional Gemini enrichment generates original examples **with friends, at school
or work, and while telling a story**, labelled as AI practice examples.

On Vercel, set server-only `GEMINI_API_KEY` and `GEMINI_MODEL` for a text model
currently available on Google AI Studio's free tier. Do not prefix them with
`REACT_APP_`. Keep the Google project on the unpaid tier to avoid spend; quotas
and model availability can change. There is no fallback to a paid provider.
The endpoint verifies a Supabase account session, limits input size, applies
timeouts, caches repeated requests in memory, and rate-limits each user per
instance. A larger multi-instance deployment should use a shared rate limiter.
The UI discloses that the phrase, meaning and register go to Google; it does not
send the original quote or show name.

No model is chosen silently. Without those variables, generation is visibly
unavailable; dictionary lookup, capture and recall still work. Popularity is not
inferred from dictionary presence. Research links open Google Trends, usage/history
search and YouGlish. Generated examples never claim to be real show quotations
or verified histories.

### Run and check

```powershell
cd vocabVoyager
npm ci
npm start
# Another terminal:
npm run build
node node_modules/react-scripts/scripts/test.js --watchAll=false --runInBand --cacheDirectory=./node_modules/.cache/jest
```

The notebook opens without environment variables. Copy `.env.example` to
`.env.local` for optional Supabase settings. `npm start` serves the React app;
routes under `api/` need a Vercel runtime for live generation.

Tests cover phrase preservation, visit scheduling, long breaks, bounded recall,
offline capture/reopen, duplicates, account isolation, corrupt storage, cloud
errors, sync loops, source parsing/attribution, and generation authentication.

---

## Original learning mode

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

### 📸 **Screenshots**

- [Login/Signup](assets/screenshot.png)
- [Dashboard](assets/screenshot2.png) 

**📱 Mobile App:** Coming Q4 2027

## 🛠️ **Tech Stack**

| Frontend | Backend | Database | Deployment |
|----------|---------|----------|------------|
| React 18 | Supabase | PostgreSQL | Vercel |
| Tailwind CSS | Supabase Auth | Row Level Security | GitHub Actions |
| Lucide Icons | Supabase Realtime | Supabase Storage | - |
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

## 🤝 **Contributing**

This is a **proprietary project**. Contributions are not accepted.

For bug reports or feature requests, please contact: 
[support@vocabvoyager.com](mailto:teddexter0@gmail.com) 

## 📄 **License**

**All Rights Reserved** &copy; 2025 - VocabVoyager

This software and its source code are proprietary and confidential. Unauthorized copying, distribution, or use is strictly prohibited.

## 📞 **Contact & Support** 
- **Email:** [support@vocabvoyager.com](mailto:teddexter0@gmail.com) 

---

**Built with 🧠 for language learners worldwide**

*Master vocabulary, expand your mind, transform your communication. Or if you just find it cool saying these words!*
