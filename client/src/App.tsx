import { useState } from 'react';
import AddCandidateForm from './AddCandidateForm';
import CandidateDetail from './CandidateDetail';
import CandidateList from './CandidateList';
import type { Filters } from './api';

export default function App() {
  // These decide which view is showing. No router: a refresh returns to the list.
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [adding, setAdding] = useState(false);

  // Kept here rather than in CandidateList, so filters survive a visit to a candidate's page.
  const [filters, setFilters] = useState<Filters>({ stage: '', role: '', sort: 'date' });

  function showCandidate(id: number) {
    setAdding(false);
    setSelectedId(id);
  }

  return (
    <main>
      <h1>Candidate Tracker</h1>
      {selectedId !== null ? (
        <CandidateDetail id={selectedId} onBack={() => setSelectedId(null)} />
      ) : adding ? (
        <AddCandidateForm onCreated={showCandidate} onCancel={() => setAdding(false)} />
      ) : (
        <CandidateList
          filters={filters}
          onFiltersChange={setFilters}
          onSelect={showCandidate}
          onAdd={() => setAdding(true)}
        />
      )}
    </main>
  );
}
