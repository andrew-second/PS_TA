# Learning Log

Unfamiliar component: Express. I had used React and Vite before, but backend concepts were new to me.

## What I read

- I learned mostly by asking an AI tool to explain each piece as it was built, then explaining it back in my own words. Where I got something wrong, we went over it again.

## What confused me

- **Basic terms.** I didn't know what "validating the body" meant. The body is the data sent with a request, and validating it means checking that data before using it. The server can't rely on the form's checks, because anyone can send a request without using the form.
- **Why `app.ts` and `index.ts` are separate.** I first thought of it as one file checking errors and the other connecting to the database. Really, `app.ts` describes how the server behaves, and `index.ts` starts it with the real database and port. The point of the split is that tests can run the same app with a temporary database.
- **What stops a malicious `sort` value.** I assumed SQL placeholders would stop it, but a `?` can only stand in for a value, not part of the query's structure like `ORDER BY`. In this app, Zod rejects anything except `date` or `stage`, and that value only picks from a fixed list of SQL strings.

## What I'd tell the next engineer

- Follow one request through the code first: `express.json()` reads the body, Express matches the route, the route finds the candidate, Zod checks the input, `db.ts` runs the SQL, and the route replies. Most routes follow this same order.
- Keep routes thin. It's much easier to explain and test when SQL lives in `db.ts` and validation lives in `validation.ts`.
- Return after sending a response, or the route carries on running.
- An error handler needs all four arguments, even an unused `_next`, because that's how Express recognises it.
- In Express 5, startup errors go to the `listen` callback. Ours ignored them and printed "Server running" even when the port was taken, so check for the error.
