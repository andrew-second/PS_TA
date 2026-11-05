// Builds the Express app. It takes the database as an argument so tests can pass in a temporary one.
import type { DatabaseSync } from 'node:sqlite';
import express, { type ErrorRequestHandler, type Response } from 'express';
import { z } from 'zod';
import {
  addNote,
  archiveCandidate,
  createCandidate,
  getCandidate,
  listCandidates,
  listNotes,
  updateStage,
} from './db.js';
import {
  listQuerySchema,
  newCandidateSchema,
  newNoteSchema,
  stageUpdateSchema,
} from './validation.js';

function sendInvalidInput(res: Response, error: z.ZodError): void {
  res.status(400).json({ error: 'Invalid input', details: z.flattenError(error) });
}

function sendNotFound(res: Response): void {
  res.status(404).json({ error: 'Candidate not found' });
}

// Turns the id in the URL into a number. Anything else, like "abc", finds no candidate.
function findCandidate(db: DatabaseSync, id: string) {
  return /^\d+$/.test(id) ? getCandidate(db, Number(id)) : undefined;
}

export function createApp(db: DatabaseSync) {
  const app = express();

  // Parses JSON request bodies into req.body. Malformed JSON goes to the error handler below.
  app.use(express.json());

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  app.post('/api/candidates', (req, res) => {
    const parsed = newCandidateSchema.safeParse(req.body);
    if (!parsed.success) {
      sendInvalidInput(res, parsed.error);
      return;
    }
    res.status(201).json(createCandidate(db, parsed.data));
  });

  app.get('/api/candidates', (req, res) => {
    const parsed = listQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      sendInvalidInput(res, parsed.error);
      return;
    }
    res.json(listCandidates(db, parsed.data));
  });

  app.get('/api/candidates/:id', (req, res) => {
    const candidate = findCandidate(db, req.params.id);
    if (!candidate) {
      sendNotFound(res);
      return;
    }
    res.json({ ...candidate, notes: listNotes(db, candidate.id) });
  });

  app.patch('/api/candidates/:id/stage', (req, res) => {
    const candidate = findCandidate(db, req.params.id);
    if (!candidate) {
      sendNotFound(res);
      return;
    }
    const parsed = stageUpdateSchema.safeParse(req.body);
    if (!parsed.success) {
      sendInvalidInput(res, parsed.error);
      return;
    }
    updateStage(db, candidate.id, parsed.data.stage);
    res.json(getCandidate(db, candidate.id));
  });

  app.post('/api/candidates/:id/notes', (req, res) => {
    const candidate = findCandidate(db, req.params.id);
    if (!candidate) {
      sendNotFound(res);
      return;
    }
    const parsed = newNoteSchema.safeParse(req.body);
    if (!parsed.success) {
      sendInvalidInput(res, parsed.error);
      return;
    }
    res.status(201).json(addNote(db, candidate.id, parsed.data.body));
  });

  app.delete('/api/candidates/:id', (req, res) => {
    const candidate = findCandidate(db, req.params.id);
    if (!candidate) {
      sendNotFound(res);
      return;
    }
    archiveCandidate(db, candidate.id);
    res.status(204).end();
  });

  // Reached only when no route above matched.
  app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'Route not found' });
  });

  // Express recognises an error handler by its four arguments, so _next must stay.
  const handleError: ErrorRequestHandler = (err, _req, res, _next) => {
    // Errors from express.json() carry a status, such as 400 for malformed JSON.
    const status = typeof err.status === 'number' ? err.status : 500;
    if (status >= 500) {
      console.error(err);
    }
    // Never send details of an unexpected error to the browser.
    res.status(status).json({ error: status >= 500 ? 'Something went wrong' : err.message });
  };
  app.use(handleError);

  return app;
}
