# Decisions

Working notes for the final write-up.

## Stack

| Decision | Why | Tradeoff |
|---|---|---|
| React + Vite frontend | Existing experience; a few simple views | No server rendering, which this app doesn't need |
| TypeScript throughout | Similar experience in TypeScript and JavaScript; type checks catch mistakes early | Slightly more setup |
| Express backend | Keeps the API explicit; holds the database access and API key outside the browser | New to me, so it takes time to learn |
| SQLite | Fits candidates and notes as related tables; built-in filtering and sorting; no database server to run | Not suited to many concurrent writers; production design would use managed Postgres |
| Plain SQL, no ORM (Drizzle dropped) | The AI first suggested Drizzle; dropped to limit new tools and keep queries easy to explain | More hand-written queries |
| `node:sqlite` instead of `better-sqlite3` | Built into Node 24, so no native module to install on a reviewer's machine and one less dependency; tested on Node 24.7 | Still experimental in Node 24, so it prints a warning at startup and its API could change |
| No Docker | Brief asks for clone, install, run; Node and npm are enough | Reviewers need a compatible Node version |
| Google Gemini (first built on Anthropic, then switched) | Free key with no card, enough quota for this project; the Anthropic API needs paid credit, separate from a Claude subscription | Free-tier inputs may be used for training and read by reviewers, which is fine for sample data but not real resumes; production would use a paid tier |
| Vitest | Fits naturally with Vite | None significant so far |
| `vite` declared in the server's dev dependencies as well as the client's | Adding Vitest on its own made npm 11.5.1 drop Rolldown's platform binaries from the lockfile, which broke both Vitest and Vite. Declaring `vite` next to it keeps them | A dependency that looks unused in the server; removing it would bring the failure back |
| No Supertest; route tests use built-in `fetch` | Tests real HTTP without another dependency | Each test file starts and stops the server itself |
| `.env` loaded with Node's `--env-file-if-exists` | No `dotenv` dependency; the app still starts with no key | Relies on the dev script passing the flag |

## Behaviour

| Decision | Why | Tradeoff |
|---|---|---|
| Archived candidates return 404 on every route | One simple rule; the brief allows archive or delete | No archive view or restore |
| `npm run seed` only adds candidates whose email isn't already there | Safe to run repeatedly, and it can't wipe anyone's data | Changing a sample means deleting `server/data.db` to see it |
| Seeding doesn't generate summaries | Works with no API key and uses no model calls; each summary is one click on the candidate's page | Sample candidates start with no summary |
| Duplicate emails are allowed | The same person can apply for two roles | The same application can be entered twice |
| Resume text is required when adding a candidate | The brief marks phone and source as optional, but not this; the summary depends on it | A candidate with no resume yet can't be added |
| The list route leaves out resume text | The list view doesn't show it, so there's no reason to send every full resume | The detail page needs its own request |
| Role filter is a case-insensitive text search | Role is free text, so a dropdown would split "Engineer" and "engineer" | Less precise than a fixed list of roles |
| `useState` for switching views, no router | The app has only a few views, and it avoids another dependency | Refreshing returns to the list, and candidates have no shareable URLs |

## AI summary

| Decision | Why | Tradeoff |
|---|---|---|
| Generate automatically after a candidate is created, with a button to regenerate | The brief says "auto-generate"; the client makes a separate call, so a failed summary can't block adding a candidate | A model call for every new candidate, which costs a little each time |
| Leave the job description out of the prompt | The brief asks for a summary of skills and experience, not a match against the role; fewer inputs make results easier to explain | No role-specific relevance in the summary |
| Model flags `suspicious_content`, and the UI warns and labels summaries as AI-generated | Schema validation can't catch a well-formed reply that followed an injected instruction | Relies on the model noticing; it reduces the risk rather than removing it |
| Keep every attempt as a row in `summaries`, with failure reasons in `error` | Shows which model and prompt produced each result, and lets the UI explain a failure | More rows than storing only the latest result |
| Show the latest good summary, plus any newer failure | A failed regenerate shouldn't hide a good summary that's still stored | The detail query is slightly more complex |
| `gemini-3.5-flash-lite` | Responded in about 2 seconds on a free key, while full Flash models often returned 503 or 504, and a test run used up the 20-a-day limit on `gemini-3.5-flash` | A lighter model may be easier to fool, which the real-model check has to show. The free tier limits requests per day, so this wouldn't suit production |
| Structured output schema sent with the request, and the reply checked again with Zod | The schema steers the model, and our own check means nothing unverified reaches the page | A valid reply can still be wrong, so this alone doesn't stop injection |
| Fixed system prompt, resume only inside `<resume>` tags with any such tags removed, no tools | Keeps untrusted text from passing as instructions, and leaves the model no actions to misuse | Reduces injection risk rather than removing it |
| Over-long resumes are rejected, not cut | Silently cutting one would produce a summary of part of the resume with no warning | Very long resumes get no summary |
| Summary request happens synchronously in the route, with a 30-second timeout and up to 3 attempts | Simple to follow, with no queue or background job; the retries were added after the free tier returned 503 "high demand" on 4 of 5 real calls. Measured with a fake network layer: 503s and timeouts are retried, while 429s, 504s and network failures aren't, because retrying a 429 wastes the daily limit | The request stays open for the whole call, about 96 seconds in the worst case, and a retried timeout may count against the daily limit |
| Summarizer returns a result and never touches the database | Can be tested and explained on its own | The route has to save the result |

## Open questions for the recruiter

- Answered: no shared seed dataset was provided, and the recruiter confirmed we can generate our own.
- Is this the final version of the brief? Its green text mentions a recent review round.
