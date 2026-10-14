/**
 * Riprendi da qui (ARCHITETTURA 5.4 `rewind.ts`, GDD 8.2): la storia torna alla sera di
 * una giornata già giocata. Si ripristina `snapshots[levelId]` (flag, memoria, battute
 * mostrate), la storia delle giornate successive si cancella, la conoscenza (`Knowledge`:
 * stranezze, desideri, domande, Archivio, lettere), gli epiloghi visti e i merletti già
 * trovati per Ripassa restano. La macchina a stati vive in `flow.ts`; qui c'è il punto
 * d'ingresso documentato, usato dal controller e dal Telaio.
 */
export { rewindTo, snapshotOf } from './flow';
