/**
 * Dati del GDD che i contenuti della Fase 1 non contengono ancora, copiati qui come
 * valori di partenza per le fasi successive:
 *
 * - i pilastri della rete di Aurelio (GDD §2.6, Z7) con le loro coordinate;
 * - i sei triangoli attraverso il cielo (GDD §5.6);
 * - le dodici mosse della Madre (GDD §3.4.5);
 * - il catalogo dei 40 elementi mobili e delle 30 ancore della Penna (GDD §3.4.3, §3.4.7, appendice B).
 *
 * I contenuti (`content/*.json`) hanno sempre la precedenza: questi dati riempiono solo i buchi.
 */
import type { Atto, DefMossa } from './tipi';

export interface PilastroGdd {
  numero: number;
  nome: string;
  z: number;
  theta: number;
  altezza: number;
  zona: string;
  /** I pilastri del Sordo sono stati divelti nel 2266: restano i fori nella roccia. */
  divelto?: boolean;
}

/** GDD §2.6 e Z7. Il Caposaldo Zero sta sulla soglia della Lanterna, sull'asse (θ convenzionale 0). */
export const PILASTRI_GDD: readonly PilastroGdd[] = [
  { numero: 1, nome: 'San Vigilio, sulla cella campanaria', z: 1062, theta: 37.2, altezza: 62.5, zona: 'Corbella' },
  { numero: 4, nome: 'Pian dei Ricci', z: 800, theta: 9.0, altezza: 90, zona: 'Selve alte' },
  { numero: 6, nome: 'Sass Grand', z: 1190, theta: 74.0, altezza: 42, zona: 'Corbella, versante a Mane' },
  { numero: 9, nome: 'Fondo del Verbanetto (sommerso)', z: 2300, theta: 170, altezza: 2, zona: 'Fondale' },
  { numero: 12, nome: 'Ponte di Mezzo', z: 1500, theta: 105, altezza: 8, zona: 'Finestra dei Ponti' },
  { numero: 14, nome: 'Torre dei Bugni', z: 1500, theta: 197, altezza: 45, zona: 'Verbanetto' },
  { numero: 15, nome: "Serra dell'Isola Grande", z: 1760, theta: 173, altezza: 50, zona: 'Verbanetto' },
  { numero: 17, nome: "Faro dell'Isola dei Conigli", z: 1180, theta: 156, altezza: 34, zona: 'Verbanetto' },
  { numero: 19, nome: 'Vigne', z: 450, theta: 165, altezza: 60, zona: 'Verbanetto, lobo del Tappo' },
  { numero: 21, nome: 'Corte di Mezzo', z: 245, theta: 285, altezza: 258, zona: 'Alpe' },
  { numero: 23, nome: "Croce d'alpe", z: 420, theta: 312, altezza: 92, zona: 'Alpe' },
  { numero: 26, nome: 'Campanile di Sambüch', z: 680, theta: 255, altezza: 47, zona: 'Alpeggi' },
  { numero: 28, nome: 'Rascane Grandi', z: 1600, theta: 285, altezza: 12, zona: 'Pian dal Fen' },
  { numero: 31, nome: 'Sassi Neri', z: 2660, theta: 300, altezza: 32, zona: 'piede del Sordo' },
  { numero: 33, nome: 'Ponte Cieco', z: 1500, theta: 225, altezza: 8, zona: 'Finestra Cieca' },
  { numero: 35, nome: 'Nicchia delle Vedove', z: 1300, theta: 345, altezza: 8, zona: 'Finestra delle Vedove' },
  { numero: 40, nome: "Sant'Anna", z: 2000, theta: 45, altezza: 20, zona: "Piana di Sant'Anna" },
  { numero: 42, nome: 'Balcone dei Messi', z: 110, theta: 30, altezza: 452, zona: 'lobo del Tappo Sud' },
  { numero: 44, nome: 'Bocca delle Fade', z: 1520, theta: 70, altezza: 18, zona: 'Valle 1' },
  { numero: 48, nome: 'Riva Alta', z: 1500, theta: 139, altezza: 26, zona: 'Verbanetto' },
  { numero: 50, nome: 'Bosch Négru', z: 2450, theta: 270, altezza: 10, zona: 'Alpeggi' },
  { numero: 210, nome: 'Pilastro divelto del Sordo', z: 2715, theta: 45, altezza: 150, zona: 'Sordo', divelto: true },
  { numero: 211, nome: 'Pilastro divelto del Sordo', z: 2790, theta: 165, altezza: 320, zona: 'Sordo', divelto: true },
  { numero: 212, nome: 'Pilastro divelto del Sordo', z: 2915, theta: 285, altezza: 500, zona: 'Sordo', divelto: true },
];

export interface TriangoloGdd {
  id: string;
  nome: string;
  missione: string;
  tipo: 'cielo' | 'stazione_libera';
  vertici: string[];
  stazione: string | null;
  cheCosaRileva: string;
}

/** GDD §5.6: i sei triangoli attraverso il cielo. Le particelle di trama non sono ancora scritte. */
export const TRIANGOLI_GDD: readonly TriangoloGdd[] = [
  { id: 'T1', nome: 'del Ponte', missione: 'M4', tipo: 'cielo', vertici: ['cs_1', 'cs_12', 'cs_14'], stazione: null, cheCosaRileva: 'il Ponte di Mezzo e la stazione della teleferica dei pellegrini' },
  { id: 'T2', nome: 'della Galleria', missione: 'M5', tipo: 'cielo', vertici: ['cs_44', 'cs_15', 'cs_28'], stazione: null, cheCosaRileva: 'la Bocca delle Fade: la via per la Galleria della Carta resta aperta' },
  { id: 'T3', nome: 'del Mozzo', missione: 'M6', tipo: 'cielo', vertici: ['cs_42', 'cs_19', 'cs_21'], stazione: null, cheCosaRileva: 'la scala del Mozzo Sud sul lobo del Tappo' },
  { id: 'T4', nome: 'delle Vedove', missione: 'M11', tipo: 'cielo', vertici: ['cs_35', 'cs_26', 'cs_6'], stazione: null, cheCosaRileva: 'la passerella delle Vedove per il ritorno della carovana' },
  { id: 'T5', nome: 'della parete', missione: 'M14', tipo: 'stazione_libera', vertici: ['cs_31', 'cs_14', 'cs_1'], stazione: null, cheCosaRileva: 'la via fatta il primo giorno' },
  { id: 'T6', nome: 'Zero', missione: 'M14', tipo: 'stazione_libera', vertici: ['cs_1', 'cs_15', 'cs_23'], stazione: 'cs_0', cheCosaRileva: 'la cengia della porta della Lanterna; il Sordo diventa colore' },
];

/** GDD §3.4.5: tetto delle mosse per atto. */
export const TETTO_MOSSE_PER_ATTO: Readonly<Record<Atto, number>> = { I: 2, II: 3, III: 2 };

/**
 * Le dodici mosse della Madre (GDD §3.4.5). Le condizioni usano gli atomi di
 * `condizioniMossa` (vedi notte.ts); i flag delle missioni (m08_completata…) sono segnaposti
 * che la narrativa deve accendere quando arrivano quelle fasi. I chiodi 141 e 203 non sono
 * ancora nei contenuti: finché mancano, le mosse A2 e A3 non spostano niente.
 */
export const MOSSE_GDD: readonly DefMossa[] = [
  {
    id: 'A1',
    atto: 'I',
    nome: 'La pietra che cammina',
    condizione: 'lato_con:cs_4',
    effetti: [{ tipo: 'sposta', capisaldi: [{ id: 'cs_4', metri: 3, direzione: 'Sera' }] }],
    annuncio: 'e di notte una pietra camminò verso Sera',
    deviataDalVelo: true,
    descrizione: 'Le guardie spostano il Pilastro 4 di 3 m a Sera (secondaria «I termini spostati»).',
  },
  {
    id: 'A2',
    atto: 'I',
    nome: 'Il chiodo della Bugnera',
    condizione: 'lato_con:cs_141 o flag:rilevato_bugni',
    effetti: [{ tipo: 'sposta', capisaldi: [{ id: 'cs_141', metri: 2, direzione: 'Sera' }] }],
    annuncio: 'e la Bugnera trovò la sua soglia più lontana',
    deviataDalVelo: true,
    descrizione: 'Il chiodo 141 spostato di 2 m: le arnie di Rosa tornano a matita.',
  },
  {
    id: 'A3',
    atto: 'I',
    nome: 'Il chiodo del Pian',
    condizione: 'lato_con:cs_203 o flag:rilevato_pian_dal_fen',
    effetti: [{ tipo: 'sposta', capisaldi: [{ id: 'cs_203', metri: 2, direzione: 'Mont' }] }],
    annuncio: 'e il fieno non sapeva più dove dormire',
    deviataDalVelo: true,
    descrizione: 'Il chiodo 203 spostato: un fienile dei Sordi torna a matita.',
  },
  {
    id: 'A4',
    atto: 'I',
    nome: 'La benedizione tolta',
    condizione: 'contatore:giorni_senza_velo>=3 e ancora:casa_nando',
    effetti: [{ tipo: 'cancella_scrittura', ancora: 'casa_nando' }],
    annuncio: 'e una casa fu dimenticata',
    deviataDalVelo: false,
    descrizione: 'La casa di Nando perde la «benedizione» provvisoria scritta da Elvira con la Penna.',
  },
  {
    id: 'B1',
    atto: 'II',
    nome: 'Il Tempo della Perla',
    condizione: 'flag:sera_della_svolta',
    effetti: [{ tipo: 'evento', nome: 'tempo_della_perla', testo: 'Bando: le Guardie del Velo pattugliano, Corbella si divide, la Finestra dei Ponti è vietata.' }],
    annuncio: "e l'occhio della Notte si aprì",
    deviataDalVelo: false,
    descrizione: 'Bando del Tempo della Perla.',
  },
  {
    id: 'B2',
    atto: 'II',
    nome: 'La Notte dei Termini',
    condizione: 'flag:notte_dopo_la_svolta',
    effetti: [{ tipo: 'sposta_scelti', quanti: 8, metri: 3, direzione: 'Sera' }],
    annuncio: 'domani la valle tornerà com\'era scritta',
    deviataDalVelo: true,
    descrizione: 'Le guardie spostano 8 chiodi di particelle rilevate da Elvira (missione 7).',
  },
  {
    id: 'B3',
    atto: 'II',
    nome: 'Lo smorzo degli Alpeggi',
    condizione: 'flag:m08_completata',
    effetti: [{ tipo: 'contatore', nome: 'gelo_alpeggi', delta: 1, max: 3 }],
    annuncio: "e la Linea si voltò dall'altra parte",
    deviataDalVelo: false,
    descrizione: 'La Linea si abbassa sopra gli Alpeggi: gelo, stadio 1-3 (missione 11).',
  },
  {
    id: 'B4',
    atto: 'II',
    nome: 'Smeriglio, primo stadio',
    condizione: 'flag:m09_completata',
    effetti: [{ tipo: 'contatore', nome: 'smeriglio', delta: 1, max: 4 }],
    annuncio: 'e la Notte chiuse un occhio',
    deviataDalVelo: false,
    descrizione: 'I Ragni smerigliano la Finestra Cieca: contatore 0 → 1.',
  },
  {
    id: 'B5',
    atto: 'II',
    nome: 'Smeriglio, secondo stadio',
    condizione: 'flag:m10_completata e mossa:B4',
    effetti: [{ tipo: 'contatore', nome: 'smeriglio', delta: 1, max: 4 }],
    annuncio: "e la Notte chiuse l'altro",
    deviataDalVelo: false,
    descrizione: 'Contatore dello smeriglio → 2.',
  },
  {
    id: 'C1',
    atto: 'III',
    nome: 'Il vetro lattiginoso',
    condizione: 'flag:m12_completata',
    effetti: [{ tipo: 'contatore', nome: 'smeriglio', delta: 2, max: 4 }],
    annuncio: 'e la Notte dormì',
    deviataDalVelo: false,
    descrizione: 'Contatore → 3-4: la Finestra Cieca diventa opaca, visibile da tutte le valli.',
  },
  {
    id: 'C2',
    atto: 'III',
    nome: 'La Finestra dei Ponti',
    condizione: 'mossa:C1',
    effetti: [
      { tipo: 'evento', nome: 'ragni_finestra_ponti', testo: 'I Ragni cominciano dalla Finestra dei Ponti.' },
      { tipo: 'contatore', nome: 'gelo_alpeggi', delta: 3, max: 3 },
    ],
    annuncio: 'e toccò al Ponte',
    deviataDalVelo: false,
    descrizione: 'I Ragni cominciano dalla Finestra dei Ponti; gli Alpeggi gelano del tutto.',
  },
  {
    id: 'C3',
    atto: 'III',
    nome: 'Il Silenzio delle campane',
    condizione: 'flag:parlato_meridiana_lanterna',
    effetti: [{ tipo: 'evento', nome: 'campane_tacciono', testo: 'La voce di Meridiana tolta ai campanili di Corbella per un giorno.' }],
    annuncio: 'e le campane tacquero',
    deviataDalVelo: false,
    descrizione: 'Se Elvira ha parlato con Meridiana dalla Lanterna aperta a metà.',
  },
];

export interface ElementoCatalogo {
  nome: string;
  zona: 'Corbella e le Selve' | 'Verbanetto' | 'Alpeggi' | 'Tappo Sud' | 'Finestre' | 'Guscio' | 'Sordo';
  trama: boolean;
  missione: string | null;
  varianti: string[];
  /** Ancore della Penna (variante Scritta). */
  ancore: number;
  /** Quanti elementi conta la voce (i tre fienili non benedetti, le tre nicchie riparate). */
  quanti: number;
  /** Id dell'elemento nei contenuti della Fase 1, se c'è. */
  idFase1?: string;
}

const C = (v: Partial<ElementoCatalogo> & Pick<ElementoCatalogo, 'nome' | 'zona'>): ElementoCatalogo => ({
  trama: false,
  missione: null,
  varianti: ['Carta', 'Abitata'],
  ancore: 0,
  quanti: 1,
  ...v,
});

/** GDD appendice B: i 14 elementi di trama e i 26 facoltativi. */
export const CATALOGO_ELEMENTI: readonly ElementoCatalogo[] = [
  C({ nome: 'Passerella del Messo', zona: 'Corbella e le Selve', trama: true, missione: 'M1', idFase1: 'E1' }),
  C({ nome: 'Scorciatoia delle Terrazze', zona: 'Corbella e le Selve', trama: true, missione: 'M1', idFase1: 'E4' }),
  C({ nome: 'Pontile della Riva Alta', zona: 'Verbanetto', trama: true, missione: 'M2', varianti: ['Carta', 'Abitata', 'Mietuta'] }),
  C({ nome: 'Scaletta della Cappella delle Voci', zona: 'Alpeggi', trama: true, missione: 'M3' }),
  C({ nome: 'Passerella della nicchia 7', zona: 'Finestre', trama: true, missione: 'M4' }),
  C({ nome: 'Casa di Nando', zona: 'Corbella e le Selve', trama: true, missione: 'M5', varianti: ['Carta', 'Smontata', 'Abitata', 'Scritta'], ancore: 1, idFase1: 'E2' }),
  C({ nome: 'Sentiero della Bocca delle Fade', zona: 'Corbella e le Selve', trama: true, missione: 'M5' }),
  C({ nome: 'Scala del Mozzo', zona: 'Tappo Sud', trama: true, missione: 'M6' }),
  C({ nome: 'Case dei pescatori della Riva Alta', zona: 'Verbanetto', trama: true, missione: 'M7', varianti: ['Carta', 'Abitata', 'Mietuta'] }),
  C({ nome: "Ingresso dell'Archivio", zona: 'Corbella e le Selve', trama: true, missione: 'M8' }),
  C({ nome: 'Banco ottico della serra', zona: 'Verbanetto', trama: true, missione: 'M9' }),
  C({ nome: 'Passerella delle Vedove', zona: 'Finestre', trama: true, missione: 'M11' }),
  C({ nome: 'Gradini della galleria della Canva', zona: 'Guscio', trama: true, missione: 'M12', varianti: ['Carta', 'Abitata', 'Scritta'], ancore: 3 }),
  C({ nome: 'Via della parete', zona: 'Sordo', trama: true, missione: 'M14', varianti: ['Carta', 'Abitata', 'Scritta'], ancore: 8 }),
  // facoltativi: Corbella e le Selve
  C({ nome: 'Muro di Ronco', zona: 'Corbella e le Selve', idFase1: 'E3' }),
  C({ nome: 'Orto dei Ronchi', zona: 'Corbella e le Selve' }),
  C({ nome: 'Scala del fienile alto', zona: 'Corbella e le Selve', varianti: ['Carta', 'Abitata', 'Scritta'], ancore: 2 }),
  C({ nome: 'Recinto delle capre', zona: 'Corbella e le Selve' }),
  C({ nome: 'Legnaia della grà di Pian', zona: 'Corbella e le Selve' }),
  C({ nome: 'Ponticello del Pian dei Ricci', zona: 'Corbella e le Selve', varianti: ['Carta', 'Abitata', 'Scritta'], ancore: 2 }),
  C({ nome: 'Capanno dei Messi sul Balcone', zona: 'Corbella e le Selve' }),
  // Verbanetto
  C({ nome: 'Casa di Agostina', zona: 'Verbanetto' }),
  C({ nome: 'Pergola delle Vigne', zona: 'Verbanetto', varianti: ['Carta', 'Abitata', 'Scritta'], ancore: 3 }),
  C({ nome: 'Barche tirate in secco', zona: 'Verbanetto' }),
  C({ nome: 'Scala della Torre dei Bugni', zona: 'Verbanetto', varianti: ['Carta', 'Abitata', 'Scritta'], ancore: 3 }),
  C({ nome: "Orto dell'Isola dei Conigli", zona: 'Verbanetto' }),
  C({ nome: 'Canneto tagliato', zona: 'Verbanetto' }),
  // Alpeggi
  C({ nome: 'Fienili non benedetti', zona: 'Alpeggi', quanti: 3 }),
  C({ nome: 'Rascane del Pian', zona: 'Alpeggi' }),
  C({ nome: 'Ometti della Strada della Salida', zona: 'Alpeggi' }),
  C({ nome: 'Covoni della Corte di Mezzo', zona: 'Alpeggi' }),
  C({ nome: 'Scaletta della Corte Alta', zona: 'Alpeggi', varianti: ['Carta', 'Abitata', 'Scritta'], ancore: 3 }),
  C({ nome: 'Recinto della Stalla dei Leggeri', zona: 'Alpeggi' }),
  C({ nome: 'Ponte della Gerra', zona: 'Alpeggi', varianti: ['Carta', 'Abitata', 'Scritta'], ancore: 3 }),
  // Finestre e Guscio
  C({ nome: 'Nicchie riparate', zona: 'Finestre', quanti: 3, varianti: ['Carta', 'Abitata', 'Scritta'], ancore: 2 }),
  C({ nome: 'Giaciglio di Gioann', zona: 'Guscio' }),
];
