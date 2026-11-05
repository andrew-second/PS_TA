import type { DatabaseSync } from 'node:sqlite';
import { beforeEach, describe, expect, it } from 'vitest';
import { createCandidate, listCandidates, listNotes, openDatabase } from './db.js';
import { SEED_CANDIDATES, seedDatabase } from './seedData.js';
import { newCandidateSchema } from './validation.js';

describe('seed data', () => {
  let db: DatabaseSync;

  beforeEach(() => {
    db = openDatabase(':memory:');
  });

  it('adds every candidate with their stage and notes', () => {
    expect(seedDatabase(db)).toEqual({ added: SEED_CANDIDATES.length, skipped: 0 });

    const listed = listCandidates(db, { sort: 'date' });
    expect(listed).toHaveLength(SEED_CANDIDATES.length);

    const mei = listed.find((candidate) => candidate.name === 'Mei Tanaka')!;
    expect(mei.stage).toBe('Offer');
    expect(listNotes(db, mei.id)).toHaveLength(2);
  });

  it('adds nothing the second time', () => {
    seedDatabase(db);

    expect(seedDatabase(db)).toEqual({ added: 0, skipped: SEED_CANDIDATES.length });
    expect(listCandidates(db, { sort: 'date' })).toHaveLength(SEED_CANDIDATES.length);
  });

  it('leaves existing candidates alone', () => {
    const mine = {
      name: 'My Test',
      email: 'mine@example.com',
      role: 'Tester',
      resume_text: 'Text',
    };
    createCandidate(db, mine);

    seedDatabase(db);

    const names = listCandidates(db, { sort: 'date' }).map((candidate) => candidate.name);
    expect(names).toContain('My Test');
    expect(names).toHaveLength(SEED_CANDIDATES.length + 1);
  });

  it('only contains candidates the API itself would accept', () => {
    for (const candidate of SEED_CANDIDATES) {
      expect(newCandidateSchema.safeParse(candidate).success, candidate.name).toBe(true);
    }
  });
});
