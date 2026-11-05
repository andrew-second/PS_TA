// These tests send real HTTP requests to the app, running on a random free port.
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import type { DatabaseSync } from 'node:sqlite';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from './app.js';
import { openDatabase, STAGES } from './db.js';
import type { Summarize, SummaryResult } from './summarizer/index.js';

const jane = {
  name: 'Jane Doe',
  email: 'jane@example.com',
  role: 'Backend Engineer',
  resume_text: 'Five years of Node.js.',
};

let db: DatabaseSync;
let server: Server;
let baseUrl: string;

beforeEach(async () => {
  db = openDatabase(':memory:');
  // Port 0 asks the operating system for any free port. We wait until the server is listening.
  await new Promise<void>((resolve) => {
    server = createApp(db).listen(0, () => resolve());
  });
  baseUrl = `http://localhost:${(server.address() as AddressInfo).port}`;
});

afterEach(async () => {
  server.closeAllConnections();
  await new Promise((resolve) => server.close(resolve));
  db.close();
});

function send(method: string, path: string, body?: unknown) {
  return fetch(`${baseUrl}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

async function addCandidate(overrides: Partial<typeof jane> = {}) {
  const res = await send('POST', '/api/candidates', { ...jane, ...overrides });
  return (await res.json()) as { id: number; name: string };
}

async function listNames(query = '') {
  const res = await send('GET', `/api/candidates${query}`);
  const list = (await res.json()) as { name: string }[];
  return list.map((candidate) => candidate.name);
}

describe('adding a candidate', () => {
  it('saves valid input and starts the candidate at Applied', async () => {
    const res = await send('POST', '/api/candidates', jane);

    expect(res.status).toBe(201);
    expect(await res.json()).toMatchObject({ ...jane, stage: 'Applied', phone: null });
  });

  it('stores blank optional fields as no value', async () => {
    const res = await send('POST', '/api/candidates', { ...jane, phone: '', source: '  ' });

    expect(await res.json()).toMatchObject({ phone: null, source: null });
  });

  it('trims stray spaces from a pasted email', async () => {
    const res = await send('POST', '/api/candidates', { ...jane, email: ' jane@example.com ' });

    expect(res.status).toBe(201);
    expect(await res.json()).toMatchObject({ email: 'jane@example.com' });
  });

  it.each([
    ['a missing name', { ...jane, name: undefined }, 'name'],
    ['a blank name', { ...jane, name: '   ' }, 'name'],
    ['an invalid email', { ...jane, email: 'not-an-email' }, 'email'],
    ['a missing role', { ...jane, role: undefined }, 'role'],
    ['a blank resume', { ...jane, resume_text: '  ' }, 'resume_text'],
  ])('rejects %s and saves nothing', async (_label, body, field) => {
    const res = await send('POST', '/api/candidates', body);
    const result = (await res.json()) as { details: { fieldErrors: Record<string, unknown> } };

    expect(res.status).toBe(400);
    expect(result.details.fieldErrors).toHaveProperty(field);
    expect(await listNames()).toEqual([]);
  });

  it('answers malformed JSON with a JSON error, not an HTML page', async () => {
    const res = await fetch(`${baseUrl}/api/candidates`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{ not json',
    });

    expect(res.status).toBe(400);
    expect(res.headers.get('content-type')).toContain('application/json');
  });
});

describe('listing candidates', () => {
  beforeEach(async () => {
    const ann = await addCandidate({ name: 'Ann', role: 'Backend Engineer' });
    const bob = await addCandidate({ name: 'Bob', role: 'Frontend Engineer' });
    const cat = await addCandidate({ name: 'Cat', role: 'Data Analyst' });
    const dan = await addCandidate({ name: 'Dan', role: 'Data Engineer' });
    const eve = await addCandidate({ name: 'Eve', role: 'Designer' });

    await send('PATCH', `/api/candidates/${ann.id}/stage`, { stage: 'Rejected' });
    await send('PATCH', `/api/candidates/${bob.id}/stage`, { stage: 'Screening' });
    await send('PATCH', `/api/candidates/${cat.id}/stage`, { stage: 'Offer' });
    await send('PATCH', `/api/candidates/${dan.id}/stage`, { stage: 'Interview' });
    await send('PATCH', `/api/candidates/${eve.id}/stage`, { stage: 'Applied' });
  });

  it('sorts newest first by default', async () => {
    expect(await listNames()).toEqual(['Eve', 'Dan', 'Cat', 'Bob', 'Ann']);
  });

  it('sorts by stage in pipeline order, not alphabetically', async () => {
    expect(await listNames('?sort=stage')).toEqual(['Eve', 'Bob', 'Dan', 'Cat', 'Ann']);
  });

  it('filters by stage', async () => {
    expect(await listNames('?stage=Offer')).toEqual(['Cat']);
  });

  it('filters by role, ignoring case and matching part of the role', async () => {
    expect(await listNames('?role=ENGINEER')).toEqual(['Dan', 'Bob', 'Ann']);
  });

  it('treats % in a role search as a normal character', async () => {
    expect(await listNames('?role=%25')).toEqual([]);
  });

  it('combines stage and role filters', async () => {
    expect(await listNames('?stage=Interview&role=data')).toEqual(['Dan']);
  });

  it.each(['?stage=Hired', '?sort=name'])('rejects the invalid query %s', async (query) => {
    const res = await send('GET', `/api/candidates${query}`);

    expect(res.status).toBe(400);
  });

  it('leaves resume text out of the list', async () => {
    const res = await send('GET', '/api/candidates');
    const [first] = (await res.json()) as object[];

    expect(first).not.toHaveProperty('resume_text');
  });
});

describe('a single candidate', () => {
  it('returns the profile with notes, oldest first', async () => {
    const { id } = await addCandidate();
    await send('POST', `/api/candidates/${id}/notes`, { body: 'First' });
    await send('POST', `/api/candidates/${id}/notes`, { body: 'Second' });

    const res = await send('GET', `/api/candidates/${id}`);
    const candidate = (await res.json()) as { name: string; notes: { body: string }[] };

    expect(candidate.name).toBe('Jane Doe');
    expect(candidate.notes.map((note) => note.body)).toEqual(['First', 'Second']);
  });

  it('can move to any stage, in any order', async () => {
    const { id } = await addCandidate();

    for (const stage of [...STAGES].reverse()) {
      const res = await send('PATCH', `/api/candidates/${id}/stage`, { stage });
      expect(await res.json()).toMatchObject({ stage });
    }
  });

  it('rejects an unknown stage and leaves the stage unchanged', async () => {
    const { id } = await addCandidate();

    const res = await send('PATCH', `/api/candidates/${id}/stage`, { stage: 'Hired' });
    const current = await send('GET', `/api/candidates/${id}`);

    expect(res.status).toBe(400);
    expect(await current.json()).toMatchObject({ stage: 'Applied' });
  });

  it('rejects a blank note', async () => {
    const { id } = await addCandidate();

    const res = await send('POST', `/api/candidates/${id}/notes`, { body: '   ' });

    expect(res.status).toBe(400);
  });
});

describe('archiving', () => {
  it('hides the candidate from the list but keeps the row', async () => {
    const { id } = await addCandidate();

    const res = await send('DELETE', `/api/candidates/${id}`);

    expect(res.status).toBe(204);
    expect(await listNames()).toEqual([]);
    const row = db.prepare('SELECT archived_at FROM candidates WHERE id = ?').get(id) as {
      archived_at: string | null;
    };
    expect(row.archived_at).not.toBeNull();
  });
});

describe('ids that find no candidate', () => {
  const routes = (id: string | number): [string, string, unknown?][] => [
    ['GET', `/api/candidates/${id}`],
    ['PATCH', `/api/candidates/${id}/stage`, { stage: 'Offer' }],
    ['POST', `/api/candidates/${id}/notes`, { body: 'A note' }],
    ['DELETE', `/api/candidates/${id}`],
  ];

  it.each([999, 'abc', '1.5'])('return 404 for the unknown id %s', async (id) => {
    for (const [method, path, body] of routes(id)) {
      const res = await send(method, path, body);
      expect(res.status, `${method} ${path}`).toBe(404);
    }
  });

  it('return 404 for an archived candidate', async () => {
    const { id } = await addCandidate();
    await send('DELETE', `/api/candidates/${id}`);

    for (const [method, path, body] of routes(id)) {
      const res = await send(method, path, body);
      expect(res.status, `${method} ${path}`).toBe(404);
    }
  });
});

describe('summaries', () => {
  const result = (overrides: Partial<SummaryResult>): SummaryResult => ({
    status: 'ok',
    skills: ['Node.js'],
    highlights: ['Five years at Acme'],
    suspicious_content: false,
    error: null,
    model: 'test-model',
    prompt_version: 'test',
    ...overrides,
  });

  // Starts a second copy of the app, whose summarizer returns the given results in turn.
  async function withSummarizer(results: SummaryResult[], run: (url: string) => Promise<void>) {
    const fake: Summarize = async () => results.shift()!;
    const summaryServer = await new Promise<Server>((resolve) => {
      const started = createApp(db, fake).listen(0, () => resolve(started));
    });
    try {
      await run(`http://localhost:${(summaryServer.address() as AddressInfo).port}`);
    } finally {
      summaryServer.closeAllConnections();
      summaryServer.close();
    }
  }

  async function detail(id: number) {
    const res = await send('GET', `/api/candidates/${id}`);
    return (await res.json()) as {
      summary: { skills: string[]; suspicious_content: boolean; status: string } | null;
      summary_problem: { status: string; error: string | null } | null;
    };
  }

  it('starts with no summary', async () => {
    const { id } = await addCandidate();

    expect(await detail(id)).toMatchObject({ summary: null, summary_problem: null });
  });

  it('saves a good summary, restoring its lists and flag', async () => {
    const { id } = await addCandidate();

    await withSummarizer([result({ suspicious_content: true })], async (url) => {
      const res = await fetch(`${url}/api/candidates/${id}/summary`, { method: 'POST' });
      expect(res.status).toBe(200);
    });

    expect(await detail(id)).toMatchObject({
      summary: { status: 'ok', skills: ['Node.js'], suspicious_content: true },
      summary_problem: null,
    });
  });

  it('keeps showing the good summary when a regenerate fails, and reports the failure', async () => {
    const { id } = await addCandidate();
    const attempts = [result({}), result({ status: 'failed', error: 'timeout', skills: [] })];

    await withSummarizer(attempts, async (url) => {
      await fetch(`${url}/api/candidates/${id}/summary`, { method: 'POST' });
      await fetch(`${url}/api/candidates/${id}/summary`, { method: 'POST' });
    });

    expect(await detail(id)).toMatchObject({
      summary: { status: 'ok', skills: ['Node.js'] },
      summary_problem: { status: 'failed', error: 'timeout' },
    });
  });

  it('clears the problem once a later attempt succeeds', async () => {
    const { id } = await addCandidate();
    const attempts = [result({ status: 'failed', error: 'timeout', skills: [] }), result({})];

    await withSummarizer(attempts, async (url) => {
      await fetch(`${url}/api/candidates/${id}/summary`, { method: 'POST' });
      await fetch(`${url}/api/candidates/${id}/summary`, { method: 'POST' });
    });

    expect(await detail(id)).toMatchObject({ summary: { status: 'ok' }, summary_problem: null });
  });

  it('never presents an insufficient result as a summary', async () => {
    const { id } = await addCandidate();

    await withSummarizer([result({ status: 'insufficient', skills: [] })], async (url) => {
      await fetch(`${url}/api/candidates/${id}/summary`, { method: 'POST' });
    });

    expect(await detail(id)).toMatchObject({
      summary: null,
      summary_problem: { status: 'insufficient' },
    });
  });

  it('returns 404 for an unknown or archived candidate, without calling the summarizer', async () => {
    const { id } = await addCandidate();
    await send('DELETE', `/api/candidates/${id}`);
    let calls = 0;
    const counting: Summarize = async () => {
      calls += 1;
      return result({});
    };
    const countingServer = await new Promise<Server>((resolve) => {
      const started = createApp(db, counting).listen(0, () => resolve(started));
    });
    const url = `http://localhost:${(countingServer.address() as AddressInfo).port}`;

    const statuses = await Promise.all(
      [id, 999, 'abc'].map(async (target) => {
        const res = await fetch(`${url}/api/candidates/${target}/summary`, { method: 'POST' });
        return res.status;
      }),
    );
    countingServer.closeAllConnections();
    countingServer.close();

    expect(statuses).toEqual([404, 404, 404]);
    expect(calls).toBe(0);
  });
});

it('answers an unknown API route with a JSON 404', async () => {
  const res = await send('GET', '/api/nope');

  expect(res.status).toBe(404);
  expect(res.headers.get('content-type')).toContain('application/json');
});
