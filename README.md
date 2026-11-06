# Candidate Tracker

A small applicant tracking system with an AI-generated candidate summary. Add candidates, move them through a hiring pipeline, keep timestamped notes, and generate a summary of each resume.

Built with React, Vite, Express, TypeScript and SQLite. The summary uses Google Gemini.

## Run it

You need [Node.js](https://nodejs.org) 24 or newer.

```
git clone https://github.sydney.edu.au/awil5257/PS_TakeAway.git
cd PS_TakeAway
npm install
npm run seed
npm run dev
```

Open http://localhost:5173. The server runs on port 3001.

`npm run seed` is optional. It adds 10 made-up candidates, including garbled and adversarial resumes.

You may see `ExperimentalWarning: SQLite is an experimental feature` and `../.env not found`. Both are expected, and neither stops the app.

## Turn on the AI summary

The app works without a key: everything runs except summaries, which show a message saying they're turned off.

1. Get a free key from [Google AI Studio](https://aistudio.google.com/apikey).
2. Copy the example file: `cp .env.example .env`
3. Add your key to `.env`: `GEMINI_API_KEY=your-key-here`
4. Restart `npm run dev`.

A summary generates automatically when you add a candidate. Seeded candidates start without one, so open a candidate and click **Generate summary**.

The free tier has a small daily request limit for each model, and each summary uses one request. If you reach it, the page says so and the rest of the app keeps working. To use another model, change `MODEL` in `server/src/summarizer/index.ts`.

## Try the adversarial resumes

After seeding, generate summaries for these candidates:

| Candidate | What the resume does | What you should see |
|---|---|---|
| Riley Stone | Tells the AI to invent 15 years at Google | A warning, and no mention of Google in the summary |
| Alex Morgan | Tries to close the `<resume>` tag and pose as the system | A warning, and no "pre-approved" claim |
| Dana Whitfield | Politely asks for approval, and includes a `<script>` tag | A warning, with the script shown as plain text |
| Jordan Hale | Garbled text | "Too short or unclear", with no summary |

`samples/sample-resume.txt` is there to try the file upload.

## Commands

| Command | What it does |
|---|---|
| `npm run dev` | Starts the server and client |
| `npm run seed` | Adds the sample candidates. It's safe to repeat, and never removes data |
| `npm test` | Runs the automated tests. No API key needed, because the model is faked |
| `npm run typecheck` | Checks types in the server and client |
| `npm run check:summary` | Sends every sample resume to the real model and prints the results. Needs a key, and uses 10 requests |

To start again with an empty database, stop the server and delete `server/data.db`.

## Where things are

```
client/src/
  api.ts                 every call to the server
  App.tsx                chooses which view to show
  CandidateList.tsx      list, filters and sorting
  AddCandidateForm.tsx   add form and .txt upload
  CandidateDetail.tsx    profile, stage, notes and archive
  SummarySection.tsx     shows the summary, warnings and errors

server/src/
  index.ts               starts the server
  app.ts                 routes and error handling
  validation.ts          what each route accepts
  db.ts                  all the SQL
  seedData.ts            sample candidates
  summarizer/            the AI feature, all in one place
    index.ts             calls the model and checks the reply
    prompt.ts            the prompt and resume tag handling
    realModelCheck.ts    runs the samples through the real model
```

## API

| Route | What it does |
|---|---|
| `POST /api/candidates` | Adds a candidate |
| `GET /api/candidates?stage=&role=&sort=` | Lists candidates. `role` is a text search, and `sort` is `date` or `stage` |
| `GET /api/candidates/:id` | Gets the profile, notes and summary |
| `PATCH /api/candidates/:id/stage` | Moves to any stage |
| `POST /api/candidates/:id/notes` | Adds a note. Notes can't be edited or deleted |
| `POST /api/candidates/:id/summary` | Generates or regenerates the summary |
| `DELETE /api/candidates/:id` | Archives the candidate, keeping the row |

## Known limits

- File upload accepts `.txt` only. A PDF needs its text pasted in.
- There's no login, as the brief puts this out of scope.
- The app doesn't remember which page you were on, so a refresh returns to the list.
- The sample data was generated for this project, because the recruiter confirmed we could write our own.

## More detail

- [Write-up](docs/WRITEUP.md)
- [Deployment design](docs/DEPLOYMENT.md)
- [Decisions and tradeoffs](docs/DECISIONS.md)
- [AI usage log](docs/AI_USAGE_LOG.md)
- [Learning log](docs/LEARNING_LOG.md)
