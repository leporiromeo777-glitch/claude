import { describe, expect, it } from 'vitest';
import { regoleDaContenuti } from '../src/regole';
import {
  annunciaMosse,
  applicaCicliDelGiorno,
  avanzaNotte,
  chiudiNotte,
  condizioneMossa,
  impostaVariante,
  iniziaNotte,
  notte,
  previsioneNotte,
  rimisuraScrittura,
  scriviConPenna,
  varianteBersaglio,
} from '../src/notte';
import { rileva, rimettiCaposaldo } from '../src/rilievo';
import { testoResoconto } from '../src/resoconto';
import { cellaAColore, cellaRilevataDaElvira, statoDi, statoIniziale, varianteDi } from '../src/stato';
import type { DefMossa, RegoleCatasto, StatoCatasto } from '../src/tipi';
import { CELLE, contenuti, contenutoSintetico, flagDa, regoleCon, regoleFase1 } from './aiuti';

const r = regoleFase1();
const FIENILE = 2799;

/** Lo stato della brace del giorno 1: tutto Abitato. */
function brace(regole: RegoleCatasto = r): StatoCatasto {
  let s = statoIniziale(regole);
  s = applicaCicliDelGiorno(s, regole, { da: '05:30', a: '21:00' }).stato;
  return s;
}

function chiudi(s: StatoCatasto, regole: RegoleCatasto, ...lati: string[]): StatoCatasto {
  for (const l of lati) {
    const [a, b] = l.split('-');
    const x = rileva(s, regole, { stazione: `cs_${a}`, mira: `cs_${b}`, ora: 11 });
    if (!x.ok) throw new Error(`${l}: ${x.messaggio}`);
    s = x.stato;
  }
  return s;
}

describe('la notte della Fase 1 (regole 3 e 4)', () => {
  it('è deterministica: stesso stato e stesso seme, stesso risultato; lo stato di partenza non cambia', () => {
    const s = brace();
    const copia = JSON.stringify(s);
    const a = notte(s, r, { elvira: { cella: FIENILE }, seme: 7 });
    const b = notte(s, r, { elvira: { cella: FIENILE }, seme: 7 });
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    expect(JSON.stringify(s)).toBe(copia);
    // nella Fase 1 non c'è nessuna scelta: anche un altro seme dà la stessa notte
    expect(notte(s, r, { elvira: { cella: FIENILE }, seme: 99 }).resoconto.testo).toEqual(a.resoconto.testo);
    expect(a.nuovoStato.nottiPassate).toBe(1);
  });

  it('le varianti cambiano con i pezzi da mostrare e da nascondere, all\'ora del giro', () => {
    const { eventi } = notte(brace(), r, { elvira: { cella: FIENILE } });
    const varianti = eventi.filter((e) => e.tipo === 'variante_cambiata');
    expect(varianti.map((e) => e.tipo === 'variante_cambiata' && [e.elemento, e.ora])).toEqual([
      ['E4', 1340],
      ['E1', 1400],
      ['E2', 30],
      ['E3', 30],
    ]);
    expect(varianti[0]).toMatchObject({ causa: 'notte', mostra: ['mucchio_assi_terrazza'], nascondi: ['gradini_assi_x6', 'decal_sentiero_battuto'] });
    expect(eventi.at(-1)?.tipo).toBe('resoconto');
  });

  it('la casa di Nando avanza di uno stadio per notte; senza Nando arriva alla Carta', () => {
    let s = statoIniziale(r); // E2 Smontata
    const n1 = notte(s, r, {});
    expect(varianteDi(n1.nuovoStato, 'E2')).toBe('Carta');
    expect(n1.resoconto.testo).toContain('Casa di Nando: non misurata, tornata alla Carta.');
    s = applicaCicliDelGiorno(n1.nuovoStato, r, { da: '05:30', a: '12:00', chiPresente: (chi) => chi !== 'nando' }).stato;
    expect(varianteDi(s, 'E2')).toBe('Carta');
    const n2 = notte(s, r, {});
    expect(n2.resoconto.cambiamenti.find((c) => c.elemento === 'E2')).toBeUndefined(); // già alla Carta
    expect(varianteBersaglio(r.elementi.get('E2')!, 'Abitata', false)).toBe('Smontata');
    expect(varianteBersaglio(r.elementi.get('E2')!, 'Scritta', false)).toBe('Carta');
  });

  it('un elemento rilevato solo in parte torna alla Carta per intero', () => {
    let s = brace();
    s = chiudi(s, r, '1-7'); // copre 2797 ma non 2798
    expect(cellaAColore(s, 2797)).toBe(true);
    expect(cellaAColore(s, 2798)).toBe(false);
    const n = notte(s, r, { elvira: { cella: FIENILE } });
    expect(varianteDi(n.nuovoStato, 'E1')).toBe('Carta');
    expect(n.resoconto.particelleCambiate).toEqual(expect.arrayContaining([2797, 2798]));
    // la particella rilevata resta a colore: la notte cambia l'elemento, non il rilievo
    expect(cellaRilevataDaElvira(n.nuovoStato, 2797)).toBe(true);
  });

  it('se il muro di Ronco è misurato, le pietre della casa restano in un mucchio', () => {
    const s = chiudi(brace(), r, '1-6'); // chiude il muro di Ronco (2699), non la casa (2796)
    const n = notte(s, r, { elvira: { cella: FIENILE } });
    expect(varianteDi(n.nuovoStato, 'E3')).toBe('Abitata');
    const casa = n.resoconto.righe.find((x) => x.elemento === 'E2')!;
    expect(casa.testo).toBe('Casa di Nando: non misurata, un muro in meno. Le pietre restano in un mucchio al margine (misurato: muro di Ronco).');
    expect(n.eventi.find((e) => e.tipo === 'variante_cambiata' && e.elemento === 'E2')).toMatchObject({ nota: expect.stringMatching(/mucchio/) });
    expect(n.resoconto.righe.find((x) => x.elemento === 'E3')).toMatchObject({ colore: 'verde', testo: 'Muro di Ronco: misurata, è rimasta.' });
  });

  it('eccezioni: vie di trama, alternativa non visibile, particelle protette', () => {
    const conVia = regoleCon({ vieDiTrama: [2797] });
    const a = notte(brace(conVia), conVia, {});
    expect(varianteDi(a.nuovoStato, 'E1')).toBe('Abitata');
    expect(a.nuovoStato.ultimaNotte?.protette['2797']).toBe('via_trama');
    const b = notte(brace(), r, { alternativeNonDisponibili: ['guado_sass'] });
    expect(varianteDi(b.nuovoStato, 'E1')).toBe('Abitata');
    expect(b.nuovoStato.ultimaNotte?.protette['2798']).toBe('via_necessaria');
    expect(varianteDi(b.nuovoStato, 'E4')).toBe('Carta'); // la mulattiera c'è
    const c = notte(brace(), r, { particelleProtette: [2311, 2407] });
    expect(varianteDi(c.nuovoStato, 'E4')).toBe('Abitata');
    expect(c.resoconto.righe.find((x) => x.elemento === 'E4')).toMatchObject({ colore: 'verde', testo: 'Scorciatoia delle Terrazze: protetta, è rimasta.' });
  });

  it('il tetto di particelle cambiate per notte rimanda gli elementi successivi', () => {
    const conTetto = regoleCon({ parametri: { tettoParticellePerNotte: 2 } });
    const n = notte(brace(conTetto), conTetto, {});
    expect(n.resoconto.cambiamenti.map((c) => c.elemento)).toEqual(['E4']);
    expect(n.resoconto.cronologia.some((v) => /rimandano/.test(v.testo))).toBe(true);
  });

  it('la veglia a passi: le Fade trovano Elvira dov\'è davvero (stesso esito del percorso)', () => {
    let s = iniziaNotte(brace(), r, { elvira: { sveglia: true } });
    expect(() => iniziaNotte(s, r)).toThrow(/già in corso/);
    const percorso: [string, number][] = [
      ['21:00', FIENILE],
      ['22:10', 2311], // sulla scorciatoia quando arrivano le Fade (22:20)
      ['22:40', FIENILE],
      ['23:15', 2798], // nel prato di Ronco alle 23:20
      ['23:40', FIENILE],
    ];
    const eventiPresi: string[] = [];
    for (let m = 21 * 60; m <= 24 * 60 + 5 * 60 + 30; m += 5) {
      const ora = `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
      const qui = [...percorso].reverse().find(([o]) => (o >= '21:00' ? Number(o.slice(0, 2)) * 60 + Number(o.slice(3)) : 0) <= m)![1];
      const x = avanzaNotte(s, r, ora, { cella: qui });
      s = x.stato;
      eventiPresi.push(...x.eventi.map((e) => e.tipo));
    }
    const fine = chiudiNotte(s, r);
    expect(varianteDi(fine.stato, 'E4')).toBe('Abitata');
    expect(varianteDi(fine.stato, 'E1')).toBe('Abitata');
    expect(varianteDi(fine.stato, 'E2')).toBe('Smontata');
    expect(flagDa(fine.resoconto.effetti)).toEqual(expect.arrayContaining(['notte_su_E4', 'notte_su_E1', 'notte_vegliata:1']));
    expect(fine.stato.ultimaNotte?.vegliate).toEqual([2311, 2798]);
    const tuttoInsieme = notte(brace(), r, { elvira: { sveglia: true, percorso: percorso.map(([ora, cella]) => ({ ora, cella })) } });
    expect(fine.resoconto.testo).toEqual(tuttoInsieme.resoconto.testo);
    expect(JSON.stringify(fine.stato.elementi)).toBe(JSON.stringify(tuttoInsieme.nuovoStato.elementi));
    expect(() => avanzaNotte(fine.stato, r, '23:00')).toThrow(/Nessuna notte/);
  });

  it('ogni particella cambiata ha una riga rossa; nessuna torna bianca', () => {
    const s = brace();
    const n = notte(s, r, {});
    const nelleRighe = new Set(n.resoconto.righe.filter((x) => x.colore === 'rosso').flatMap((x) => x.particelle));
    for (const c of n.resoconto.particelleCambiate) expect(nelleRighe.has(c)).toBe(true);
    for (const k of Object.keys(s.particelle)) expect(statoDi(n.nuovoStato, Number(k))).not.toBe('bianco');
    expect(testoResoconto(n.resoconto).split('\n')[0]).toBe('Che cosa è cambiato stanotte');
  });

  it("l'avviso della sera prevede la notte senza farla", () => {
    const s = brace();
    const p = previsioneNotte(s, r, {});
    expect(p.righe).toHaveLength(4);
    expect(s.nottiPassate).toBe(0);
    expect(varianteDi(s, 'E1')).toBe('Abitata');
  });
});

describe('di giorno: cicli e varianti', () => {
  it('i cicli valgono nell\'intervallo (da, a], anche oltre la mezzanotte, se chi deve esserci c\'è', () => {
    const s = statoIniziale(r);
    expect(applicaCicliDelGiorno(s, r, { da: '07:00', a: '08:00' }).eventi).toEqual([]); // 07:00 escluso
    expect(applicaCicliDelGiorno(s, r, { da: '06:59', a: '07:00' }).eventi).toHaveLength(1);
    const notturno = applicaCicliDelGiorno(s, r, { da: '22:00', a: '09:00' });
    expect(notturno.eventi.map((e) => e.tipo === 'variante_cambiata' && e.chi)).toEqual(['bortolo', 'nando', 'nando']);
    expect(applicaCicliDelGiorno(s, r, { da: '06:00', a: '09:00', chiPresente: () => false }).stato).toBe(s);
    expect(applicaCicliDelGiorno(s, r, { da: '06:00', a: '06:00' }).stato).toBe(s);
    // anche sugli elementi rilevati: il rilievo protegge dalla notte, non dalla gente
    const ril = chiudi(s, r, '1-3');
    expect(varianteDi(applicaCicliDelGiorno(ril, r, { da: '06:00', a: '08:00' }).stato, 'E4')).toBe('Abitata');
  });

  it('impostaVariante valida elemento e variante', () => {
    const s = statoIniziale(r);
    expect(impostaVariante(s, r, 'E9', 'Carta').ok).toBe(false);
    expect(impostaVariante(s, r, 'E1', 'Mietuta').messaggio).toMatch(/non ha la variante/);
    const x = impostaVariante(s, r, 'E1', 'abitata');
    expect(varianteDi(x.stato, 'E1')).toBe('Abitata');
    expect(impostaVariante(x.stato, r, 'E1', 'Abitata').stato).toBe(x.stato);
  });
});

describe('regola 1: le mosse della Madre (dalla Fase 5)', () => {
  const r5 = regoleCon({ fase: 5 });

  it('nella Fase 1 non si annuncia niente', () => {
    const s = chiudi(brace(), r, '3-4');
    expect(annunciaMosse(s, r, { atto: 'I' }).eventi).toEqual([]);
  });

  it('A1: annunciata la sera, la notte sposta il Pilastro 4 e il rilievo che ne dipendeva soltanto torna a matita', () => {
    let s = chiudi(brace(r5), r5, '3-4', '1-3');
    const a = annunciaMosse(s, r5, { atto: 'I' });
    expect(a.eventi).toEqual([{ tipo: 'mossa_annunciata', mossa: 'A1', notte: 1, annuncio: 'e di notte una pietra camminò verso Sera' }]);
    expect(a.effetti).toEqual(['flag:mossa_annunciata:A1']);
    s = a.stato;
    expect(annunciaMosse(s, r5, { atto: 'I' }).eventi).toEqual([]); // una per sera
    const n = notte(s, r5, { elvira: { cella: FIENILE } });
    const p4 = n.nuovoStato.capisaldi.cs_4!;
    expect(p4.spostato).toEqual({ metri: 3, direzione: 'Sera', notte: 1, mossa: 'A1' });
    const riga = n.resoconto.righe[0]!;
    expect(riga).toMatchObject({ colore: 'rosso', regola: 1, caposaldo: 'cs_4' });
    expect(riga.testo).toMatch(/^Pilastro 4 spostato di 3 m a Sera\. \d+ particelle sono tornate a matita\.$/);
    // tornano a matita solo quelle del lato 3-4 che il lato 1-3 non copre
    const solo34 = r5.lati.get('3-4')!.particelle.filter((c) => !r5.lati.get('1-3')!.particelle.includes(c));
    expect(riga.particelle).toEqual(solo34.sort((x, y) => x - y));
    for (const c of solo34) expect(statoDi(n.nuovoStato, c)).toBe('matita');
    expect(cellaRilevataDaElvira(n.nuovoStato, 2214)).toBe(true);
    expect(n.nuovoStato.lati['3-4']).toBeUndefined();
    expect(n.nuovoStato.mosse.usate).toEqual(['A1']);
    expect(n.eventi.find((e) => e.tipo === 'particelle_perse')).toMatchObject({ caposaldo: 'cs_4' });
    // si rimette la pietra e si rimisura: «la mano ricorda», in 5 s
    const rim = rimettiCaposaldo(n.nuovoStato, r5, 'cs_4');
    const x = rileva(rim.stato, r5, { stazione: 'cs_3', mira: 'cs_4', ora: 9 });
    expect(x.ok).toBe(true);
    expect(x.eventi.find((e) => e.tipo === 'particelle_rivelate')).toMatchObject({ rimisura: true });
    // il tetto dell'Atto I è 2: dopo A1 ne resta una sola
    expect(annunciaMosse({ ...x.stato, giorno: 3 }, r5, { atto: 'I', forza: ['A2', 'A3'] }).eventi).toHaveLength(1);
  });

  it('la regola 1 viene prima del giro: un caposaldo spostato alle 22:00 lascia la scorciatoia alle Fade delle 22:20', () => {
    const mossa: DefMossa = { id: 'X1', atto: 'I', nome: 'Il chiodo della terrazza', condizione: 'sempre', effetti: [{ tipo: 'sposta', capisaldi: [{ id: 'cs_3', metri: 2, direzione: 'Mont' }] }], annuncio: 'e la terrazza si spostò', deviataDalVelo: false, descrizione: '' };
    const rx = regoleCon({ fase: 5, mosse: [mossa] });
    let s = chiudi(brace(rx), rx, '1-3');
    s = annunciaMosse(s, rx, { atto: 'I' }).stato;
    const n = notte(s, rx, {});
    expect(varianteDi(n.nuovoStato, 'E4')).toBe('Carta');
    expect(n.resoconto.cambiamenti.map((c) => [c.regola, c.tipo, c.caposaldo ?? c.elemento])).toEqual([
      [1, 'caposaldo_spostato', 'cs_3'],
      [3, 'variante', 'E4'],
      [3, 'variante', 'E1'],
      [3, 'variante', 'E2'],
      [3, 'variante', 'E3'],
    ]);
    // le particelle seppia del G4 dipendono da 1 e 11: restano a colore
    expect(cellaAColore(n.nuovoStato, 2505)).toBe(true);
  });

  it('tetto di 8 capisaldi per notte', () => {
    const tutti = ['cs_3', 'cs_4', 'cs_6', 'cs_7', 'cs_11', 'cs_37', 'cs_12', 'cs_14', 'cs_15', 'cs_17'];
    const mossa: DefMossa = { id: 'X2', atto: 'II', nome: 'Tutti', condizione: 'sempre', effetti: [{ tipo: 'sposta', capisaldi: tutti.map((id) => ({ id, metri: 1, direzione: 'Lag' })) }], annuncio: '', deviataDalVelo: false, descrizione: '' };
    const rx = regoleCon({ fase: 5, mosse: [mossa] });
    const s = annunciaMosse(brace(rx), rx, { atto: 'II' }).stato;
    const n = notte(s, rx, {});
    expect(Object.values(n.nuovoStato.capisaldi).filter((c) => c.spostato)).toHaveLength(8);
    expect(n.resoconto.cambiamenti.filter((c) => c.tipo === 'caposaldo_spostato')).toHaveLength(8);
  });

  it('B2, la Notte dei Termini: chiodi scelti con il seme, mai pilastri, mai l\'hub, mai i rifugi', () => {
    let s = chiudi(brace(r5), r5, '3-37', '3-11', '7-8', '2-6', '3-5', '1-8');
    s = { ...s, giorno: 5 };
    s = annunciaMosse(s, r5, { atto: 'II', forza: ['B2'] }).stato;
    expect(s.mosse.programmate).toEqual([{ id: 'B2', notte: 5, annuncio: "domani la valle tornerà com'era scritta", deviata: false }]);
    const a = notte(s, r5, { seme: 3 });
    const b = notte(s, r5, { seme: 3 });
    const spostati = (x: StatoCatasto) => Object.entries(x.capisaldi).filter(([, c]) => c.spostato).map(([id]) => id).sort();
    expect(spostati(a.nuovoStato)).toEqual(spostati(b.nuovoStato));
    // candidati: i chiodi usati da Elvira fuori dall'hub (2 e 5 sono sul sagrato) e dai rifugi (8 è sul fienile)
    expect(spostati(a.nuovoStato)).toEqual(['cs_11', 'cs_3', 'cs_37', 'cs_7']);
    expect(flagDa(a.effetti)).toContain('mossa_fatta:B2');
  });

  it('con il velo della Madre le mosse deviate colpiscono le case degli Smascherati', () => {
    let s = chiudi(brace(r5), r5, '3-4');
    s = annunciaMosse(s, r5, { atto: 'I' }).stato;
    const n = notte(s, r5, { veloDellaMadre: true });
    expect(n.nuovoStato.capisaldi.cs_4?.spostato).toBeNull();
    expect(n.resoconto.righe[0]?.testo).toBe('La pietra che cammina: le guardie hanno colpito le case degli Smascherati.');
    expect(flagDa(n.effetti)).toContain('mossa_deviata:A1');
  });

  it('contatori ed eventi della Madre', () => {
    let s = { ...brace(r5), giorno: 8 };
    s = annunciaMosse(s, r5, { atto: 'II', flag: ['m09_completata'] }).stato;
    const n = notte(s, r5, {});
    expect(n.nuovoStato.contatori.smeriglio).toBe(1);
    expect(n.effetti).toContain('contatore:smeriglio=1');
    expect(n.resoconto.righe[0]?.testo).toMatch(/^Smeriglio, primo stadio: /);
    let t = { ...n.nuovoStato };
    t = annunciaMosse(t, r5, { atto: 'II', forza: ['B1'] }).stato;
    const n2 = notte(t, r5, {});
    expect(n2.effetti).toContain('evento:tempo_della_perla');
  });

  it('condizioni delle mosse', () => {
    const s = chiudi(brace(r5), r5, '3-4');
    expect(condizioneMossa(s, 'lato_con:cs_4')).toBe(true);
    expect(condizioneMossa(s, 'lato_con:cs_6')).toBe(false);
    expect(condizioneMossa(s, 'lato:3-4 e !mossa:A1')).toBe(true);
    expect(condizioneMossa(s, 'flag:x o cella:2214', { flag: [] })).toBe(true);
    expect(condizioneMossa(s, 'contatore:giorni_senza_velo>=3', { contatori: { giorni_senza_velo: 3 } })).toBe(true);
    expect(condizioneMossa(s, 'contatore:giorni_senza_velo>=3')).toBe(false);
    expect(condizioneMossa(s, 'mai o falso')).toBe(false);
    expect(condizioneMossa(s, 'boh:1')).toBe(false);
  });
});

describe('regola 2: la Penna di catasto e il terminale (dalla Fase 5)', () => {
  const rs = regoleDaContenuti(contenutoSintetico(), {
    fase: 5,
    ancore: [
      { id: 'x3a', elemento: 'X3', descrizione: 'scala alla marinara' },
      { id: 'x3b', elemento: 'X3', descrizione: 'ripiano' },
    ],
  });
  const misurato = () => {
    const x = rileva(statoIniziale(rs), rs, { stazione: 'cs_a', mira: 'cs_b', ora: 10 });
    return x.stato;
  };

  it('si scrive solo dove il terreno è misurato, una scrittura per notte', () => {
    expect(scriviConPenna(statoIniziale(rs), rs, { ancora: 'x3a' }).motivo).toBe('particella_non_rilevata');
    expect(scriviConPenna(misurato(), rs, { ancora: 'zz' }).motivo).toBe('ancora_sconosciuta');
    const a = scriviConPenna(misurato(), rs, { ancora: 'x3a' });
    expect(a.ok).toBe(true);
    expect(a.effetti).toEqual(['flag:scrittura:x3a']);
    expect(scriviConPenna(a.stato, rs, { ancora: 'x3b' }).motivo).toBe('una_per_notte');
    expect(scriviConPenna(a.stato, rs, { ancora: 'x3a' }).motivo).toBe('ancora_occupata');
  });

  it('le Fade costruiscono la notte stessa; senza rimisura la notte dopo il G3 cancella', () => {
    const s = scriviConPenna(misurato(), rs, { ancora: 'x3a' }).stato;
    const n1 = notte(s, rs, {});
    expect(varianteDi(n1.nuovoStato, 'X3')).toBe('Scritta');
    expect(n1.nuovoStato.ancore.x3a?.stato).toBe('costruita');
    expect(n1.resoconto.righe.find((x) => x.elemento === 'X3')).toMatchObject({ colore: 'verde', regola: 2 });
    const n2 = notte(n1.nuovoStato, rs, {});
    expect(varianteDi(n2.nuovoStato, 'X3')).toBe('Carta');
    expect(n2.nuovoStato.ancore.x3a?.stato).toBe('vuota');
    expect(n2.resoconto.righe[0]).toMatchObject({ colore: 'rosso', regola: 2, testo: 'Scala del fienile alto: scrittura G5 cancellata dal G3.' });
    expect(statoDi(n2.nuovoStato, CELLE.scritta)).toBe('matita');
  });

  it('rimisurata all\'alba resta; con l\'Ombra di Meridiana la Madre non la vede', () => {
    const s = scriviConPenna(misurato(), rs, { ancora: 'x3a' }).stato;
    const n1 = notte(s, rs, {});
    const rim = rileva(n1.nuovoStato, rs, { stazione: 'cs_b', mira: 'cs_a', ora: 6 });
    expect(rim.eventi).toContainEqual({ tipo: 'scrittura', ancora: 'x3a', stato: 'rimisurata' });
    const n2 = notte(rim.stato, rs, {});
    expect(varianteDi(n2.nuovoStato, 'X3')).toBe('Scritta');
    const ombra = notte(n1.nuovoStato, rs, { ombraDiMeridiana: true });
    expect(varianteDi(ombra.nuovoStato, 'X3')).toBe('Scritta');
    // rimisura esplicita
    expect(rimisuraScrittura(n1.nuovoStato, rs, 'x3a').stato.ancore.x3a?.stato).toBe('rimisurata');
    expect(rimisuraScrittura(s, rs, 'x3a').ok).toBe(false);
  });

  it('nella Fase 1 il terminale è spento: la scrittura resta in attesa', () => {
    const r1 = regoleDaContenuti(contenutoSintetico(), { ancore: [{ id: 'x3a', elemento: 'X3', descrizione: '' }] });
    let s = rileva(statoIniziale(r1), r1, { stazione: 'cs_a', mira: 'cs_b', ora: 10 }).stato;
    s = scriviConPenna(s, r1, { ancora: 'x3a' }).stato;
    const n = notte(s, r1, {});
    expect(n.nuovoStato.ancore.x3a?.stato).toBe('scritta');
  });
});

describe('regola 4 e svolta (contenuto sintetico)', () => {
  const rs = regoleDaContenuti(contenutoSintetico());

  it("mai l'hub, mai i rifugi; il sentiero necessario solo se l'alternativa si vede", () => {
    const n = notte(statoIniziale(rs), rs, {});
    expect(varianteDi(n.nuovoStato, 'X1')).toBe('Abitata');
    expect(varianteDi(n.nuovoStato, 'X5')).toBe('Abitata');
    expect(varianteDi(n.nuovoStato, 'X4')).toBe('Carta');
    expect(varianteDi(n.nuovoStato, 'X2')).toBe('Carta');
    expect(n.nuovoStato.ultimaNotte?.protette[String(CELLE.hub)]).toBe('hub');
    expect(n.nuovoStato.ultimaNotte?.protette[String(CELLE.rifugio)]).toBe('rifugio');
    expect(n.resoconto.particelleCambiate).not.toContain(CELLE.hub);
    const senzaGuado = notte(statoIniziale(rs), rs, { alternativeNonDisponibili: ['guado'] });
    expect(varianteDi(senzaGuado.nuovoStato, 'X4')).toBe('Abitata');
  });

  it('dopo la svolta gli elementi del Protocollo non rilevati passano a Mietuta', () => {
    const n = notte(statoIniziale(rs), rs, { dopoSvolta: true });
    expect(varianteDi(n.nuovoStato, 'X2')).toBe('Mietuta');
    expect(n.resoconto.testo).toContain('Orto del Protocollo: non misurata, mietuta dal Protocollo.');
    expect(varianteDi(n.nuovoStato, 'X4')).toBe('Carta');
  });

  it('senza contenuti per la notte non succede niente di strano', () => {
    const vuote = regoleDaContenuti({});
    const n = notte(statoIniziale(vuote), vuote, {});
    expect(n.resoconto).toMatchObject({ quieta: true, testo: ['Notte quieta.'], righe: [] });
  });
});

describe('la Pesarina e le notti oltre quelle scritte', () => {
  it('la terza notte segue il modello della seconda', () => {
    let s = brace();
    s = notte(s, r, {}).nuovoStato;
    s = applicaCicliDelGiorno(s, r, { da: '05:30', a: '21:00' }).stato;
    s = notte(s, r, {}).nuovoStato;
    s = applicaCicliDelGiorno(s, r, { da: '05:30', a: '21:00' }).stato;
    const n3 = notte(s, r, {});
    expect(n3.resoconto.notte).toBe(3);
    expect(n3.resoconto.righe).toHaveLength(4);
    expect(flagDa(n3.effetti)).not.toContain('taccuino_spostato');
    const fade = contenuti().fade;
    expect(n3.resoconto.cronologia.map((v) => v.ora)).toEqual(expect.arrayContaining(['22:05', '04:30', '03:10']));
    expect(fade.notti).toHaveLength(2);
  });
});
