# popolamento: la Corbella vera

Modulo che posa nel mondo del motore (fase 1A) il paese di Corbella secondo i contenuti
(`content/luoghi.json`, `capisaldi.json`, `personaggi.json`, `fade_fase1.json`, `testi.json`). Usa la
libreria di oggetti stilizzati (`moduli/oggetti`, già copiata identica in `src/oggetti`) e toglie il
paese segnaposto del motore senza toccare `src/`.

Contenuto:

- **San Vigilio**: campanile bianco (cella a 24 m dal suolo, tre campane, altoparlante, Pilastro 1
  con targa e palina di 8 m), chiesa su ripiano, sagrato a gradini con il chiodo 2, tasso di 19 m
  (copre il lato 2-1), panca di Annunciata.
- **Piazza delle Ore**: meridiana a mosaico, Bacheca, telo dell'Ombrista, gradinata, 5 lampioni,
  3 panche, lavatoio con la tettoia (copre il lato 5-1) e il chiodo 5.
- **58 rustici** in file intorno alla piazza e lungo i sentieri, più la casa di Pina (con la
  scatola) e la Casa del Velo (velo nero, grate).
- **Cripta**: castagno morto (12,5 m, ramo vivo a Mane, amenti, ricci, radici), botola animata,
  cippo con il chiodo 11, muretto del belvedere. Sotto c'è l'interno (corridoio, sala a volta,
  7 capsule, luce color miele), nascosto: lo mostra l'integratore.
- **Terrazze**: Terrazza Pedrazzini (ripiano con muro, chiodo 3 sulla copertina, castagni da frutto,
  castagno del cartellino con la targhetta di zinco) e i tre muri del Velo (Muretto 3,5 m,
  Muraglione della Grà con la grà, Ripa di San Vigilio 12 m sopra la piazza).
- **2,8 km di muri a secco** lungo le alzate dei gradoni del motore (tracciati sulle curve di
  livello, con il riempimento erboso e i collider), oltre ai sentieri con gradini automatici dove la
  pendenza supera il passo del controller.
- **Ronchi**: 4 casupole, orto, mulino con la ruota, ponte del Mulino, guado, fienile di Ottavio
  con la finestrella, Sass dal Messo con il chiodo 8.
- **Capisaldi**: un chiodo d'ottone su ogni caposaldo di `rete_corbella` (cs_1…cs_11, cs_37, cs_42).
  Pilastri 4 (disco) e 6 (palina sul masso), la Grà di Pian con il chiodo 37 nell'angolo, la legnaia
  e il fumo dalle 6 alle 10, il Balcone dei Messi con il Pilastro 42, il capanno e il motto. I
  pilastri lontani (`lontani_di_notte`) hanno i lumi permanenti grandi, e quelli sulle Finestre
  stanno su piloni di ferro.
- **Elementi mobili E1-E4** (`fade_fase1.json`) con tutte le varianti costruite e
  `setVariante`.
- **Notte**: finestre e lanterne accese (lumi del motore), le Fade (due sciami della libreria che
  seguono il giro dalle 22:05 alle 04:30) e la lanterna di Tecla sulla Finestra delle Vedove
  (23:00-02:00).
- **Personaggi**: una figura della libreria per ogni personaggio con un corpo, più 12 velati. Ogni
  personaggio ha una maniglia `npc(id)` e segue gli orari dei contenuti.

## Comandi

Tutti dalla cartella `moduli/popolamento` (nessuna dipendenza propria: usa `node_modules` della
radice; `three` è forzato alla copia della radice in vite/vitest perché `moduli/oggetti` ne ha una
sua).

```sh
npm test            # vitest: 20 test in Node, con il paese segnaposto vero del motore
npm run typecheck   # tsc --noEmit
npm run dev         # demo nel motore vero: http://localhost:5190/?ora=21.5 (?segnaposto lo lascia)
npm run build:demo  # build della demo in dist-demo/
npm run shots       # build + Chromium (SwiftShader) + screenshot in shots/ (--only nome, --no-build)
```

Nella demo, `window.__CORBELLA__` è la maniglia e `window.__GAME__` è l'API di debug del motore.
Quando un punto d'interazione è vicino compare il suggerimento «E».

## API

```ts
import { installaCorbella } from './popolamento';

const corbella = installaCorbella(game, opzioni?); // dopo `await game.init()`
```

`game` è il `Game` del motore. Il modulo usa solo `scene`, `world.colliders`, `lamps` e, se ci
sono, `uniforms`, `materials`, `vegetation`, `sky`, `clock` e `update` (vedi `GiocoCorbella` in
`src/tipi.ts`).

### `OpzioniCorbella`

| opzione | predefinito | |
|---|---|---|
| `segnaposto` | `'rimuovi'` | `'tieni'` lascia il paese segnaposto (per i confronti) |
| `agganciaCiclo` | `true` | avvolge `game.update` per animare abitanti, botola, Fade e fumo; `false` se chiami tu `corbella.update(dt)` |
| `orari` | `true` | i personaggi seguono gli orari di `personaggi.json` (ora da `game.sky.hours`) |
| `giorno` | `1` | giorno di gioco iniziale per gli orari |
| `varianti` | `variante_iniziale` | varianti iniziali, es. `{ E2: 'Abitata' }` |
| `muriTerrazze` | `true` | `false` toglie i 2,8 km di muri delle terrazze (paese più leggero) |
| `luciAbitanti` | `true` | emisfero + direzionale per il materiale toon dei personaggi, guidati da `game.sky`; `false` se la scena ha già le sue luci (la regia ne aggiunge) |

### `ManigliaCorbella`

```ts
radice: Group                                   // 'corbella': tutto il popolamento
punti: ReadonlyMap<string, PuntoInterazione>
punto(id): PuntoInterazione | undefined
puntiVicini(pos: Vector3, raggioMax?): PuntoInterazione[]   // attivi, entro il loro raggio, dal più vicino
npc(id): ManigliaNpc | undefined                // id di personaggi.json, velato_1..12, 'bambini', 'velati_corbella'
personaggi: ReadonlyMap<string, ManigliaNpc>
applicaOrario(giorno, ora): Record<string, string>   // id → dove l'ha messo (per i log)
giorno: number                                  // leggibile e scrivibile
setVariante(elementoId: 'E1'|'E2'|'E3'|'E4', variante: string): void   // lancia un errore se l'id o la variante non esistono
variante(elementoId): string | undefined
elementi: ReadonlyMap<string, ManigliaElemento>  // { id, nome, variante, varianti[], particelle[] }
cripta: Cripta                                  // { apriBotola, botolaAperta, botola{z,theta,h}, sala{z,theta,h}, interno: Group, colliderBotola }
apriBotola(aperta: boolean): void               // anima la botola e toglie o rimette il suo collider
notte: Notte                                    // { sciami, fade: boolean|null (forza), tecla {pos, visibile}, update, dispose }
chiodo(id: 'cs_3' | 3): Vector3 | null          // il chiodo d'ottone (dove si pianta lo squadro)
segnale(id): Vector3 | null                     // cima del segnale: palina, disco o lume lontano; sui chiodi la biffa a 1,2 m
capisaldi: readonly string[]                    // id con un segnale (rete + lontani + cs_0)
collider(): VoceCollider[]                      // { collider, tag, luogo? } aggiunti al mondo (varianti attive comprese)
lumi: readonly Vector3[]                        // lumi del popolamento (già passati a game.lamps)
statistiche: StatisticheCorbella
update(dt): void
dispose(): void                                 // toglie scena, collider e lumi, rimette game.update e i lumi del motore
```

### `ManigliaNpc`

```ts
id, nome, figura: Group | null, presente, luogo: string | null, punto: PuntoInterazione | null
posizione(): { z, theta, h } | null
vaiA(z, theta, { h?, yaw?, sopra? }?)           // teletrasporto sul suolo (o a quota h)
orientaVerso({ z, theta })                       // gira il corpo
guarda(Vector3 | {z,theta,h} | null)             // la testa segue un punto; null = avanti
gesto('saluta' | 'indica' | 'mano-al-petto' | 'nessuno', durata = 0, indica?)
posa('in-piedi' | 'seduto' | 'chino')
cammina({z,theta} | {z,theta}[], velocita = 1.1): Promise<void>   // sul suolo, a tappe; si risolve all'arrivo
ferma(); inCammino; mostra(on)
manuale: boolean                                 // true: gli orari non lo spostano più
```

Le figure tengono il materiale toon della libreria (con lo skinning). Il punto «parla» segue la
figura. Le maniglie di gruppo (`bambini`, `velati_corbella`) muovono tutti i loro membri. Non hanno
un corpo nella Fase 1: Elvira (è il giocatore), Meridiana (voce: il suo punto è `parla:meridiana`
nella cella), Aurelio, Marta, lo sconosciuto del vetro, la Pesarina. La Madre e Rosa hanno la
figura ma stanno fuori scena finché i contenuti non le chiamano. Le Fade e Tecla vivono in
`corbella.notte`.

### Punti d'interazione (102)

`PuntoInterazione = { id, azione, etichetta, pos: Vector3, cil: {z,theta,h}, raggio, luogo?, rif?, attivo }`.
Gli id sono `azione:oggetto`. Con l'asterisco i punti che partono non attivi (li accendono le
varianti, gli orari o la storia):

| azione | id |
|---|---|
| `pianta_squadro` | `chiodo:1` `chiodo:2` `chiodo:3` `chiodo:4` `chiodo:5` `chiodo:6` `chiodo:7` `chiodo:8` `chiodo:11` `chiodo:37` `chiodo:42` (il `rif` è `cs_N`) |
| `leggi` | `leggi:bacheca_ore` `leggi:targa_p1` `leggi:lettere_sorella` `leggi:cartellino_castagno` `leggi:motto_messi` `leggi:casa_nando` |
| `lente` | `lente:corteccia` `lente:ricci` `lente:amenti` `lente:cippo` `lente:innesto_vecchio` |
| `esamina` | `esamina:lavatoio` `esamina:tasso` `esamina:castagno_morto` `esamina:terrazza_pedrazzini`* `esamina:ruota_mulino` |
| `apri` | `apri:botola` `apri:porta_campanile` `apri:porta_san_vigilio` `apri:casa_del_velo` `apri:porta_mulino` |
| `entra` / `scendi` / `dormi` | `entra:fienile_ottavio` `entra:cripta`* `scendi:campanile` `dormi:fienile_ottavio` `dormi:casa_del_velo`* |
| `parla` | `parla:<id personaggio>` (ottavio, pina, togna, bortolo, annunciata, nando, lisa, gioanin, velato_1..12, clelia*, la_madre*, rosa*), `parla:meridiana` |
| `siediti` | `siediti:gradinata` `siediti:panca_piazza_0..2` `siediti:panca_san_vigilio` `siediti:belvedere` `siediti:sass_messo` `siediti:passerella`* |
| `taglia` / `innesta` / `prendi` | `taglia:ramo_vivo` `innesta:castagno_cartellino` `prendi:assi_riva` |
| `lancio_velo` | `lancio_velo:muretto_terrazza` `lancio_velo:muraglione_gra` `lancio_velo:ripa_san_vigilio` `lancio_velo:balcone_messi` |
| `attraversa` | `attraversa:ponte_mulino`* `attraversa:guado_sass`* `attraversa:passerella`* `attraversa:breccia_ronco`* `sentiero:scorciatoia`* |
| `guarda` | `guarda:telo_ombrista` `guarda:scatola_pina` `guarda:letto_nando` `guarda:assi_terrazza` `guarda:palina_p1`* `guarda:finestrella_fienile`* `guarda:bocca_ronco`* `guarda:bocca_terrazze`* `sentiero:mulattiera`*; `appunta:cs_N`* per i pilastri lontani e `appunta:cs_0` (il disco della Lanterna) |

### Collider etichettati

Sono tutti nel `ColliderWorld` del motore e li elenca `corbella.collider()` (con `tag` e `luogo`):
`muro` (2168), `gradino` (233), `tetto` (133), `casa` (107), `porta` (62), `calpestabile` (57, i
ripiani: ci si cammina sopra), `caposaldo` (27), `scala` (19), `arrampicabile` (15), `palo` (7),
`tronco` (7), `chiodo` (6), `oggetto` (5), `panca` (4), `botola`, `chioma` (il tasso), `roccia`.
Gli abitanti hanno un collider a cilindro che li segue.

### Elementi mobili

| id | nome | varianti | iniziale | particelle |
|---|---|---|---|---|
| E1 | Passerella del Messo | Abitata / Carta | Carta | 2797, 2798 |
| E2 | Casa di Nando | Abitata / Smontata / Carta | Smontata | 2796 |
| E3 | Muro di Ronco | Carta / Abitata | Carta | 2699 |
| E4 | Scorciatoia delle Terrazze | Abitata / Carta | Carta | 2311, 2407 |

`setVariante` cambia la visibilità, toglie i collider della variante vecchia e mette quelli della
nuova, accende o spegne i punti della variante (per esempio `attraversa:passerella`) e i suoi lumi.

### Adattatore per la regia: `portaPopolamento(corbella)`

Implementa la `PortaPopolamento` di `src/regia/porte.ts` e i metodi del segnaposto
`src/regia/scena/segnaposto.ts` che la regia usa (`punto`, `idPunti`, `mostraVariante`,
`apriBotola`, `update`, `lumi`). Così la regia passa al popolamento senza cambiare i suoi id:

- `chiodo_cs_N` e `segnale_cs_N` corrispondono a `corbella.chiodo()` e `corbella.segnale()`;
- `castagno_morto`, `lente_corteccia`, `lente_ricci`, `lente_amenti`, `ramo_vivo`, `botola`,
  `lente_cippo`, `muretto`, `castagno_cartellino`, `cartellino`, `lente_innesto_vecchio`,
  `innesto`, `fienile`, `bacheca`, `telo`, `scatola_pina`, `porta_campanile`, `passerella` e
  `casa_nando` corrispondono ai punti del popolamento (`ALIAS_SEGNAPOSTO`);
- anche gli id del popolamento (`parla:ottavio`…) funzionano così come sono;
- `mostraVariante` ignora le varianti sconosciute e `pezzi` (ogni variante porta già i suoi pezzi);
- `lumi` è vuoto, perché i lumi sono già in `game.lamps`.

### Altre esportazioni

- `rimuoviSegnaposto(game)`, `liberaCastagni(game, occupato)`, `filtraLumi`, `dentroCorbella(p)` e
  `RIQUADRO_CORBELLA` (z 860-1260, θ 0-90, h < 160): sono usate da `installaCorbella`, ma si possono
  chiamare anche da sole.
- I tipi `GiocoCorbella`, `PuntoInterazione`, `AzionePunto`, `PosCil`, `GestoNpc`, `PosaNpc`,
  `ManigliaNpc`, `ManigliaElemento`, `Cripta`, `Notte`, `VoceCollider` e `PortaCorbella`.

## Come si toglie il segnaposto (senza modificare `src/`)

`rimuoviSegnaposto` lavora sugli oggetti che `Game.init()` ha già messo in scena:

1. toglie la mesh `paese-corbella` (rustici, campanile, chiesa e muri del segnaposto: 144 triangoli);
2. toglie dalla mesh `oggetti-di-scena` i triangoli dei lampioni della piazza; la Lanterna, il
   Mozzo e le barche restano;
3. toglie i collider con tag `rustico`, `campanile`, `chiesa`, `muro` e `lampione` dentro il
   riquadro di Corbella (691);
4. toglie dal `game.lamps` i lumi del segnaposto dentro il riquadro (83) e rimette tutti gli altri;
5. dopo la costruzione, `liberaCastagni` toglie le istanze e i collider dei castagni del motore che
   cadono nelle impronte delle case o sui sentieri.

Le frazioni segnaposto delle altre valli e le cascine di Valle 1 restano intatte. Se l'integratore
preferisce, basta non chiamare `buildVillage(LAYOUT.villages[0])` in `src/game.ts` (riga ~184): il
passo 1 allora non trova niente e non fa nulla.

## Integrazione (da `moduli/popolamento` a `src/popolamento`)

1. **Copia** `moduli/popolamento/src/*` in `src/popolamento/` (la sottocartella `luoghi/` compresa).
2. **Import**: la libreria è già in `src/oggetti` (identica a `moduli/oggetti/src`), quindi:

   ```sh
   cd src/popolamento
   sed -i "s#'\.\./\.\./\.\./src/#'../#; s#'\.\./\.\./oggetti/src/#'../oggetti/#; s#'\.\./\.\./\.\./content/#'../../content/#" *.ts
   sed -i "s#'\.\./\.\./\.\./\.\./src/#'../../#; s#'\.\./\.\./\.\./oggetti/src/#'../../oggetti/#" luoghi/*.ts
   ```

   I test (`test/`) importano `../src/...` e `../../../src/...`: vanno spostati con la stessa regola,
   per esempio in `src/popolamento/test/`. `test/banco.ts` costruisce un gioco finto con il
   segnaposto vero del motore.
3. **Chiamata**: dopo `await game.init()`:

   ```ts
   const corbella = installaCorbella(game, { agganciaCiclo: false, luciAbitanti: false });
   const scena = portaPopolamento(corbella); // al posto di new Segnaposto(...)
   // nel ciclo della regia: scena.update(dt)   (o agganciaCiclo: true e niente update)
   ```

   Con la regia conviene `luciAbitanti: false`, perché la regia accende già emisfero e direzionale
   per le figure toon.
4. **Doppioni con la regia**: `src/regia/scena/campanile.ts` (`costruisciCella`) costruisce una cella
   al posto del campanile del layout (1062, 37,2), cioè dove c'è il campanile del popolamento
   (stesso punto, lato 5,0 m contro 5,6 m). Le strade sono due: togliere la cella della regia (il
   campanile del popolamento ha la sua cella con bifore, campane, altoparlante e il Pilastro 1
   sulla terrazza della cuspide), oppure tenerla come interno e nascondere il campanile mentre si
   è dentro. Vale lo stesso per la cripta della regia e `corbella.cripta.interno`: tenerne una
   sola.
5. **Abitanti della regia**: `src/regia/png.ts` crea figure sue. Si possono sostituire con
   `corbella.npc(id)` (vaiA, cammina, guarda, gesto), oppure lasciare le sue e passare
   `orari: false` più `npc(id).mostra(false)` per tutti.
6. **Cripta (interno)**: il controller del motore cammina solo sul terreno. L'interno è un gruppo
   nascosto (`corbella.cripta.interno`) 4,5-6 m sotto la botola, con la luce color miele cotta nei
   vertici. Per entrare: `apriBotola(true)`, `cripta.interno.visible = true` e una modalità interno
   della regia (camera e movimento vincolati alla sala, `cripta.sala` dà z, θ e h).
7. **three**: un'unica copia. In un bundler che vede anche `moduli/oggetti/node_modules/three`,
   serve un alias a quella della radice (vedi `vite.config.ts`).

## Scelte e scostamenti dai contenuti

- **Quote**: le `altezza` dei luoghi in `luoghi.json` vengono da un terreno precedente (scarti fino
  a 6-10 m). Tutto si posa su `groundHeight` del motore a (z, θ). Le quote dei luoghi «interno»
  sono profondità sotto la botola.
- **Gradoni**: il terreno del motore ha alzate di 3,5 m quasi verticali. Per questo i sentieri
  hanno gradini automatici dove la pendenza supera 30°, e le terrazze larghe (Terrazza Pedrazzini,
  Muraglione, sagrato, Balcone) sono ripiani riempiti, sostenuti da muri e con un collider
  calpestabile.
- **Botola**: il punto dei contenuti (1112, 27,0) cade su un'alzata a 29°. La botola sta fra le
  radici al piede dell'alzata, 2,5 m dal tronco verso quel punto, su un piccolo ripiano di lastre.
- **Ripa di San Vigilio**: è un bastione di pietra di 16 × 7 m sul gradone a 42 m, con la scala sul
  fianco a Lag. La faccia è alta 8,5 m sul gradone e 12 m sopra il selciato della piazza.
- **Chiesa**: la facciata guarda a Mont-Mane, verso il sagrato e la panca di Annunciata. Il ripiano
  ha muri di sostegno a Mane, dove il terreno scende verso il Riale.
- **Tasso**: è alto 19 m, perché deve coprire davvero la cella dal chiodo 2 (lato 2-1 bloccato,
  come dice il libretto). La tettoia del lavatoio copre il lato 5-1.
- **Visuali del rilievo**: i lati chiudibili hanno un corridoio libero da case, alberi del
  popolamento e muri delle terrazze. Lo verificano i test con raggi contro i collider. Il terreno
  del motore copre però tre lati (1-4, 3-4, 4-37): non dipende dal popolamento e il test li segnala
  in console. Il motore o i contenuti dovranno rivederli.
- **Grà di Pian**: è spostata in modo che l'angolo col chiodo 37 cada esattamente su cs_37.
- **Segnali**: i chiodi a terra (`altezza_segnale` 0) hanno come segnale la biffa a 1,2 m sopra il
  chiodo, la stessa che usano i test delle visuali.
- **Mulino**: la ruota sta a Mane e la soglia della porta è sul cantone, così il chiodo 7 vede la
  passerella.
- **Fade**: seguono `giro_corbella`, sostando su ogni elemento per tre quarti del tratto. Alle
  00:30-00:51 lo sciame del Ronco è sulla casa di Nando, poi va sul muro di Ronco.
  `corbella.notte.fade = true/false` le forza.

## Numeri (Chromium SwiftShader, 1280×720)

`installaCorbella` impiega circa 3 s (5 s in Node). Il popolamento ha 54 zone, ognuna cotta in al più
due mesh col materiale del mondo, con LOD per case e muri: 552 mila triangoli vicini, cioè 0,8-0,9 milioni nell'inquadratura
insieme al motore, con 90-165 draw call. Ci sono 2838 collider, 320 lumi, 102 punti d'interazione,
58 case, 2785 m di muri e 33 maniglie di personaggi.

## Screenshot (`npm run shots` → `shots/`)

| file | |
|---|---|
| `piazza-campanile.png` | Piazza delle Ore, campanile bianco con il Pilastro 1 e la palina |
| `castagno-morto-botola.png` | castagno morto, botola, cippo, il paese sotto |
| `terrazza-pedrazzini.png` | Terrazza Pedrazzini con i castagni da frutto |
| `fienile-ottavio.png` | fienile di Ottavio oltre il riale |
| `chiodo-3-squadro.png` | chiodo 3 sulla copertina del muro, dove si pianta lo squadro |
| `abitanti-piazza.png` | abitanti velati in piazza (Ottavio, i bambini, Pina, i velati) |
| `notte-paese.png` | Corbella di notte, le Fade sui Ronchi |
| `fade-ronchi.png` | le Fade alle 00:40 sulla casa di Nando |
| `cripta-interno.png` | la sala delle capsule sotto la botola |
| `mobili-varianti.png` | passerella Abitata, casa di Nando Smontata, muro di Ronco |
| `muri-del-velo.png` | i tre muri del Velo |
| `panorama-paese.png` | il paese dall'alto delle terrazze |
| `chiesa-sagrato.png` | San Vigilio, sagrato e tasso |
| `debug-pianta.png` | pianta dall'alto (controllo del piazzamento) |

## Test (`npm test`, 20)

I test controllano:

- il segnaposto tolto (mesh, collider, lumi);
- un chiodo su ogni caposaldo, sul suolo vero;
- i pilastri lontani con i lumi;
- i punti principali;
- la cella a 24 m e la palina a +8 m;
- i collider etichettati;
- il collider della botola, che c'è solo da chiusa;
- tutte le varianti e quella iniziale;
- `setVariante` (visibilità, collider, punti);
- la casa di Nando smontata;
- una maniglia per ogni personaggio;
- gli orari;
- la camminata con la promessa;
- i lumi;
- i lati bloccati dai contenuti, che restano bloccati;
- i lati chiudibili, che restano liberi;
- chiodo e segnale per ogni caposaldo;
- gli alias della porta per la regia;
- `mostraVariante`;
- `dispose`.
