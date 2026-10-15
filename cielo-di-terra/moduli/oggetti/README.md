# Modulo `oggetti` — oggetti 3D procedurali di «Cielo di Terra»

Libreria TypeScript + three.js (0.186.1) di oggetti procedurali nello stile scelto: forme grandi,
pulite e semplificate, silhouette forti, campiture quasi piatte con sfumature morbide nei colori per
vertice, toon morbido a tre toni con una leggera «pennellata» procedurale in shader. Nessuna texture
fotografica: le uniche texture sono generate in memoria (la rampa del toon e il gradiente radiale degli
aloni). Ogni oggetto è unito per materiale (1-3 draw call), deterministico per seme, con collider
semplici e un punto d'appoggio al suolo.

Oggetti:

1. **Rustico ticinese** in gneiss con tetto in piode (dimensioni, 1-3 piani, balcone sul fronte o sul
   fianco, gerani, ante, contorni a calce, scala esterna, timpano di legno, camino) e la stessa casa
   **smontata dalle Fade** (muri a gradoni con finestre vuote, trave appoggiata, piode e pietre a terra,
   cataste squadrate). Stesso seme e stesse opzioni = stessa pianta.
2. **Campanile romanico di San Vigilio**: lesene, archetti pensili, feritoie, cella con bifore e tre
   campane, terrazza sommitale con parapetto, cuspide di piode, botola d'uscita, **Pilastro 1** di
   bronzo (targa «1 / 2120», chiodo numerato) e palina bianca e rossa di 8 m.
3. **Castagno secolare** (estate, autunno, fioritura con amenti; LOD basso), **castagno morto** con
   radici scoperte e la **botola della Cripta** (apribile, animata).
4. **Muri a secco** lungo una spezzata o un arco (componibili, LOD basso, muro di sostegno),
   **scalette** (massicce o a sbalzo), **cancelli di legno** (animati).
5. **Fienile** in legno e pietra, **pontile** con la tavola dei venti (Tramontana/Inverna) e la
   lanterna, **barca a remi** con vela rossa al terzo e lanterna a prua (beccheggio, vela che si gonfia).
6. **Capisaldi**: chiodo d'ottone numerato (cifre in rilievo leggibili da vicino, anello di vernice)
   da solo, nel muro, su pilastrino o su masso; **pilastro di bronzo** con targa e segnale (palina o
   disco); **palina** 8-10 m su ometto con tiranti o su pilastro in muratura; lume di mira notturno.
7. **Prima persona**: lo **squadro a cannocchiale** di Aurelio con le mani guantate di Elvira (pose
   'mano', 'piantato', 'riposo', transizioni animate, maniche che seguono i polsi, anello al dito) e il
   **Velo** (traversa, tela cucita «traslucida», punti a croce, montanti legati, nappina a pendolo).
8. **Abitanti velati** senza volto: velo di garza tinto di noce, maschera di castagno intagliata (o
   liscia, la Madre), velo a rete da bugnera, cappuccio di lana, cappello a tesa larga; corporature
   (esile, media, robusta, anziana, bambino), posture, gerla, bastone. Una SkinnedMesh con 13 ossa,
   animazione procedurale: respiro, peso che si sposta, testa che si gira verso un punto, gesti
   (saluta, indica, mano al petto), camminata sul posto.
9. **Le Fade** (rame, ottone, smalto verde, lume caldo, rotore, pinza a tre griffe) che volano,
   danzano in cerchio e trasportano pietre; **sciame di Fade** istanziato; **api di rame** a sciame
   istanziato con scintille.
10. **Lanterne e lumi**: lampione su palo, lanterna a braccio da muro, appesa, a mano (petrolio), di
    prua, cappelletta votiva, lumino; finestre dei rustici accese di notte.

Più: posa sul cilindro con la convenzione del motore, conversione dei collider nel formato del motore,
istanziazione e unione di oggetti statici, adattatore al materiale del mondo del motore, misure di costo.

## Struttura

```
moduli/oggetti/
  src/
    index.ts          API pubblica (riesporta tutto)
    tipi.ts           OggettoProcedurale, Collider, Ingombro
    rng.ts            Rng (mulberry32) e semi
    palette.ts        PALETTE (Ticino d'autunno)
    materiali.ts      canali di materiale, toon, pennellata, intensità dei lumi
    costruttore.ts    Costruttore: unisce pezzi per materiale con colore per vertice (e pesi delle ossa)
    forme.ts          geometrie di base (massi, lastre, tubi, masse di fogliame, estrusioni…)
    comune.ts         risultato standard, aloni, luci, collider, smorzamento
    cilindro.ts       posa sul cilindro e collider nel mondo (convenzione del motore)
    istanze.ts        istanzia / unisciStatici
    integrazione.ts   aColor per il materiale del motore
    misure.ts         triangoli e draw call stimati
    catalogo.ts       tutte le voci con configurazioni tipiche (vetrina e test)
    oggetti/          rustico, campanile, castagno, muri, fienile, lago, caposaldo, primaPersona,
                      abitante, fade, lumi, dettagli (finestre, porte, balconi, tetti in piode…)
  test/oggetti.test.ts  84 test (vitest)
  vetrina/            scena di prova (npm run dev): index.html, main.ts, ambiente.ts
  scripts/schermate.mjs Playwright: schermate in shots/ e misure in shots/misure.{json,md}
  shots/              26 schermate + misure
```

Comandi: `npm install`, `npm test`, `npm run typecheck`, `npm run dev` (vetrina su
http://127.0.0.1:5181/?vista=insieme), `npm run shots` (tutte le viste e le misure; si possono passare
nomi di viste: `node scripts/schermate.mjs rustici fade`), `npm run misure` (solo misure).

## Convenzioni

- Metri; coordinate **locali**; **«su» = +Y**; il suolo è y = 0; l'appoggio è l'origine.
- Il **davanti** degli oggetti (porta del rustico, del campanile e del fienile, prua della barca,
  viso degli abitanti) guarda **+Z**. Il pontile parte dalla riva (origine) verso +Z; y = 0 è il pelo
  dell'acqua per pontile e barca.
- Le geometrie scendono sotto y = 0 di `ingombro.interrata` (fondazioni, pali, radici) per coprire i
  pendii.
- **Collider** in coordinate locali: `box` (centro, semiassi, `rotY` attorno a Y) e `cilindro`
  verticale (centro della base, raggio, altezza), con `tag`: `muro`, `tetto`, `calpestabile`,
  `arrampicabile`, `scala`, `tronco`, `caposaldo`, `palina`, `botola`, `cancello`, `barca`, `bitta`,
  `personaggio`, `macerie`, `palo`, `oggetto`.
- **Punti notevoli** (`punti`): `porta`, `colmo`, `camino` (per il fumo), `balcone`, `scala`,
  `chiodo` (dove si pianta lo squadro), `cima` (della palina), `lume`, `terrazza`, `botola`,
  `fiamma`, `seduta`, `prua`, `lanterna`, `nappina`, `puntaleInPiantato`…
- **Canali di materiale** (`mesh.userData.canale`): `opaco` (toon, FrontSide), `sottile` (DoubleSide:
  vele, veli, tela, bandierine, ali), `lume` (non illuminato: vetri, fiamme, finestre), più gli sprite
  `alone` (additivi). `impostaIntensitaLumi(k)` accende tutto: 0 giorno, 1 notte.

## API pubblica (firme)

```ts
// --- tipi
type Vec3 = [number, number, number];
type Collider =
  | { tipo: 'box'; centro: Vec3; mezze: Vec3; rotY?: number; tag?: string }
  | { tipo: 'cilindro'; base: Vec3; raggio: number; altezza: number; tag?: string };
interface Ingombro { raggio: number; altezza: number; interrata: number }
interface OggettoProcedurale<S = undefined> {
  nome: string; seme: number; gruppo: THREE.Group; collider: Collider[];
  appoggio: THREE.Vector3; ingombro: Ingombro; punti: Record<string, THREE.Vector3>;
  update?(dt: number, stato?: S): void;   // solo per gli oggetti animati
  dispose(): void;                         // libera le geometrie (i materiali sono condivisi)
}
type Seme = number | string;
class Rng { constructor(seme?: Seme); next(): number; tra(a, b): number; intero(a, b): number;
  prob(p): boolean; centrato(a): number; scegli<T>(l: readonly T[]): T; derivato(etichetta: string): Rng }

// --- generatori
creaRustico(opz?: { seme?; larghezza?; profondita?; piani?: 1|2|3; pendenza?; balcone?: 'fronte'|'lato'|'nessuno';
  gerani?: number; finestreAccese?: number; camino?: boolean; scalaEsterna?: boolean; timpanoLegno?: boolean;
  smontato?: boolean; crollo?: number; dettaglio?: 'alto'|'medio'|'basso'; interrata?: number }): OggettoProcedurale
creaCampanile(opz?: { seme?; lato?; altezzaFusto?; ordini?; palina?: boolean; altezzaPalina?; aperture?: 2|3 }): OggettoProcedurale
creaCastagno(opz?: { seme?; altezza?; larghezzaChioma?; stagione?: 'estate'|'autunno'|'fioritura'; masse?;
  ricci?: boolean; dettaglio?: 'alto'|'basso' }): OggettoProcedurale
creaCastagnoMorto(opz?: { seme?; altezza?; cripta?: boolean; apertaAllInizio?: boolean }): OggettoProcedurale<StatoBotola>
creaBotolaCripta(opz?: { seme?; apertaAllInizio?: boolean; boccaBuia?: boolean }): OggettoProcedurale<StatoBotola>
  // StatoBotola = { aperta: boolean }
creaMuroSecco(opz?: { seme?; percorso?: Array<[x, z]>; lunghezza?; raggioCurva?; altezza?; spessore?; scarpa?;
  terrapieno?: boolean; pietra?: number; dettaglio?: 'alto'|'basso'; interrata? }): OggettoProcedurale
creaScaletta(opz?: { seme?; tipo?: 'gradini'|'sbalzo'; gradini?; alzata?; pedata?; larghezza?; spallette?: boolean }): OggettoProcedurale
creaCancello(opz?: { seme?; larghezza?; altezza?; pilastri?: 'pietra'|'legno'; apertura?: number }): OggettoProcedurale<StatoCancello>
  // StatoCancello = { aperto: boolean }
creaFienile(opz?: { seme?; larghezza?; profondita?; altezzaStalla?; altezzaFienile?; pendenza?; fieno?: boolean; interrata? }): OggettoProcedurale
creaPontile(opz?: { seme?; lunghezza?; larghezza?; altezza?; profondita?; tavolaVenti?: boolean; luce?: boolean }): OggettoProcedurale<{ accesa?: number }>
creaBarca(opz?: { seme?; lunghezza?; vela?: 'alzata'|'ammainata'|'nessuna'; coloreScafo?: number; remi?: boolean;
  lanterna?: boolean; luce?: boolean }): OggettoProcedurale<StatoBarca>
  // StatoBarca = { vento?: number /*0-1*/; mura?: 1|-1; onda?: number }
creaCaposaldo(opz: { numero: number; seme?; supporto?: 'nessuno'|'muro'|'pilastrino'|'masso'; segno?: boolean; scala?: number }): OggettoProcedurale
creaPilastro(opz: { numero: number; seme?; segnale?: 'palina'|'disco'|'nessuno'; altezzaSegnale?; inclinazione?; lumeDiMira?: boolean }): OggettoProcedurale
creaPalina(opz?: { seme?; altezza?; banda?; base?: 'ometto'|'pilastro'|'nessuna'; bandierina?: boolean; numero?; lumeDiMira?: boolean }): OggettoProcedurale
creaCaposaldoDaContenuto(v: { numero: number; tipo: string; nome?; luogo?; altezza_segnale?; note?; lume? }): OggettoProcedurale
creaSquadroPrimaPersona(opz?: { seme?; posa?: 'mano'|'piantato'|'riposo' }): OggettoProcedurale<StatoSquadro>
  // StatoSquadro = { posa?: PosaSquadro; passo?: number /*0-1*/; mira?: number /*0-1*/ }
  // PUNTALE_PIANTATO (Vector3, spazio camera) = dove sta la punta dello squadro nella posa 'piantato'
creaVeloPrimaPersona(opz?: { seme?; tela?: number }): OggettoProcedurale<StatoVelo>
  // StatoVelo = { deriva?: number /*-1..1*/; vento?: number /*0-1*/; rollio?: number /*rad*/ }
creaAbitante(opz?: { seme?; copricapo?: 'velo'|'maschera'|'maschera-liscia'|'apicoltore'|'cappuccio'|'cappello';
  corporatura?: 'esile'|'media'|'robusta'|'anziana'|'bambino'; postura?: 'eretta'|'curva'|'mani-giunte'|'braccia-conserte'|'mani-dietro';
  colore?: number; coloreVelo?: number; gerla?: boolean; bastone?: boolean; guanti?: boolean }): OggettoProcedurale<StatoAbitante>
  // StatoAbitante = { modo?: 'fermo'|'cammina'; velocita?: number; guarda?: Vector3|null /*MONDO*/;
  //                   gesto?: 'nessuno'|'saluta'|'indica'|'mano-al-petto'; indica?: Vector3|null /*MONDO*/ }
creaFada(opz?: { seme?; scala?; pietra?: boolean; luce?: boolean; scia?: boolean }): OggettoProcedurale<StatoFada>
  // StatoFada = { modo?: 'libra'|'cerchio'|'trasporta'; da?: Vector3; a?: Vector3; centro?: Vector3; raggio?; quota?; velocita? }
  // (punti in coordinate del gruppo della Fada: macchina e pietra si muovono dentro il gruppo)
creaSciameFade(opz?: { seme?; numero?; centro?: Vector3; raggio?; quota?; conPietra?: number; scala? }): OggettoProcedurale<{ centro?: Vector3 }>
creaSciameApi(opz?: { seme?; numero?; raggio?; dimensione?; centro?: Vector3 }): OggettoProcedurale<StatoApi>
  // StatoApi = { centro?: Vector3; agitazione?: number /*0-1, impazzite*/ }
creaLanterna(opz?: { tipo?: 'palo'|'muro'|'appesa'|'mano'|'prua'|'nicchia'; seme?; luce?: boolean; alone?: boolean; altezza? }): OggettoProcedurale<StatoLume>
creaLumino(seme?: Seme): OggettoProcedurale<StatoLume>      // StatoLume = { accesa?: number }

// --- materiali e luce
impostaMateriali(nuovi: Partial<{ opaco; sottile; lume: Material; alone: SpriteMaterial }>): void  // prima di generare
reimpostaMateriali(opz?: { pennellata?: boolean; toni?: number }): void
impostaIntensitaLumi(k: number): void      // 0 giorno … 1 notte (vetri, finestre, aloni, luci)
leggiIntensitaLumi(): number
materiali(): SetMateriali;  creaMaterialiPredefiniti(opz?): SetMateriali;  aggiungiPennellata(mat, forza?): void

// --- cilindro (stessa parametrizzazione di src/world/cylinder.ts)
R_CILINDRO = 646; L_CILINDRO = 3000; PERIODO_ROTAZIONE = 51
terna(thetaGradi): { su; est; nord }
puntoCilindro(z, thetaGradi, h?, R?): Vector3
matriceSuperficie(z, thetaGradi, h?, yawGradi?, scala?, R?): Matrix4   // yaw 0 = davanti a nord (Lag), 90 = est (Mane)
posaSulCilindro(obj: Object3D, z, thetaGradi, h?, yawGradi?, R?): Object3D
colliderAlMondo(c: Collider, matrice: Matrix4): ColliderMondo        // formato di src/world/colliders.ts (senza id)

// --- prestazioni e integrazione
istanzia(oggetto: OggettoProcedurale<unknown> | Object3D, matrici: Matrix4[]): Group   // InstancedMesh per materiale + punti per gli aloni
unisciStatici(voci: Array<{ oggetto; matrice: Matrix4 }>): Group                       // una mesh per materiale
adattaAlMotore(radice: Object3D, m: { oggetto: Material; oggettoDoppio?: Material; istanze?: Material }): number
aggiungiAColor(geo: BufferGeometry, emissione?: 'nessuna'|'da-colore'|number): void
misura(radice: Object3D, comprendiInvisibili?: boolean): { triangoli; drawCall; mesh; perCanale }
CATALOGO: Array<{ nome: string; crea(): OggettoProcedurale<unknown>; nota?: string }>

// --- mattoni per altri generatori
class Costruttore { constructor(rng?: Rng | number); aggiungi(geo, opz: OpzioniPezzo): this; box(...): this;
  geometria(canale): BufferGeometry | null; costruisci(nome, ombre?): Group; mesh(nome, canale?, ombre?): Mesh | null; triangoli(): number }
mat(pos?, rot?, scala?): Matrix4;  matSegmento(a, b, scalaXZ?): Matrix4;  mescola(a, b, t): Color;  PALETTE
manoPresa(b, m, rc, opz?): Vector3;  manoAppoggiata(b, m): Vector3;  testaLanterna(b, m, s?, metallo?): Vector3
lanternaPetrolio(b, m, s?): Vector3;  testaChiodo(b, m, num, scala?): void;  aggiungiPalina(b, a, h, banda?, raggio?, bandierina?): Vector3
incidiNumero(b, testo, m, h, colore, spessore?, canale?): void   // cifre a sette segmenti
```

Tutti i generatori sono deterministici: stesse opzioni + stesso seme = stessa geometria (testato).

## Integrazione nel gioco

1. **Spostare** la cartella in `cielo-di-terra/src/oggetti/` (nessuna dipendenza esterna oltre a
   `three`; nessun percorso assoluto; l'unico import di three/addons è `BufferGeometryUtils`).
2. **Posare** un oggetto: `posaSulCilindro(o.gruppo, z, theta, h, yaw)` oppure
   `o.gruppo.matrix = matriceSuperficie(...)`. Attenzione: le geometrie del motore guardano −Z, queste
   +Z; con `surfaceMatrix` del motore va aggiunto 180° allo yaw.
3. **Collider**: `for (const c of o.collider) world.colliders.add({ ...colliderAlMondo(c, o.gruppo.matrixWorld), id: -1 })`
   (il formato coincide con `BoxCollider`/`CylinderCollider` del motore). I collider di botola e
   cancello descrivono lo stato chiuso: aprendo, il motore disattiva il collider con tag `botola`/`cancello`.
4. **Materiali del motore**: `adattaAlMotore(o.gruppo, { oggetto: worldObjectMat, oggettoDoppio: worldObjectMatDoubleSide })`
   aggiunge `aColor` (sRGB + emissione notturna: i vetri e le finestre accese hanno a ≈ 1, quelle
   buie 0) e sostituisce i materiali. Le **SkinnedMesh** degli abitanti restano con il materiale della
   libreria (lo shader del motore non ha lo skinning: bastano i chunk `skinning_*` per adottarlo), così
   come gli sprite e i punti degli aloni. In alternativa si chiama `impostaMateriali(...)` prima di
   generare.
5. **Giorno/notte**: ogni fotogramma `impostaIntensitaLumi(notte)` (0..1, anche valori intermedi alla
   brace e all'alba).
6. **Animati**: chiamare `o.update(dt, stato)` (abitanti, Fade, sciami, barche, cancelli, botola,
   lanterne per il tremolio, prima persona). Gli abitanti camminano sul posto: lo spostamento lo fa il
   motore.
7. **Prima persona**: `camera.add(squadro.gruppo)`; near plane ~0.02; le mesh hanno `renderOrder = 5`
   (il motore può disegnarle in un secondo passaggio per evitare compenetrazioni). Per allineare la
   camera al chiodo nella posa 'piantato': `camera.position = chiodoMondo − PUNTALE_PIANTATO ruotato
   dalla camera` (vedi la vetrina).
8. **Prestazioni**: per i paesi usare `istanzia` (varianti ripetute) o `unisciStatici` per particella
   (40 m); per la distanza ci sono i LOD `dettaglio: 'basso'` di rustici, castagni e muri; Fade e api
   in massa con gli sciami istanziati.
9. **Contenuti**: `creaCaposaldoDaContenuto(voce)` legge le voci di `content/capisaldi.json` (pilastri
   con palina o disco alta `altezza_segnale`, chiodi nel muro, su masso, su cippo o nudi; `lume` dei
   capisaldi lontani → lume di mira). Il Pilastro 1 è già compreso in `creaCampanile` (terrazza
   accanto alla cuspide, palina 8 m, come in `docs/design/FASE1.md`).

## Misure (triangoli e draw call per oggetto)

Misurate nella vetrina con `renderer.info` (WebGL2 SwiftShader), un oggetto alla volta, di notte (aloni
compresi), senza ombre; la stima senza GPU di `misura()` coincide. File: `shots/misure.json`, `shots/misure.md`.

| oggetto | triangoli | draw call | collider |
|---|---:|---:|---:|
| rustico 1 piano | 1098 | 2 | 4 |
| rustico 2 piani, balcone sul fronte | 2874 | 2 | 6 |
| rustico 3 piani, balcone sul fianco | 3756 | 2 | 4 |
| rustico 2 piani, dettaglio basso | 1778 | 2 | 6 |
| rustico smontato dalle Fade | 2496 | 1 | 18 |
| campanile di San Vigilio | 2650 | 3 | 8 |
| castagno vivo (estate / autunno / fioritura) | 2581 / 3209 / 3449 | 1 | 1 |
| castagno vivo, dettaglio basso | 981 | 1 | 1 |
| castagno morto + botola della Cripta | 2643 | 3 | 2 |
| botola della Cripta (sola) | 790 | 2 | 1 |
| muro a secco 14 m curvo / dettaglio basso | 4004 / 1258 | 1 | 7 |
| muro di sostegno 10 m (terrapieno) | 1896 | 1 | 5 |
| scaletta 7 gradini / a sbalzo | 264 / 84 | 1 | 7 |
| cancello di legno | 204 | 2 | 3 |
| fienile | 2012 | 2 | 3 |
| pontile 14 m | 1176 | 3 | 3 |
| barca a remi con vela rossa | 1270 | 5 | 1 |
| chiodo d'ottone (solo) / nel muro / su pilastrino | 352 / 1048 / 436 | 1 | 0-1 |
| pilastro di bronzo con palina | 789 | 2 | 2 |
| palina 9 m su ometto | 855 | 2 | 2 |
| squadro in prima persona (piantato / in mano) | 1764 / 1888 | 5 | – |
| Velo in prima persona | 3806 | 4 | – |
| abitante (velo / maschera / apicoltore) | 802 / 898 / 1054 | 1 / 1 / 2 | 1 |
| Fada singola (con pietra) | 806 | 7 | – |
| sciame di 24 Fade (istanziato) | 19416 | 5 | – |
| sciame di 160 api di rame (istanziato) | 7040 | 3 | – |
| lampione / lanterna a muro / a mano / cappelletta / lumino | 440 / 262 / 370 / 155 / 78 | 3 | 0-1 |

Le 3 draw call delle lanterne sono: opaco, lume, alone. La Fada singola ne ha 7 (corpo, vetro, rotore,
3 griffe, pietra) più l'alone: serve per i primi piani; in massa si usa lo sciame (5 in tutto).

## Test

`npm test` (vitest, 84 test, tutti verdi): per ogni voce del catalogo geometria finita e senza NaN,
determinismo per seme, collider validi, canale di materiale dichiarato, un minuto di `update` senza NaN;
budget di triangoli e draw call; varianti per seme e stagione; rustico intero e smontato con la stessa
pianta; collider orientati dei muri lungo la spezzata; botola che si apre e si chiude; Fada che porta
la pietra da A a B; abitante che gira la testa e cammina; squadro che passa da 'mano' a 'piantato';
nappina che pende dalla parte della deriva; convenzione del cilindro (posizione, terna, yaw);
`colliderAlMondo`; `istanzia` e `unisciStatici`; `adattaAlMotore` (aColor ed emissione);
`creaCaposaldoDaContenuto`; Rng. `npm run typecheck` pulito (TypeScript 7, strict).

## Schermate (shots/)

`insieme`, `notte`, `rustici`, `smontato`, `campanile`, `cella`, `castagni`, `cripta`, `muri`,
`cancello`, `lago`, `barca`, `fienile`, `capisaldi`, `chiodo`, `palina`, `abitanti`, `velati`,
`squadro-piantato`, `squadro-mano`, `velo`, `fade` (notte), `fade-vicino` (notte), `fada-giorno`,
`api`, `lanterne` (notte).

## Cosa resta da fare

- Lo **sfondo della vetrina** (prato, cielo, acqua) è solo di prova: nel gioco l'ambiente è del motore.
- Lo **shader del motore** non ha lo skinning: per gli abitanti tenere il materiale della libreria o
  aggiungere i chunk di skinning al materiale del mondo (e la variante matita).
- **Animazioni** degli abitanti: niente IK dei piedi sui pendii né rotazione verso la direzione di
  marcia (le fa il motore); i gesti sono con la destra. Le ossa dei droni Uè/Dué/Lué non sono qui.
- **Fade**: la macchina a stati del trasporto è pensata per la vetrina e per le missioni; il «giro
  delle Fade» (orari per particella) e il passaggio fra rustico intero e smontato vanno pilotati dal
  motore (le due versioni hanno la stessa pianta; le pietre a terra della versione smontata sono i
  `da`/`a` naturali).
- **Botola**: la bocca buia nasconde il terreno se il motore non vi apre un foro (`boccaBuia: false`
  quando il foro c'è).
- **LOD**: rustici, castagni e muri hanno un livello «basso»; servono impostori per i castagni oltre
  ~150 m e per la valle sopra la testa.
- Le **cifre** sono a sette segmenti: per scritte vere (targa del Pilastro 1, tavola dei venti) servono
  decal o texture del motore.
- Altri oggetti delle zone non richiesti qui: grà fumanti, mulino, Torre dei Bugni e arnie, piroscafo
  Locarno, nicchie dei pellegrini delle Finestre, kit del Guscio.
