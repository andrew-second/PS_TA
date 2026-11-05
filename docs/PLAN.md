# Implementation Plan

Goal: a solid end-to-end slice with clear reasoning. If time runs short, cut from the "Only if time allows" list, not from the core milestones.

Status: setup and Milestones 1 and 2 are done. Next is Milestone 3.

**Deadline: 6 November 2026, 5 pm. Aim to submit by 3 pm to leave a buffer.**

| When | Work |
|---|---|
| Tonight | Milestones 1 to 3 (database, API, frontend), plus Milestone 4 if time allows |
| Tomorrow morning | Finish Milestone 4, then Milestone 5 and one `/code-review` |
| Tomorrow, by early afternoon | Milestone 6: write-up, logs, deployment design, demo, fresh-clone test |

No stretch work unless all of this is finished. Keep frontend styling minimal.

## How each milestone works

1. Agree what the milestone will do and why.
2. Build it in small pieces, with an explanation of each piece.
3. Run it and its tests.
4. Explain the code back briefly: what each part does, why it's there, and where you'd change it. If you can't, we simplify it or go over it again.
5. Update the logs while the details are fresh, then commit.

## Data model

**candidates**: id, name, email, phone (optional), role, resume_text, stage, source (optional), archived_at (empty unless archived), created_at

**notes**: id, candidate_id, body, created_at. There is no edit or delete route, which keeps notes append-only.

**summaries**: id, candidate_id, status (`ok`, `insufficient`, `failed`), skills and highlights (lists stored as JSON text, because SQLite has no list type), suspicious_content (whether the model saw instructions or manipulation in the resume), error (short reason for a failure, such as `timeout`, `no_api_key` or `bad_output`), model, prompt_version, created_at

## API

| Method and path | Purpose |
|---|---|
| `POST /api/candidates` | Add a candidate |
| `GET /api/candidates?stage=&role=&sort=` | List, filter and sort; hides archived candidates. `role` is a case-insensitive text search; `sort` accepts only `date` or `stage` |
| `GET /api/candidates/:id` | Profile, notes, the latest `ok` summary, and any failure newer than it |
| `PATCH /api/candidates/:id/stage` | Move to any stage |
| `POST /api/candidates/:id/notes` | Add a note |
| `DELETE /api/candidates/:id` | Archive (soft delete) |
| `POST /api/candidates/:id/summary` | Generate or regenerate the summary |

An archived candidate counts as not found: every `:id` route returns 404 for one. There is no archive view.

## Milestones

### 1. Database
- Create the three tables and a small database module using Node's built-in `node:sqlite`.
- Turn foreign keys on explicitly, so the setting is visible in the code.
- Add Vitest and an `npm test` script, using a temporary database for tests.
- Test: a candidate and note save and read back correctly, and a note for a candidate that doesn't exist is rejected.

### 2. Candidate API
- Build all routes except summary, with Zod validation on incoming data.
- Sort by stage in pipeline order, not alphabetically. Never put the raw `sort` value into SQL.
- Add a central error handler, so every error, including malformed JSON, comes back as JSON.
- Split `server/src/app.ts` (builds the Express app) from `server/src/index.ts` (starts it listening), so tests can start the app themselves.
- Test routes over real HTTP: start the app on a random port and call it with Node's built-in `fetch`. No Supertest.
- Test: invalid input is rejected, filters work, stage order is correct, archived candidates are hidden, and unknown or archived ids return 404.

### 3. Frontend
- Switch between views with `useState` holding the selected candidate, with no router library.
- List view with a stage filter, a role search box and sorting.
- Add-candidate form, with pasted resume text or a `.txt` upload read in the browser.
- Detail view with profile, stage control, notes history and archive.
- Check: complete the full flow by hand in a browser.

### 4. AI summary (the part most likely to be scrutinised)
- Keep everything in one module, `server/src/summarizer/`, so it can be explained on its own. It takes resume text and returns a result, with no database access; the route saves that result. Check the current Anthropic SDK docs before writing it.
- Treat resume text as untrusted data: fixed instructions, clearly delimited resume text, no tools for the model beyond any used to structure its output, and a length limit.
- Summarise the resume only. The job description in the seed data stays out of the prompt, because the brief asks for a summary rather than a match against the role.
- Validate the reply with Zod. Bad or failed replies become `failed` or `insufficient`, never displayed as a summary.
- Zod only checks shape, so a reply can be valid and still follow an injected instruction. To limit that: tell the model to extract facts with no opinions or rankings, have it set `suspicious_content` when the resume contains instructions or manipulation, show a warning when that's set, and label every summary as AI-generated.
- Generate automatically: the client calls the summary route straight after a candidate is created. A failed summary never blocks adding the candidate.
- Add a timeout, handle API errors, and keep the app working with no API key.
- Render summaries as plain text, and store the model and prompt version.
- Add a generate/regenerate button and clear loading and failure states to the detail page. A failed regenerate keeps showing the last good summary, with a note about the failure.
- Test with a mocked LLM: valid output, malformed JSON, schema mismatch, timeout, API error, missing key, empty resume.
- Check with the real model: normal, garbled and injection resumes. Record the results, because they support the provider choice.

### 5. Seed data
- Add `npm run seed`, using the provided dataset. Until it arrives, use clearly labelled placeholder data with one garbled and one injection resume, then swap it out.
- Re-run the real-model check on the provided dataset.

### 6. Submission
- README: clone, install, run, plus what to expect with no API key.
- Write-up: design choices, AI integration, tradeoffs, what's next. Half a page to one page.
- Demo video or screenshots.
- One-page deployment design: named services, a components sketch, and a monthly cost range from current pricing.
- Finish the AI usage log (4 to 6 real entries) and the learning log.
- Test the README's steps on a fresh clone.
- Practise a live change request: you get a small unseen change and make it while talking through your reasoning.

## Only if time allows

PDF upload, Playwright end-to-end test, UI polish, Docker, real deployment.

## Reviews

Run `/code-review` once, after Milestone 4. Treat each finding as a suggestion to judge, and log any that lead to a real correction.

## Blockers

Ask the recruiter for the seed dataset and confirmation that this is the final brief. If the dataset hasn't arrived before submission, submit with the placeholder data and say so clearly in the README and write-up.
