/**
 * AI Bug Report Writer — Uses Groq (LLaMA 3.3 70B) to generate clean bug reports.
 *
 * Sends full test context to AI, receives structured bug report, validates it.
 * Falls back to template if API fails.
 */

import * as fs from 'fs';
import * as path from 'path';

const GROQ_API = 'https://api.groq.com/openai/v1/chat/completions';
const MODEL = 'llama-3.3-70b-versatile';

function loadEnv() {
  const p = path.resolve('.env');
  if (!fs.existsSync(p)) return;
  for (const line of fs.readFileSync(p, 'utf-8').split('\n')) {
    const [k, ...v] = line.split('=');
    if (k?.trim() && v.length) process.env[k.trim()] = v.join('=').trim();
  }
}

export interface BugInput {
  tcId: string; title: string; module: string; description: string;
  preconditions: string; expectedResult: string;
  steps: { title: string; status: string; duration: number }[];
  error: string; stack: string;
  severity: string; priority: string; environment: string;
  reproducibility: string; duration: number;
}

export interface AiBugReport {
  isRealBug: boolean;
  falsePositiveReason: string;
  bugTitle: string;
  briefDescription: string;
  stepsToReproduce: string;
  expectedResult: string;
  actualResult: string;
  additionalNotes: string;
}

async function callGroq(messages: Array<{role: string; content: string}>): Promise<string> {
  loadEnv();
  const key = process.env.GROQ_API_KEY;
  if (!key) return '';
  try {
    const res = await fetch(GROQ_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
      body: JSON.stringify({ model: MODEL, messages, temperature: 0.2, max_tokens: 1000 }),
    });
    const data = await res.json();
    return data?.choices?.[0]?.message?.content || '';
  } catch (e) {
    console.error('[AI] Groq error:', (e as Error).message);
    return '';
  }
}

/**
 * Classify whether a failure is a real bug or a false positive.
 * Returns 'real_bug' | 'environment_issue' | 'flaky_timing' | 'overlay_blocked'
 */
function classifyFailure(input: BugInput): { classification: string; reason: string } {
  const error = (input.error || '').toLowerCase();
  const stack = (input.stack || '').toLowerCase();
  const allText = error + ' ' + stack;

  // 1. Webpack/React overlay blocking interactions
  if (allText.includes('webpack-dev-server-client-overlay') ||
      allText.includes('intercepts pointer events') ||
      allText.includes('iframe') && allText.includes('intercepts')) {
    return { classification: 'overlay_blocked', reason: 'Webpack dev server error overlay blocked UI interaction. This is a dev environment issue, not a product bug.' };
  }

  // 2. Runtime error overlay blocking
  if (allText.includes('uncaught runtime error') ||
      allText.includes('runtime error overlay') ||
      allText.includes('error overlay blocking')) {
    return { classification: 'overlay_blocked', reason: 'React runtime error overlay appeared and blocked the test. The underlying runtime error may be a bug, but the test failure itself is caused by the overlay.' };
  }

  // 3. Flaky — passed on retry (check BEFORE timeout/assertion checks)
  if (input.reproducibility === 'Intermittent (passed on retry)') {
    return { classification: 'flaky_timing', reason: 'Test passed on retry. Likely a timing or race condition, not a consistent product bug.' };
  }

  // 4. Pure timeout on a consistently failing test — real bug
  if (allText.includes('timeout') && !allText.includes('expect(') && !allText.includes('assertion')) {
    // Consistent timeout without assertion = could be a real issue, don't filter
  }

  // 5. Element not visible due to overlay (not because it doesn't exist)
  if (allText.includes('not visible') || allText.includes('not attached')) {
    if (allText.includes('overlay') || allText.includes('iframe') || allText.includes('intercept')) {
      return { classification: 'overlay_blocked', reason: 'Element exists but was not interactable due to an overlay. Dev environment issue.' };
    }
  }

  // 6. Network/connectivity issues
  if (allText.includes('net::err_') || allText.includes('econnrefused') || allText.includes('not reachable')) {
    return { classification: 'environment_issue', reason: 'Network connectivity issue. App may not be running or network is unstable.' };
  }

  return { classification: 'real_bug', reason: '' };
}

function buildPrompt(input: BugInput): Array<{role: string; content: string}> {
  const passedSteps = input.steps.filter(s => s.status === 'passed');
  const failedStep = input.steps.find(s => s.status === 'failed');
  const failedIdx = failedStep ? input.steps.indexOf(failedStep) + 1 : 0;
  const errorLine = (input.error || '').split('\n').filter(l => l.trim()).slice(0, 3).join('\n');

  return [
    {
      role: 'system',
      content: `You are a senior QA engineer. You write bug reports that developers can immediately act on.

CRITICAL RULES FOR CLASSIFICATION:
- FIRST determine if this is a REAL BUG or a FALSE POSITIVE
- FALSE POSITIVES include: webpack overlay blocking clicks, React error overlay covering UI, timeout due to slow dev server, element hidden behind iframe overlay, flaky test that passed on retry
- If the error mentions "intercepts pointer events" or "webpack-dev-server-client-overlay" or "iframe" blocking — this is NOT a product bug, it's a dev environment issue
- If the test passed on retry (reproducibility = Intermittent), it's likely a timing issue, NOT a bug
- Only report as a bug if there's a genuine product defect

Rules for REAL bugs:
- Write in plain English, no jargon
- Be concise — every sentence must add value
- Steps must be reproducible by someone who has never seen the app
- Title should describe the symptom, not the test name
- Description should explain WHAT broke, WHERE, and WHEN
- Actual result should describe what the user sees, not the error class name
- If the error is a timeout, explain what element was missing or slow
- Output ONLY valid JSON, no markdown, no explanation outside JSON

Output this exact JSON structure:
{
  "isRealBug": true or false,
  "falsePositiveReason": "if not a real bug, explain why (empty string if real bug)",
  "bugTitle": "short clear title describing the visible problem",
  "briefDescription": "2-3 sentences: what broke, where in the app, when it happens, impact on user",
  "stepsToReproduce": "1. step one\\n2. step two\\n3. step three (where it fails)",
  "expectedResult": "what the user should see",
  "actualResult": "what the user actually sees or what went wrong",
  "additionalNotes": "possible cause, workaround, or context (1-2 sentences, or empty string)"
}`
    },
    {
      role: 'user',
      content: `Analyze this test failure and determine if it's a REAL BUG or a FALSE POSITIVE:

TEST CASE: ${input.tcId} — ${input.title}
MODULE: ${input.module}
DESCRIPTION: ${input.description}
SEVERITY: ${input.severity} | PRIORITY: ${input.priority}
ENVIRONMENT: ${input.environment}
REPRODUCIBILITY: ${input.reproducibility}
PRECONDITIONS: ${input.preconditions}
DURATION: ${input.duration}ms

TEST STEPS EXECUTED:
${input.steps.map((s, i) => `  ${i+1}. [${s.status.toUpperCase()}] ${s.title} (${s.duration}ms)`).join('\n')}

FAILED AT STEP: ${failedIdx > 0 ? `Step ${failedIdx}: ${failedStep?.title}` : 'Unknown'}
STEPS THAT PASSED BEFORE FAILURE: ${passedSteps.map(s => s.title).join(' → ') || 'None'}

ERROR MESSAGE:
${errorLine}

FULL ERROR:
${(input.error || '').substring(0, 800)}

STACK TRACE (first 3 lines):
${(input.stack || '').split('\n').slice(0, 3).join('\n')}

EXPECTED RESULT (from test spec): ${input.expectedResult}

IMPORTANT: If the error mentions "iframe intercepts pointer events", "webpack-dev-server-client-overlay", or the test passed on retry — set isRealBug to false.

Generate the JSON now.`
    }
  ];
}

function validateAndParse(raw: string, input: BugInput): AiBugReport | null {
  // Extract JSON from response (AI sometimes wraps in markdown)
  let json = raw.trim();
  if (json.startsWith('```')) json = json.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');

  try {
    const parsed = JSON.parse(json);
    // Validate all required fields exist and are non-empty
    const required = ['bugTitle', 'briefDescription', 'stepsToReproduce', 'expectedResult', 'actualResult'];
    for (const field of required) {
      if (!parsed[field] || typeof parsed[field] !== 'string' || parsed[field].trim().length < 5) {
        console.warn(`[AI] Invalid field "${field}" in response, falling back`);
        return null;
      }
    }
    // Validate title isn't just the test name repeated
    if (parsed.bugTitle === input.title || parsed.bugTitle === `${input.tcId} — ${input.title}`) {
      parsed.bugTitle = parsed.bugTitle.replace(input.tcId, '').replace('—', '').trim();
    }
    return {
      isRealBug: parsed.isRealBug !== false, // default to true if field missing
      falsePositiveReason: (parsed.falsePositiveReason || '').substring(0, 300),
      bugTitle: parsed.bugTitle.substring(0, 200),
      briefDescription: parsed.briefDescription.substring(0, 500),
      stepsToReproduce: parsed.stepsToReproduce.substring(0, 1000),
      expectedResult: parsed.expectedResult.substring(0, 300),
      actualResult: parsed.actualResult.substring(0, 500),
      additionalNotes: (parsed.additionalNotes || '').substring(0, 300),
    };
  } catch {
    console.warn('[AI] Failed to parse JSON response');
    return null;
  }
}

function fallback(input: BugInput): AiBugReport {
  const failedStep = input.steps.find(s => s.status === 'failed');
  const errorLine = (input.error || '').split('\n')[0]?.substring(0, 150) || 'Unknown error';

  // Run local classification to filter false positives even without AI
  const { classification, reason } = classifyFailure(input);
  const isRealBug = classification === 'real_bug';

  return {
    isRealBug,
    falsePositiveReason: isRealBug ? '' : reason,
    bugTitle: `[${input.tcId}] ${input.title}`,
    briefDescription: isRealBug
      ? `Test "${input.title}" in ${input.module} failed at step "${failedStep?.title || 'unknown'}". ${errorLine}`
      : `[FALSE POSITIVE] ${reason}`,
    stepsToReproduce: input.steps.map((s, i) => `${i+1}. ${s.title}${s.status === 'failed' ? ' ← FAILED' : ''}`).join('\n'),
    expectedResult: input.expectedResult || 'All assertions pass',
    actualResult: errorLine,
    additionalNotes: isRealBug
      ? (input.reproducibility === 'Intermittent' ? 'This failure is intermittent — passed on retry. Likely a timing issue.' : '')
      : `Classification: ${classification}. ${reason}`,
  };
}

export async function generateAiBugReport(input: BugInput): Promise<AiBugReport> {
  // Pre-check: run local classification first
  const { classification, reason } = classifyFailure(input);

  // If local classification says it's NOT a real bug, skip AI call entirely
  if (classification !== 'real_bug') {
    console.log(`[AI] Skipping AI call — local classification: ${classification} (${reason})`);
    return fallback(input);
  }

  const messages = buildPrompt(input);
  const raw = await callGroq(messages);

  if (raw) {
    const parsed = validateAndParse(raw, input);
    if (parsed) {
      // If AI says NOT a real bug, trust AI (it has more context)
      // If local says NOT a real bug, also trust local
      // Only report as real bug if BOTH agree
      if (!parsed.isRealBug) {
        return parsed; // AI says false positive — trust it
      }
      if (classification !== 'real_bug') {
        parsed.isRealBug = false;
        parsed.falsePositiveReason = reason;
      }
      return parsed;
    }
  }

  return fallback(input);
}

export async function generateAllBugReports(inputs: BugInput[]): Promise<Map<number, AiBugReport>> {
  const results = new Map<number, AiBugReport>();
  loadEnv();
  const hasKey = !!process.env.GROQ_API_KEY;

  if (inputs.length === 0) return results;
  if (hasKey) console.log(`[AI] Generating ${inputs.length} bug report(s) via Groq LLaMA 3.3...`);

  for (let i = 0; i < inputs.length; i++) {
    const report = await generateAiBugReport(inputs[i]);
    results.set(i, report);
    // Rate limit: 300ms between calls
    if (hasKey && i < inputs.length - 1) await new Promise(r => setTimeout(r, 300));
  }

  if (hasKey) console.log(`[AI] Done — ${results.size} report(s) generated.`);
  return results;
}
