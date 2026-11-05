// Rules for what the API accepts. Requests are checked here before anything reaches the database.
import { z } from 'zod';
import { SORTS, STAGES } from './db.js';

// A blank form field arrives as "", which should be stored as "no value" rather than empty text.
const optionalText = z
  .string()
  .trim()
  .max(200)
  .optional()
  .transform((value) => value || undefined);

export const newCandidateSchema = z.object({
  name: z.string().trim().min(1).max(200),
  // Trim first, because pasted addresses often have stray spaces.
  email: z.string().trim().pipe(z.email()),
  phone: optionalText,
  role: z.string().trim().min(1).max(200),
  resume_text: z.string().trim().min(1).max(50_000),
  source: optionalText,
});

export const listQuerySchema = z.object({
  stage: z.enum(STAGES).optional(),
  role: z.string().trim().optional(),
  sort: z.enum(SORTS).default('date'),
});

export const stageUpdateSchema = z.object({
  stage: z.enum(STAGES),
});

export const newNoteSchema = z.object({
  body: z.string().trim().min(1).max(10_000),
});
