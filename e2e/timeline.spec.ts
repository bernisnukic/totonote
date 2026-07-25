import { test, expect, type Page } from '@playwright/test';
import { registerAppHooks } from './fixtures';

/**
 * The timeline: dated excerpts across the whole world, in order.
 */
let page: Page;
registerAppHooks(handles => {
  page = handles.page;
});

const row = (name: string) => page.locator('.category-row', { hasText: name });

/** Doc + section + a CHARACTERS category, ready to tag and file into. */
async function setup(text: string) {
  await page.locator('.document-card-new').click();
  await page.locator('.modal input.input').first().fill('Chronicle');
  await page.locator('.modal .btn-primary').click();
  await page.locator('.tab-add').click();
  await page.locator('.modal input.input').first().fill('Main');
  await page.locator('.modal .btn-primary').click();

  await page.locator('.sidebar-tab', { hasText: 'Edit' }).click();
  await page.locator('.btn', { hasText: '+ New Category' }).click();
  await page.locator('.category-new-form input.input').fill('EVENTS');
  await page.locator('.category-new-form .btn-primary', { hasText: 'Create' }).click();
  await expect(row('EVENTS')).toBeVisible();

  const editor = page.locator('.tiptap').first();
  await editor.click();
  await editor.pressSequentially(text, { delay: 15 });
  return editor;
}

/** Select from `from` to `to` (1-indexed characters) and tag it, filed under EVENTS. */
async function tagAll(tagName: string) {
  await page.keyboard.press('ControlOrMeta+A');
  await page.locator('.selection-toolbar-btn', { hasText: 'Tag' }).click();
  const modal = page.locator('.modal');
  const value = await modal
    .locator('select.input option', { hasText: 'EVENTS' })
    .first()
    .getAttribute('value');
  await modal.locator('select.input').selectOption(value!);
  await modal.locator('.autocomplete input.input').fill(tagName);
  await modal.locator('.autocomplete-item-create').click();
  await modal.locator('.btn-primary', { hasText: 'Create' }).click();
  await expect(page.locator('.annotation-highlight')).toBeVisible({ timeout: 10000 });
}

/** Open the EVENTS page, where filed excerpts get their "when". */
async function openEventsPage() {
  await page.locator('.sidebar-mode-btn', { hasText: 'Search' }).click();
  await page.locator('.category-name-link', { hasText: 'EVENTS' }).click();
  await expect(page.locator('.right-sidebar .placement-row').first()).toBeVisible();
}

async function setWhen(text: string) {
  await page.locator('.placement-note-add', { hasText: '+ when' }).first().click();
  await page.locator('.placement-when-input').fill(text);
  await page.keyboard.press('Enter');
  await expect(page.locator('.placement-when', { hasText: text })).toBeVisible();
}

const openTimeline = () => page.locator('.toolbar-btn[aria-label="Timeline"]').click();

test.describe('Timeline', () => {
  test('says so plainly when nothing has been dated yet', async () => {
    await setup('The flood came.');
    await openTimeline();
    await expect(page.locator('.timeline-overlay')).toContainText('Nothing is dated yet');
  });

  test('a dated excerpt appears on the timeline', async () => {
    await setup('The flood came and the city fell.');
    await tagAll('Flood');
    await openEventsPage();
    await setWhen('Year 300');
    await page.waitForTimeout(600);

    await openTimeline();
    await expect(page.locator('.timeline-moment__when')).toHaveText('Year 300');
    await expect(page.locator('.timeline-event__text')).toContainText('The flood came and the city fell.');
    await expect(page.locator('.timeline-event__meta')).toContainText('Chronicle');
  });

  test('a made-up calendar sorts by its numbers, and Escape closes the view', async () => {
    await setup('Later event.');
    await tagAll('Late');
    await openEventsPage();
    await setWhen('Year 300 of the Third Age');
    await page.waitForTimeout(600);

    // A second document with an earlier date, to prove ordering is by number not by entry.
    await page.locator('.toolbar-back-btn').click();
    await setup('Earlier event.');
    await tagAll('Early');
    await openEventsPage();
    await setWhen('Year 12 of the Third Age');
    await page.waitForTimeout(600);

    await openTimeline();
    await expect(page.locator('.timeline-moment__when')).toHaveText([
      'Year 12 of the Third Age',
      'Year 300 of the Third Age',
    ]);

    await page.keyboard.press('Escape');
    await expect(page.locator('.timeline-overlay')).toHaveCount(0);
  });

  test('clicking an event opens the passage it came from', async () => {
    await setup('The flood came.');
    await tagAll('Flood');
    await openEventsPage();
    await setWhen('Year 300');
    await page.waitForTimeout(600);

    await openTimeline();
    await page.locator('.timeline-event').first().click();
    await expect(page.locator('.timeline-overlay')).toHaveCount(0);
    await expect(page.locator('.main-toolbar')).toContainText('Chronicle');
  });
});
