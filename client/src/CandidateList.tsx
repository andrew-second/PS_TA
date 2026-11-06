import { useEffect, useState } from 'react';
import { listCandidates, STAGES } from './api';
import type { CandidateListItem, Filters, Sort, Stage } from './api';

type Props = {
  filters: Filters;
  onFiltersChange: (filters: Filters) => void;
  onSelect: (id: number) => void;
  onAdd: () => void;
};

export default function CandidateList({ filters, onFiltersChange, onSelect, onAdd }: Props) {
  const [candidates, setCandidates] = useState<CandidateListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Reload whenever a filter changes. If another change arrives while a request is running,
  // the cleanup marks the old request as stale, so a slow reply can't overwrite a newer one.
  useEffect(() => {
    let stale = false;
    setLoading(true);
    setError('');
    listCandidates(filters)
      .then((list) => {
        if (!stale) setCandidates(list);
      })
      .catch((err: Error) => {
        if (!stale) setError(err.message);
      })
      .finally(() => {
        if (!stale) setLoading(false);
      });
    return () => {
      stale = true;
    };
  }, [filters]);

  return (
    <section>
      <div className="page-title">
        <h2>Candidates</h2>
        <button className="primary" onClick={onAdd}>
          Add candidate
        </button>
      </div>

      <div className="card filters">
        <label>
          Stage
          <select
            value={filters.stage}
            onChange={(e) => onFiltersChange({ ...filters, stage: e.target.value as Stage | '' })}
          >
            <option value="">All stages</option>
            {STAGES.map((stage) => (
              <option key={stage}>{stage}</option>
            ))}
          </select>
        </label>
        <label>
          Role
          <input
            value={filters.role}
            placeholder="Search roles"
            onChange={(e) => onFiltersChange({ ...filters, role: e.target.value })}
          />
        </label>
        <label>
          Sort by
          <select
            value={filters.sort}
            onChange={(e) => onFiltersChange({ ...filters, sort: e.target.value as Sort })}
          >
            <option value="date">Date added</option>
            <option value="stage">Stage</option>
          </select>
        </label>
      </div>

      {error && <p className="error">{error}</p>}
      {!error && !loading && candidates.length === 0 && (
        <p className="card empty">No candidates found.</p>
      )}

      {!error && candidates.length > 0 && (
        <div className="card table-wrap">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Role</th>
                <th>Stage</th>
                <th>Added</th>
              </tr>
            </thead>
            <tbody>
              {candidates.map((candidate) => (
                <tr key={candidate.id}>
                  <td>
                    <button className="link" onClick={() => onSelect(candidate.id)}>
                      {candidate.name}
                    </button>
                  </td>
                  <td>{candidate.role}</td>
                  <td>
                    <span className={`badge badge-${candidate.stage.toLowerCase()}`}>
                      {candidate.stage}
                    </span>
                  </td>
                  <td>{new Date(candidate.created_at).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
