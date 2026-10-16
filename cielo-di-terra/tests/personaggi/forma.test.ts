/**
 * Prove di forma sui 13 modelli veri (i GLB di public/personaggi, skinning sulla CPU): le pose che il
 * gioco usa non devono rompere la mesh. Sono le misure della revisione artistica, trasformate in soglie:
 *
 * - braccia conserte, mani giunte, mani dietro: il braccio non si tende mai del tutto (l'«zombi» delle
 *   braccia conserte era la catena spalla-polso tesa al 100%, con le mani fuori dal petto);
 * - pochi strappi che si vedono (spigoli più lunghi di 3 cm e di 3 volte rispetto al riposo): al più lo
 *   0,5% degli spigoli in piedi e seduti su un gradino, l'1,2% seduti per terra (le anche piegate oltre
 *   90° stirano le pieghe del sedere e dell'inguine, che stanno contro il suolo);
 * - seduti su un gradino di 0,45 m: niente sprofonda nel gradino (la gonna che lo bucava, il sedere
 *   sotto la seduta); per terra le scarpe non entrano nel suolo (le gambe incrociate le piantavano 5 cm
 *   sotto; la stoffa sotto le cosce invece può scendere: la copre il suolo);
 * - camminando le scarpe non pattinano e si alzano davvero.
 *
 * Le misure complete, stampate: `MISURE=tutti npx vitest run tests/personaggi/misure.test.ts
 * --reporter=verbose` (MISURE=togna,pina per sceglierne alcuni).
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { MODELLI, SCHEDE, anima, estensione, figura, lod0, pattinamento, profiloGradino, profiloPiano, registraVeri, spigoli, stiramento, verticiPiedi, vertici } from './posa';

beforeAll(async () => {
  await registraVeri();
}, 120000);

/** Chi ha il bastone nella destra (la mano sul pomo resta più tesa: è il bastone a reggerla). */
const COL_BASTONE = new Set(['annunciata', 'velato_maschera']);

/**
 * Strappi ammessi, in frazione degli spigoli. Bortolo ha la manica fusa col fianco della giacca sotto il
 * gomito (il modello generato è così): con le mani dietro quel ponte si stira, ma resta coperto dal
 * braccio (docs/personaggi/INTEGRAZIONE.md).
 */
const STRAPPI = { piedi: 0.005, terra: 0.012 } as const;
const STRAPPI_BRACCIA: Record<string, number> = { bortolo: 0.01 };

function riposo(id: string) {
  const o = figura(id);
  anima(o, { modo: 'fermo' }, 2);
  const sp = spigoli(lod0(o));
  const n = sp.length / 2;
  return { v: vertici(o), sp, ammessi: (f: number) => Math.ceil(n * f) };
}

describe('forma dei personaggi veri', () => {
  it('ci sono tutti e 13', () => {
    expect(MODELLI.length).toBe(13);
  });

  it.each(MODELLI)('%s: le braccia nelle pose ferme non si tendono e non strappano la veste', (id) => {
    const r = riposo(id);
    const pose = ['braccia-conserte', 'mani-giunte', 'mani-dietro'] as const;
    for (const braccia of pose) {
      if (SCHEDE[id]?.bracciaVietate?.includes(braccia)) continue; // il gioco la sostituisce con le mani giunte
      const f = figura(id, { postura: braccia });
      anima(f, { modo: 'fermo' }, 120);
      const lati = COL_BASTONE.has(id) ? (['S'] as const) : (['S', 'D'] as const);
      const tesa = Math.max(...lati.map((l) => estensione(f, l)));
      expect(tesa, `${id} ${braccia}`).toBeLessThanOrEqual(braccia === 'braccia-conserte' ? 0.75 : 0.86);
      const s = stiramento(r.v, vertici(f), r.sp);
      expect(s.oltre3, `${id} ${braccia}: strappi`).toBeLessThanOrEqual(r.ammessi(STRAPPI_BRACCIA[id] ?? STRAPPI.piedi));
    }
  });

  it.each(MODELLI)('%s: seduto su un gradino di 0,45 m e per terra non sprofonda', (id) => {
    const r = riposo(id);
    const s = figura(id);
    anima(s, { posa: 'seduto', profilo: profiloGradino(0.45, 0.1, 0) }, 120);
    const v = vertici(s);
    const nv = v.length / 3;
    // nel gradino: dietro lo spigolo (z = 0,1, con 5 cm di stoffa che lo sfiora) e più di 12 cm sotto la
    // seduta (la stoffa schiacciata sotto il sedere sta nei primi centimetri)
    let dentro = 0;
    for (let i = 0; i < nv; i++) if ((v[i * 3 + 2] as number) < 0.05 && (v[i * 3 + 1] as number) < 0.33) dentro++;
    expect(dentro, `${id}: vertici dentro il gradino`).toBeLessThanOrEqual(Math.ceil(nv * 0.002));
    expect(stiramento(r.v, v, r.sp).oltre3, `${id} seduto: strappi`).toBeLessThanOrEqual(r.ammessi(STRAPPI.piedi));
    // per terra
    const t = figura(id);
    anima(t, { posa: 'seduto', profilo: profiloPiano(0) }, 120);
    const vt = vertici(t);
    const piedi = verticiPiedi(lod0(t), 0.5);
    let sotto = 0;
    for (const i of [...piedi.S, ...piedi.D]) if ((vt[i * 3 + 1] as number) < -0.03) sotto++;
    expect(sotto, `${id} per terra: vertici delle scarpe sotto il suolo`).toBeLessThanOrEqual(Math.ceil(nv * 0.003));
    expect(stiramento(r.v, vt, r.sp).oltre3, `${id} per terra: strappi`).toBeLessThanOrEqual(r.ammessi(STRAPPI.terra));
  });

  it.each(MODELLI)('%s: camminando le scarpe restano piantate e si alzano', (id) => {
    const H = SCHEDE[id]?.altezza ?? 1.6;
    const v = id === 'annunciata' ? 0.7 : id === 'lisa' || id === 'gioanin' ? 1.3 : 1.1;
    // solo la suola della scarpa (≥ 85% sul piede, attorno alla caviglia, entro 8 mm dal suolo): l'orlo
    // di una veste lunga pesato sul piede striscia per terra come una veste vera, e la scarpa che ruota
    // sulla punta quando il tallone si alza non è una suola che scivola. Prima del passo legato alla
    // distanza le suole scivolavano a 0,1-0,2 m/s; ora 0,005-0,05 (Clelia 0,07: scarpe corte sotto la veste)
    const p = pattinamento(figura(id), v, 3, 0.85, true, 0.008);
    expect(p.campioni, id).toBeGreaterThan(100);
    expect(p.medio, `${id}: m/s delle suole a terra`).toBeLessThan(0.08);
    expect(p.alzata, `${id}: alzata del piede in volo`).toBeGreaterThan(0.06 * H);
  });
});
