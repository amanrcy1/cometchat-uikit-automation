import { Page, TestInfo } from '@playwright/test';

/**
 * Runtime Error Handler
 *
 * Detects "Uncaught runtime errors:" overlays that appear in the React app,
 * instantly clicks the × button to dismiss them, captures a screenshot,
 * and attaches the error details to the Playwright test report.
 *
 * Usage:
 *   const handler = new RuntimeErrorHandler(page, testInfo);
 *   await handler.install();          // call once after page creation
 *   await handler.dismissIfPresent(); // call before any action that might be blocked
 */
export class RuntimeErrorHandler {
  private capturedErrors: Array<{
    timestamp: string;
    message: string;
    stack: string;
    url: string;
    testStep: string;
  }> = [];

  constructor(
    private page: Page,
    private testInfo?: TestInfo,
  ) {}

  /**
   * Install a MutationObserver + polling loop that:
   * 1. Detects the React "Uncaught runtime errors:" overlay the instant it appears
   * 2. Clicks the × button to dismiss it properly
   * 3. Captures the error text for reporting
   *
   * Call once after page creation (before any navigation).
   */
  async install() {
    await this.page.addInitScript(() => {
      (window as any).__runtimeErrors = (window as any).__runtimeErrors || [];

      function getOverlayText(el: Element): string {
        return (el as HTMLElement).innerText || el.textContent || '';
      }

      function isRuntimeErrorOverlay(el: Element): boolean {
        const text = getOverlayText(el);
        const style = window.getComputedStyle(el as HTMLElement);
        // React error overlay: fixed position, covers viewport, contains error text
        return (
          (style.position === 'fixed' || style.position === 'absolute') &&
          (
            text.includes('Uncaught runtime error') ||
            text.includes('Uncaught runtime errors') ||
            text.includes('Cannot read properties') ||
            text.includes('is not a function') ||
            text.includes('is not defined') ||
            text.includes('handleError') ||
            text.includes('[object Object]')
          ) &&
          (
            text.includes('ERROR') ||
            text.includes('Error') ||
            text.includes('bundle.js')
          )
        );
      }

      function dismissOverlay(el: Element) {
        const text = getOverlayText(el);
        const stack = text.substring(0, 3000);

        // Capture error details
        (window as any).__runtimeErrors.push({
          timestamp: new Date().toISOString(),
          message: stack,
          url: window.location.href,
        });

        // Try clicking × button first (proper React dismissal)
        const allClickable = el.querySelectorAll('button, [role="button"], span, div, svg');
        let dismissed = false;
        allClickable.forEach(btn => {
          const btnText = (btn as HTMLElement).textContent?.trim() || '';
          const ariaLabel = btn.getAttribute('aria-label') || '';
          if (
            btnText === '×' || btnText === 'X' || btnText === '✕' || btnText === 'x' ||
            ariaLabel.toLowerCase().includes('close') ||
            ariaLabel.toLowerCase().includes('dismiss') ||
            (btn as HTMLElement).style?.cursor === 'pointer' && btnText.length <= 2
          ) {
            (btn as HTMLElement).click();
            dismissed = true;
          }
        });

        // Also try the top-right positioned button (the × in the screenshot)
        if (!dismissed) {
          const topRightBtn = el.querySelector('[style*="position: absolute"][style*="top"]') ||
            el.querySelector('button:last-child') ||
            el.querySelector('[class*="close"]');
          if (topRightBtn) {
            (topRightBtn as HTMLElement).click();
            dismissed = true;
          }
        }

        // Force remove if click didn't work
        if (!dismissed || document.contains(el)) {
          (el as HTMLElement).remove();
        }
      }

      function scanAndDismiss() {
        // Check all direct children of body
        document.querySelectorAll('body > *').forEach(el => {
          if (el.id === 'root') return;
          if (isRuntimeErrorOverlay(el)) dismissOverlay(el);
        });

        // Also check inside #root for overlays rendered by React error boundary
        const root = document.getElementById('root');
        if (root) {
          root.querySelectorAll('[style*="position: fixed"], [style*="position:fixed"]').forEach(el => {
            if (isRuntimeErrorOverlay(el)) dismissOverlay(el);
          });
        }

        // Check for webpack iframe overlay
        document.querySelectorAll('iframe#webpack-dev-server-client-overlay').forEach(el => {
          try {
            const iframe = el as HTMLIFrameElement;
            const doc = iframe.contentDocument || iframe.contentWindow?.document;
            if (doc) {
              const text = doc.body?.innerText || '';
              if (text.length > 10) {
                (window as any).__runtimeErrors.push({
                  timestamp: new Date().toISOString(),
                  message: text.substring(0, 3000),
                  url: window.location.href,
                });
                // Click dismiss button inside iframe
                doc.querySelectorAll('button').forEach(btn => {
                  const t = btn.textContent || '';
                  if (t.includes('×') || t.includes('X') || t.includes('Dismiss')) btn.click();
                });
              }
            }
          } catch (_) { /* cross-origin */ }
          el.remove();
        });
      }

      // Run immediately
      scanAndDismiss();

      // MutationObserver — fires instantly when overlay appears
      const observer = new MutationObserver(() => scanAndDismiss());
      observer.observe(document.documentElement, { childList: true, subtree: true });

      // Polling fallback every 300ms
      setInterval(scanAndDismiss, 300);
    });
  }

  /**
   * Actively check for and dismiss any visible runtime error overlay.
   * Call before any action that might be blocked by the overlay.
   * Takes a screenshot and attaches error details to the test report if found.
   */
  async dismissIfPresent(stepName = 'unknown step') {
    // Check if overlay is visible in the DOM
    const overlayInfo = await this.page.evaluate(() => {
      const selectors = [
        // React error overlay patterns
        'body > div[style*="position: fixed"]',
        'body > div[style*="position:fixed"]',
        'body > section[style*="position: fixed"]',
        '#root > div[style*="position: fixed"]',
      ];

      for (const sel of selectors) {
        const els = document.querySelectorAll(sel);
        for (const el of els) {
          const text = (el as HTMLElement).innerText || '';
          if (
            text.includes('Uncaught runtime error') ||
            text.includes('Uncaught runtime errors') ||
            text.includes('handleError') ||
            text.includes('[object Object]')
          ) {
            return {
              found: true,
              message: text.substring(0, 2000),
              html: (el as HTMLElement).outerHTML.substring(0, 1000),
            };
          }
        }
      }
      return { found: false, message: '', html: '' };
    });

    if (overlayInfo.found) {
      console.warn(`[RuntimeErrorHandler] ⚠️ Runtime error overlay detected at step: "${stepName}"`);
      console.warn(`[RuntimeErrorHandler] Error: ${overlayInfo.message.substring(0, 500)}`);

      // Take screenshot before dismissing
      const screenshotBuffer = await this.page.screenshot({ fullPage: false });

      // Attach to test report if testInfo is available
      if (this.testInfo) {
        await this.testInfo.attach(`runtime-error-${Date.now()}.png`, {
          body: screenshotBuffer,
          contentType: 'image/png',
        });
        await this.testInfo.attach(`runtime-error-details-${Date.now()}.txt`, {
          body: Buffer.from(
            `Step: ${stepName}\n` +
            `URL: ${this.page.url()}\n` +
            `Timestamp: ${new Date().toISOString()}\n\n` +
            `Error:\n${overlayInfo.message}`
          ),
          contentType: 'text/plain',
        });
      }

      // Store for later reporting
      this.capturedErrors.push({
        timestamp: new Date().toISOString(),
        message: overlayInfo.message,
        stack: overlayInfo.html,
        url: this.page.url(),
        testStep: stepName,
      });

      // Force dismiss via evaluate
      await this.page.evaluate(() => {
        const selectors = [
          'body > div[style*="position: fixed"]',
          'body > div[style*="position:fixed"]',
          'body > section[style*="position: fixed"]',
          '#root > div[style*="position: fixed"]',
        ];
        for (const sel of selectors) {
          document.querySelectorAll(sel).forEach(el => {
            const text = (el as HTMLElement).innerText || '';
            if (
              text.includes('Uncaught runtime error') ||
              text.includes('Uncaught runtime errors') ||
              text.includes('handleError')
            ) {
              // Try × button first
              el.querySelectorAll('button, span, div').forEach(btn => {
                const t = (btn as HTMLElement).textContent?.trim() || '';
                if (t === '×' || t === 'X' || t === '✕') (btn as HTMLElement).click();
              });
              // Force remove
              (el as HTMLElement).remove();
            }
          });
        }
        // Also kill webpack iframe
        document.querySelectorAll('iframe#webpack-dev-server-client-overlay').forEach(el => el.remove());
      });

      await this.page.waitForTimeout(300);
    }

    // Also drain any errors captured by the init script
    const scriptErrors = await this.page.evaluate(() => {
      const errors = (window as any).__runtimeErrors || [];
      (window as any).__runtimeErrors = [];
      return errors;
    });

    for (const err of scriptErrors) {
      if (this.testInfo) {
        await this.testInfo.attach(`runtime-error-captured-${Date.now()}.txt`, {
          body: Buffer.from(
            `Captured by overlay watcher\n` +
            `URL: ${err.url}\n` +
            `Timestamp: ${err.timestamp}\n\n` +
            `Error:\n${err.message}`
          ),
          contentType: 'text/plain',
        });
      }
    }

    return overlayInfo.found;
  }

  /** Get all captured errors during this session */
  getCapturedErrors() {
    return this.capturedErrors;
  }

  /** Log a summary of all captured errors */
  logSummary() {
    if (this.capturedErrors.length === 0) return;
    console.warn(`\n[RuntimeErrorHandler] ⚠️ ${this.capturedErrors.length} runtime error(s) captured:`);
    this.capturedErrors.forEach((err, i) => {
      console.warn(`  ${i + 1}. [${err.timestamp}] at step "${err.testStep}": ${err.message.substring(0, 200)}`);
    });
  }
}
