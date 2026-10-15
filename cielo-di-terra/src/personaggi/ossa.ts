/**
 * Lo scheletro dei personaggi generati (tools/personaggi/processa.py): 17 ossa, nomi in italiano,
 * S = sinistra del personaggio (+X del modello), D = destra (-X). Il modello guarda +Z, Y in alto,
 * i piedi a y = 0, come gli abitanti procedurali della libreria.
 */
export const NOMI_OSSA = [
  'bacino',
  'schiena',
  'petto',
  'collo',
  'testa',
  'braccioS',
  'avambraccioS',
  'manoS',
  'braccioD',
  'avambraccioD',
  'manoD',
  'cosciaS',
  'stincoS',
  'piedeS',
  'cosciaD',
  'stincoD',
  'piedeD',
] as const;

export type NomeOsso = (typeof NOMI_OSSA)[number];

/** Il padre di ogni osso (null per la radice). */
export const PADRE: Record<NomeOsso, NomeOsso | null> = {
  bacino: null,
  schiena: 'bacino',
  petto: 'schiena',
  collo: 'petto',
  testa: 'collo',
  braccioS: 'petto',
  avambraccioS: 'braccioS',
  manoS: 'avambraccioS',
  braccioD: 'petto',
  avambraccioD: 'braccioD',
  manoD: 'avambraccioD',
  cosciaS: 'bacino',
  stincoS: 'cosciaS',
  piedeS: 'stincoS',
  cosciaD: 'bacino',
  stincoD: 'cosciaD',
  piedeD: 'stincoD',
};
