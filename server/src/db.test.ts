import type { DatabaseSync } from 'node:sqlite';
import { beforeEach, describe, expect, it } from 'vitest';
import { addNote, createCandidate, getCandidate, listNotes, openDatabase } from './db.js';

const jane = {
  name: 'Jane Doe',
  email: 'jane@example.com',
  role: 'Backend Engineer',
  resume_text: 'Five years of Node.js.',
};

describe('database', () => {
  let db: DatabaseSync;

  // Each test gets its own empty in-memory database, so tests can't affect each other.
  beforeEach(() => {
    db = openDatabase(':memory:');
  });

  it('saves a candidate and reads it back, filling in the defaults', () => {
    const created = createCandidate(db, jane);

    const found = getCandidate(db, created.id);

    expect(found).toMatchObject(jane);
    expect(found?.stage).toBe('Applied');
    expect(found?.phone).toBeNull();
    expect(found?.archived_at).toBeNull();
    expect(found?.created_at).toMatch(/^\d{4}-\d{2}-\d{2}T.*Z$/);
  });

  it('saves notes and reads them back in the order they were added', () => {
    const candidate = createCandidate(db, jane);

    addNote(db, candidate.id, 'First note');
    addNote(db, candidate.id, 'Second note');

    const bodies = listNotes(db, candidate.id).map((note) => note.body);
    expect(bodies).toEqual(['First note', 'Second note']);
  });

  it('rejects a note for a candidate that does not exist', () => {
    expect(() => addNote(db, 999, 'Orphan note')).toThrow(/FOREIGN KEY/);
  });
});
