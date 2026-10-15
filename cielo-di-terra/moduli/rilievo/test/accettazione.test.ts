/**
 * Simulazione di accettazione della Fase 1 dal punto di vista del catasto (FASE1 §5, §7, §10).
 *
 * Percorso: stato iniziale da fade_fase1.json → giorno 1 (gli abitanti rimettono le cose,
 * Ottavio butta le assi) → prima notte (il sentiero sparisce) → mattino 2 (resoconto) →
 * chiodo 2 (il tasso) → lato 1-3 (20 particelle) → lato 7-8 (13 particelle, la passerella)
 * → seconda notte (la passerella c'è ancora) → gioco libero (tutta Corbella, 63 particelle).
 * I numeri sono confrontati con quelli scritti nel design e nei contenuti.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { applicaCicliDelGiorno, impostaVariante, notte } from '../src/notte';
import { passa, rileva } from '../src/rilievo';
import { cellaAColore, cellaRilevataDaElvira, conteggi, inchiostroDi, inventarioCompleto, statoDi, statoIniziale, varianteDi } from '../src/stato';
import type { RegoleCatasto, Resoconto, StatoCatasto } from '../src/tipi';
import { contenuti, flagDa, leggiJson, regoleFase1 } from './aiuti';

const FIENILE = 2799; // fienile di Ottavio (rifugio) e chiodo 8

type Notte = { notte: number; stato_atteso_alla_brace: Record<string, string>; giro: { elemento?: string; da?: string; a?: string; motivo?: string; particelle?: number[] }[] };

function varianti(s: StatoCatasto): Record<string, string> {
  return Object.fromEntries(Object.entries(s.elementi).map(([k, v]) => [k, v.variante]));
}

/** «Abitata (rimessa con Ottavio durante la missione)» → «Abitata» */
function atteso(v: string): string {
  return v.split(/\s|\(/)[0]!;
}

describe('Fase 1: il percorso del catasto', () => {
  let regole: RegoleCatasto;
  let fade: { notti: Notte[]; elementi_mobili: { id: string }[]; particelle: { id: number; stato_iniziale: string }[]; inventario_corbella: { quante: number; particelle: number[] } };
  let capisaldi: { lati: { id: string; chiudibile: boolean; particelle: number[] }[] };
  let s: StatoCatasto;
  let r1: Resoconto;
  let r2: Resoconto;
  const tappe: Record<string, StatoCatasto> = {};

  beforeAll(() => {
    regole = regoleFase1();
    const c = contenuti();
    fade = c.fade;
    capisaldi = c.capisaldi;
  });

  it('parte dallo stato iniziale di fade_fase1.json: 228 particelle, 15 a seppia, le Selve a matita', () => {
    expect(regole.problemi).toEqual([]);
    s = statoIniziale(regole);
    const area = fade.particelle;
    expect(area).toHaveLength(228);
    const per = { bianco: 0, matita: 0, colore: 0 } as Record<string, number>;
    for (const p of area) {
      per[statoDi(s, p.id)]! += 1;
      expect(statoDi(s, p.id)).toBe(p.stato_iniziale);
    }
    expect(per).toEqual({ bianco: 127, matita: 86, colore: 15 });
    // la striscia della Cripta: le 15 particelle del lato 1-11, a seppia con la firma G4 (FASE1 §8.4)
    const lato111 = capisaldi.lati.find((l) => l.id === '1-11')!;
    expect(lato111.particelle).toHaveLength(15);
    for (const c of lato111.particelle) {
      expect(inchiostroDi(s, c)).toBe('seppia');
      expect(cellaRilevataDaElvira(s, c)).toBe(false);
    }
    expect(s.lati['1-11']?.firma).toBe('G4');
    expect(s.capisaldi.cs_1?.firme).toEqual(['G4']);
    // fuori dall'area tutto bianco
    expect(conteggi(s)).toMatchObject({ matita: 86, colore: 15, seppia: 15, china: 0 });
    expect(varianti(s)).toEqual({ E1: 'Carta', E2: 'Smontata', E3: 'Carta', E4: 'Carta' });
  });

  it('giorno 1: Bortolo, Nando e Ottavio rimettono le cose; alla brace tutto è come scritto per la notte 1', () => {
    // Elvira esce dalla botola e cammina fino alla piazza e al fienile: ciò che vede diventa matita
    for (const p of [
      { z: 1112, theta: 27.0 },
      { z: 1046, theta: 37.0 },
      { z: 1176, theta: 58.5 },
    ]) s = passa(s, regole, p).stato;
    expect(statoDi(s, FIENILE)).toBe('matita');
    s = applicaCicliDelGiorno(s, regole, { da: '05:39', a: '19:00' }).stato;
    // M1.10: Ottavio butta le assi sul riale (effetto variante:E1=Abitata di missioni.json)
    const v = impostaVariante(s, regole, 'E1', 'Abitata');
    expect(v.ok).toBe(true);
    expect(v.eventi[0]).toMatchObject({ tipo: 'variante_cambiata', mostra: ['assi_passerella_x3', 'decal_sentiero_battuto'], nascondi: ['decal_prato_pettinato', 'mucchio_assi_riva'] });
    s = v.stato;
    s = applicaCicliDelGiorno(s, regole, { da: '19:00', a: '21:00' }).stato;
    const n1 = fade.notti.find((n) => n.notte === 1)!;
    expect(varianti(s)).toEqual(Object.fromEntries(Object.entries(n1.stato_atteso_alla_brace).map(([k, x]) => [k, atteso(x)])));
    tappe.brace1 = s;
  });

  it('notte 1: il sentiero non misurato sparisce, e la casa di Nando perde un muro', () => {
    const r = notte(s, regole, { elvira: { cella: FIENILE }, seme: 1 });
    r1 = r.resoconto;
    s = r.nuovoStato;
    expect(s.giorno).toBe(2);
    expect(varianti(s)).toEqual({ E1: 'Carta', E2: 'Smontata', E3: 'Carta', E4: 'Carta' });
    // ogni passaggio scritto in fade_fase1.json → notti[0].giro c'è, con la stessa ora e lo stesso motivo
    const giro = fade.notti.find((n) => n.notte === 1)!.giro.filter((g) => g.elemento);
    expect(r1.cambiamenti).toHaveLength(giro.length);
    for (const g of giro) {
      const c = r1.cambiamenti.find((x) => x.elemento === g.elemento)!;
      expect(c).toMatchObject({ da: g.da, a: g.a, motivo: g.motivo, particelle: g.particelle });
    }
    // FASE1 M1.12: in rosso la passerella, la scorciatoia, la casa di Nando, il muro di Ronco
    expect(r1.quieta).toBe(false);
    expect(r1.testo).toEqual([
      'Scorciatoia delle Terrazze: non misurata, tornata alla Carta.',
      'Passerella del Messo: non misurata, tornata alla Carta.',
      'Casa di Nando: non misurata, un muro in meno.',
      'Muro di Ronco: non misurato, le pietre rimesse nel muro.',
    ]);
    expect(r1.righe.every((x) => x.colore === 'rosso')).toBe(true);
    // in fondo la prossima finestra utile (fade_fase1.json → resoconto_del_mattino.prossima_finestra)
    expect(r1.prossimeFinestre).toEqual([
      'Alle 07:00: il campanaro Bortolo rimette i gradini.',
      'Alle 08:30: Nando prende le pietre dal muro di Ronco e rifà il muro a Sera.',
      'Alle 19:30: Ottavio rimette le assi tornando al fienile.',
    ]);
    expect(r1.particelleCambiate).toEqual([2311, 2407, 2699, 2796, 2797, 2798]);
    // la Pesarina apre il Taccuino la prima notte (missioni.json → m1_mattino)
    expect(flagDa(r1.effetti)).toContain('taccuino_spostato');
    // le Fade non toccano il fienile dove dorme Elvira, né l'hub
    expect(r1.particelleCambiate).not.toContain(FIENILE);
    // il mattino le particelle cambiate sono segnate in rosso
    expect(s.ultimaNotte?.cambiate).toEqual(r1.particelleCambiate);
    // e nessuna particella torna bianca
    for (const p of fade.particelle) expect(statoDi(s, p.id) === 'bianco' && statoDi(tappe.brace1!, p.id) !== 'bianco').toBe(false);
  });

  it('notte 1, variante: chi passa la notte sulla passerella la salva (regola 4)', () => {
    const r = notte(tappe.brace1!, regole, {
      elvira: {
        sveglia: true,
        percorso: [
          { ora: '21:00', cella: FIENILE },
          { ora: '23:00', cella: 2797 },
          { ora: '23:50', cella: FIENILE },
        ],
      },
    });
    expect(varianteDi(r.nuovoStato, 'E1')).toBe('Abitata');
    expect(varianteDi(r.nuovoStato, 'E4')).toBe('Carta');
    expect(flagDa(r.effetti)).toEqual(expect.arrayContaining(['notte_su_E1', 'notte_vegliata:1']));
    expect(flagDa(r.effetti)).not.toContain('taccuino_spostato');
    expect(r.resoconto.testo).toContain("Passerella del Messo: c'eri tu, le Fade ti hanno girato attorno.");
    expect(r.resoconto.righe.filter((x) => x.colore === 'rosso').map((x) => x.elemento)).toEqual(['E4', 'E2', 'E3']);
    expect(r.nuovoStato.ultimaNotte?.vegliate).toEqual([2797]);
  });

  it('giorno 2: il chiodo 2 fallisce per il tasso; il lato 1-3 colora 20 particelle', () => {
    s = applicaCicliDelGiorno(s, regole, { da: '05:30', a: '09:00' }).stato;
    expect(varianti(s)).toEqual({ E1: 'Carta', E2: 'Abitata', E3: 'Abitata', E4: 'Abitata' });

    const tasso = rileva(s, regole, { stazione: 'cs_2', mira: 'cs_1', ora: '10:00' });
    expect(tasso.ok).toBe(false);
    expect(tasso.motivo).toBe('coperto');
    expect(tasso.messaggio).toMatch(/tasso/);
    expect(tasso.eventi[0]).toMatchObject({ tipo: 'rilievo_fallito', stazione: 'cs_2', mira: 'cs_1', motivo: 'coperto' });
    expect(tasso.effetti).toEqual(['flag:tentato_lato:2-1']); // m1_chiodo2 → completa_quando
    expect(tasso.stato).toBe(s); // un tentativo fallito non costa nulla

    const r = rileva(s, regole, { stazione: 'cs_3', mira: 'cs_1', ora: '11:00' });
    expect(r.ok).toBe(true);
    const ev = r.eventi.find((e) => e.tipo === 'particelle_rivelate');
    if (ev?.tipo !== 'particelle_rivelate') throw new Error('manca l\'evento');
    // FASE1 M1.18: «resta solo il ventaglio del lato 1-3 (20 particelle)»
    expect(ev.ventaglio).toHaveLength(20);
    expect(ev.celle).toHaveLength(13); // erano bianche o a matita
    expect(ev.ripassate).toHaveLength(7); // erano a seppia (G4): ora a china
    expect(ev.primoDelFoglio).toBe(true); // la griglia a china del foglio 1, per 6 s
    expect(ev.origine).toEqual({ z: 946, theta: 23.6 }); // il colore viene dal chiodo 3
    s = r.stato;
    for (const c of ev.ventaglio) expect(cellaRilevataDaElvira(s, c)).toBe(true);
    expect(cellaRilevataDaElvira(s, 2214)).toBe(true); // m1_primo_rilievo: cella:2214 rilevata
    expect(cellaRilevataDaElvira(s, 2213)).toBe(true); // il Nodo 1, castagno del cartellino
    expect(flagDa(r.effetti)).toEqual(expect.arrayContaining(['tentato_lato:3-1', 'rilevato_lato:3-1', 'rilevato_lato:1-3', 'elemento_rilevato:E4']));
    expect(s.rilieviFatti).toBe(1);
  });

  it('giorno 2: il lato 7-8 chiude 13 particelle, fra cui la passerella del Messo', () => {
    s = impostaVariante(s, regole, 'E1', 'Abitata').stato; // M1.19: la rimettono insieme
    const r = rileva(s, regole, { stazione: 'cs_7', mira: 'cs_8', ora: '15:00' });
    expect(r.ok).toBe(true);
    const ev = r.eventi.find((e) => e.tipo === 'lato_chiuso');
    expect(ev).toMatchObject({ lato: '7-8', particelle: expect.any(Array) });
    if (ev?.tipo !== 'lato_chiuso') throw new Error();
    expect(ev.particelle).toHaveLength(13);
    s = r.stato;
    // m1_strada: cella:2797 rilevata e cella:2798 rilevata
    expect(cellaRilevataDaElvira(s, 2797) && cellaRilevataDaElvira(s, 2798)).toBe(true);
    expect(flagDa(r.effetti)).toContain('elemento_rilevato:E1');
    s = applicaCicliDelGiorno(s, regole, { da: '15:00', a: '21:00' }).stato;
    const n2 = fade.notti.find((n) => n.notte === 2)!;
    expect(varianti(s)).toEqual(Object.fromEntries(Object.entries(n2.stato_atteso_alla_brace).map(([k, x]) => [k, atteso(x)])));
  });

  it('notte 2: la passerella c\'è ancora; in rosso solo la casa di Nando e il muro di Ronco', () => {
    const r = notte(s, regole, { elvira: { cella: FIENILE }, seme: 1 });
    r2 = r.resoconto;
    s = r.nuovoStato;
    expect(s.giorno).toBe(3);
    expect(varianteDi(s, 'E1')).toBe('Abitata');
    expect(varianteDi(s, 'E4')).toBe('Abitata');
    expect(varianteDi(s, 'E2')).toBe('Smontata');
    expect(varianteDi(s, 'E3')).toBe('Carta');
    // fade_fase1.json → notti[1].esito_atteso, FASE1 M1.21
    expect(r2.righe.filter((x) => x.colore === 'rosso').map((x) => x.testo)).toEqual([
      'Casa di Nando: non misurata, un muro in meno.',
      'Muro di Ronco: non misurato, le pietre rimesse nel muro.',
    ]);
    expect(r2.righe.filter((x) => x.colore === 'verde').map((x) => x.testo)).toEqual([
      'Scorciatoia delle Terrazze: misurata, è rimasta.',
      'Passerella del Messo: misurata, è rimasta.',
    ]);
    expect(r2.prossimeFinestre).toEqual(['Alle 08:30: Nando prende le pietre dal muro di Ronco e rifà il muro a Sera.']);
    expect(flagDa(r2.effetti)).not.toContain('taccuino_spostato'); // la Pesarina sposta il Taccuino solo la prima notte
    expect(s.ultimaNotte?.protette['2797']).toBe('rilevato');
    expect(s.ultimaNotte?.protette['2311']).toBe('rilevato');
  });

  it('gioco libero: la rete chiude 16 lati e Corbella va tutta a colore (63 particelle)', () => {
    s = applicaCicliDelGiorno(s, regole, { da: '05:30', a: '09:00' }).stato;
    const chiudibili = capisaldi.lati.filter((l) => l.chiudibile);
    expect(chiudibili).toHaveLength(16); // FASE1 §3 e §7.1
    const effetti: string[] = [];
    let ora = 9;
    for (const l of chiudibili) {
      if (s.lati[l.id]?.firma === 'G5') continue;
      const [a, b] = l.id.split('-');
      const r = rileva(s, regole, { stazione: `cs_${a}`, mira: `cs_${b}`, ora: ora++ % 10 + 8 });
      expect(r.ok, `${l.id}: ${r.messaggio}`).toBe(true);
      s = r.stato;
      effetti.push(...r.effetti);
    }
    expect(fade.inventario_corbella.quante).toBe(63);
    expect(fade.inventario_corbella.particelle.every((c) => cellaAColore(s, c))).toBe(true);
    expect(fade.inventario_corbella.particelle.every((c) => cellaRilevataDaElvira(s, c))).toBe(true);
    expect(inventarioCompleto(s, regole)).toBe(true);
    expect(flagDa(effetti).filter((f) => f === 'corbella_a_colori')).toHaveLength(1);
    expect(flagDa(effetti)).toContain('casa_nando_rilevata');
    expect(flagDa(effetti)).toEqual(expect.arrayContaining(['elemento_rilevato:E2', 'elemento_rilevato:E3']));
    // tutta l'area che la rete può rilevare: l'unione dei 16 ventagli
    const unione = new Set(chiudibili.flatMap((l) => l.particelle));
    expect(unione.size).toBe(91);
    expect(conteggi(s)).toMatchObject({ colore: 91, china: 91, seppia: 0 });
    // i lati bloccati restano bloccati
    expect(rileva(s, regole, { stazione: 'cs_5', mira: 'cs_1', ora: 10 }).messaggio).toMatch(/tettoia/);
    expect(s.rilieviFatti).toBe(16);
  });

  it('dopo Corbella a colori la notte non cambia più niente: «Notte quieta»', () => {
    const r3 = notte(s, regole, { elvira: { cella: FIENILE } });
    expect(r3.resoconto.quieta).toBe(true);
    expect(r3.resoconto.testo[0]).toBe('Notte quieta.');
    // la prima notte dopo il rilievo dicono «è rimasta» anche la casa e il muro
    expect(r3.resoconto.righe.map((x) => x.elemento)).toEqual(['E2', 'E3']);
    const r4 = notte(r3.nuovoStato, regole, { elvira: { cella: FIENILE } });
    expect(r4.resoconto.righe).toEqual([]);
    expect(r4.resoconto.testo).toEqual(['Notte quieta.']);
    expect(r4.resoconto.particelleCambiate).toEqual([]);
  });

  it('quali lati salvano ogni elemento mobile (e la nota di m1_strada su 1-7)', () => {
    const interi = (el: string) =>
      [...regole.lati.values()].filter((l) => l.chiudibile && regole.elementi.get(el)!.particelle.every((c) => l.particelle.includes(c))).map((l) => l.id).sort();
    expect(interi('E1')).toEqual(['1-8', '7-8', '8-11']);
    expect(interi('E2')).toEqual(['1-8', '8-11']); // FASE1 §7.1, fade_fase1.json E2.note
    expect(interi('E3')).toEqual(['1-6', '1-7', '1-8', '8-11']); // FASE1 §7.1, E3.note
    expect(interi('E4')).toEqual(['1-3', '1-4', '3-11', '3-5']);
    // missioni.json → m1_strada.note dice «vanno bene anche 1-7, 1-8 o 8-11»: il lato 1-7 però copre
    // solo la passerella (2797), non il sentiero nel prato (2798). Da solo non completa il passo
    // (cella:2797 rilevata e cella:2798 rilevata) e la notte riporta la passerella alla Carta. Vedi README.
    const solo17 = rileva(tappe.brace1!, regole, { stazione: 'cs_1', mira: 'cs_7', ora: 10 }).stato;
    expect(cellaRilevataDaElvira(solo17, 2797)).toBe(true);
    expect(cellaRilevataDaElvira(solo17, 2798)).toBe(false);
    expect(varianteDi(notte(solo17, regole, {}).nuovoStato, 'E1')).toBe('Carta');
  });

  it('le condizioni «cella:N rilevata» di missioni.json sono tutte raggiungibili con la rete di Corbella', () => {
    const missioni = leggiJson<unknown>('missioni.json');
    const testo = JSON.stringify(missioni);
    const celle = [...new Set([...testo.matchAll(/cella:(\d+) rilevata/g)].map((m) => Number(m[1])))];
    expect(celle.sort()).toEqual([2214, 2797, 2798]);
    const coperte = new Set(capisaldi.lati.filter((l) => l.chiudibile).flatMap((l) => l.particelle));
    for (const c of celle) {
      expect(coperte.has(c)).toBe(true);
      expect(cellaRilevataDaElvira(s, c)).toBe(true);
    }
    // e i flag tentato_lato / rilevato_lato citati dai contenuti hanno la forma che il catasto produce
    for (const m of testo.matchAll(/(tentato|rilevato)_lato:(\w+)-(\w+)/g)) {
      expect(regole.capisaldi.has(`cs_${m[2]}`) && regole.capisaldi.has(`cs_${m[3]}`)).toBe(true);
    }
  });
});
