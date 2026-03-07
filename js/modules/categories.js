// F5 Categories — curated pool with tags and difficulty
// ~120 categories. Tags prevent two from the same domain in one game.
// Difficulty: 1 = easy, 2 = medium, 3 = hard

const CATEGORIES = [
  // Nature
  { name: 'Animals', tag: 'nature', difficulty: 1 },
  { name: 'Birds', tag: 'nature', difficulty: 2 },
  { name: 'Flowers', tag: 'nature', difficulty: 2 },
  { name: 'Trees', tag: 'nature', difficulty: 2 },
  { name: 'Dog Breeds', tag: 'nature', difficulty: 2 },
  { name: 'Fish & Sea Life', tag: 'nature', difficulty: 2 },
  { name: 'Cat Breeds', tag: 'nature', difficulty: 2 },
  { name: 'Insects', tag: 'nature', difficulty: 2 },
  { name: 'Reptiles & Amphibians', tag: 'nature', difficulty: 3 },
  { name: 'Mammals', tag: 'nature', difficulty: 1 },

  // Food & Drink
  { name: 'Fruits', tag: 'food', difficulty: 1 },
  { name: 'Vegetables', tag: 'food', difficulty: 1 },
  { name: 'Spices & Herbs', tag: 'food', difficulty: 2 },
  { name: 'Cheeses', tag: 'food', difficulty: 3 },
  { name: 'Cocktails & Drinks', tag: 'food', difficulty: 2 },
  { name: 'Desserts & Pastries', tag: 'food', difficulty: 2 },
  { name: 'Pasta Types', tag: 'food', difficulty: 3 },
  { name: 'Cuisines', tag: 'food', difficulty: 2 },
  { name: 'Nuts & Seeds', tag: 'food', difficulty: 3 },
  { name: 'Breads', tag: 'food', difficulty: 2 },
  { name: 'Candy & Chocolate', tag: 'food', difficulty: 2 },

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
  { name: 'Capitals', tag: 'geography', difficulty: 2 },
  { name: 'European Countries', tag: 'geography', difficulty: 1 },
  { name: 'African Countries', tag: 'geography', difficulty: 2 },
  { name: 'Asian Countries', tag: 'geography', difficulty: 2 },
  { name: 'Oceans & Seas', tag: 'geography', difficulty: 2 },
  { name: 'Volcanoes', tag: 'geography', difficulty: 3 },
  { name: 'Continents & Regions', tag: 'geography', difficulty: 1 },

  // Entertainment
  { name: 'Movies', tag: 'entertainment', difficulty: 1 },
  { name: 'TV Shows', tag: 'entertainment', difficulty: 1 },
  { name: 'Musical Artists', tag: 'entertainment', difficulty: 1 },
  { name: 'Songs', tag: 'entertainment', difficulty: 2 },
  { name: 'Broadway Musicals', tag: 'entertainment', difficulty: 3 },
  { name: 'Video Games', tag: 'entertainment', difficulty: 2 },
  { name: 'Board Games', tag: 'entertainment', difficulty: 3 },
  { name: 'Cartoon Characters', tag: 'entertainment', difficulty: 2 },
  { name: 'Actors & Actresses', tag: 'entertainment', difficulty: 1 },
  { name: 'Comedians', tag: 'entertainment', difficulty: 2 },
  { name: 'Animated Movies', tag: 'entertainment', difficulty: 2 },
  { name: 'Horror Movies', tag: 'entertainment', difficulty: 2 },
  { name: 'Sitcoms', tag: 'entertainment', difficulty: 2 },
  { name: 'Disney Characters', tag: 'entertainment', difficulty: 1 },
  { name: 'Superhero Characters', tag: 'entertainment', difficulty: 1 },
  { name: 'Movie Directors', tag: 'entertainment', difficulty: 2 },

  // Arts & Letters
  { name: 'Authors', tag: 'arts', difficulty: 2 },
  { name: 'Painters', tag: 'arts', difficulty: 2 },
  { name: 'Novels', tag: 'arts', difficulty: 2 },
  { name: 'Poets', tag: 'arts', difficulty: 3 },
  { name: 'Composers', tag: 'arts', difficulty: 3 },
  { name: 'Philosophers', tag: 'arts', difficulty: 3 },
  { name: 'Dances', tag: 'arts', difficulty: 3 },
  { name: 'Sculptors', tag: 'arts', difficulty: 3 },
  { name: 'Playwrights', tag: 'arts', difficulty: 3 },
  { name: 'Art Movements', tag: 'arts', difficulty: 3 },
  { name: 'Shakespeare Plays', tag: 'arts', difficulty: 3 },

  // History
  { name: 'U.S. Presidents', tag: 'history', difficulty: 2 },
  { name: 'Historical Figures', tag: 'history', difficulty: 2 },
  { name: 'Mythological Figures', tag: 'history', difficulty: 2 },
  { name: 'Ancient Civilizations', tag: 'history', difficulty: 2 },
  { name: 'World Leaders', tag: 'history', difficulty: 2 },
  { name: 'Explorers', tag: 'history', difficulty: 2 },
  { name: 'Famous Battles', tag: 'history', difficulty: 3 },
  { name: 'Royals & Monarchs', tag: 'history', difficulty: 2 },

  // Science
  { name: 'Scientists', tag: 'science', difficulty: 2 },
  { name: 'Chemical Elements', tag: 'science', difficulty: 2 },
  { name: 'Inventions', tag: 'science', difficulty: 2 },
  { name: 'Diseases & Conditions', tag: 'science', difficulty: 3 },
  { name: 'Dinosaurs', tag: 'science', difficulty: 3 },
  { name: 'Body Parts & Organs', tag: 'science', difficulty: 1 },
  { name: 'Minerals & Rocks', tag: 'science', difficulty: 3 },
  { name: 'Planets & Moons', tag: 'science', difficulty: 2 },
  { name: 'Branches of Science', tag: 'science', difficulty: 2 },
  { name: 'Medical Specialties', tag: 'science', difficulty: 3 },

  // Sports
  { name: 'Olympic Sports', tag: 'sports', difficulty: 2 },
  { name: 'Team Sports', tag: 'sports', difficulty: 2 },
  { name: 'Athletes', tag: 'sports', difficulty: 2 },
  { name: 'Sports Teams', tag: 'sports', difficulty: 1 },
  { name: 'Stadiums & Arenas', tag: 'sports', difficulty: 2 },
  { name: 'Martial Arts', tag: 'sports', difficulty: 2 },
  { name: 'Sports Equipment', tag: 'sports', difficulty: 2 },
  { name: 'Famous Coaches', tag: 'sports', difficulty: 3 },
  { name: 'NBA Players', tag: 'sports', difficulty: 2 },
  { name: 'NFL Teams', tag: 'sports', difficulty: 1 },
  { name: 'Soccer Players', tag: 'sports', difficulty: 2 },
  { name: 'Tennis Players', tag: 'sports', difficulty: 2 },

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
  { name: 'Brands', tag: 'things', difficulty: 1 },
  { name: 'Furniture', tag: 'things', difficulty: 1 },
  { name: 'Colors', tag: 'things', difficulty: 1 },
  { name: 'Dances & Dance Styles', tag: 'things', difficulty: 2 },
  { name: 'Holidays & Celebrations', tag: 'things', difficulty: 1 },
  { name: 'Phobias', tag: 'things', difficulty: 3 },
  { name: 'Types of Shoes', tag: 'things', difficulty: 2 },
  { name: 'Toys', tag: 'things', difficulty: 2 },
  { name: 'Programming Languages', tag: 'things', difficulty: 2 },
  { name: 'Magazines', tag: 'things', difficulty: 2 },
  { name: 'Religions', tag: 'things', difficulty: 2 },
  { name: 'College Majors', tag: 'things', difficulty: 2 },
  { name: 'Kitchen Items', tag: 'things', difficulty: 1 },
  { name: 'Transportation', tag: 'things', difficulty: 1 },
  { name: 'Adhesives', tag: 'things', difficulty: 3 },
];

// Letters excluding Q, X, Z for standard mode
const STANDARD_LETTERS = 'ABCDEFGHIJKLMNOPRSTUVWY'.split('');
const EXPERT_LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

export { CATEGORIES, STANDARD_LETTERS, EXPERT_LETTERS };
