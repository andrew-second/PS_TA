# AI Usage Log

Deliverable: 4 to 6 specific moments where AI-generated code was corrected, rejected, or rewritten, and why.

Only add real moments, when they happen. The submission can only use entries the author can explain.

| # | Area / file | What the AI suggested | What I changed | Why |
|---|---|---|---|---|
| 1 | `server/src/summarizer/prompt.ts` | A prompt saying "include only what the text states", which still returned the skill "Frontend Engineering" for a cover letter that only named it as the role applied for | Added a rule against treating the role applied for as a skill, and bumped the prompt to `v2` | A recruiter could read it as a skill the candidate has. Real output showed the error, which the mocked tests couldn't catch. The AI flagged it, and I chose to fix it |
