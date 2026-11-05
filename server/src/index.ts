// Starts the real server. Everything about how requests are handled lives in app.ts.
import { fileURLToPath } from 'node:url';
import { createApp } from './app.js';
import { openDatabase } from './db.js';

const PORT = 3001;

// Resolved from this file's location, so it's the same file wherever the server is started from.
const DATABASE_PATH = fileURLToPath(new URL('../data.db', import.meta.url));

const app = createApp(openDatabase(DATABASE_PATH));

// Express passes startup errors here, such as the port already being in use.
app.listen(PORT, (error) => {
  if (error) {
    throw error;
  }
  console.log(`Server running at http://localhost:${PORT}`);
});
