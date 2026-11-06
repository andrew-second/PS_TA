# Write-up

## Design choices

I prioritised one working path, from adding a candidate through to an AI summary, over extra features.

- **Stack:** React and Vite because I already knew them, and Express as my unfamiliar component. A separate server keeps the database and API key out of the browser.
- **Data:** SQLite with three tables, using plain SQL rather than an ORM to limit new tools and keep queries easy to explain. The database itself enforces foreign keys and allowed stages.
- **Structure:** `db.ts` holds all the SQL, `validation.ts` decides what input is acceptable, and `app.ts` holds the routes. `app.ts` is separate from `index.ts` so tests can run the real app with a temporary database.
- **Archiving:** a soft delete, where an archived candidate returns 404 on every route. It's one simple rule, but there's no restore.

## AI integration

Everything is in `server/src/summarizer/`. It takes resume text and returns a result, never touches the database, and never throws. The client requests a summary after a candidate is added, so a failure can't block saving them.

**Request design:** a fixed system prompt asks for facts only, with no ratings. The resume goes only in the user message, inside `<resume>` tags, with any such tags removed from the text. The model gets no tools, and a JSON schema is sent with the request.

**Handling bad input:**

| Input or failure | What happens |
|---|---|
| Empty or over-long text | No model call. Over-long text is rejected, not silently cut |
| Garbled or too-short text | `insufficient`, with no summary shown |
| Injection attempt | The text is treated as data, and `suspicious_content` shows a warning |
| Malformed reply | `failed`, checked with `JSON.parse` and Zod, and never displayed |
| Timeout, rate limit, bad or missing key | `failed`, with a clear message, and the app keeps working |

Zod only checks a reply's shape, so a valid reply could still have followed an injection, which is why I also tested the real model. The three adversarial samples were each flagged, and none of their injected claims appeared. I wrote those samples and ran them only a few times, so this reduces the risk rather than removing it, and every summary is labelled as AI-generated.

Automated tests fake the model to cover each failure path. I broke the code on purpose to confirm they catch real bugs.

**Provider:** I first built this on Anthropic's API, then switched to Gemini because its key is free. I chose `gemini-3.5-flash-lite` from testing: full Flash models were often overloaded, and one run used up the 20-a-day limit on `gemini-3.5-flash`.

## Tradeoffs

- **Synchronous summary request:** no queue to run, but a request that keeps hanging can take about 96 seconds.
- **Free-tier Gemini:** free, but with a low daily limit, and inputs may be used for training. That's fine for sample data but not real resumes.
- **Text-only upload:** most real resumes are PDFs, but I put the time into the AI feature first.
- **Code review:** of 10 findings, I fixed the three affecting adversarial handling or the accuracy of my reasoning. One known gap: an unclosed `<resume` can remove text up to the next `>`.

The sample data is generated, because the recruiter confirmed we could write our own.

## What I'd build next

1. PDF upload.
2. A repeatable prompt evaluation over a larger set of resumes.
3. Background summary generation, so requests return immediately.
4. Comparing candidates against a job description.
5. Login, Postgres and a paid AI tier, before any real data goes in.
