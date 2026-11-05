import { useEffect, useState } from 'react';

export default function App() {
  const [status, setStatus] = useState('checking...');

  // Ask the Express server whether it's running when the page loads.
  useEffect(() => {
    fetch('/api/health')
      .then((res) => {
        if (!res.ok) throw new Error(`Server responded with ${res.status}`);
        return res.json();
      })
      .then((data) => setStatus(data.status))
      .catch(() => setStatus('unreachable'));
  }, []);

  return (
    <main>
      <h1>Candidate Tracker</h1>
      <p>Server status: {status}</p>
    </main>
  );
}
