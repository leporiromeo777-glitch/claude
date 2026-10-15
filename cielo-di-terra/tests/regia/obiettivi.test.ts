// @vitest-environment happy-dom
/**
 * La guida delle indicazioni (src/regia/obiettivi.ts) con la storia vera (Narrativa sui contenuti
 * della Fase 1) e l'interfaccia vera (happy-dom), dentro una regia finta: il pannello segue il
 * passo, cambia al passo nuovo (con il suono), si sospende sotto i dialoghi, nel titolo e nelle
 * scene; il segnalino va sul luogo, al bordo se è alle spalle, sulla persona più vicina.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PerspectiveCamera, Vector3 } from 'three';
import { Narrativa } from '../../src/narrativa';
import { CAPISALDI, CONTENUTI_NARRATIVA, internoDelCaposaldo, internoDelLuogo } from '../../src/regia/contenuti';
import { Velatura } from '../../src/regia/velatura';
import { Luoghi } from '../../src/regia/luoghi';
import { GuidaObiettivi } from '../../src/regia/obiettivi';
import type { Regia } from '../../src/regia/regia';
import { InterfacciaGioco, StoreImpostazioni } from '../../src/ui/index';
import { METERS_PER_DEG } from '../../src/world/constants';
import { cylToWorld, localFrameTheta, upAt } from '../../src/world/cylinder';
import { groundHeight } from '../../src/world/terrain';
import { FattiFinti } from '../narrativa/aiuti';

interface Finta {
  r: Regia;
  ui: InterfacciaGioco;
  fatti: FattiFinti;
  narrativa: Narrativa;
  guida: GuidaObiettivi;
  audio: ReturnType<typeof vi.fn>;
  stato: {
    fase: string;
    controllo: { tipo: string };
    dormendo: boolean;
    coperta: boolean;
    telescopio: boolean;
    interno: 'cripta' | 'cella' | null;
    luoghiQui: Set<string>;
    persone: Map<string, { z: number; theta: number; h: number }>;
  };
  camera: PerspectiveCamera;
  /** Mette Elvira in (z, θ) sul suolo, con lo sguardo verso (z2, θ2). */
  metti(z: number, theta: number, verso: [number, number, number]): void;
  disegna(): void;
}

let f: Finta;
let contenitore: HTMLDivElement;

function crea(): Finta {
  contenitore = document.createElement('div');
  document.body.append(contenitore);
  const ui = new InterfacciaGioco(contenitore, { impostazioni: new StoreImpostazioni({ archivio: null, predefinite: { riduciMovimenti: true } }) });
  ui.indicazioni.show(); // come fa la regia all'inizio della partita
  const fatti = new FattiFinti();
  fatti.oraCorrente = 5.6;
  const narrativa = new Narrativa(CONTENUTI_NARRATIVA, fatti);
  narrativa.tick(0);
  const stato: Finta['stato'] = { fase: 'gioco', controllo: { tipo: 'libero' }, dormendo: false, coperta: false, telescopio: false, interno: null, luoghiQui: fatti.luoghi, persone: new Map() };
  const camera = new PerspectiveCamera(80, innerWidth / innerHeight, 0.1, 5000);
  const player = { cyl: { z: 0, theta: 0, r: 0, h: 0 }, pos: new Vector3() };
  const audio = vi.fn();
  const corpi = ['ottavio', 'togna', 'bortolo', 'annunciata', 'pina', 'nando', 'clelia', 'bambini'];
  const r = {
    ui,
    narrativa,
    audio: { evento: audio },
    luoghi: new Luoghi(),
    get fase() {
      return stato.fase;
    },
    get controllo() {
      return stato.controllo;
    },
    get dormendo() {
      return stato.dormendo;
    },
    get interno() {
      return stato.interno;
    },
    luoghiQui: stato.luoghiQui,
    orologio: {
      get giorno() {
        return fatti.giornoCorrente;
      },
      get ore() {
        return fatti.oraCorrente;
      },
    },
    ponte: { nomeVisibile: (id: string) => ({ togna: 'una velata al lavatoio', bortolo: 'un velato col cappello', clelia: 'una novizia', bambini: 'due bambini' })[id] ?? id },
    velatura: { coperta: () => stato.coperta },
    squadro: {
      get telescopio() {
        return stato.telescopio;
      },
    },
    abitanti: {
      ha: (p: string) => corpi.includes(p),
      posizione: (id: string) => stato.persone.get(id) ?? null,
      distanzaDa: (id: string, z: number, theta: number) => {
        const p = stato.persone.get(id);
        return p ? Math.hypot(p.z - z, (p.theta - theta) * METERS_PER_DEG) : Infinity;
      },
      testa: (id: string, out: Vector3) => {
        const p = stato.persone.get(id);
        return p ? cylToWorld(p.z, p.theta, p.h + 1.45, out) : null;
      },
    },
    scena: { punto: () => null },
    cripta: { punti: { scala: cylToWorld(1111, 27, 30), busta_5: cylToWorld(1112, 27.4, 31), armadietto_5: cylToWorld(1112, 27.2, 31.5) } },
    cella: { punti: { scendi_campanile: cylToWorld(1062, 37.2, 80) } },
    chiodo: (id: string) => {
      const c = CAPISALDI.find((x) => x.id === id);
      return c ? cylToWorld(c.z, c.theta, groundHeight(c.z, c.theta)) : null;
    },
    occhi: (out: Vector3) => out.copy(player.pos).addScaledVector(upAt(player.cyl.theta), 1.6),
    game: { camera, player, world: { colliders: null } },
  } as unknown as Regia;
  const guida = new GuidaObiettivi(r);
  const finta: Finta = {
    r,
    camera,
    ui,
    fatti,
    narrativa,
    guida,
    audio,
    stato,
    metti(z, theta, verso) {
      const h = groundHeight(z, theta);
      player.cyl = { z, theta, r: 646 - h, h };
      cylToWorld(z, theta, h, player.pos);
      camera.position.copy(player.pos).addScaledVector(upAt(theta), 1.6);
      camera.up.copy(localFrameTheta(theta).up);
      camera.lookAt(cylToWorld(verso[0], verso[1], verso[2]));
      camera.updateMatrixWorld();
      camera.updateProjectionMatrix();
    },
    disegna() {
      guida.aggiornaSubito();
      guida.render(0);
    },
  };
  return finta;
}

/** Completa i passi in ordine (con i loro effetti), come se il giocatore li avesse fatti. */
function completa(missione: string, ...passi: string[]): void {
  for (const p of passi) f.narrativa.missioni.completaPasso(missione, p);
  f.narrativa.tick(0);
}

const pannello = () => f.ui.obiettivo.el.querySelector<HTMLElement>('.ui-ob-pannello')!;
const segno = () => f.ui.obiettivo.el.querySelector<HTMLElement>('.ui-ob-segnalino')!;
const indicazione = () => [...f.ui.obiettivo.el.querySelectorAll('.ui-ob-indicazione')].at(-1)!.textContent;

beforeEach(() => {
  f = crea();
});
afterEach(() => {
  f.ui.destroy();
  contenitore.remove();
});

describe('la guida delle indicazioni', () => {
  it('all’inizio segue il primo passo del prologo, con i tasti e l’obiettivo del Taccuino', () => {
    f.disegna();
    expect(f.guida.chiaveSeguita).toBe('prologo/pr_vetro');
    expect(pannello().hidden).toBe(false);
    expect(pannello().querySelector('.ui-ob-missione')!.textContent).toBe('Due secoli');
    expect(indicazione()).toBe('Con il mouse guarda la scritta sul vetro, sopra il tuo viso.');
    expect(pannello().querySelector('.ui-ob-obiettivo')!.textContent).toBe('Chi ha scritto «Non fidarti delle campane» sul mio vetro?');
    expect(pannello().querySelector('.ui-ob-nota')!.textContent).toContain('nasconde il pannello');
  });

  it('al cambio di passo il pannello si aggiorna e suona, una volta', () => {
    f.disegna();
    f.audio.mockClear();
    f.narrativa.flag.set('guardato_vetro');
    f.narrativa.tick(0);
    f.disegna();
    expect(f.guida.chiaveSeguita).toBe('prologo/pr_cripta');
    expect(indicazione()).toBe("Prendi la busta sul vetro della tua capsula (E) e apri l'armadietto n. 5 (E).");
    // la meta: la busta, poi l'armadietto (punti della Cripta)
    expect(f.guida.tappeAttuali.map((t) => ('id' in t ? t.id : t.tipo))).toEqual(['busta_5', 'armadietto_5']);
    expect(f.audio).toHaveBeenCalledTimes(1);
    expect(f.audio).toHaveBeenCalledWith({ tipo: 'interfaccia', varieta: 'conferma' });
    f.disegna();
    expect(f.audio).toHaveBeenCalledTimes(1);
  });

  it('si sospende sotto un dialogo, nel titolo, nel sonno e con la vista coperta; il passo nuovo aspetta', () => {
    f.disegna();
    const sospeso = () => f.ui.obiettivo.el.classList.contains('ui-ob--sospeso');
    expect(sospeso()).toBe(false);
    f.ui.dialogo.show({ chi: 'Meridiana', testo: 'Giardiniera cinque.' });
    f.disegna();
    expect(sospeso()).toBe(true);
    // il passo cambia mentre si parla: niente suono finché il pannello non torna
    f.audio.mockClear();
    f.narrativa.flag.set('guardato_vetro');
    f.narrativa.tick(0);
    f.disegna();
    expect(f.audio).not.toHaveBeenCalled();
    f.ui.dialogo.hide();
    f.disegna();
    expect(sospeso()).toBe(false);
    expect(f.audio).toHaveBeenCalledTimes(1);
    for (const [prova, rimetti] of [
      [() => (f.stato.fase = 'titolo'), () => (f.stato.fase = 'gioco')],
      [() => (f.stato.dormendo = true), () => (f.stato.dormendo = false)],
      [() => (f.stato.coperta = true), () => (f.stato.coperta = false)],
      [() => (f.stato.controllo = { tipo: 'alzandosi' }), () => (f.stato.controllo = { tipo: 'libero' })],
      [() => f.ui.indicazioni.hide(), () => f.ui.indicazioni.show()],
    ] as const) {
      f.ui.indicazioni.show();
      prova();
      f.disegna();
      expect(sospeso()).toBe(true);
      rimetti();
      f.disegna();
      expect(sospeso()).toBe(false);
    }
  });

  it('il segnalino va sul muretto del belvedere davanti, al bordo alle spalle, e si spegne all’arrivo', () => {
    completa('prologo', 'pr_vetro', 'pr_cripta', 'pr_botola_scala', 'pr_guarda_su');
    // dalla botola, lo sguardo verso il muretto (1094, 29,8)
    f.metti(1110, 27.4, [1094, 29.8, groundHeight(1094, 29.8) + 1]);
    f.disegna();
    expect(f.guida.chiaveSeguita).toBe('prologo/pr_camminare');
    expect(f.guida.tappeAttuali[0]).toEqual({ tipo: 'luogo', id: 'belvedere_muretto' });
    expect(segno().hidden).toBe(false);
    expect(segno().classList.contains('ui-ob-segnalino--bordo')).toBe(false);
    const m = /translate3d\((\d+)px, (\d+)px/.exec(segno().style.transform)!;
    expect(Math.abs(Number(m[1]) - innerWidth / 2)).toBeLessThan(4);
    expect(segno().querySelector('.ui-ob-distanza')!.textContent).toMatch(/^\d+ m$/);
    // alle spalle
    f.metti(1110, 27.4, [1130, 25, groundHeight(1130, 25) + 1]);
    f.disegna();
    expect(segno().classList.contains('ui-ob-segnalino--bordo')).toBe(true);
    // arrivata: dentro il luogo il segnalino si spegne
    f.fatti.luoghi.add('belvedere_muretto');
    f.disegna();
    expect(segno().hidden).toBe(true);
  });

  it('niente segnalino sdraiata, nel cannocchiale, con «Solo obiettivo»', () => {
    completa('prologo', 'pr_vetro', 'pr_cripta', 'pr_botola_scala', 'pr_guarda_su');
    f.metti(1110, 27.4, [1094, 29.8, groundHeight(1094, 29.8) + 1]);
    f.disegna();
    expect(segno().hidden).toBe(false);
    f.stato.telescopio = true;
    f.disegna();
    expect(segno().hidden).toBe(true);
    f.stato.telescopio = false;
    f.stato.controllo = { tipo: 'sdraiata' };
    f.disegna();
    expect(segno().hidden).toBe(true);
    f.stato.controllo = { tipo: 'libero' };
    f.ui.impostazioni.set('indicazioniMissioni', 'obiettivo');
    f.disegna();
    expect(segno().hidden).toBe(true);
    expect(f.ui.obiettivo.pannelloVisibile).toBe(true);
  });

  it('i velati: il segnalino va sulla persona più vicina che ha ancora da dire', () => {
    completa('prologo', 'pr_vetro', 'pr_cripta', 'pr_botola_scala', 'pr_guarda_su', 'pr_camminare', 'pr_lettera', 'pr_campane');
    completa('m01_castagno_vuoto', 'm1_lente', 'm1_marza', 'm1_cartellino', 'm1_innesto', 'm1_velo');
    f.fatti.oraCorrente = 10;
    f.narrativa.tick(0);
    const z0 = 1046;
    const t0 = 37;
    f.stato.persone.set('togna', { z: 1040, theta: 39.5, h: groundHeight(1040, 39.5) });
    f.stato.persone.set('pina', { z: 1050, theta: 34.5, h: groundHeight(1050, 34.5) });
    f.fatti.luoghi.add('piazza_ore');
    f.metti(z0, t0, [1050, 34.5, groundHeight(1050, 34.5) + 1.5]);
    f.disegna();
    expect(f.guida.chiaveSeguita).toBe('m01_castagno_vuoto/m1_velati');
    expect(f.guida.tappeAttuali[0]?.tipo).toBe('persone');
    expect(segno().hidden).toBe(false);
    // Pina (a ~30 m) è più vicina di Togna (~32 m)? Si va su chi è più vicino davvero
    const piu = ['togna', 'pina'].map((id) => {
      const p = f.stato.persone.get(id)!;
      return { id, d: Math.hypot(p.z - z0, (p.theta - t0) * METERS_PER_DEG) };
    }).sort((a, b) => a.d - b.d)[0]!;
    const atteso = Math.round(piu.d);
    const scritto = Number(segno().querySelector('.ui-ob-distanza')!.textContent!.replace(/\D/g, ''));
    expect(Math.abs(scritto - atteso)).toBeLessThanOrEqual(2);
    // finito il dialogo con Pina, il segnalino passa a Togna
    f.narrativa.dialoghi.avvia('d_pina_soglia');
    while (!f.narrativa.dialoghi.isFinished()) f.narrativa.dialoghi.choose(0);
    f.narrativa.tick(0);
    f.disegna();
    const dopo = Number(segno().querySelector('.ui-ob-distanza')!.textContent!.replace(/\D/g, ''));
    const togna = f.stato.persone.get('togna')!;
    expect(Math.abs(dopo - Math.round(Math.hypot(togna.z - z0, (togna.theta - t0) * METERS_PER_DEG)))).toBeLessThanOrEqual(2);
  });
});

const PROLOGO = ['pr_vetro', 'pr_cripta', 'pr_botola_scala', 'pr_guarda_su', 'pr_camminare', 'pr_lettera', 'pr_campane'];
const M1 = ['m1_lente', 'm1_marza', 'm1_cartellino', 'm1_innesto', 'm1_velo', 'm1_velati', 'm1_ottavio', 'm1_brace', 'm1_ombrista', 'm1_fienile', 'm1_notte', 'm1_mattino', 'm1_ritorno', 'm1_dono', 'm1_campanile', 'm1_libretto', 'm1_chiodo2', 'm1_primo_rilievo', 'm1_strada', 'm1_seconda_notte', 'm1_prova', 'm1_gancio'];
/** Tutto il prologo e la missione 1 fino al passo (escluso). */
function finoA(passo: string): void {
  completa('prologo', ...PROLOGO);
  completa('m01_castagno_vuoto', ...M1.slice(0, M1.indexOf(passo)));
}
const attesa = () => pannello().querySelector<HTMLElement>('.ui-ob-attesa')!;
const suolo = (z: number, theta: number) => ({ z, theta, h: groundHeight(z, theta) });

describe('chi non c’è ancora: il luogo e l’ora in cui arriva', () => {
  it('i velati all’alba: nessuno con cui parlare, il segnalino va da chi arriva per primo e il pannello dice quando', () => {
    finoA('m1_velati');
    f.fatti.oraCorrente = 6.3;
    f.fatti.luoghi.add('piazza_ore');
    f.narrativa.tick(0);
    f.metti(1046, 37, [1040, 39.5, groundHeight(1040, 39.5) + 1]);
    f.disegna();
    expect(f.guida.chiaveSeguita).toBe('m01_castagno_vuoto/m1_velati');
    expect(indicazione()).toContain('una velata al lavatoio dalle 7');
    // Togna al lavatoio e il campanaro sulla scorciatoia arrivano tutti e due alle 7: il più vicino
    expect(f.guida.metaAttuale).toEqual({ tipo: 'luogo', id: 'lavatoio' });
    expect(f.guida.arrivo).toEqual({ giorno: 1, ore: 7, luogo: 'lavatoio' });
    expect(attesa().hidden).toBe(false);
    expect(attesa().textContent).toBe("Adesso non c'è nessuno con cui parlare. Una velata al lavatoio arriva alle 07:00: siediti (C) e aspetta (X).");
    expect(segno().hidden).toBe(false);
    // arriva Togna: il segnalino va su di lei e l'attesa se ne va
    f.fatti.oraCorrente = 7.05;
    f.stato.persone.set('togna', suolo(1040, 39.5));
    f.disegna();
    expect(f.guida.metaAttuale).toEqual({ tipo: 'persona', id: 'togna' });
    expect(f.guida.arrivo).toBeNull();
    expect(attesa().hidden).toBe(true);
  });

  it('la novizia alla Bacheca prima delle 7: arrivati, il pannello dice a che ora arriva', () => {
    finoA('m1_dono');
    f.fatti.giornoCorrente = 2;
    f.fatti.oraCorrente = 6.5;
    f.narrativa.tick(0);
    f.metti(1046, 37, [1043, 35.6, groundHeight(1043, 35.6) + 1]);
    f.disegna();
    expect(f.guida.chiaveSeguita).toBe('m01_castagno_vuoto/m1_dono');
    expect(f.guida.metaAttuale).toEqual({ tipo: 'luogo', id: 'bacheca_ore' });
    f.fatti.luoghi.add('bacheca_ore');
    f.narrativa.tick(0);
    f.disegna();
    expect(f.guida.metaAttuale).toEqual({ tipo: 'luogo', id: 'bacheca_ore' });
    expect(attesa().textContent).toBe('Una novizia arriva alle 07:00: siediti (C) e aspetta (X).');
    // dentro la Bacheca il segnalino tace; la riga dell'attesa resta
    expect(segno().hidden).toBe(true);
    expect(f.guida.arrivo).toEqual({ giorno: 2, ore: 7, luogo: 'bacheca_ore' });
  });

  it('il campanaro si cerca sul sagrato: alle 7 è sulla scorciatoia, il segnalino non lo insegue', () => {
    finoA('m1_campanile');
    f.fatti.giornoCorrente = 2;
    f.fatti.oraCorrente = 7.02;
    f.narrativa.tick(0);
    f.stato.persone.set('bortolo', suolo(1000, 28));
    f.metti(1046, 37, [1052, 39.2, groundHeight(1052, 39.2) + 1]);
    f.disegna();
    expect(f.guida.chiaveSeguita).toBe('m01_castagno_vuoto/m1_campanile');
    expect(indicazione()).toContain('sul sagrato dalle 8');
    expect(f.guida.metaAttuale).toEqual({ tipo: 'luogo', id: 'sagrato' });
    expect(attesa().textContent).toBe('Un velato col cappello arriva alle 08:00: siediti (C) e aspetta (X).');
    // alle 8 è sul sagrato: il segnalino su di lui
    f.fatti.oraCorrente = 8.05;
    f.stato.persone.set('bortolo', suolo(1052, 39.4));
    f.disegna();
    expect(f.guida.metaAttuale).toEqual({ tipo: 'persona', id: 'bortolo' });
    expect(attesa().hidden).toBe(true);
    // aperto il campanile: l'indicazione cambia (senza «nuovo obiettivo») e la meta è la cella
    f.audio.mockClear();
    f.narrativa.flag.set('campanile_aperto');
    f.narrativa.tick(0);
    f.disegna();
    expect(indicazione()).toBe('Il campanile è aperto: sali e leggi la targa del Pilastro 1 (E).');
    expect(f.guida.metaAttuale).toEqual({ tipo: 'luogo', id: 'cella_campanaria' });
    expect(f.audio).not.toHaveBeenCalled();
  });
});

describe('rami della storia, ripresa, dentro e fuori', () => {
  it('la notte: l’indicazione segue la scelta (vegliare, poi le Fade viste)', () => {
    finoA('m1_notte');
    f.fatti.oraCorrente = 21;
    f.narrativa.tick(0);
    f.disegna();
    expect(f.guida.chiaveSeguita).toBe('m01_castagno_vuoto/m1_notte');
    expect(indicazione()).toContain('dormire fino al mattino o vegliare');
    f.narrativa.flag.set('scelta_vegliare');
    f.disegna();
    expect(indicazione()).toBe("Vegli: guarda le Fade dalla finestrella del fienile; poi, da seduta (C), aspetta l'alba (X).");
    f.narrativa.flag.set('fade_viste');
    f.disegna();
    expect(indicazione()).toBe("Le hai viste. Da seduta (C) aspetta l'alba (X).");
  });

  it('«Continua»: l’obiettivo ripreso non è nuovo (niente suono, niente animazione); il passo dopo sì', () => {
    completa('prologo', 'pr_vetro');
    f.disegna();
    f.audio.mockClear();
    f.guida.riprendi();
    f.guida.render(0);
    expect(f.audio).not.toHaveBeenCalled();
    expect(pannello().classList.contains('ui-ob-pannello--primo')).toBe(false);
    expect(pannello().classList.contains('ui-ob-pannello--cambia')).toBe(false);
    expect(f.ui.obiettivo.el.querySelectorAll('.ui-ob-indicazione--conclusa')).toHaveLength(0);
    expect(indicazione()).toContain('busta');
    completa('prologo', 'pr_cripta');
    f.disegna();
    expect(f.audio).toHaveBeenCalledTimes(1);
    // una partita nuova: il pannello si svuota, il primo obiettivo si annuncia di nuovo
    f.guida.azzera();
    expect(pannello().hidden).toBe(true);
  });

  it('il guado già passato resta passato dopo un salvataggio e un caricamento', () => {
    finoA('m1_ritorno');
    f.fatti.giornoCorrente = 2;
    f.fatti.oraCorrente = 6;
    f.narrativa.tick(0);
    f.disegna();
    expect(f.guida.tappeAttuali[0]).toEqual({ tipo: 'luogo', id: 'guado_sass' });
    // passa dal guado e va oltre
    f.fatti.luoghi.add('guado_sass');
    f.narrativa.tick(0);
    f.fatti.luoghi.delete('guado_sass');
    f.disegna();
    expect(f.guida.tappeAttuali[0]).toEqual({ tipo: 'luogo', id: 'piazza_ore' });
    // salva, ricarica in una guida nuova (niente memoria locale): il guado è ancora alle spalle
    const salvato = JSON.parse(JSON.stringify(f.narrativa.esporta()));
    f.ui.destroy();
    contenitore.remove();
    f = crea();
    f.fatti.giornoCorrente = 2;
    f.fatti.oraCorrente = 6;
    f.narrativa.importa(salvato);
    f.guida.riprendi();
    expect(f.guida.chiaveSeguita).toBe('m01_castagno_vuoto/m1_ritorno');
    expect(f.guida.tappeAttuali[0]).toEqual({ tipo: 'luogo', id: 'piazza_ore' });
  });

  it('nella cella del campanile, con la meta fuori: prima la scala per scendere', () => {
    expect(internoDelLuogo('cripta_sala')).toBe('cripta');
    expect(internoDelLuogo('cella_campanaria')).toBe('cella');
    expect(internoDelLuogo('sagrato')).toBeNull();
    expect(internoDelCaposaldo('cs_1')).toBe('cella');
    expect(internoDelCaposaldo('cs_2')).toBeNull();
    finoA('m1_chiodo2');
    f.stato.interno = 'cella';
    f.metti(1062, 37.2, [1050, 39.6, 30]);
    f.disegna();
    expect(f.guida.metaAttuale).toEqual({ tipo: 'caposaldo', id: 'cs_2' });
    const meta = (f.guida as unknown as { meta: Vector3 }).meta;
    expect(meta.distanceTo(cylToWorld(1062, 37.2, 80))).toBeLessThan(1);
  });

  it('gioco libero: i Bugni passando dal Balcone, le libere in una riga ciascuna; alla porta chiusa niente segnalino', () => {
    finoA('m1_gancio');
    completa('m01_castagno_vuoto', 'm1_gancio');
    f.narrativa.flag.set('gioco_libero');
    f.narrativa.tick(0);
    f.metti(1046, 37, [1046, 30, 40]);
    f.disegna();
    expect(f.guida.chiaveSeguita).toBe('m02_cisterna_di_rosa/m2_aggancio');
    expect(f.guida.tappeAttuali.map((t) => ('id' in t ? t.id : t.tipo))).toEqual(['balcone_messi', 'porta_bugni']);
    expect(f.guida.metaAttuale).toEqual({ tipo: 'luogo', id: 'balcone_messi' });
    const titoli = [...pannello().querySelectorAll('.ui-ob-altro-titolo')].map((x) => x.textContent);
    expect(titoli).toHaveLength(2);
    expect(titoli).toContain('Corbella a china');
    f.narrativa.flag.set('atterrata_altra_valle');
    f.disegna();
    expect(indicazione()).toContain("Sei nell'altra valle");
    expect(f.guida.tappeAttuali).toEqual([{ tipo: 'luogo', id: 'porta_bugni' }]);
    f.fatti.luoghi.add('porta_bugni');
    f.narrativa.tick(0);
    f.fatti.luoghi.delete('porta_bugni');
    f.disegna();
    expect(indicazione()).toContain('chiusa');
    expect(f.guida.tappeAttuali).toEqual([]);
    expect(segno().hidden).toBe(true);
  });
});

describe('il segnalino sullo schermo', () => {
  beforeEach(() => {
    completa('prologo', 'pr_vetro', 'pr_cripta', 'pr_botola_scala', 'pr_guarda_su');
    f.metti(1110, 27.4, [1094, 29.8, groundHeight(1094, 29.8) + 1]);
  });
  const posizione = () => /translate3d\((-?\d+)px, (-?\d+)px/.exec(segno().style.transform)!.slice(1).map(Number);

  it('si proietta a ogni fotogramma: girando lo sguardo resta attaccato alla meta', () => {
    f.guida.aggiornaSubito();
    f.guida.render(1 / 60);
    const [x1] = posizione();
    f.metti(1110, 27.4, [1094, 30.4, groundHeight(1094, 30.4) + 1]);
    f.guida.render(1 / 60);
    const [x2] = posizione();
    expect(Math.abs(x2! - x1!)).toBeGreaterThan(5);
    const v = (f.guida as unknown as { meta: Vector3 }).meta.clone().project(f.camera);
    expect(Math.abs(x2! - ((v.x + 1) / 2) * innerWidth)).toBeLessThan(1.5);
  });

  it('una meta che cade sotto il pannello (o sotto le notifiche) diventa una freccia appena sotto, girata verso di lei', () => {
    f.disegna();
    const [, y0] = posizione();
    expect(segno().classList.contains('ui-ob-segnalino--bordo')).toBe(false);
    f.ui.obiettivo.areaPannello = () => ({ sinistra: 0, destra: innerWidth, sotto: y0! + 20 });
    f.disegna();
    expect(segno().classList.contains('ui-ob-segnalino--bordo')).toBe(true);
    expect(posizione()[1]).toBe(y0! + 20 + 34);
    const giro = Number(/rotate\((-?[\d.]+)rad\)/.exec(f.ui.obiettivo.el.querySelector<SVGElement>('.ui-ob-freccia')!.style.transform)![1]);
    expect(giro).toBeCloseTo(-Math.PI / 2, 1);
    f.ui.obiettivo.areaPannello = () => null;
    f.ui.indicazioni.areaNotifiche = () => ({ sinistra: innerWidth / 2 - 50, destra: innerWidth, sotto: y0! + 10 });
    f.disegna();
    expect(posizione()[1]).toBe(y0! + 10 + 34);
  });
});

describe('la vista coperta', () => {
  it('un lampo della Meta durante il nero dell’alba non scopre la vista', () => {
    const div = document.createElement('div');
    document.body.append(div);
    const v = new Velatura(div);
    expect(v.coperta()).toBe(false);
    v.dalNero(2.6);
    expect(v.coperta()).toBe(true);
    v.lampo();
    expect(v.coperta()).toBe(true);
    div.remove();
  });
});
