// Flows that belong here once their tickets land, not yet:
// - demo-mode banner is present when config.json is absent or blank
// - the sign-in control renders disabled until Auth0 config is present
// - the slot grid paints from local opening hours before the busy-ranges GET resolves
// - the confirmation screen never says "confirmed" alone; it names the pending review step
import { expect, test } from '@playwright/test';

test('app root loads, responds 200, and renders its heading without a console error', async ({
  page,
}) => {
  const consoleErrors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') {
      consoleErrors.push(message.text());
    }
  });

  const response = await page.goto('/');

  expect(response?.status()).toBe(200);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Welcome to the Salon');
  expect(consoleErrors).toEqual([]);
});

// GitHub Pages serves 404.html for any path that is not a real file, and tools/pages-postbuild.mjs
// makes 404.html a copy of index.html so the SPA boots with the real URL intact. This test is the
// only thing standing between us and a dead /book link on the live site.
test('a deep link falls back to the SPA and routes to the right page', async ({ page }) => {
  const response = await page.goto('/book');

  expect(response?.status()).toBe(404);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Book an Appointment');
  expect(new URL(page.url()).pathname).toBe('/book');
});

test('an unknown deep link routes to the not-found page', async ({ page }) => {
  await page.goto('/no-such-page');

  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Page Not Found');
});
