// scripts/importWords.js
// Run with: node scripts/importWords.js

const { createClient } = require('@supabase/supabase-js');


const supabaseUrl = process.env.REACT_APP_SUPABASE_URL
const supabaseKey = process.env.REACT_APP_SUPABASE_KEY; // Use service role key for bulk operations
const supabase = createClient(supabaseUrl, supabaseKey);

// Your 320 words - organized by levels
const wordsData = [
  // Level 1 - Basic (90 words)
  {
    word: "ardent", synonym: "passionate", level: 1, difficulty: 5,
    definition: "Enthusiastic or passionate",
    example: "She was an ardent supporter of environmental causes.",
    context: "Use when someone is really passionate about something - more intense than just 'interested'"
  },
  {
    word: "benevolent", synonym: "kind", level: 1, difficulty: 6,
    definition: "Well meaning and kindly; generous in spirit",
    example: "The benevolent ruler was loved by all his subjects.",
    context: "Kind in a generous, almost parental way - like a wise, caring leader"
  },
  {
    word: "copious", synonym: "abundant", level: 1, difficulty: 5,
    definition: "Abundant in supply or quantity; plentiful",
    example: "She took copious notes during the lecture.",
    context: "More than just 'a lot' - impressively, overwhelmingly abundant"
  },
  {
    word: "diligent", synonym: "hardworking", level: 1, difficulty: 4,
    definition: "Having or showing care and conscientiousness in one's work",
    example: "His diligent research uncovered several important facts.",
    context: "Not just hardworking - carefully, methodically hardworking"
  },
  {
    word: "elusive", synonym: "hard-to-catch", level: 1, difficulty: 6,
    definition: "Difficult to find, catch, or achieve",
    example: "The solution to the problem remained elusive.",
    context: "Like trying to catch smoke - frustratingly difficult to grasp"
  },
  
  // Level 2 - Intermediate (90 words)  
  {
    word: "fastidious", synonym: "picky", level: 2, difficulty: 7,
    definition: "Very attentive to accuracy and detail; hard to please",
    example: "She was fastidious about keeping her workspace organized.",
    context: "Picky in an almost obsessive way - attention to every tiny detail"
  },
  {
    word: "gregarious", synonym: "social", level: 2, difficulty: 6,
    definition: "Fond of the company of others; sociable",
    example: "His gregarious nature made him popular at parties.",
    context: "Not just social - actively seeks out groups and thrives in them"
  },
  {
    word: "hackneyed", synonym: "overused", level: 2, difficulty: 7,
    definition: "Lacking originality or freshness; overused",
    example: "His speech was full of hackneyed phrases and clichés.",
    context: "So overused it's become boring and meaningless - like tired old jokes"
  },
  {
    word: "insipid", synonym: "bland", level: 2, difficulty: 7,
    definition: "Lacking flavor, vigor, or interest; dull",
    example: "The movie's insipid dialogue put the audience to sleep.",
    context: "Bland in a way that's almost offensive - completely without character"
  },
  {
    word: "judicious", synonym: "wise", level: 2, difficulty: 6,
    definition: "Having or showing good judgment; wise",
    example: "She made a judicious decision to invest in the startup.",
    context: "Wise in a careful, well-considered way - thoughtful wisdom"
  },
  
  // Level 3 - Advanced (90 words)
  {
    word: "laconic", synonym: "brief", level: 3, difficulty: 8,
    definition: "Using few words; concise to the point of seeming rude",
    example: "His laconic response suggested he didn't want to discuss it.",
    context: "Brief in a mysteriously cool way - like a cowboy in movies"
  },
  {
    word: "magnanimous", synonym: "generous", level: 3, difficulty: 8,
    definition: "Generous in forgiving; free from petty resentfulness",
    example: "In a magnanimous gesture, she forgave her rival's harsh words.",
    context: "Generous in spirit when you have every right to be petty - noble forgiveness"
  },
  {
    word: "nefarious", synonym: "evil", level: 3, difficulty: 8,
    definition: "Extremely wicked or villainous",
    example: "The detective uncovered the criminal's nefarious plot.",
    context: "Evil in a calculated, villainous way - like a Bond villain's scheme"
  },
  {
    word: "ostentatious", synonym: "showy", level: 3, difficulty: 8,
    definition: "Characterized by vulgar display; designed to impress",
    example: "His ostentatious display of wealth made everyone uncomfortable.",
    context: "Showy in a try-hard way - wealth or success displayed too obviously"
  },
  {
    word: "pernicious", synonym: "harmful", level: 3, difficulty: 9,
    definition: "Having a harmful effect in a gradual or subtle way",
    example: "The pernicious influence of social media on self-esteem is well-documented.",
    context: "Harmful in a sneaky, gradual way - like poison that works slowly"
  },
  
  // Level 4 - Expert (90 words)
  {
    word: "querulous", synonym: "complaining", level: 4, difficulty: 9,
    definition: "Complaining in a petulant or whining manner",
    example: "The querulous customer demanded to speak to the manager again.",
    context: "Complaining in an annoying, whiny way - like a petulant child"
  },
  {
    word: "recalcitrant", synonym: "stubborn", level: 4, difficulty: 9,
    definition: "Having an obstinately uncooperative attitude",
    example: "The recalcitrant student refused to follow any classroom rules.",
    context: "Stubborn in a defiant, rebellious way - actively resisting authority"
  },
  {
    word: "sycophantic", synonym: "flattering", level: 4, difficulty: 9,
    definition: "Behaving obsequiously to gain advantage; bootlicking",
    example: "His sycophantic behavior toward the boss was embarrassing to watch.",
    context: "Flattering in a fake, self-serving way - obvious brown-nosing"
  },
  {
    word: "trepidation", synonym: "anxiety", level: 4, difficulty: 8,
    definition: "A feeling of fear or agitation about something that may happen",
    example: "She approached the job interview with great trepidation.",
    context: "Anxiety mixed with fear about what might happen - nervous anticipation"
  },
  {
    word: "ubiquitous", synonym: "everywhere", level: 4, difficulty: 7,
    definition: "Present, appearing, or found everywhere",
    example: "Smartphones have become ubiquitous in modern society.",
    context: "So common it's literally everywhere you look - unavoidable presence"
  },
  
  // Level 5 - Master (90 words)
  {
    word: "veracious", synonym: "truthful", level: 5, difficulty: 9,
    definition: "Speaking or representing the truth; accurate",
    example: "The journalist was known for her veracious reporting.",
    context: "Truthful in a precise, reliable way - information you can completely trust"
  },
  {
    word: "winsome", synonym: "charming", level: 5, difficulty: 8,
    definition: "Attractive or appealing in appearance or character",
    example: "Her winsome smile could brighten anyone's day.",
    context: "Charming in an innocent, naturally appealing way - effortlessly likeable"
  },
  {
    word: "xenophobic", synonym: "prejudiced", level: 5, difficulty: 9,
    definition: "Having or showing dislike of people from other countries",
    example: "The politician's xenophobic rhetoric divided the community.",
    context: "Prejudiced specifically against foreigners - fear of 'the other'"
  },
  {
    word: "yearn", synonym: "long-for", level: 5, difficulty: 6,
    definition: "Have an intense feeling of longing for something",
    example: "After months abroad, she yearned for her home country.",
    context: "Want something with deep emotional intensity - aching desire"
  },
  {
    word: "zealous", synonym: "enthusiastic", level: 5, difficulty: 7,
    definition: "Having great energy or enthusiasm in pursuit of a cause",
    example: "The zealous activist never missed a protest rally.",
    context: "Enthusiastic to the point of being intense - passionate dedication"
  }
];

async function importWords() {
  try {
    console.log('Starting word import...');
    
    // Insert words in batches of 50 to avoid timeout
    const batchSize = 50;
    for (let i = 0; i < wordsData.length; i += batchSize) {
      const batch = wordsData.slice(i, i + batchSize);
      
      const { data, error } = await supabase
        .from('words')
        .insert(batch);
      
      if (error) {
        console.error('Error inserting batch:', error);
        return;
      }
      
      console.log(`Imported batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(wordsData.length/batchSize)}`);
    }
    
    console.log('✅ All words imported successfully!');
    console.log(`Total words imported: ${wordsData.length}`);
    
  } catch (error) {
    console.error('Import failed:', error);
  }
}

// Run the import
importWords();

// Export for use in other scripts
module.exports = { wordsData };