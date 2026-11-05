# Decisions

Working notes for the final write-up.

## Stack

| Decision | Why | Tradeoff |
|---|---|---|
| React + Vite frontend | Existing experience; a few simple views | No server rendering, which this app doesn't need |
| Express backend | Keeps the API explicit; holds the database access and API key outside the browser | New to me, so it takes time to learn |
| SQLite | Fits candidates and notes as related tables; built-in filtering and sorting; no database server to run | Not suited to many concurrent writers; production design would use managed Postgres |
| Plain SQL, no ORM (Drizzle dropped) | The AI first suggested Drizzle; dropped to limit new tools and keep queries easy to explain | More hand-written queries |
| No Docker | Brief asks for clone, install, run; Node and npm are enough | Reviewers need a compatible Node version |
| Anthropic / Claude | Already available to me | To be checked against the seed resumes, including the adversarial one |
| Vitest | Fits naturally with Vite | None significant so far |

## Open questions for the recruiter

- Where is the seed dataset? It isn't in this repo.
- What is the deadline and expected time commitment?
- Is this the final version of the brief? Its green text mentions a recent review round.
