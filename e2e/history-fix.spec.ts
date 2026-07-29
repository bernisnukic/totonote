import { test, expect, type ElectronApplication, type Page } from '@playwright/test';
import { registerAppHooks, acceptConfirm, dismissConfirmIfShown } from './fixtures';

// Regression: restoring a checkpoint used to leave highlights at positions from the newer
// document, so compiled wiki pages showed text the user never highlighted.

let app: ElectronApplication;
let page: Page;
registerAppHooks(h => {
  app = h.app;
  page = h.page;
});

async function setup() {
  await page.locator('.document-card-new').click();
  await page.locator('.modal input.input').first().fill('History Fix');
  await page.locator('.modal .btn-primary').click();
  await page.locator('.tab-add').click();
  await page.locator('.modal input.input').first().fill('Main');
  await page.locator('.modal .btn-primary').click();
  await expect(page.locator('.tiptap')).toBeVisible();
}

async function tagAll(name: string) {
  await page.keyboard.press('ControlOrMeta+A');
  await expect(page.locator('.selection-toolbar')).toBeVisible();
  await page.locator('.selection-toolbar-btn', { hasText: 'Tag' }).click();
  const modal = page.locator('.modal');
  await modal.locator('.autocomplete input.input').fill(name);
  await modal.locator('.autocomplete-item-create').click();
  await modal.locator('.btn-primary', { hasText: 'Create' }).click();
  await expect(page.locator('.annotation-highlight')).toBeVisible({ timeout: 10000 });
}

/** What the compiled wiki page would show for every highlight in this document. */
async function wikiExcerpts(): Promise<string[]> {
  return page.evaluate(async () => {
    const api = (window as unknown as { api: { invoke: (c: string, a?: unknown) => Promise<unknown> } }).api;
    const secId = document.querySelector('[data-section-id]')?.getAttribute('data-section-id');
    const anns = (await api.invoke('annotation:list', { sectionId: secId })) as Array<{ tagId: string }>;
    const out: string[] = [];
    for (const tagId of new Set(anns.map(a => a.tagId))) {
      const rows = (await api.invoke('annotation:placements', { tagId })) as Array<{ excerpt: string }>;
      out.push(...rows.map(r => r.excerpt));
    }
    return out;
  });
}

test.describe('History restore and highlights', () => {
  test('restoring a checkpoint puts highlights back where they belong', async () => {
    await setup();
    const editor = page.locator('.tiptap').first();
    await editor.click();
    await editor.pressSequentially('GURA IS A SHARK', { delay: 15 });
    await page.waitForTimeout(1300);
    await tagAll('Marker');
    await page.waitForTimeout(1300);
    expect(await wikiExcerpts()).toEqual(['GURA IS A SHARK']);

    // Write more, creating a later checkpoint.
    await editor.click();
    await page.keyboard.press('End');
    await editor.pressSequentially(' AND SHE SINGS', { delay: 15 });
    await page.waitForTimeout(1400);

    // Roll back to the checkpoint where the highlight existed over "GURA IS A SHARK".
    await page.locator('.sidebar-tab', { hasText: 'History' }).click();
    const target = page.locator('.history-item[data-preview="GURA IS A SHARK"]').first();
    await expect(target).toBeVisible();
    await target.click();
    await dismissConfirmIfShown(page); // in case anything post-dates the checkpoint
    await page.waitForTimeout(1500);

    // The page must still show what the user actually highlighted — this used to read
    // whatever text had moved into positions 1..16.
    expect(await wikiExcerpts()).toEqual(['GURA IS A SHARK']);
    await expect(page.locator('.annotation-highlight')).toContainText('GURA IS A SHARK');
  });

  test('rolling back past a highlight removes it instead of leaving it pointing at nothing', async () => {
    await setup();
    const editor = page.locator('.tiptap').first();
    await editor.click();
    await editor.pressSequentially('ORIGINAL TEXT', { delay: 15 });
    await page.waitForTimeout(1300); // checkpoint with no highlights yet
    await tagAll('Later');
    await page.waitForTimeout(1300);

    await page.locator('.sidebar-tab', { hasText: 'History' }).click();
    const items = page.locator('.history-item');
    await items.nth((await items.count()) - 1).click();
    const warning = await acceptConfirm(page);
    expect(warning).toContain('1 highlight');
    await page.waitForTimeout(1500);

    // No orphan left behind in the database, so nothing wrong can surface on a page.
    const remaining = await page.evaluate(async () => {
      const api = (window as unknown as { api: { invoke: (c: string, a?: unknown) => Promise<unknown> } }).api;
      const secId = document.querySelector('[data-section-id]')?.getAttribute('data-section-id');
      return ((await api.invoke('annotation:list', { sectionId: secId })) as unknown[]).length;
    });
    expect(remaining).toBe(0);
    expect(await wikiExcerpts()).toEqual([]);
  });
});
