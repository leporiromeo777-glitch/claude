/**
 * Tutti i parametri regolabili del giocatore e del Velo in un unico posto.
 * Le unità sono SI (m, s, m/s, m/s^2) salvo dove indicato.
 */
export const PLAYER_TUNABLES = {
  /** Raggio del cilindro di collisione del corpo (m). */
  radius: 0.35,
  /** Altezza del corpo (m). */
  height: 1.75,
  /** Altezza degli occhi sopra i piedi (m). */
  eyeHeight: 1.62,
  /** Velocità al passo e di corsa (m/s). */
  walkSpeed: 4.2,
  runSpeed: 7.2,
  /** Accelerazione a terra e in aria verso la velocità desiderata (m/s^2). */
  groundAccel: 40,
  airAccel: 4,
  /** Velocità verticale del salto (m/s): ~1.3 m di salto a 1 g. */
  jumpSpeed: 5.0,
  /** Gradino superabile senza saltare (m). */
  stepHeight: 0.5,
  /** Pendenza massima percorribile (gradi). */
  slopeLimitDeg: 47,
  /** Distanza di "aggancio" al suolo quando si scende (m). */
  groundSnap: 0.4,
  /** Coriolis applicato al corpo a piedi e nei salti (0.4 = 40%, il valore del concept). */
  coriolisOnFoot: 0.4,
  /** Resistenza dell'aria sul corpo: a = -k |v| v (velocità limite ~53 m/s a 1 g). */
  bodyDrag: 0.0035,
  /** Velocità di impatto oltre la quale l'atterraggio è "duro" (evento, nessun danno per ora). */
  hardLandingSpeed: 11,
};

export const VELO_TUNABLES = {
  /** 0.5 * rho * S / m (1/m): portanza e resistenza = k * v^2 * C. */
  aeroK: 0.052,
  /** Coefficiente di portanza a incidenza nulla e pendenza (1/rad). */
  cl0: 0.35,
  clAlpha: 4.2,
  clMax: 1.25,
  clMin: -0.35,
  /** Incidenza di stallo (gradi): oltre, la portanza cala. */
  stallDeg: 20,
  /** Resistenza: cd = cd0 + kInduced * cl^2. */
  cd0: 0.075,
  kInduced: 0.07,
  /** Virata: quanto la traiettoria orizzontale segue lo sguardo (1/s). */
  turnRate: 0.9,
  /** Il Velo si apre solo sopra questa quota dal suolo (m). */
  minOpenHeight: 1.0,
  /** Tempo di apertura/chiusura dell'ala (s), solo visivo. */
  openTime: 0.35,
  /** Coriolis sulle planate: fisica vera. */
  coriolis: 1.0,
  /**
   * Correnti calde della Linea: vento verso l'asse (m/s) nella fascia di quota
   * [thermalFrom, thermalTo]. Da circa 0.3 g in su portano il Velo fin quasi
   * all'asse; chiudendo il Velo lì si "cade" nella valle opposta, e lo si riapre
   * sotto la fascia per planare e atterrare (tecnica provata in tests/player.test.ts).
   */
  thermalSpeed: 2.6,
  thermalFrom: 400,
  thermalFull: 450,
  thermalTo: 645,
  /** Velocità di rollio della camera quando il "giù" si capovolge (s, costante di tempo). */
  flipRollTau: 1.1,
  /** Resistenza (stamina): per ora nessuna. Lasciato come aggancio. */
  stamina: null as null | { max: number; drainPerSecond: number },
};

export type PlayerTunables = typeof PLAYER_TUNABLES;
export type VeloTunables = typeof VELO_TUNABLES;
