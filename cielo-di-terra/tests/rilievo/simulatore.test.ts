/**
 * Il simulatore della notte (GDD §3.4.9, FASE1 §10.2): 1.000 partite casuali delle prime tre
 * notti, senza browser. Verifica le garanzie:
 * - nessuna notte tocca l'hub, i rifugi, le vie di trama, la particella dove sta Elvira;
 * - ogni cambiamento ha una riga nel resoconto;
 * - nessuna notte sposta più di 8 capisaldi (nella Fase 1 nessuno);
 * - mai matita → bianco; nella Fase 1 mai colore → matita (non ci sono mosse della Madre);
 * - l'alternativa del sentiero necessario (il guado del Sass) non cambia mai;
 * - la missione resta completabile: i lati 1-3 e 7-8 si chiudono sempre il giorno dopo;
 * - Severino non compare mai nella notte; i testi sono completi;
 * - la stessa partita con lo stesso seme dà lo stesso stato.
 */
import { describe, expect, it } from 'vitest';
import { generatore } from '../../src/rilievo/casuale';
import { centroCella } from '../../src/rilievo/griglia';
import { applicaCicliDelGiorno, impostaVariante, notte } from '../../src/rilievo/notte';
import { defParticella } from '../../src/rilievo/regole';
import { appunta, passa, rileva } from '../../src/rilievo/rilievo';
import { cellaAColore, statoDi, statoIniziale } from '../../src/rilievo/stato';
import { minutiNotte } from '../../src/rilievo/tempo';
import type { ElviraNotte, StatoCatasto } from '../../src/rilievo/tipi';
import { regoleFase1 } from './aiuti';

const r = regoleFase1();
const AREA = [...r.particelle.keys()];
const RETE = [...r.capisaldi.values()].filter((c) => !c.lontano).map((c) => c.id);
const LONTANI = [...r.capisaldi.values()].filter((c) => c.lontano && c.fonte === 'contenuti').map((c) => c.id);
const CELLE_ELEMENTI = [...r.elementi.values()].flatMap((e) => e.particelle);
const GUADO = 2893;

function cellaAllOra(e: ElviraNotte, t: number): number | null {
  let c = e.cella ?? null;
  const tappe = [...(e.percorso ?? [])].sort((a, b) => minutiNotte(a.ora) - minutiNotte(b.ora));
  for (const p of tappe) if (minutiNotte(p.ora) <= t) c = p.cella;
  return c;
}

interface Statistiche {
  cambiamenti: number;
  salvateDaElvira: number;
  salvateDalRilievo: number;
  latiChiusi: number;
}

function giocaPartita(seme: number, controlli: boolean, stat?: Statistiche): { stato: StatoCatasto; violazioni: string[]; notti: number } {
  const rnd = generatore(seme);
  const pesca = <T>(xs: readonly T[]): T => xs[Math.floor(rnd() * xs.length)]!;
  const violazioni: string[] = [];
  let s = statoIniziale(r);
  let notti = 0;
  for (let giorno = 1; giorno <= 3; giorno++) {
    const presenti = (chi: string) => rnd() < 0.9 || chi === '';
    s = applicaCicliDelGiorno(s, r, { da: '05:30', a: '12:00', chiPresente: presenti }).stato;
    const mosse = Math.floor(rnd() * 8);
    for (let k = 0; k < mosse; k++) {
      const x = rnd();
      const ora = 7 + Math.floor(rnd() * 12);
      if (x < 0.25) s = passa(s, r, centroCella(pesca(AREA))).stato;
      else if (x < 0.4) s = appunta(s, r, { bersaglio: { caposaldo: pesca([...RETE, ...LONTANI]) }, ora: rnd() < 0.5 ? ora : 22 }).stato;
      else if (x < 0.85) s = rileva(s, r, { stazione: pesca(RETE), mira: pesca(RETE), ora, senzaFiato: rnd() < 0.05 }).stato;
      else s = impostaVariante(s, r, 'E1', 'Abitata').stato;
    }
    s = applicaCicliDelGiorno(s, r, { da: '12:00', a: '21:00', chiPresente: presenti }).stato;

    // la notte: dove dorme o veglia Elvira
    const posti = [2799, 2599, pesca(CELLE_ELEMENTI), pesca(AREA), null];
    const elvira: ElviraNotte = { cella: pesca(posti), sveglia: rnd() < 0.3 };
    if (rnd() < 0.4) {
      elvira.percorso = [];
      for (let k = 0; k < 3; k++) elvira.percorso.push({ ora: pesca(['21:30', '22:15', '22:25', '23:10', '23:30', '00:20', '00:40', '02:00']), cella: pesca(posti) });
    }
    const prima = s;
    const fotografia = controlli ? JSON.stringify(prima) : '';
    const n = notte(s, r, { elvira, seme });
    s = n.nuovoStato;
    notti++;
    if (!controlli) continue;
    if (JSON.stringify(prima) !== fotografia) violazioni.push(`notte ${notti}: lo stato di partenza è stato modificato`);
    if (stat) {
      stat.cambiamenti += n.resoconto.cambiamenti.length;
      const prot = Object.values(s.ultimaNotte?.protette ?? {});
      stat.salvateDaElvira += prot.filter((m) => m === 'elvira').length;
      stat.salvateDalRilievo += prot.filter((m) => m === 'rilevato').length;
      stat.latiChiusi = Math.max(stat.latiChiusi, Object.values(s.lati).filter((l) => l.firma === 'G5').length);
    }

    const rosse = new Set(n.resoconto.righe.filter((x) => x.colore === 'rosso').flatMap((x) => x.particelle));
    for (const c of n.resoconto.particelleCambiate) {
      const d = defParticella(r, c);
      if (d.hub) violazioni.push(`notte ${notti}: cambiata la particella dell'hub ${c}`);
      if (d.rifugio) violazioni.push(`notte ${notti}: cambiato il rifugio ${c}`);
      if (d.viaTrama) violazioni.push(`notte ${notti}: cambiata la via di trama ${c}`);
      if (!rosse.has(c)) violazioni.push(`notte ${notti}: la particella ${c} è cambiata senza una riga`);
      if (c === GUADO) violazioni.push(`notte ${notti}: è cambiato il guado del Sass`);
    }
    for (const ch of n.resoconto.cambiamenti) {
      if (ch.tipo !== 'variante') continue;
      const qui = cellaAllOra(elvira, minutiNotte(`${String(Math.floor(ch.ora / 60)).padStart(2, '0')}:${String(ch.ora % 60).padStart(2, '0')}`));
      if (qui !== null && ch.particelle.includes(qui)) violazioni.push(`notte ${notti}: le Fade hanno cambiato ${ch.elemento} con Elvira sopra`);
      const def = r.elementi.get(ch.elemento!)!;
      if (def.particelle.every((c) => cellaAColore(prima, c))) violazioni.push(`notte ${notti}: cambiato ${ch.elemento} rilevato`);
    }
    if (Object.values(s.capisaldi).filter((c) => c.spostato).length > 0) violazioni.push(`notte ${notti}: un caposaldo spostato nella Fase 1`);
    for (const [k, p] of Object.entries(prima.particelle)) {
      const dopo = statoDi(s, Number(k));
      if (p.stato !== 'bianco' && dopo === 'bianco') violazioni.push(`notte ${notti}: ${k} è tornata bianca`);
      if (p.stato === 'colore' && dopo !== 'colore') violazioni.push(`notte ${notti}: ${k} ha perso il rilievo`);
    }
    for (const t of [...n.resoconto.testo, ...n.resoconto.prossimeFinestre, ...n.resoconto.cronologia.map((v) => v.testo)]) {
      if (/\{|undefined|null|NaN/.test(t)) violazioni.push(`notte ${notti}: testo incompleto «${t}»`);
      if (/Severino/i.test(t)) violazioni.push(`notte ${notti}: Severino nella notte`);
    }
    if (n.resoconto.quieta !== (n.resoconto.righe.filter((x) => x.colore === 'rosso').length === 0)) violazioni.push(`notte ${notti}: «quieta» sbagliato`);
    // la missione resta completabile il giorno dopo
    for (const [a, b] of [
      ['cs_3', 'cs_1'],
      ['cs_7', 'cs_8'],
    ]) {
      if (!rileva(s, r, { stazione: a!, mira: b!, ora: 10 }).ok) violazioni.push(`giorno ${notti + 1}: il lato ${a}-${b} non si chiude più`);
    }
  }
  return { stato: s, violazioni, notti };
}

describe('il simulatore della notte', () => {
  it('1.000 partite casuali delle prime tre notti non violano le regole', () => {
    const tutte: string[] = [];
    let notti = 0;
    const stat: Statistiche = { cambiamenti: 0, salvateDaElvira: 0, salvateDalRilievo: 0, latiChiusi: 0 };
    for (let seme = 1; seme <= 1000; seme++) {
      const g = giocaPartita(seme, true, stat);
      notti += g.notti;
      tutte.push(...g.violazioni.map((v) => `partita ${seme}, ${v}`));
    }
    expect(notti).toBe(3000);
    expect(tutte.slice(0, 20)).toEqual([]);
    // il simulatore esercita davvero le regole: cambi, salvataggi per presenza e per rilievo
    expect(stat.cambiamenti).toBeGreaterThan(3000);
    expect(stat.salvateDaElvira).toBeGreaterThan(100);
    expect(stat.salvateDalRilievo).toBeGreaterThan(100);
    expect(stat.latiChiusi).toBeGreaterThan(5);
  });

  it('la stessa partita con lo stesso seme è identica', () => {
    for (const seme of [3, 77, 512]) {
      const a = giocaPartita(seme, false);
      const b = giocaPartita(seme, false);
      expect(JSON.stringify(a.stato)).toBe(JSON.stringify(b.stato));
    }
  });
});
