/**
 * Controllo del layout nel DOM (ARCHITETTURA 15.2, suite `layout`; GDD 10.1, 14, 17).
 *
 * Su tutto `#ui-root` (schermate, pannelli, overlay, conferme):
 *  - `overflow`: un elemento con testo proprio esce dal suo contenitore
 *    (`scrollWidth > clientWidth + 1`) senza essere un contenitore che scorre;
 *  - `fuori-pulsante`: il testo di un pulsante esce dal pulsante;
 *  - `fuori-schermo`: un testo visibile esce dallo schermo in orizzontale;
 *  - `piccolo`: un elemento interattivo è più piccolo di 44×44 px;
 *  - `chiave`: un testo visibile è una chiave i18n non tradotta (`ui.titolo.…`);
 *  - `safe-area`: con la safe area simulata, un elemento interattivo o un testo
 *    visibile cade nella fascia alta o bassa riservata al sistema.
 * Si saltano: testi per gli screen reader (`.core-sr-only`), elementi nascosti, avvisi
 * e didascalie (transitori), il rullo dei titoli di coda (scorre per scelta).
 * La parte visibile di un elemento è il suo rettangolo tagliato dai contenitori che
 * scorrono o nascondono il trabocco.
 */
import type { Page } from '@playwright/test';

export interface AuditOptions {
  /** Fasce riservate al sistema (px CSS): top e bottom della safe area simulata. */
  safeTop?: number;
  safeBottom?: number;
  /** Lato minimo dei bersagli (GDD 17 chiede 48 px, ARCHITETTURA 15.2 44 px). */
  minTarget?: number;
}

export interface AuditProblem {
  kind: 'overflow' | 'fuori-pulsante' | 'fuori-schermo' | 'piccolo' | 'chiave' | 'safe-area';
  what: string;
  detail: string;
}

/** Prefissi delle chiavi di testo del gioco (namespace dei file i18n e dei contenuti). */
const KEY_PREFIXES = ['core', 'ui', 'tombolo', 'campaign', 'audio', 'comune', 'atto1', 'atto2', 'atto3', 'finali'];

export async function auditLayout(page: Page, opts: AuditOptions = {}): Promise<AuditProblem[]> {
  return page.evaluate(
    ({ o, prefixes }) => {
      const out: { kind: string; what: string; detail: string }[] = [];
      const root = document.getElementById('ui-root');
      if (!root) return out;
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const minT = (o.minTarget ?? 44) - 0.5;
      const keyRe = new RegExp(`^(${prefixes.join('|')})\\.[A-Za-z0-9_]+(\\.[A-Za-z0-9_-]+)+$`);
      const name = (e: Element): string => {
        const h = e as HTMLElement;
        const cls = typeof h.className === 'string' ? h.className.split(' ')[0] : '';
        return `${e.tagName.toLowerCase()}${h.dataset?.test ? `[${h.dataset.test}]` : ''}${cls ? `.${cls}` : ''}`;
      };
      const clipped = (e: Element): DOMRect | null => {
        const r = e.getBoundingClientRect();
        let l = r.left;
        let t = r.top;
        let rr = r.right;
        let b = r.bottom;
        for (let p = e.parentElement; p && p !== document.body; p = p.parentElement) {
          const cs = getComputedStyle(p);
          if (cs.overflowX !== 'visible' || cs.overflowY !== 'visible') {
            const pr = p.getBoundingClientRect();
            if (cs.overflowX !== 'visible') {
              l = Math.max(l, pr.left);
              rr = Math.min(rr, pr.right);
            }
            if (cs.overflowY !== 'visible') {
              t = Math.max(t, pr.top);
              b = Math.min(b, pr.bottom);
            }
          }
        }
        if (rr - l < 1 || b - t < 1) return null;
        return new DOMRect(l, t, rr - l, b - t);
      };
      const skip = (e: Element): boolean =>
        !!e.closest('.core-sr-only, [hidden], [aria-hidden="true"], .core-toasts, .core-captions, .cp-titoli-scorre, [data-test="cp-titoli"]');
      const visible = (e: Element): boolean => {
        for (let p: Element | null = e; p && p !== document.documentElement; p = p.parentElement) {
          const cs = getComputedStyle(p);
          if (cs.display === 'none' || cs.visibility === 'hidden' || Number(cs.opacity) === 0) return false;
        }
        return true;
      };
      /** Il contenitore più vicino che scorre davvero in verticale. */
      const scroller = (e: Element): HTMLElement | null => {
        for (let p = e.parentElement; p && p !== document.body; p = p.parentElement) {
          const oy = getComputedStyle(p).overflowY;
          if ((oy === 'auto' || oy === 'scroll') && p.scrollHeight > p.clientHeight + 1) return p;
        }
        return null;
      };
      const scrollers = new Set<HTMLElement>();
      const scrolls = (e: Element): boolean => ['auto', 'scroll'].includes(getComputedStyle(e).overflowX);
      for (const e of Array.from(root.querySelectorAll('*'))) {
        if (skip(e)) continue;
        const r = e.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) continue;
        if (!visible(e)) continue;
        const cs = getComputedStyle(e);
        const vis = clipped(e);
        const ownText = Array.from(e.childNodes)
          .filter((n) => n.nodeType === 3)
          .map((n) => (n.textContent ?? '').trim())
          .join(' ')
          .trim();
        const interactive = e.matches('button, a[href], input:not([type="hidden"]), select, textarea, [role="button"], [role="switch"], [role="tab"], [role="radio"], [role="slider"], [role="checkbox"]');
        const html = e as HTMLElement;
        if (ownText) {
          if (cs.display !== 'inline' && !scrolls(e) && e.tagName !== 'TEXTAREA' && e.tagName !== 'INPUT' && !/\d/.test(cs.webkitLineClamp ?? '') && html.scrollWidth > html.clientWidth + 1) {
            out.push({ kind: 'overflow', what: name(e), detail: `${html.scrollWidth}>${html.clientWidth} «${ownText.slice(0, 40)}»` });
          }
          if (vis && (vis.right > vw + 1 || vis.left < -1)) out.push({ kind: 'fuori-schermo', what: name(e), detail: `${Math.round(vis.left)}..${Math.round(vis.right)} «${ownText.slice(0, 30)}»` });
          const b = e.closest('button');
          // Un testo ruotato o inclinato (la calligrafia dei bigliettini) ha un rettangolo
          // allineato agli assi più largo di quello che si vede: non si confronta.
          let turned = false;
          for (let p: Element | null = e; p && p !== b; p = p.parentElement) if (getComputedStyle(p).transform !== 'none') turned = true;
          if (b && b !== e && !turned) {
            const br = b.getBoundingClientRect();
            if (r.right > br.right + 1 || r.left < br.left - 1) out.push({ kind: 'fuori-pulsante', what: name(e), detail: `«${ownText.slice(0, 30)}»` });
          }
          if (keyRe.test(ownText)) out.push({ kind: 'chiave', what: name(e), detail: ownText });
        }
        if (interactive && !(html as HTMLButtonElement).disabled && (r.width < minT || r.height < minT)) {
          out.push({ kind: 'piccolo', what: name(e), detail: `${Math.round(r.width)}×${Math.round(r.height)}` });
        }
        if (vis && (o.safeTop || o.safeBottom) && (interactive || ownText)) {
          const top = o.safeTop ?? 0;
          const bottom = vh - (o.safeBottom ?? 0);
          // Un'area di tocco alta come lo schermo (lo schermo nero del prologo) non è un controllo da spostare.
          const fullScreen = r.width >= 200 && r.height >= vh * 0.9;
          if (!fullScreen && (vis.top < top - 0.5 || vis.bottom > bottom + 0.5)) {
            const sc = scroller(e);
            if (sc) scrollers.add(sc);
            else out.push({ kind: 'safe-area', what: name(e), detail: `y ${Math.round(vis.top)}..${Math.round(vis.bottom)} (sicuro ${top}..${bottom})${ownText ? ` «${ownText.slice(0, 30)}»` : ''}` });
          }
        }
      }
      // Dentro un contenitore che scorre il contenuto può passare sotto le fasce di sistema
      // mentre si scorre; basta che agli estremi dello scorrimento tutto sia raggiungibile.
      for (const sc of scrollers) {
        const top = o.safeTop ?? 0;
        const bottom = vh - (o.safeBottom ?? 0);
        const saved = sc.scrollTop;
        const extent = (): { min: number; max: number } => {
          let min = Infinity;
          let max = -Infinity;
          for (const d of Array.from(sc.querySelectorAll('*'))) {
            if (skip(d) || !visible(d)) continue;
            const own = Array.from(d.childNodes).some((n) => n.nodeType === 3 && (n.textContent ?? '').trim().length > 0);
            const inter = d.matches('button, a[href], input, select, textarea, [role="button"], [role="tab"], [role="switch"]');
            if (!own && !inter) continue;
            const v = clipped(d);
            if (!v) continue;
            min = Math.min(min, v.top);
            max = Math.max(max, v.bottom);
          }
          return { min, max };
        };
        sc.scrollTop = sc.scrollHeight;
        const atEnd = extent();
        sc.scrollTop = 0;
        const atStart = extent();
        sc.scrollTop = saved;
        if (atEnd.max > bottom + 0.5) out.push({ kind: 'safe-area', what: `${name(sc)} (fine dello scorrimento)`, detail: `l’ultimo elemento resta a y ${Math.round(atEnd.max)} > ${bottom}` });
        if (atStart.min < top - 0.5) out.push({ kind: 'safe-area', what: `${name(sc)} (inizio dello scorrimento)`, detail: `il primo elemento resta a y ${Math.round(atStart.min)} < ${top}` });
      }
      return out;
    },
    { o: opts, prefixes: KEY_PREFIXES },
  ) as Promise<AuditProblem[]>;
}

/** Riassunto leggibile dei problemi (per i messaggi delle asserzioni). */
export function describeProblems(list: AuditProblem[], max = 8): string {
  const lines = list.slice(0, max).map((p) => `${p.kind} ${p.what} ${p.detail}`);
  if (list.length > max) lines.push(`… e altri ${list.length - max}`);
  return lines.join('\n');
}
