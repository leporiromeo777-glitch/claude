/**
 * La regia col catasto (src/rilievo) e gli abitanti: la «linea libera?» sul terreno e sui
 * collisori, le tappe del tempo (brace, notte che comincia, alba, resoconto), gli orari dei
 * personaggi e Ottavio che viene incontro a Elvira.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { Quaternion, Vector3 } from 'three';
import { CatastoGioco, creaLineaLibera, dentroCollisore, posizioniCapisaldi } from '../../src/regia/catasto';
import { CAPISALDI, PARTICELLE_AREA, PERSONAGGI, luogo, type Personaggio } from '../../src/regia/contenuti';
import { installaCorbella, type ManigliaCorbella } from '../../src/popolamento';
import { giocoFinto } from '../popolamento/banco';
import { assolutoDi } from '../../src/regia/orologio';
import { Abitanti, angoloDallAvanti, luogoDaOrario, posizioneCleliaAllaCasa, type ContestoAbitanti } from '../../src/regia/png';
import { sposta } from '../../src/popolamento/terreno';
import type { ContestoVisibilita, EventoCatasto, PuntoMira } from '../../src/rilievo';
import { ColliderWorld, boxAt } from '../../src/world/colliders';
import { cylToWorld, localFrameTheta, surfaceDistance } from '../../src/world/cylinder';
import { groundHeight } from '../../src/world/terrain';
import type { World } from '../../src/world/world';

/** Punto di mira di un caposaldo dei contenuti. */
function pm(id: string): PuntoMira {
  const c = CAPISALDI.find((x) => x.id === id)!;
  return { id, z: c.z, theta: c.theta, altezza: c.altezza, altezzaSegnale: c.altezza_segnale ?? 0 };
}

/** Le posizioni senza scena: il Pilastro 1 sta in alto sulla cella (20 m sopra la piazza). */
/** Contesto di una mira di giorno per un lato. */
const LATO: ContestoVisibilita = { scopo: 'lato', ora: 10 * 60 };

const posizioni = posizioniCapisaldi({
  punto: (id) => (id === 'cs_1' ? cylToWorld(1062, 37.2, groundHeight(1062, 37.2) + 20) : null),
  segnale: () => null,
});

describe('linea libera', () => {
  const libera = creaLineaLibera(null, posizioni.occhio, posizioni.segnale);

  it('i lati della Fase 1 si vedono sul terreno (3-1, 7-8, 6-2, 1-11)', () => {
    expect(libera(pm('cs_3'), pm('cs_1'), LATO)).toBe(true);
    expect(libera(pm('cs_7'), pm('cs_8'), LATO)).toBe(true);
    expect(libera(pm('cs_6'), pm('cs_2'), LATO)).toBe(true);
    expect(libera(pm('cs_11'), pm('cs_1'), LATO)).toBe(true);
  });

  it('il terreno copre il Monte (CS 4) da Corbella', () => {
    expect(libera(pm('cs_1'), pm('cs_4'), LATO)).toEqual({ libera: false, motivo: 'Il terreno copre la mira.' });
  });

  it('una casa in mezzo copre la mira; il collisore che regge la stazione no', () => {
    const cols = new ColliderWorld();
    const a = pm('cs_7');
    const b = pm('cs_8');
    // a metà del lato 7-8, una casa di 8 m
    const zm = (a.z + b.z) / 2;
    const tm = (a.theta + b.theta) / 2;
    cols.add(boxAt(zm, tm, groundHeight(zm, tm) - 1, 0, 30, 12, 30, 'casa'));
    // il muro su cui sta il chiodo 7
    cols.add(boxAt(a.z, a.theta, groundHeight(a.z, a.theta) - 1, 0, 2, 4, 2, 'muro'));
    const coperta = creaLineaLibera(cols, posizioni.occhio, posizioni.segnale);
    expect(coperta(a, b, LATO)).toEqual({ libera: false, motivo: 'Una casa copre la mira.' });
    cols.clear();
    cols.add(boxAt(a.z, a.theta, groundHeight(a.z, a.theta) - 1, 0, 2, 4, 2, 'muro'));
    expect(creaLineaLibera(cols, posizioni.occhio, posizioni.segnale)(a, b, LATO)).toBe(true);
  });

  it('dentroCollisore: scatole e cilindri, con il margine', () => {
    const box = boxAt(1000, 30, groundHeight(1000, 30), 0, 4, 4, 4);
    expect(dentroCollisore(box, cylToWorld(1000, 30, groundHeight(1000, 30) + 2))).toBe(true);
    expect(dentroCollisore(box, cylToWorld(1000, 30, groundHeight(1000, 30) + 5))).toBe(false);
    expect(dentroCollisore(box, cylToWorld(1001.9, 30, groundHeight(1000, 30) + 2), 0.5)).toBe(false);
  });
});

describe('CatastoGioco', () => {
  function nuovo() {
    const celle = new Map<number, number>();
    const world = { colliders: null, setCellState: (id: number, s: number) => celle.set(id, s), revealCells: () => {} } as unknown as World;
    const varianti: string[] = [];
    const effetti: string[] = [];
    const eventi: EventoCatasto[] = [];
    const c = new CatastoGioco(world, { mostraVariante: (e, v) => varianti.push(`${e}=${v}`) }, (e) => effetti.push(...e), posizioni);
    c.onEvento((e) => eventi.push(e));
    return { c, celle, varianti, effetti, eventi };
  }

  it('collegato al mondo: le altre valli restano a matita, gli elementi mobili mostrano la variante', () => {
    const { c, celle, varianti } = nuovo();
    const area = new Set(PARTICELLE_AREA.map((p) => p.id));
    const fuori = [...celle.keys()].find((id) => !area.has(id))!;
    expect(c.stato(fuori)).toBe('bianco');
    expect(celle.get(fuori)).toBe(1);
    const bianca = PARTICELLE_AREA.map((p) => p.id).find((id) => c.stato(id) === 'bianco');
    if (bianca !== undefined) expect(celle.get(bianca)).toBe(0);
    for (const e of ['E1', 'E2', 'E3', 'E4']) expect(varianti.some((v) => v.startsWith(`${e}=`))).toBe(true);
  });

  it('dormendo, la notte si fa tutta all\'alba e la mattina dopo c\'è il resoconto', () => {
    const { c, eventi } = nuovo();
    c.scorri({ da: assolutoDi(1, 20.5), a: assolutoDi(2, 7) }, { cella: null, dorme: true });
    expect(eventi.some((e) => e.tipo === 'resoconto')).toBe(true);
    expect(c.resocontoDelMattino(2, 7)).not.toBeNull();
    expect(c.resocontoDelMattino(2, 12.5)).toBeNull();
    expect(c.resocontoDelMattino(3, 7)).toBeNull();
  });

  it('vegliando, la notte comincia alle 22:00, va avanti a minuti e si chiude alle 05:30', () => {
    const { c } = nuovo();
    c.scorri({ da: assolutoDi(1, 21.5), a: assolutoDi(1, 22.1) }, { cella: null, dorme: false });
    expect(c.catasto.stato.notteInCorso).toBeTruthy();
    for (let t = assolutoDi(1, 22.1); t < assolutoDi(2, 5.6); t += 0.25) c.scorri({ da: t, a: t + 0.25 }, { cella: null, dorme: false });
    expect(c.catasto.stato.notteInCorso).toBeFalsy();
    expect(c.resocontoDelMattino(2, 6)).not.toBeNull();
  });

  it('il primo rilievo (3-1) colora le particelle del lato e torna come effetto alla storia', () => {
    const { c, effetti, eventi } = nuovo();
    const r = c.rileva('cs_3', 'cs_1', 10, 2);
    expect(r.ok).toBe(true);
    expect(c.latiChiusi().length).toBeGreaterThan(0);
    expect(eventi.some((e) => e.tipo === 'lato_chiuso')).toBe(true);
    expect(effetti.length).toBeGreaterThan(0);
    // salvataggio e caricamento
    const blob = c.salva();
    const { c: d } = nuovo();
    d.carica(JSON.parse(JSON.stringify(blob)));
    expect(d.latiChiusi()).toEqual(c.latiChiusi());
  });

  it('dal chiodo 2 il Pilastro 1 non si chiude (il tasso del sagrato)', () => {
    const { c } = nuovo();
    const r = c.rileva('cs_2', 'cs_1', 10, 2);
    expect(r.ok).toBe(false);
  });
});

describe('Abitanti', () => {
  it('gli orari di personaggi.json: giorno, fasce orarie, condizioni', () => {
    const p: Personaggio = {
      id: 'prova',
      nome: 'Prova',
      posizioni: [
        { fase: 'giorno 1', luogo: 'piazza_ore', dalle: '07:00', alle: '12:00' },
        { fase: 'dal giorno 2', luogo: 'sagrato (sulla soglia)', dalle: '08:00', alle: '10:00', condizione: 'flag:campanile_aperto' },
        { fase: 'ogni giorno', luogo: 'in volo', dalle: '20:00', alle: '06:00' },
        { fase: 'notte', luogo: 'lavatoio' },
      ],
    } as Personaggio;
    expect(luogoDaOrario(p, 1, 8)).toBe('piazza_ore');
    expect(luogoDaOrario(p, 1, 13)).toBeNull();
    expect(luogoDaOrario(p, 3, 9, () => true)).toBe('sagrato');
    expect(luogoDaOrario(p, 3, 9, () => false)).toBeNull();
    expect(luogoDaOrario(p, 2, 23)).toBeNull(); // in volo
    expect(luogoDaOrario(p, 2, 3)).toBeNull();
  });

  it('i personaggi della Fase 1 hanno un posto nel villaggio di giorno', () => {
    const togna = PERSONAGGI.find((p) => p.id === 'togna')!;
    expect(luogoDaOrario(togna, 1, 9)).toBeTruthy();
  });

  describe('con le figure del popolamento', () => {
    let corbella: ManigliaCorbella;
    beforeAll(() => {
      corbella = installaCorbella(giocoFinto(), { agganciaCiclo: false, luciAbitanti: false });
    });
    const contesto = (elvira: { z: number; theta: number }, giorno: number, ore: number, valuta: (c: string) => boolean = () => false): ContestoAbitanti => ({
      giorno,
      ore,
      assoluto: (giorno - 1) * 24 + ore,
      valuta,
      occhi: cylToWorld(elvira.z, elvira.theta, groundHeight(elvira.z, elvira.theta) + 1.6),
      elvira,
    });
    const passi = (a: Abitanti, ctx: ContestoAbitanti, n: number, finche: () => boolean = () => true) => {
      for (let i = 0; i < n && finche(); i++) {
        a.update(1 / 60, ctx);
        corbella.update(1 / 60);
      }
    };

    it('Ottavio viene incontro a Elvira camminando e si ferma a un paio di metri', () => {
      const a = new Abitanti(corbella);
      const elvira = { z: 1046, theta: 37 };
      const ctx = contesto(elvira, 1, 10);
      a.ottavioFermo(1046 + 15, 37, 12);
      passi(a, ctx, 2);
      expect(a.presente('ottavio')).toBe(true);
      expect(a.distanzaDa('ottavio', elvira.z, elvira.theta)).toBeGreaterThan(14);
      a.ottavioRaggiunge();
      expect(a.modoOttavio).toBe('raggiunge');
      passi(a, ctx, 60 * 12, () => a.modoOttavio === 'raggiunge');
      expect(a.modoOttavio).toBe('fermo');
      const d = a.distanzaDa('ottavio', elvira.z, elvira.theta);
      expect(d).toBeLessThan(3);
      expect(d).toBeGreaterThan(1.5);
      // nel salvataggio resta il modo di prima, non il cammino
      a.ottavioRaggiunge();
      expect((a.esporta() as { ottavio: { tipo: string } }).ottavio.tipo).toBe('fermo');
      expect(a.puntoDialogo('ottavio')).toBeInstanceOf(Vector3);
    });

    it('se doveva già stare vicino a Elvira ci va subito; da lontano scende dal cielo', () => {
      const a = new Abitanti(corbella);
      const elvira = { z: 1174, theta: 58.06 };
      const ctx = contesto(elvira, 1, 19.8);
      // in piazza, a 240 m: la storia lo vuole davanti al fienile, il dialogo lo chiama nello stesso passo
      a.ottavioFermo(1071.6, 38.5);
      passi(a, ctx, 1);
      a.ottavioFermo(1174, 58.5, 31);
      a.ottavioRaggiunge();
      passi(a, ctx, 2);
      expect(a.modoOttavio).toBe('fermo');
      expect(a.distanzaDa('ottavio', elvira.z, elvira.theta)).toBeLessThan(6);
      // la regia chiede il dialogo nello stesso passo in cui lo mette fermo: per il direttore dei
      // dialoghi è già lì (niente avanti e indietro fra «fermo» e «raggiunge»)
      a.ottavioFermo(1071.6, 38.5);
      passi(a, ctx, 1);
      a.ottavioFermo(1174, 58.5, 31);
      expect(a.distanzaOttavioDa(elvira.z, elvira.theta)).toBeLessThan(6);
      a.ottavioRaggiunge();
      a.update(1 / 60, ctx);
      expect(a.modoOttavio).toBe('fermo');
      expect(a.distanzaDa('ottavio', elvira.z, elvira.theta)).toBeLessThan(6);
      // lontano davvero: atterra vicino a Elvira (in volo non è «presente»)
      a.ottavioFermo(1071.6, 38.5);
      passi(a, ctx, 1);
      a.ottavioRaggiunge();
      passi(a, ctx, 1);
      expect(a.modoOttavio).toBe('atterra');
      passi(a, ctx, 60);
      expect(a.presente('ottavio')).toBe(false);
      passi(a, ctx, 60 * 8, () => a.modoOttavio === 'atterra');
      expect(a.modoOttavio).toBe('fermo');
      expect(a.presente('ottavio')).toBe(true);
      expect(a.distanzaDa('ottavio', elvira.z, elvira.theta)).toBeLessThan(3);
    });

    it('in cielo gira sopra la valle col Velo verde; il fischio (atterra) lo porta giù', () => {
      const a = new Abitanti(corbella);
      const elvira = { z: 1046, theta: 37 };
      const ctx = contesto(elvira, 1, 8);
      a.ottavioInCielo();
      passi(a, ctx, 3);
      const o = corbella.npc('ottavio')!;
      expect(o.presente).toBe(true);
      expect(a.presente('ottavio')).toBe(false);
      expect(o.figura!.getObjectByName('velo-ottavio')!.visible).toBe(true);
      a.atterra(elvira.z + 4, elvira.theta);
      passi(a, ctx, 60 * 8);
      expect(a.presente('ottavio')).toBe(true);
      expect(o.figura!.getObjectByName('velo-ottavio')!.visible).toBe(false);
      a.ottavioSegueOrario();
      passi(a, ctx, 2);
      expect(o.manuale).toBe(false);
    });

    it('Clelia lascia la Bacheca dopo il dono (la condizione che il popolamento non valuta)', () => {
      const a = new Abitanti(corbella);
      const bacheca = luogo('bacheca_ore')!;
      const casa = posizioneCleliaAllaCasa()!;
      const elvira = { z: bacheca.z + 3, theta: bacheca.theta };
      corbella.applicaOrario(2, 9);
      passi(a, contesto(elvira, 2, 9), 2);
      expect(a.presente('clelia')).toBe(true);
      expect(a.vicini(elvira.z, elvira.theta, 8)).toContain('clelia');
      const donato = (c: string) => c === 'dialogo:d_clelia_dono finito';
      // se ne va a piedi verso la Casa del Velo (prima spariva in un fotogramma, all'ultima battuta): saluta,
      // si gira con calma, cammina senza salti ed entra alla porta
      const ctx = contesto(elvira, 2, 9, donato);
      let p = a.posizione('clelia')!;
      const p0 = p;
      let vMax = 0;
      let sparita = -1;
      for (let i = 0; i < 60 * 60 && sparita < 0; i++) {
        a.update(1 / 60, ctx);
        corbella.update(1 / 60);
        const q = a.posizione('clelia');
        if (!q) sparita = i / 60;
        else {
          // (all'arrivo il popolamento posa la figura sulla meta: al più 5 cm, l'ultimo passo non conta)
          if (corbella.npc('clelia')!.inCammino) vMax = Math.max(vMax, surfaceDistance(p.z, p.theta, q.z, q.theta) * 60);
          p = q;
        }
      }
      expect(sparita).toBeGreaterThan(20);
      expect(vMax).toBeLessThan(1.15);
      expect(surfaceDistance(p0.z, p0.theta, p.z, p.theta)).toBeGreaterThan(25);
      // alla porta della Casa del Velo (dove la sera la si trova)
      expect(surfaceDistance(p.z, p.theta, casa.z, casa.theta)).toBeLessThan(2);
      expect(a.presente('clelia')).toBe(false);
      // la sera è alla Casa del Velo (offre il letto a chi porta il velo), non alla Bacheca
      passi(a, contesto(elvira, 2, 20.2, donato), 40);
      expect(a.presente('clelia')).toBe(true);
      expect(a.distanzaDa('clelia', bacheca.z, bacheca.theta)).toBeGreaterThan(8);
      // il giorno dopo anche (gli orari, senza condizioni, la rimetterebbero alla Bacheca)
      corbella.applicaOrario(3, 9);
      passi(a, contesto(elvira, 3, 9, donato), 40);
      expect(a.presente('clelia')).toBe(true);
      expect(a.distanzaDa('clelia', bacheca.z, bacheca.theta)).toBeGreaterThan(8);
      // di notte non c'è: torna agli orari
      passi(a, contesto(elvira, 3, 22, donato), 40);
      expect(corbella.npc('clelia')!.manuale).toBe(false);
      expect(a.presente('clelia')).toBe(false);
    });

    it('finito il dialogo resta rivolto a Elvira finché lei è lì, si rigira se gli gira attorno, poi torna alle sue cose', () => {
      // prima, dieci secondi dopo la chiusura, chi aveva parlato tornava al verso del suo posto anche con Elvira
      // ancora lì davanti: se lei era arrivata da dietro, le voltava le spalle
      const a = new Abitanti(corbella);
      corbella.applicaOrario(1, 10);
      const n = corbella.npc('bortolo')!;
      const f = n.figura!;
      const casa = new Vector3(0, 0, 1).applyQuaternion(f.getWorldQuaternion(new Quaternion()));
      /** Elvira a `d` m da Bortolo, a `gradi` dall'avanti del suo posto (+ = verso est) */
      const attorno = (gradi: number, d: number) => {
        const p = n.posizione()!;
        const t = localFrameTheta(p.theta);
        const y = Math.atan2(casa.dot(t.east), casa.dot(t.north)) + (gradi * Math.PI) / 180;
        return sposta(p.z, p.theta, Math.cos(y) * d, Math.sin(y) * d, 40);
      };
      const angolo = (ctx: ContestoAbitanti) => angoloDallAvanti(f, ctx.occhi);
      let elvira = attorno(150, 2);
      let ctx = contesto(elvira, 1, 10);
      passi(a, ctx, 2);
      expect(angolo(ctx)).toBeGreaterThan(140);
      a.voltaVerso('bortolo', elvira);
      passi(a, ctx, 60 * 4);
      expect(angolo(ctx)).toBeLessThan(10);
      a.fineDialogo();
      // mezzo minuto con lei lì davanti: non le volta le spalle
      for (let i = 0; i < 30; i++) {
        passi(a, ctx, 60);
        expect(angolo(ctx), `dopo ${i + 1} s`).toBeLessThan(10);
      }
      // lei gli gira attorno (a 2,5 m, 100° più in là): si rigira con calma
      elvira = attorno(150 - 100, 2.5);
      ctx = contesto(elvira, 1, 10);
      passi(a, ctx, 60);
      expect(angolo(ctx)).toBeGreaterThan(40);
      passi(a, ctx, 60 * 4);
      expect(angolo(ctx)).toBeLessThan(10);
      // se lei gli passa accanto camminando (1 m/s, a 2,5 m) la segue con la testa, non col corpo
      const avantiPrima = new Vector3(0, 0, 1).applyQuaternion(f.getWorldQuaternion(new Quaternion()));
      for (let i = 0; i < 120; i++) {
        elvira = attorno(50 - (i / 120) * 110, 2.5);
        ctx = contesto(elvira, 1, 10);
        passi(a, ctx, 1);
      }
      const avantiDopo = new Vector3(0, 0, 1).applyQuaternion(f.getWorldQuaternion(new Quaternion()));
      expect(avantiDopo.angleTo(avantiPrima)).toBeLessThan(0.02);
      // se ne va: dopo qualche secondo torna a guardare dove guardava
      elvira = attorno(50, 9);
      ctx = contesto(elvira, 1, 10);
      passi(a, ctx, 60 * 1);
      expect(angolo(ctx)).toBeLessThan(15);
      passi(a, ctx, 60 * 6);
      const ora = new Vector3(0, 0, 1).applyQuaternion(f.getWorldQuaternion(new Quaternion()));
      expect(ora.angleTo(casa)).toBeLessThan(0.02);
    });

    it('Clelia aspetta alla Bacheca finché non ha dato il dono: anche la sera e il giorno dopo', () => {
      const a = new Abitanti(corbella);
      const bacheca = luogo('bacheca_ore')!;
      const elvira = { z: bacheca.z + 3, theta: bacheca.theta };
      // alle 20:00 del giorno 2 gli orari la manderebbero alla Casa del Velo
      corbella.applicaOrario(2, 20);
      passi(a, contesto(elvira, 2, 20), 2);
      expect(a.presente('clelia')).toBe(true);
      expect(a.distanzaDa('clelia', bacheca.z, bacheca.theta)).toBeLessThan(3);
      // di notte non c'è
      passi(a, contesto(elvira, 2, 22), 40);
      expect(a.presente('clelia')).toBe(false);
      // il giorno 3, il dono ancora da dare: di nuovo alla Bacheca
      corbella.applicaOrario(3, 8);
      passi(a, contesto(elvira, 3, 8), 40);
      expect(a.distanzaDa('clelia', bacheca.z, bacheca.theta)).toBeLessThan(3);
      // il pacco l'ha portato Ottavio: non aspetta più alla Bacheca
      passi(a, contesto(elvira, 3, 8, (c) => c === 'dialogo:d_ottavio_pacco finito'), 40);
      expect(a.distanzaDa('clelia', bacheca.z, bacheca.theta)).toBeGreaterThan(8);
    });

    it('chi è vicino guarda Elvira; i gruppi non contano fra i vicini', () => {
      const a = new Abitanti(corbella);
      corbella.applicaOrario(1, 9);
      const togna = corbella.npc('togna')!.posizione()!;
      const elvira = { z: togna.z + 2, theta: togna.theta };
      passi(a, contesto(elvira, 1, 9), 2);
      const vicini = a.vicini(elvira.z, elvira.theta, 4);
      expect(vicini).toContain('togna');
      expect(vicini).not.toContain('bambini');
      expect(vicini).not.toContain('velati_corbella');
    });
  });
});
