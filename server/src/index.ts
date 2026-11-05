import express from 'express';

const app = express();
const PORT = 3001;

// A simple route that lets the React app confirm the server is reachable.
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
