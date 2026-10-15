/**
 * Aiuti per i test: carica i contenuti veri da content/ (tre livelli sopra test/, sia in
 * moduli/rilievo/test sia in src/rilievo/test dopo lo spostamento).
 */
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { regoleDaContenuti, type OpzioniRegole } from '../src/regole';
import type { RegoleCatasto } from '../src/tipi';

export const CARTELLA_CONTENUTI = fileURLToPath(new URL('../../../content/', import.meta.url));
export const LAYOUT_MOTORE = fileURLToPath(new URL('../../../src/world/layout.json', import.meta.url));

export function leggiJson<T = unknown>(nome: string): T {
  return JSON.parse(readFileSync(CARTELLA_CONTENUTI + nome, 'utf8')) as T;
}

export function contenutiPresenti(): boolean {
  return existsSync(CARTELLA_CONTENUTI + 'capisaldi.json') && existsSync(CARTELLA_CONTENUTI + 'fade_fase1.json');
}

export function contenuti(): { capisaldi: any; fade: any } {
  return { capisaldi: leggiJson('capisaldi.json'), fade: leggiJson('fade_fase1.json') };
}

let cache: RegoleCatasto | null = null;
/** Le regole della Fase 1 dai contenuti veri (in cache: sono immutabili). */
export function regoleFase1(): RegoleCatasto {
  cache ??= regoleDaContenuti(contenuti());
  return cache;
}

export function regoleCon(opzioni: OpzioniRegole): RegoleCatasto {
  return regoleDaContenuti(contenuti(), opzioni);
}

/** Flag (senza prefisso) contenuti in una lista di effetti. */
export function flagDa(effetti: readonly string[]): string[] {
  return effetti.filter((e) => e.startsWith('flag:')).map((e) => e.slice(5));
}
