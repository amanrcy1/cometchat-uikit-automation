import type { FullConfig, FullResult, Reporter, TestCase, TestResult } from '@playwright/test/reporter';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Unified Automation Report — Clean, minimal, developer-friendly.
 *
 * Single HTML file with 4 sections:
 *   Overview → Test Cases → Bug Reports → Runtime Errors
 *
 * Design principles (adapted from Allure/Extent best practices):
 *   - White background, minimal color (status indicators only)
 *   - Clear hierarchy: summary → details → errors
 *   - Collapsible cards to reduce noise
 *   - Monospace for errors, system font for content
 *   - No fancy charts — simple progress bar + numbers
 *   - Single file, no dependencies, works offline
 */

interface CsvEntry {
  id: string; module: string; title: string; description: string;
  preconditions: string; steps: string; expectedResult: string;
  priority: string; type: string;
}
interface TestEntry {
  tcId: string; title: string; suite: string;
  status: 'passed' | 'failed' | 'skipped' | 'flaky' | 'timedOut';
  duration: number; retries: number;
  error?: string; stack?: string; screenshot?: string; video?: string;
  steps: { title: string; duration: number; status: string }[];
  csv?: CsvEntry;
}

function parseCsv(): Map<string, CsvEntry> {
  const map = new Map<string, CsvEntry>();
  const p = path.resolve('config/test-cases.csv');
  if (!fs.existsSync(p)) return map;
  const raw = fs.readFileSync(p, 'utf-8');
  const rows: string[][] = []; let cur: string[] = []; let f = ''; let q = false;
  for (let i = 0; i < raw.length; i++) {
    const c = raw[i];
    if (q) { if (c === '"' && raw[i+1] === '"') { f += '"'; i++; } else if (c === '"') q = false; else f += c; }
    else { if (c === '"') q = true; else if (c === ',') { cur.push(f); f = ''; }
    else if (c === '\n' || (c === '\r' && raw[i+1] === '\n')) { cur.push(f); f = ''; if (c === '\r') i++; if (cur.length > 1) rows.push(cur); cur = []; }
    else f += c; }
  }
  if (cur.length > 1 || f) { cur.push(f); rows.push(cur); }
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i]; if (!r[0]?.startsWith('TC-')) continue;
    map.set(r[0].trim(), { id:r[0]?.trim()||'', module:r[1]?.trim()||'', title:r[2]?.trim()||'',
      description:r[3]?.trim()||'', preconditions:r[4]?.trim()||'', steps:r[5]?.trim()||'',
      expectedResult:r[6]?.trim()||'', priority:r[7]?.trim()||'Medium', type:r[8]?.trim()||'Functional' });
  }
  return map;
}

import { generateAllBugReports, AiBugReport } from './ai-bug-writer';

const h = (s: string) => stripAnsi(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\n/g,'<br>');
const stripAnsi = (s: string) => s.replace(/\u001b\[\d+m/g, '').replace(/[\x00-\x1f]/g, '');
const dur = (ms: number) => ms < 1000 ? `${ms}ms` : ms < 60000 ? `${(ms/1000).toFixed(1)}s` : `${(ms/60000).toFixed(1)}m`;
const tcId = (t: string) => (t.match(/TC-[A-Z]+-\d+/) || [''])[0];

class UnifiedReporter implements Reporter {
  private tests: TestEntry[] = [];
  private csv!: Map<string, CsvEntry>;
  private t0 = 0;
  private cfg!: FullConfig;

  onBegin(config: FullConfig) { this.cfg = config; this.t0 = Date.now(); this.csv = parseCsv(); }

  onTestEnd(test: TestCase, result: TestResult) {
    const suite = test.parent?.title || '';
    let status: TestEntry['status'] = result.status as any;
    if (result.status === 'passed' && result.retry > 0) status = 'flaky';
    const id = tcId(test.title);
    const steps = result.steps.filter(s => s.category === 'test.step')
      .map(s => ({ title: s.title, duration: s.duration, status: s.error ? 'failed' : 'passed' }));
    const e: TestEntry = { tcId: id, title: test.title, suite, status, duration: result.duration,
      retries: result.retry, steps, csv: id ? this.csv.get(id) : undefined };
    if (result.status === 'failed' || result.status === 'timedOut') {
      const err = result.errors[0];
      if (err) { e.error = stripAnsi(err.message?.substring(0, 2000) || ''); e.stack = stripAnsi(err.stack?.substring(0, 3000) || ''); }
    }
    for (const a of result.attachments) {
      if (a.name === 'first-failure-screenshot' && a.path) e.screenshot = a.path;
      else if (a.name === 'screenshot' && a.path && !e.screenshot) e.screenshot = a.path;
      else if (a.name?.includes('screenshot') && a.path && !e.screenshot) e.screenshot = a.path;
      if (a.name === 'video' && a.path) e.video = a.path;
    }
    // Also check for video in test result artifacts directory
    if (!e.video && result.attachments.length > 0) {
      const videoAtt = result.attachments.find(a => a.path?.endsWith('.webm') || a.path?.endsWith('.mp4'));
      if (videoAtt?.path) e.video = videoAtt.path;
    }
    this.tests.push(e);
  }

  async onEnd() {
    const totalMs = Date.now() - this.t0;

    // Deduplicate: keep only the LAST attempt per test (by title + suite)
    const seen = new Map<string, number>();
    for (let i = 0; i < this.tests.length; i++) {
      const key = this.tests[i].suite + '::' + this.tests[i].title;
      seen.set(key, i); // later index overwrites earlier = keeps last attempt
    }
    this.tests = Array.from(seen.values()).sort((a, b) => a - b).map(i => this.tests[i]);

    const fails = this.tests.filter(t => t.status === 'failed' || t.status === 'timedOut');

    // Generate AI bug reports for all failures
    const aiInputs = fails.map(t => {
      const c = t.csv;
      return {
        tcId: t.tcId, title: t.title, module: c?.module || t.suite,
        description: c?.description || t.title, preconditions: c?.preconditions || 'User is logged in',
        steps: t.steps, expectedResult: c?.expectedResult || 'All assertions pass',
        error: stripAnsi(t.error || ''), stack: stripAnsi(t.stack || ''),
        severity: c?.priority === 'High' ? 'Critical' : c?.priority === 'Low' ? 'Minor' : 'Major',
        priority: c?.priority || 'Medium',
        environment: `Chromium · ${this.cfg?.projects?.[0]?.use?.baseURL || 'localhost'} · ${process.platform}`,
        reproducibility: t.status === 'flaky' ? 'Intermittent (passed on retry)' : 'Always',
        duration: t.duration,
      };
    });
    const aiReports = await generateAllBugReports(aiInputs);

    // Separate real bugs from false positives
    const realBugIndices: number[] = [];
    const falsePositiveIndices: number[] = [];
    for (let i = 0; i < fails.length; i++) {
      const ai = aiReports.get(i);
      if (ai && !ai.isRealBug) {
        falsePositiveIndices.push(i);
      } else {
        realBugIndices.push(i);
      }
    }
    console.log(`[Report] ${fails.length} failures: ${realBugIndices.length} real bugs, ${falsePositiveIndices.length} false positives filtered out`);

    this.build(totalMs, aiReports, realBugIndices, falsePositiveIndices);
  }

  private build(totalMs: number, aiReports: Map<number, AiBugReport> = new Map(), realBugIndices: number[] = [], falsePositiveIndices: number[] = []) {
    const P = this.tests.filter(t => t.status === 'passed').length;
    const F = this.tests.filter(t => t.status === 'failed' || t.status === 'timedOut').length;
    const FL = this.tests.filter(t => t.status === 'flaky').length;
    const S = this.tests.filter(t => t.status === 'skipped').length;
    const T = this.tests.length;
    const rate = T ? ((P + FL) / T * 100).toFixed(1) : '0';
    const fails = this.tests.filter(t => t.status === 'failed' || t.status === 'timedOut');
    let rtErrors: any[] = [];
    try { rtErrors = require('./error-tracker').getErrors(); } catch {}
    const suites: Record<string, { p:number; f:number; fl:number; s:number; d:number }> = {};
    for (const t of this.tests) {
      if (!suites[t.suite]) suites[t.suite] = { p:0, f:0, fl:0, s:0, d:0 };
      const k = t.status === 'passed' ? 'p' : t.status === 'flaky' ? 'fl' : (t.status === 'failed' || t.status === 'timedOut') ? 'f' : 's';
      suites[t.suite][k]++; suites[t.suite].d += t.duration;
    }
    const url = this.cfg?.projects?.[0]?.use?.baseURL || 'localhost';
    const bugId = (i: number) => `BUG-${String(i+1).padStart(3,'0')}`;

    // ── Suite rows ──
    const suiteRows = Object.entries(suites).map(([name, s]) => {
      const tot = s.p + s.f + s.fl + s.s || 1;
      return `<tr>
        <td>${h(name)}</td>
        <td><div class="bar"><div class="bar-p" style="width:${s.p/tot*100}%"></div><div class="bar-fl" style="width:${s.fl/tot*100}%"></div><div class="bar-f" style="width:${s.f/tot*100}%"></div></div></td>
        <td class="num">${s.p}</td><td class="num">${s.f}</td><td class="num">${s.fl}</td><td class="num">${s.s}</td><td class="num muted">${dur(s.d)}</td>
      </tr>`;
    }).join('');

    // ── Test case cards ──
    const tcCards = this.tests.map((t, i) => {
      const c = t.csv; const sc = t.status === 'passed' ? '#16a34a' : t.status === 'failed' || t.status === 'timedOut' ? '#dc2626' : t.status === 'flaky' ? '#d97706' : '#6b7280';
      const icon = t.status === 'passed' ? '✓' : t.status === 'failed' || t.status === 'timedOut' ? '✗' : t.status === 'flaky' ? '!' : '—';
      const fs = t.steps.find(s => s.status === 'failed');
      const totalSteps = t.steps.length;
      const passedSteps = t.steps.filter(s => s.status === 'passed').length;

      return `<div class="tc" data-st="${t.status}">
  <div class="tc-h" onclick="tog(${i})">
    <span class="tc-icon" style="color:${sc}">${icon}</span>
    <span class="tc-id">${t.tcId || '#' + (i+1)}</span>
    <span class="tc-t">${h(t.title)}</span>
    <span class="tc-st" style="color:${sc}">${t.status}</span>
    <span class="tc-d">${dur(t.duration)}</span>
  </div>
  <div class="tc-b" id="tb${i}">
    <table class="meta">
      <tr><td class="lbl">Test Case ID</td><td style="font-weight:600">${t.tcId || 'N/A'}</td></tr>
      <tr><td class="lbl">Module</td><td>${h(c?.module || t.suite)}</td></tr>
      <tr><td class="lbl">Description</td><td>${h(c?.description || t.title)}</td></tr>
      <tr><td class="lbl">Preconditions</td><td>${h(c?.preconditions || 'User is logged in')}</td></tr>
      <tr><td class="lbl">Priority</td><td><span class="pri pri-${(c?.priority||'Medium').toLowerCase()}">${c?.priority || 'Medium'}</span></td></tr>
      <tr><td class="lbl">Type</td><td>${c?.type || 'Functional'}</td></tr>
    </table>

    ${t.steps.length ? `
    <div class="steps-title">Test Steps (${passedSteps}/${totalSteps} passed)</div>
    <div class="steps">${t.steps.map((s, j) =>
      `<div class="step ${s.status === 'failed' ? 'step-fail' : ''}">
        <span class="step-n">${j+1}</span>
        <span class="step-i" style="color:${s.status==='passed'?'#16a34a':'#dc2626'}">${s.status==='passed'?'✓':'✗'}</span>
        <span class="step-t">${h(s.title)}</span>
        <span class="step-d">${dur(s.duration)}</span>
      </div>`
    ).join('')}</div>` : c?.steps ? `
    <div class="steps-title">Test Steps</div>
    <div class="steps-text">${h(c.steps)}</div>` : ''}

    <table class="meta" style="margin-top:8px">
      <tr><td class="lbl">Expected Result</td><td>${h(c?.expectedResult || 'All assertions pass')}</td></tr>
      <tr><td class="lbl">Actual Result</td><td style="color:${sc};font-weight:600">${t.status==='passed'?'All assertions passed':t.status==='flaky'?'Passed on retry ('+t.retries+')':h((t.error||'Failed').substring(0,200))}</td></tr>
      <tr><td class="lbl">Duration</td><td>${dur(t.duration)}${t.retries > 0 ? ` · ${t.retries} retry` : ''}</td></tr>
      <tr><td class="lbl">Status</td><td style="color:${sc};font-weight:700">${t.status.toUpperCase()}</td></tr>
    </table>

    ${t.error ? `<details class="err"><summary>Error Details</summary><pre>${h(t.error)}</pre>${t.stack?`<pre class="stack">${h(t.stack)}</pre>`:''}</details>` : ''}
    ${t.screenshot ? `<details class="err"><summary>Screenshot</summary><img src="file://${h(t.screenshot)}" class="ss" /></details>` : ''}
  </div>
</div>`;
    }).join('');

    // ── Bug cards ──
    const bugCards = fails.length === 0 ? '<p class="empty">No failures — all tests passed.</p>' : (() => {
      let html = '';

      // False positives section (collapsed by default)
      if (falsePositiveIndices.length > 0) {
        html += `<div class="fp-section">
          <div class="fp-header" onclick="document.getElementById('fp-list').style.display=document.getElementById('fp-list').style.display==='none'?'block':'none'">
            <span style="color:#d97706;font-weight:600">⚠️ ${falsePositiveIndices.length} False Positive(s) Filtered Out</span>
            <span style="color:#6b7280;font-size:11px;margin-left:8px">(click to expand)</span>
          </div>
          <div id="fp-list" style="display:none">
            ${falsePositiveIndices.map(i => {
              const t = fails[i]; const ai = aiReports.get(i);
              return `<div style="padding:8px 14px;border-bottom:1px solid #fde68a;background:#fffbeb;font-size:12px">
                <span style="font-weight:600">${t.tcId || 'N/A'}</span> — ${h(t.title)}<br>
                <span style="color:#92400e">${h(ai?.falsePositiveReason || 'Classified as false positive')}</span>
              </div>`;
            }).join('')}
          </div>
        </div>`;
      }

      // Real bugs only
      if (realBugIndices.length === 0) {
        html += '<p class="empty">All failures were classified as false positives (environment/timing issues). No real bugs to report.</p>';
      } else {
        html += realBugIndices.map(i => {
      const t = fails[i];
      const c = t.csv; const sev = c?.priority === 'High' ? 'Critical' : c?.priority === 'Low' ? 'Minor' : 'Major';
      const fs = t.steps.find(s => s.status === 'failed');
      const repro = t.retries > 0 ? 'Intermittent' : 'Always';
      const ssPath = t.screenshot;
      const ai = aiReports.get(i);

      // Linear payload
      const cleanTitle = stripAnsi(ai?.bugTitle || `[${t.tcId || 'BUG'}] ${t.title}`);
      const cleanActual = stripAnsi(ai?.actualResult || (t.error || 'Failed').substring(0, 500));
      const cleanError = stripAnsi((t.error || '').substring(0, 1500));
      const cleanStack = stripAnsi((t.stack || '').substring(0, 2000));
      const bugPayload = JSON.stringify({
        bugId: bugId(i), tcId: t.tcId || '', title: cleanTitle,
        module: c?.module || t.suite, severity: sev, priority: c?.priority || 'Medium',
        reproducibility: repro, environment: `Chromium · ${url} · ${process.platform}`,
        preconditions: c?.preconditions || 'User is logged in',
        steps: t.steps.map(s => ({ title: s.title, status: s.status })),
        expected: ai?.expectedResult || c?.expectedResult || 'All assertions pass',
        actual: cleanActual,
        error: cleanError, stack: cleanStack,
        screenshotPath: ssPath || '', videoPath: t.video || '',
      });
      const escapedPayload = bugPayload.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n');
      const linearUrl = `https://linear.new?title=${encodeURIComponent(cleanTitle.substring(0, 200))}&priority=${c?.priority === 'High' ? 'urgent' : 'high'}&label=bug`;

      return `<div class="bug">
  <div class="bug-h">
    <span class="bug-id">${bugId(i)}</span>
    <span class="bug-t">${h(stripAnsi(ai?.bugTitle || t.title))}</span>
    <span class="bug-sev sev-${sev.toLowerCase()}">${sev}</span>
    <button class="linear-btn" onclick="openLinearModal(this, '${escapedPayload}')">Report to Linear →</button>
    <a href="${linearUrl}" target="_blank" class="linear-link" title="Open in Linear (text only)">↗</a>
  </div>
  <div class="bug-b">
    <!-- AI-generated clean summary -->
    <div class="bug-summary">${h(ai?.briefDescription || `Test "${t.title}" failed in ${c?.module || t.suite}.`)}</div>

    <table class="meta">
      <tr><td class="lbl">Bug ID</td><td style="font-weight:600">${bugId(i)}</td></tr>
      <tr><td class="lbl">Test Case</td><td>${t.tcId || 'N/A'}</td></tr>
      <tr><td class="lbl">Module</td><td>${h(c?.module || t.suite)}</td></tr>
      <tr><td class="lbl">Severity</td><td><span class="bug-sev sev-${sev.toLowerCase()}" style="font-size:11px">${sev}</span></td></tr>
      <tr><td class="lbl">Priority</td><td><span class="pri pri-${(c?.priority||'Medium').toLowerCase()}">${c?.priority || 'Medium'}</span></td></tr>
      <tr><td class="lbl">Reproducibility</td><td>${repro}</td></tr>
      <tr><td class="lbl">Environment</td><td>Chromium · ${h(url)} · ${process.platform}</td></tr>
    </table>

    <div class="steps-title">Steps to Reproduce</div>
    ${ai?.stepsToReproduce ? `<div class="bug-ai-steps">${h(ai.stepsToReproduce)}</div>` :
    `<div class="steps">${t.steps.length ? t.steps.map((s, j) =>
      `<div class="step ${s.status === 'failed' ? 'step-fail' : ''}"><span class="step-n">${j+1}</span><span class="step-i" style="color:${s.status==='passed'?'#16a34a':'#dc2626'}">${s.status==='passed'?'✓':'✗'}</span><span class="step-t">${h(s.title)}${s.status==='failed'?' <b class="fail-here">← FAILED</b>':''}</span></div>`
    ).join('') : `<div class="steps-text">${h(c?.steps || 'See test code')}</div>`}</div>`}

    <table class="meta" style="margin-top:8px">
      <tr><td class="lbl">Expected</td><td>${h(ai?.expectedResult || c?.expectedResult || 'All assertions pass')}</td></tr>
      <tr><td class="lbl">Actual</td><td class="err-text">${h(ai?.actualResult || (t.error || 'Failed').substring(0, 300))}</td></tr>
    </table>

    ${ai?.additionalNotes ? `<div class="bug-notes"><span class="lbl">Notes:</span> ${h(ai.additionalNotes)}</div>` : ''}

    <details class="err"><summary>Error Log</summary><pre>${h(t.error || '')}</pre>${t.stack?`<pre class="stack">${h(t.stack)}</pre>`:''}</details>
    ${ssPath ? `<details class="err" open><summary>Screenshot</summary><img src="file://${h(ssPath)}" class="ss" /></details>` : ''}
    ${t.video ? `<details class="err" open><summary>Video Recording</summary><video controls style="max-width:100%;border-radius:4px;margin-top:4px;border:1px solid var(--border)" src="file://${h(t.video)}"></video></details>` : ''}
  </div>
</div>`;
    }).join('');
      }
      return html;
    })();

    // ── Runtime error rows ──
    const rtRows = rtErrors.length === 0 ? '<tr><td colspan="4" class="empty">No runtime errors detected.</td></tr>'
      : rtErrors.map(e => `<tr>
      <td class="muted">${h(e.timestamp||'')}</td>
      <td><span class="rt-type rt-${e.type==='page-error'||e.type==='uncaught-exception'?'crit':'warn'}">${e.type}</span></td>
      <td class="muted">${h((e.test||'').substring(0,50))}</td>
      <td>${h((e.message||'').substring(0,300))}${e.stack?`<details><summary class="muted">stack</summary><pre class="stack">${h(e.stack)}</pre></details>`:''}</td>
    </tr>`).join('');

    const html = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Test Report · ${new Date().toLocaleDateString()}</title>
<style>
:root{--bg:#fff;--bg2:#f9fafb;--border:#e5e7eb;--text:#111827;--muted:#6b7280;--pass:#16a34a;--fail:#dc2626;--flaky:#d97706;--skip:#9ca3af;--blue:#2563eb;--radius:6px;--font:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;--mono:'SF Mono',SFMono-Regular,Menlo,Consolas,monospace}
*{margin:0;padding:0;box-sizing:border-box}
body{font:13px/1.5 var(--font);color:var(--text);background:var(--bg2)}
a{color:var(--blue);text-decoration:none}

/* Header */
.hdr{background:var(--bg);border-bottom:1px solid var(--border);padding:16px 24px;display:flex;align-items:center;gap:16px}
.hdr h1{font-size:16px;font-weight:600}.hdr .sub{color:var(--muted);font-size:12px;margin-left:auto}

/* Summary strip */
.summary{display:flex;gap:1px;background:var(--border);margin:0}
.summary .s{flex:1;background:var(--bg);padding:14px 16px;text-align:center}
.summary .s .n{font-size:24px;font-weight:700;line-height:1}.summary .s .l{font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:.5px;margin-top:2px}
.pass-c{color:var(--pass)}.fail-c{color:var(--fail)}.flaky-c{color:var(--flaky)}.skip-c{color:var(--skip)}

/* Progress bar */
.progress{height:4px;display:flex;background:var(--border)}
.progress .p-pass{background:var(--pass)}.progress .p-flaky{background:var(--flaky)}.progress .p-fail{background:var(--fail)}.progress .p-skip{background:var(--skip)}

/* Tabs */
.tabs{display:flex;background:var(--bg);border-bottom:1px solid var(--border);padding:0 24px;gap:0}
.tab{padding:10px 16px;font-size:12px;font-weight:500;color:var(--muted);cursor:pointer;border-bottom:2px solid transparent;transition:.15s}
.tab:hover{color:var(--text)}.tab.on{color:var(--blue);border-bottom-color:var(--blue)}
.tab .badge{background:var(--bg2);color:var(--muted);padding:1px 6px;border-radius:10px;font-size:10px;margin-left:4px}

/* Content */
.content{max-width:1100px;margin:16px auto;padding:0 24px}
.sec{display:none}.sec.on{display:block}

/* Cards */
.card{background:var(--bg);border:1px solid var(--border);border-radius:var(--radius);margin-bottom:12px;overflow:hidden}
.card h3{font-size:13px;font-weight:600;padding:12px 16px;border-bottom:1px solid var(--border);background:var(--bg2)}

/* Suite table */
.suite-tbl{width:100%;border-collapse:collapse}
.suite-tbl th{text-align:left;padding:6px 12px;font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:.5px;border-bottom:1px solid var(--border)}
.suite-tbl td{padding:6px 12px;border-bottom:1px solid var(--bg2);font-size:12px}
.num{text-align:center;font-weight:600;font-size:12px}.muted{color:var(--muted)}
.bar{height:6px;background:var(--bg2);border-radius:3px;overflow:hidden;display:flex;min-width:120px}
.bar-p{background:var(--pass)}.bar-fl{background:var(--flaky)}.bar-f{background:var(--fail)}

/* Env grid */
.env{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;padding:12px 16px;font-size:12px}
.env .ek{color:var(--muted)}.env .ev{font-weight:500}

/* Test case cards */
.tc{border:1px solid var(--border);border-radius:var(--radius);margin-bottom:6px;background:var(--bg);overflow:hidden}
.tc-h{display:flex;align-items:center;gap:8px;padding:8px 12px;cursor:pointer;font-size:12px}
.tc-h:hover{background:var(--bg2)}
.tc-icon{font-weight:700;font-size:14px;width:18px;text-align:center}
.tc-id{font-weight:600;color:var(--blue);min-width:85px;font-size:11px}
.tc-t{flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.tc-st{font-weight:600;font-size:11px;text-transform:uppercase;min-width:55px;text-align:right}
.tc-d{color:var(--muted);min-width:45px;text-align:right;font-size:11px}
.tc-b{display:none;padding:12px 16px;border-top:1px solid var(--border);background:var(--bg2)}
.tc-b.on{display:block}

/* Failed step highlight */
.step-fail{background:#fef2f2;border-left:3px solid var(--fail);padding-left:5px}

/* Meta table */
.meta{width:100%;border-collapse:collapse}
.meta td{padding:4px 0;font-size:12px;vertical-align:top;border:none}
.meta .lbl{color:var(--muted);font-weight:600;width:110px;white-space:nowrap;padding-right:12px}
.pri{font-size:11px;font-weight:600;padding:1px 6px;border-radius:3px}
.pri-high{color:var(--fail);background:#fef2f2}.pri-medium{color:var(--flaky);background:#fffbeb}.pri-low{color:var(--pass);background:#f0fdf4}

/* Steps */
.steps-title{font-size:11px;font-weight:600;color:var(--muted);margin:10px 0 4px;text-transform:uppercase;letter-spacing:.5px}
.steps{border:1px solid var(--border);border-radius:4px;overflow:hidden;background:var(--bg)}
.step{display:flex;align-items:center;gap:6px;padding:4px 8px;font-size:12px;border-bottom:1px solid var(--bg2)}
.step:last-child{border:none}
.step-n{color:var(--muted);min-width:16px;text-align:right;font-size:10px}
.step-i{font-weight:700;font-size:13px}.step-t{flex:1}.step-d{color:var(--muted);font-size:10px}
.steps-text{font-size:12px;color:var(--text);padding:8px;background:var(--bg);border:1px solid var(--border);border-radius:4px}

/* Errors */
.err{margin-top:8px}.err summary{font-size:11px;color:var(--muted);cursor:pointer;font-weight:500}
.err pre{font:11px/1.6 var(--mono);color:var(--fail);background:#fef2f2;padding:8px;border-radius:4px;overflow-x:auto;margin-top:4px;max-height:200px;border:1px solid #fecaca}
.stack{color:#92400e;background:#fffbeb;border-color:#fde68a;margin-top:4px}
.err-text{color:var(--fail);font-weight:500}
.ss{max-width:100%;border-radius:4px;margin-top:4px;border:1px solid var(--border)}
.fail-here{color:var(--fail);font-size:11px}

/* Bug cards */
.bug{border:1px solid #fecaca;border-radius:var(--radius);margin-bottom:10px;background:var(--bg);overflow:hidden}
.bug-h{display:flex;align-items:center;gap:8px;padding:10px 14px;background:#fef2f2;border-bottom:1px solid #fecaca}
.bug-id{font-weight:700;color:var(--fail);font-size:12px;min-width:65px}
.bug-t{flex:1;font-size:12px;font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.bug-sev{font-size:10px;font-weight:700;color:#fff;padding:2px 8px;border-radius:3px}
.sev-critical{background:var(--fail)}.sev-major{background:#ea580c}.sev-minor{background:var(--flaky)}
.linear-btn{font-size:11px;font-weight:600;color:#fff;background:#5e6ad2;padding:4px 12px;border-radius:4px;text-decoration:none;white-space:nowrap;transition:.15s;border:none;cursor:pointer}
.linear-btn:hover{background:#4f5bc4}
.linear-link{font-size:13px;color:#5e6ad2;text-decoration:none;padding:4px;border-radius:3px}
.linear-link:hover{background:#5e6ad215}
.bug-b{padding:14px 16px}
.bug-summary{font-size:13px;color:var(--text);line-height:1.6;padding:0 0 10px;border-bottom:1px solid var(--border);margin-bottom:8px}
.bug-ai-steps{font-size:12px;color:var(--text);line-height:1.8;padding:8px 10px;background:var(--bg);border:1px solid var(--border);border-radius:4px;white-space:pre-line}
.bug-notes{font-size:12px;color:#475569;background:#f0f9ff;border:1px solid #bae6fd;border-radius:4px;padding:8px 10px;margin-top:8px}

/* Runtime errors */
.rt-tbl{width:100%;border-collapse:collapse}
.rt-tbl th{text-align:left;padding:6px 10px;font-size:10px;color:var(--muted);text-transform:uppercase;border-bottom:1px solid var(--border)}
.rt-tbl td{padding:6px 10px;border-bottom:1px solid var(--bg2);font-size:12px;vertical-align:top}
.rt-type{font-size:10px;font-weight:600;padding:1px 6px;border-radius:3px}
.rt-crit{color:var(--fail);background:#fef2f2}.rt-warn{color:var(--flaky);background:#fffbeb}

/* Filter */
.filters{display:flex;gap:4px;margin-bottom:10px}
.fbtn{padding:4px 10px;border:1px solid var(--border);border-radius:4px;background:var(--bg);color:var(--muted);cursor:pointer;font-size:11px;transition:.15s}
.fbtn:hover{border-color:var(--blue);color:var(--blue)}.fbtn.on{background:var(--blue);color:#fff;border-color:var(--blue)}

.empty{text-align:center;padding:24px;color:var(--pass);font-size:13px}
@media(max-width:768px){.summary{flex-wrap:wrap}.env{grid-template-columns:1fr 1fr}}
</style></head><body>

<div class="hdr">
  <h1>Test Report</h1>
  <div class="sub">${new Date().toLocaleDateString('en-US', { weekday:'short', year:'numeric', month:'short', day:'numeric' })} · ${dur(totalMs)}</div>
</div>

<div class="summary">
  <div class="s"><div class="n">${T}</div><div class="l">Total</div></div>
  <div class="s"><div class="n pass-c">${P}</div><div class="l">Passed</div></div>
  <div class="s"><div class="n fail-c">${F}</div><div class="l">Failed</div></div>
  <div class="s"><div class="n flaky-c">${FL}</div><div class="l">Flaky</div></div>
  <div class="s"><div class="n skip-c">${S}</div><div class="l">Skipped</div></div>
  <div class="s"><div class="n ${parseFloat(rate)>=95?'pass-c':parseFloat(rate)>=80?'flaky-c':'fail-c'}">${rate}%</div><div class="l">Pass Rate</div></div>
</div>
<div class="progress">
  <div class="p-pass" style="width:${P/T*100}%"></div>
  <div class="p-flaky" style="width:${FL/T*100}%"></div>
  <div class="p-fail" style="width:${F/T*100}%"></div>
  <div class="p-skip" style="width:${S/T*100}%"></div>
</div>

<div class="tabs">
  <div class="tab on" onclick="show('overview',this)">Overview</div>
  <div class="tab" onclick="show('tests',this)">Test Cases <span class="badge">${T}</span></div>
  <div class="tab" onclick="show('bugs',this)">Bug Reports <span class="badge">${realBugIndices.length}</span></div>
  <div class="tab" onclick="show('errors',this)">Runtime Errors <span class="badge">${rtErrors.length}</span></div>
</div>

<div class="content">

<!-- OVERVIEW -->
<div id="s-overview" class="sec on">
  <div class="card"><h3>Suites</h3>
    <table class="suite-tbl"><thead><tr><th>Suite</th><th>Progress</th><th style="text-align:center">Pass</th><th style="text-align:center">Fail</th><th style="text-align:center">Flaky</th><th style="text-align:center">Skip</th><th style="text-align:center">Time</th></tr></thead>
    <tbody>${suiteRows}</tbody></table>
  </div>
  <div class="card"><h3>Environment</h3>
    <div class="env">
      <div><span class="ek">URL</span> <span class="ev">${h(url)}</span></div>
      <div><span class="ek">Browser</span> <span class="ev">Chromium</span></div>
      <div><span class="ek">OS</span> <span class="ev">${process.platform}</span></div>
      <div><span class="ek">Workers</span> <span class="ev">${this.cfg?.workers||1}</span></div>
      <div><span class="ek">Retries</span> <span class="ev">${this.cfg?.projects?.[1]?.retries??'N/A'}</span></div>
      <div><span class="ek">Timeout</span> <span class="ev">${(this.cfg?.projects?.[1]?.timeout||90000)/1000}s</span></div>
    </div>
  </div>
</div>

<!-- TEST CASES -->
<div id="s-tests" class="sec">
  <div class="filters">
    <button class="fbtn on" onclick="filt('all',this)">All (${T})</button>
    <button class="fbtn" onclick="filt('passed',this)">Passed (${P})</button>
    <button class="fbtn" onclick="filt('failed',this)">Failed (${F})</button>
    <button class="fbtn" onclick="filt('flaky',this)">Flaky (${FL})</button>
    <button class="fbtn" onclick="filt('skipped',this)">Skipped (${S})</button>
  </div>
  ${tcCards}
</div>

<!-- BUG REPORTS -->
<div id="s-bugs" class="sec">${bugCards}</div>

<!-- RUNTIME ERRORS -->
<div id="s-errors" class="sec">
  <div class="card"><h3>Errors (${rtErrors.length})</h3>
    <table class="rt-tbl"><thead><tr><th>Time</th><th>Type</th><th>Test</th><th>Message</th></tr></thead>
    <tbody>${rtRows}</tbody></table>
  </div>
</div>

</div>
<script>
function show(id,el){document.querySelectorAll('.sec').forEach(s=>s.classList.remove('on'));document.querySelectorAll('.tab').forEach(t=>t.classList.remove('on'));document.getElementById('s-'+id).classList.add('on');el.classList.add('on')}
function tog(i){document.getElementById('tb'+i).classList.toggle('on')}
function filt(st,el){document.querySelectorAll('.fbtn').forEach(b=>b.classList.remove('on'));el.classList.add('on');document.querySelectorAll('.tc').forEach(c=>{c.style.display=st==='all'||c.dataset.st===st?'':'none'})}

// ── Linear Modal ──
let _currentBugData = null;
let _currentBtn = null;

function openLinearModal(btn, bugJson) {
  _currentBtn = btn;
  _currentBugData = JSON.parse(bugJson);
  const d = _currentBugData;
  const cached = JSON.parse(localStorage.getItem('linearConfig') || '{}');
  document.getElementById('lm-key').value = cached.apiKey || '';
  document.getElementById('lm-team').value = cached.teamId || '';
  document.getElementById('lm-title').value = d.title || '';
  document.getElementById('lm-priority').value = d.priority === 'High' ? '1' : d.priority === 'Low' ? '4' : '2';
  document.getElementById('lm-assignee').value = cached.assignee || '';
  document.getElementById('lm-labels').value = cached.labels || 'bug';
  document.getElementById('lm-desc').value = buildDesc(d);
  document.getElementById('lm-status').textContent = '';
  document.getElementById('lm-overlay').style.display = 'flex';
}

function closeLinearModal() {
  document.getElementById('lm-overlay').style.display = 'none';
}

function buildDesc(d) {
  const steps = (d.steps||[]).map((s,i) => (i+1)+'. '+(s.status==='passed'?'✅':'❌')+' '+s.title+(s.status==='failed'?' ← FAILED':'')).join('\\n');
  return '## Bug Report\\n\\n'+
    '| Field | Value |\\n|---|---|\\n'+
    '| Bug ID | '+d.bugId+' |\\n'+
    '| Test Case | '+(d.tcId||'N/A')+' |\\n'+
    '| Module | '+d.module+' |\\n'+
    '| Severity | '+d.severity+' |\\n'+
    '| Reproducibility | '+d.reproducibility+' |\\n'+
    '| Environment | '+d.environment+' |\\n\\n'+
    '### Preconditions\\n'+d.preconditions+'\\n\\n'+
    '### Steps to Reproduce\\n'+steps+'\\n\\n'+
    '### Expected\\n'+d.expected+'\\n\\n'+
    '### Actual\\n'+d.actual+'\\n\\n'+
    '### Error\\n' + String.fromCharCode(96,96,96) + '\\n'+(d.error||'').substring(0,1200)+'\\n' + String.fromCharCode(96,96,96);
}

async function submitToLinear() {
  const status = document.getElementById('lm-status');
  const apiKey = document.getElementById('lm-key').value.trim();
  const teamId = document.getElementById('lm-team').value.trim();
  const title = document.getElementById('lm-title').value.trim();
  const priority = parseInt(document.getElementById('lm-priority').value);
  const assignee = document.getElementById('lm-assignee').value.trim();
  const labels = document.getElementById('lm-labels').value.trim();
  const desc = document.getElementById('lm-desc').value;

  // Cache settings
  localStorage.setItem('linearConfig', JSON.stringify({ apiKey, teamId, assignee, labels }));

  // If no API key, use linear.new URL fallback
  if (!apiKey) {
    const pMap = {1:'urgent',2:'high',3:'medium',4:'low'};
    const url = 'https://linear.new?title='+encodeURIComponent(title)+'&description='+encodeURIComponent(desc)+'&priority='+(pMap[priority]||'high')+'&label='+(labels||'bug');
    window.open(url, '_blank');
    status.textContent = '↗ Opened in Linear'; status.style.color = '#5e6ad2';
    return;
  }

  status.textContent = '⏳ Creating issue...'; status.style.color='#6b7280';

  try {
    // Use local Linear reporter server (avoids CORS issues)
    const localRes = await fetch('http://localhost:3333/report-bug', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ..._currentBugData,
        title: title,
        priority: {1:'urgent',2:'high',3:'medium',4:'low'}[priority] || 'high',
        linearApiKey: apiKey,
        linearTeamId: teamId,
        assigneeId: assignee || undefined,
        labels: labels || 'bug',
      })
    });
    const result = await localRes.json();

    if (result.success) {
      status.innerHTML = '✅ Created: <a href="'+result.url+'" target="_blank" style="color:#5e6ad2;font-weight:600">'+result.id+'</a>';
      status.style.color = '#16a34a';
      if (_currentBtn) {
        _currentBtn.textContent = '✓ ' + result.id;
        _currentBtn.style.background = '#16a34a';
        _currentBtn.onclick = () => window.open(result.url, '_blank');
      }
    } else {
      throw new Error(result.error || 'Failed to create issue');
    }
  } catch(e) {
    // Local server not running — try direct Linear API
    try {
      const gql = async (q, v) => {
        const r = await fetch('https://api.linear.app/graphql', {
          method:'POST', headers:{'Content-Type':'application/json','Authorization':apiKey},
          body: JSON.stringify({query:q, variables:v})
        });
        return r.json();
      };

    let labelIds = [];
    if (labels) {
      const lr = await gql('{ issueLabels { nodes { id name } } }');
      const allLabels = lr?.data?.issueLabels?.nodes || [];
      for (const l of labels.split(',')) {
        const found = allLabels.find(x => x.name.toLowerCase() === l.trim().toLowerCase());
        if (found) labelIds.push(found.id);
      }
    }

    const input = { title, description: desc, teamId, priority };
    if (labelIds.length) input.labelIds = labelIds;
    if (assignee) input.assigneeId = assignee;

    const result = await gql(
      'mutation($input: IssueCreateInput!) { issueCreate(input: $input) { success issue { id identifier url } } }',
      { input }
    );

    const issue = result?.data?.issueCreate;
    if (issue?.success) {
      status.innerHTML = '✅ Created: <a href="'+issue.issue.url+'" target="_blank" style="color:#5e6ad2;font-weight:600">'+issue.issue.identifier+'</a>';
      status.style.color = '#16a34a';
      if (_currentBtn) {
        _currentBtn.textContent = '✓ ' + issue.issue.identifier;
        _currentBtn.style.background = '#16a34a';
        _currentBtn.onclick = () => window.open(issue.issue.url, '_blank');
      }
    } else {
      status.textContent = '❌ Failed: ' + JSON.stringify(result?.errors || 'Unknown error');
      status.style.color = '#dc2626';
    }
    } catch(e2) {
      // Both local server and direct API failed — fallback to linear.new URL
      const pMap = {1:'urgent',2:'high',3:'medium',4:'low'};
      const url = 'https://linear.new?title='+encodeURIComponent(title)+'&description='+encodeURIComponent(desc)+'&priority='+(pMap[priority]||'high')+'&label='+(labels||'bug');
      window.open(url, '_blank');
      status.textContent = '↗ Opened in Linear (start local server: npm run linear)';
      status.style.color = '#d97706';
    }
  }
}
</script>

<!-- Linear Modal -->
<div id="lm-overlay" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,.4);z-index:999;align-items:center;justify-content:center">
<div style="background:#fff;border-radius:10px;width:560px;max-height:90vh;overflow-y:auto;box-shadow:0 20px 60px rgba(0,0,0,.2)">
  <div style="padding:16px 20px;border-bottom:1px solid #e5e7eb;display:flex;align-items:center;justify-content:space-between">
    <div style="font-size:14px;font-weight:600">Report Bug to Linear</div>
    <button onclick="closeLinearModal()" style="background:none;border:none;font-size:18px;cursor:pointer;color:#6b7280">×</button>
  </div>
  <div style="padding:16px 20px;display:flex;flex-direction:column;gap:10px;font-size:12px">
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
      <div><label style="color:#6b7280;font-weight:600;display:block;margin-bottom:3px">API Key</label><input id="lm-key" type="password" placeholder="lin_api_..." style="width:100%;padding:6px 8px;border:1px solid #e5e7eb;border-radius:4px;font-size:12px"></div>
      <div><label style="color:#6b7280;font-weight:600;display:block;margin-bottom:3px">Team ID</label><input id="lm-team" placeholder="Team UUID" style="width:100%;padding:6px 8px;border:1px solid #e5e7eb;border-radius:4px;font-size:12px"></div>
    </div>
    <div><label style="color:#6b7280;font-weight:600;display:block;margin-bottom:3px">Title</label><input id="lm-title" style="width:100%;padding:6px 8px;border:1px solid #e5e7eb;border-radius:4px;font-size:12px"></div>
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px">
      <div><label style="color:#6b7280;font-weight:600;display:block;margin-bottom:3px">Priority</label><select id="lm-priority" style="width:100%;padding:6px 8px;border:1px solid #e5e7eb;border-radius:4px;font-size:12px"><option value="1">Urgent</option><option value="2" selected>High</option><option value="3">Medium</option><option value="4">Low</option></select></div>
      <div><label style="color:#6b7280;font-weight:600;display:block;margin-bottom:3px">Assignee (ID)</label><input id="lm-assignee" placeholder="Optional" style="width:100%;padding:6px 8px;border:1px solid #e5e7eb;border-radius:4px;font-size:12px"></div>
      <div><label style="color:#6b7280;font-weight:600;display:block;margin-bottom:3px">Labels</label><input id="lm-labels" value="bug" style="width:100%;padding:6px 8px;border:1px solid #e5e7eb;border-radius:4px;font-size:12px"></div>
    </div>
    <div><label style="color:#6b7280;font-weight:600;display:block;margin-bottom:3px">Description (Markdown)</label><textarea id="lm-desc" rows="10" style="width:100%;padding:6px 8px;border:1px solid #e5e7eb;border-radius:4px;font-size:11px;font-family:monospace;resize:vertical"></textarea></div>
    <div style="display:flex;align-items:center;gap:12px;padding-top:4px">
      <button onclick="submitToLinear()" style="background:#5e6ad2;color:#fff;border:none;padding:8px 20px;border-radius:5px;font-size:12px;font-weight:600;cursor:pointer">Create Issue</button>
      <button onclick="closeLinearModal()" style="background:#f3f4f6;color:#374151;border:1px solid #e5e7eb;padding:8px 16px;border-radius:5px;font-size:12px;cursor:pointer">Cancel</button>
      <span id="lm-status" style="font-size:12px"></span>
    </div>
  </div>
</div>
</div>

</body></html>`;

    fs.writeFileSync(path.resolve('automation-report.html'), html, 'utf-8');
    console.log(`\n📋 Report: ${path.resolve('automation-report.html')}`);
  }
}

export default UnifiedReporter;
