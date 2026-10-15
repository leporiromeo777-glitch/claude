/**
 * Adattatore verso la regia dell'integratore (`src/regia/porte.ts → PortaPopolamento` e i metodi
 * del segnaposto `src/regia/scena/segnaposto.ts` che la regia usa: `punto`, `idPunti`,
 * `mostraVariante`, `apriBotola`, `update`, `lumi`).
 *
 * Con questo la regia sostituisce `new Segnaposto(...)` con
 * `portaPopolamento(installaCorbella(game, { agganciaCiclo: false }))` senza cambiare i suoi id:
 * gli id del segnaposto (`chiodo_cs_3`, `segnale_cs_1`, `lente_corteccia`, `muretto`…) sono
 * tradotti nei punti del popolamento; anche gli id del popolamento (`chiodo:3`, `parla:pina`…)
 * funzionano così come sono.
 */
import type { Vector3 } from 'three';
import type { ManigliaCorbella } from './corbella';

/** id del segnaposto della regia → id dei punti del popolamento */
export const ALIAS_SEGNAPOSTO: Readonly<Record<string, string>> = {
  castagno_morto: 'esamina:castagno_morto',
  lente_corteccia: 'lente:corteccia',
  lente_ricci: 'lente:ricci',
  lente_amenti: 'lente:amenti',
  ramo_vivo: 'taglia:ramo_vivo',
  botola: 'apri:botola',
  lente_cippo: 'lente:cippo',
  muretto: 'siediti:belvedere',
  castagno_cartellino: 'innesta:castagno_cartellino',
  cartellino: 'leggi:cartellino_castagno',
  lente_innesto_vecchio: 'lente:innesto_vecchio',
  innesto: 'innesta:castagno_cartellino',
  fienile: 'entra:fienile_ottavio',
  bacheca: 'leggi:bacheca_ore',
  telo: 'guarda:telo_ombrista',
  scatola_pina: 'guarda:scatola_pina',
  porta_campanile: 'apri:porta_campanile',
  passerella: 'attraversa:passerella',
  casa_nando: 'leggi:casa_nando',
};

export interface PortaCorbella {
  /** punto per id (id del segnaposto della regia o del popolamento); copia, o null */
  punto(id: string): Vector3 | null;
  /** tutti gli id che `punto` risolve */
  idPunti(): string[];
  /** variante di un elemento mobile (E1-E4); varianti sconosciute ignorate. `pezzi` non serve: la variante porta i suoi pezzi */
  mostraVariante(elemento: string, variante: string, pezzi?: { mostra: string[]; nascondi: string[] }): void;
  apriBotola(aperta?: boolean): void;
  update(dt: number): void;
  /** i lumi del popolamento sono già nel motore (`game.lamps`): lista vuota da aggiungere */
  readonly lumi: Vector3[];
  /** la maniglia completa */
  readonly corbella: ManigliaCorbella;
}

export function portaPopolamento(c: ManigliaCorbella): PortaCorbella {
  const punto = (id: string): Vector3 | null => {
    const m = /^(chiodo|segnale)_(cs_\d+)$/.exec(id);
    if (m) return m[1] === 'chiodo' ? c.chiodo(m[2]!) : c.segnale(m[2]!);
    const p = c.punto(ALIAS_SEGNAPOSTO[id] ?? id);
    return p ? p.pos.clone() : null;
  };
  return {
    punto,
    idPunti() {
      const out = new Set<string>(Object.keys(ALIAS_SEGNAPOSTO).filter((k) => c.punto(ALIAS_SEGNAPOSTO[k]!)));
      for (const cs of c.capisaldi) {
        out.add(`segnale_${cs}`);
        if (c.chiodo(cs)) out.add(`chiodo_${cs}`);
      }
      for (const id of c.punti.keys()) out.add(id);
      return [...out];
    },
    mostraVariante(elemento, variante) {
      const e = c.elementi.get(elemento);
      if (!e || !e.varianti.includes(variante) || e.variante === variante) return;
      c.setVariante(elemento, variante);
    },
    apriBotola: (aperta = true) => c.apriBotola(aperta),
    update: (dt) => c.update(dt),
    lumi: [],
    corbella: c,
  };
}
