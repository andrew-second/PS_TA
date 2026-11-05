// Sends the sample resumes to the real model and prints the results, for a person to read.
// The automated tests fake the model, so this is the only check of how it really behaves.
// Run with: npm run check:summary (needs an API key, and uses 10 of the free daily requests)
import { SEED_CANDIDATES } from '../seedData.js';
import { summarize } from './index.js';

for (const { name, purpose, resume_text } of SEED_CANDIDATES) {
  const result = await summarize(resume_text);
  console.log(`\n=== ${name}: ${purpose} ===`);
  console.log(JSON.stringify(result, null, 2));

  // Further calls would only be rejected too, so stop rather than use up more of the limit.
  if (result.error === 'rate_limited') {
    console.log('\nStopped early: the service is busy or the usage limit has been reached.');
    break;
  }
}
