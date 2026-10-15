/**
 * Palette del Ticino d'autunno (direzione artistica di «Cielo di Terra»):
 * ocra delle stoppie, bruno castagna, grigio-viola dello gneiss, verde salvia dei prati,
 * giada del lago, vermiglio delle vele, rame delle api, bianco di calce dei campanili.
 * I colori sono in sRGB esadecimale; la libreria li converte nello spazio lineare di three.js.
 */
export const PALETTE = {
  // pietra
  gneiss: 0xa7a39b,
  gneissChiaro: 0xc4bfb4,
  gneissScuro: 0x7f7b78,
  gneissViola: 0x938c94,
  gneissCaldo: 0xb0a491,
  muschio: 0x6f7a46,
  piode: 0x4a4c56,
  piodeChiare: 0x63646d,
  piodeScure: 0x34363f,
  calce: 0xf1ebde,
  calceOmbra: 0xd8d0c0,
  intonacoVecchio: 0xd9cfba,
  terra: 0x6b5236,
  terraScura: 0x4a3a28,

  // legno
  legno: 0x7a5236,
  legnoScuro: 0x4e3424,
  legnoChiaro: 0x9d7249,
  legnoGrigio: 0x8a7f72,
  legnoVecchio: 0x6a5546,
  troncoCastagno: 0x5e4535,
  troncoScuro: 0x3d2e25,
  troncoMorto: 0x857a6e,
  troncoMortoScuro: 0x5a5149,

  // vegetazione
  fogliaEstate: [0x4a6630, 0x678a3c, 0x8fae55] as const,
  fogliaAutunno: [0x8f4f1f, 0xc2802b, 0xe2b44c] as const,
  fogliaFioritura: [0x55703a, 0x7a9846, 0xa4bc68] as const,
  amenti: 0xf0e2a8,
  salvia: 0x8fa070,
  prato: 0x7d9a4b,
  pratoChiaro: 0x9bb35e,
  stoppie: 0xc9a35a,
  fieno: 0xd2b066,
  geranio: 0xd6334a,
  geranioRosa: 0xe86a86,
  fogliaGeranio: 0x4c7a34,

  // segnali e tessuti
  vermiglio: 0xcf4129,
  rossoPalina: 0xc7362b,
  biancoPalina: 0xf3efe6,
  noce: 0x6a4a31,
  noceScuro: 0x4b3322,
  canapa: 0xcfbd97,
  canapaScura: 0xa8946f,
  lana: 0x8b7d6b,
  tela: 0xe6dcc3,
  telaOmbra: 0xc9bc9f,
  cucitura: 0x8a6a45,

  // metalli delle macchine
  ottone: 0xc9a24a,
  ottoneScuro: 0x8c6a2a,
  ottoneChiaro: 0xe6c779,
  bronzo: 0x9a6b35,
  bronzoScuro: 0x5f4122,
  rame: 0xb8693a,
  rameScuro: 0x7a4123,
  rameChiaro: 0xd99060,
  smaltoVerde: 0x3f6b55,
  smaltoVerdeChiaro: 0x5d8a70,
  ferro: 0x3a3936,
  ferroChiaro: 0x5a5852,

  // prima persona
  guanto: 0x6e4b33,
  guantoScuro: 0x4f3523,
  guantoCucitura: 0x8f6a48,
  manica: 0x5a6340,
  manicaScura: 0x434a2f,

  // luci
  lumeCaldo: 0xffc46b,
  lumeFiamma: 0xfff0c0,
  lumeArancio: 0xff9a3c,
  finestraBuia: 0x1d1c22,
  finestraAccesa: 0xffb85c,
  vetroScuro: 0x2a2c30,

  // acqua
  giada: 0x4f9a8a,
} as const;

export type NomeColore = keyof typeof PALETTE;
