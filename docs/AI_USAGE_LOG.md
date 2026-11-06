# AI Usage Log

Deliverable: 4 to 6 specific moments where AI-generated code was corrected, rejected, or rewritten, and why.

Only add real moments, when they happen. The submission can only use entries the author can explain.

| # | Area / file | What the AI suggested | What I changed | Why |
|---|---|---|---|---|
| 1 | `server/src/summarizer/prompt.ts` | A prompt saying "include only what the text states", which still returned the skill "Frontend Engineering" for a cover letter that only named it as the role applied for | Added a rule against treating the role applied for as a skill, and bumped the prompt to `v2` | A recruiter could read it as a skill the candidate has. Real output showed the error, which the mocked tests couldn't catch. The AI flagged it, and I chose to fix it |
| 2 | `server/src/summarizer/prompt.ts` | Removing `<resume>` tags from resume text with a single regex pass, to stop an applicant escaping the delimiter | Changed it to repeat until nothing changes, and added nested-tag tests | `</res</resume>ume>` turned back into a real `</resume>` after one pass, so injected text could sit outside the delimiter. A code review tool found this, and I chose to fix it from a list of 10 findings because adversarial input is graded directly |
| 3 | `client/src/SummarySection.tsx` | Showing the suspicious-content warning only when there was a good summary to display | Moved the warning so it also shows for an attempt that produced no summary | A resume that's mostly injection text would otherwise only say "too short or unclear", which hides the reason to be careful. A code review tool found this, and I chose to fix it |
| 4 | `server/src/summarizer/index.ts`, `docs/DECISIONS.md` | A comment and decision record saying only 503 errors are retried | Corrected both after measuring it: timeouts are retried too, so a hanging request can take about 96 seconds | The written reasoning was wrong, and I could be questioned on it. A code review tool found this, and I chose to correct the record rather than add more code |
