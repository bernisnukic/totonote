import { test, expect, type ElectronApplication, type Page } from '@playwright/test';
import { registerAppHooks } from './fixtures';

// The drawing layer: inserting a surface, drawing on it, erasing, undo, and persistence.

let app: ElectronApplication;
let page: Page;
registerAppHooks(h => {
  app = h.app;
  page = h.page;
});

const TEST_PNG =
  'iVBORw0KGgoAAAANSUhEUgAAAAgAAAAECAIAAAA8r+mnAAAAGUlEQVR4nGP4P9/Z4/ZvTJIBqyiQZCBZBwB+iD/x62W8gAAAAABJRU5ErkJggg==';

async function docWithSection(title = 'Drawing Doc') {
  await page.locator('.document-card-new').click();
  await page.locator('.modal input.input').first().fill(title);
  await page.locator('.modal .btn-primary').click();
  await page.locator('.tab-add').click();
  await page.locator('.modal input.input').first().fill('Main');
  await page.locator('.modal .btn-primary').click();
  await expect(page.locator('.tiptap')).toBeVisible();
}

/** Insert a drawing surface via the toolbar and switch it into edit mode. */
async function insertDrawing() {
  await page.locator('.tiptap').first().click();
  await page.locator('.toolbar-btn[aria-label="Insert a drawing"]').click();
  await expect(page.locator('.drawing-node')).toBeVisible({ timeout: 10000 });
  await page.locator('.drawing-node .btn', { hasText: 'Draw' }).click();
  await expect(page.locator('.drawing-toolbar')).toBeVisible();
}

/**
 * Draw a stroke with a simulated pen, including pressure.
 *
 * Playwright's mouse can't report pressure or pointerType, so the pointer events are
 * dispatched directly — which is also what exercises the pen path rather than the mouse
 * fallback.
 */
async function drawStroke(points: Array<[number, number]>, pressure = 0.8) {
  await page.evaluate(
    ({ pts, force }) => {
      const canvas = document.querySelector('.drawing-canvas__live') as HTMLCanvasElement;
      const rect = canvas.getBoundingClientRect();
      const at = ([fx, fy]: number[]) => ({
        clientX: rect.left + rect.width * fx,
        clientY: rect.top + rect.height * fy,
      });
      const common = { pointerId: 1, pointerType: 'pen', isPrimary: true, bubbles: true, cancelable: true };
      canvas.setPointerCapture = () => undefined;
      canvas.hasPointerCapture = () => true;
      canvas.releasePointerCapture = () => undefined;

      canvas.dispatchEvent(new PointerEvent('pointerdown', { ...common, ...at(pts[0]), pressure: force }));
      for (const p of pts.slice(1)) {
        canvas.dispatchEvent(new PointerEvent('pointermove', { ...common, ...at(p), pressure: force }));
      }
      const last = pts[pts.length - 1];
      canvas.dispatchEvent(new PointerEvent('pointerup', { ...common, ...at(last), pressure: 0 }));
    },
    { pts: points, force: pressure },
  );
}

/** Strokes currently stored for the drawing in the document. */
async function storedStrokes(): Promise<unknown[]> {
  return page.evaluate(async () => {
    const api = (window as unknown as { api: { invoke: (c: string, a?: unknown) => Promise<unknown> } }).api;
    const id = document.querySelector('.drawing-node')?.getAttribute('data-drawing-id');
    const record = (await api.invoke('drawing:get', { id })) as { strokes: string } | null;
    if (!record?.strokes) return [];
    return (JSON.parse(record.strokes) as { strokes: unknown[] }).strokes;
  });
}

test.describe('Drawing', () => {
  test('inserts a drawing surface and draws a stroke that persists', async () => {
    await docWithSection();
    await insertDrawing();

    await drawStroke([
      [0.1, 0.2],
      [0.4, 0.5],
      [0.8, 0.6],
    ]);

    // The stroke is written to the database after a short debounce.
    await expect.poll(async () => (await storedStrokes()).length, { timeout: 10000 }).toBe(1);

    const strokes = (await storedStrokes()) as Array<{ points: Array<{ x: number; y: number; p: number }> }>;
    expect(strokes[0].points.length).toBeGreaterThan(1);
    // Coordinates are normalised, so they stay put at any display size.
    for (const p of strokes[0].points) {
      expect(p.x).toBeGreaterThanOrEqual(0);
      expect(p.x).toBeLessThanOrEqual(1);
      expect(p.y).toBeGreaterThanOrEqual(0);
      expect(p.y).toBeLessThanOrEqual(1);
    }
  });

  // Regression: the canvas used to hand back a whole new drawing built from its prop, so
  // strokes finished before React re-rendered overwrote each other and only the last
  // survived. A fast sketcher would silently lose work.
  test('keeps every stroke when several are drawn in quick succession', async () => {
    await docWithSection();
    await insertDrawing();

    await page.evaluate(() => {
      const canvas = document.querySelector('.drawing-canvas__live') as HTMLCanvasElement;
      const rect = canvas.getBoundingClientRect();
      canvas.setPointerCapture = () => undefined;
      canvas.hasPointerCapture = () => true;
      canvas.releasePointerCapture = () => undefined;
      const send = (type: string, fx: number, fy: number) =>
        canvas.dispatchEvent(
          new PointerEvent(type, {
            pointerId: 1,
            pointerType: 'pen',
            isPrimary: true,
            bubbles: true,
            cancelable: true,
            clientX: rect.left + rect.width * fx,
            clientY: rect.top + rect.height * fy,
            pressure: 0.6,
          }),
        );
      // Three complete strokes without yielding to the event loop.
      for (let i = 0; i < 3; i++) {
        const y = 0.2 + i * 0.25;
        send('pointerdown', 0.1, y);
        send('pointermove', 0.5, y);
        send('pointerup', 0.9, y);
      }
    });

    await expect.poll(async () => (await storedStrokes()).length, { timeout: 10000 }).toBe(3);
  });

  test('records pen pressure rather than a flat line', async () => {
    await docWithSection();
    await insertDrawing();
    await drawStroke([[0.1, 0.1], [0.5, 0.5], [0.9, 0.9]], 0.9);

    await expect.poll(async () => (await storedStrokes()).length, { timeout: 10000 }).toBe(1);
    const strokes = (await storedStrokes()) as Array<{ points: Array<{ p: number }> }>;
    // 0.9 from the pen, not the 0.5 fallback a mouse would have given.
    expect(strokes[0].points[0].p).toBeCloseTo(0.9, 1);
  });

  // Regression: the position carried by the lift used to be dropped, so every stroke
  // stopped at the last move event — short of where the pen actually left the surface.
  // Most visible on a deliberate shape like an arrowhead, which came apart.
  test('a stroke reaches the point where the pen was lifted', async () => {
    await docWithSection();
    await insertDrawing();

    await page.evaluate(() => {
      const canvas = document.querySelector('.drawing-canvas__live') as HTMLCanvasElement;
      const rect = canvas.getBoundingClientRect();
      canvas.setPointerCapture = () => undefined;
      canvas.hasPointerCapture = () => true;
      canvas.releasePointerCapture = () => undefined;
      const send = (type: string, fx: number, fy: number) =>
        canvas.dispatchEvent(
          new PointerEvent(type, {
            pointerId: 1,
            pointerType: 'pen',
            isPrimary: true,
            bubbles: true,
            cancelable: true,
            clientX: rect.left + rect.width * fx,
            clientY: rect.top + rect.height * fy,
            pressure: 0.7,
          }),
        );
      send('pointerdown', 0.1, 0.1);
      send('pointermove', 0.4, 0.4);
      send('pointerup', 0.9, 0.9); // well past the last move
    });

    await expect.poll(async () => (await storedStrokes()).length, { timeout: 10000 }).toBe(1);
    const strokes = (await storedStrokes()) as Array<{ points: Array<{ x: number; y: number }> }>;
    const last = strokes[0].points[strokes[0].points.length - 1];
    expect(last.x).toBeCloseTo(0.9, 1);
    expect(last.y).toBeCloseTo(0.9, 1);
  });

  test('a drawing survives leaving and reopening the document', async () => {
    await docWithSection();
    await insertDrawing();
    await drawStroke([[0.2, 0.2], [0.7, 0.7]]);
    await expect.poll(async () => (await storedStrokes()).length, { timeout: 10000 }).toBe(1);

    await page.waitForTimeout(1500);
    await page.locator('.toolbar-back-btn').click();
    await page.locator('.document-card', { hasText: 'Drawing Doc' }).click();

    await expect(page.locator('.drawing-node')).toBeVisible({ timeout: 10000 });
    expect((await storedStrokes()).length).toBe(1);
  });

  test('undo removes the last stroke, redo puts it back', async () => {
    await docWithSection();
    await insertDrawing();
    await drawStroke([[0.1, 0.1], [0.4, 0.4]]);
    await drawStroke([[0.6, 0.1], [0.9, 0.4]]);
    await expect.poll(async () => (await storedStrokes()).length, { timeout: 10000 }).toBe(2);

    await page.locator('.drawing-tool[aria-label="Undo stroke"]').click();
    await expect.poll(async () => (await storedStrokes()).length, { timeout: 10000 }).toBe(1);

    await page.locator('.drawing-tool[aria-label="Redo stroke"]').click();
    await expect.poll(async () => (await storedStrokes()).length, { timeout: 10000 }).toBe(2);
  });

  test('the eraser removes a whole stroke where you touch it', async () => {
    await docWithSection();
    await insertDrawing();
    await drawStroke([[0.1, 0.5], [0.9, 0.5]]); // across the middle
    await expect.poll(async () => (await storedStrokes()).length, { timeout: 10000 }).toBe(1);

    await page.locator('.drawing-tool[aria-label="Eraser"]').click();
    await drawStroke([[0.5, 0.5], [0.5, 0.5]]); // touch it

    await expect.poll(async () => (await storedStrokes()).length, { timeout: 10000 }).toBe(0);
  });

  test('draws over an embedded image, keeping it as the background', async () => {
    // The marking-up-a-map case: the drawing references the image rather than flattening it.
    await docWithSection();
    await page.locator('.tiptap').first().click();
    await page.evaluate(async b64 => {
      const bytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
      const file = new File([bytes], 'map.png', { type: 'image/png' });
      const dt = new DataTransfer();
      dt.items.add(file);
      document
        .querySelector('.tiptap')
        ?.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
    }, TEST_PNG);
    await expect(page.locator('.tiptap img')).toBeVisible({ timeout: 10000 });

    // Pasting leaves the image selected, so the toolbar offers to draw on it.
    const drawOnImage = page.locator('.toolbar-btn[aria-label="Draw on this image"]');
    await expect(drawOnImage).toBeVisible();
    await drawOnImage.click();

    await expect(page.locator('.drawing-node')).toBeVisible({ timeout: 10000 });
    // The image shows through under the strokes.
    const background = page.locator('.drawing-node__background');
    await expect(background).toBeVisible();
    expect(await background.getAttribute('src')).toMatch(/^totonote:\/\/media\//);
  });
});
