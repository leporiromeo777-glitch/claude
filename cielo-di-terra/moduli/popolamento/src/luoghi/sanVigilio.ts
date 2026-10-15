/**
 * San Vigilio: il campanile bianco con il cappello di piode, la cella con le tre campane,
 * l'altoparlante del 2121 legato al ceppo della campana grande, il Pilastro 1 con la targa del
 * 2120 e la palina bianca e rossa di 8 m sulla terrazza accanto alla cuspide.
 */
import { creaCampanile } from '../../../oggetti/src/oggetti/campanile';
import { luogo, RETE } from '../contenuti';
import type { Contesto } from '../contesto';
import { suolo, yawVerso } from '../terreno';

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
  if (punti['cima']) ctx.punto('guarda:palina_p1', 'guarda', 'Palina del Pilastro 1', punti['cima'], { raggio: 0, luogo: 'cella_campanaria', rif: 'cs_1', attivo: false });
}
