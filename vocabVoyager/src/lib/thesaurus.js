// Editorial guidance for distinctions where a bare synonym list can mislead.
export const nuances = {
  angry: ['Feeling strong displeasure', 'Broad, usually negative', 'Variable', 'Neutral register', 'Use when the cause or intensity is unspecified.', 'He was angry about the decision.'],
  furious: ['Extremely angry', 'Negative', 'Very strong', 'Neutral register', 'Overstates a minor annoyance.', 'He was furious about the decision.'],
  irritated: ['Annoyed or bothered', 'Negative', 'Mild to moderate', 'Neutral register', 'Understates rage or moral outrage.', 'He was irritated by the constant interruptions.'],
  indignant: ['Angry at something perceived as unfair', 'Disapproving', 'Moderate to strong', 'Somewhat formal', 'Awkward for an annoyance that involves no perceived wrong.', 'He was indignant about the unfair decision.'],
  resentful: ['Holding on to bitterness over a grievance', 'Negative', 'Often lingering', 'Neutral register', 'Awkward for a brief flash of anger.', 'He was resentful about being passed over again.'],
  confident: ['Sure of your ability or judgment', 'Usually positive', 'Variable', 'Neutral register', 'Does not imply that someone speaks up or makes demands.', 'She sounded confident when she presented the plan.'],
  assertive: ['Direct about your needs or opinions', 'Usually positive', 'Firm', 'Neutral to professional', 'Awkward when you mean private self-belief without outward action.', 'She sounded assertive when she presented the plan.'],
  arrogant: ['Acting as though you are superior to others', 'Negative', 'Strong criticism', 'Neutral register', 'Too harsh for someone who is simply direct or sure of themselves.', 'She sounded arrogant when she presented the plan.'],
  conceited: ['Holding an excessively high opinion of yourself', 'Negative', 'Strong criticism', 'Neutral register', 'Awkward when the criticism is only that someone was forceful.', 'She sounded conceited when she presented the plan.'],
};

export const groups = [['angry', 'furious', 'irritated', 'indignant', 'resentful'], ['confident', 'assertive', 'arrogant', 'conceited']];
export const nuanceFields = ['Core meaning', 'Connotation', 'Intensity', 'Formality', 'When it fits', 'Example'];
export const wordsIn = sentence => Array.from(sentence.matchAll(/[\p{L}]+(?:[’'-][\p{L}]+)*/gu), match => ({ word: match[0], index: match.index }));

export function replacement(sentence, token, alternative) {
  const word = /^\p{Lu}/u.test(token.word) ? alternative[0].toUpperCase() + alternative.slice(1) : alternative;
  return sentence.slice(0, token.index) + word + sentence.slice(token.index + token.word.length);
}

export const wordplay = [
  { title: 'Homophones', clue: 'Which word sounds like “flour”?', choices: ['flower', 'floor', 'flow'], answer: 'flower', why: 'Flower and flour share a pronunciation in many accents, while spelling and meaning differ.' },
  { title: 'Double meaning', clue: '“The calendar’s days are numbered.” What makes it a pun?', choices: ['Two meanings', 'A rhyme', 'A metaphor'], answer: 'Two meanings', why: 'The dates have numbers, while “days are numbered” also means something will end soon.' },
  { title: 'Cultural association', clue: 'What bridges the name Noël and a Christmas punch line?', choices: ['A Christmas association', 'A synonym for snow', 'An identical spelling'], answer: 'A Christmas association', why: 'Noël is the French word for Christmas and is also a given name. A pun can pivot from a person to the holiday.' },
  { title: 'Metaphor', clue: '“Her inbox was a swamp.” What is the image doing?', choices: ['Making a figurative comparison', 'Giving a literal location', 'Playing on two pronunciations'], answer: 'Making a figurative comparison', why: 'The swamp makes a cluttered inbox feel difficult to move through.' },
  { title: 'Near-rhyme', clue: 'Which word nearly rhymes with “home”?', choices: ['alone', 'foam', 'house'], answer: 'alone', why: 'Home and alone share a stressed vowel sound but end in different consonants. Foam is a full rhyme in many accents.' },
];
