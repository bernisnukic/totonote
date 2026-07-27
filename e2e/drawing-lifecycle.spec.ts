import { test, expect, type ElectronApplication, type Page } from '@playwright/test';
import { registerAppHooks, acceptConfirm } from './fixtures';

/**
 * A drawing that is copied, or deleted and brought back.
 *
 * Reported: "if i copy/cut a drawing, when i paste it's just blank — same if i undo a
 * drawing deletion".
 */
let app: ElectronApplication;
let page: Page;
registerAppHooks(handles => {
  app = handles.app;
  page = handles.page;
});

async function setup() {
  await page.locator('.document-card-new').click();
  await page.locator('.modal input.input').first().fill('Drawing Life');
  await page.locator('.modal .btn-primary').click();
  await page.locator('.tab-add').click();
  await page.locator('.modal input.input').first().fill('Main');
  await page.locator('.modal .btn-primary').click();
  await page.locator('.tiptap').first().click();
  await page.locator('.toolbar-btn[aria-label="Insert a drawing"]').click();
  await expect(page.locator('.drawing-node')).toBeVisible({ timeout: 10000 });
  await page.locator('.drawing-node .btn', { hasText: 'Draw' }).click();
  await expect(page.locator('.drawing-toolbar')).toBeVisible();
}

/**
 * One diagonal stroke, dispatched as pen events — Playwright's mouse reports no pressure
 * and would take the mouse fallback instead.
 */
async function drawStroke() {
  await page.evaluate(() => {
    const canvas = document.querySelector('.drawing-canvas__live') as HTMLCanvasElement;
    const rect = canvas.getBoundingClientRect();
    const at = (fx: number, fy: number) => ({
      clientX: rect.left + rect.width * fx,
      clientY: rect.top + rect.height * fy,
    });
    const common = { pointerId: 1, pointerType: 'pen', isPrimary: true, bubbles: true, cancelable: true };
    canvas.setPointerCapture = () => undefined;
    canvas.hasPointerCapture = () => true;
    canvas.releasePointerCapture = () => undefined;

    canvas.dispatchEvent(new PointerEvent('pointerdown', { ...common, ...at(0.2, 0.2), pressure: 0.8 }));
    for (let i = 1; i <= 6; i++) {
      canvas.dispatchEvent(
        new PointerEvent('pointermove', { ...common, ...at(0.2 + i * 0.07, 0.2 + i * 0.07), pressure: 0.8 }),
      );
    }
    canvas.dispatchEvent(new PointerEvent('pointerup', { ...common, ...at(0.65, 0.65), pressure: 0 }));
  });
  await page.waitForTimeout(1000);
}

/** Strokes stored for the nth drawing in the section. */
async function strokesFor(index: number): Promise<number> {
  return page.evaluate(async i => {
    const api = (window as unknown as { api: { invoke: (c: string, a?: unknown) => Promise<unknown> } }).api;
    const id = document.querySelectorAll('.drawing-node')[i]?.getAttribute('data-drawing-id');
    if (!id) return -1;
    const record = (await api.invoke('drawing:get', { id })) as { strokes: string } | null;
    if (!record?.strokes) return 0;
    return (JSON.parse(record.strokes) as { strokes: unknown[] }).strokes.length;
  }, index);
}

test.describe('A drawing through its life', () => {
  test('keeps its strokes when it is deleted and brought back', async () => {
    await setup();
    await drawStroke();
    await page.locator('.drawing-node .btn', { hasText: 'Done' }).click();
    expect(await strokesFor(0)).toBeGreaterThan(0);

    // Delete it from the right-click menu, then undo.
    await page.locator('.drawing-node').click({ button: 'right' });
    await acceptConfirm(page);
    await expect(page.locator('.drawing-node')).toHaveCount(0, { timeout: 10000 });

    await app.evaluate(({ BrowserWindow }) =>
      BrowserWindow.getAllWindows()[0].webContents.send('menu:undo'),
    );
    await expect(page.locator('.drawing-node')).toHaveCount(1, { timeout: 10000 });
    await page.waitForTimeout(800);
    expect(await strokesFor(0)).toBeGreaterThan(0);
  });

  test('a copy is its own drawing, not a blank one', async () => {
    await setup();
    await drawStroke();
    await page.locator('.drawing-node .btn', { hasText: 'Done' }).click();
    const before = await strokesFor(0);
    expect(before).toBeGreaterThan(0);

    // Select the drawing and copy/paste it.
    await page.locator('.drawing-node').click();
    await page.keyboard.press('ControlOrMeta+C');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ControlOrMeta+V');
    await expect(page.locator('.drawing-node')).toHaveCount(2, { timeout: 10000 });
    await page.waitForTimeout(1200);

    // Both carry the strokes, and they are separate drawings.
    expect(await strokesFor(0)).toBeGreaterThan(0);
    expect(await strokesFor(1)).toBeGreaterThan(0);
    const ids = await page.locator('.drawing-node').evaluateAll(nodes =>
      nodes.map(n => n.getAttribute('data-drawing-id')),
    );
    expect(new Set(ids).size).toBe(2);
  });
});
