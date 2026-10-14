/**
 * Contenuti di prova per validateContent: un piccolo mondo coerente (il prologo
 * del GDD 3.15 con un bigliettino, una voce di Taccuino, una battuta e la
 * campagna) più le chiavi italiane che cita.
 */
export function validFiles(): Record<string, unknown> {
  return structuredClone({
    './characters.json': [
      {
        id: 'teresa', nameKey: 'comune.pers.teresa.nome', roleKey: 'comune.pers.teresa.ruolo', color: '#2F5DA8',
        pattern: 'righe', icon: 'busta', noteHz: 440, voice: { pitch: 260, rate: 11, formantShift: 0, noise: 0 },
        hand: { font: 'caveat', ink: '#24407A', paper: '#DCE6EE', slantDeg: -2, sizeScale: 1 },
        quirks: ['teresaLegge'], desireKey: 'comune.pers.teresa.desiderio', likes: ['festa', 'messa'],
      },
      {
        id: 'marta', nameKey: 'comune.pers.marta.nome', roleKey: 'comune.pers.marta.ruolo', color: '#C0442C',
        pattern: 'puntini', icon: 'pagnotta', noteHz: 293.66, voice: null, hand: null, quirks: ['martaNoSotto'], likes: ['messa', 'pane'],
      },
      {
        id: 'piero', nameKey: 'comune.pers.piero.nome', roleKey: 'comune.pers.piero.ruolo', color: '#6E3D96',
        pattern: 'doppio', icon: 'croce', noteHz: 146.83, voice: null, hand: null, quirks: ['pieroPozzo'], likes: ['messa'],
      },
    ],
    './places.json': [
      { id: 'forno', nameKey: 'comune.luoghi.forno', shortKey: 'comune.luoghi.fornoBreve', icon: 'pagnotta', diorama: 'dio/forno' },
      { id: 'piazza', nameKey: 'comune.luoghi.piazza', shortKey: 'comune.luoghi.piazzaBreve', icon: 'pozzo', diorama: 'dio/piazza' },
      { id: 'chiesa', nameKey: 'comune.luoghi.chiesa', shortKey: 'comune.luoghi.chiesaBreve', icon: 'campanile', diorama: 'dio/chiesa' },
    ],
    './levels/g00.json': {
      id: 'g00', kind: 'storia', act: 0, titleKey: 'atto1.g00.titolo',
      columns: ['forno', 'piazza', 'chiesa'], startHour: 5, endHour: 9,
      threads: [
        { id: 'teresa', kind: 'persona', character: 'teresa' },
        { id: 'marta', kind: 'persona', character: 'marta' },
        { id: 'piero', kind: 'persona', character: 'piero' },
      ],
      initial: ['teresa', 'marta', 'piero'],
      beads: [{ id: 'L1', type: 'lettera', holder: 'teresa', to: 'piero', labelKey: 'atto1.g00.perline.L1' }],
      rules: ['incrocio', 'spillo', 'lettera'],
      quirks: ['martaNoSotto', 'teresaLegge', 'pieroPozzo'],
      pins: [
        { thread: 'marta', place: 'forno', hour: 6 },
        { thread: 'teresa', place: 'forno', hour: 9 },
        { thread: 'piero', place: 'chiesa', hour: 9 },
      ],
      goals: [{ t: 'consegnata', bead: 'L1', by: 9 }, { t: 'nonHa', who: 'marta', bead: 'letta:L1' }],
      notes: ['g00.marta'],
      matassa: 6,
      dawn: {
        candidates: [
          {
            id: 'g00.alba.marta', priority: 100, background: 'dio/forno/alba',
            figures: [{ character: 'marta', pose: 'porge', x: 0.5 }],
            lines: [{ speaker: 'marta', textKey: 'atto1.g00.alba.marta' }],
          },
        ],
      },
      hintKeys: { spinta: 'atto1.g00.hint.spinta' },
      tutorial: [
        { k: 'mano', hour: 6, pair: 0, over: 'R' },
        { k: 'pulsa', target: 'fissa', hour: 6 },
        { k: 'margine', when: 'versoSbagliato', textKey: 'atto1.g00.margine.sopraDa', hour: 7 },
      ],
    },
    './levels/g00.computed.json': {
      levelId: 'g00', sourceHash: 'abc', solverVersion: 1,
      base: { incroci: 4, rows: [] }, perNote: {}, combos: [], matassaSuggerita: 7, quieteMax: 0,
    },
    './notes.atto1.json': [
      {
        id: 'g00.marta', day: 'g00', author: 'marta', textKey: 'atto1.g00.marta.testo',
        request: { t: 'presso', who: 'marta', place: 'forno', hour: 6 },
        replies: [{ id: 'R1', textKey: 'atto1.g00.marta.r1', effects: [{ setFlag: 'risposta:g00.marta', value: 'R1' }] }],
        onOk: [{ diary: 'persone.marta.noSotto' }, { desire: 'marta' }],
      },
    ],
    './diary.atto1.json': [
      {
        id: 'persone.marta.noSotto', section: 'persone', character: 'marta', textKey: 'atto1.diario.marta.noSotto',
        source: 'visto', unlock: { knows: 'quirk', id: 'martaNoSotto' },
      },
    ],
    './lines.json': [
      { id: 'marta.nodo.teresa.1', character: 'marta', event: 'nodo', with: 'teresa', textKey: 'comune.battute.marta.nodo.1', priority: 10 },
    ],
    './lettere.atto1.json': [{ id: 'L.1', arrivesAfter: 'g00', textKey: 'atto1.lettere.1', signed: 'L.' }],
    './book.json': [
      { id: 'incrocio', rule: 'incrocio', titleKey: 'comune.libro.incrocio.titolo', textKey: 'comune.libro.incrocio.testo', unlock: { done: 'g00' } },
    ],
    './campaign.json': {
      choiceDay: 'g00',
      finals: { merlettaia: 'g00', seppia: 'g00', chiuso: 'g00', aperto: 'g00' },
      days: [{ id: 'g00', act: 0, pins: 0, stonatura: 1, objectAfter: 'merletto_avorio' }],
    },
    './credits.json': { authorKey: 'comune.crediti.autore', lines: [{ key: 'comune.crediti.riga1' }] },
  });
}

/** Tutte le chiavi italiane citate da validFiles(). */
export const VALID_KEYS = new Set([
  'comune.pers.teresa.nome', 'comune.pers.teresa.ruolo', 'comune.pers.teresa.desiderio',
  'comune.pers.marta.nome', 'comune.pers.marta.ruolo', 'comune.pers.piero.nome', 'comune.pers.piero.ruolo',
  'comune.luoghi.forno', 'comune.luoghi.fornoBreve', 'comune.luoghi.piazza', 'comune.luoghi.piazzaBreve',
  'comune.luoghi.chiesa', 'comune.luoghi.chiesaBreve',
  'atto1.g00.titolo', 'atto1.g00.perline.L1', 'atto1.g00.alba.marta', 'atto1.g00.hint.spinta', 'atto1.g00.margine.sopraDa',
  'atto1.g00.marta.testo', 'atto1.g00.marta.r1', 'atto1.diario.marta.noSotto', 'comune.battute.marta.nodo.1',
  'atto1.lettere.1', 'comune.libro.incrocio.titolo', 'comune.libro.incrocio.testo',
  'comune.crediti.autore', 'comune.crediti.riga1',
]);

/** Chiavi in più per le forme della revisione 1 (C00): un oggetto, una sera vuota, gli esiti, note a margine. */
export const R1_KEYS = new Set([
  ...VALID_KEYS,
  'comune.oggetti.merletto_avorio.nome', 'comune.oggetti.merletto_avorio.descrizione',
  'atto1.g00.sera.vuota', 'atto1.g00.marta.esito.ok', 'atto1.g00.marta.esito.fallita', 'atto1.g00.marta.esito.lasciato',
  'atto1.g00.margine.spillo', 'atto1.g00.margine.disfa', 'atto1.g00.margine.passa', 'atto1.g00.margine.corre',
  'atto1.g00.alba.dopo',
]);
