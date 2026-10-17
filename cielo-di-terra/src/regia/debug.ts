/**
 * API di debug della regia su `window.__GAME__.regia` (sviluppo e build E2E).
 *
 * Serve alle prove automatiche: leggere lo stato della storia, far avanzare il gioco senza
 * disegnare (`avanza`), spostarsi (`vai`), mirare un bersaglio (`mira`), tenere un tasto
 * (`tieni`). Le azioni vere passano sempre dai sistemi del gioco: il tasto E sui bersagli,
 * le risposte dei dialoghi con i tasti 1-9, la lettura delle carte, lo squadro.
 */
import { Vector3 } from 'three';
import { cylToWorld, worldToCyl } from '../world/cylinder';
import { luogo } from './contenuti';
import { posizioneDi, verboDi } from './interazioni';
import type { Regia } from './regia';
import { inventarioPorte, riassuntoPorte, verificaPaese } from '../popolamento/verificaPorte';

export interface DebugRegia {
  regia: Regia;
  stato(): Record<string, unknown>;
  flag(nome: string): unknown;
  flags(): Record<string, unknown>;
  /** Avanza di `secondi` (passi fissi a 60 Hz) senza disegnare. */
  avanza(secondi: number): void;
  /** Avanza finché `cond` (stringa del linguaggio delle condizioni) è vera, al massimo `max` secondi. */
  avanzaFinche(cond: string, max?: number, passo?: number): boolean;
  /** Va a un luogo di luoghi.json o a (z, θ). */
  vai(luogoOz: string | number, theta?: number, altezza?: number): Record<string, unknown>;
  /** Mira un bersaglio d'interazione, un punto della scena o un (z, θ, h). */
  mira(id: string | [number, number, number]): boolean;
  /** Si avvicina a un bersaglio (a `distanza` m, alla quota del suolo) e lo mira. */
  avvicina(id: string, distanza?: number): boolean;
  /** I bersagli disponibili adesso (con il verbo). */
  bersagli(): { id: string; verbo: string; distanza: number }[];
  /** Tiene premuto un tasto per `secondi` (passi fissi), poi lo rilascia. */
  tieni(codice: string, secondi: number): void;
  /** Preme e rilascia un tasto (un passo). */
  premi(codice: string): void;
  impostaOra(giorno: number, ore: number): void;
  scalaTempo(k: number): void;
  diario(): string[];
  salva(): Promise<void>;
  sguardo(yaw: number, pitch: number): void;
  posizione(id: string): [number, number, number] | null;
  /**
   * Migliorie «porte»: la verifica delle porte sul paese di questa partita (lo stesso di chi gioca,
   * con la vegetazione del motore), con l'inventario per le schermate.
   */
  verificaPorte(): Promise<{ riassunto: Record<string, number>; porte: unknown[] }>;
}

export function installaDebugRegia(r: Regia): DebugRegia {
  const g = r.game;
  const passi = (secondi: number) => Math.max(1, Math.round(secondi * 60));
  const puntoDi = (id: string | [number, number, number]): Vector3 | null => {
    if (Array.isArray(id)) return cylToWorld(id[0], id[1], id[2]);
    const b = r.interazioni.get(id);
    if (b) return posizioneDi(b);
    return r.scena.punto(id) ?? r.cripta.punti[id] ?? r.cella.punti[id] ?? null;
  };
  const api: DebugRegia = {
    regia: r,
    stato() {
      const n = r.narrativa;
      const pc = g.player.cyl;
      const nodo = r.dialoghi.nodo;
      return {
        fase: r.fase,
        giorno: r.orologio.giorno,
        ore: r.orologio.ore,
        ora: r.testoOra(),
        fermo: r.orologio.fermo,
        limite: r.orologio.limite,
        interno: r.interno,
        controllo: r.controllo.tipo,
        posizione: { z: pc.z, theta: pc.theta, h: pc.h },
        luoghi: [...r.luoghiQui],
        passiAttivi: n.missioni.passiAttivi().map((p) => p.passo),
        missioniAttive: n.missioni.attive(),
        missioniCompletate: n.missioni.completate(),
        inventario: n.inventario.elenco(),
        bersaglio: r.statoInterazione.bersaglio?.id ?? null,
        progresso: r.statoInterazione.progresso,
        dialogo: nodo ? { dialogo: nodo.dialogo, nodo: nodo.nodo, chi: nodo.chi, testo: nodo.testo, risposte: nodo.risposte.map((x) => x.testo) } : null,
        lettura: r.ponte.letturaAperta,
        modali: { dialogo: r.ui.dialogo.visible, lettore: r.ui.lettore.visible, pianta: r.ui.pianta.visible, taccuino: r.ui.taccuino.visible, titolo: r.ui.titolo.visible, pausa: r.ui.pausa.visible },
        ultimaBattuta: r.ultimaBattuta,
        ultimoSuggerimento: r.ultimoSuggerimento,
        fiato: r.corpo.fiato,
        lente: r.lente,
        squadro: { stato: r.squadro.stato, stazione: r.squadro.stazione, livellato: r.squadro.livellato, bolla: r.squadro.bolla, telescopio: r.squadro.telescopio, disponibile: r.squadro.disponibile },
        varianti: Object.fromEntries(['E1', 'E2', 'E3', 'E4'].map((e) => [e, r.catasto.variante(e)])),
        latiChiusi: r.catasto.latiChiusi(),
        ottavio: r.abitanti.modoOttavio,
        ottavioDistanza: Math.round(r.abitanti.distanzaDa('ottavio', pc.z, pc.theta) * 10) / 10,
        ottavioPos: (() => {
          const o = r.abitanti.posizione('ottavio');
          return o ? [Math.round(o.z * 10) / 10, Math.round(o.theta * 100) / 100, Math.round(o.h * 10) / 10] : null;
        })(),
        taccuino: n.taccuino.voci().length,
        rigaCielo: r.ponte.rigaCielo(),
      };
    },
    flag: (nome) => r.narrativa.flag.get(nome),
    flags: () => r.narrativa.flag.tutti(),
    avanza(secondi) {
      g.loop.stepUpdates(passi(secondi));
    },
    avanzaFinche(cond, max = 120, passo = 0.25) {
      for (let t = 0; t < max; t += passo) {
        if (r.narrativa.valuta(cond)) return true;
        g.loop.stepUpdates(passi(passo));
      }
      return r.narrativa.valuta(cond);
    },
    vai(luogoOz, theta, altezza = 0) {
      if (typeof luogoOz === 'string') {
        const l = luogo(luogoOz);
        if (!l) throw new Error(`luogo sconosciuto: ${luogoOz}`);
        r.vai(l.z, l.theta, altezza);
      } else r.vai(luogoOz, theta ?? 0, altezza);
      g.loop.stepUpdates(2);
      return api.stato();
    },
    mira(id) {
      const p = puntoDi(id);
      if (!p) return false;
      r.guarda(p);
      return true;
    },
    avvicina(id, distanza = 1.4) {
      const p = puntoDi(id);
      if (!p) return false;
      const c = worldToCyl(p);
      const pc = g.player.cyl;
      // dalla parte di dove si trova adesso Elvira, a `distanza` m dal bersaglio; se un muro,
      // una panca o una casa la spingono più in là, si prova girando attorno al bersaglio
      const dz0 = pc.z - c.z;
      const ds0 = ((((pc.theta - c.theta + 540) % 360) - 180) * Math.PI * 646) / 180;
      const a0 = Math.atan2(ds0, dz0 || 1e-6);
      const metti = (a: number) => {
        const z = c.z + Math.cos(a) * distanza;
        const th = c.theta + ((Math.sin(a) * distanza * 180) / (Math.PI * 646));
        if (r.interno === 'cella') {
          g.player.teleport(z, th, r.cella.quotaPavimento, true);
          g.syncEyeNow();
        } else if (r.interno) {
          g.player.teleport(z, th, 0);
          g.syncEyeNow();
        } else r.vai(z, th);
        g.loop.stepUpdates(2);
        const q = g.player.cyl;
        return Math.hypot(q.z - c.z, ((((q.theta - c.theta + 540) % 360) - 180) * Math.PI * 646) / 180);
      };
      let migliore = { a: a0, scarto: Infinity };
      for (const k of [0, 1, -1, 2, -2, 3, -3, 4]) {
        const a = a0 + (k * Math.PI) / 4;
        const scarto = Math.abs(metti(a) - distanza);
        if (scarto < migliore.scarto) migliore = { a, scarto };
        if (scarto < 0.5) break;
      }
      if (migliore.scarto >= 0.5) metti(migliore.a);
      r.guarda(p);
      g.loop.stepUpdates(1);
      return true;
    },
    bersagli() {
      const o = r.occhi(new Vector3());
      return r.interazioni
        .tutti()
        .filter((b) => !b.disponibile || b.disponibile())
        .map((b) => ({ id: b.id, verbo: verboDi(b), distanza: posizioneDi(b)?.distanceTo(o) ?? -1 }))
        .filter((b) => b.distanza >= 0 && b.distanza < 30)
        .sort((a, b) => a.distanza - b.distanza);
    },
    tieni(codice, secondi) {
      g.input.simulate(codice, true);
      g.loop.stepUpdates(passi(secondi));
      g.input.simulate(codice, false);
      g.loop.stepUpdates(1);
    },
    premi(codice) {
      g.input.simulate(codice, true);
      g.loop.stepUpdates(1);
      g.input.simulate(codice, false);
      g.loop.stepUpdates(1);
    },
    impostaOra(giorno, ore) {
      r.orologio.imposta(giorno, ore);
    },
    scalaTempo(k) {
      r.orologio.scalaDebug = k;
    },
    diario: () => [...r.diario],
    salva: () => r.salva(),
    sguardo(yaw, pitch) {
      r.guardaDirezione(yaw, pitch);
    },
    posizione(id) {
      const p = puntoDi(id);
      if (!p) return null;
      const c = worldToCyl(p);
      return [c.z, c.theta, c.h];
    },
    async verificaPorte() {
      const esiti = verificaPaese(r.corbella, g.world.colliders);
      return { riassunto: riassuntoPorte(esiti), porte: inventarioPorte(esiti, r.corbella.scalette(true)) };
    },
  };
  const w = window as unknown as { __GAME__?: Record<string, unknown> };
  if (w.__GAME__) w.__GAME__['regia'] = api;
  else w.__GAME__ = { regia: api };
  return api;
}
