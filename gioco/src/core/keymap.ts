/**
 * Tastiera → azioni (GDD 11.3, ARCHITETTURA 7). Puro: riceve una descrizione
 * del tasto e restituisce l'azione, senza toccare il DOM.
 *
 * | Tasto                    | Azione                         |
 * |--------------------------|--------------------------------|
 * | ← → ↑ ↓                  | left, right, up, down (ripetibili) |
 * | PagSu, PagGiù            | pageUp, pageDown (ripetibili)  |
 * | 1-6                      | select, index 0-5              |
 * | Spazio / Maiusc+Spazio   | crossL / crossR                |
 * | F                        | flip                           |
 * | Invio                    | confirm (nel tombolo: Fissa l'ora; in vignetta: avanza) |
 * | Backspace, Z, Ctrl+Z     | undo                           |
 * | Tab                      | notebook (Taccuino)            |
 * | Maiusc+Tab               | tab (scheda successiva nei pannelli a schede) |
 * | H                        | hint                           |
 * | N                        | name                           |
 * | Esc                      | back (Pausa / chiude il pannello) |
 * | P                        | pause                          |
 * | S                        | skip (vignette)                |
 * | A                        | auto (vignette)                |
 *
 * Nei campi di testo si mappa solo Esc. Su un elemento interattivo con fuoco
 * (pulsante, cursore, scheda…) Invio, Spazio e frecce restano al browser, così
 * i componenti funzionano da tastiera come ci si aspetta.
 */
import type { ActionId } from './types';

export interface KeyInfo {
  key: string;
  code?: string;
  shiftKey?: boolean;
  ctrlKey?: boolean;
  metaKey?: boolean;
  altKey?: boolean;
  repeat?: boolean;
}

export type FocusContext = 'none' | 'interactive' | 'text';

export interface KeyAction {
  action: ActionId;
  index?: number;
  repeat: boolean;
}

/** Azioni che ammettono la ripetizione automatica del tasto. */
export const REPEATABLE: ReadonlySet<ActionId> = new Set<ActionId>(['left', 'right', 'up', 'down', 'pageUp', 'pageDown']);

/** Tasti che non devono mai far uscire dal gioco (preventDefault anche se nessuno li gestisce). */
export const ALWAYS_PREVENT: ReadonlySet<string> = new Set(['Tab', 'Escape', 'Backspace', ' ', 'PageUp', 'PageDown', 'ArrowUp', 'ArrowDown']);

const NATIVE_ON_INTERACTIVE: ReadonlySet<string> = new Set([
  'Enter', ' ', 'Spacebar', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End', 'PageUp', 'PageDown',
]);

function digitIndex(k: KeyInfo): number | null {
  const m = /^(?:Digit|Numpad)([1-6])$/.exec(k.code ?? '');
  if (m && m[1]) return Number(m[1]) - 1;
  if (/^[1-6]$/.test(k.key)) return Number(k.key) - 1;
  return null;
}

export function mapKey(k: KeyInfo, focus: FocusContext = 'none'): KeyAction | null {
  const key = k.key;
  const repeat = !!k.repeat;
  if (focus === 'text') {
    return key === 'Escape' && !repeat ? { action: 'back', repeat: false } : null;
  }
  if (focus === 'interactive' && NATIVE_ON_INTERACTIVE.has(key)) return null;

  // Scorciatoie con modificatori: solo Ctrl/Cmd+Z (disfa). Il resto resta al browser.
  if (k.ctrlKey || k.metaKey) {
    if ((key === 'z' || key === 'Z') && !k.shiftKey) return repeat ? null : { action: 'undo', repeat: false };
    return null;
  }
  if (k.altKey) return null;

  let action: ActionId | null = null;
  let index: number | undefined;
  switch (key) {
    case 'ArrowLeft': action = 'left'; break;
    case 'ArrowRight': action = 'right'; break;
    case 'ArrowUp': action = 'up'; break;
    case 'ArrowDown': action = 'down'; break;
    case 'PageUp': action = 'pageUp'; break;
    case 'PageDown': action = 'pageDown'; break;
    case ' ':
    case 'Spacebar': action = k.shiftKey ? 'crossR' : 'crossL'; break;
    case 'Enter': action = 'confirm'; break;
    case 'Backspace': action = 'undo'; break;
    case 'Tab': action = k.shiftKey ? 'tab' : 'notebook'; break;
    case 'Escape': action = 'back'; break;
    default: {
      const d = digitIndex(k);
      if (d !== null) {
        action = 'select';
        index = d;
        break;
      }
      switch (key.toLowerCase()) {
        case 'f': action = 'flip'; break;
        case 'z': action = 'undo'; break;
        case 'h': action = 'hint'; break;
        case 'n': action = 'name'; break;
        case 'p': action = 'pause'; break;
        case 's': action = 'skip'; break;
        case 'a': action = 'auto'; break;
        default: action = null;
      }
    }
  }
  if (!action) return null;
  if (repeat && !REPEATABLE.has(action)) return null;
  return index === undefined ? { action, repeat } : { action, index, repeat };
}
