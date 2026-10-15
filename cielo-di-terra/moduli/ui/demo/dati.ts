/**
 * Dati d'esempio della demo. Quando esiste `demo/contenuti.json` (copiato da content/ con
 * `npm run importa-contenuti`), i testi veri lo sostituiscono; altrimenti si usano questi,
 * presi dal concept (mix-finale.json) e dal GDD.
 */
import type {
  BattutaDialogo,
  Carta,
  DatiPianta,
  DatiTaccuino,
  GrigliaPianta,
  ParticellaPianta,
  VoceStorico,
} from '../src/index';

export const BATTUTA_OTTAVIO: BattutaDialogo = {
  chi: 'Ottavio, detto Ventin',
  aspetto: 'velo da corsa verde legato alla fronte, il Velo aperto sulle spalle',
  testo:
    'Se lo sono prese le Fade: non era benedetto. Il sentiero di ieri, dico. Qui quello che nessuno ha misurato, la notte lo rimettono come sta scritto sulla Carta. Voi Giardinieri lo sapete, no?',
  risposte: [
    { testo: 'Chi l’ha scritta, la Carta?' },
    { testo: 'E chi decide che cosa è benedetto?' },
    { testo: 'Mostrami il chiodo d’ottone della terrazza.', disabilitata: true, nota: 'serve il libretto' },
    { testo: 'Portami al fienile. Ci penso domattina.', giaDetta: true },
  ],
};

export const STORICO_ESEMPIO: VoceStorico[] = [
  { chi: 'una velata', testo: 'La Svegliata. Guardate le mani: le stesse della Santa.', elvira: false },
  { chi: 'Elvira', testo: 'Sono una giardiniera, non una santa. Dov’è il riale?', elvira: true },
  { chi: 'Ottavio, detto Ventin', testo: 'A Mane del mulino. Venite, prima che la Linea si faccia brace.', elvira: false },
  { chi: 'Elvira', testo: 'A Mane. Va bene: nel verso della rotazione.', elvira: true },
];

export const LETTERA_MARTA: Carta = {
  id: 'lettera-marta',
  tipo: 'lettera',
  titolo: 'Lettera di Marta',
  pagine: [
    {
      data: 'dalla Sorella',
      testo:
        'Mamma, ti scrivo dalla Sorella.\n\nPapà e io dormiamo a turno e vi seguiamo. Quando arriveremo ti racconterò tutto.\n\nTieni ancora la stella alpina che ti ho dato?\n\nFidati della Madre, non guardare indietro.',
      firma: 'Marta',
    },
  ],
};

export const LIBRETTO_AURELIO: Carta = {
  id: 'libretto-aurelio',
  tipo: 'libretto',
  titolo: 'Libretto di rilievo di Aurelio Respini',
  pagine: [
    {
      intestazione: 'Pilastro 1 · San Vigilio',
      testo: 'Sulla cella campanaria, lato a Mane. Targa del 2120, palina bianca e rossa alta otto metri: si legge da tutto il cielo.',
      tabella: [
        ['z', '1062 m'],
        ['θ', '37° 12′'],
        ['h', '62,5 m'],
        ['vede', 'P 6 · ch. 3, 7, 37'],
      ],
      margine: 'Per te, El: da quassù la valle sembra il nostro orto. — A.',
    },
    {
      intestazione: 'Chiodo 37 · Grà di Pian',
      testo: 'Murato nel muro a secco della grà, a un palmo dalla porta. Guarda il Pilastro 6 a Mane. Accanto un castagno giovane: se cresce, coprirà la mira.',
      tabella: [
        ['z', '890 m'],
        ['θ', '17° 30′'],
        ['vede', 'P 1 · P 6'],
      ],
      margine: 'Il castagno non c’è più. Al suo posto, una casa.',
    },
    {
      intestazione: 'Pilastro 6 · Sass Grand',
      testo: 'Sulla cresta, sopra la Finestra dei Ponti. Disco bianco. Di notte, con la Meta, fa ombra lunga sul prato.',
      tabella: [
        ['z', '1190 m'],
        ['θ', '74° 00′'],
        ['vede', 'P 1 · P 12 · ch. 37'],
      ],
    },
    {
      intestazione: 'Monte Vettore, 2084',
      testo: 'Caposaldo di prova, da studente. Nebbia.\n\nIl sentiero di ieri oggi non c’era. Rimisurare.',
    },
  ],
};

export const CARTELLINO_MARZE: Carta = {
  id: 'cartellino-marze',
  tipo: 'cartellino',
  titolo: 'Cartellino di zinco, Terrazza Pedrazzini',
  pagine: [{ intestazione: 'Castagno · 2119', testo: 'Marze: selva Pedrazzini, Cevio.', firma: 'E. P.' }],
};

export const LETTERA_S: Carta = {
  id: 'lettera-s-1',
  tipo: 'dattiloscritto',
  titolo: 'Foglio battuto a macchina, firmato «S.»',
  pagine: [
    {
      intestazione: 'STAMPANTE DI SERVIZIO 4',
      testo:
        'Giardiniera,\n\nnon fidarti delle campane: contale. Alle sei, all’una e alle otto suonano per qualcosa che non è una messa.\n\nQuando la bolla ti trema sotto l’occhio, non è la tua mano. Chiedi chi sta girando l’asse.',
      firma: 'S.',
    },
  ],
};

export const TACCUINO: DatiTaccuino = {
  prossimoEvento: 'Meta fra 34 s · brace alle 19:30',
  piste: [
    {
      id: 'lettera',
      domanda: 'Chi ha scritto la lettera di Marta?',
      indizi: [
        { id: 'l1', testo: 'Sul vetro, a matita: «Non fidarti delle campane». Mano tecnica, minuta. Non è la sua.', fonte: 'Capsula 5, Cripta' },
        { id: 'l2', testo: 'Stella alpina? Le diedi un martagone. Aveva nove anni, avrà dimenticato.', fonte: 'rileggendo la lettera', mano: 'madre' },
        { id: 'l3', testo: 'La busta è di carta grezza, fibra corta: [[cotone|castagno]].', fonte: 'lente dell’erbario', nuovo: true },
      ],
    },
    {
      id: 'sentiero',
      domanda: 'Perché il sentiero di ieri non c’è più?',
      indizi: [
        { id: 's1', testo: '«Se lo sono prese le Fade: non era benedetto.»', fonte: 'Ottavio, al fienile' },
        { id: 's2', testo: 'Il sentiero rilevato fra due chiodi d’ottone, invece, stamattina c’era.', fonte: 'Terrazza Pedrazzini', nuovo: true },
      ],
    },
    {
      id: 'meta',
      domanda: 'Perché la Meta fa ombra?',
      indizi: [
        { id: 'm1', testo: 'Una stella non fa ombra. Non a otto anni luce.', fonte: 'Piazza delle Ore, a mezzogiorno' },
        { id: 'm2', testo: 'Se la Sorella è il Verbano II, Marta è lassù.', fonte: 'la notte, dal fienile', mano: 'madre' },
      ],
    },
    {
      id: 'pilastro4',
      domanda: 'Chi ha spostato il Pilastro 4?',
      nuova: true,
      indizi: [{ id: 'p1', testo: 'Sta tre metri più in là di dove lo vuole la Carta.', fonte: 'libretto di Aurelio, Pilastro 4', nuovo: true }],
    },
    {
      id: 'dormire',
      domanda: 'Dove dormo stanotte?',
      chiusa: true,
      risposta: 'Nel fienile di Ottavio, sul Sass dal Messo.',
      indizi: [{ id: 'd1', testo: 'Ottavio ha un fienile dopo il mulino.', fonte: 'Ottavio' }],
    },
  ],
  parole: [
    { tecnica: 'filamento solare', locale: 'la Linea' },
    { tecnica: 'stella di rotta', locale: 'la Meta' },
    { tecnica: 'nel verso della rotazione', locale: 'a Mane' },
    { tecnica: 'contro la rotazione', locale: 'a Sera' },
    { tecnica: 'verso l’asse', locale: 'in su' },
    { tecnica: 'asse', locale: 'il Fuso' },
    { tecnica: 'droni di manutenzione', locale: 'le Fade', nota: 'hanno un lume; ballano in cerchio sui prati', nuova: true },
    { tecnica: 'catasto', locale: 'la Carta' },
  ],
  note: [{ id: 'n1', testo: 'Una stella non fa ombra. Non a otto anni luce.' }],
  proverbi: [
    {
      dialetto: 'Ul castan da Cevi l\u2019è ancamò in fiur. Va tegnum la val.',
      italiano: 'Il castagno di Cevio è ancora in fiore. Tienimi la valle.',
      nota: 'Marta mi disse «tienimi la valle». Lo dicono tutti, in Valmaggia.',
    },
    { italiano: 'Ciò che la Giardiniera ha misurato, la notte non lo tocca.', fonte: 'in piazza', nuovo: true },
    { italiano: 'La pietra misurata vale più della penna.', nota: 'Per cancellare una misura bisogna spostare il caposaldo?' },
  ],
  leggende: [
    { id: 'o1', fonte: 'L\u2019Ombrista, prima sera', testo: '«…e la Sorella partì con loro, e non li lasciò mai.»' },
    { id: 'o2', fonte: 'L\u2019Ombrista, seconda sera', testo: '«…e la Santa salì nella Linea, e lasciò i guanti dove le api dormono.»', nuova: true },
  ],
  respiri: [],
};

// ---------- Pianta ----------

const NZ = 75;
const NT = 96;

/** Griglia d'esempio: Selve a matita (il disegno di Elvira del 2119), Corbella rilevata, il lago appeso in giada. */
export function grigliaEsempio(): GrigliaPianta {
  const stati = new Uint8Array(NZ * NT);
  const salute = new Uint8Array(NZ * NT);
  const terreno = new Uint8Array(NZ * NT);
  const cambiate = new Uint8Array(NZ * NT);
  const dz = 3000 / NZ;
  const dt = 360 / NT;
  const rumore = (a: number, b: number): number => {
    const x = Math.sin(a * 12.9898 + b * 78.233) * 43758.5453;
    return x - Math.floor(x);
  };
  for (let iz = 0; iz < NZ; iz++) {
    for (let it = 0; it < NT; it++) {
      const z = (iz + 0.5) * dz;
      const t = (it + 0.5) * dt;
      const i = iz * NT + it;
      const r = rumore(iz, it);
      // Lago del Verbanetto: ellisse z 720-2480, θ 141-191.
      const lz = (z - 1600) / 880;
      const lt = (t - 166) / 25;
      if (lz * lz + lt * lt < 1) terreno[i] = 1;
      // Corbella: abitato.
      if (z > 980 && z < 1140 && t > 30 && t < 46) terreno[i] = 3;
      // Selve (valle 1, versante a Sera): a matita.
      if (t < 50 && z > 520 && z < 1650 + 300 * Math.sin(t / 9)) stati[i] = 1;
      // Corbella e dintorni: rilevati, a chiazze verso l'esterno.
      const dC = Math.hypot((z - 1060) / 210, (t - 36) / 17);
      if (dC < 1 + (r - 0.5) * 0.35) {
        stati[i] = 2;
        salute[i] = r < 0.18 ? 2 : r > 0.93 ? 3 : 1;
      }
      // Terrazza Pedrazzini e la Cripta: rilevate.
      if (Math.hypot((z - 950) / 70, (t - 23) / 6) < 1) {
        stati[i] = 2;
        salute[i] = 1;
      }
      if (Math.hypot((z - 1112) / 60, (t - 27) / 5) < 1) {
        stati[i] = 2;
        salute[i] = 1;
      }
      // Versante a Mane fino al Sass Grand: visto.
      if (t > 50 && t < 88 && z > 900 && z < 1500 && stati[i] === 0) stati[i] = 1;
      // Fumo bruno nelle Selve alte, appuntato con lo squadro.
      if (Math.hypot((z - 720) / 90, (t - 12) / 8) < 1 && stati[i] < 1) stati[i] = 1;
      // Il lago appeso, visto dall'alto: a matita.
      if (terreno[i] === 1 && z > 900 && z < 2000 && r > 0.06) stati[i] = Math.max(stati[i]!, 1);
      // Torre dei Bugni e riva: un pezzo rilevato attraverso il cielo.
      if (Math.hypot((z - 1500) / 90, (t - 197) / 7) < 1) {
        stati[i] = 2;
        salute[i] = 1;
      }
      // La scorciatoia delle Terrazze: tornata alla Carta stanotte.
      if (z > 1140 && z < 1240 && t > 22 && t < 30) {
        stati[i] = 1;
        cambiate[i] = 1;
      }
    }
  }
  return { nZ: NZ, nTheta: NT, stati, salute, terreno, cambiate };
}

const PARTICELLE: ParticellaPianta[] = [
  { id: 'terrazza-pedrazzini', nome: 'Terrazza Pedrazzini', z0: 900, z1: 1000, theta0: 19, theta1: 27, stato: 'rilevato', salute: 'verde' },
  { id: 'passerella-messo', nome: 'Passerella del Messo', z0: 1150, z1: 1200, theta0: 55, theta1: 61, stato: 'rilevato', salute: 'verde' },
  { id: 'scorciatoia-terrazze', nome: 'Scorciatoia delle Terrazze', z0: 1140, z1: 1240, theta0: 22, theta1: 30, stato: 'matita', cambiata: true },
  { id: 'casa-nando', nome: 'Casa di Nando, ai Ronchi', z0: 1150, z1: 1200, theta0: 42, theta1: 48, stato: 'rilevato', salute: 'bruno' },
];

export const PIANTA: DatiPianta = {
  griglia: grigliaEsempio(),
  particelle: PARTICELLE,
  totaleParticelle: NZ * NT,
  capisaldi: [
    { id: 'p1', numero: 1, tipo: 'pilastro', z: 1062, theta: 37.2, rilevato: true, nome: 'San Vigilio' },
    { id: 'p6', numero: 6, tipo: 'pilastro', z: 1190, theta: 74, rilevato: true, nome: 'Sass Grand' },
    { id: 'p4', numero: 4, tipo: 'pilastro', z: 800, theta: 9, rilevato: false, visto: true, nome: 'Pian dei Ricci' },
    { id: 'p14', numero: 14, tipo: 'pilastro', z: 1500, theta: 197, rilevato: true, nome: 'Torre dei Bugni' },
    { id: 'c3', numero: 3, tipo: 'chiodo', z: 948, theta: 23, rilevato: true },
    { id: 'c7', numero: 7, tipo: 'chiodo', z: 1130, theta: 51, rilevato: true },
    { id: 'c8', numero: 8, tipo: 'chiodo', z: 1176, theta: 58.5, rilevato: false, visto: true },
    { id: 'c37', numero: 37, tipo: 'chiodo', z: 890, theta: 17.5, rilevato: false, visto: true },
  ],
  lati: [
    { da: 'p1', a: 'c3' },
    { da: 'p1', a: 'c7' },
    { da: 'p1', a: 'p6' },
    { da: 'c7', a: 'p6' },
  ],
  luoghi: [
    { nome: 'Corbella', z: 1010, theta: 40 },
    { nome: 'Cripta', z: 1112, theta: 27 },
    { nome: 'Terrazza Pedrazzini', z: 948, theta: 21 },
    { nome: 'Mulino', z: 1130, theta: 53 },
    { nome: 'Fienile di Ottavio', z: 1176, theta: 61 },
    { nome: 'Grà di Pian', z: 890, theta: 15.5 },
    { nome: 'Torre dei Bugni', z: 1500, theta: 201 },
  ],
  elvira: { z: 1046, theta: 37, direzione: 40 },
  resoconto: {
    righe: ['Scorciatoia delle Terrazze: non misurata, tornata alla Carta.', 'Casa di Nando: rilevata, è rimasta.'],
    prossimaFinestra: 'Prossima Meta fra 34 s · brace alle 19:30',
  },
};
