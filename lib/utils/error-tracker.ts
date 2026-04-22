import { test as base, Page } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Runtime Error Tracker — captures all console errors, uncaught exceptions,
 * page errors, and network failures during test execution.
 * Generates a formatted HTML error report at the end.
 */

export interface RuntimeError {
  timestamp: string;
  test: string;
  type: 'console-error' | 'page-error' | 'uncaught-exception' | 'network-error' | 'unhandled-rejection';
  message: string;
  stack?: string;
  url?: string;
  source?: string;
}

const allErrors: RuntimeError[] = [];
const REPORT_PATH = path.resolve('error-report.html');

function now(): string {
  return new Date().toISOString().replace('T', ' ').substring(0, 23);
}

/** Attach error listeners to a page */
export function trackErrors(page: Page, testName: string) {
  // Console errors
  page.on('console', msg => {
    if (msg.type() === 'error') {
      const text = msg.text();
      if (text.includes('favicon.ico') || text.includes('manifest.json')) return;
      allErrors.push({
        timestamp: now(),
        test: testName,
        type: 'console-error',
        message: text.substring(0, 2000),
        source: msg.location()?.url || '',
        stack: msg.location() ? `${msg.location().url}:${msg.location().lineNumber}:${msg.location().columnNumber}` : undefined,
      });
    }
  });

  // Uncaught page errors (thrown exceptions)
  page.on('pageerror', error => {
    allErrors.push({
      timestamp: now(),
      test: testName,
      type: 'page-error',
      message: error.message.substring(0, 2000),
      stack: error.stack?.substring(0, 3000),
    });
  });

  // Network failures (4xx/5xx responses)
  page.on('response', response => {
    const url = response.url();
    if (url.match(/\.(js|css|png|jpg|svg|ico|woff|ttf|map|webp|gif)(\?|$)/)) return;
    if (url.includes('call-us.cometchat.io')) return;
    if (response.status() >= 400) {
      allErrors.push({
        timestamp: now(),
        test: testName,
        type: 'network-error',
        message: `HTTP ${response.status()} ${response.request().method()} ${url.substring(0, 200)}`,
        url: url.substring(0, 500),
      });
    }
  });

  // Request failures (network errors, timeouts)
  page.on('requestfailed', request => {
    const failure = request.failure();
    if (failure) {
      allErrors.push({
        timestamp: now(),
        test: testName,
        type: 'network-error',
        message: `Request failed: ${failure.errorText} — ${request.url().substring(0, 200)}`,
        url: request.url().substring(0, 500),
      });
    }
  });
}

/** Generate the HTML error report */
export function generateErrorReport() {
  const totalErrors = allErrors.length;
  const byType = {
    'console-error': allErrors.filter(e => e.type === 'console-error'),
    'page-error': allErrors.filter(e => e.type === 'page-error'),
    'uncaught-exception': allErrors.filter(e => e.type === 'uncaught-exception'),
    'network-error': allErrors.filter(e => e.type === 'network-error'),
    'unhandled-rejection': allErrors.filter(e => e.type === 'unhandled-rejection'),
  };

  const byTest: Record<string, RuntimeError[]> = {};
  for (const err of allErrors) {
    if (!byTest[err.test]) byTest[err.test] = [];
    byTest[err.test].push(err);
  }

  const escapeHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  const typeColors: Record<string, string> = {
    'console-error': '#e74c3c',
    'page-error': '#c0392b',
    'uncaught-exception': '#ff0000',
    'network-error': '#e67e22',
    'unhandled-rejection': '#d35400',
  };

  const typeBadge = (type: string) => {
    const isUncaught = type === 'uncaught-exception' || type === 'page-error';
    const bg = typeColors[type] || '#666';
    const extra = isUncaught ? 'font-size:13px;text-transform:uppercase;letter-spacing:0.5px;' : 'font-size:12px;';
    return `<span style="background:${bg};color:#fff;padding:2px 8px;border-radius:4px;${extra}font-weight:600">${isUncaught ? '⚠️ ' : ''}${type}</span>`;
  };

  let errorRows = '';
  for (const err of allErrors) {
    errorRows += `
      <tr>
        <td style="white-space:nowrap;color:#888;font-size:13px">${escapeHtml(err.timestamp)}</td>
        <td>${typeBadge(err.type)}</td>
        <td style="font-size:13px;max-width:200px;overflow:hidden;text-overflow:ellipsis">${escapeHtml(err.test)}</td>
        <td>
          <div style="font-size:13px;word-break:break-word">${escapeHtml(err.message)}</div>
          ${err.stack ? `<details style="margin-top:4px"><summary style="cursor:pointer;color:#888;font-size:12px">Stack trace</summary><pre style="font-size:11px;background:#1a1a2e;color:#e0e0e0;padding:8px;border-radius:4px;overflow-x:auto;margin-top:4px">${escapeHtml(err.stack)}</pre></details>` : ''}
          ${err.url ? `<div style="font-size:11px;color:#888;margin-top:2px">URL: ${escapeHtml(err.url)}</div>` : ''}
          ${err.source ? `<div style="font-size:11px;color:#888;margin-top:2px">Source: ${escapeHtml(err.source)}</div>` : ''}
        </td>
      </tr>`;
  }

  let summaryByTest = '';
  for (const [test, errors] of Object.entries(byTest)) {
    const types = [...new Set(errors.map(e => e.type))];
    summaryByTest += `
      <tr>
        <td style="font-size:13px">${escapeHtml(test)}</td>
        <td style="text-align:center;font-weight:600;color:${errors.length > 0 ? '#e74c3c' : '#27ae60'}">${errors.length}</td>
        <td>${types.map(t => typeBadge(t)).join(' ')}</td>
      </tr>`;
  }

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Runtime Error Report — ${new Date().toLocaleDateString()}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0d1117; color: #c9d1d9; padding: 24px; }
    h1 { color: #f0f6fc; margin-bottom: 8px; }
    h2 { color: #f0f6fc; margin: 24px 0 12px; border-bottom: 1px solid #21262d; padding-bottom: 8px; }
    .summary { display: flex; gap: 16px; margin: 16px 0 24px; flex-wrap: wrap; }
    .card { background: #161b22; border: 1px solid #21262d; border-radius: 8px; padding: 16px 24px; min-width: 140px; }
    .card .number { font-size: 32px; font-weight: 700; }
    .card .label { font-size: 13px; color: #8b949e; margin-top: 4px; }
    .red { color: #f85149; }
    .orange { color: #d29922; }
    .green { color: #3fb950; }
    .purple { color: #bc8cff; }
    table { width: 100%; border-collapse: collapse; margin: 12px 0; }
    th { text-align: left; padding: 10px 12px; background: #161b22; color: #8b949e; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 1px solid #21262d; }
    td { padding: 10px 12px; border-bottom: 1px solid #21262d; vertical-align: top; }
    tr:hover { background: #161b22; }
    .no-errors { text-align: center; padding: 48px; color: #3fb950; font-size: 18px; }
    .timestamp { color: #8b949e; font-size: 12px; }
    pre { white-space: pre-wrap; }
  </style>
</head>
<body>
  <h1>🔴 Runtime Error Report</h1>
  <p class="timestamp">Generated: ${new Date().toLocaleString()} | App: localhost:3000</p>

  <div class="summary">
    <div class="card">
      <div class="number ${totalErrors > 0 ? 'red' : 'green'}">${totalErrors}</div>
      <div class="label">Total Errors</div>
    </div>
    <div class="card">
      <div class="number red">${byType['page-error'].length}</div>
      <div class="label">Page Errors (Uncaught)</div>
    </div>
    <div class="card">
      <div class="number orange">${byType['console-error'].length}</div>
      <div class="label">Console Errors</div>
    </div>
    <div class="card">
      <div class="number orange">${byType['network-error'].length}</div>
      <div class="label">Network Errors</div>
    </div>
    <div class="card">
      <div class="number green">${Object.keys(byTest).length}</div>
      <div class="label">Tests with Errors</div>
    </div>
  </div>

  ${totalErrors === 0 ? '<div class="no-errors">✅ No runtime errors detected during test execution.</div>' : `

  ${byType['uncaught-exception'].length > 0 || byType['page-error'].length > 0 ? `
  <h2 style="color:#ff4444">⚠️ Uncaught Runtime Errors (${byType['uncaught-exception'].length + byType['page-error'].length})</h2>
  <p style="color:#8b949e;margin-bottom:12px">These errors appeared as red overlays in the app during test execution. They indicate unhandled exceptions that need developer attention.</p>
  <table>
    <thead><tr><th>Timestamp</th><th>Test</th><th>Error Details</th><th>Source</th></tr></thead>
    <tbody>${[...byType['uncaught-exception'], ...byType['page-error']].map(err => `
      <tr style="background:#1a0000">
        <td style="white-space:nowrap;color:#888;font-size:13px">${escapeHtml(err.timestamp)}</td>
        <td style="font-size:13px;max-width:200px">${escapeHtml(err.test)}</td>
        <td>
          <div style="font-size:13px;word-break:break-word;color:#ff6666">${escapeHtml(err.message)}</div>
          ${err.stack ? `<details open style="margin-top:4px"><summary style="cursor:pointer;color:#ff8888;font-size:12px">Stack trace / HTML</summary><pre style="font-size:11px;background:#1a0a0a;color:#ffaaaa;padding:8px;border-radius:4px;overflow-x:auto;margin-top:4px;border:1px solid #330000">${escapeHtml(err.stack)}</pre></details>` : ''}
        </td>
        <td style="font-size:11px;color:#888">${escapeHtml(err.source || err.url || '')}</td>
      </tr>`).join('')}
    </tbody>
  </table>
  ` : ''}

  <h2>Errors by Test</h2>
  <table>
    <thead><tr><th>Test</th><th>Count</th><th>Types</th></tr></thead>
    <tbody>${summaryByTest}</tbody>
  </table>

  <h2>All Errors (${totalErrors})</h2>
  <table>
    <thead><tr><th>Timestamp</th><th>Type</th><th>Test</th><th>Details</th></tr></thead>
    <tbody>${errorRows}</tbody>
  </table>
  `}
</body>
</html>`;

  fs.writeFileSync(REPORT_PATH, html, 'utf-8');
  console.log(`\n📄 Error report: ${REPORT_PATH} (${totalErrors} errors)`);
}

/** Get all collected errors */
export function getErrors(): RuntimeError[] {
  return allErrors;
}

/** Add an error programmatically (used by error-fixture for overlay errors) */
export function addError(error: RuntimeError) {
  allErrors.push(error);
}

/** Clear all errors (for fresh run) */
export function clearErrors() {
  allErrors.length = 0;
}
