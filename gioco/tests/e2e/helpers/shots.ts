/**
 * Screenshot di riferimento (ARCHITETTURA 15.2, suite `layout`).
 *
 * Ogni screenshot si allega al rapporto del test e si salva come riferimento in
 * tests/e2e/__screenshots__/<percorso>. I riferimenti si scrivono quando mancano,
 * oppure quando si chiede di aggiornarli (`npx playwright test --update-snapshots`
 * o `E2E_SHOTS=1`): un giro normale dei test non tocca i file del repository.
 * Non sono confronti pixel per pixel: il velluto, la luce del titolo e le animazioni
 * cambiano di fotogramma in fotogramma; i controlli veri sono quelli del DOM
 * (helpers/audit.ts). Servono a guardare le schermate, progetto per progetto.
 */
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Page, TestInfo } from '@playwright/test';

export const SHOTS_DIR = fileURLToPath(new URL('../__screenshots__/', import.meta.url));

export interface ShotOptions {
  /** 'jpeg' (default, compatti) o 'png' (schede degli store). */
  type?: 'jpeg' | 'png';
  quality?: number;
  /** 'css' (un pixel per pixel CSS, file piccoli) o 'device' (risoluzione piena). */
  scale?: 'css' | 'device';
  fullPage?: boolean;
}

/** I riferimenti si riscrivono solo se mancano o se lo si chiede. */
export function shouldWrite(testInfo: TestInfo, path: string): boolean {
  if (process.env.E2E_SHOTS === '1') return true;
  const mode = testInfo.config.updateSnapshots;
  if (mode === 'all' || mode === 'changed') return true;
  if (mode === 'none') return false;
  return !existsSync(path);
}

/** Scrive un'immagine fra i riferimenti (se serve) e la allega al rapporto. */
export async function keepImage(testInfo: TestInfo, relPath: string, body: Buffer, contentType: string): Promise<string> {
  const path = join(SHOTS_DIR, relPath);
  if (shouldWrite(testInfo, path)) {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, body);
  }
  // Copia anche fra i risultati del test (test-results/), allegata al rapporto.
  const out = testInfo.outputPath(relPath.replace(/[\\/]/g, '__'));
  writeFileSync(out, body);
  await testInfo.attach(relPath, { path: out, contentType });
  return path;
}

/** Screenshot della pagina salvato come riferimento in __screenshots__/<relPath>.<ext>. */
export async function shot(page: Page, testInfo: TestInfo, relPath: string, opts: ShotOptions = {}): Promise<Buffer> {
  const type = opts.type ?? 'jpeg';
  const body = await page.screenshot({
    type,
    ...(type === 'jpeg' ? { quality: opts.quality ?? 72 } : {}),
    scale: opts.scale ?? 'css',
    fullPage: opts.fullPage ?? false,
    animations: 'disabled',
    caret: 'hide',
  });
  await keepImage(testInfo, `${relPath}.${type === 'jpeg' ? 'jpg' : 'png'}`, body, type === 'jpeg' ? 'image/jpeg' : 'image/png');
  return body;
}
