/**
 * La rete dei sentieri di Corbella (tracciati in (z, theta) sul terreno del motore).
 *
 * - la Mulattiera delle Terrazze: lastre di gneiss a tornanti, un tornante ogni terrazza, dalla
 *   Piazza delle Ore alla Terrazza Pedrazzini (passa da (1030, 26,5) come nei contenuti);
 * - la strada della Cripta: dalla piazza al castagno morto;
 * - la strada dei Ronchi: dalla piazza giù fino al guado del Sass, con i rami per il mulino, il ponte
 *   del Mulino e la passerella del Messo (il tratto dopo la passerella dipende dalla variante di E1:
 *   lo costruisce `mobili.ts`);
 * - i vicoli del nucleo (lavatoio, sagrato, Casa del Velo).
 * La Scorciatoia delle Terrazze è un elemento mobile (E4): la costruisce `mobili.ts`.
 */
import type { Contesto } from '../contesto';
import { luogo } from '../contenuti';
import { TRACCIATO_SCORCIATOIA } from '../mobili';
import { costruisciSentiero } from '../sentieri';
import type { PuntoCil } from '../terreno';

const P = (z: number, theta: number): PuntoCil => ({ z, theta });

/** Tornanti fra due quote di z, scendendo in theta da th0 a th1 in `n` tratti. */
export function tornanti(z0: number, zA: number, zB: number, th0: number, th1: number, n: number): PuntoCil[] {
  const out: PuntoCil[] = [P(z0, th0)];
  for (let i = 1; i <= n; i++) {
    const th = th0 + ((th1 - th0) * i) / n;
    out.push(P(i % 2 === 1 ? zA : zB, th));
  }
  return out;
}

export const TRACCIATI = {
  mulattiera: [
    P(1033, 35.4),
    P(1022, 34.6),
    ...tornanti(1022, 1000, 1026, 34.0, 26.6, 7).slice(1),
    P(1004, 25.6),
    // il tornante in piano sulla terrazza di sotto: a metà dell'alzata i due tratti si
    // sovrapponevano a quote diverse (un gradino di due metri in mezzo al nastro)
    P(1023, 25.0),
    P(1002, 24.0),
    P(976, 23.7),
    // l'ultimo tratto sale l'alzata accanto alla terrazza e ci entra in piano dall'angolo dove il
    // suolo è già alla quota del ripiano: sugli altri lati la terrazza sta su muri di 3,5-7 m
    P(967, 22.92),
    P(963, 22.85),
  ],
  cripta: [P(1060, 34.4), P(1074, 32.6), P(1088, 31.0), P(1100, 29.6), P(1108, 28.4), P(1112, 27.9)],
  ronchi: [P(1050, 40.0), P(1066, 41.0), P(1084, 42.0), P(1104, 43.0), P(1126, 44.2), P(1146, 45.0), P(1166, 45.6), P(1182, 47.6), P(1194, 49.4), P(1204, 50.0)],
  mulino: [P(1126, 44.2), P(1129, 47.4), P(1130, 49.6)],
  ponteMulino: [P(1104, 43.0), P(1102, 47.0), P(1100, 50.4), P(1100, 52.4)],
  oltrePonte: [P(1100, 55.4), P(1104, 58.5), P(1112, 61.0)],
  passerella: [P(1166, 45.6), P(1165, 48.4), P(1163.5, 50.4)],
  lavatoio: [P(1044, 38.6), P(1041, 39.2)],
  sagrato: [P(1053, 38.4), P(1056, 39.0)],
  casaVelo: [P(1056, 35.0), P(1066, 34.2)],
  monte: [P(1028, 37.4), P(1010, 38.0), P(990, 38.6), P(970, 39.0)],
} as const;

export function costruisciSentieri(ctx: Contesto): void {
  // la scorciatoia (E4, costruita da `mobili.ts` con le sue varianti) si registra per prima: i
  // muri delle terrazze le aprono il varco e i parapetti degli altri sentieri non la sbarrano
  ctx.sentieri.push({ nome: 'scorciatoia_terrazze', punti: [...TRACCIATO_SCORCIATOIA], larghezza: 1.1 });
  costruisciSentiero(ctx, 'sentieri:mulattiera', 'mulattiera_terrazze', [...TRACCIATI.mulattiera], { tipo: 'lastre', larghezza: 1.9, gradini: 'pietra', luogo: 'mulattiera_terrazze' });
  costruisciSentiero(ctx, 'sentieri:cripta', 'strada_cripta', [...TRACCIATI.cripta], { tipo: 'battuto', larghezza: 1.7, gradini: 'pietra' });
  costruisciSentiero(ctx, 'sentieri:ronchi', 'strada_ronchi', [...TRACCIATI.ronchi], { tipo: 'battuto', larghezza: 1.8, gradini: 'pietra', luogo: 'i_ronchi' });
  costruisciSentiero(ctx, 'sentieri:ronchi', 'strada_mulino', [...TRACCIATI.mulino], { tipo: 'battuto', larghezza: 1.4, gradini: 'pietra', luogo: 'mulino' });
  costruisciSentiero(ctx, 'sentieri:ronchi', 'strada_ponte', [...TRACCIATI.ponteMulino], { tipo: 'battuto', larghezza: 1.4, gradini: 'pietra', luogo: 'ponte_mulino' });
  costruisciSentiero(ctx, 'sentieri:ronchi', 'oltre_ponte', [...TRACCIATI.oltrePonte], { tipo: 'battuto', larghezza: 1.3, gradini: 'pietra' });
  costruisciSentiero(ctx, 'sentieri:ronchi', 'verso_passerella', [...TRACCIATI.passerella], { tipo: 'battuto', larghezza: 1.3, gradini: 'pietra', luogo: 'passerella_messo' });
  costruisciSentiero(ctx, 'sentieri:nucleo', 'vicolo_lavatoio', [...TRACCIATI.lavatoio], { tipo: 'lastre', larghezza: 2.2, gradini: 'pietra', luogo: 'lavatoio' });
  costruisciSentiero(ctx, 'sentieri:nucleo', 'vicolo_casa_velo', [...TRACCIATI.casaVelo], { tipo: 'lastre', larghezza: 2.0, gradini: 'pietra', luogo: 'casa_del_velo' });
  costruisciSentiero(ctx, 'sentieri:nucleo', 'strada_monte', [...TRACCIATI.monte], { tipo: 'battuto', larghezza: 2.0, gradini: 'pietra' });
  // punti di passaggio dei contenuti
  const m = luogo('mulattiera_terrazze');
  ctx.punto('sentiero:mulattiera', 'guarda', 'Mulattiera delle Terrazze', ctx.qui(m.z, m.theta, 0.2), { raggio: m.raggio, luogo: m.id, attivo: false });
}
