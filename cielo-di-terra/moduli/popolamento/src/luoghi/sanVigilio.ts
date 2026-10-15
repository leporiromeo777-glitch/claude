/**
 * San Vigilio: il campanile bianco con il cappello di piode, la cella con le tre campane,
 * l'altoparlante del 2121 legato al ceppo della campana grande, il Pilastro 1 con la targa del
 * 2120 e la palina bianca e rossa di 8 m sulla terrazza accanto alla cuspide.
 */
import { Vector3 } from 'three';
import { creaCampanile } from '../../../oggetti/src/oggetti/campanile';
import { creaCaposaldo } from '../../../oggetti/src/oggetti/caposaldo';
import { cylinderAt } from '../../../../src/world/colliders';
import { luogo, RETE } from '../contenuti';
import type { Contesto } from '../contesto';
import { creaChiesa, creaPanca, creaTasso } from '../edifici';
import { costruisciRipiano } from '../ripiano';
import { gradinataSulSuolo } from '../sentieri';
import { mondo, sposta, spostaYaw, suolo, yawVerso } from '../terreno';

export function costruisciCampanile(ctx: Contesto): void {
  const c = luogo('campanile');
  const cella = luogo('cella_campanaria');
  const cs1 = RETE.find((x) => x.id === 'cs_1')!;
  const base = suolo(c.z, c.theta);
  // la cella sta 24 m sopra il suolo (cella_campanaria.altezza − campanile.altezza)
  const sopraCella = cella.altezza - c.altezza;
  const altezzaFusto = sopraCella - 4.4 - 0.26;
  const campanile = creaCampanile({ seme: 'san-vigilio', lato: 5.0, altezzaFusto, ordini: 4, altezzaPalina: cs1.altezza_segnale });
  const yaw = yawVerso(c, luogo('piazza_ore'));
  const punti = ctx.posa('chiesa', campanile, c.z, c.theta, yaw, { h: base, luogo: 'campanile', tag: (t) => (t === 'caposaldo' ? 'caposaldo' : (t ?? 'muro')) });
  ctx.occupa({ nome: 'campanile', z: c.z, theta: c.theta, yaw, larghezza: 6.5, profondita: 6.5 });
  // punti d'interazione
  if (punti['porta']) ctx.punto('apri:porta_campanile', 'apri', 'Porta del campanile', punti['porta'], { raggio: 2, luogo: 'campanile', rif: 'flag:campanile_aperto' });
  if (punti['terrazza']) ctx.punto('scendi:campanile', 'scendi', 'Scendi dal campanile', punti['terrazza'], { raggio: 1.5, luogo: 'cella_campanaria' });
  if (punti['chiodo']) {
    ctx.punto('chiodo:1', 'pianta_squadro', 'Pianta lo squadro sul Pilastro 1', punti['chiodo'], { raggio: 1.5, luogo: 'cella_campanaria', rif: 'cs_1' });
    ctx.punto('leggi:targa_p1', 'leggi', 'Leggi la targa', punti['chiodo'].clone(), { raggio: 1.6, luogo: 'cella_campanaria', rif: 'targa_p1' });
  }
  if (punti['campane']) ctx.punto('parla:meridiana', 'parla', "Parla all'altoparlante", punti['campane'], { raggio: 2.5, luogo: 'cella_campanaria', rif: 'meridiana' });
  if (punti['cima']) ctx.segnali.set('cs_1', punti['cima'].clone());
  if (punti['cima']) ctx.punto('guarda:palina_p1', 'guarda', 'Palina del Pilastro 1', punti['cima'], { raggio: 0, luogo: 'cella_campanaria', rif: 'cs_1', attivo: false });
}

/**
 * La chiesa sul suo ripiano (il terreno scende di 4-6 m verso il Riale: muri di sostegno a Mane),
 * il sagrato a gradini dalla piazza con il chiodo 2 sul gradino più basso, il tasso che copre la
 * cella dal sagrato, la panca di Annunciata davanti al portale.
 */
export function costruisciChiesa(ctx: Contesto): void {
  const sv = luogo('san_vigilio');
  const sag = luogo('sagrato');
  const panca = luogo('san_vigilio');
  void panca;
  const piano = 36.0;
  // la facciata guarda a Mont e a Mane (verso il sagrato e la panca del portale)
  const yaw = 135;
  const L = 13.5;
  // ripiano: chiesa + abside + sagrato davanti
  const centroR = spostaYaw(sv.z, sv.theta, yaw, 2.6, piano);
  costruisciRipiano(ctx, { zona: 'chiesa', nome: 'ripiano_san_vigilio', z: centroR.z, theta: centroR.theta, yaw, larghezza: 13.5, profondita: L + 3.5 + 8, quota: piano, superficie: 'lastre', parapetto: 0.85, senzaParapetto: ['fronte'], dettaglio: 'alto', luogo: 'san_vigilio' });
  const chiesa = creaChiesa({ seme: 'san-vigilio-chiesa', lunghezza: L, interrata: 4.5 });
  const centroC = spostaYaw(sv.z, sv.theta, yaw, -0.6, piano);
  const punti = ctx.posa('chiesa', chiesa, centroC.z, centroC.theta, yaw, { h: piano, luogo: 'san_vigilio' });
  ctx.occupa({ nome: 'san_vigilio', z: centroC.z, theta: centroC.theta, yaw, larghezza: 9, profondita: L + 4 });
  if (punti['porta']) ctx.punto('apri:porta_san_vigilio', 'apri', 'Portale di San Vigilio', punti['porta'], { raggio: 2.2, luogo: 'san_vigilio' });
  if (punti['bacheca']) ctx.punto('leggi:lettere_sorella', 'leggi', 'Bacheca delle Lettere dalla Sorella', punti['bacheca'], { raggio: 2.0, luogo: 'san_vigilio', rif: 'lettere_sorella' });
  // panca davanti al portale (1066, 39,5): Annunciata
  const pPanca = { z: 1066, theta: 39.5 };
  const pancaO = creaPanca('panca-annunciata', 2.2, true);
  const yawPanca = yaw - 180 + 25;
  const pp = ctx.posa('chiesa', pancaO, pPanca.z, pPanca.theta, yawPanca, { h: piano });
  ctx.punto('siediti:panca_san_vigilio', 'siediti', 'Siediti sulla panca', pp['seduta'] ?? ctx.qui(pPanca.z, pPanca.theta, 0.5), { raggio: 1.6, luogo: 'san_vigilio' });
  // sagrato: gradinata sul pendio fra la piazza e il ripiano, scende a Mane
  const sa = sposta(sag.z, sag.theta, 3, -9, 37);
  const sb = sposta(sag.z, sag.theta, -2, 5.5, 36);
  for (const off of [-4.5, -1.5, 1.5, 4.5]) {
    const a = spostaYaw(sa.z, sa.theta, 0, off, 37);
    const b = spostaYaw(sb.z, sb.theta, 0, off, 36);
    gradinataSulSuolo(ctx.zona('chiesa'), a, b, 3.05, 0.36, 'pietra', 'gradino', 'sagrato', 400 + Math.round(off * 10));
  }
  ctx.occupa({ nome: 'sagrato', z: (sa.z + sb.z) / 2, theta: (sa.theta + sb.theta) / 2, yaw: 90, larghezza: 13, profondita: 15 });
  // chiodo 2 sul gradino più basso, a Mane del portale
  const cs2 = RETE.find((c) => c.id === 'cs_2')!;
  posaChiodo(ctx, 'chiesa', cs2.numero, cs2.z, cs2.theta, 'cs_2', 'sagrato');
  // il tasso del sagrato
  const t = luogo('tasso');
  const tasso = creaTasso('tasso-sagrato', 19);
  ctx.posa('chiesa', tasso, t.z, t.theta, 20, { luogo: 'tasso' });
  ctx.occupa({ nome: 'tasso', z: t.z, theta: t.theta, raggio: 5 });
  ctx.punto('esamina:tasso', 'esamina', 'Il tasso del sagrato', ctx.qui(t.z, t.theta, 1.4), { raggio: 3, luogo: 'tasso' });
}

/**
 * Chiodo d'ottone posato sulla pietra che c'è (gradino, soglia, lastra): appoggiato al collider più
 * alto sotto di lui o al suolo. Registra il punto «pianta lo squadro».
 */
export function posaChiodo(ctx: Contesto, zona: string, numero: number, z: number, theta: number, id: string, luogoId: string, sopra?: number): void {
  const h = sopra ?? quotaAppoggio(ctx, z, theta);
  const ch = creaCaposaldo({ numero, supporto: 'nessuno', segno: true });
  const punti = ctx.posa(zona, ch, z, theta, 0, { h, luogo: luogoId, tag: () => 'chiodo' });
  ctx.zona(zona).aggiungiCollider(cylinderAt(z, theta, h - 0.05, 0.08, 0.08, 'chiodo'), 'chiodo', luogoId);
  const p = punti['chiodo'] ?? ctx.qui(z, theta, 0.05);
  // segnale di un chiodo: la biffa tenuta in piedi sul chiodo (1,2 m), come nelle visuali dei lati
  const su = new Vector3(-p.x, -p.y, 0).normalize();
  ctx.segnali.set(id, p.clone().addScaledVector(su, 1.2));
  ctx.punto(`chiodo:${numero}`, 'pianta_squadro', `Pianta lo squadro sul chiodo ${numero}`, p, { raggio: 1.4, luogo: luogoId, rif: id });
}

/** Quota d'appoggio a (z, theta): il più alto fra il suolo e le facce superiori dei collider calpestabili già messi. */
export function quotaAppoggio(ctx: Contesto, z: number, theta: number): number {
  let h = suolo(z, theta);
  const p = mondo(z, theta, h);
  const up = new Vector3(-p.x, -p.y, 0).normalize();
  for (const zona of ctx.zone.values()) {
    for (const v of zona.collider) {
      const c = v.collider;
      if (c.kind !== 'box' || !['gradino', 'calpestabile'].includes(v.tag)) continue;
      const d = new Vector3().subVectors(p, c.center);
      const lx = d.dot(c.right);
      const lz = d.dot(c.forward);
      if (Math.abs(lx) > c.half.x || Math.abs(lz) > c.half.z) continue;
      const top = c.center.clone().addScaledVector(c.up, c.half.y);
      const ht = h + new Vector3().subVectors(top, p).dot(up);
      if (ht > h && ht < h + 6) h = ht;
    }
  }
  return h;
}
