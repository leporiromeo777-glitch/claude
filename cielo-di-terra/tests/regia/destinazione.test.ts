/**
 * La scelta della meta del segnalino (src/regia/destinazione.ts): dal passo di missione al
 * luogo, alla persona, al caposaldo; le tappe di strada; i passi senza segnalino. Prima con
 * passi scritti a mano, poi con i passi veri di content/missioni.json.
 */
import { describe, expect, it } from 'vitest';
import { ParserCondizioni, normalizzaContenuti, type Atomo, type NodoCondizione } from '../../src/narrativa';
import { atomiMancanti, compilaPasso, tappeDelPasso, type Destinazione, type FontiDestinazione, type PassoDaSeguire } from '../../src/regia/destinazione';
import { CAPISALDI, CONTENUTI_NARRATIVA, LATI, LUOGHI } from '../../src/regia/contenuti';
import { surfaceDistance } from '../../src/world/cylinder';

const parser = new ParserCondizioni();
const c = (s: string): NodoCondizione => parser.compila(s);

/** Una chiave per ogni atomo vero: «flag:x», «luogo:x», «dialogo:x», «cella:x». */
function chiave(a: Atomo): string {
  switch (a.k) {
    case 'flag':
      return `flag:${a.nome}`;
    case 'luogo':
      return `luogo:${a.id}`;
    case 'dialogo':
      return `dialogo:${a.id}`;
    case 'cella':
      return `cella:${a.id}`;
    case 'oggetto':
      return `oggetto:${a.id}`;
    default:
      return `${a.k}`;
  }
}

/** Fonti finte: un insieme di atomi veri, i dialoghi a mano, i corpi del paese. */
function fonti(p: {
  veri?: string[];
  raggiunti?: string[];
  dialoghi?: Record<string, { personaggio: string; apertura?: string }>;
  corpi?: string[];
  accende?: Record<string, string[]>;
  conta?: Record<string, string[]>;
  celle?: Record<string, string[]>;
  distanze?: Record<string, number>;
} = {}): FontiDestinazione {
  const veri = new Set(p.veri ?? []);
  return {
    vero: (a) => veri.has(chiave(a)),
    raggiunto: (l) => (p.raggiunti ?? []).includes(l),
    dialogo: (id) => {
      const d = p.dialoghi?.[id];
      return d ? { personaggio: d.personaggio, apertura: d.apertura ? c(d.apertura) : null } : null;
    },
    haCorpo: (x) => (p.corpi ?? []).includes(x),
    chiAccende: (f) => p.accende?.[f] ?? [],
    chiConta: (k) => p.conta?.[k] ?? [],
    capisaldiDellaCella: (id) => p.celle?.[id] ?? [],
    distanza: (cs, l) => p.distanze?.[`${cs}>${l}`] ?? 100,
  };
}

const passo = (completa: string, extra: Partial<PassoDaSeguire> = {}): PassoDaSeguire => ({ completa: c(completa), eventi: [], ...extra });

describe('atomi che mancano', () => {
  it('di una «e» tutti quelli falsi; di una «o» falsa la prima strada; le negazioni no', () => {
    const veri = new Set(['flag:a']);
    const v = (a: Atomo): boolean => veri.has(chiave(a));
    expect(atomiMancanti(c('flag:a e flag:b e luogo:x raggiunto'), v).map(chiave)).toEqual(['flag:b', 'luogo:x']);
    expect(atomiMancanti(c('(dialogo:d1 finito o dialogo:d2 finito) e flag:c'), v).map(chiave)).toEqual(['dialogo:d1', 'flag:c']);
    expect(atomiMancanti(c('flag:z o flag:a'), v)).toEqual([]);
    expect(atomiMancanti(c('!flag:q e flag:b'), v).map(chiave)).toEqual(['flag:b']);
  });
});

describe('le tappe di un passo', () => {
  it('un luogo da raggiungere: il luogo (e, raggiunto, resta il luogo del passo)', () => {
    const p = passo('luogo:belvedere_muretto raggiunto e flag:seduta', { luogo: 'belvedere_muretto' });
    expect(tappeDelPasso(p, fonti())).toEqual([{ tipo: 'luogo', id: 'belvedere_muretto' }]);
    expect(tappeDelPasso(p, fonti({ veri: ['luogo:belvedere_muretto'] }))).toEqual([{ tipo: 'luogo', id: 'belvedere_muretto' }]);
  });

  it('il luogo del passo è la via quando la meta è un altro luogo: prima il guado, poi la piazza', () => {
    const p = passo('luogo:piazza_ore raggiunto', { luogo: 'guado_sass' });
    expect(tappeDelPasso(p, fonti())).toEqual([
      { tipo: 'luogo', id: 'guado_sass' },
      { tipo: 'luogo', id: 'piazza_ore' },
    ]);
    // passata dal guado: la piazza (il guado resta solo come ripiego, in fondo)
    expect(tappeDelPasso(p, fonti({ raggiunti: ['guado_sass'] }))[0]).toEqual({ tipo: 'luogo', id: 'piazza_ore' });
  });

  it('un dialogo con una persona: la persona; una voce senza corpo: niente; si apre arrivando in un posto: il posto', () => {
    const dialoghi = {
      d_parla: { personaggio: 'ottavio' },
      d_voce: { personaggio: 'meridiana' },
      d_bacheca: { personaggio: 'clelia', apertura: 'giorno:>=2 e luogo:bacheca_ore raggiunto' },
    };
    const f = fonti({ dialoghi, corpi: ['ottavio', 'clelia'] });
    expect(tappeDelPasso(passo('dialogo:d_parla finito', { luogo: 'piazza_ore' }), f)[0]).toEqual({ tipo: 'persona', id: 'ottavio' });
    expect(tappeDelPasso(passo('dialogo:d_voce finito', { luogo: 'belvedere_muretto' }), f)).toEqual([{ tipo: 'luogo', id: 'belvedere_muretto' }]);
    // (con chi parla lì: se non c'è ancora, il menu dell'attesa sa quando arriva)
    expect(tappeDelPasso(passo('dialogo:d_bacheca finito o dialogo:d_parla finito', { luogo: 'bacheca_ore' }), f)[0]).toEqual({ tipo: 'luogo', id: 'bacheca_ore', chi: 'clelia' });
    // una voce senza corpo che parla arrivando in un posto: il posto, senza nessuno da aspettare
    const g = fonti({ dialoghi: { d_cella: { personaggio: 'meridiana', apertura: 'luogo:cella_campanaria raggiunto' } }, corpi: [] });
    expect(tappeDelPasso(passo('dialogo:d_cella finito'), g)[0]).toEqual({ tipo: 'luogo', id: 'cella_campanaria' });
  });

  it('un flag acceso da un dialogo: chi lo accende, poi il resto (il campanaro, poi la cella)', () => {
    const p = passo('flag:campanile_aperto e luogo:cella_campanaria raggiunto e flag:targa_p1_letta', { luogo: 'cella_campanaria' });
    const f = (veri: string[] = []) => fonti({ veri, corpi: ['bortolo'], accende: { campanile_aperto: ['bortolo', 'bortolo'] } });
    expect(tappeDelPasso(p, f())).toEqual([
      { tipo: 'persona', id: 'bortolo' },
      { tipo: 'luogo', id: 'cella_campanaria' },
    ]);
    expect(tappeDelPasso(p, f(['flag:campanile_aperto']))[0]).toEqual({ tipo: 'luogo', id: 'cella_campanaria' });
  });

  it('un contatore alzato dai dialoghi: le persone che hanno ancora da dire', () => {
    const p = passo('contatore:velati>=3', { luogo: 'piazza_ore' });
    const f = fonti({ corpi: ['togna', 'pina'], conta: { velati: ['togna', 'pina', 'meridiana'] } });
    expect(tappeDelPasso(p, f)).toEqual([
      { tipo: 'persone', ids: ['togna', 'pina'] },
      { tipo: 'luogo', id: 'piazza_ore' },
    ]);
  });

  it('il rilievo: la stazione del lato tentato, il caposaldo più vicino al luogo per una cella', () => {
    expect(tappeDelPasso(passo('flag:tentato_lato:2-1 o cella:2214 rilevata', { luogo: 'sagrato' }), fonti())[0]).toEqual({ tipo: 'caposaldo', id: 'cs_2' });
    const f = fonti({ celle: { '2797': ['cs_1', 'cs_7', 'cs_8'] }, distanze: { 'cs_1>passerella_messo': 300, 'cs_7>passerella_messo': 34, 'cs_8>passerella_messo': 58 } });
    expect(tappeDelPasso(passo('cella:2797 rilevata', { luogo: 'passerella_messo' }), f)[0]).toEqual({ tipo: 'caposaldo', id: 'cs_7' });
  });

  it('gli eventi del passo sono tappe di strada (la passerella prima del fienile, Ottavio prima di misurare)', () => {
    const p: PassoDaSeguire = { luogo: 'fienile_ottavio', completa: c('luogo:fienile_ottavio raggiunto'), eventi: [c('luogo:passerella_messo raggiunto')] };
    expect(tappeDelPasso(p, fonti()).map((t) => ('id' in t ? t.id : ''))).toEqual(['passerella_messo', 'fienile_ottavio']);
    expect(tappeDelPasso(p, fonti({ veri: ['luogo:passerella_messo'] }))).toEqual([{ tipo: 'luogo', id: 'fienile_ottavio' }]);
    const strada: PassoDaSeguire = { luogo: 'passerella_messo', completa: c('cella:2797 rilevata'), eventi: [c('dialogo:d_strada finito')] };
    const f = fonti({ dialoghi: { d_strada: { personaggio: 'ottavio' } }, corpi: ['ottavio'], celle: { '2797': ['cs_7'] } });
    expect(tappeDelPasso(strada, f).slice(0, 2)).toEqual([
      { tipo: 'persona', id: 'ottavio' },
      { tipo: 'caposaldo', id: 'cs_7' },
    ]);
  });

  it('le tappe scritte vengono prima, finché vale il loro «quando»; un luogo senza «quando» finché non è raggiunto', () => {
    const p: PassoDaSeguire = {
      luogo: 'piazza_ore',
      completa: c('flag:planata_fatta e luogo:piazza_ore raggiunto'),
      eventi: [],
      tappe: [
        { meta: { tipo: 'luogo', id: 'ripa_san_vigilio' }, quando: c('!flag:planata_fatta') },
        { meta: { tipo: 'luogo', id: 'muraglione_gra' }, quando: null },
      ],
    };
    expect(tappeDelPasso(p, fonti())).toEqual([
      { tipo: 'luogo', id: 'ripa_san_vigilio' },
      { tipo: 'luogo', id: 'muraglione_gra' },
      { tipo: 'luogo', id: 'piazza_ore' },
    ]);
    expect(tappeDelPasso(p, fonti({ veri: ['flag:planata_fatta'], raggiunti: ['muraglione_gra'] }))).toEqual([{ tipo: 'luogo', id: 'piazza_ore' }]);
  });

  it('con le tappe scritte niente ripiego sul luogo del passo (la porta chiusa dei Bugni)', () => {
    const p: PassoDaSeguire = {
      luogo: 'porta_bugni',
      completa: c('flag:fase2_disponibile'),
      eventi: [c('luogo:porta_bugni raggiunto')],
      tappe: [{ meta: { tipo: 'luogo', id: 'balcone_messi' }, quando: c('!flag:atterrata_altra_valle') }],
    };
    expect(tappeDelPasso(p, fonti())).toEqual([
      { tipo: 'luogo', id: 'balcone_messi' },
      { tipo: 'luogo', id: 'porta_bugni' },
    ]);
    expect(tappeDelPasso(p, fonti({ veri: ['flag:atterrata_altra_valle', 'luogo:porta_bugni'] }))).toEqual([]);
    // senza tappe scritte il luogo del passo resta in fondo come ripiego
    expect(tappeDelPasso({ ...p, tappe: [] }, fonti({ veri: ['luogo:porta_bugni'] }))).toEqual([{ tipo: 'luogo', id: 'porta_bugni' }]);
  });

  it('«segnalino: false» e i passi senza luogo né meta: nessuna tappa', () => {
    expect(tappeDelPasso(passo('flag:libretto_cs1_letto', { luogo: 'cella_campanaria', segnalino: false }), fonti())).toEqual([]);
    expect(tappeDelPasso(passo('giorno:3 e ora:>=05:30'), fonti())).toEqual([]);
  });
});

describe('le tappe dei passi veri della Fase 1', () => {
  const contenuti = normalizzaContenuti(CONTENUTI_NARRATIVA);
  const passi = new Map(contenuti.missioni.flatMap((m) => m.passi.map((p) => [p.id, p] as const)));
  const CORPI = ['ottavio', 'togna', 'bortolo', 'annunciata', 'pina', 'nando', 'clelia', 'bambini'];
  const accende = new Map<string, string[]>();
  const conta = new Map<string, string[]>();
  for (const d of Object.values(contenuti.dialoghi)) {
    for (const e of [...d.effettiFine, ...d.nodi.flatMap((n) => [...n.effetti, ...n.risposte.flatMap((r) => r.effetti)])]) {
      const f = /^flag:([^-\s=][^\s=]*)$/.exec(e);
      if (f) accende.set(f[1]!, [...(accende.get(f[1]!) ?? []), d.personaggio]);
      const k = /^contatore:(\w+)\+/.exec(e);
      if (k) conta.set(k[1]!, [...new Set([...(conta.get(k[1]!) ?? []), d.personaggio])]);
    }
  }
  /** All'inizio del passo niente è ancora vero (o solo gli atomi `veri`). */
  const fonte = (veri: string[] = []): FontiDestinazione => ({
    vero: (a) => veri.includes(chiave(a)),
    raggiunto: (l) => veri.includes(`luogo:${l}`),
    dialogo: (id) => {
      const d = contenuti.dialoghi[id];
      return d ? { personaggio: d.personaggio, apertura: d.condizione === undefined ? null : parser.compila(d.condizione) } : null;
    },
    haCorpo: (p) => CORPI.includes(p),
    chiAccende: (x) => accende.get(x) ?? [],
    chiConta: (x) => conta.get(x) ?? [],
    capisaldiDellaCella: (id) => [...new Set(LATI.filter((l) => l.chiudibile && l.particelle.includes(Number(id))).flatMap((l) => [l.a, l.b]))],
    distanza: (cs, l) => {
      const a = CAPISALDI.find((x) => x.id === cs)!;
      const b = LUOGHI.find((x) => x.id === l)!;
      return surfaceDistance(a.z, a.theta, b.z, b.theta);
    },
  });
  // come la guida: le condizioni compilate, gli eventi di strada, le tappe scritte
  const tappe = (id: string, veri: string[] = []) => tappeDelPasso(compilaPasso(passi.get(id)!, (x) => parser.compila(x as never)), fonte(veri));
  const prima = (id: string, veri: string[] = []) => tappe(id, veri)[0];

  it('prologo: la busta, poi l’armadietto; la scala, poi la botola sopra; il muretto; la lettera e le campane ovunque', () => {
    expect(tappe('pr_cripta')).toEqual([
      { tipo: 'punto', id: 'busta_5' },
      { tipo: 'punto', id: 'armadietto_5' },
    ]);
    expect(tappe('pr_cripta', ['oggetto:lettera_marta'])).toEqual([{ tipo: 'punto', id: 'armadietto_5' }]);
    expect(tappe('pr_botola_scala').slice(0, 2)).toEqual([
      { tipo: 'luogo', id: 'cripta_scala' },
      { tipo: 'luogo', id: 'botola' },
    ]);
    // ci si siede ovunque all'aperto («flag:seduta»), ma il posto suggerito è il muretto
    expect(prima('pr_camminare')).toEqual({ tipo: 'luogo', id: 'belvedere_muretto' });
    // la lettera si apre da seduta dove si è, le campane si sentono da tutto il paese
    expect(tappe('pr_lettera')).toEqual([]);
    expect(tappe('pr_campane')).toEqual([]);
  });

  it('missione 1: il castagno, la terrazza, la piazza, i velati, Ottavio', () => {
    expect(prima('m1_lente')).toEqual({ tipo: 'luogo', id: 'castagno_morto' });
    // la terrazza non si raggiunge in linea retta: prima l'attacco della mulattiera (o della scorciatoia, con i gradini)
    expect(prima('m1_cartellino')).toEqual({ tipo: 'luogo', id: 'mulattiera_terrazze' });
    // «variante:E4=Abitata» (i gradini della scorciatoia) è un atomo di cella: chiave «cella:E4»
    expect(prima('m1_cartellino', ['cella:E4'])).toEqual({ tipo: 'luogo', id: 'scorciatoia_terrazze' });
    expect(prima('m1_cartellino', ['luogo:mulattiera_terrazze'])).toEqual({ tipo: 'luogo', id: 'castagno_cartellino' });
    // prima la Ripa di San Vigilio, da cui si salta; dopo la planata, la piazza
    expect(prima('m1_velo')).toEqual({ tipo: 'luogo', id: 'ripa_san_vigilio' });
    expect(tappe('m1_velo', ['flag:planata_fatta'])).toEqual([{ tipo: 'luogo', id: 'piazza_ore' }]);
    const velati = prima('m1_velati');
    expect(velati?.tipo).toBe('persone');
    expect([...(velati as Extract<Destinazione, { tipo: 'persone' }>).ids].sort()).toEqual(['annunciata', 'bambini', 'bortolo', 'nando', 'pina', 'togna']);
    // Ottavio scende quando Elvira è in piazza: prima la piazza
    expect(prima('m1_ottavio')).toEqual({ tipo: 'luogo', id: 'piazza_ore', chi: 'ottavio' });
    expect(tappe('m1_fienile').map((t) => ('id' in t ? t.id : ''))).toEqual(['passerella_messo', 'fienile_ottavio']);
    expect(prima('m1_mattino')).toEqual({ tipo: 'persona', id: 'ottavio' });
  });

  it('giorno 2 e 3: il guado e la piazza, la Bacheca, il campanaro, i chiodi, la passerella', () => {
    expect(tappe('m1_ritorno').slice(0, 2)).toEqual([
      { tipo: 'luogo', id: 'guado_sass' },
      { tipo: 'luogo', id: 'piazza_ore' },
    ]);
    expect(prima('m1_dono')).toEqual({ tipo: 'luogo', id: 'bacheca_ore', chi: 'clelia' });
    // il campanaro si cerca sul sagrato (non inseguito sulla scorciatoia); aperto il campanile, la cella
    expect(tappe('m1_campanile')).toEqual([
      { tipo: 'persona', id: 'bortolo', luogo: 'sagrato' },
      { tipo: 'luogo', id: 'cella_campanaria' },
    ]);
    expect(prima('m1_campanile', ['flag:campanile_aperto'])).toEqual({ tipo: 'luogo', id: 'cella_campanaria' });
    expect(tappe('m1_libretto')).toEqual([]);
    expect(prima('m1_chiodo2')).toEqual({ tipo: 'caposaldo', id: 'cs_2' });
    expect(prima('m1_primo_rilievo')).toEqual({ tipo: 'luogo', id: 'mulattiera_terrazze' });
    expect(prima('m1_primo_rilievo', ['luogo:mulattiera_terrazze'])).toEqual({ tipo: 'caposaldo', id: 'cs_3' });
    expect(tappe('m1_strada').slice(0, 2)).toEqual([
      { tipo: 'persona', id: 'ottavio' },
      { tipo: 'caposaldo', id: 'cs_7' },
    ]);
    // la passerella salvata nella notte (E1 Abitata): niente Ottavio, dritti al chiodo 7
    expect(prima('m1_strada', ['cella:E1'])).toEqual({ tipo: 'caposaldo', id: 'cs_7' });
    expect(tappe('m1_seconda_notte')).toEqual([{ tipo: 'luogo', id: 'fienile_ottavio' }]);
    expect(prima('m1_prova')).toEqual({ tipo: 'luogo', id: 'passerella_messo', chi: 'ottavio' });
    expect(tappe('lb_volo')).toEqual([]);
  });

  it('gioco libero: i Bugni passando dal Balcone dei Messi; davanti alla porta chiusa, niente', () => {
    expect(tappe('m2_aggancio')).toEqual([
      { tipo: 'luogo', id: 'balcone_messi' },
      { tipo: 'luogo', id: 'porta_bugni' },
    ]);
    expect(tappe('m2_aggancio', ['flag:atterrata_altra_valle'])).toEqual([{ tipo: 'luogo', id: 'porta_bugni' }]);
    expect(tappe('m2_aggancio', ['flag:atterrata_altra_valle', 'luogo:porta_bugni'])).toEqual([]);
  });

  it('ogni passo con un obiettivo ha un’indicazione, e i suoi segnaposto sono comandi del gioco', async () => {
    const { TASTI } = await import('../../src/regia/tasti');
    for (const m of contenuti.missioni) {
      for (const p of m.passi) {
        if (p.obiettivo === undefined || ['sfondo', 'segreto', 'indizio', 'easter_egg'].includes(m.tipo ?? '')) continue;
        expect(p.indicazione, `${m.id}/${p.id}`).toBeTruthy();
        for (const testo of [p.indicazione!, ...(p.indicazioniSe ?? []).map((x) => x.indicazione)]) {
          for (const [, k] of testo.matchAll(/\{(\w+)\}/g)) expect(TASTI, `${p.id}: {${k}}`).toHaveProperty(k!);
        }
      }
    }
  });
});
