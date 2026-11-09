import React from 'react';
import ScreenGuide from './ScreenGuide';

const guides = {
  landing: ['Start with VocabVoyager', ['Sign in or create an account to open your learning dashboard.', 'Pick a learning session, then try recalling each meaning before revealing it.']],
  dashboard: ['Build your vocabulary', ['Start a learning session to discover words and save the ones you want to revisit.', 'Open Review to practise saved words, or try the AI Learning Assistant for another way to use them.']],
  review: ['Review your words', ['Try recalling the answer before choosing or revealing it.', 'Finish the session to see your results.']],
  ihni: ['Revisit saved words', ['Use this list to revisit words you marked as unfamiliar.', 'Return to the dashboard to start a practice session.']],
  friends: ['Find your friends', ['Use Friends to manage invitations and connections.', 'Open the leaderboard to compare learning progress.']],
  leaderboard: ['Read the leaderboard', ['Use the leaderboard to see where you stand.', 'Return to the dashboard to start another learning session.']],
  pricing: ['Compare plans', ['Read what each plan includes before you decide.', 'Use the upgrade button only when ready to proceed.']],
};

export default function VocabScreenGuide({ screen }) {
  const guide = guides[screen];
  return guide ? <ScreenGuide key={screen} title={guide[0]} steps={guide[1]}/> : null;
}
