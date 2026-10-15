/**
 * La matematica del segnalino (src/regia/segnalino.ts): proiezione sullo schermo, bordo per le
 * mete fuori o dietro, «in su»/«sotto» nel cilindro, distanza scritta.
 */
import { describe, expect, it } from 'vitest';
import { PerspectiveCamera, Vector3 } from 'three';
import { QUOTA_DIETRO, distanzaMeta, nuovaProiezione, proietta, scriviDistanza, verticale, type Riquadro } from '../../src/regia/segnalino';
import { METERS_PER_DEG } from '../../src/world/constants';
import { cylToWorld, upAt } from '../../src/world/cylinder';

const R: Riquadro = { larghezza: 1280, altezza: 720, sinistra: 50, destra: 50, sopra: 140, sotto: 190, margineVisibile: 20 };

/** Una camera all'origine che guarda verso -z (y in su), 80° di campo verticale. */
function camera(): PerspectiveCamera {
  const c = new PerspectiveCamera(80, R.larghezza / R.altezza, 0.1, 5000);
  c.position.set(0, 0, 0);
  c.lookAt(0, 0, -1);
  c.updateMatrixWorld();
  c.updateProjectionMatrix();
  return c;
}

describe('proiezione del segnalino', () => {
  const cam = camera();
  const p = nuovaProiezione();

  it('davanti, al centro: sul punto, non al bordo', () => {
    proietta(new Vector3(0, 0, -30), cam, R, p);
    expect(p.bordo).toBe(false);
    expect(p.dietro).toBe(false);
    expect(p.x).toBeCloseTo(640, 3);
    expect(p.y).toBeCloseTo(360, 3);
  });

  it('davanti, in alto a destra ma dentro lo schermo: dove si vede', () => {
    proietta(new Vector3(10, 6, -30), cam, R, p);
    expect(p.bordo).toBe(false);
    expect(p.x).toBeGreaterThan(640);
    expect(p.y).toBeLessThan(360);
    // la stessa posizione di Vector3.project
    const v = new Vector3(10, 6, -30).project(cam);
    expect(p.x).toBeCloseTo(((v.x + 1) / 2) * 1280, 3);
    expect(p.y).toBeCloseTo(((1 - v.y) / 2) * 720, 3);
  });

  it('davanti ma fuori a destra: al bordo destro della zona, freccia verso destra', () => {
    proietta(new Vector3(200, 0, -30), cam, R, p);
    expect(p.bordo).toBe(true);
    expect(p.dietro).toBe(false);
    expect(p.x).toBeCloseTo(1280 - R.destra, 3);
    expect(p.y).toBeCloseTo(360, 3);
    expect(p.angolo).toBeCloseTo(0, 3);
  });

  it('molto in alto: al bordo di sopra della zona (sotto il pannello e le notifiche)', () => {
    proietta(new Vector3(0, 500, -10), cam, R, p);
    expect(p.bordo).toBe(true);
    expect(p.y).toBeCloseTo(R.sopra, 3);
    expect(p.x).toBeCloseTo(640, 1);
    expect(p.angolo).toBeCloseTo(-Math.PI / 2, 2);
  });

  it('dietro a sinistra: sul fianco sinistro, sotto la metà, freccia di lato; proprio alle spalle resta dov’era', () => {
    proietta(new Vector3(-20, 0, 15), cam, R, p);
    expect(p.dietro).toBe(true);
    expect(p.bordo).toBe(true);
    expect(p.x).toBeCloseTo(R.sinistra, 3);
    expect(p.y).toBeCloseTo(720 * QUOTA_DIETRO, 3);
    expect(Math.abs(p.angolo)).toBeCloseTo(Math.PI, 3);
    // proprio alle spalle (o quasi): non salta sull'altro fianco
    proietta(new Vector3(0.5, 0, 40), cam, R, p);
    expect(p.dietro).toBe(true);
    expect(p.x).toBeCloseTo(R.sinistra, 3);
    // mai in basso al centro, fra l'azione e i sottotitoli
    expect(Math.abs(p.x - 640)).toBeGreaterThan(400);
    // alle spalle e a destra: sul fianco destro, freccia verso destra
    proietta(new Vector3(20, 0, 15), cam, R, p);
    expect(p.x).toBeCloseTo(1280 - R.destra, 3);
    expect(p.angolo).toBeCloseTo(0, 3);
  });

  it('in basso: vicino al fondo ai lati, sopra la fascia dei sottotitoli al centro', () => {
    const B: Riquadro = { ...R, sotto: 50, sottoCentro: 190, bandaCentro: 380 };
    // giù a sinistra, di sbieco: l'angolo in basso a sinistra, vicino al fondo
    proietta(new Vector3(-60, -40, -10), cam, B, p);
    expect(p.bordo).toBe(true);
    expect(p.y).toBeGreaterThan(720 - 190);
    expect(Math.abs(p.x - 640)).toBeGreaterThanOrEqual(380);
    // davanti, in basso e un po' a sinistra: il raggio cadrebbe sui sottotitoli, scivola al fianco della fascia
    proietta(new Vector3(-90, -120, -10), cam, B, p);
    expect(p.dietro).toBe(false);
    expect(p.x).toBeCloseTo(640 - 380, 3);
    expect(p.y).toBeCloseTo(720 - 50, 3);
    // quasi dritto in giù: si ferma sopra i sottotitoli
    proietta(new Vector3(-3, -500, -10), cam, B, p);
    expect(p.bordo).toBe(true);
    expect(p.y).toBeCloseTo(720 - 190, 3);
    expect(Math.abs(p.x - 640)).toBeLessThan(380);
  });

  it('dietro e in alto: anche lei sul fianco (girarsi prima; «in su» lo dice l’etichetta)', () => {
    const q = nuovaProiezione();
    proietta(new Vector3(0, 30, 5), cam, R, q);
    expect(q.dietro).toBe(true);
    expect(q.x).toBeCloseTo(1280 - R.destra, 3);
    expect(q.y).toBeCloseTo(720 * QUOTA_DIETRO, 3);
  });

  it('un punto davanti non si confonde con uno dietro: la direzione del bordo resta quella vera', () => {
    proietta(new Vector3(-300, -40, -20), cam, R, p);
    expect(p.dietro).toBe(false);
    expect(p.bordo).toBe(true);
    expect(p.x).toBeCloseTo(R.sinistra, 3);
    expect(p.y).toBeGreaterThan(360);
  });
});

describe('in su e sotto, nel cilindro', () => {
  // Elvira in piazza a Corbella: occhi a 1,6 m dal suolo (quota 38,5)
  const z = 1046;
  const theta = 37;
  const occhi = cylToWorld(z, theta, 40.1);
  const su = upAt(theta);

  it('la cella campanaria sopra il sagrato è «in su», la Cripta sotto è «sotto»', () => {
    expect(verticale(occhi, cylToWorld(z + 10, theta, 64), su)).toBe('su');
    expect(verticale(occhi, cylToWorld(z + 4, theta + 3 / METERS_PER_DEG, -4.5), su)).toBe('giu');
  });

  it('l’altra parte della valle è sopra la testa: «in su»', () => {
    expect(verticale(occhi, cylToWorld(1500, 195.5, 34.8), su)).toBe('su');
    expect(verticale(occhi, cylToWorld(1046, 127, 101), su)).toBe('su');
  });

  it('una terrazza lontana o una persona a due passi: niente', () => {
    expect(verticale(occhi, cylToWorld(948, 23, 78), su)).toBe(null);
    expect(verticale(occhi, cylToWorld(z + 1.5, theta, 38.5), su)).toBe(null);
    expect(verticale(occhi, cylToWorld(z + 150, theta, 20), su)).toBe(null);
    // un ripiano due metri più su, a tre metri di distanza: si vede, niente «in su»
    expect(verticale(occhi, cylToWorld(z + 3, theta, 42.1), su)).toBe(null);
  });

  it('vicina ma a piombo (la botola in cima alla scala, una botola sotto i piedi): «in su», «sotto»', () => {
    expect(verticale(occhi, cylToWorld(z + 0.3, theta, 42.1), su)).toBe('su');
    expect(verticale(occhi, cylToWorld(z + 0.4, theta, 37.6), su)).toBe('giu');
  });
});

describe('la distanza', () => {
  it('sulla superficie del cilindro più il dislivello', () => {
    expect(distanzaMeta(1000, 30, 40, 1030, 30, 40)).toBeCloseTo(30, 6);
    expect(distanzaMeta(1000, 30, 40, 1000, 30, 80)).toBeCloseTo(40, 6);
    expect(distanzaMeta(1000, 30, 0, 1030, 30, 40)).toBeCloseTo(50, 6);
    // lungo θ si misura sull'arco del fondo, non sulla corda
    expect(distanzaMeta(1000, 0, 0, 1000, 90, 0)).toBeCloseTo(90 * METERS_PER_DEG, 3);
  });

  it('scritta per il segnalino', () => {
    expect(scriviDistanza(0.4)).toBe('1 m');
    expect(scriviDistanza(7.4)).toBe('7 m');
    expect(scriviDistanza(46.6)).toBe('47 m');
    expect(scriviDistanza(123)).toBe('125 m');
    expect(scriviDistanza(1840)).toBe('1,8 km');
    expect(scriviDistanza(Number.NaN)).toBe('');
  });
});
