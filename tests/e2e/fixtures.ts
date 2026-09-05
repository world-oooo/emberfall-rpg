import { test as base, expect, type ConsoleMessage, type Page } from '@playwright/test';

type ErrorWatcher = {
  consoleErrors: string[];
  pageErrors: string[];
};

function describeConsoleMessage(message: ConsoleMessage): string {
  return `${message.type()}: ${message.text()}`;
}

export const test = base.extend<{ errorWatcher: ErrorWatcher }>({
  errorWatcher: async ({ page, browserName }, use) => {
    // E2E_CPU_THROTTLE=6 reproduces a GPU-less CI runner, where a frame can last a third of a second.
    const throttle = Number(process.env.E2E_CPU_THROTTLE ?? '0');
    if (throttle > 1 && browserName === 'chromium') {
      const session = await page.context().newCDPSession(page);
      await session.send('Emulation.setCPUThrottlingRate', { rate: throttle });
    }
    const watcher: ErrorWatcher = { consoleErrors: [], pageErrors: [] };
    page.on('console', (message) => {
      if (message.type() === 'error') watcher.consoleErrors.push(describeConsoleMessage(message));
    });
    page.on('pageerror', (error) => {
      watcher.pageErrors.push(error.message);
    });

    await use(watcher);

    expect(watcher.consoleErrors, 'browser console errors').toEqual([]);
    expect(watcher.pageErrors, 'uncaught page errors').toEqual([]);
  },
});

export { expect, type Page };
