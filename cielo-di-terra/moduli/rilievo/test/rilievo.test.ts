import { describe, expect, it } from 'vitest';
import { regoleDaContenuti } from '../src/regole';
import { celleNelRaggio, centroCella, idCella } from '../src/griglia';
import { anteprimaRilievo, appunta, idLato, parametriSquadro, passa, rileva, rimettiCaposaldo, segnaCaposaldoVisto, ventaglioDi } from '../src/rilievo';
import { cellaRilevataDaElvira, clonaStato, inchiostroDi, statoDi, statoIniziale } from '../src/stato';
import type { EventoCatasto, StatoCatasto } from '../src/tipi';
import { CELLE, contenutoSintetico, flagDa, regoleFase1 } from './aiuti';

const r = regoleFase1();
const ev = <T extends EventoCatasto['tipo']>(eventi: EventoCatasto[], tipo: T) =>
  eventi.find((e) => e.tipo === tipo) as Extract<EventoCatasto, { tipo: T }> | undefined;

describe('passare: matita entro 60 m', () => {
  it('le particelle bianche vicine diventano matita, le altre non cambiano', () => {
    const s = statoIniziale(r);
    const res = passa(s, r, { z: 1176, theta: 58.5 }); // fienile di Ottavio
    expect(res.ok).toBe(true);
    const e = ev(res.eventi, 'particelle_matita')!;
    expect(e.causa).toBe('passaggio');
    expect(e.celle).toContain(2799);
    for (const c of e.celle) expect(statoDi(res.stato, c)).toBe('matita');
    expect(statoDi(s, 2799)).toBe('bianco'); // lo stato di partenza non si tocca
    // la seconda volta non cambia niente e restituisce lo stesso oggetto
    const ancora = passa(res.stato, r, { z: 1176, theta: 58.5 });
    expect(ancora.stato).toBe(res.stato);
    expect(ancora.eventi).toEqual([]);
    // la striscia seppia resta a colore
    const cripta = passa(s, r, { z: 1112, theta: 27 });
    expect(statoDi(cripta.stato, 2599)).toBe('colore');
  });
});

describe('appuntare con lo squadro in mano', () => {
  const s0 = statoIniziale(r);
  const piazza = { z: 1046, theta: 37, altezza: 40 };

  it('un caposaldo: diventa «visto» e la sua particella va a matita', () => {
    const res = appunta(s0, r, { bersaglio: { caposaldo: 'cs_6' }, ora: '10:00', osservatore: piazza });
    expect(res.ok).toBe(true);
    expect(statoDi(res.stato, 2803)).toBe('matita');
    expect(res.stato.capisaldi.cs_6?.visto).toBe(true);
    expect(res.effetti).toEqual(['flag:appuntato:2803']);
    expect(res.eventi.map((e) => e.tipo)).toEqual(['caposaldo_visto', 'particelle_matita', 'appunto']);
  });

  it('da più di 600 m accende anche appuntato_lontano (il segreto della meridiana)', () => {
    const belvedere = { z: 1046, theta: 127, altezza: 101 }; // Crestone dei Ponti
    const res = appunta(s0, r, { bersaglio: { cella: 2505 }, ora: '11:00', osservatore: belvedere });
    expect(res.ok).toBe(true);
    expect(flagDa(res.effetti)).toEqual(['appuntato:2505', 'appuntato_lontano:2505']);
  });

  it('oltre 1500 m non arriva; attraverso l\'asse di giorno abbaglia, alla brace no', () => {
    const lontano = appunta(s0, r, { bersaglio: { punto: { z: 2900, theta: 37 } }, ora: '11:00', osservatore: piazza });
    expect(lontano).toMatchObject({ ok: false, motivo: 'troppo_lontano' });
    const opposto = { z: 1046, theta: 217, altezza: 0 };
    const giorno = appunta(s0, r, { bersaglio: { cella: 2505 }, ora: '11:00', osservatore: opposto });
    expect(giorno).toMatchObject({ ok: false, motivo: 'abbaglia' });
    expect(giorno.messaggio).toMatch(/La Linea abbaglia/);
    expect(appunta(s0, r, { bersaglio: { cella: 2505 }, ora: '20:00', osservatore: opposto }).ok).toBe(true);
  });

  it('una linea di mira coperta non appunta', () => {
    const res = appunta(s0, r, { bersaglio: { cella: 2505 }, ora: '11:00', osservatore: piazza, lineaLibera: () => ({ libera: false, motivo: 'Il fumo della grà.' }) });
    expect(res).toMatchObject({ ok: false, motivo: 'coperto', messaggio: 'Il fumo della grà.' });
  });

  it('la Lanterna e il Caposaldo Zero restano bianchi: «Il disco non si appunta»', () => {
    const l = appunta(s0, r, { bersaglio: { lanterna: true }, ora: '10:00' });
    expect(l.effetti).toEqual(['flag:appuntato_lanterna']);
    expect(l.stato).toBe(s0);
    const z = appunta(s0, r, { bersaglio: { caposaldo: 'cs_0' }, ora: '10:00' });
    expect(z.ok).toBe(true);
    expect(z.effetti).toContain('flag:appuntato_lanterna');
    expect(statoDi(z.stato, r.capisaldi.get('cs_0')!.cella)).toBe('bianco');
    expect(ev(z.eventi, 'appunto')?.messaggio).toBe('Il disco non si appunta.');
  });

  it('di notte i lumi lontani: si contano una volta sola; buio senza lume, coperti dal Collare', () => {
    const faro = appunta(s0, r, { bersaglio: { caposaldo: 'cs_17' }, ora: '22:00' });
    expect(faro.effetti).toEqual(['flag:appuntato:2513', 'contatore:lumi_appuntati+1']);
    const ancora = appunta(faro.stato, r, { bersaglio: { caposaldo: 'cs_17' }, ora: '23:00' });
    expect(ancora.effetti).toEqual(['flag:appuntato:2513']);
    expect(appunta(s0, r, { bersaglio: { caposaldo: 'cs_15' }, ora: '22:00' })).toMatchObject({ ok: false, motivo: 'buio' });
    const collare = appunta(s0, r, { bersaglio: { caposaldo: 'cs_14' }, ora: '01:20' });
    expect(collare).toMatchObject({ ok: false, motivo: 'collare' });
    expect(collare.messaggio).toMatch(/Collare copre Pilastro 14 fino alle 01:40/);
    expect(appunta(s0, r, { bersaglio: { caposaldo: 'cs_14' }, ora: '01:40' }).ok).toBe(true);
    // il lume di Ottavio sul Pilastro 15 lo rende visibile
    expect(appunta(s0, r, { bersaglio: { caposaldo: 'cs_15' }, ora: '22:00', lumiDiOttavio: ['cs_15'] }).ok).toBe(true);
    // un lume che cammina (Tecla)
    expect(appunta(s0, r, { bersaglio: { lume: 'tecla' }, ora: '23:30' }).effetti).toEqual(['flag:appuntato_lume:tecla']);
  });

  it('segnaCaposaldoVisto', () => {
    const v = segnaCaposaldoVisto(s0, r, 'cs_7');
    expect(v.stato.capisaldi.cs_7?.visto).toBe(true);
    expect(segnaCaposaldoVisto(v.stato, r, 'cs_7').stato).toBe(v.stato);
    expect(segnaCaposaldoVisto(s0, r, 'cs_zz').ok).toBe(false);
  });
});

describe('rilevare un lato', () => {
  const s0 = statoIniziale(r);

  it('i lati bloccati dai contenuti falliscono in tutti e due i versi, con il motivo', () => {
    for (const [a, b] of [
      ['cs_2', 'cs_1'],
      ['cs_1', 'cs_2'],
    ]) {
      const x = rileva(s0, r, { stazione: a!, mira: b!, ora: 10 });
      expect(x.motivo).toBe('coperto');
      expect(x.messaggio).toMatch(/tasso/);
    }
    // anche se il raycast del gioco dicesse «libera»: i contenuti hanno l'ultima parola
    expect(rileva(s0, r, { stazione: 'cs_5', mira: 'cs_1', ora: 10, lineaLibera: () => true }).messaggio).toMatch(/tettoia/);
  });

  it('il raycast del gioco può bloccare un lato aperto, con il suo motivo', () => {
    const x = rileva(s0, r, { stazione: 'cs_3', mira: 'cs_1', ora: 10, lineaLibera: () => ({ libera: false, motivo: 'Un carro di fieno davanti al reticolo.' }) });
    expect(x).toMatchObject({ ok: false, motivo: 'coperto', messaggio: 'Un carro di fieno davanti al reticolo.' });
    expect(x.effetti).toEqual(['flag:tentato_lato:3-1']);
  });

  it('caposaldo sconosciuto, stesso caposaldo, senza fiato, non attivo in Fase 1', () => {
    expect(rileva(s0, r, { stazione: 'cs_x', mira: 'cs_1', ora: 10 })).toMatchObject({ motivo: 'stazione_sconosciuta', effetti: [] });
    expect(rileva(s0, r, { stazione: 'cs_3', mira: 'cs_x', ora: 10 }).motivo).toBe('mira_sconosciuta');
    expect(rileva(s0, r, { stazione: 'cs_3', mira: 'cs_3', ora: 10 }).motivo).toBe('stessa_stazione');
    expect(rileva(s0, r, { stazione: 'cs_3', mira: 'cs_1', ora: 10, senzaFiato: true })).toMatchObject({ motivo: 'senza_fiato', messaggio: 'Senza fiato la bolla non sta ferma.' });
    const lontano = rileva(s0, r, { stazione: 'cs_1', mira: 'cs_14', ora: 22 });
    expect(lontano.motivo).toBe('non_attivo');
    expect(lontano.messaggio).toMatch(/incollate dall'umidità/);
  });

  it('un caposaldo spostato non regge la lettura finché non si rimette', () => {
    const s = clonaStato(s0);
    s.capisaldi.cs_3 = { ...s.capisaldi.cs_3!, spostato: { metri: 3, direzione: 'Sera', notte: 1, mossa: null } };
    const x = rileva(s, r, { stazione: 'cs_3', mira: 'cs_1', ora: 10 });
    expect(x.motivo).toBe('stazione_spostata');
    expect(x.messaggio).toBe('Chiodo 3 non è al suo posto (spostato di 3 m a Sera): la lettura non torna.');
    expect(rileva(s, r, { stazione: 'cs_1', mira: 'cs_3', ora: 10 }).motivo).toBe('mira_spostata');
    const rimesso = rimettiCaposaldo(s, r, 'cs_3');
    expect(rimesso.effetti).toEqual(['flag:caposaldo_rimesso:3']);
    expect(rimesso.eventi).toEqual([{ tipo: 'caposaldo_rimesso', caposaldo: 'cs_3' }]);
    expect(rileva(rimesso.stato, r, { stazione: 'cs_3', mira: 'cs_1', ora: 10 }).ok).toBe(true);
    expect(rimettiCaposaldo(s0, r, 'cs_3').stato).toBe(s0);
  });

  it('il lato chiuso: eventi, capisaldi, lati, flag, griglia del foglio solo la prima volta', () => {
    const a = rileva(s0, r, { stazione: 'cs_1', mira: 'cs_3', ora: 10 });
    expect(a.ok).toBe(true);
    const riv = ev(a.eventi, 'particelle_rivelate')!;
    expect(riv.origine).toEqual({ z: 1062, theta: 37.2 });
    expect(riv.verso).toEqual({ z: 946, theta: 23.6 });
    expect(riv.primoDelFoglio).toBe(true);
    expect(riv.foglio).toBe(1);
    expect(a.stato.lati['1-3']).toEqual({ id: '1-3', stazione: 'cs_1', mira: 'cs_3', firma: 'G5', giorno: 1, anno: null });
    expect(a.stato.capisaldi.cs_1).toMatchObject({ visto: true, rilevato: true, firme: ['G4', 'G5'] });
    expect(a.stato.capisaldi.cs_3).toMatchObject({ visto: true, rilevato: true, firme: ['G5'] });
    expect(flagDa(a.effetti).slice(0, 2)).toEqual(['tentato_lato:1-3', 'rilevato_lato:1-3']);
    const b = rileva(a.stato, r, { stazione: 'cs_3', mira: 'cs_37', ora: 11 });
    expect(ev(b.eventi, 'particelle_rivelate')!.primoDelFoglio).toBe(false);
    // rilevare di nuovo lo stesso lato non aggiunge niente di nuovo
    const c = rileva(b.stato, r, { stazione: 'cs_3', mira: 'cs_1', ora: 12 });
    expect(ev(c.eventi, 'particelle_rivelate')!.celle).toEqual([]);
    expect(c.stato.particelle['2214']!.rilievi.filter((x) => x.rif === '1-3')).toHaveLength(1);
  });

  it('tre lati fra tre capisaldi chiudono un triangolo della rete', () => {
    // 1-11 è già chiuso dal G4: 1-3 e 3-11 chiudono il triangolo 1-3-11
    const a = rileva(s0, r, { stazione: 'cs_3', mira: 'cs_1', ora: 10 });
    expect(ev(a.eventi, 'triangolo_chiuso')).toBeUndefined();
    const b = rileva(a.stato, r, { stazione: 'cs_3', mira: 'cs_11', ora: 10 });
    expect(ev(b.eventi, 'triangolo_chiuso')).toEqual({ tipo: 'triangolo_chiuso', triangolo: 'rete:cs_1-cs_11-cs_3', tipoTriangolo: 'rete', vertici: ['cs_1', 'cs_11', 'cs_3'], particelle: [] });
    expect(flagDa(b.effetti)).toContain('triangolo_rete:1-11-3');
  });

  it('la mano che ricorda: dopo 10 rilievi la bolla è più larga e la collimazione più corta', () => {
    let s: StatoCatasto = s0;
    expect(parametriSquadro(s, r)).toEqual({ manoCheRicorda: false, tolleranzaBolla: 1, collimazioneS: 1.5, rimisuraS: 5, appuntoS: 1 });
    const lati = ['1-3', '1-4', '1-6', '1-7', '1-8', '3-4', '3-5', '3-11', '3-37', '4-37'];
    for (const l of lati) {
      const [a, b] = l.split('-');
      s = rileva(s, r, { stazione: `cs_${a}`, mira: `cs_${b}`, ora: 10 }).stato;
    }
    expect(s.rilieviFatti).toBe(10);
    expect(parametriSquadro(s, r)).toMatchObject({ manoCheRicorda: true, tolleranzaBolla: 2, collimazioneS: 0.8 });
  });

  it("l'anteprima non cambia lo stato", () => {
    const a = anteprimaRilievo(s0, r, { stazione: 'cs_7', mira: 'cs_8', ora: 10 });
    expect(a.ok).toBe(true);
    expect(a.nuove).toHaveLength(13);
    expect(cellaRilevataDaElvira(s0, 2797)).toBe(false);
    expect(anteprimaRilievo(s0, r, { stazione: 'cs_2', mira: 'cs_1', ora: 10 })).toMatchObject({ ok: false, motivo: 'coperto' });
  });
});

describe('rilevare con i casi limite (contenuto sintetico)', () => {
  const rs = regoleDaContenuti(contenutoSintetico());
  const s0 = statoIniziale(rs);

  it('troppo corto, troppo lungo, altra valle', () => {
    expect(rileva(s0, rs, { stazione: 'cs_a', mira: 'cs_c', ora: 10 })).toMatchObject({ ok: false, motivo: 'troppo_corto' });
    expect(rileva(s0, rs, { stazione: 'cs_a', mira: 'cs_d', ora: 10 })).toMatchObject({ ok: false, motivo: 'troppo_lungo' });
    const v = rileva(s0, rs, { stazione: 'cs_f', mira: 'cs_g', ora: 10 });
    expect(v).toMatchObject({ ok: false, motivo: 'altra_valle' });
  });

  it('vicino all\'asse la Linea abbaglia di giorno; alla brace si legge', () => {
    const g = rileva(s0, rs, { stazione: 'cs_h', mira: 'cs_i', ora: 12 });
    expect(g).toMatchObject({ ok: false, motivo: 'abbaglia' });
    expect(g.messaggio).toMatch(/passa a \d+ m dall'asse/);
    expect(rileva(s0, rs, { stazione: 'cs_h', mira: 'cs_i', ora: 20 }).ok).toBe(true);
  });

  it('un lato «solo di giorno» di notte non si legge', () => {
    expect(rileva(s0, rs, { stazione: 'cs_a', mira: 'cs_b', ora: 23 })).toMatchObject({ ok: false, motivo: 'fuori_orario' });
  });

  it('senza ventaglio precalcolato si usa la fascia di 60 m, filtrata dalla visibilità', () => {
    const tutte = ventaglioDi(rs, {}, 'cs_a', 'cs_b');
    expect(tutte).toContain(CELLE.scritta);
    expect(tutte).toContain(idCella(1100, 20));
    const meta = ventaglioDi(rs, {}, 'cs_a', 'cs_b', (_st, c) => centroCella(c).z < 1060);
    expect(meta.length).toBeLessThan(tutte.length);
    const x = rileva(s0, rs, { stazione: 'cs_a', mira: 'cs_b', ora: 10 });
    expect(x.ok).toBe(true);
    expect(ev(x.eventi, 'lato_chiuso')!.particelle).toEqual(tutte);
    expect(idLato(rs, {}, 'cs_b', 'cs_a')).toBe('a-b');
    expect(idLato(rs, {}, 'cs_h', 'cs_i')).toBe('107-108');
  });

  it('il raggio di matita copre la propria particella', () => {
    expect(celleNelRaggio({ z: 1000, theta: 20 }, 60)).toContain(CELLE.scritta);
  });
});

describe('inchiostro', () => {
  it('seppia finché la ripassa Elvira, poi china', () => {
    const s0 = statoIniziale(r);
    expect(inchiostroDi(s0, 2505)).toBe('seppia');
    const a = rileva(s0, r, { stazione: 'cs_3', mira: 'cs_1', ora: 10 });
    expect(inchiostroDi(a.stato, 2505)).toBe('china');
    expect(a.stato.particelle['2505']!.rilievi.map((x) => x.firma)).toEqual(['G4', 'G5']);
    expect(inchiostroDi(a.stato, 1922)).toBeNull();
  });
});
