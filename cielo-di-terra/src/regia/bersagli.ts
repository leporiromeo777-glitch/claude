/**
 * Tutti i bersagli d'interazione e i controlli dello sguardo della Fase 1, con il flag del
 * «Contratto col motore» (FASE1 §2.4) che ciascuno accende.
 *
 * Cripta: capsule 1-7, serratura 5, busta 5, armadietto 5, buste 6 e 7, targhette, scritte del
 * corridoio, scala, botola. Fuori: botola, castagno morto e ramo vivo, muretto, lettera,
 * cartellino e innesto, Bacheca, scatola di Pina e figura, porta del campanile, targa del
 * Pilastro 1, altoparlante, telo dell'Ombrista, fienile (dormire), persone, chiodi (squadro).
 * Sguardi: la scritta del vetro, lo sguardo in su, la lente sui punti d'esame, le Fade.
 */
import { Vector3 } from 'three';
import { localFrameAt } from '../world/cylinder';
import { CAPISALDI } from './contenuti';
import type { Bersaglio } from './interazioni';
import type { Regia } from './regia';
import { elevazione, guardaPunto } from './sguardo';

/** Che cosa dice la lente (lo «schizzo con la diagnosi in una parola»). */
const DIAGNOSI: Record<string, string> = {
  ricci: 'Ricci vuoti da tre anni: non impollinato.',
  amenti: 'Amenti intatti, il polline mai portato via: nessuno li ha visitati.',
  corteccia: 'Corteccia secca, legno affamato di luce: poca luce.',
  innesto_vecchio: "L'innesto del 2120 è morto; il selvatico ha ripreso. Vivo.",
  busta_6: '«Per Teo, da Ines, dalla Sorella.»',
  busta_7: '«Per la dottoressa Sala, da suo figlio, dalla Sorella.»',
  cippo: "Graffi freschi sull'ottone del chiodo 11.",
};

/** Che cosa si vede guardando le capsule (FASE1 P0.2). */
const CAPSULE: Record<number, string> = {
  1: 'Capsula 1, Battista Rè: aperta, il coperchio spinto da dentro. Vuota.',
  2: "Capsula 2, Agnese Moretti: dentro, un'urna di rame.",
  3: 'Capsula 3, Ilde Bassi: vuota, una corona secca sul coperchio e una targa d\'ottone.',
  4: 'Capsula 4, Severino Lanfranchi: vuota, il coperchio richiuso con cura.',
  6: 'Capsula 6, Teo Cattori: dorme sotto il vetro gelato. La sveglia staccata, i cavi tagliati netti.',
  7: 'Capsula 7, la dottoressa Irene Sala: dorme. Anche qui i cavi tagliati, e una busta sul vetro.',
};

const NOMI_DIALOGO = ['togna', 'bortolo', 'annunciata', 'pina', 'nando', 'clelia', 'bambini', 'ottavio'];

export function registraBersagli(r: Regia): void {
  const I = r.interazioni;
  const n = () => r.narrativa;
  const libero = () => r.controllo.tipo === 'libero' && !r.dialoghi.aperto;
  const inCripta = () => r.interno === 'cripta' && libero();
  const fuori = () => r.interno === null && libero();
  const flag = (f: string) => n().flag.vero(f);
  const p = (id: string) => () => r.scena.punto(id);
  const pc = (id: string) => r.cripta.punti[id]!;
  /** Un punto davanti agli occhi: il bersaglio «di sé» (alzarsi, leggere la lettera). */
  const davanti = () => {
    const o = r.occhi(new Vector3());
    return o.addScaledVector(r.game.rig.forward(new Vector3()), 0.6);
  };
  const add = (b: Bersaglio) => I.registra(b);

  // ---------------------------------------------------------------- Cripta
  add({ id: 'alzati', verbo: 'Alzati', posizione: davanti, portata: 1.5, raggio: 1, disponibile: () => r.controllo.tipo === 'sdraiata' && r.cripta.coperchioAperto(), azione: () => r.alzati() });
  for (const i of [1, 2, 3, 4, 6, 7]) {
    add({
      id: `capsula_${i}`,
      verbo: `Guarda la capsula ${i}`,
      posizione: pc(`capsula_${i}`),
      portata: 2.8,
      raggio: 0.7,
      disponibile: inCripta,
      azione: () => {
        r.flag(`esaminato:capsula_${i}`);
        r.ponte.notifica(CAPSULE[i]!);
        if (i === 3) r.ponte.battuta('elvira_ilde');
        if (i === 6 || i === 7) r.ponte.battuta('elvira_dormite');
      },
    });
  }
  add({ id: 'serratura_5', verbo: 'Esamina la serratura', posizione: pc('serratura_5'), portata: 2.2, raggio: 0.25, priorita: 2, disponibile: inCripta, azione: () => {
    r.flag('esaminato:serratura_5');
    r.ponte.notifica('La serratura della capsula 5: segni di forzatura, da fuori.');
  } });
  add({ id: 'targhette', verbo: 'Leggi le targhette delle capsule', posizione: pc('targhette'), portata: 2.2, raggio: 0.25, priorita: 1, disponibile: inCripta, azione: () => r.ponte.leggi('targhe_capsule') });
  add({ id: 'busta_5', verbo: 'Prendi la busta «Per la mamma»', posizione: pc('busta_5'), portata: 2.4, raggio: 0.3, priorita: 3, disponibile: () => inCripta() && !flag('esaminato:busta_5'), azione: () => {
    r.flag('esaminato:busta_5');
    r.cripta.togliBusta();
    r.audio.evento({ tipo: 'pagina', verso: 'avanti' });
  } });
  add({ id: 'armadietto_5', verbo: "Apri l'armadietto n. 5", posizione: pc('armadietto_5'), portata: 2.4, raggio: 0.5, priorita: 2, disponibile: () => inCripta() && !flag('armadietto_aperto'), azione: () => {
    r.flag('armadietto_aperto');
    r.cripta.apriArmadietto();
    r.ponte.battuta('elvira_aurelio');
    r.ponte.notifica('La borsa di cuoio: il Velo ripiegato, lo squadro a cannocchiale, il libretto di Aurelio, l\'erbario con la lente, il coltello da innesto, rafia e mastice.');
  } });
  for (const i of [6, 7]) {
    add({ id: `busta_${i}`, verbo: 'Guarda la busta sul vetro', posizione: pc(`busta_${i}`), portata: 2.4, raggio: 0.25, priorita: 2, disponibile: () => inCripta() && !r.lente, azione: () => r.ponte.leggi(`busta_${i}`) });
  }
  add({ id: 'gesso_corridoio', verbo: 'Leggi la scritta a gesso', posizione: pc('gesso_corridoio'), portata: 2.6, raggio: 0.6, disponibile: inCripta, azione: () => r.ponte.leggi('gesso_corridoio') });
  add({ id: 'orari_cripta', verbo: 'Leggi gli orari dipinti', posizione: pc('orari_cripta'), portata: 2.6, raggio: 0.6, disponibile: inCripta, azione: () => r.ponte.leggi('orari_cripta') });
  add({ id: 'scala', verbo: 'Sali la scala', posizione: pc('scala'), portata: 2.4, raggio: 0.7, disponibile: inCripta, azione: () => r.saliScala() });
  add({
    id: 'botola_spingi',
    verbo: 'Spingi la botola',
    posizione: davanti,
    portata: 1.5,
    raggio: 1,
    disponibile: () => r.controllo.tipo === 'scala' && (r.controllo as { y: number }).y >= 6.2,
    azione: () => r.esciDallaBotola(),
  });

  // ---------------------------------------------------------------- fuori: la Cripta e il castagno
  add({ id: 'botola', verbo: 'Scendi nella Cripta', posizione: p('botola'), portata: 2.6, raggio: 0.8, disponibile: () => fuori() && n().valuta('passo:pr_guarda_su completato'), azione: () => r.entraNellaCripta() });
  let salutato = false;
  add({ id: 'castagno_morto', verbo: 'Tocca il castagno', posizione: p('castagno_morto'), portata: 2.4, raggio: 0.6, disponibile: () => fuori() && !salutato && !r.lente, azione: () => {
    salutato = true;
    r.ponte.battuta('elvira_ciao_vecchio');
  } });
  add({
    id: 'ramo_vivo',
    verbo: 'Taglia una marza dal ramo vivo (tieni premuto E)',
    posizione: p('ramo_vivo'),
    portata: 2.8,
    raggio: 0.5,
    priorita: 3,
    disponibile: () => fuori() && flag('ramo_vivo_trovato') && !n().inventario.ha('marza_pedrazzini') && !n().valuta('passo:m1_marza completato') && n().inventario.ha('coltello_innesto'),
    tenuta: { durata: 1.6, completa: () => n().inventario.aggiungi('marza_pedrazzini') },
  });

  // ---------------------------------------------------------------- il belvedere e la lettera
  add({
    id: 'muretto',
    verbo: 'Siediti sul muretto',
    posizione: p('muretto'),
    portata: 2.6,
    raggio: 1.4,
    disponibile: fuori,
    azione: () => {
      const m = r.scena.punto('muretto');
      if (!m) return;
      const c = r.game.player.cyl;
      void c;
      r.siedi({ ...cylDi(m), h: cylDi(m).h + 0.05 });
    },
  });
  add({
    id: 'lettera',
    verbo: 'Leggi la lettera di Marta',
    posizione: davanti,
    portata: 1.5,
    raggio: 1,
    priorita: -1,
    disponibile: () => r.controllo.tipo === 'seduta' && n().inventario.ha('lettera_marta') && !r.dialoghi.aperto,
    azione: () => r.ponte.leggi('lettera_marta'),
  });

  // ---------------------------------------------------------------- la Terrazza Pedrazzini
  add({ id: 'cartellino', verbo: 'Leggi il cartellino di zinco', posizione: p('cartellino'), portata: 2.6, raggio: 0.3, priorita: 2, disponibile: fuori, azione: () => r.ponte.leggi('cartellino_castagno') });
  const TEMPI = ['Taglia: lo spacco nel ramo (tieni premuto E)', 'Inserisci la marza (tieni premuto E)', 'Lega con rafia e mastice (tieni premuto E)'];
  add({
    id: 'innesto',
    verbo: () => TEMPI[Math.min(2, r.stadioInnesto)]!,
    posizione: p('innesto'),
    portata: 2.8,
    raggio: 0.5,
    priorita: 3,
    disponibile: () => fuori() && n().valuta('passo:m1_innesto attivo') && n().inventario.ha('marza_pedrazzini') && !flag('innesto_fatto'),
    tenuta: {
      durata: 1.3,
      riprende: true,
      completa: () => {
        r.stadioInnesto++;
        r.audio.evento({ tipo: 'interfaccia', varieta: 'conferma' });
        if (r.stadioInnesto >= 3) r.flag('innesto_fatto');
      },
    },
  });

  // ---------------------------------------------------------------- la piazza
  add({ id: 'bacheca', verbo: 'Leggi la Bacheca delle Ore', posizione: p('bacheca'), portata: 2.8, raggio: 0.8, disponibile: fuori, azione: () => r.ponte.leggi(`bacheca_giorno_${Math.min(3, r.orologio.giorno)}`) });
  add({ id: 'scatola_pina', verbo: 'Guarda nella scatola dei cartoni', posizione: p('scatola_pina'), portata: 2.6, raggio: 0.4, disponibile: () => fuori() && r.abitanti.presente('pina') && !flag('esaminato:scatola_pina'), azione: () => {
    r.flag('esaminato:scatola_pina');
    r.ponte.notifica('Fra i Padri, la Sorella e la Santa, una figura che in piazza non esce mai: un uomo curvo con una ruota sulle spalle.');
  } });
  add({ id: 'figura', verbo: "Prendi la figura dell'uomo con la ruota", posizione: p('scatola_pina'), portata: 2.6, raggio: 0.4, priorita: 1, disponibile: () => fuori() && r.abitanti.presente('pina') && flag('esaminato:scatola_pina') && !flag('figura_presa'), azione: () => r.flag('figura_presa') });
  add({
    id: 'porta_campanile',
    verbo: () => (flag('campanile_aperto') ? 'Sali sul campanile' : 'La porta del campanile è chiusa'),
    posizione: p('porta_campanile'),
    portata: 3,
    raggio: 1.2,
    disponibile: fuori,
    azione: () => {
      if (flag('campanile_aperto')) r.saliCampanile();
      else r.ponte.notifica('Chiusa a chiave. Le chiavi le ha il campanaro.');
    },
  });
  const inCella = () => r.interno === 'cella' && libero();
  add({ id: 'targa_p1', verbo: 'Leggi la targa del Pilastro 1', posizione: r.cella.punti['targa_p1']!, portata: 2.2, raggio: 0.3, priorita: 2, disponibile: inCella, azione: () => r.ponte.leggi('targa_p1') });
  add({ id: 'altoparlante_cella', verbo: "Parla all'altoparlante", posizione: r.cella.punti['altoparlante_cella']!, portata: 2.6, raggio: 0.4, disponibile: () => inCella() && n().dialoghi.perInterazione('altoparlante_cella') !== null, azione: () => r.dialoghi.interagisci('altoparlante_cella') });
  add({ id: 'scendi_campanile', verbo: 'Scendi dal campanile', posizione: r.cella.punti['scendi_campanile']!, portata: 2.4, raggio: 0.7, disponibile: inCella, azione: () => r.scendiCampanile() });
  add({
    id: 'telo',
    verbo: "Siediti a guardare l'Ombrista",
    posizione: p('telo'),
    portata: 12,
    raggio: 2.2,
    disponibile: () => fuori() && r.orologio.ore >= 19.75 && r.orologio.ore < 20.5 && n().scenaDisponibile('leggende') !== null,
    azione: () => {
      const s = n().scenaDisponibile('leggende');
      if (s) r.ponte.recitaScena(s);
    },
  });

  // ---------------------------------------------------------------- i rifugi
  add({
    id: 'dormi',
    verbo: 'Dormi nel fieno',
    posizione: p('fienile'),
    portata: 4,
    raggio: 1.5,
    disponibile: () => fuori() && (r.orologio.ore >= 20.5 || r.orologio.ore < 5) && !n().valuta('passo:m1_fienile attivo') && !(n().valuta('passo:m1_notte attivo') && !n().dialoghi.finito('d_ottavio_fienile')),
    azione: () => r.dormi(5.5),
  });

  // ---------------------------------------------------------------- le persone
  for (const chi of NOMI_DIALOGO) {
    add({
      id: `png_${chi}`,
      verbo: () => `Parla con ${r.ponte.nomeVisibile(chi)}`,
      posizione: () => r.abitanti.puntoDialogo(chi),
      portata: 3.4,
      raggio: 0.6,
      priorita: 1,
      disponibile: () => libero() && n().dialoghi.perPersonaggio(chi) !== null,
      azione: () => r.dialoghi.parla(chi),
    });
  }

  // ---------------------------------------------------------------- i chiodi (squadro)
  for (const c of CAPISALDI) {
    add({
      id: `pianta_${c.id}`,
      verbo: `Pianta lo squadro sul chiodo ${c.numero} (tieni premuto E)`,
      posizione: () => r.chiodo(c.id),
      portata: 2.4,
      raggio: 0.35,
      priorita: 2,
      disponibile: () => libero() && r.squadro.disponibile && (c.id === 'cs_1' ? r.interno === 'cella' : r.interno === null),
      tenuta: { durata: 0.9, completa: () => r.piantaSquadro(c.id) },
    });
  }
  add({ id: 'stacca_squadro', verbo: 'Stacca lo squadro', posizione: davanti, portata: 1.5, raggio: 1, priorita: -2, disponibile: () => r.controllo.tipo === 'piantato' && !r.squadro.telescopio, azione: () => r.squadro.stacca() });

  // ---------------------------------------------------------------- sguardi
  const S = r.sguardi;
  S.registra({ id: 'guardato_vetro', posizione: r.cripta.scritta, raggio: 0.28, durata: 1.5, attivo: () => r.controllo.tipo === 'sdraiata', compiuto: () => r.flag('guardato_vetro') });
  S.registra({
    id: 'guardato_in_su',
    durata: 1.5,
    attivo: () => r.interno === null && r.fase === 'gioco',
    prova: (_o, avanti) => {
      const pl = r.game.player;
      const f = localFrameAt(pl.pos, undefined, pl.cyl.theta);
      return elevazione(avanti, f.up) > 50;
    },
    compiuto: () => r.flag('guardato_in_su'),
  });
  const LENTE: [string, () => Vector3 | null][] = [
    ['ricci', p('lente_ricci')],
    ['amenti', p('lente_amenti')],
    ['corteccia', p('lente_corteccia')],
    ['innesto_vecchio', p('lente_innesto_vecchio')],
    ['cippo', p('lente_cippo')],
    ['busta_6', () => pc('busta_6')],
    ['busta_7', () => pc('busta_7')],
  ];
  for (const [id, pos] of LENTE) {
    S.registra({
      id: `lente:${id}`,
      posizione: pos,
      raggio: 0.35,
      distanza: 3.2,
      durata: 1,
      attivo: () => r.lente && r.fase === 'gioco',
      compiuto: () => {
        r.flag(`lente:${id}`);
        r.ponte.notifica(`Lente — ${DIAGNOSI[id]}`);
        r.audio.evento({ tipo: 'pagina', verso: 'avanti' });
      },
    });
  }
  S.registra({
    id: 'fade_viste',
    durata: 3,
    attivo: () => r.notteVista.visibili.length > 0,
    prova: (occhi, avanti) => r.notteVista.visibili.some((c) => guardaPunto(occhi, avanti, c, 6, 400, 22)),
    compiuto: () => r.flag('fade_viste'),
  });
}

function cylDi(p: Vector3): { z: number; theta: number; h: number } {
  const r = Math.hypot(p.x, p.y);
  let theta = (Math.atan2(-p.x, -p.y) * 180) / Math.PI;
  if (theta < 0) theta += 360;
  return { z: p.z, theta, h: 646 - r };
}
