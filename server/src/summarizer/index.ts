// The AI summary feature. It takes resume text and returns a result. It never touches the
// database and never throws, so a failed summary can't break the rest of the app.
import { ApiError, GoogleGenAI } from '@google/genai';
import { z } from 'zod';
import { buildUserMessage, PROMPT_VERSION, SYSTEM_PROMPT } from './prompt.js';

// Tested on a free key: this answered in about 2 seconds, while full Flash models were often
// overloaded. The free tier limits requests per day, and each model has its own limit.
const MODEL = 'gemini-3.5-flash-lite';
const TIMEOUT_MS = 30_000;
// The free tier often answers 503 "high demand", and usually works moments later.
// Listing only 503 stops the SDK retrying a 429, which would use up more of a daily limit with no
// chance of working. The SDK also retries its own timeouts, whatever this list says, so a request
// that keeps hanging can take about 96 seconds (3 x 30s, plus delays of 2s and 4s).
const RETRY_OPTIONS = { attempts: 3, initialDelay: 2, httpStatusCodes: [503] };
const MAX_OUTPUT_TOKENS = 8_000;
// Same limit as the API's validation. Seed data skips that check, so it's enforced here too.
const MAX_RESUME_LENGTH = 50_000;

// The shape the model must return. It's sent with the request, and checked again on the reply.
const modelOutputSchema = z.object({
  sufficient: z.boolean(),
  skills: z.array(z.string().max(200)).max(30),
  highlights: z.array(z.string().max(500)).max(15),
  suspicious_content: z.boolean(),
});

export type SummaryError =
  | 'no_api_key'
  | 'invalid_api_key'
  | 'too_long'
  | 'timeout'
  | 'rate_limited'
  | 'api_error'
  | 'refused'
  | 'bad_output';

export type SummaryResult = {
  status: 'ok' | 'insufficient' | 'failed';
  skills: string[];
  highlights: string[];
  suspicious_content: boolean;
  error: SummaryError | null;
  model: string | null;
  prompt_version: string;
};

export type Summarize = (resumeText: string, client?: GoogleGenAI) => Promise<SummaryResult>;

function failed(error: SummaryError, model: string | null = null): SummaryResult {
  return {
    status: 'failed',
    skills: [],
    highlights: [],
    suspicious_content: false,
    error,
    model,
    prompt_version: PROMPT_VERSION,
  };
}

function classifyError(err: unknown): SummaryError {
  // Our own timeout surfaces as an AbortError, and a 504 is the service timing out.
  if (err instanceof Error && err.name === 'AbortError') return 'timeout';
  if (err instanceof ApiError) {
    if (err.status === 504) return 'timeout';
    // 429 is our quota, 503 is the service being busy. To the user, both mean "try again soon".
    if (err.status === 429 || err.status === 503) return 'rate_limited';
    if (err.status === 401 || err.status === 403) return 'invalid_api_key';
    // Gemini reports a bad key as a general 400, so the message is the only way to tell.
    if (err.status === 400 && err.message.includes('API key not valid')) return 'invalid_api_key';
  }
  return 'api_error';
}

function createClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: { timeout: TIMEOUT_MS, retryOptions: RETRY_OPTIONS },
  });
}

// Tests pass in a fake client. The real app leaves it out, so a real one gets created.
export const summarize: Summarize = async (resumeText, client) => {
  // Nothing to summarise, so there's no reason to make a model call.
  if (!resumeText.trim()) {
    return {
      status: 'insufficient',
      skills: [],
      highlights: [],
      suspicious_content: false,
      error: null,
      model: null,
      prompt_version: PROMPT_VERSION,
    };
  }
  if (resumeText.length > MAX_RESUME_LENGTH) {
    return failed('too_long');
  }

  const gemini = client ?? createClient();
  if (!gemini) {
    return failed('no_api_key');
  }

  try {
    const response = await gemini.models.generateContent({
      model: MODEL,
      contents: buildUserMessage(resumeText),
      config: {
        systemInstruction: SYSTEM_PROMPT,
        maxOutputTokens: MAX_OUTPUT_TOKENS,
        responseMimeType: 'application/json',
        responseJsonSchema: z.toJSONSchema(modelOutputSchema),
        // No tools are passed, so the model can only reply with text.
      },
    });

    // The model that actually answered can differ from the one requested.
    const model = response.modelVersion ?? MODEL;
    const finishReason = response.candidates?.[0]?.finishReason;

    // Cut off by the length limit, so the JSON would be incomplete.
    if (finishReason === 'MAX_TOKENS') {
      return failed('bad_output', model);
    }
    // Blocked before or during the reply, such as by a safety filter.
    if (response.promptFeedback?.blockReason || (finishReason && finishReason !== 'STOP')) {
      return failed('refused', model);
    }

    let json: unknown;
    try {
      json = JSON.parse(response.text ?? '');
    } catch {
      return failed('bad_output', model);
    }

    const parsed = modelOutputSchema.safeParse(json);
    if (!parsed.success) {
      return failed('bad_output', model);
    }

    const { sufficient, skills, highlights, suspicious_content } = parsed.data;
    const hasContent = skills.length > 0 || highlights.length > 0;

    return {
      status: sufficient && hasContent ? 'ok' : 'insufficient',
      skills: sufficient ? skills : [],
      highlights: sufficient ? highlights : [],
      suspicious_content,
      error: null,
      model,
      prompt_version: PROMPT_VERSION,
    };
  } catch (err) {
    // Only a short code is kept. The details stay here in the server's log.
    console.error('Summary request failed:', err);
    return failed(classifyError(err));
  }
};
