// Run with: npm run seed. Adds the sample candidates to the real database.
import { DATABASE_PATH, openDatabase } from './db.js';
import { seedDatabase } from './seedData.js';

const db = openDatabase(DATABASE_PATH);
const { added, skipped } = seedDatabase(db);
db.close();

console.log(`Added ${added} sample candidates. Skipped ${skipped} already there.`);
