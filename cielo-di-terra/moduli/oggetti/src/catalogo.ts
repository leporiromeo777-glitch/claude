/**
 * Catalogo di tutti i generatori con una configurazione rappresentativa.
 * Lo usano la vetrina (misure di triangoli e draw call) e i test.
 */
import type { OggettoProcedurale } from './tipi';
import { creaRustico } from './oggetti/rustico';
import { creaCampanile } from './oggetti/campanile';
import { creaCastagno, creaCastagnoMorto, creaBotolaCripta } from './oggetti/castagno';
import { creaMuroSecco, creaScaletta, creaCancello } from './oggetti/muri';
import { creaFienile } from './oggetti/fienile';
import { creaPontile, creaBarca } from './oggetti/lago';
import { creaCaposaldo, creaPilastro, creaPalina } from './oggetti/caposaldo';
import { creaSquadroPrimaPersona, creaVeloPrimaPersona } from './oggetti/primaPersona';
import { creaAbitante } from './oggetti/abitante';
import { creaFada, creaSciameFade, creaSciameApi } from './oggetti/fade';
import { creaLanterna, creaLumino } from './oggetti/lumi';

export interface VoceCatalogo {
  nome: string;
  crea: () => OggettoProcedurale<unknown>;
  nota?: string;
}

type Qualsiasi = OggettoProcedurale<unknown>;
const q = <S>(o: OggettoProcedurale<S>): Qualsiasi => o as unknown as Qualsiasi;

export const CATALOGO: VoceCatalogo[] = [
  { nome: 'rustico 1 piano', crea: () => q(creaRustico({ seme: 13, piani: 1 })) },
  { nome: 'rustico 2 piani, balcone sul fronte', crea: () => q(creaRustico({ seme: 11, piani: 2, balcone: 'fronte' })) },
  { nome: 'rustico 3 piani, balcone sul fianco', crea: () => q(creaRustico({ seme: 12, piani: 3, balcone: 'lato' })) },
  { nome: 'rustico 2 piani, dettaglio basso', crea: () => q(creaRustico({ seme: 11, piani: 2, balcone: 'fronte', dettaglio: 'basso' })), nota: 'LOD lontano' },
  { nome: 'rustico smontato dalle Fade', crea: () => q(creaRustico({ seme: 14, piani: 2, scalaEsterna: true, balcone: 'nessuno', smontato: true })) },
  { nome: 'campanile di San Vigilio', crea: () => q(creaCampanile()) },
  { nome: 'castagno vivo (estate)', crea: () => q(creaCastagno({ seme: 21, stagione: 'estate' })) },
  { nome: 'castagno vivo (autunno)', crea: () => q(creaCastagno({ seme: 22, stagione: 'autunno' })) },
  { nome: 'castagno vivo (fioritura)', crea: () => q(creaCastagno({ seme: 23, stagione: 'fioritura', altezza: 11 })) },
  { nome: 'castagno vivo, dettaglio basso', crea: () => q(creaCastagno({ seme: 21, stagione: 'estate', dettaglio: 'basso' })), nota: 'LOD lontano' },
  { nome: 'castagno morto + botola della Cripta', crea: () => q(creaCastagnoMorto({ seme: 24, cripta: true })) },
  { nome: 'botola della Cripta (sola)', crea: () => q(creaBotolaCripta()) },
  { nome: 'muro a secco 14 m (curvo)', crea: () => q(creaMuroSecco({ seme: 31, lunghezza: 14, raggioCurva: 30, altezza: 1.6 })) },
  { nome: 'muro a secco 14 m, dettaglio basso', crea: () => q(creaMuroSecco({ seme: 31, lunghezza: 14, raggioCurva: 30, altezza: 1.6, dettaglio: 'basso' })), nota: 'LOD lontano' },
  { nome: 'muro di sostegno 10 m (terrapieno)', crea: () => q(creaMuroSecco({ seme: 36, lunghezza: 10, altezza: 2, terrapieno: true })) },
  { nome: 'scaletta (7 gradini)', crea: () => q(creaScaletta({ seme: 33 })) },
  { nome: 'scaletta a sbalzo', crea: () => q(creaScaletta({ seme: 37, tipo: 'sbalzo' })) },
  { nome: 'cancello di legno', crea: () => q(creaCancello({ seme: 34 })) },
  { nome: 'fienile', crea: () => q(creaFienile({ seme: 3 })) },
  { nome: 'pontile 14 m', crea: () => q(creaPontile({ seme: 41 })) },
  { nome: 'barca a remi con vela rossa', crea: () => q(creaBarca({ seme: 42 })) },
  { nome: 'chiodo d’ottone (solo)', crea: () => q(creaCaposaldo({ numero: 37, supporto: 'nessuno' })) },
  { nome: 'caposaldo nel muro', crea: () => q(creaCaposaldo({ numero: 37, supporto: 'muro' })) },
  { nome: 'caposaldo su pilastrino', crea: () => q(creaCaposaldo({ numero: 141, supporto: 'pilastrino' })) },
  { nome: 'pilastro di bronzo con palina', crea: () => q(creaPilastro({ numero: 4 })) },
  { nome: 'palina 9 m su ometto', crea: () => q(creaPalina({ altezza: 9 })) },
  { nome: 'squadro in prima persona (piantato)', crea: () => q(creaSquadroPrimaPersona({ posa: 'piantato' })) },
  { nome: 'squadro in prima persona (in mano)', crea: () => q(creaSquadroPrimaPersona({ posa: 'mano' })) },
  { nome: 'Velo in prima persona', crea: () => q(creaVeloPrimaPersona()) },
  { nome: 'abitante velato (velo di garza)', crea: () => q(creaAbitante({ seme: 51, copricapo: 'velo' })) },
  { nome: 'abitante con maschera di castagno', crea: () => q(creaAbitante({ seme: 52, copricapo: 'maschera' })) },
  { nome: 'abitante con velo da apicoltore', crea: () => q(creaAbitante({ seme: 53, copricapo: 'apicoltore' })) },
  { nome: 'Fada singola (con pietra)', crea: () => q(creaFada({ seme: 61 })) },
  { nome: 'sciame di 24 Fade (istanziato)', crea: () => q(creaSciameFade({ numero: 24 })) },
  { nome: 'sciame di 160 api di rame (istanziato)', crea: () => q(creaSciameApi({ numero: 160 })) },
  { nome: 'lampione su palo', crea: () => q(creaLanterna({ tipo: 'palo' })) },
  { nome: 'lanterna a muro', crea: () => q(creaLanterna({ tipo: 'muro' })) },
  { nome: 'lanterna a mano (petrolio)', crea: () => q(creaLanterna({ tipo: 'mano' })) },
  { nome: 'cappelletta votiva con lumino', crea: () => q(creaLanterna({ tipo: 'nicchia' })) },
  { nome: 'lumino', crea: () => q(creaLumino()) },
];
