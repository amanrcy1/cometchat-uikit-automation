import { chromium } from '@playwright/test';
import * as fs from 'fs';

(async () => {
  const browser = await chromium.launch({ headless: false, args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] });
  const context = await browser.newContext({
    storageState: fs.existsSync('utils/.auth/session.json') ? 'utils/.auth/session.json' : undefined,
    baseURL: 'http://localhost:3000',
    permissions: ['microphone'],
  });
  const page = await context.newPage();

  // Nuke overlays
  await page.addInitScript(() => {
    setInterval(() => {
      const t = document.body?.innerText || '';
      if (!t.includes('Uncaught runtime error')) return;
      for (const el of document.querySelectorAll('*')) {
        const txt = (el as HTMLElement).textContent?.trim() || '';
        if ((txt === '×' || txt === 'X' || txt === '✕') && (el as HTMLElement).offsetWidth > 0 && (el as HTMLElement).offsetWidth < 50) {
          (el as HTMLElement).click(); return;
        }
      }
      document.querySelectorAll('body > *').forEach(el => {
        if ((el as HTMLElement).id !== 'root' && ((el as HTMLElement).innerText || '').includes('Uncaught runtime error'))
          (el as HTMLElement).remove();
      });
    }, 100);
  });

  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(5000);

  // Login
  const loginBtn = page.locator('button:has-text("Login")');
  if (await loginBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
    const uidBtn = page.locator('text=cometchat-uid-1');
    if (await uidBtn.isVisible({ timeout: 8000 }).catch(() => false)) await uidBtn.click();
    else await page.locator('input[placeholder="Enter your UID"]').fill('cometchat-uid-1');
    await loginBtn.click();
    await page.waitForTimeout(5000);
  }

  // Open chat
  await page.locator('div.cometchat-tab-component__tab-text:has-text("Users")').click();
  await page.waitForTimeout(2000);
  await page.locator('div.cometchat-users div.cometchat-list-item').first().click();
  await page.waitForTimeout(3000);

  const composer = page.locator('.cometchat-compact-message-composer__input[contenteditable]');
  const sendBtn = page.locator('button.cometchat-button[title="Send Message"]');

  // Helper: send formatted text and capture bubble HTML
  async function sendFormatted(formatBtn: string, text: string, label: string) {
    await composer.click();
    await composer.fill('');
    await page.locator(`button.cometchat-button[title="${formatBtn}"]`).click();
    await page.waitForTimeout(200);
    await page.keyboard.type(text);
    await page.waitForTimeout(200);
    // Toggle off
    await page.locator(`button.cometchat-button[title="${formatBtn}"]`).click();
    await sendBtn.click();
    await page.waitForTimeout(3000);

    // Get the last bubble's innerHTML
    const bubble = page.locator('div.cometchat-message-bubble-outgoing').last();
    const html = await bubble.evaluate(el => {
      // Find the text bubble content
      const textBubble = el.querySelector('[class*="text-bubble"], [class*="cometchat-text-bubble"]');
      return {
        outerHTML: textBubble ? textBubble.innerHTML.substring(0, 500) : el.innerHTML.substring(0, 500),
        innerText: textBubble ? (textBubble as HTMLElement).innerText : (el as HTMLElement).innerText,
        fullHTML: el.innerHTML.substring(0, 1000),
      };
    });
    console.log(`\n=== ${label} ===`);
    console.log('Text:', html.innerText);
    console.log('HTML:', html.outerHTML);
    return html;
  }

  // Test each format
  const results: Record<string, any> = {};

  results.bold = await sendFormatted('Bold', 'bold text here', 'BOLD');
  results.italic = await sendFormatted('Italic', 'italic text here', 'ITALIC');
  results.underline = await sendFormatted('Underline', 'underline text here', 'UNDERLINE');
  results.strikethrough = await sendFormatted('Strikethrough', 'strike text here', 'STRIKETHROUGH');
  results.code = await sendFormatted('Code', 'code text here', 'CODE INLINE');
  results.codeBlock = await sendFormatted('Code Block', 'code block here', 'CODE BLOCK');
  results.blockquote = await sendFormatted('Blockquote', 'quoted text here', 'BLOCKQUOTE');

  // Numbered list
  await composer.click();
  await composer.fill('');
  await page.locator('button.cometchat-button[title="Numbered List"]').click();
  await page.waitForTimeout(200);
  await page.keyboard.type('item one');
  await page.keyboard.press('Enter');
  await page.keyboard.type('item two');
  await sendBtn.click();
  await page.waitForTimeout(3000);
  const olBubble = page.locator('div.cometchat-message-bubble-outgoing').last();
  results.numberedList = await olBubble.evaluate(el => {
    const tb = el.querySelector('[class*="text-bubble"]');
    return { html: tb ? tb.innerHTML.substring(0, 500) : el.innerHTML.substring(0, 500) };
  });
  console.log('\n=== NUMBERED LIST ===');
  console.log('HTML:', results.numberedList.html);

  // Bulleted list
  await composer.click();
  await composer.fill('');
  await page.locator('button.cometchat-button[title="Bulleted List"]').click();
  await page.waitForTimeout(200);
  await page.keyboard.type('bullet one');
  await page.keyboard.press('Enter');
  await page.keyboard.type('bullet two');
  await sendBtn.click();
  await page.waitForTimeout(3000);
  const ulBubble = page.locator('div.cometchat-message-bubble-outgoing').last();
  results.bulletedList = await ulBubble.evaluate(el => {
    const tb = el.querySelector('[class*="text-bubble"]');
    return { html: tb ? tb.innerHTML.substring(0, 500) : el.innerHTML.substring(0, 500) };
  });
  console.log('\n=== BULLETED LIST ===');
  console.log('HTML:', results.bulletedList.html);

  // Summary
  console.log('\n\n========== RICH TEXT RENDERING SUMMARY ==========');
  for (const [fmt, data] of Object.entries(results)) {
    const html = data.outerHTML || data.html || '';
    const tags = {
      bold: html.includes('<strong') || html.includes('<b>') || html.includes('<b '),
      italic: html.includes('<em') || html.includes('<i>') || html.includes('<i '),
      underline: html.includes('<u>') || html.includes('<u ') || html.includes('text-decoration'),
      strikethrough: html.includes('<s>') || html.includes('<s ') || html.includes('<del') || html.includes('line-through'),
      code: html.includes('<code'),
      pre: html.includes('<pre'),
      blockquote: html.includes('<blockquote'),
      ol: html.includes('<ol'),
      ul: html.includes('<ul'),
      li: html.includes('<li'),
    };
    const found = Object.entries(tags).filter(([, v]) => v).map(([k]) => k);
    console.log(`${fmt}: ${found.length > 0 ? found.join(', ') : 'NO HTML TAGS FOUND'}`);
  }

  await browser.close();
})();
