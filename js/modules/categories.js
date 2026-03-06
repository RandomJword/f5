// F5 Categories — curated pool with tags and difficulty
// ~60 categories. Tags prevent two from the same domain in one game.
// Difficulty: 1 = easy, 2 = medium, 3 = hard

const CATEGORIES = [
  // Nature
  { name: 'Animals', tag: 'nature', difficulty: 1 },
  { name: 'Birds', tag: 'nature', difficulty: 2 },
  { name: 'Flowers', tag: 'nature', difficulty: 2 },
  { name: 'Trees', tag: 'nature', difficulty: 2 },
  { name: 'Dog Breeds', tag: 'nature', difficulty: 2 },

  // Food & Drink
  { name: 'Fruits', tag: 'food', difficulty: 1 },
  { name: 'Vegetables', tag: 'food', difficulty: 1 },
  { name: 'Spices & Herbs', tag: 'food', difficulty: 2 },
  { name: 'Cheeses', tag: 'food', difficulty: 3 },
  { name: 'Cocktails & Drinks', tag: 'food', difficulty: 2 },

  // Geography
  { name: 'Countries', tag: 'geography', difficulty: 1 },
  { name: 'World Cities', tag: 'geography', difficulty: 1 },
  { name: 'U.S. States', tag: 'geography', difficulty: 1 },
  { name: 'Rivers', tag: 'geography', difficulty: 2 },
  { name: 'Mountains', tag: 'geography', difficulty: 2 },
  { name: 'Islands', tag: 'geography', difficulty: 2 },
  { name: 'Lakes', tag: 'geography', difficulty: 2 },
  { name: 'Deserts', tag: 'geography', difficulty: 3 },
  { name: 'National Parks', tag: 'geography', difficulty: 2 },
  { name: 'Bodies of Water', tag: 'geography', difficulty: 2 },

  // Entertainment
  { name: 'Movies', tag: 'entertainment', difficulty: 1 },
  { name: 'TV Shows', tag: 'entertainment', difficulty: 1 },
  { name: 'Musical Artists', tag: 'entertainment', difficulty: 1 },
  { name: 'Songs', tag: 'entertainment', difficulty: 2 },
  { name: 'Broadway Musicals', tag: 'entertainment', difficulty: 3 },
  { name: 'Video Games', tag: 'entertainment', difficulty: 2 },
  { name: 'Board Games', tag: 'entertainment', difficulty: 3 },
  { name: 'Cartoon Characters', tag: 'entertainment', difficulty: 2 },

  // Arts & Letters
  { name: 'Authors', tag: 'arts', difficulty: 2 },
  { name: 'Painters', tag: 'arts', difficulty: 2 },
  { name: 'Novels', tag: 'arts', difficulty: 2 },
  { name: 'Poets', tag: 'arts', difficulty: 3 },
  { name: 'Composers', tag: 'arts', difficulty: 3 },
  { name: 'Philosophers', tag: 'arts', difficulty: 3 },
  { name: 'Dances', tag: 'arts', difficulty: 3 },

  // History
  { name: 'U.S. Presidents', tag: 'history', difficulty: 2 },
  { name: 'Historical Figures', tag: 'history', difficulty: 2 },
  { name: 'Wars & Conflicts', tag: 'history', difficulty: 2 },
  { name: 'Mythological Figures', tag: 'history', difficulty: 2 },

  // Science
  { name: 'Scientists', tag: 'science', difficulty: 2 },
  { name: 'Chemical Elements', tag: 'science', difficulty: 2 },
  { name: 'Inventions', tag: 'science', difficulty: 2 },
  { name: 'Diseases & Conditions', tag: 'science', difficulty: 3 },
  { name: 'Dinosaurs', tag: 'science', difficulty: 3 },

  // Sports
  { name: 'Olympic Sports', tag: 'sports', difficulty: 2 },
  { name: 'Team Sports', tag: 'sports', difficulty: 2 },
  { name: 'Athletes', tag: 'sports', difficulty: 2 },

  // Things
  { name: 'Car Brands', tag: 'things', difficulty: 1 },
  { name: 'Clothing Items', tag: 'things', difficulty: 1 },
  { name: 'Musical Instruments', tag: 'things', difficulty: 2 },
  { name: 'Tools', tag: 'things', difficulty: 2 },
  { name: 'Currencies', tag: 'things', difficulty: 3 },
  { name: 'Languages', tag: 'things', difficulty: 2 },
  { name: 'Gemstones', tag: 'things', difficulty: 3 },
  { name: 'Professions', tag: 'things', difficulty: 1 },
  { name: 'Fabrics & Textiles', tag: 'things', difficulty: 3 },
];

// Letters excluding Q, X, Z for standard mode
const STANDARD_LETTERS = 'ABCDEFGHIJKLMNOPRSTUVWY'.split('');
const EXPERT_LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

export { CATEGORIES, STANDARD_LETTERS, EXPERT_LETTERS };
