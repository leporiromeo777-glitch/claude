/**
 * Il percorso facile (src/regia/percorso.ts e le tolleranze della regia): i dialoghi che fanno
 * avanzare ogni passo e la loro riserva, che cosa premere nei gesti, il fermo della prima notte,
 * le planate corte, i luoghi più larghi, la porta del campanile, la novizia alla Bacheca.
 */
import { describe, expect, it } from 'vitest';
import { normalizzaContenuti } from '../../src/narrativa';
import { CONTENUTI_NARRATIVA, luogo, personaggio } from '../../src/regia/contenuti';
import { DISLIVELLO_PLANATA, eUnaPlanata } from '../../src/regia/corpo';
import { chiaviDelCampanaro } from '../../src/regia/bersagli';
import { dentroLuogo, quotaLuogo } from '../../src/regia/luoghi';
import { ATTESA_DURATA_MAX, ATTESA_MAX_ORE, OrologioStoria, durataAttesa, oreFino, vociDiAttesa } from '../../src/regia/orologio';
import { AIUTI_IN_SU, AIUTI_VETRO, FERMO_PRIMA_NOTTE, altezzeDavanti, dialoghiCheFannoAvanzare, dialoghiNominati, flagNominati, indicazioneGesto, muroAltoDavanti, murettoDavanti, stradaDeiPassi, troppoRipido } from '../../src/regia/percorso';
import { cleliaAspettaAllaBacheca, posizioneCleliaAllaBacheca, postoDiClelia } from '../../src/regia/png';
import { prossimoArrivo } from '../../src/regia/orari';
import { METERS_PER_DEG } from '../../src/world/constants';
import { boxAt } from '../../src/world/colliders';
import { cylToWorld, surfaceDistance } from '../../src/world/cylinder';

const contenuti = normalizzaContenuti(CONTENUTI_NARRATIVA);
const passo = (id: string) => {
  for (const m of contenuti.missioni) {
    const p = m.passi.find((x) => x.id === id);
    if (p) return p;
  }
  throw new Error(`passo ${id}?`);
};

describe('i dialoghi che fanno avanzare la storia (la riserva)', () => {
  it('legge «dialogo:… finito» e i flag nelle condizioni', () => {
    expect(dialoghiNominati('(dialogo:a finito o dialogo:b_2 finito) e flag:x')).toEqual(['a', 'b_2']);
    expect(flagNominati('flag:lente:ricci e !flag:velo_indossato')).toEqual(['lente:ricci', 'velo_indossato']);
    expect(dialoghiNominati(undefined)).toEqual([]);
  });

  it('per ogni passo con un dialogo automatico, la riserva sa quale richiedere', () => {
    const d = contenuti.dialoghi;
    expect(dialoghiCheFannoAvanzare(passo('pr_campane'), d)).toEqual(['d_meridiana_1']);
    expect(dialoghiCheFannoAvanzare(passo('m1_ottavio'), d)).toEqual(['d_ottavio_incontro']);
    expect(dialoghiCheFannoAvanzare(passo('m1_notte'), d)).toEqual(['d_ottavio_fienile']);
    expect(dialoghiCheFannoAvanzare(passo('m1_mattino'), d).sort()).toEqual(['d_ottavio_mattino', 'd_ottavio_mattino_salvata']);
    expect(dialoghiCheFannoAvanzare(passo('m1_dono'), d).sort()).toEqual(['d_clelia_dono', 'd_ottavio_pacco']);
    expect(dialoghiCheFannoAvanzare(passo('m1_prova'), d)).toEqual(['d_ottavio_prova']);
    // la lettera di Rosa: il passo legge il flag che il dialogo accende alla fine
    expect(dialoghiCheFannoAvanzare(passo('m1_gancio'), d)).toEqual(['d_ottavio_gancio']);
    // i velati e il campanaro si cercano parlando: niente riserva automatica
    expect(dialoghiCheFannoAvanzare(passo('m1_velati'), d)).toEqual([]);
    expect(dialoghiCheFannoAvanzare(passo('m1_campanile'), d)).toEqual([]);
  });

  it('la scelta della notte non si apre più dopo il mattino; la novizia non ridà il pacco portato da Ottavio', () => {
    const d = contenuti.dialoghi;
    expect(String(d['d_ottavio_fienile']!.condizione)).toContain('!passo:m1_notte completato');
    expect(String(d['d_clelia_dono']!.condizione)).toContain('!dialogo:d_ottavio_pacco finito');
    // il mattino del Messo vale anche se il giorno 2 è già passato (vecchi salvataggi)
    expect(String(d['d_ottavio_mattino']!.condizione)).toMatch(/^giorno:>=2/);
  });
});

describe('che cosa premere (indicazioni dei gesti)', () => {
  it('sulla scala della Cripta: W per salire, finché in cima non c\'è la botola da spingere', () => {
    expect(indicazioneGesto({ controllo: 'scala', scala: { y: 2, cima: 6.3 } })).toMatchObject({ tasto: 'W' });
    expect(indicazioneGesto({ controllo: 'scala', scala: { y: 6.25, cima: 6.3 } })).toBeNull();
  });

  it('in aria, mentre il passo del Velo chiede la prima planata: Spazio', () => {
    expect(indicazioneGesto({ controllo: 'libero', aria: { velo: false, altezza: 3, insegna: true } })).toMatchObject({ tasto: 'Spazio' });
    expect(indicazioneGesto({ controllo: 'libero', aria: { velo: false, altezza: 0.6, insegna: true } })).toBeNull();
    expect(indicazioneGesto({ controllo: 'libero', aria: { velo: false, altezza: 3, insegna: false } })).toBeNull();
  });

  it('allo squadro: la bolla con A/D, poi il cannocchiale, poi la croce con la barra della collimazione', () => {
    const base = { livellato: false, telescopio: false, caposaldo: null, coperto: false, tenuta: 0, serve: 1.5 };
    expect(indicazioneGesto({ controllo: 'piantato', squadro: base })).toMatchObject({ tasto: 'A / D' });
    expect(indicazioneGesto({ controllo: 'piantato', squadro: { ...base, livellato: true, meta: 'la palina sul campanile' } })?.testo).toContain('la palina sul campanile');
    const croce = indicazioneGesto({ controllo: 'piantato', squadro: { ...base, livellato: true, telescopio: true, caposaldo: 'cs_1', tenuta: 0.75 } });
    expect(croce).toMatchObject({ tasto: 'Tasto destro' });
    expect(croce?.progresso).toBeCloseTo(0.5, 5);
    // il tasso copre la palina: il tentativo conta lo stesso
    expect(indicazioneGesto({ controllo: 'piantato', squadro: { ...base, livellato: true, telescopio: true, caposaldo: 'cs_1', coperto: true } })?.testo).toMatch(/copre/);
  });

  it('Ottavio in volo si chiama con G; da seduta si aspetta con X', () => {
    expect(indicazioneGesto({ controllo: 'libero', fischio: true })).toMatchObject({ tasto: 'G' });
    expect(indicazioneGesto({ controllo: 'seduta', attesa: true })).toMatchObject({ tasto: 'X' });
    expect(indicazioneGesto({ controllo: 'seduta', attesa: true, rilettura: true })?.testo).toMatch(/rileggi/);
    expect(indicazioneGesto({ controllo: 'libero' })).toBeNull();
  });

  it('durante l\'attesa X salta alla fine; in piedi, quando il passo chiede di aspettare, X apre l\'attesa', () => {
    expect(indicazioneGesto({ controllo: 'seduta', attesa: true, inAttesa: true })).toEqual({ tasto: 'X', testo: 'Salta alla fine (C: alzati)' });
    // saltando (sotto il nero) niente: né «salta» né «aspetta fino a»
    expect(indicazioneGesto({ controllo: 'seduta', attesa: true, inAttesa: true, salto: true })).toBeNull();
    expect(indicazioneGesto({ controllo: 'libero', aspettare: true })).toEqual({ tasto: 'X', testo: 'Aspetta fino a… (ti siedi)' });
    // un muretto o un fischio contano di più
    expect(indicazioneGesto({ controllo: 'libero', aspettare: true, muretto: true })).toMatchObject({ tasto: 'Spazio' });
    expect(indicazioneGesto({ controllo: 'libero', aspettare: true, fischio: true })).toMatchObject({ tasto: 'G' });
  });
});

describe('il muretto da scavalcare', () => {
  // Elvira ferma a (1000, 30), al suolo a quota 40, guarda verso Lag (+z)
  const piedi = cylToWorld(1000, 30, 40);
  const verso = cylToWorld(1001, 30, 40).sub(piedi).normalize();
  const muro = (alto: number) => [boxAt(1000.7, 30, 40, 0, 3, alto, 0.6, 'muro')];

  it('un muretto di 90 cm davanti si scavalca; un gradino o un muro alto no', () => {
    expect(murettoDavanti(piedi, 30, verso, muro(0.9))).toBe(true);
    expect(murettoDavanti(piedi, 30, verso, muro(0.4))).toBe(false); // un gradino: si sale camminando
    expect(murettoDavanti(piedi, 30, verso, muro(3))).toBe(false); // troppo alto per un salto
    // girata di spalle, il muretto non è davanti
    expect(murettoDavanti(piedi, 30, verso.clone().negate(), muro(0.9))).toBe(false);
  });

  it('l\'indicazione: «Spazio — scavalca il muretto»', () => {
    expect(indicazioneGesto({ controllo: 'libero', muretto: true })).toMatchObject({ tasto: 'Spazio' });
  });

  it('contro un muro di terrazza troppo alto: «P — troppo alto…», la strada sulla Pianta', () => {
    const alte = altezzeDavanti(piedi, 30, verso, muro(3.5));
    expect(alte).toHaveLength(1);
    expect(alte[0]).toBeCloseTo(3.5, 1);
    expect(muroAltoDavanti(alte)).toBe(true);
    expect(muroAltoDavanti(altezzeDavanti(piedi, 30, verso, muro(0.9)))).toBe(false); // si scavalca
    expect(muroAltoDavanti([3.5, 0.9])).toBe(false); // c'è anche un muretto: si salta quello
    expect(muroAltoDavanti([40])).toBe(false); // il campanile, una casa: non è una strada da cercare
    expect(muroAltoDavanti([])).toBe(false);
    expect(indicazioneGesto({ controllo: 'libero', muroAlto: 'Troppo alto: la mulattiera' })).toMatchObject({ tasto: 'P', testo: 'Troppo alto: la mulattiera' });
    // il muretto basso vince sul muro alto
    expect(indicazioneGesto({ controllo: 'libero', muretto: true, muroAlto: 'x' })).toMatchObject({ tasto: 'Spazio' });
  });

  it('una scarpata sotto la terrazza è troppo ripida; un pendio che si cammina no', () => {
    expect(troppoRipido(2.3, 1.2)).toBe(true); // la scarpata sotto la Terrazza Pedrazzini
    expect(troppoRipido(1.0, 1.2)).toBe(false); // ripido ma si sale (47°)
    expect(troppoRipido(0.4, 0.3)).toBe(false); // un gradino
    expect(troppoRipido(-1, 1.2)).toBe(false); // in discesa
  });
});

describe('il fermo della prima notte', () => {
  it('sono le 05:00 del giorno 2: «aspetta fino all\'alba» si ferma lì finché Elvira non è al fienile', () => {
    expect(FERMO_PRIMA_NOTTE).toBe(29);
    const o = new OrologioStoria();
    o.imposta(1, 22);
    o.limite = FERMO_PRIMA_NOTTE;
    expect(o.aspettaFino(5.5)).toBe(true);
    for (let i = 0; i < 60 * 60; i++) o.avanza(1 / 6);
    expect(o.giorno).toBe(2);
    expect(o.ore).toBeCloseTo(5, 6);
    expect(o.inAttesa).toBe(false);
  });
});

describe('le planate', () => {
  it('conta una planata corta da un muro (il Velo aperto un attimo, 2,5 m sotto)', () => {
    expect(eUnaPlanata(0.5, 3.5)).toBe(true); // il muretto della Terrazza
    expect(eUnaPlanata(0.5, DISLIVELLO_PLANATA - 1)).toBe(false); // un salto in piano
    expect(eUnaPlanata(0.1, 8)).toBe(false); // il Velo aperto troppo tardi
    expect(eUnaPlanata(2.2, 0)).toBe(true); // una planata lunga, anche in piano
  });
});

describe('i luoghi del percorso, più larghi', () => {
  const dentro = (id: string, z: number, theta: number) => {
    const l = luogo(id)!;
    return dentroLuogo(l, z, theta, quotaLuogo(l));
  };

  it('il cartellino si legge da 4 m: a 4 m dal castagno si è arrivati', () => {
    const l = luogo('castagno_cartellino')!;
    expect(dentro('castagno_cartellino', l.z + 4, l.theta + 4 / METERS_PER_DEG)).toBe(true);
  });

  it('la Bacheca si vede da 6 m (prima bisognava esserci sopra, entro 2 m)', () => {
    const l = luogo('bacheca_ore')!;
    expect(dentro('bacheca_ore', l.z - 6, l.theta)).toBe(true);
  });

  it('il fienile si raggiunge davanti alla porta, non solo dentro i muri', () => {
    const l = luogo('fienile_ottavio')!;
    // la porta del popolamento sta a circa 4 m dal centro; un paio di metri fuori
    expect(dentro('fienile_ottavio', l.z - 6, l.theta - 3 / METERS_PER_DEG)).toBe(true);
  });

  it('la passerella si raggiunge anche dalla riva', () => {
    const l = luogo('passerella_messo')!;
    expect(dentro('passerella_messo', l.z + 6, l.theta)).toBe(true);
  });
});

describe('la porta del campanile e la novizia', () => {
  it('la porta chiusa dice dov\'è il campanaro adesso, o quando arriva', () => {
    expect(chiaviDelCampanaro(1, 10, 5)).toBe('Chiusa a chiave. Le chiavi le ha il campanaro.');
    expect(chiaviDelCampanaro(2, 10, 12)).toMatch(/parlagli/);
    expect(chiaviDelCampanaro(2, 6.5, Infinity)).toMatch(/alle 08:00.*aspetta/);
    expect(chiaviDelCampanaro(2, 7.2, 300)).toMatch(/gradini.*08:00/);
    expect(chiaviDelCampanaro(2, 12, 200)).toMatch(/sagrato/);
    expect(chiaviDelCampanaro(2, 18.5, Infinity)).toMatch(/19:45/);
    expect(chiaviDelCampanaro(2, 20, 60)).toMatch(/Ombrista/);
    expect(chiaviDelCampanaro(2, 22, Infinity)).toMatch(/domattina/);
  });

  it('la novizia aspetta alla Bacheca dal giorno 2, dalle 07:00 alle 21:00', () => {
    expect(cleliaAspettaAllaBacheca(1, 10)).toBe(false);
    expect(cleliaAspettaAllaBacheca(2, 6.9)).toBe(false);
    expect(cleliaAspettaAllaBacheca(2, 20)).toBe(true);
    expect(cleliaAspettaAllaBacheca(3, 9)).toBe(true);
    expect(cleliaAspettaAllaBacheca(2, 21)).toBe(false);
    const b = luogo('bacheca_ore')!;
    const q = posizioneCleliaAllaBacheca();
    expect(surfaceDistance(q.z, q.theta, b.z, b.theta)).toBeLessThan(b.raggio);
  });

  it('il posto della novizia: la Bacheca finché il dono non è dato, poi la Casa del Velo', () => {
    expect(postoDiClelia(2, 20, false, false)).toBe('bacheca'); // cercata alle 20: c'è
    expect(postoDiClelia(2, 22, false, false)).toBeNull(); // di notte no
    expect(postoDiClelia(3, 9, false, false)).toBe('bacheca'); // il giorno dopo ancora
    expect(postoDiClelia(2, 9, true, false)).toBe('via'); // dato il dono se ne va
    expect(postoDiClelia(2, 20.5, true, false)).toBe('casa'); // la sera alla Casa del Velo
    expect(postoDiClelia(3, 9, false, true)).toBe('casa'); // il pacco l'ha portato Ottavio
  });

  it('cercata alle 22, il pannello sa che arriva domani alle 07:00 alla Bacheca', () => {
    const clelia = personaggio('clelia')!;
    const valuta = () => true;
    expect(prossimoArrivo(clelia, 2, 22, { luogo: 'bacheca_ore', valuta })).toEqual({ giorno: 3, ore: 7, luogo: 'bacheca_ore' });
    expect(prossimoArrivo(clelia, 2, 22, { valuta })?.luogo).toBe('bacheca_ore');
    // dato il dono non la si aspetta più alla Bacheca
    expect(prossimoArrivo(clelia, 2, 22, { luogo: 'bacheca_ore', valuta: () => false })).toBeNull();
  });
});

describe('le strade dove in linea retta non si arriva', () => {
  it('verso la Terrazza Pedrazzini: la mulattiera dalla piazza; la scorciatoia solo con i gradini', () => {
    const con = stradaDeiPassi(['m1_cartellino'], true);
    expect(con).toContain('mulattiera');
    expect(con).toContain('Piazza delle Ore');
    expect(con).toContain('scorciatoia con i gradini di assi');
    expect(con).toContain('castagno morto');
    const senza = stradaDeiPassi(['m1_primo_rilievo'], false);
    expect(senza).toContain('mulattiera');
    expect(senza).toContain('07:00');
    expect(senza).not.toContain('castagno morto');
  });
  it('dal guado alla piazza e alla passerella: la strada dei Ronchi; altrove la strada di serie', () => {
    expect(stradaDeiPassi(['m1_dono', 'm1_ritorno'], true)).toContain('strada dei Ronchi');
    expect(stradaDeiPassi(['m1_prova'], true)).toContain('strada dei Ronchi');
    expect(stradaDeiPassi(['m1_fienile'], true)).toContain('passerella');
    expect(stradaDeiPassi(['m1_velati'], true)).toBe('cerca un sentiero o dei gradini (la Pianta)');
  });
});

describe('«Aspetta fino a…» di notte', () => {
  const testi = (o: number, f: { brace?: boolean; vegliare?: boolean } = {}) => vociDiAttesa(o, 2, null, { brace: f.brace ?? false, vegliare: f.vegliare ?? false }).map((v) => v.testo);
  it('mezzanotte la sera, o di giorno per chi ha scelto di vegliare; mai dopo la mezzanotte', () => {
    expect(testi(22)).toContain('mezzanotte');
    expect(testi(10, { vegliare: true })).toContain('mezzanotte');
    expect(testi(10)).not.toContain('mezzanotte');
    for (const o of [0, 0.5, 2, 5]) expect(testi(o, { vegliare: true }), `alle ${o}`).not.toContain('mezzanotte');
    expect(testi(0, { vegliare: true })).toContain("l'alba (05:30)");
  });
  it("l'alba dalle 20:00 (il pannello della seconda notte dice «aspetta il mattino»)", () => {
    expect(testi(20.25)).toContain("l'alba (05:30)");
    expect(testi(19.5)).not.toContain("l'alba (05:30)");
    expect(testi(20.25)).not.toContain("fra un'ora");
  });
  it("la brace e, la prima sera, l'Ombrista: dopo la brace non restano 25 secondi da aspettare in piedi", () => {
    const voci = (o: number, passi: string[]) => vociDiAttesa(o, 1, null, { brace: true, vegliare: false, passi });
    expect(voci(10, ['m1_brace']).map((v) => v.testo)).toEqual(['la brace (19:30)', "l'Ombrista (19:45)", "fra un'ora"]);
    expect(voci(19.5, ['m1_ombrista']).map((v) => v.testo)).toContain("l'Ombrista (19:45)");
    expect(voci(19.5, ['m1_ombrista']).find((v) => v.testo.startsWith("l'Ombrista"))?.ore).toBeCloseTo(19.75, 9);
    expect(voci(19.8, ['m1_ombrista']).map((v) => v.testo)).not.toContain("l'Ombrista (19:45)");
    // un altro giorno, senza il passo, niente Ombrista
    expect(voci(10, []).map((v) => v.testo)).not.toContain("l'Ombrista (19:45)");
  });

  it('la seconda notte: le 20:30 per dormire e il mattino, da qualunque ora del pomeriggio', () => {
    const t = vociDiAttesa(14, 2, null, { brace: true, vegliare: false, passi: new Set(['m1_seconda_notte']) }).map((v) => v.testo);
    expect(t).toEqual(['la brace (19:30)', 'le 20:30 (si può dormire)', "l'alba (05:30)", "fra un'ora"]);
    const sera = vociDiAttesa(21, 2, null, { brace: true, vegliare: false, passi: ['m1_seconda_notte'] }).map((v) => v.testo);
    expect(sera).not.toContain('le 20:30 (si può dormire)');
    expect(sera).toContain("l'alba (05:30)");
    // la mattina presto l'alba sarebbe quasi un giorno intero: no
    expect(vociDiAttesa(6, 2, null, { brace: true, vegliare: false, passi: ['m1_seconda_notte'] }).map((v) => v.testo)).not.toContain("l'alba (05:30)");
  });

  it('vegliando la prima notte: le Fade (22:05), finché non si sono viste; poi l\'alba', () => {
    const voci = (o: number, fadeViste: boolean) => vociDiAttesa(o, 1, null, { brace: true, vegliare: true, fadeViste, passi: ['m1_notte'] }).map((v) => v.testo);
    expect(voci(20.8, false)).toEqual(['le Fade (22:05)', 'mezzanotte', "l'alba (05:30)"]);
    expect(voci(20.8, true)).toEqual(['mezzanotte', "l'alba (05:30)"]);
    expect(voci(22.5, false)).not.toContain('le Fade (22:05)');
  });

  it('chi arriva oggi, con il nome; le voci non si ripetono', () => {
    const v = vociDiAttesa(6.3, 1, { giorno: 1, ore: 7, chi: 'una velata al lavatoio' }, { brace: false, vegliare: false });
    expect(v[0]).toEqual({ testo: 'le 07:00: arriva una velata al lavatoio', ore: 7 });
    expect(vociDiAttesa(6.3, 1, { giorno: 1, ore: 7 }, { brace: false, vegliare: false })[0]?.testo).toBe('le 07:00, quando arriva qualcuno');
    expect(vociDiAttesa(7.5, 1, { giorno: 1, ore: 8, chi: 'due bambini', molti: true }, { brace: false, vegliare: false })[0]?.testo).toBe('le 08:00: arrivano due bambini');
    // fra un'ora alle 18:30 è la brace delle 19:30: una voce sola
    const b = vociDiAttesa(18.5, 1, null, { brace: true, vegliare: false });
    expect(b.filter((x) => Math.abs(x.ore - 19.5) < 0.01)).toHaveLength(1);
  });

  it('ogni voce del menu, a ogni ora, dura al più 5,5 secondi reali', () => {
    for (let o = 0; o < 24; o += 0.25) {
      for (const passi of [[], ['m1_brace'], ['m1_seconda_notte'], ['m1_notte']]) {
        for (const v of vociDiAttesa(o, 2, { giorno: 2, ore: 8, chi: 'x' }, { brace: true, vegliare: true, passi })) {
          const ore = oreFino(o, v.ore);
          expect(ore, `${o} → ${v.testo}`).toBeLessThanOrEqual(ATTESA_MAX_ORE);
          expect(durataAttesa(ore)).toBeLessThanOrEqual(ATTESA_DURATA_MAX);
        }
      }
    }
  });

  it("un'attesa di quasi un giorno intero si rifiuta", () => {
    expect(oreFino(0, 0)).toBe(24);
    expect(oreFino(0, 0)).toBeGreaterThan(ATTESA_MAX_ORE);
    expect(oreFino(23, 0)).toBeCloseTo(1);
    expect(oreFino(21, 5.5)).toBeCloseTo(8.5);
    expect(oreFino(10, 19.5)).toBeLessThan(ATTESA_MAX_ORE);
  });
});

describe('gli aiuti dello sguardo si ripetono', () => {
  it('finché il passo resta da fare, ogni 20-30 s', () => {
    expect(AIUTI_VETRO.length).toBeGreaterThanOrEqual(4);
    expect(AIUTI_IN_SU.length).toBeGreaterThanOrEqual(5);
    for (const a of [AIUTI_VETRO, AIUTI_IN_SU]) for (let i = 1; i < a.length; i++) expect(a[i]! - a[i - 1]!).toBeLessThanOrEqual(30);
    expect(AIUTI_IN_SU[0]).toBe(50);
  });
});
