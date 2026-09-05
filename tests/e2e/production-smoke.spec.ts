import { expect, test, type Page } from './fixtures';
import { inflateSync } from 'node:zlib';

type SaveSlot = {
  player?: {
    mapId?: string;
    spawnId?: string;
  };
  savedAt?: number;
};

type CanvasStats = {
  alphaPixels: number;
  uniqueColors: number;
  hash: number;
};

async function readSaveSlot(page: Page): Promise<SaveSlot | null> {
  return page.evaluate(
    async () => {
      if (!(await indexedDB.databases()).some(db => db.name === 'emberfall')) return null;
      return new Promise<SaveSlot | null>((resolve, reject) => {
        const request = indexedDB.open('emberfall');
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const db = request.result;
          if (!db.objectStoreNames.contains('saves')) { db.close(); resolve(null); return; }
          const tx = db.transaction('saves', 'readonly');
          const get = tx.objectStore('saves').get('slot_1');
          get.onerror = () => reject(get.error);
          get.onsuccess = () => resolve((get.result as SaveSlot | undefined) ?? null);
          tx.oncomplete = () => db.close();
        };
      });
    },
  );
}

function screenshotStats(buffer: Buffer): CanvasStats {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  if (!buffer.subarray(0, 8).equals(signature)) throw new Error('Screenshot is not a PNG');
  let offset = 8;
  let width = 0;
  let height = 0;
  let colorType = 0;
  const compressed: Buffer[] = [];
  while (offset < buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.toString('ascii', offset + 4, offset + 8);
    const data = buffer.subarray(offset + 8, offset + 8 + length);
    if (type === 'IHDR') {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      const bitDepth = data[8];
      colorType = data[9] ?? 0;
      if (bitDepth !== 8 || (colorType !== 2 && colorType !== 6)) throw new Error(`Unsupported PNG format ${bitDepth}/${colorType}`);
    } else if (type === 'IDAT') {
      compressed.push(data);
    } else if (type === 'IEND') {
      break;
    }
    offset += length + 12;
  }

  const channels = colorType === 6 ? 4 : 3;
  const stride = width * channels;
  const inflated = inflateSync(Buffer.concat(compressed));
  const previous = Buffer.alloc(stride);
  const current = Buffer.alloc(stride);
  const colors = new Set<string>();
  let alphaPixels = 0;
  let hash = 2166136261;
  let sourceOffset = 0;

  for (let y = 0; y < height; y += 1) {
    const filter = inflated[sourceOffset++];
    inflated.copy(current, 0, sourceOffset, sourceOffset + stride);
    sourceOffset += stride;
    for (let x = 0; x < stride; x += 1) {
      const left = x >= channels ? current[x - channels] ?? 0 : 0;
      const up = previous[x] ?? 0;
      const upLeft = x >= channels ? previous[x - channels] ?? 0 : 0;
      let value = current[x] ?? 0;
      if (filter === 1) value = (value + left) & 0xff;
      else if (filter === 2) value = (value + up) & 0xff;
      else if (filter === 3) value = (value + Math.floor((left + up) / 2)) & 0xff;
      else if (filter === 4) {
        const p = left + up - upLeft;
        const pa = Math.abs(p - left);
        const pb = Math.abs(p - up);
        const pc = Math.abs(p - upLeft);
        value = (value + (pa <= pb && pa <= pc ? left : pb <= pc ? up : upLeft)) & 0xff;
      } else if (filter !== 0) {
        throw new Error(`Unsupported PNG filter ${filter}`);
      }
      current[x] = value;
    }
    for (let x = 0; x < stride; x += channels) {
      const r = current[x] ?? 0;
      const g = current[x + 1] ?? 0;
      const b = current[x + 2] ?? 0;
      const a = channels === 4 ? current[x + 3] ?? 0 : 255;
      if (a > 0) alphaPixels += 1;
      colors.add(`${r >> 4},${g >> 4},${b >> 4},${a >> 4}`);
      hash ^= r + (g << 8) + (b << 16) + (a << 24);
      hash = Math.imul(hash, 16777619) >>> 0;
    }
    current.copy(previous);
  }
  return { alphaPixels, uniqueColors: colors.size, hash };
}

async function canvasStats(page: Page): Promise<CanvasStats> {
  await expect(page.locator('canvas')).toBeVisible();
  return screenshotStats(await page.screenshot({ animations: 'disabled' }));
}

async function waitForDrawnCanvas(page: Page): Promise<CanvasStats> {
  await expect(page.locator('canvas')).toBeVisible();
  await expect.poll(async () => (await canvasStats(page)).alphaPixels).toBeGreaterThan(3200);
  await expect.poll(async () => (await canvasStats(page)).uniqueColors).toBeGreaterThan(12);
  return canvasStats(page);
}

async function expectCanvasChanged(page: Page, before: CanvasStats): Promise<void> {
  await expect.poll(async () => (await canvasStats(page)).hash).not.toBe(before.hash);
}

test('production build starts, moves, saves a transition, and continues without dev hooks', async ({ page, errorWatcher }) => {
  test.setTimeout(120_000);
  void errorWatcher;
  const failedRequests: string[] = [];
  const badResponses: string[] = [];
  page.on('requestfailed', (request) => failedRequests.push(`${request.method()} ${request.url()} ${request.failure()?.errorText ?? ''}`));
  page.on('response', (response) => {
    if (response.url().startsWith('http://127.0.0.1:5181') && response.status() >= 400) {
      badResponses.push(`${response.status()} ${response.url()}`);
    }
  });

  await page.goto('/');
  await expect(page).toHaveTitle('Emberfall');
  await expect(page.locator('#boot-fallback')).toBeHidden();
  const menuCanvas = await waitForDrawnCanvas(page);
  await expect(page.evaluate(() => Object.hasOwn(window, '__GAME_TEST__'))).resolves.toBe(false);

  await page.waitForTimeout(700);
  await page.keyboard.press('Enter');
  await expect.poll(async () => (await readSaveSlot(page))?.player?.mapId).toBe('village');
  const villageCanvas = await waitForDrawnCanvas(page);
  expect(villageCanvas.hash).not.toBe(menuCanvas.hash);

  // The south road is three tiles wide, but the torii at its end leaves a one-tile gap with a guard beside
  // it, so a blind walk down the centre wedges on a pillar. Take the open column west of the gate to the
  // bottom edge, step east below the gate, then walk south into the exit.
  const hold = async (key: string, ms: number): Promise<void> => {
    await page.keyboard.down(key);
    await page.waitForTimeout(ms);
    await page.keyboard.up(key);
  };
  await hold('KeyA', 450);
  await hold('KeyS', 5000);
  await expectCanvasChanged(page, villageCanvas);
  await hold('KeyD', 450);
  await page.keyboard.down('KeyS');
  try {
    await expect.poll(async () => (await readSaveSlot(page))?.player?.mapId, { timeout: 30_000 }).toBe('woods');
  } finally {
    await page.keyboard.up('KeyS');
  }
  await expect.poll(async () => (await readSaveSlot(page))?.player?.spawnId).toBe('from_village');

  await page.reload();
  await waitForDrawnCanvas(page);
  await expect(page.evaluate(() => Object.hasOwn(window, '__GAME_TEST__'))).resolves.toBe(false);
  await page.waitForTimeout(700);
  const savedBeforeContinue = (await readSaveSlot(page))?.savedAt ?? 0;
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  // The slot already says "woods" from before the reload, so the proof that Continue actually resumed the
  // world is the autosave the world scene writes once the map is live: its timestamp moves forward. Holding a
  // key before that point is also pointless, because a key already down when the scene creates its listeners
  // is never seen as pressed.
  await expect.poll(async () => (await readSaveSlot(page))?.savedAt ?? 0, { timeout: 30_000 }).toBeGreaterThan(savedBeforeContinue);
  await expect.poll(async () => (await readSaveSlot(page))?.player?.mapId).toBe('woods');
  await page.waitForTimeout(500);
  // Returning through the north gate proves Continue resumed the world, not just the stored slot.
  await page.keyboard.down('KeyW');
  try {
    await expect.poll(async () => (await readSaveSlot(page))?.player?.mapId, { timeout: 30_000 }).toBe('village');
  } finally {
    await page.keyboard.up('KeyW');
  }

  expect(failedRequests, 'failed network requests').toEqual([]);
  expect(badResponses, 'HTTP asset errors').toEqual([]);
});
