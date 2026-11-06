import type { Summary } from './api';

type Props = {
  summary: Summary | null;
  problem: Summary | null;
  generating: boolean;
  onGenerate: () => void;
};

const ERROR_MESSAGES: Record<string, string> = {
  no_api_key: 'No API key is set, so summaries are turned off. The rest of the app still works.',
  invalid_api_key: 'The API key was rejected.',
  too_long: 'This resume is too long to summarise.',
  timeout: 'The AI service took too long to respond. Please try again.',
  rate_limited:
    'The AI service is busy, or its usage limit has been reached. Please try again later.',
  api_error: 'The AI service could not be reached. Please try again.',
  refused: 'The AI service declined to summarise this resume.',
  bad_output: 'The AI service returned an unusable reply. Please try again.',
};

function problemMessage(problem: Summary): string {
  if (problem.status === 'insufficient') {
    return 'This text is too short or unclear to summarise reliably.';
  }
  return ERROR_MESSAGES[problem.error ?? ''] ?? 'The summary could not be generated.';
}

// Everything the model wrote is shown through React as plain text, so any HTML in it stays inert.
export default function SummarySection({ summary, problem, generating, onGenerate }: Props) {
  return (
    <>
      <h3>AI summary</h3>

      {generating && <p className="hint">Generating summary...</p>}
      {!generating && !summary && !problem && <p className="hint">No summary yet.</p>}
      {!generating && problem && (
        <p className="error">
          {summary ? 'The last attempt failed, so this is the previous summary. ' : ''}
          {problemMessage(problem)}
        </p>
      )}

      {/* Checks both, because a flagged attempt may not have produced a summary to show. */}
      {(summary?.suspicious_content || problem?.suspicious_content) && (
        <p className="warning">
          Warning: this resume may contain text aimed at influencing the reader or an AI, so read
          it yourself.
        </p>
      )}

      {summary && (
        <>
          <p className="hint">
            AI-generated from the resume text. Check it against the resume below.
          </p>
          <div className="summary-columns">
            <div>
              <h4>Key skills</h4>
              <ul className="chips">
                {summary.skills.map((skill, index) => (
                  <li key={index}>{skill}</li>
                ))}
              </ul>
            </div>
            <div>
              <h4>Experience highlights</h4>
              <ul>
                {summary.highlights.map((highlight, index) => (
                  <li key={index}>{highlight}</li>
                ))}
              </ul>
            </div>
          </div>
        </>
      )}

      <button onClick={onGenerate} disabled={generating}>
        {summary ? 'Regenerate summary' : 'Generate summary'}
      </button>
    </>
  );
}
