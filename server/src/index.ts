// Starts the real server. Everything about how requests are handled lives in app.ts.
import { createApp } from './app.js';
import { DATABASE_PATH, openDatabase } from './db.js';

const PORT = 3001;

const app = createApp(openDatabase(DATABASE_PATH));

// Express passes startup errors here, such as the port already being in use.
app.listen(PORT, (error) => {
  if (error) {
    throw error;
  }
  console.log(`Server running at http://localhost:${PORT}`);
});
