import { test as base, expect, type ConsoleMessage, type Page } from '@playwright/test';

type ErrorWatcher = {
  consoleErrors: string[];
  pageErrors: string[];
};

function describeConsoleMessage(message: ConsoleMessage): string {
  return `${message.type()}: ${message.text()}`;
}

export const test = base.extend<{ errorWatcher: ErrorWatcher }>({
  errorWatcher: async ({ page }, use) => {
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
