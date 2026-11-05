// All SQL lives in this file, so routes call plain functions and never touch the database directly.
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';
import type { SummaryResult } from './summarizer/index.js';

// Resolved from this file's location, so it's the same file wherever the app is started from.
export const DATABASE_PATH = fileURLToPath(new URL('../data.db', import.meta.url));

// Pipeline order. If this changes, also update the CHECK in SCHEMA and ORDER_BY below.
export const STAGES = ['Applied', 'Screening', 'Interview', 'Offer', 'Rejected'] as const;
export type Stage = (typeof STAGES)[number];

export const SORTS = ['date', 'stage'] as const;
export type Sort = (typeof SORTS)[number];

export type Candidate = {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  role: string;
  resume_text: string;
  stage: Stage;
  source: string | null;
  archived_at: string | null;
  created_at: string;
};

// The list view only needs these fields, so it doesn't send every full resume to the browser.
export type CandidateListItem = Pick<
  Candidate,
  'id' | 'name' | 'email' | 'role' | 'stage' | 'source' | 'created_at'
>;

export type CandidateFilters = {
  stage?: Stage;
  role?: string;
  sort: Sort;
};

export type NewCandidate = {
  name: string;
  email: string;
  phone?: string;
  role: string;
  resume_text: string;
  source?: string;
};

export type Note = {
  id: number;
  candidate_id: number;
  body: string;
  created_at: string;
};

export type Summary = SummaryResult & {
  id: number;
  candidate_id: number;
  created_at: string;
};

export type SummaryState = {
  summary: Summary | null;
  summary_problem: Summary | null;
};

// IF NOT EXISTS makes this safe to run on every start: existing tables and data are left alone.
// created_at is filled in by the database as a UTC timestamp, like 2026-11-05T18:30:00.000Z.
const SCHEMA = `
  CREATE TABLE IF NOT EXISTS candidates (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT NOT NULL,
    email       TEXT NOT NULL,
    phone       TEXT,
    role        TEXT NOT NULL,
    resume_text TEXT NOT NULL,
    stage       TEXT NOT NULL DEFAULT 'Applied'
                CHECK (stage IN ('Applied', 'Screening', 'Interview', 'Offer', 'Rejected')),
    source      TEXT,
    archived_at TEXT,
    created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  );

  CREATE TABLE IF NOT EXISTS notes (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    candidate_id INTEGER NOT NULL REFERENCES candidates(id),
    body         TEXT NOT NULL,
    created_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  );

  CREATE TABLE IF NOT EXISTS summaries (
    id                 INTEGER PRIMARY KEY AUTOINCREMENT,
    candidate_id       INTEGER NOT NULL REFERENCES candidates(id),
    status             TEXT NOT NULL CHECK (status IN ('ok', 'insufficient', 'failed')),
    skills             TEXT,
    highlights         TEXT,
    suspicious_content INTEGER NOT NULL DEFAULT 0,
    error              TEXT,
    model              TEXT,
    prompt_version     TEXT,
    created_at         TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  );
`;

// Pass a file path for the real app, or ':memory:' for a temporary database that vanishes when closed.
export function openDatabase(path: string): DatabaseSync {
  const db = new DatabaseSync(path);
  db.exec('PRAGMA foreign_keys = ON');
  db.exec(SCHEMA);
  return db;
}

export function createCandidate(db: DatabaseSync, candidate: NewCandidate): Candidate {
  // The @name placeholders keep values separate from the SQL, which prevents SQL injection.
  const result = db
    .prepare(
      `INSERT INTO candidates (name, email, phone, role, resume_text, source)
       VALUES (@name, @email, @phone, @role, @resume_text, @source)`,
    )
    .run({
      name: candidate.name,
      email: candidate.email,
      phone: candidate.phone ?? null,
      role: candidate.role,
      resume_text: candidate.resume_text,
      source: candidate.source ?? null,
    });

  // Read the row back, so the caller also gets what the database filled in (id, stage, created_at).
  return getCandidate(db, Number(result.lastInsertRowid))!;
}

// An archived candidate counts as not found, so every route that uses this gets that rule for free.
export function getCandidate(db: DatabaseSync, id: number): Candidate | undefined {
  return db
    .prepare('SELECT * FROM candidates WHERE id = ? AND archived_at IS NULL')
    .get(id) as Candidate | undefined;
}

// Includes archived candidates, so seeding doesn't bring back someone who was archived.
export function candidateEmailExists(db: DatabaseSync, email: string): boolean {
  return db.prepare('SELECT 1 FROM candidates WHERE email = ?').get(email) !== undefined;
}

// The user only picks a key here, so their input never becomes part of the SQL text.
const ORDER_BY: Record<Sort, string> = {
  date: 'created_at DESC, id DESC',
  stage: `CASE stage
            WHEN 'Applied' THEN 1
            WHEN 'Screening' THEN 2
            WHEN 'Interview' THEN 3
            WHEN 'Offer' THEN 4
            WHEN 'Rejected' THEN 5
          END, created_at DESC, id DESC`,
};

export function listCandidates(db: DatabaseSync, filters: CandidateFilters): CandidateListItem[] {
  // Start with the rule that always applies, then add one condition per filter in use.
  const conditions = ['archived_at IS NULL'];
  const values: string[] = [];

  if (filters.stage) {
    conditions.push('stage = ?');
    values.push(filters.stage);
  }
  if (filters.role) {
    // Case-insensitive "contains". instr, unlike LIKE, gives % and _ no special meaning.
    conditions.push('instr(lower(role), lower(?)) > 0');
    values.push(filters.role);
  }

  return db
    .prepare(
      `SELECT id, name, email, role, stage, source, created_at
       FROM candidates
       WHERE ${conditions.join(' AND ')}
       ORDER BY ${ORDER_BY[filters.sort]}`,
    )
    .all(...values) as CandidateListItem[];
}

export function updateStage(db: DatabaseSync, id: number, stage: Stage): void {
  db.prepare('UPDATE candidates SET stage = ? WHERE id = ?').run(stage, id);
}

// Soft delete: the row stays in the database, but getCandidate and listCandidates now hide it.
export function archiveCandidate(db: DatabaseSync, id: number): void {
  db.prepare(
    `UPDATE candidates SET archived_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?`,
  ).run(id);
}

export function addNote(db: DatabaseSync, candidateId: number, body: string): Note {
  const result = db
    .prepare('INSERT INTO notes (candidate_id, body) VALUES (?, ?)')
    .run(candidateId, body);

  return db.prepare('SELECT * FROM notes WHERE id = ?').get(Number(result.lastInsertRowid)) as Note;
}

export function listNotes(db: DatabaseSync, candidateId: number): Note[] {
  // Ordering by id as well keeps the order stable if two notes share a timestamp.
  return db
    .prepare('SELECT * FROM notes WHERE candidate_id = ? ORDER BY created_at, id')
    .all(candidateId) as Note[];
}

// Every attempt gets its own row, including failures, so there's a history of what happened.
export function saveSummary(db: DatabaseSync, candidateId: number, result: SummaryResult): void {
  db.prepare(
    `INSERT INTO summaries
       (candidate_id, status, skills, highlights, suspicious_content, error, model, prompt_version)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    candidateId,
    result.status,
    // SQLite has no list type, so lists are stored as JSON text.
    JSON.stringify(result.skills),
    JSON.stringify(result.highlights),
    result.suspicious_content ? 1 : 0,
    result.error,
    result.model,
    result.prompt_version,
  );
}

type SummaryRow = Omit<Summary, 'skills' | 'highlights' | 'suspicious_content'> & {
  skills: string;
  highlights: string;
  suspicious_content: number;
};

// Turns a database row back into the shape the rest of the app uses.
function toSummary(row: SummaryRow): Summary {
  return {
    ...row,
    skills: JSON.parse(row.skills),
    highlights: JSON.parse(row.highlights),
    suspicious_content: row.suspicious_content === 1,
  };
}

// summary: the newest good summary, if any.
// summary_problem: the newest attempt, if it wasn't good. A failed regenerate therefore
// reports the failure while the good summary stays visible.
export function getSummaryState(db: DatabaseSync, candidateId: number): SummaryState {
  const latest = db
    .prepare('SELECT * FROM summaries WHERE candidate_id = ? ORDER BY id DESC LIMIT 1')
    .get(candidateId) as SummaryRow | undefined;
  const latestOk = db
    .prepare(`SELECT * FROM summaries WHERE candidate_id = ? AND status = 'ok' ORDER BY id DESC LIMIT 1`)
    .get(candidateId) as SummaryRow | undefined;

  return {
    summary: latestOk ? toSummary(latestOk) : null,
    summary_problem: latest && latest.status !== 'ok' ? toSummary(latest) : null,
  };
}
