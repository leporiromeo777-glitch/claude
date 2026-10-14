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
 *    visibile cade nella fascia alta o bassa riservata al sistema;
 *  - `fuori-foglio`: i glifi di un testo (misurati con un Range, quindi con le
 *    rotazioni della calligrafia) escono dal foglio che lo contiene, cioè dal primo
 *    antenato con uno sfondo: la lettera che esce dalla carta o viene tagliata;
 *  - `coperto`: al centro di un elemento interattivo il tocco arriva a un altro
 *    elemento (un testo inclinato sopra «Appunta», un pulsante sopra un altro);
 *  - `testo-coperto`: un testo sta sotto un pulsante (fuori dai contenitori che
 *    scorrono; per quelli si guarda l'ultimo testo a fine scorrimento);
 *  - `parola-spezzata`: una parola va a capo a metà (senza trattino);
 *  - `testo-piccolo` (solo informativo): testo sotto i 15 px × dimensione del testo
 *    (GDD 10.1).
 * Quello che sta sotto una finestra modale aperta (conferma, overlay, scheda) non si
 * confronta con la finestra: è coperto apposta.
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
  kind: 'overflow' | 'fuori-pulsante' | 'fuori-schermo' | 'piccolo' | 'chiave' | 'safe-area' | 'fuori-foglio' | 'coperto' | 'testo-coperto' | 'parola-spezzata' | 'testo-piccolo';
  what: string;
  detail: string;
}

/** Tipi di problema che non fanno fallire il giro: si allegano al rapporto. */
export const INFO_KINDS: ReadonlySet<AuditProblem['kind']> = new Set(['testo-piccolo']);

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
      const safeScrollers = new Set<HTMLElement>();
      const scrolls = (e: Element): boolean => ['auto', 'scroll'].includes(getComputedStyle(e).overflowX);
      const INTERACTIVE = 'button, a[href], input:not([type="hidden"]), select, textarea, [role="button"], [role="switch"], [role="tab"], [role="radio"], [role="slider"], [role="checkbox"]';
      const textScale = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--text-scale')) || 1;
      /** Rettangoli dei glifi dei nodi di testo propri (con le trasformazioni degli antenati). */
      const textRects = (e: Element): DOMRect[] => {
        const rects: DOMRect[] = [];
        for (const n of Array.from(e.childNodes)) {
          if (n.nodeType !== 3 || !(n.textContent ?? '').trim()) continue;
          const rg = document.createRange();
          rg.selectNodeContents(n);
          for (const q of Array.from(rg.getClientRects())) if (q.width > 0.5 && q.height > 0.5) rects.push(q);
        }
        return rects;
      };
      /** |seno| della rotazione accumulata dagli antenati (calligrafia inclinata). */
      const slant = (e: Element): number => {
        let sin = 0;
        for (let p: Element | null = e; p && p !== document.body; p = p.parentElement) {
          const t = getComputedStyle(p).transform;
          const m = /^matrix\(([^)]+)\)/.exec(t);
          if (m) sin += Math.abs(Number(m[1]!.split(',')[1] ?? 0));
        }
        return Math.min(1, sin);
      };
      const hasBackground = (p: Element): boolean => {
        const cs = getComputedStyle(p);
        if (cs.backgroundImage !== 'none') return true;
        const m = /rgba?\(([^)]+)\)/.exec(cs.backgroundColor);
        if (!m) return false;
        const parts = m[1]!.split(',').map((x) => Number(x.trim()));
        return (parts[3] ?? 1) > 0.05;
      };
      /** Il foglio di un testo: il primo antenato (o sé stesso) con uno sfondo, non a tutto schermo. */
      const sheetOf = (e: Element): Element | null => {
        for (let p: Element | null = e; p && p !== root && p !== document.body; p = p.parentElement) {
          if (!hasBackground(p)) continue;
          const r = p.getBoundingClientRect();
          if (r.width >= vw * 0.98 && r.height >= vh * 0.98) return null;
          return p;
        }
        return null;
      };
      /** Lo strato modale più vicino (finestra, overlay, scheda) che contiene un elemento. */
      const MODAL = '[aria-modal="true"], [role="dialog"], [role="alertdialog"], .core-overlay, .core-modal-host';
      const underModal = (e: Element, hit: Element): boolean => {
        const layer = hit.closest(MODAL);
        if (layer && !layer.contains(e)) return true;
        // Un velo a tutto schermo (lo sfondo di una finestra) copre apposta quello che c'è sotto.
        for (let p: Element | null = hit; p && p !== root && p !== document.body; p = p.parentElement) {
          if (p.contains(e)) return false;
          const r = p.getBoundingClientRect();
          if (r.width >= vw * 0.95 && r.height >= vh * 0.95) return true;
        }
        return false;
      };
      const transient = (hit: Element): boolean => !!hit.closest('.core-toasts, .core-captions, [data-test="toast"], [data-test="caption"]');
      const ellipsis = (e: Element, until: Element | null): boolean => {
        for (let p: Element | null = e; p && p !== until?.parentElement; p = p.parentElement) {
          const cs = getComputedStyle(p);
          if (cs.textOverflow === 'ellipsis' || /\d/.test(cs.webkitLineClamp ?? '')) return true;
        }
        return false;
      };
      /** Fra `e` e il suo foglio (compreso) c'è un contenitore che scorre su quell'asse (anche da script). */
      const scrollsBetween = (e: Element, sheet: Element, axis: 'x' | 'y'): boolean => {
        for (let p = e.parentElement; p; p = p.parentElement) {
          const cs = getComputedStyle(p);
          const ov = axis === 'y' ? cs.overflowY : cs.overflowX;
          const more = axis === 'y' ? p.scrollHeight > p.clientHeight + 1 : p.scrollWidth > p.clientWidth + 1;
          if (ov !== 'visible' && more && (p === sheet || sheet.contains(p))) return true;
          if (p === sheet) return false;
        }
        return false;
      };
      /** Il pulsante che riceve il tocco in quel punto (null se è un testo o nulla). */
      const buttonAt = (x: number, y: number): Element | null => {
        if (x < 0 || y < 0 || x >= vw || y >= vh) return null;
        const hit = document.elementFromPoint(x, y);
        return hit ? hit.closest(INTERACTIVE) : null;
      };
      /** Chi riceve il tocco al punto (x, y) se non è `e` (null se arriva a `e`). */
      const coveredAt = (e: Element, x: number, y: number): Element | null => {
        if (x < 0 || y < 0 || x >= vw || y >= vh) return null;
        const hit = document.elementFromPoint(x, y);
        if (!hit || hit === e || e.contains(hit) || transient(hit) || underModal(e, hit)) return null;
        return hit;
      };
      const coveredText = (e: Element): { by: Element; rect: DOMRect } | null => {
        // Solo le righe che si vedono (non quelle tagliate da un riassunto a tre righe).
        const v = clipped(e);
        if (!v) return null;
        const rects = textRects(e).filter((q) => {
          const cy = q.top + q.height / 2;
          return cy >= v.top && cy <= v.bottom && q.right > v.left && q.left < v.right;
        });
        if (rects.length === 0) return null;
        const last = rects[rects.length - 1]!;
        for (const q of [rects[0]!, last]) {
          const x = q.left + Math.min(q.width / 2, 12);
          const y = q.top + q.height / 2;
          const b = buttonAt(x, y);
          if (!b || b.contains(e) || e.contains(b) || transient(b) || underModal(e, b)) continue;
          return { by: b, rect: q };
        }
        return null;
      };
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
        const interactive = e.matches(INTERACTIVE);
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
          // Glifi fuori dal foglio (anche ruotati): la tolleranza tiene conto dell'inclinazione,
          // perché il rettangolo di una riga ruotata è un po' più grande di quella vera.
          const sheet = sheetOf(e);
          const rects = textRects(e);
          if (sheet && rects.length > 0 && !ellipsis(e, sheet)) {
            const sr = sheet.getBoundingClientRect();
            const sin = slant(e);
            const lineH = parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.3;
            const tolX = 2 + lineH * sin;
            let worst = 0;
            let where = '';
            for (const q of rects) {
              const tolY = 2 + q.width * sin;
              const dx = Math.max(sr.left - q.left - tolX, q.right - sr.right - tolX, 0);
              const dy = scrollsBetween(e, sheet, 'y') ? 0 : Math.max(sr.top - q.top - tolY, q.bottom - sr.bottom - tolY, 0);
              const d = Math.max(scrollsBetween(e, sheet, 'x') ? 0 : dx, dy);
              if (d > worst) {
                worst = d;
                where = `${Math.round(q.left)},${Math.round(q.top)}..${Math.round(q.right)},${Math.round(q.bottom)} nel foglio ${Math.round(sr.left)},${Math.round(sr.top)}..${Math.round(sr.right)},${Math.round(sr.bottom)}`;
              }
            }
            if (worst >= 1) out.push({ kind: 'fuori-foglio', what: `${name(e)} in ${name(sheet)}`, detail: `${Math.round(worst)} px fuori (${where}) «${ownText.slice(0, 30)}»` });
          }
          // Parole spezzate a metà (senza trattino): una parola su due righe.
          for (const n of Array.from(e.childNodes)) {
            if (n.nodeType !== 3) continue;
            const t = n.textContent ?? '';
            for (const m of t.matchAll(/[^\s\u00AD-]{4,}/g)) {
              const rg = document.createRange();
              rg.setStart(n, m.index ?? 0);
              rg.setEnd(n, (m.index ?? 0) + m[0].length);
              // Solo le parti che si vedono (non le righe nascoste da un riassunto a tre righe).
              const qs = Array.from(rg.getClientRects()).filter((q) => q.width > 0.5 && !!vis && q.top + q.height / 2 >= vis.top && q.top + q.height / 2 <= vis.bottom);
              const tops = qs.map((q) => q.top);
              // Su due righe: la seconda parte sta almeno mezza riga più in basso (con la
              // calligrafia inclinata una parola intera può dare due rettangoli quasi sovrapposti).
              if (tops.length > 1 && Math.max(...tops) - Math.min(...tops) > 0.6 * Math.min(...qs.map((q) => q.height))) {
                out.push({ kind: 'parola-spezzata', what: name(e), detail: `«${m[0]}»` });
                break;
              }
            }
          }
          // Testo sotto un pulsante (fuori dai contenitori che scorrono: lì conta la fine).
          const sc = scroller(e);
          if (sc) scrollers.add(sc);
          else {
            const cov = coveredText(e);
            if (cov) out.push({ kind: 'testo-coperto', what: name(e), detail: `sotto ${name(cov.by)} a ${Math.round(cov.rect.left)},${Math.round(cov.rect.top)} «${ownText.slice(0, 30)}»` });
          }
          const fs = parseFloat(cs.fontSize);
          if (fs < 15 * textScale - 0.5) out.push({ kind: 'testo-piccolo', what: name(e), detail: `${fs.toFixed(1)} px < ${(15 * textScale).toFixed(1)} «${ownText.slice(0, 30)}»` });
        }
        // Al centro di un comando il tocco deve arrivare al comando (o a un suo figlio).
        if (interactive && vis && !(html as HTMLButtonElement).disabled && html.getAttribute('aria-disabled') !== 'true') {
          const cx = vis.left + vis.width / 2;
          const cy = vis.top + vis.height / 2;
          if (cx >= 0 && cy >= 0 && cx < vw && cy < vh && getComputedStyle(e).pointerEvents !== 'none') {
            // In un contenitore che scorre un comando può passare sotto un bordo o un piede
            // mentre si scorre: lì contano il primo e l'ultimo comando agli estremi.
            const sc = scroller(e);
            if (sc) scrollers.add(sc);
            else {
              const by = coveredAt(e, cx, cy);
              if (by) out.push({ kind: 'coperto', what: name(e), detail: `al centro (${Math.round(cx)},${Math.round(cy)}) tocca ${name(by)}` });
            }
          }
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
            if (sc) safeScrollers.add(sc);
            else out.push({ kind: 'safe-area', what: name(e), detail: `y ${Math.round(vis.top)}..${Math.round(vis.bottom)} (sicuro ${top}..${bottom})${ownText ? ` «${ownText.slice(0, 30)}»` : ''}` });
          }
        }
      }
      // Dentro un contenitore che scorre il contenuto può passare sotto le fasce di sistema
      // mentre si scorre; basta che agli estremi dello scorrimento tutto sia raggiungibile.
      // Contenitori che scorrono: a fine scorrimento l'ultimo testo non resta sotto un pulsante.
      for (const sc of scrollers) {
        const saved = sc.scrollTop;
        sc.scrollTop = sc.scrollHeight;
        let lastEl: Element | null = null;
        let lastBottom = -Infinity;
        for (const d of Array.from(sc.querySelectorAll('*'))) {
          if (skip(d) || !visible(d)) continue;
          const rs = textRects(d);
          const b = rs.length ? Math.max(...rs.map((q) => q.bottom)) : -Infinity;
          if (b > lastBottom) {
            lastBottom = b;
            lastEl = d;
          }
        }
        if (lastEl) {
          const cov = coveredText(lastEl);
          if (cov) out.push({ kind: 'testo-coperto', what: `${name(lastEl)} (fine di ${name(sc)})`, detail: `a fine scorrimento resta sotto ${name(cov.by)} «${(lastEl.textContent ?? '').trim().slice(0, 30)}»` });
        }
        // Il primo comando a inizio scorrimento e l'ultimo a fine scorrimento si toccano.
        const commands = (): Element[] =>
          Array.from(sc.querySelectorAll(INTERACTIVE)).filter((d) => !skip(d) && visible(d) && !(d as HTMLButtonElement).disabled && d.getAttribute('aria-disabled') !== 'true' && getComputedStyle(d).pointerEvents !== 'none');
        const probe = (d: Element | undefined, when: string): void => {
          const v = d ? clipped(d) : null;
          if (!d || !v) return;
          const by = coveredAt(d, v.left + v.width / 2, v.top + v.height / 2);
          if (by) out.push({ kind: 'coperto', what: `${name(d)} (${when} di ${name(sc)})`, detail: `al centro tocca ${name(by)}` });
        };
        const atEnd = commands();
        probe(atEnd.sort((a, b) => b.getBoundingClientRect().bottom - a.getBoundingClientRect().bottom)[0], 'fine dello scorrimento');
        sc.scrollTop = 0;
        const atStart = commands();
        probe(atStart.sort((a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top)[0], 'inizio dello scorrimento');
        sc.scrollTop = saved;
      }
      for (const sc of safeScrollers) {
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
