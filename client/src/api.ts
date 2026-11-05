// Every call to the server lives here, so components never deal with URLs or fetch directly.

export const STAGES = ['Applied', 'Screening', 'Interview', 'Offer', 'Rejected'] as const;
export type Stage = (typeof STAGES)[number];
export type Sort = 'date' | 'stage';

export type CandidateListItem = {
  id: number;
  name: string;
  email: string;
  role: string;
  stage: Stage;
  source: string | null;
  created_at: string;
};

export type Candidate = CandidateListItem & {
  phone: string | null;
  resume_text: string;
};

export type Note = {
  id: number;
  candidate_id: number;
  body: string;
  created_at: string;
};

export type Summary = {
  id: number;
  status: 'ok' | 'insufficient' | 'failed';
  skills: string[];
  highlights: string[];
  suspicious_content: boolean;
  error: string | null;
  model: string | null;
  prompt_version: string;
  created_at: string;
};

export type SummaryState = {
  summary: Summary | null;
  summary_problem: Summary | null;
};

export type CandidateWithNotes = Candidate & SummaryState & { notes: Note[] };

export type NewCandidate = {
  name: string;
  email: string;
  phone: string;
  role: string;
  resume_text: string;
  source: string;
};

export type Filters = {
  stage: Stage | '';
  role: string;
  sort: Sort;
};

// Carries the server's message, plus which fields were invalid when it's a 400.
export class ApiError extends Error {
  fieldErrors: Record<string, string[]>;

  constructor(message: string, fieldErrors: Record<string, string[]> = {}) {
    super(message);
    this.fieldErrors = fieldErrors;
  }
}

async function request<T>(path: string, method = 'GET', body?: unknown): Promise<T> {
  const res = await fetch(`/api${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  // A 204 has no body to read, and an error from outside our API might not be JSON.
  const data = res.status === 204 ? undefined : await res.json().catch(() => undefined);

  if (!res.ok) {
    throw new ApiError(data?.error ?? 'Something went wrong', data?.details?.fieldErrors);
  }
  return data as T;
}

export function listCandidates(filters: Filters) {
  const query = new URLSearchParams({ sort: filters.sort });
  // Only send filters that are in use, because the server rejects an empty stage.
  if (filters.stage) query.set('stage', filters.stage);
  if (filters.role.trim()) query.set('role', filters.role.trim());
  return request<CandidateListItem[]>(`/candidates?${query}`);
}

export function getCandidate(id: number) {
  return request<CandidateWithNotes>(`/candidates/${id}`);
}

export function createCandidate(candidate: NewCandidate) {
  return request<Candidate>('/candidates', 'POST', candidate);
}

export function updateStage(id: number, stage: Stage) {
  return request<Candidate>(`/candidates/${id}/stage`, 'PATCH', { stage });
}

export function addNote(id: number, body: string) {
  return request<Note>(`/candidates/${id}/notes`, 'POST', { body });
}

export function generateSummary(id: number) {
  return request<SummaryState>(`/candidates/${id}/summary`, 'POST');
}

export function archiveCandidate(id: number) {
  return request<void>(`/candidates/${id}`, 'DELETE');
}
