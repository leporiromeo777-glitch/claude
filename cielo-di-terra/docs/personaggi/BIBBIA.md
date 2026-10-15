# Bibbia dei personaggi — Fase 1

Che aspetto hanno gli abitanti di Corbella e come si chiede a un generatore l'immagine da cui ricavare il modello 3D.
Fonti: `content/personaggi.json` (`come_appare`), `docs/design/FASE1.md` (M1.6-M1.10), i bozzetti `idee-gioco/pagina/img/finale-1.jpg … finale-8.jpg`.
La pipeline tecnica (generatori, rig, animazione, parametri) è in [PIPELINE.md](PIPELINE.md).

## Regole che valgono per tutti

**Il mondo.** Corbella è un paese ticinese di pietra e castagni dentro un cilindro di O'Neill, nel 2200 e passa, ma la gente vive come in un villaggio alpino dell'Ottocento: canapa, lana, cuoio, feltro, legno di castagno, ottone. Niente di moderno addosso.

**I velati.** Gli abitanti portano il **velo**: una garza di canapa tinta di noce che copre la testa e il viso e cade sulle spalle. Sopra possono avere un cappello di feltro a tesa larga o un cappuccio di lana; i più vecchi (e la Confraternita) una **maschera di castagno liscia, senza tratti**. **Non si vede mai un volto.** Il velo è stoffa: sotto si indovina la forma della testa, non occhi né naso né bocca.

**Gli scoperti.** Solo due volti si vedono: **Nando** (Smascherato) e **Ottavio** (il velo da corsa legato alla fronte). Sono volti **dipinti e stilizzati**: forme semplici, due o tre toni, occhi piccoli e scuri senza riflessi, niente pori, niente rughe fotografiche. Devono stare bene accanto a una garza piatta, non a una foto. Nel pilota il prompt «painted in a simple stylized way» ha dato a Nando un volto ancora troppo realistico (vedi `pilota/sorgenti.jpg`): per i volti si usa la frase **VOLTO** qui sotto.

**Lo stile.** Il misto dei bozzetti: campiture piatte grandi e pulite, sfumature morbide, una pennellata leggera dentro le campiture (sulla stoffa, sul cuoio, sul legno). Silhouette che si leggono da 30 m: cappello, gerla, bastone, grembiule, velo che sbuffa. Proporzioni appena stilizzate: teste un po' più piccole del vero per gli adulti (1/7 dell'altezza), mani e piedi un po' più grandi, spalle e fianchi semplici; bambini con la testa grande (1/5).

**La palette** (dai bozzetti 1, 2, 5 e da `src/oggetti/palette.ts`):

| nome | colore | dove |
|---|---|---|
| noce | `#6a4a31` | veli, gonne, giacche |
| noce scuro | `#4b3322` | veli dei vecchi, bastoni |
| ocra stoppia | `#b8894a` | camicie, scialli, gerle |
| ruggine | `#9a4a2c` | gonne, gilet, nastri |
| verde salvia | `#7d8c62` | panni, il verde di Ottavio più spento |
| grigio-viola gneiss | `#938c94` | lana, pietra di Nando |
| bianco di calce | `#e9e3d6` | grembiuli, camicie, veli dei bambini |
| feltro nero | `#1f1d22` | cappelli, veste della Confraternita (mai nero puro: tende al viola) |
| ottone | `#c9a24a` | chiavi, lume, fibbie |
| cuoio | `#6e4b33` | borse, cinture, zoccoli, scarpe |
| vermiglio | `#cf4129` | solo come accento piccolo (il nastro di Lisa) |

Saturazione media, niente colori acidi; il nero è sempre un bruno o un viola molto scuro.

**Che cosa nessuno deve avere.** Armi (coltelli in vista, spade, fucili), volti realistici o fotografici, occhi sotto il velo, pelle lucida, oggetti moderni (zip, plastica, occhiali, scritte, loghi), simboli religiosi espliciti (croci, aureole), armature, fronzoli fantasy (rune, gemme, luci magiche), mantelli svolazzanti che si staccano dal corpo, capelli lunghi sciolti che coprono le braccia.

**Che cosa serve al 3D** (vale per ogni prompt):
- un solo personaggio, a figura intera dalla testa ai piedi, centrato, con margine;
- vista frontale, A-pose: braccia dritte staccate dal corpo di circa 25°, mani aperte e rilassate, gambe dritte appena divaricate (se si vedono);
- fra braccia e busto deve passare il fondo: è lo spazio che serve al rig;
- sfondo chiaro uniforme, niente pavimento né ombra portata;
- luce piatta e diffusa, niente ombre dipinte forti né luce di contorno: la luce la mette il gioco;
- gli accessori **indossati** stanno nel modello e ben staccati dal corpo (la gerla sulla schiena, la borsa a tracolla sul fianco, il martello e le chiavi appesi alla cintura, il cappello); gli oggetti **tenuti in mano** invece NON vanno nell'immagine: le mani restano vuote e aperte, e l'oggetto (bastone, forbici, pietra, pacchetto, lume) è un oggetto di scena procedurale attaccato all'osso `manoS`/`manoD` nel gioco. Motivi, visti nel pilota: `sam_3_3d` ritaglia «la persona» e butta via quello che ha in mano (la pietra di Nando è sparita); un bastone che tocca terra lega la mano al suolo nei pesi del rig; il lume deve potersi accendere di notte (canale `lume` della libreria) e il bastone deve potersi posare. Niente oggetti appoggiati a terra né grandi oggetti separati (il telo dell'Ombrista, il Velo da planata di Ottavio, la scatola dei cartoni: oggetti di scena a parte);
- gonne e vesti lunghe sì, ma che finiscono sopra le caviglie o a terra **senza strascico**; il velo che cade dritto, non al vento.

## Frasi comuni dei prompt

Ogni prompt è `STILE + personaggio + POSA`. Le due frasi comuni tengono coerenti i 13 modelli.

**STILE**
> Stylized hand-painted game character in the style of painterly concept art: large flat color blocks with soft gradients and a light visible brush texture inside the shapes, warm muted autumn palette (walnut brown, ochre, rust, sage green, grey-violet, chalk white, dull brass), simple bold readable shapes, slightly stylized proportions, matte natural fabrics (hemp gauze, wool, felt, leather, chestnut wood), 19th-century alpine village clothing, no outlines, no text, no logo.

**POSA**
> Single character only, full body from head to feet, centered with margin, front view facing the camera, symmetrical A-pose: arms straight and held away from the torso at about 25 degrees with a clear gap between arms and body, hands open and relaxed, legs straight with feet slightly apart. Plain uniform light warm-grey background, no floor, no cast shadow, flat even diffuse lighting with no strong painted shadows and no rim light. No weapons.

Per i due volti scoperti si aggiunge **VOLTO** (al posto della descrizione realistica del viso):
> The face is drawn like a character from a hand-painted animated feature film: broad flat planes of warm color, simplified shapes, small dark eyes without highlights, a simple nose shape, a few painted lines for wrinkles, no realistic skin texture, no pores, no photographic lighting.

Per i velati si aggiunge sempre **VELO**:
> The whole head and face are completely hidden under the veil: no eyes, no nose, no mouth, no skin visible on the head, only soft draped fabric following the shape of the head.

## I tredici modelli

Altezze in metri (sono quelle a cui la pipeline scala il modello; gli scarti fra personaggi si leggono meglio della corporatura).

### 1. Ottavio, detto Ventin — `ottavio` (1,74 m)
- **Chi**: il Messo, 17 anni; plana fra le valli con il Velo verde. Primo amico di Elvira.
- **Silhouette**: magro e lungo, spalle strette, gambe lunghe; la borsa a tracolla che sporge sul fianco, la fascia verde con le code sulla fronte.
- **Abiti**: camicia di canapa grezza con le maniche arrotolate sotto il gomito, gilet corto verde da corsa, calzoni di fustagno stretti sotto il ginocchio, calze di lana, scarponcini di cuoio bassi.
- **Colori**: verde da corsa spento (`#4f8a46` virato al salvia), canapa `#d9c9a6`, cuoio, ottone.
- **Accessori**: borsa del Messo di cuoio a tracolla (sul fianco sinistro, chiusa), il velo da corsa: una fascia di garza verde legata alla fronte con due code corte dietro. Il lume a petrolio d'ottone alla cintura resta procedurale (si accende di notte).
- **Volto**: scoperto, **stilizzato e dipinto** (frase VOLTO): viso giovane e magro, naso dritto, occhi piccoli e scuri, sopracciglia folte, capelli castani corti e spettinati sotto la fascia, un'ombra di lentiggini. Nessun dettaglio fotografico.
- **Niente**: il Velo da planata addosso (è un oggetto a parte), coltelli, cappelli, sorrisi forzati.
- **Prompt**:
> A lean 17-year-old messenger boy from an alpine chestnut-forest village, long legs and narrow shoulders, short messy brown hair under a green gauze racing band tied around the forehead with two short tails at the back, a young thin face with thick eyebrows, a few freckles and a calm expression, rough natural hemp shirt with sleeves rolled below the elbows, short sage-green racing waistcoat, brown corduroy breeches gathered below the knee, grey wool socks, low leather boots, a closed leather messenger satchel on a strap across the chest hanging at the left hip, a plain leather belt, empty open hands.

### 2. Togna — `togna` (1,62 m) — PILOTA (fatta: `public/personaggi/togna.glb`, tripo)
- **Chi**: la lavandaia del lavatoio in piazza; china sulla vasca, parla al bucato.
- **Silhouette**: robusta, bassa, fianchi larghi; testa a cupola morbida del velo che si allarga sulle spalle; grembiule bianco che spicca sul noce.
- **Abiti**: garza color noce fino alle spalle, legata sotto il mento; camicia d'ocra chiaro con le maniche arrotolate sopra il gomito; gonna di lana ruggine-noce lunga alla caviglia; grembiule bianco di canapa dal petto alle ginocchia; zoccoli di legno.
- **Colori**: noce, bianco di calce, ocra, ruggine spenta.
- **Accessori**: nessuno in mano (le braccia sono da lavare); al più una pezza bagnata legata in vita.
- **Niente**: volto, capelli, mani curate; secchi o ceste nel modello (sono oggetti di scena).
- **Prompt**:
> A sturdy, short middle-aged village washerwoman with broad hips, her whole head covered by a walnut-brown hemp gauze veil that falls over the shoulders like a soft cape and is tied under the chin, a pale ochre linen blouse with sleeves rolled up above the elbows, bare strong forearms and hands, a long rust-brown wool skirt to the ankles, a large white hemp apron from chest to knees tied at the waist, simple dark wooden clogs.

### 3. Bortolo, il campanaro — `bortolo` (1,80 m)
- **Chi**: campanaro di San Vigilio, laico della Confraternita; ogni mattina rimette i gradini delle Terrazze.
- **Silhouette**: grosso, pesante, spalle larghe e pancia; il cappello di feltro nero a tesa larga è la sua sagoma; il mazzo di chiavi e il martello che pendono alla cintura.
- **Abiti**: velo di garza noce sotto il cappello, che copre viso e collo; giacca corta di lana noce scuro aperta su un gilet; camicia di canapa; calzoni di fustagno; scarponi.
- **Colori**: feltro nero-viola, noce, canapa, ottone delle chiavi.
- **Accessori**: martello da muratore (corto, manico di castagno) appeso alla cintura a destra, grosso anello di chiavi d'ottone alla cintura a sinistra.
- **Niente**: volto, barba visibile, campane in mano.
- **Prompt**:
> A big heavy-set village bell-ringer with broad shoulders and a round belly, a wide-brimmed black felt hat, under the hat a walnut-brown gauze veil that completely covers his face and neck and falls onto the shoulders, a short dark walnut wool jacket open over a brown waistcoat and a hemp shirt, brown corduroy trousers, heavy leather boots, a short mason's hammer with a chestnut handle hanging from the belt on his right side, a large ring of brass keys hanging from the belt on his left side.

### 4. Pina Galli, l'Ombrista — `pina` (1,50 m)
- **Chi**: 81 anni; ogni sera racconta la Partenza con figure di cartone controluce.
- **Silhouette**: piccola, curva (la curva la fa il rig, il modello sta quasi dritto con le spalle un po' tonde), cappuccio di lana grigia a punta morbida che copre tutta la faccia, scialle sulle spalle; le forbici enormi in mano.
- **Abiti**: cappuccio di lana grigio-viola lungo fino al petto, scialle di lana grigia, veste lunga grigio scuro, grembiule ocra macchiato, scarpe di panno.
- **Colori**: lana grigia `#8d8780`, grigio-viola, ocra del cartone.
- **Accessori** (procedurali, attaccati alle mani nel gioco): un grande paio di forbici da sarta nella mano destra, la punta in basso; nella sinistra una figura di cartone ocra (un omino con una ruota). La scatola dei cartoni è un oggetto di scena a parte. Nell'immagine le mani sono vuote.
- **Niente**: volto, mani giganti (solo le ombre sul telo lo sono), lampada in mano.
- **Prompt**:
> A tiny, very old village woman with slightly rounded shoulders, a long soft grey wool hood with a gentle point that hangs down to the chest and hides her face completely in shadowless fabric, a grey wool shawl over the shoulders, a long dark grey dress to the ankles, a stained ochre apron with a big front pocket, cloth shoes, empty open hands.

### 5. Annunciata — `annunciata` (1,55 m)
- **Chi**: una vecchia che aspetta le Lettere dalla Sorella; seduta sulla panca della chiesa.
- **Silhouette**: esile, un po' curva, il velo noce scuro lungo che arriva ai gomiti come una mantellina; il bastone di castagno dritto accanto.
- **Abiti**: velo noce scuro fino ai gomiti; veste lunga noce con un fazzoletto di lana ocra incrociato sul petto; calze nere; scarpe basse.
- **Colori**: noce scuro, ocra, bastone di castagno.
- **Accessori**: bastone di castagno nodoso nella mano destra (procedurale; nell'immagine la mano è vuota).
- **Niente**: volto, rosari o croci, lettere in mano.
- **Prompt**:
> A slender very old village woman, slightly stooped, a long dark walnut gauze veil covering her whole head and face and falling like a short cape down to her elbows, a long walnut-brown dress to the ankles with an ochre wool kerchief crossed over the chest, black stockings, low dark shoes, empty open hands.

### 6. Nando, lo Smascherato — `nando` (1,76 m) — prova del pilota (`public/personaggi/nando.glb`, sam)
- **Chi**: Smascherato dei Ronchi; ogni mattina ricostruisce la casa che le Fade gli smontano.
- **Silhouette**: largo e asciutto, braccia lunghe, testa scoperta; una pietra piatta in mano.
- **Abiti**: camicia di canapa grezza senza colletto, maniche arrotolate; calzoni di canapa rattoppati alle ginocchia, tenuti da una corda; fascia di lana in vita; scarpe di cuoio consumate.
- **Colori**: canapa grezza `#cfbd97`, grigio-viola della pietra, pelle scura di sole.
- **Volto**: scoperto, **stilizzato e dipinto** (frase VOLTO): faccia scura di sole, mascella quadrata, barba corta brizzolata, capelli corti grigi, occhi piccoli e stanchi, fronte con due segni di ruga dipinti. Mani grandi e spaccate (solo di tono, niente rilievi).
- **Accessori**: la pietra piatta grigio-viola nella mano destra è quella procedurale che il gioco ha già (`accessori()` in `src/popolamento/abitanti.ts`).
- **Niente**: cappello, velo, attrezzi da taglio.
- **Prompt**:
> A broad, lean, weathered stonemason in his fifties with long arms, an uncovered head with short grey hair and a short salt-and-pepper beard, a sun-darkened face with a square jaw and small tired eyes, big rough hands, a collarless raw hemp shirt with rolled-up sleeves, patched hemp trousers held up by a rope and a grey wool sash, worn leather shoes, empty open hands.

(Il pilota ha usato la versione precedente, con «face painted in a simple stylized way» e la pietra in mano: vedi PIPELINE.md.)

### 7. Clelia, novizia della Confraternita — `clelia` (1,68 m)
- **Chi**: porta i doni e le lettere della Madre; piccoli inchini, mai un minuto di troppo.
- **Silhouette**: dritta e sottile, una colonna nera che si allarga appena verso terra; l'ovale chiaro della maschera è l'unico punto di luce.
- **Abiti**: veste di garza nera a strati, lunga fino a terra (senza strascico), cappuccio di garza nera sopra la maschera; una cordicella di canapa in vita.
- **Colori**: nero-viola `#1b191e`, legno chiaro di castagno della maschera `#c9a983`.
- **Accessori**: maschera ovale di castagno **liscia, senza tratti** (né fori per gli occhi né bocca), nel modello; il pacchetto legato con lo spago è procedurale (mano sinistra).
- **Niente**: volto, occhi nella maschera, croci, candele.
- **Prompt**:
> A slim upright young novice of a village confraternity, a long layered black gauze robe with a dark violet tint falling straight to the ground without a train, a black gauze hood over the head, the face completely covered by a smooth oval mask of pale chestnut wood with no features at all (no eye holes, no mouth, just smooth polished wood grain), a thin hemp cord tied at the waist, pale empty open hands.

### 8. Lisa — `lisa` (1,30 m)
- **Chi**: nove anni; parla per tutti e due e chiama Elvira «la Svegliata».
- **Silhouette**: bambina, testa grande, il velo bianco corto annodato storto con un nodo che sporge da un lato; gonna corta, ginocchia sbucciate; mani sui fianchi in gioco (nel modello: A-pose).
- **Abiti**: garza bianca da bambini corta fino al collo, annodata di traverso; vestitino di canapa bianco-crema al ginocchio con un grembiulino; calzettoni di lana; zoccoli.
- **Colori**: bianco di calce, crema, il nastro vermiglio al polso sinistro, ginocchia rosate.
- **Niente**: volto, trecce visibili, giocattoli moderni.
- **Prompt**:
> A nine-year-old village girl with a big head and short limbs, her head and face completely covered by a short white children's gauze veil reaching the neck, knotted crookedly on one side with the knot sticking out, a knee-length cream hemp dress with a small white pinafore, scraped pink knees, grey wool knee socks, wooden clogs, a small vermilion ribbon tied around her left wrist.

### 9. Gioanin — `gioanin` (1,12 m)
- **Chi**: il fratello di Lisa, sei anni; si nasconde dietro la sorella.
- **Silhouette**: piccolo, tondo, il velo bianco **troppo lungo** che gli arriva alla pancia; gli zoccoli di legno grandi.
- **Abiti**: garza bianca lunga fino alla vita; camiciola di canapa; calzoncini corti di lana noce con le bretelle; zoccoli di legno.
- **Colori**: bianco, noce, legno chiaro degli zoccoli.
- **Niente**: volto, giocattoli.
- **Prompt**:
> A small six-year-old village boy with a round body and a big head, his head and face completely covered by a white children's gauze veil that is far too long and falls down to his waist like a little cape, a hemp shirt, short walnut-brown wool trousers with braces, bare knees, big wooden clogs.

### 10. Velata generica: donna con garza e grembiule — `velata_donna` (1,63 m)
- **Ruolo**: la base del coro dei velati (orti, lavatoio, piazza); si colora in varianti.
- **Silhouette**: media, velo che fa campana su testa e spalle, gonna lunga, grembiule.
- **Abiti**: garza noce fino al petto; camicia di canapa; gonna di lana lunga; grembiule ocra; scialle incrociato.
- **Colori**: noce, ocra, verde salvia spento (la variante cambia gonna e grembiule).
- **Prompt**:
> An ordinary village woman of medium build, a walnut-brown hemp gauze veil covering her whole head and face and falling over the shoulders down to the chest, a hemp blouse, a sage-green wool shawl crossed over the chest, a long walnut-brown wool skirt to the ankles, an ochre apron, simple leather shoes.

### 11. Velato generico: uomo con cappello di feltro e gerla — `velato_gerla` (1,75 m)
- **Ruolo**: contadini e portatori; la gerla è la silhouette del paese.
- **Silhouette**: cappello di feltro a tesa larga, velo sotto, la gerla di castagno intrecciato sulla schiena che sporge sopra le spalle.
- **Abiti**: velo noce sotto il cappello; giacca corta di lana ocra; calzoni di fustagno; fasce alle gambe; scarponi.
- **Colori**: feltro bruno, noce, ocra, castagno della gerla.
- **Accessori**: gerla vuota (cesta conica intrecciata) con le spallacce di cuoio; niente in mano.
- **Prompt**:
> A village peasant man of medium build, a wide-brimmed brown felt hat, under the hat a walnut-brown gauze veil that completely covers his face and neck, a short ochre wool jacket, brown corduroy trousers with cloth leg wraps below the knee, heavy leather boots, an empty conical woven chestnut-wood basket (gerla) carried on his back with leather shoulder straps, its rim rising above his shoulders, nothing in his hands.

### 12. Velato generico: anziano con maschera di castagno e bastone — `velato_maschera` (1,60 m)
- **Ruolo**: i vecchi del paese, le panche davanti alla chiesa.
- **Silhouette**: un po' curvo, mantellina corta di lana, la maschera chiara dentro un cappuccio scuro; il bastone.
- **Abiti**: cappuccio di lana noce scuro; maschera di castagno liscia con due tagli sottili per gli occhi (senza occhi dentro: solo ombra piatta); mantellina corta grigio-viola; giubba lunga noce; calzoni; scarpe.
- **Colori**: noce scuro, grigio-viola, legno chiaro della maschera.
- **Accessori**: bastone di castagno dritto nella mano destra (procedurale; nell'immagine la mano è vuota).
- **Prompt**:
> An old village man, slightly stooped, a dark walnut wool hood, the face completely covered by a smooth carved mask of pale chestnut wood with only two thin horizontal slits for the eyes filled with flat shadow (no eyes visible, no other features), a short grey-violet wool cape over the shoulders, a long walnut-brown coat to the knees, dark trousers, worn leather shoes, empty open hands.

### 13. Velato generico: figura incappucciata — `velato_cappuccio` (1,70 m)
- **Ruolo**: le figure che si fermano e si voltano da lontano.
- **Silhouette**: un cappuccio largo e profondo che scende a punta sulle spalle, il corpo nascosto da un mantello di lana fino al polpaccio, aperto davanti quanto basta per le braccia.
- **Abiti**: cappuccio e mantello di lana grigio-viola; sotto, veste ocra spento; velo di garza noce dentro il cappuccio al posto del viso; stivali.
- **Colori**: grigio-viola, ocra spento, noce.
- **Prompt**:
> A tall hooded villager, a deep wide grey-violet wool hood with a soft point resting on the shoulders, inside the hood a walnut-brown gauze veil completely covering the face, a grey-violet wool cloak to mid-calf open at the front with slits for the arms, a muted ochre tunic underneath, dark trousers, leather boots, hands empty.

## Varianti dei generici (senza spendere crediti)
I quattro generici diventano la dozzina di velati con varianti fatte nel gioco, senza nuove generazioni:
- **tinta**: una tinta leggera moltiplicata sulla texture (`tinta` in `caricaPersonaggio`, già pronta); in seguito, se serve di più, uno spostamento di tinta per zone (`onBeforeCompile`: il velo color noce resta, gonna/giacca/grembiule ruotano fra noce, ocra, ruggine, salvia, grigio-viola);
- **misura**: scala ±5% e larghezza ±6% sul gruppo;
- **posa**: `curvo`, `braccia` (mani giunte, braccia conserte, mani dietro), sguardi sfasati (`sfasamento`);
- **oggetti di scena** procedurali sulle ossa delle mani e della schiena (bastone, gerla vuota o carica, cesto).
Vedi PIPELINE.md.
