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

  // True when the page was opened by adding this candidate, which generates their summary.
  const [justCreated, setJustCreated] = useState(false);

  function showCandidate(id: number, created = false) {
    setAdding(false);
    setJustCreated(created);
    setSelectedId(id);
  }

  return (
    <>
      <header className="app-header">
        <h1>Candidate Tracker</h1>
      </header>
      <main>
        {selectedId !== null ? (
          <CandidateDetail
            id={selectedId}
            generateOnLoad={justCreated}
            onBack={() => setSelectedId(null)}
          />
        ) : adding ? (
          <AddCandidateForm
            onCreated={(id) => showCandidate(id, true)}
            onCancel={() => setAdding(false)}
          />
        ) : (
          <CandidateList
            filters={filters}
            onFiltersChange={setFilters}
            onSelect={(id) => showCandidate(id)}
            onAdd={() => setAdding(true)}
          />
        )}
      </main>
    </>
  );
}
