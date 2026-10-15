/**
 * Il percorso facile (src/regia/percorso.ts e le tolleranze della regia): i dialoghi che fanno
 * avanzare ogni passo e la loro riserva, che cosa premere nei gesti, il fermo della prima notte,
 * le planate corte, i luoghi più larghi, la porta del campanile, la novizia alla Bacheca.
 */
import { describe, expect, it } from 'vitest';
import { normalizzaContenuti } from '../../src/narrativa';
import { CONTENUTI_NARRATIVA, luogo } from '../../src/regia/contenuti';
import { DISLIVELLO_PLANATA, eUnaPlanata } from '../../src/regia/corpo';
import { chiaviDelCampanaro } from '../../src/regia/bersagli';
import { dentroLuogo, quotaLuogo } from '../../src/regia/luoghi';
import { OrologioStoria } from '../../src/regia/orologio';
import { FERMO_PRIMA_NOTTE, dialoghiCheFannoAvanzare, dialoghiNominati, flagNominati, indicazioneGesto, murettoDavanti } from '../../src/regia/percorso';
import { cleliaAspettaAllaBacheca, posizioneCleliaAllaBacheca } from '../../src/regia/png';
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
  it('la porta chiusa dice quando c\'è il campanaro', () => {
    expect(chiaviDelCampanaro(1, 10, true)).toBe('Chiusa a chiave. Le chiavi le ha il campanaro.');
    expect(chiaviDelCampanaro(2, 7.5, false)).toMatch(/alle 08:00.*aspetta/);
    expect(chiaviDelCampanaro(2, 10, true)).toMatch(/parlagli/);
    expect(chiaviDelCampanaro(2, 18.5, false)).toMatch(/domattina/);
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
});
