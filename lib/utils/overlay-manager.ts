import { Page } from '@playwright/test';

/**
 * Centralized Error Overlay Manager
 *
 * Single source of truth for dismissing React error overlays,
 * webpack dev server iframes, and any fixed-position blockers.
 *
 * Used by: auth.setup.ts, error-fixture.ts, test.fixture.ts, ChatPage.ts
 */

/** The nuke script injected into the page via addInitScript or evaluate */
const NUKE_SCRIPT = () => {
  (window as any).__runtimeErrors = (window as any).__runtimeErrors || [];

  function nuke() {
    // Kill webpack iframe
    document.querySelectorAll('iframe#webpack-dev-server-client-overlay').forEach(el => el.remove());
    document.querySelectorAll('iframe').forEach(el => {
      const s = window.getComputedStyle(el);
      if (s.position === 'fixed' && parseInt(s.zIndex || '0') > 100) el.remove();
    });

    const body = document.body;
    if (!body) return;
    const bodyText = body.innerText || '';
    if (!bodyText.includes('Uncaught runtime error')) return;

    // Capture error
    (window as any).__runtimeErrors.push({
      timestamp: new Date().toISOString(),
      type: 'runtime-overlay',
      message: bodyText.substring(0, 2000),
      url: window.location.href,
    });

    // Click × button
    for (const el of document.querySelectorAll('button, [role="button"], span, a, div')) {
      const t = (el as HTMLElement).textContent?.trim() || '';
      if ((t === '×' || t === 'X' || t === '✕' || t === '✖') && (el as HTMLElement).offsetWidth > 0) {
        (el as HTMLElement).click();
        return;
      }
    }

    // Fallback: remove overlay elements
    document.querySelectorAll('body > *').forEach(el => {
      if ((el as HTMLElement).id === 'root') return;
      const t = (el as HTMLElement).innerText || '';
      if (t.includes('Uncaught runtime error')) (el as HTMLElement).remove();
    });
  }

  if (!(window as any).__nukeInstalled) {
    (window as any).__nukeInstalled = true;
    nuke();
    new MutationObserver(nuke).observe(document.documentElement, { childList: true, subtree: true });
    setInterval(nuke, 200);
  }
};

/**
 * Install the overlay auto-dismiss script via addInitScript.
 * Call once after page creation, before any navigation.
 */
export async function installOverlayAutoDismiss(page: Page): Promise<void> {
  await page.addInitScript(NUKE_SCRIPT);
}

/**
 * Inject the nuke script directly into the current page context.
 * Useful when the page has already loaded and addInitScript hasn't fired.
 */
export async function injectOverlayNuke(page: Page): Promise<void> {
  await page.evaluate(NUKE_SCRIPT).catch(() => {});
}

/**
 * Force-dismiss any visible runtime error overlay right now.
 * Returns true if an overlay was found and dismissed.
 */
export async function dismissOverlay(page: Page): Promise<boolean> {
  const hasOverlay = await page.evaluate(() =>
    (document.body?.innerText || '').includes('Uncaught runtime error')
  ).catch(() => false);

  if (!hasOverlay) {
    // Quick iframe cleanup only
    await nukeIframes(page);
    return false;
  }

  // Capture + click × + fallback remove
  await page.evaluate(() => {
    const bodyText = document.body?.innerText || '';
    (window as any).__runtimeErrors = (window as any).__runtimeErrors || [];
    (window as any).__runtimeErrors.push({
      timestamp: new Date().toISOString(),
      type: 'runtime-overlay',
      message: bodyText.substring(0, 2000),
      url: window.location.href,
    });

    let clicked = false;
    for (const el of document.querySelectorAll('button, [role="button"], span, a, div')) {
      const t = (el as HTMLElement).textContent?.trim() || '';
      if ((t === '×' || t === 'X' || t === '✕' || t === '✖') && (el as HTMLElement).offsetWidth > 0) {
        (el as HTMLElement).click();
        clicked = true;
        break;
      }
    }

    if (!clicked) {
      document.querySelectorAll('body > *').forEach(el => {
        if ((el as HTMLElement).id !== 'root') {
          if (((el as HTMLElement).innerText || '').includes('Uncaught runtime error')) {
            (el as HTMLElement).remove();
          }
        }
      });
    }

    // Kill iframes too
    document.querySelectorAll('iframe#webpack-dev-server-client-overlay').forEach(el => el.remove());
    document.querySelectorAll('iframe').forEach(el => {
      const s = window.getComputedStyle(el);
      if (s.position === 'fixed' && parseInt(s.zIndex || '0') > 100) el.remove();
    });
  }).catch(() => {});

  await page.waitForTimeout(200);

  // Nuclear fallback if still there
  const stillThere = await page.evaluate(() =>
    (document.body?.innerText || '').includes('Uncaught runtime error')
  ).catch(() => false);
  if (stillThere) {
    await page.evaluate(() => {
      document.querySelectorAll('body > *').forEach(el => {
        if ((el as HTMLElement).id !== 'root') (el as HTMLElement).remove();
      });
    }).catch(() => {});
  }

  return true;
}

/**
 * Force-remove all iframes that intercept pointer events.
 */
export async function nukeIframes(page: Page): Promise<void> {
  await page.evaluate(() => {
    document.querySelectorAll('iframe#webpack-dev-server-client-overlay').forEach(el => el.remove());
    document.querySelectorAll('iframe').forEach(el => {
      const s = window.getComputedStyle(el);
      if (s.position === 'fixed' && parseInt(s.zIndex || '0') > 100) el.remove();
    });
  }).catch(() => {});
}

/**
 * Drain all runtime errors captured by the nuke script from the page.
 * Returns the array of captured error objects.
 */
export async function drainRuntimeErrors(page: Page): Promise<any[]> {
  if (page.isClosed()) return [];
  try {
    const errors = await page.evaluate(() => {
      const rt = (window as any).__runtimeErrors || [];
      const cap = (window as any).__capturedRuntimeErrors || [];
      (window as any).__runtimeErrors = [];
      (window as any).__capturedRuntimeErrors = [];
      return [...rt, ...cap];
    }).catch(() => []);
    return errors;
  } catch {
    return [];
  }
}
