/**
 * Linear Bug Reporter — Creates Linear issues with video + screenshot attachments.
 *
 * Usage: Called from the automation report via a local Express server.
 *
 * Setup:
 *   1. Get your Linear API key from: Settings → API → Personal API keys
 *   2. Get your team ID: run `npx ts-node utils/linear-reporter.ts --teams`
 *   3. Add to .env or set environment variables:
 *        LINEAR_API_KEY=lin_api_xxxxx
 *        LINEAR_TEAM_ID=xxxxx
 *
 * The report's "Report to Linear" button sends a POST to localhost:3333/report-bug
 * with the bug data. This server uploads files and creates the issue.
 */

import * as http from 'http';
import * as fs from 'fs';
import * as path from 'path';

const LINEAR_API = 'https://api.linear.app/graphql';
const PORT = 3333;

function getConfig() {
  // Try .env file first
  const envPath = path.resolve('.env');
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, 'utf-8').split('\n');
    for (const line of lines) {
      const [key, ...val] = line.split('=');
      if (key?.trim() && val.length) process.env[key.trim()] = val.join('=').trim();
    }
  }
  return {
    apiKey: process.env.LINEAR_API_KEY || '',
    teamId: process.env.LINEAR_TEAM_ID || '',
  };
}

async function linearGql(apiKey: string, query: string, variables?: any) {
  const res = await fetch(LINEAR_API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': apiKey },
    body: JSON.stringify({ query, variables }),
  });
  return res.json();
}

async function uploadFile(apiKey: string, filePath: string): Promise<string | null> {
  if (!filePath || !fs.existsSync(filePath)) return null;

  const stat = fs.statSync(filePath);
  const ext = path.extname(filePath).toLowerCase();
  const mimeMap: Record<string, string> = {
    '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
    '.webm': 'video/webm', '.mp4': 'video/mp4', '.gif': 'image/gif',
  };
  const mime = mimeMap[ext] || 'application/octet-stream';
  const fileName = path.basename(filePath);

  // Step 1: Request upload URL
  const uploadRes = await linearGql(apiKey, `
    mutation FileUpload($contentType: String!, $filename: String!, $size: Int!) {
      fileUpload(contentType: $contentType, filename: $filename, size: $size) {
        success
        uploadFile { uploadUrl assetUrl headers { key value } }
      }
    }
  `, { contentType: mime, filename: fileName, size: stat.size });

  const upload = uploadRes?.data?.fileUpload;
  if (!upload?.success || !upload?.uploadFile) {
    console.error('[Linear] Failed to get upload URL:', JSON.stringify(uploadRes?.errors));
    return null;
  }

  // Step 2: PUT file to pre-signed URL
  const headers: Record<string, string> = { 'Content-Type': mime, 'Cache-Control': 'public, max-age=31536000' };
  for (const h of upload.uploadFile.headers) headers[h.key] = h.value;

  const fileBuffer = fs.readFileSync(filePath);
  const putRes = await fetch(upload.uploadFile.uploadUrl, {
    method: 'PUT', headers, body: fileBuffer,
  });

  if (!putRes.ok) {
    console.error('[Linear] Failed to upload file:', putRes.status, putRes.statusText);
    return null;
  }

  console.log(`[Linear] Uploaded: ${fileName} → ${upload.uploadFile.assetUrl}`);
  return upload.uploadFile.assetUrl;
}

async function createIssue(apiKey: string, teamId: string, bugData: any): Promise<any> {
  // Upload screenshot and video if paths provided
  let screenshotUrl = '';
  let videoUrl = '';

  if (bugData.screenshotPath) {
    console.log(`[Linear] Uploading screenshot: ${bugData.screenshotPath}`);
    screenshotUrl = await uploadFile(apiKey, bugData.screenshotPath) || '';
  }
  if (bugData.videoPath) {
    console.log(`[Linear] Uploading video: ${bugData.videoPath}`);
    videoUrl = await uploadFile(apiKey, bugData.videoPath) || '';
  }

  // Build markdown description
  const desc = [
    `## Bug Report`,
    '',
    `| Field | Value |`,
    `|-------|-------|`,
    `| **Bug ID** | ${bugData.bugId} |`,
    `| **Test Case** | ${bugData.tcId || 'N/A'} |`,
    `| **Module** | ${bugData.module} |`,
    `| **Severity** | ${bugData.severity} |`,
    `| **Reproducibility** | ${bugData.reproducibility} |`,
    `| **Environment** | ${bugData.environment} |`,
    '',
    `### Preconditions`,
    bugData.preconditions || 'User is logged in',
    '',
    `### Steps to Reproduce`,
    ...(bugData.steps || []).map((s: any, i: number) =>
      `${i + 1}. ${s.status === 'passed' ? '✅' : '❌'} ${s.title}${s.status === 'failed' ? ' **← FAILED**' : ''}`
    ),
    '',
    `### Expected Result`,
    bugData.expected || 'All assertions pass',
    '',
    `### Actual Result`,
    bugData.actual || 'Test failed',
    '',
    `### Error Log`,
    '```',
    (bugData.error || '').substring(0, 1500),
    '```',
    screenshotUrl ? `\n### Screenshot\n![Failure Screenshot](${screenshotUrl})` : '',
    videoUrl ? `\n### Video\n[Watch failure recording](${videoUrl})` : '',
    bugData.stack ? `\n<details><summary>Stack Trace</summary>\n\n\`\`\`\n${bugData.stack.substring(0, 2000)}\n\`\`\`\n</details>` : '',
  ].filter(Boolean).join('\n');

  // Map priority
  const priorityMap: Record<string, number> = { urgent: 1, high: 2, medium: 3, low: 4 };
  const priority = priorityMap[bugData.priority?.toLowerCase()] || 2;

  // Create issue
  const result = await linearGql(apiKey, `
    mutation IssueCreate($title: String!, $description: String!, $teamId: String!, $priority: Int, $labelIds: [String!]) {
      issueCreate(input: {
        title: $title
        description: $description
        teamId: $teamId
        priority: $priority
        labelIds: $labelIds
      }) {
        success
        issue { id identifier url title }
      }
    }
  `, {
    title: bugData.title.substring(0, 200),
    description: desc,
    teamId,
    priority,
    labelIds: bugData.labelIds || [],
  });

  return result?.data?.issueCreate;
}

// ── HTTP Server ──

function startServer() {
  const { apiKey, teamId } = getConfig();

  if (!apiKey) {
    console.warn('\n⚠️  LINEAR_API_KEY not set in .env — you can still enter it in the report modal.');
    console.warn('   For automatic usage, add to .env:\n   LINEAR_API_KEY=lin_api_xxxxx\n   LINEAR_TEAM_ID=xxxxx\n');
  }

  const server = http.createServer(async (req, res) => {
    // CORS headers for the report HTML
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') { res.writeHead(200); res.end(); return; }

    if (req.method === 'POST' && req.url === '/report-bug') {
      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', async () => {
        try {
          const bugData = JSON.parse(body);
          console.log(`\n[Linear] Creating issue: ${bugData.title}`);

          // Allow API key and team ID from request body (from HTML report modal)
          const effectiveApiKey = bugData.linearApiKey || apiKey;
          const effectiveTeamId = bugData.linearTeamId || teamId;

          if (!effectiveApiKey) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: 'No API key provided. Set LINEAR_API_KEY in .env or enter it in the modal.' }));
            return;
          }
          if (!effectiveTeamId) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: 'No team ID provided. Set LINEAR_TEAM_ID in .env or enter it in the modal.' }));
            return;
          }

          const result = await createIssue(effectiveApiKey, effectiveTeamId, bugData);

          if (result?.success) {
            const issue = result.issue;
            console.log(`[Linear] ✅ Created: ${issue.identifier} — ${issue.url}`);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true, url: issue.url, id: issue.identifier }));
          } else {
            console.error('[Linear] ❌ Failed to create issue');
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: 'Failed to create issue' }));
          }
        } catch (err: any) {
          console.error('[Linear] Error:', err.message);
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: err.message }));
        }
      });
      return;
    }

    // List teams endpoint (for setup)
    if (req.method === 'GET' && req.url === '/teams') {
      const result = await linearGql(apiKey, `{ teams { nodes { id name key } } }`);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(result?.data?.teams?.nodes || []));
      return;
    }

    // Health check
    if (req.method === 'GET' && req.url === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok', teamId }));
      return;
    }

    res.writeHead(404); res.end('Not found');
  });

  server.listen(PORT, () => {
    console.log(`\n🔗 Linear Bug Reporter running on http://localhost:${PORT}`);
    console.log(`   Team ID: ${teamId || '(not set — use /teams to find it)'}`);
    console.log(`   POST /report-bug — create issue with attachments`);
    console.log(`   GET  /teams      — list your Linear teams`);
    console.log(`   GET  /health     — check status\n`);
  });
}

// CLI: --teams flag to list teams
if (process.argv.includes('--teams')) {
  const { apiKey } = getConfig();
  if (!apiKey) { console.error('Set LINEAR_API_KEY in .env'); process.exit(1); }
  linearGql(apiKey, `{ teams { nodes { id name key } } }`).then(r => {
    console.log('\nYour Linear teams:');
    for (const t of r?.data?.teams?.nodes || []) {
      console.log(`  ${t.key}  ${t.name}  (ID: ${t.id})`);
    }
  });
} else {
  startServer();
}
