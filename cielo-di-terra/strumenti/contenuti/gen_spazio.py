#!/usr/bin/env python3
"""Genera content/luoghi.json, content/capisaldi.json e content/fade_fase1.json
per la Fase 1 di «Cielo di Terra», usando la quota del terreno del motore."""
import json, math, subprocess, os

SP = os.path.dirname(os.path.abspath(__file__))
OUT = '/home/user/claude/cielo-di-terra/content'
R = 646.0
DZ = 40.0
NTH = 96
DTH = 360.0 / NTH  # 3.75
MPD = R * math.pi / 180.0  # metri per grado sul fondo
BUFFER = 60.0  # ventaglio di un lato

def cell(z, th):
    return int(z // DZ) * NTH + int((th % 360) // DTH)

def center(cid):
    iz, it = divmod(cid, NTH)
    return ((iz + 0.5) * DZ, (it + 0.5) * DTH)

def dist(z1, t1, z2, t2):
    return math.hypot(z2 - z1, (t2 - t1) * MPD)

def seg_dist(pz, pt, az, at, bz, bt):
    ax, ay = 0.0, 0.0
    bx, by = bz - az, (bt - at) * MPD
    px, py = pz - az, (pt - at) * MPD
    L2 = bx * bx + by * by
    t = 0.0 if L2 == 0 else max(0.0, min(1.0, (px * bx + py * by) / L2))
    cx, cy = t * bx, t * by
    return math.hypot(px - cx, py - cy)

def terrain(points):
    path = os.path.join(SP, 'terr', 'pts.json')
    json.dump(points, open(path, 'w'))
    r = subprocess.run(['node', os.path.join(SP, 'terr', 'bundle2.mjs'), path], capture_output=True, text=True, check=True)
    return json.loads(r.stdout)

# ---------------------------------------------------------------- luoghi
# (id, nome, z, theta, quota: ('t', offset) sul terreno oppure ('a', assoluta), raggio, tipo, zona, descrizione)
L = [
 # Cripta (Guscio di Corbella)
 ('cripta_capsula_5', 'Capsula n. 5', 1112, 27.4, ('a', -4.5), 2, 'interno', 'guscio_corbella',
  'La capsula di Elvira, con il coperchio di vetro sollevato. Sul vetro, a matita dura: «Non fidarti delle campane». Sotto, una busta di carta grezza.'),
 ('cripta_sala', 'Cripta dei Giardinieri', 1112, 27.0, ('a', -4.5), 12, 'interno', 'guscio_corbella',
  'Sala a volta del 2121 con sette capsule in semicerchio, luci di servizio color miele, condensa sui tubi. La n. 1 aperta dall\'interno, la n. 2 con un\'urna di rame, la n. 3 sotto una corona funebre secca, la n. 4 vuota, la n. 6 e la n. 7 addormentate con le sveglie staccate.'),
 ('cripta_corridoio', 'Corridoio di servizio', 1106, 27.2, ('a', -4.0), 6, 'interno', 'guscio_corbella',
  'Corridoio basso di segmenti di ferro, con gli orari di manutenzione del 2121 dipinti a mano e una scritta a gesso di un tecnico.'),
 ('cripta_scala', 'Scala alla botola', 1111, 27.0, ('a', -1.5), 2, 'interno', 'guscio_corbella',
  'Scala alla marinara di sei pioli. In alto, la botola di ferro rivettata, fra le radici.'),
 # Corbella alta
 ('botola', 'Botola della Cripta', 1112, 27.0, ('t', 0), 3, 'passaggio', 'corbella',
  'Botola di ferro arrugginito fra le radici del castagno morto, con un anello per sollevarla. Da qui si esce nel mondo.'),
 ('castagno_morto', 'Il castagno morto', 1114, 27.6, ('t', 0), 6, 'albero', 'corbella',
  'Un castagno secolare senza foglie sopra la botola: corteccia grigia, rami spogli, ricci vuoti per terra. Gli amenti dell\'ultima fioritura pendono ancora intatti. Un ramo basso a Mane ha la corteccia verde.'),
 ('cippo_cripta', 'Cippo della Cripta', 1110, 26.2, ('t', 0.6), 2, 'caposaldo', 'corbella',
  'Un masso squadrato accanto alla botola, con il chiodo d\'ottone n. 11. Sull\'ottone, graffi freschi lasciati dal piede di uno squadro.'),
 ('belvedere_muretto', 'Muretto del belvedere', 1094, 29.8, ('t', 0.5), 3, 'sosta', 'corbella',
  'Un muretto a secco sul ciglio della prima terrazza, con una pietra piatta per sedersi. Sotto, i tetti di piode di Corbella e il campanile bianco; sopra, il lago appeso.'),
 ('mulattiera_terrazze', 'Mulattiera delle Terrazze', 1030, 26.5, ('t', 0), 10, 'sentiero', 'corbella',
  'La mulattiera a tornanti segnata nella Carta: lastre di gneiss, muretti, un tornante ogni terrazza. È lunga ma non sparisce mai.'),
 ('scorciatoia_terrazze', 'Scorciatoia delle Terrazze', 1000, 28.0, ('t', 0), 8, 'sentiero', 'corbella',
  'Una scorciatoia dritta fra le terrazze, con gradini di assi infilati nei muri. Il campanaro la rimette ogni mattina alle sette.'),
 ('terrazza_pedrazzini', 'Terrazza Pedrazzini', 948, 23.0, ('t', 0), 15, 'terrazza', 'corbella',
  'Una terrazza larga di castagni da frutto, la più alta sopra il paese. Erba alta, ricci vuoti, un muro a secco con il chiodo n. 3.'),
 ('castagno_cartellino', 'Il castagno del cartellino', 950, 22.4, ('t', 0), 4, 'albero', 'corbella',
  'Un castagno vigoroso ma inselvatichito: l\'innesto del 2120 è morto e il portinnesto ha ripreso il sopravvento. Al ramo più basso, un cartellino di zinco scritto a punta secca.'),
 ('muretto_terrazza', 'Muretto della Terrazza', 962, 25.4, ('t', 0), 3, 'muro', 'corbella',
  'Il primo muro a secco sotto la Terrazza Pedrazzini, alto tre metri e mezzo. Si salta e si apre il Velo.'),
 ('muraglione_gra', 'Muraglione della Grà', 985, 27.6, ('t', 0), 3, 'muro', 'corbella',
  'Un muraglione di sostegno alto otto metri, con una vecchia grà sul ciglio. Lancio della seconda planata.'),
 ('ripa_san_vigilio', 'Ripa di San Vigilio', 1036, 33.2, ('t', 0), 3, 'muro', 'corbella',
  'L\'ultimo muro sopra il paese, alto dodici metri, con le fessure in ombra che fanno da appigli. Planando si arriva in Piazza delle Ore.'),
 ('gra_di_pian', 'Grà di Pian', 890, 17.5, ('t', 0), 8, 'edificio', 'corbella',
  'Un essiccatoio di castagne in gneiss con il tetto di piode. Il fumo bianco esce dal tetto dalle sei alle dieci. Sul muro, il chiodo n. 37.'),
 ('pian_dei_ricci', 'Pian dei Ricci', 800, 9.0, ('t', 0), 15, 'selva', 'selve_alte',
  'Un ripiano della cresta a Sera, fra castagni enormi. Il Pilastro 4, bronzo verde con un disco bianco e rosso, spunta fra i ricci come una piccola colonna.'),
 ('sentiero_nastri', 'Sentiero dei nastri verdi', 700, 12.0, ('t', 0), 10, 'sentiero', 'selve_alte',
  'Il sentiero dei Messi verso il Tappo Sud. Non è segnato sulla Carta: è segnato da nastri verdi legati ai castagni, uno ogni cinquanta passi.'),
 ('varco_collare', 'Varco del Collare', 219, 30.0, ('t', 0), 20, 'cielo', 'tappo_sud',
  'Qui il sentiero entra nelle nubi del Collare. Si pesa poco più di metà.'),
 ('balcone_messi', 'Balcone dei Messi', 110, 30.0, ('t', 0), 10, 'belvedere', 'tappo_sud',
  'Uno sperone sul lobo del Tappo Sud, a 0,3 g, con il Pilastro 42 e un capanno di legno pieno di Veli rattoppati. Da qui i Messi «cadono» nell\'altra valle.'),
 # Corbella: il paese
 ('piazza_ore', 'Piazza delle Ore', 1046, 37.0, ('t', 0), 18, 'piazza', 'corbella',
  'Piazza tonda selciata a ciottoli bianchi e neri: è una meridiana, ma da terra sembra solo decorazione. Ci si raduna velati a guardare la Linea che si accende.'),
 ('bacheca_ore', 'Bacheca delle Ore', 1043, 35.6, ('t', 1.2), 2, 'oggetto', 'corbella',
  'Una bacheca di legno sotto una tettoia di piode. Ottavio ci appende le notizie alla brace; la Confraternita le sue lettere.'),
 ('telo_ombrista', 'Il telo dell\'Ombrista', 1057, 36.0, ('t', 0), 6, 'scena', 'corbella',
  'Un telo bianco teso fra due pali sul lato a Lag della piazza. Alla brace una lampada a olio lo accende da dietro.'),
 ('lavatoio', 'Lavatoio della piazza', 1040, 39.5, ('t', 0), 4, 'edificio', 'corbella',
  'Un lavatoio coperto con la vasca di granito. Sul primo gradino, il chiodo d\'ottone n. 5.'),
 ('san_vigilio', 'San Vigilio', 1068, 38.6, ('t', 0), 10, 'edificio', 'corbella',
  'La chiesa romanica di Corbella: muri bianchi di calce, tetto di piode, portale basso. Alla porta, la bacheca delle Lettere dalla Sorella.'),
 ('sagrato', 'Sagrato di San Vigilio', 1052, 39.2, ('t', 0), 6, 'piazza', 'corbella',
  'Il sagrato a gradini davanti alla chiesa, con un tasso enorme. Sul gradino più basso, il chiodo d\'ottone n. 2.'),
 ('tasso', 'Il tasso del sagrato', 1057, 38.2, ('t', 0), 4, 'albero', 'corbella',
  'Un tasso scuro e fitto, cresciuto per duecento anni senza che nessuno lo potasse. Dal sagrato copre la cella del campanile.'),
 ('campanile', 'Campanile di San Vigilio', 1062, 37.2, ('t', 0), 4, 'edificio', 'corbella',
  'Il campanile bianco con il cappello di piode, visibile da tutto il cielo. Dentro, una scala di legno fino alla cella.'),
 ('cella_campanaria', 'Cella campanaria e Pilastro 1', 1062, 37.2, ('t', 24.0), 3, 'caposaldo', 'corbella',
  'La cella con tre campane e, sul tetto piano accanto alla cuspide, il Pilastro 1: bronzo, la targa del 2120 e una palina bianca e rossa alta otto metri. Un altoparlante arrugginito del 2121 è legato al ceppo della campana grande.'),
 ('soglia_pina', 'Soglia di Pina', 1050, 34.5, ('t', 0), 3, 'casa', 'corbella',
  'La porta di una casa bassa sulla piazza. Di giorno Pina siede sulla soglia a ritagliare cartoni, con la scatola delle figure accanto.'),
 ('casa_del_velo', 'Casa del Velo', 1072, 33.5, ('t', 0), 6, 'edificio', 'corbella',
  'La casa della Confraternita a Corbella: finestre con le grate, un velo nero sulla porta. Le novizie ci dormono quando scendono dall\'Eremo.'),
 ('i_ronchi', 'I Ronchi', 1175, 45.5, ('t', 0), 30, 'quartiere', 'corbella',
  'Le case «non benedette» ai margini del paese, a Lag: muri a secco rifatti, tetti di frasche. Ci vivono gli Smascherati.'),
 ('casa_nando', 'Casa di Nando', 1188, 46.0, ('t', 0), 5, 'casa', 'corbella',
  'Una casa di pietre a secco senza calce. Ogni mattina le manca un muro, e ogni mattina Nando lo rifà.'),
 ('muro_ronco', 'Muro di Ronco', 1150, 43.5, ('t', 0), 5, 'muro', 'corbella',
  'Un muro a secco lungo il prato di Ronco. Di giorno ha una breccia; ogni mattina è di nuovo intero.'),
 ('mulino', 'Mulino sul riale', 1130, 51.0, ('t', 0), 6, 'edificio', 'corbella',
  'Un mulino di pietra con la ruota ferma: il riale curvo porta poca acqua. Sulla soglia, il chiodo n. 7.'),
 ('ponte_mulino', 'Ponte del Mulino', 1100, 53.9, ('t', 0), 4, 'passaggio', 'corbella',
  'Un ponte di pietra a schiena d\'asino sul riale, segnato nella Carta.'),
 ('passerella_messo', 'Passerella del Messo', 1163, 51.9, ('t', 0), 4, 'passaggio', 'corbella',
  'Tre assi di castagno buttate sul riale: la scorciatoia di Ottavio verso il fienile. Ogni sera lui le rimette; ogni notte spariscono.'),
 ('guado_sass', 'Guado del Sass', 1205, 50.3, ('t', 0), 4, 'passaggio', 'corbella',
  'Cinque pietre piatte in fila nel riale, a Lag della passerella. Ci si bagna le scarpe, ma il guado c\'è sempre.'),
 ('prato_ronco', 'Prato di Ronco', 1170, 55.5, ('t', 0), 20, 'prato', 'corbella',
  'Il prato sulla riva a Mane del riale, fra la passerella e il fienile.'),
 ('fienile_ottavio', 'Fienile di Ottavio', 1176, 58.5, ('t', 0), 6, 'rifugio', 'corbella',
  'Un fienile di legno e pietra, con il fieno in alto e una finestrella che guarda il prato e il riale. Ottavio ci dorme quando non vola.'),
 ('sass_messo', 'Sass dal Messo', 1172, 57.0, ('t', 0.8), 2, 'caposaldo', 'corbella',
  'Un masso tondo accanto al fienile, lisciato da chi ci si siede. Sulla cima, il chiodo d\'ottone n. 8.'),
 ('sass_grand', 'Sass Grand', 1190, 74.0, ('t', 0), 10, 'belvedere', 'corbella',
  'Uno sperone di gneiss sulla cresta a Mane, sopra il bastione della Finestra dei Ponti. Sulla cima, il Pilastro 6 con il disco bianco e rosso.'),
 ('cancello_pellegrini', 'Cancello dei Pellegrini', 1500, 88.5, ('t', 0), 6, 'passaggio', 'finestra_ponti',
  'Un cancello di ferro in cima alla scala che scende al vetro della Finestra dei Ponti. Chiuso con una catena e un cartello della Confraternita.'),
 # Fuori da Corbella (gioco libero della Fase 1)
 ('belvedere_ponti', 'Crestone dei Ponti', 1046, 127.0, ('t', 0), 15, 'belvedere', 'verbanetto',
  'La cresta a Sera del Verbanetto, sopra il bastione della Finestra dei Ponti. Da qui Corbella si vede in alto a Sera, di sbieco, piccola e intera.'),
 ('porta_bugni', 'Porta dei Bugni', 1500, 195.5, ('t', 0), 6, 'edificio', 'verbanetto',
  'La porta della casa di Rosa ai Bugni, ai piedi della Torre. Nella Fase 1 è chiusa, con un biglietto infilato nel battente.'),
 ('parete_sordo', 'Parete del Sordo', 2800, 35.0, ('t', 0), 60, 'montagna', 'sordo',
  'La parete nord, grigia e a matita, che nessuno dipinge. Si guarda da Corbella in fondo alla valle, a Lag.'),
 ('lanterna', 'La Lanterna', 2968, 0.0, ('a', 642.0), 30, 'cielo', 'sordo',
  'Un piccolo disco grigio piombo con una corona di bulloni sull\'asse, sopra il Sordo. Nessuno lo dipinge e nessuno lo nomina.'),
]

# ---------------------------------------------------------------- capisaldi
# (id, numero, tipo, nome, luogo, z, theta, quota, altezza_segnale, monografia, note)
CS = [
 ('cs_1', 1, 'pilastro', 'Pilastro 1, cella di San Vigilio', 'cella_campanaria', 1062, 37.2, ('t', 24.0), 8.0, 'cs_1',
  'Il caposaldo principale di Corbella. Palina bianca e rossa di 8 m, leggibile da tutto il cielo. Dal sagrato (chiodo 2) è coperto dal tasso.'),
 ('cs_2', 2, 'chiodo', 'Chiodo 2, sagrato', 'sagrato', 1050, 39.6, ('t', 0.2), 0, 'cs_2',
  'Il libretto dice «da qui vedi il Pilastro 1, se il tasso non è cresciuto». Il tasso è cresciuto: il lato 2-1 non si chiude. Vede ancora il Pilastro 6 attraverso la valle.'),
 ('cs_3', 3, 'chiodo', 'Chiodo 3, muro della Terrazza Pedrazzini', 'terrazza_pedrazzini', 946, 23.6, ('t', 1.0), 0, 'cs_3',
  'Il chiodo del primo rilievo. Vede il Pilastro 1 sopra i tetti.'),
 ('cs_4', 4, 'pilastro', 'Pilastro 4, Pian dei Ricci', 'pian_dei_ricci', 800, 9.0, ('t', 1.2), 6.0, 'cs_4',
  'Disco bianco e rosso su un\'asta di 6 m. Bersaglio della mossa A1 della Madre (Atto I, fuori dalla Fase 1).'),
 ('cs_5', 5, 'chiodo', 'Chiodo 5, gradino del lavatoio', 'lavatoio', 1040, 39.5, ('t', 0.3), 0, 'cs_5',
  'Dal gradino la cella del campanile è coperta dalla tettoia del lavatoio, che nel 2121 non c\'era. Vede il Pilastro 6 e la Terrazza Pedrazzini.'),
 ('cs_6', 6, 'pilastro', 'Pilastro 6, Sass Grand', 'sass_grand', 1190, 74.0, ('t', 1.2), 8.0, 'cs_6',
  'Sulla cresta a Mane, sopra la Finestra dei Ponti. Palina bianca e rossa.'),
 ('cs_7', 7, 'chiodo', 'Chiodo 7, soglia del mulino', 'mulino', 1130, 51.0, ('t', 0.2), 0, 'cs_7',
  'Uno dei due chiodi della passerella del Messo.'),
 ('cs_8', 8, 'chiodo', 'Chiodo 8, Sass dal Messo', 'sass_messo', 1172, 57.0, ('t', 1.6), 0, 'cs_8',
  'Sul masso accanto al fienile. L\'altro chiodo della passerella del Messo.'),
 ('cs_11', 11, 'chiodo', 'Chiodo 11, cippo della Cripta', 'cippo_cripta', 1110, 26.2, ('t', 0.8), 0, 'cs_11',
  'Graffi freschi sull\'ottone. Il lato 11-1 risulta già rilevato nel Catasto, con la firma G4 e la data 2291.'),
 ('cs_37', 37, 'chiodo', 'Chiodo 37, muro della grà di Pian', 'gra_di_pian', 890, 17.5, ('t', 1.4), 0, 'cs_37',
  'Murato nell\'angolo della grà. Il libretto: «guarda il Pilastro 4 a Mont e il chiodo 3 a Mane; il castagno accanto non c\'è più» (è diventato la legnaia).'),
]

# lati della rete di Corbella (giorno). (a, b, visibile, motivo/nota)
LATI = [
 ('cs_1', 'cs_3', True, 'Il primo rilievo della missione 1: dalla Terrazza Pedrazzini sopra i tetti fino al campanile.'),
 ('cs_1', 'cs_2', False, 'Il tasso del sagrato copre la cella: la monografia di Aurelio è di duecento anni fa.'),
 ('cs_1', 'cs_11', True, 'Già rilevato nel 2291 con il codice G4 (striscia seppia della Cripta).'),
 ('cs_1', 'cs_6', True, 'Attraverso la valle, sopra il riale.'),
 ('cs_1', 'cs_7', True, 'Dal mulino al campanile.'),
 ('cs_1', 'cs_8', True, 'Dal Sass dal Messo al campanile: passa sopra i Ronchi.'),
 ('cs_1', 'cs_4', True, 'Dalle Selve alte al campanile, sopra le terrazze.'),
 ('cs_1', 'cs_5', False, 'La tettoia di piode del lavatoio, costruita dopo il 2121, copre la cella del campanile.'),
 ('cs_8', 'cs_11', True, 'Dal Sass dal Messo alla Cripta, sopra i tetti dei Ronchi.'),
 ('cs_3', 'cs_5', True, 'Dal lavatoio alla terrazza.'),
 ('cs_3', 'cs_37', True, 'Lungo le Selve basse.'),
 ('cs_3', 'cs_4', True, 'Su per le terrazze fino al Pian dei Ricci.'),
 ('cs_3', 'cs_11', True, 'Fra la terrazza e la Cripta.'),
 ('cs_4', 'cs_37', True, 'Selve alte.'),
 ('cs_5', 'cs_6', True, 'Attraverso la valle, sopra il riale.'),
 ('cs_2', 'cs_6', True, 'Dal sagrato il Pilastro 6 si vede bene, sopra il tasso.'),
 ('cs_6', 'cs_8', True, 'Dal fienile alla cresta a Mane.'),
 ('cs_7', 'cs_8', True, 'Il lato della passerella del Messo (missione 1).'),
]

# pilastri lontani visti di notte attraverso il cielo
LONTANI = [
 ('cs_12', 12, 'Pilastro 12, Ponte di Mezzo', 1500, 105.0, 8.0, 'Finestra dei Ponti', 'permanente', 'il lumino della nicchia del Ponte di Mezzo', ['cs_1', 'cs_6'], '20:00-05:30', 'mai coperto', False,
  'Non è attraverso l\'asse: è il pilastro della Finestra accanto. Vertice del triangolo T1 (missione 4).'),
 ('cs_14', 14, 'Pilastro 14, Torre dei Bugni', 1500, 197.0, 45.0, 'Il Verbanetto', 'permanente', 'la lanterna della Torre dei Bugni, che Rosa accende ogni sera', ['cs_1', 'cs_4', 'cs_6'], '20:30-05:00', 'coperto dal Collare fra le 01:00 e le 01:40', False,
  'Vertice di T1 e T5. Nella Fase 1 si può appuntare, non rilevare.'),
 ('cs_15', 15, 'Pilastro 15, serra dell\'Isola Grande', 1760, 173.0, 50.0, 'Il Verbanetto', 'Ottavio', 'nessuno: buio senza un lume di mira', ['cs_1', 'cs_4'], '21:00-05:00', 'coperto dal Collare fra le 03:00 e le 03:30', False,
  'Vertice di T2 e T6.'),
 ('cs_17', 17, 'Pilastro 17, faro dell\'Isola dei Conigli', 1180, 156.0, 34.0, 'Il Verbanetto', 'permanente', 'il faro dei pescatori, acceso tutta la notte', ['cs_1', 'cs_6', 'cs_8'], '20:00-05:30', 'mai coperto', False,
  'Il lume lontano più facile da vedere dalla finestrella del fienile.'),
 ('cs_19', 19, 'Pilastro 19, Vigne', 450, 165.0, 60.0, 'Il Verbanetto', 'Ottavio', 'nessuno', ['cs_4'], '21:00-05:00', 'coperto dal Collare fra le 23:00 e le 23:40', False,
  'Vertice di T3.'),
 ('cs_21', 21, 'Pilastro 21, Corte di Mezzo', 245, 285.0, 258.0, 'Gli Alpeggi', 'Ottavio', 'nessuno (i fuochi dei Sordi nell\'Atto III)', ['cs_4', 'cs_1'], '21:00-05:00', 'dentro il Collare dalle 02:00 alle 02:40', False,
  'Vertice di T3.'),
 ('cs_23', 23, 'Pilastro 23, Croce d\'alpe', 420, 312.0, 92.0, 'Gli Alpeggi', 'permanente', 'il lumino votivo della croce d\'alpe', ['cs_1', 'cs_4', 'cs_37'], '20:30-05:30', 'mai coperto', False,
  'Vertice di T6.'),
 ('cs_26', 26, 'Pilastro 26, campanile di Sambüch', 680, 255.0, 47.0, 'Gli Alpeggi', 'Ottavio', 'nessuno', ['cs_1', 'cs_4'], '21:00-05:00', 'mai coperto', False,
  'Vertice di T4.'),
 ('cs_28', 28, 'Pilastro 28, Rascane Grandi', 1600, 285.0, 12.0, 'Gli Alpeggi', 'Ottavio', 'nessuno', ['cs_1', 'cs_6'], '21:00-05:00', 'mai coperto', False,
  'Vertice di T2.'),
 ('cs_35', 35, 'Pilastro 35, Nicchia delle Vedove', 1300, 345.0, 8.0, 'Finestra delle Vedove', 'permanente', 'il lumino della nicchia; e, dalle 23:00 alle 02:00, la lanterna di Tecla che cammina sul vetro', ['cs_1', 'cs_4', 'cs_11'], '20:00-05:30', 'mai coperto', False,
  'Il lume che si muove: chi lo appunta nella Fase 1 trova la prima traccia della secondaria «La vedova della Finestra».'),
 ('cs_48', 48, 'Pilastro 48, Riva Alta', 1500, 139.0, 26.0, 'Il Verbanetto', 'Ottavio', 'nessuno', ['cs_1', 'cs_6'], '21:00-05:00', 'mai coperto', False,
  ''),
 ('cs_0', 0, 'Caposaldo Zero, soglia della Lanterna', 2968, 0.0, 642.0, 'Il Sordo', 'nessuno', 'cancellato dalla Carta nel 2265', [], 'mai', 'sempre bianco', False,
  'Si appunta ma resta bianco sulla Pianta: «Il disco non si appunta». Si rimette sulla Carta solo nella missione 14.'),
]

# ---------------------------------------------------------------- terreno
pts = []
for l in L:
    pts.append([l[0], l[2], l[3]])
for c in CS:
    pts.append([c[0], c[5], c[6]])
AREA_IZ = range(19, 31)   # z 760-1240
AREA_IT = range(1, 20)    # theta 3.75-75
for iz in AREA_IZ:
    for it in AREA_IT:
        cid = iz * NTH + it
        z, t = center(cid)
        pts.append([f'c{cid}', z, t])
H = terrain(pts)

def quota(key, q):
    kind, v = q
    if kind == 'a':
        return round(v, 1)
    return round(H[key]['h'] + v, 1)

luoghi = []
for (lid, nome, z, t, q, r, tipo, zona, desc) in L:
    luoghi.append({'id': lid, 'nome': nome, 'z': z, 'theta': t, 'altezza': quota(lid, q),
                   'descrizione': desc, 'raggio': r, 'tipo': tipo, 'zona': zona,
                   'cella': cell(z, t) if zona not in ('sordo',) or lid == 'parete_sordo' else None})
pos = {c[0]: (c[5], c[6], quota(c[0], c[7])) for c in CS}

# ---------------------------------------------------------------- lati e ventagli
cells_area = [iz * NTH + it for iz in AREA_IZ for it in AREA_IT]
lati_out = []
lato_cells = {}
for (a, b, vis, nota) in LATI:
    za, ta, ha = pos[a]
    zb, tb, hb = pos[b]
    lung = round(math.sqrt(dist(za, ta, zb, tb) ** 2 + (hb - ha) ** 2), 1)
    lid = f"{a[3:]}-{b[3:]}"
    covered = []
    for cid in cells_area:
        cz, ct = center(cid)
        if seg_dist(cz, ct, za, ta, zb, tb) <= BUFFER:
            covered.append(cid)
    lato_cells[lid] = covered if vis else []
    lati_out.append({'id': lid, 'a': a, 'b': b, 'lunghezza': lung, 'chiudibile': vis,
                     'quando': 'giorno, brace e notte' if vis else 'mai (per ora)',
                     'nota': nota, 'particelle': covered if vis else [],
                     'particelle_se_fosse_chiudibile': [] if vis else covered})

# ---------------------------------------------------------------- particelle e notte
ELEMENTI = {
 'E1': {'id': 'E1', 'nome': 'Passerella del Messo', 'particelle': [cell(1163, 51.9), cell(1168, 55.0)], 'trama': True,
        'varianti': [
          {'id': 'Carta', 'descrizione': 'Riale libero; il sentiero nel prato di Ronco è pettinato come da una mano enorme; le tre assi sono accatastate in ordine sulla riva a Sera.', 'pezzi': ['decal_prato_pettinato', 'mucchio_assi_riva']},
          {'id': 'Abitata', 'descrizione': 'Tre assi di castagno sul riale, il sentiero battuto fino al fienile.', 'pezzi': ['assi_passerella_x3', 'decal_sentiero_battuto']}],
        'variante_iniziale': 'Carta', 'ora_fade': '23:20',
        'cicli_del_giorno': [{'ora': '19:30', 'chi': 'ottavio', 'da': 'Carta', 'a': 'Abitata', 'testo': 'Ottavio rimette le assi tornando al fienile.'}],
        'via_necessaria': True, 'alternativa': 'guado_sass', 'note': 'Il «sentiero sparito» della missione 1. Il lato 7-8 lo chiude.'},
 'E2': {'id': 'E2', 'nome': 'Casa di Nando', 'particelle': [cell(1188, 46.0)], 'trama': True,
        'varianti': [
          {'id': 'Abitata', 'descrizione': 'Casa intera: quattro muri a secco, tetto di frasche e lamiera.', 'pezzi': ['casa_nando_intera']},
          {'id': 'Smontata', 'descrizione': 'Manca il muro a Sera: le pietre sono state portate nel muro di Ronco. Dentro si vede il letto.', 'pezzi': ['casa_nando_senza_muro_sera', 'decal_pietre_mancanti']},
          {'id': 'Carta', 'descrizione': 'Prato con il rudere di un muretto (mai raggiunto nella Fase 1: Nando ricostruisce ogni mattina).', 'pezzi': ['rudere_muretto']}],
        'variante_iniziale': 'Smontata', 'ora_fade': '00:30', 'stadi': ['Abitata', 'Smontata', 'Carta'],
        'cicli_del_giorno': [{'ora': '08:30', 'chi': 'nando', 'da': 'Smontata', 'a': 'Abitata', 'testo': 'Nando prende le pietre dal muro di Ronco e rifà il muro a Sera.'}],
        'via_necessaria': False, 'note': 'Ogni notte perde un muro (avanza di uno stadio verso la Carta). Secondaria «La casa che non c\'è»: poggia sul pozzo d\'aria dell\'Archivio. La chiudono i lati 1-8 e 8-11.'},
 'E3': {'id': 'E3', 'nome': 'Muro di Ronco', 'particelle': [cell(1150, 43.5)], 'trama': False,
        'varianti': [
          {'id': 'Carta', 'descrizione': 'Muro a secco intero.', 'pezzi': ['muro_ronco_intero']},
          {'id': 'Abitata', 'descrizione': 'Una breccia di tre metri: le pietre le ha prese Nando.', 'pezzi': ['muro_ronco_breccia']}],
        'variante_iniziale': 'Carta', 'ora_fade': '00:30',
        'cicli_del_giorno': [{'ora': '08:30', 'chi': 'nando', 'da': 'Carta', 'a': 'Abitata', 'testo': 'Nando apre la breccia per prendere le pietre.'}],
        'via_necessaria': False, 'legato_a': 'E2',
        'note': 'Le stesse pietre vanno di giorno nella casa e di notte nel muro. Se il muro è rilevato, le Fade lasciano le pietre della casa in un mucchio al margine della particella. Chiuso dai lati 1-6, 1-7, 1-8 e 8-11.'},
 'E4': {'id': 'E4', 'nome': 'Scorciatoia delle Terrazze', 'particelle': [cell(985, 27.6), cell(1010, 28.0)], 'trama': True,
        'varianti': [
          {'id': 'Carta', 'descrizione': 'Terrazze intatte, nessun gradino; le assi dei gradini accatastate al margine della Terrazza Pedrazzini.', 'pezzi': ['mucchio_assi_terrazza']},
          {'id': 'Abitata', 'descrizione': 'Gradini di assi infilati nei muri e un sentiero battuto dritto fra le terrazze.', 'pezzi': ['gradini_assi_x6', 'decal_sentiero_battuto']}],
        'variante_iniziale': 'Carta', 'ora_fade': '22:20',
        'cicli_del_giorno': [{'ora': '07:00', 'chi': 'bortolo', 'da': 'Carta', 'a': 'Abitata', 'testo': 'Il campanaro Bortolo rimette i gradini.'}],
        'via_necessaria': True, 'alternativa': 'mulattiera_terrazze', 'note': 'Il lato 1-3 (primo rilievo) la chiude.'},
}
el_by_cell = {}
for e in ELEMENTI.values():
    for c in e['particelle']:
        el_by_cell[c] = e['id']

named = {}
for l in luoghi:
    if l['cella'] is not None and l['zona'] in ('corbella', 'selve_alte'):
        named.setdefault(l['cella'], []).append(l['id'])

g4 = set(lato_cells['1-11'])
RIFUGI = {cell(1176, 58.5), cell(1112, 27.0)}
cover = {}
for lid, cs_ in lato_cells.items():
    for c in cs_:
        cover.setdefault(c, []).append(lid)

def classify(cid, m):
    z, t = center(cid)
    if m['piazza'] > 0.5:
        return 'piazza'
    if m['stream'] is not None and m['stream'] < 10:
        return 'riale'
    if 1000 <= z <= 1200 and 28 <= t <= 50 and m['village'] > 0.55:
        return 'abitato'
    if t >= 66:
        return 'cresta'
    if t < 8:
        return 'cresta'
    if m['stream'] is not None and m['stream'] < 60:
        return 'prato di riva'
    if t < 34 and m['h'] > 30:
        return 'terrazze' if m['village'] > 0.05 else 'selva'
    if m['village'] > 0.3:
        return 'terrazze'
    return 'prato'

particelle = []
inventario = []
for cid in cells_area:
    iz, it = divmod(cid, NTH)
    z, t = center(cid)
    m = H[f'c{cid}']
    tipo = classify(cid, m)
    hub = tipo in ('abitato', 'piazza') and cid not in el_by_cell  # un elemento mobile non è mai hub
    stato = 'bianco'
    rilevata_da = None
    if cid in g4:
        stato, rilevata_da = 'colore', {'codice': 'G4', 'anno': 2291, 'lato': '1-11', 'inchiostro': 'seppia'}
    elif tipo in ('selva', 'terrazze'):
        stato = 'matita'
    in_corbella = 22 <= iz <= 29 and 5 <= it <= 16
    if in_corbella and cid in cover:
        inventario.append(cid)
    p = {
        'id': cid, 'catasto': f"1-{iz * 24 + it + 1}", 'iz': iz, 'itheta': it,
        'z_min': iz * DZ, 'z_max': (iz + 1) * DZ, 'theta_min': round(it * DTH, 2), 'theta_max': round((it + 1) * DTH, 2),
        'centro': {'z': z, 'theta': t, 'altezza': m['h']},
        'tipo': tipo, 'nomi': named.get(cid, []),
        'hub': hub, 'rifugio': cid in RIFUGI, 'mobile': cid in el_by_cell, 'elemento': el_by_cell.get(cid),
        'stato_iniziale': stato, 'rilevata_da': rilevata_da,
        'chiusa_da': cover.get(cid, []), 'inventario_corbella': in_corbella and cid in cover,
    }
    if stato == 'matita':
        p['nota_stato'] = 'Le Selve le ha disegnate Elvira: la Pianta si apre con il suo disegno del 2119.'
    particelle.append(p)

# ---------------------------------------------------------------- notti della Fase 1
def ev(ora, el, da, a, motivo, cond=None):
    e = {'ora': ora, 'elemento': el, 'particelle': ELEMENTI[el]['particelle'], 'da': da, 'a': a, 'motivo': motivo}
    if cond:
        e['se'] = cond
    return e

notte1 = {
 'notte': 1, 'giorno': 1, 'inizio': '21:00', 'fine': '05:30',
 'stato_atteso_alla_brace': {'E1': 'Abitata', 'E2': 'Abitata', 'E3': 'Abitata', 'E4': 'Abitata'},
 'mosse_della_madre': [], 'correzioni_al_terminale': [],
 'giro': [
   {'ora': '22:05', 'evento': 'Le Fade escono dalla Bocca del Ronco (1215, 41) e dalla bocca delle Terrazze (975, 20): due cerchi di lumi.'},
   ev('22:20', 'E4', 'Abitata', 'Carta', 'Non misurata: tornata alla Carta.', '!elemento_rilevato:E4 e !elvira_su:E4'),
   ev('23:20', 'E1', 'Abitata', 'Carta', 'Non misurata: tornata alla Carta.', '!elemento_rilevato:E1 e !elvira_su:E1'),
   ev('00:30', 'E2', 'Abitata', 'Smontata', 'Non misurata: un muro in meno.', '!elemento_rilevato:E2 e !elvira_su:E2'),
   ev('00:30', 'E3', 'Abitata', 'Carta', 'Non misurato: le pietre rimesse nel muro.', '!elemento_rilevato:E3 e !elvira_su:E3'),
   {'ora': '02:00', 'evento': 'Le Fade salgono alle Selve alte (niente da cambiare nella Fase 1: solo il ballo dei lumi, visibile dalla finestrella del fienile come un cerchio lontano).'},
   {'ora': '04:30', 'evento': 'Le Fade rientrano nelle bocche.'},
 ],
 'pesarina': {'ora': '03:10', 'dove': 'il letto o il rifugio dove dorme Elvira', 'effetto': 'Il Taccuino viene aperto su un\'altra pagina (la pagina «Parole»). Elvira si sveglia con un peso sul petto che svanisce.', 'flag': 'taccuino_spostato'},
 'variante_se_elvira_veglia_su_E1': 'Se Elvira passa la notte sulla passerella (o nel prato di Ronco sopra la particella del sentiero), le Fade arrivano alle 23:20, girano attorno a lei e se ne vanno: la passerella resta. Al mattino Ottavio: «Ci hai dormito sopra? Le Fade non toccano chi c\'è.» La lezione arriva comunque dalla scorciatoia delle Terrazze e dalla casa di Nando.',
}
notte2 = {
 'notte': 2, 'giorno': 2, 'inizio': '21:00', 'fine': '05:30',
 'stato_atteso_alla_brace': {'E1': 'Abitata (rimessa con Ottavio durante la missione)', 'E2': 'Abitata', 'E3': 'Abitata', 'E4': 'Abitata (rimessa da Bortolo alle 07:00)'},
 'mosse_della_madre': [], 'correzioni_al_terminale': [],
 'giro': [
   ev('22:20', 'E4', 'Abitata', 'Carta', 'Non misurata: tornata alla Carta.', '!elemento_rilevato:E4 e !elvira_su:E4'),
   ev('23:20', 'E1', 'Abitata', 'Carta', 'Non misurata: tornata alla Carta.', '!elemento_rilevato:E1 e !elvira_su:E1'),
   ev('00:30', 'E2', 'Abitata', 'Smontata', 'Non misurata: un muro in meno.', '!elemento_rilevato:E2 e !elvira_su:E2'),
   ev('00:30', 'E3', 'Abitata', 'Carta', 'Non misurato: le pietre rimesse nel muro.', '!elemento_rilevato:E3 e !elvira_su:E3'),
   {'ora': '04:30', 'evento': 'Le Fade rientrano nelle bocche.'},
 ],
 'esito_atteso': 'Con la missione 1 svolta, E1 ed E4 sono rilevati: restano. E2 ed E3 (se non rilevati) fanno il loro giro. Al mattino il resoconto mostra in rosso solo la casa di Nando e il muro di Ronco.',
 'pesarina': {'ora': '03:10', 'dove': 'dove dorme Elvira', 'effetto': 'Nessun effetto visibile nella Fase 1 (la Pesarina passa ogni notte; il Taccuino si sposta solo la prima).'},
}

fade = {
 '_nota': 'Regole deterministiche della notte per la Fase 1 di Cielo di Terra. Griglia del motore: celle di 40 m in z e 3,75° in theta, id = iz*96 + itheta. Coordinate (z, theta, altezza) come nel GDD. Generato da gen_spazio.py con la quota del terreno di src/world/terrain.ts.',
 'versione': 1,
 'griglia': {'dz': DZ, 'dtheta': DTH, 'n_theta': NTH, 'formula_id': 'floor(z/40)*96 + floor(theta/3.75)', 'area_fase1': {'iz': [AREA_IZ.start, AREA_IZ.stop - 1], 'itheta': [AREA_IT.start, AREA_IT.stop - 1], 'z': [AREA_IZ.start * DZ, AREA_IZ.stop * DZ], 'theta': [AREA_IT.start * DTH, AREA_IT.stop * DTH]}},
 'stati': {
   'bianco': 'mai visto. Pianta: foglio vuoto. Mondo oltre 200 m: carta avorio con il solo contorno delle forme grandi.',
   'matita': 'visto (Elvira è passata a meno di 60 m, oppure l\'ha appuntato con lo squadro) ma non rilevato. Mondo oltre 200 m: contorni e tratteggio a grafite.',
   'colore': 'rilevato. Mondo: dipinto pieno con il contorno a china. Pianta: inchiostro e acquerello. Il rilievo G4 del 2291 è a inchiostro seppia.',
   'vicino': 'Entro 200 m il mondo è sempre dipinto; una particella non rilevata è a tempera spenta (saturazione 75 %, contorni a matita sottili).',
   'transizioni': ['bianco -> matita: Elvira passa a meno di 60 m o appunta', 'matita/bianco -> colore: rilievo di un lato che la contiene', 'colore -> matita: caposaldo spostato o scrittura cancellata (non accade nella Fase 1)'],
 },
 'condizioni_notte': {
   'elemento_rilevato:X': 'tutte le particelle dell\'elemento X sono rilevate (da Elvira o da un altro Giardiniere). Se ne è rilevata solo una parte, l\'elemento conta come non rilevato e torna alla Carta per intero.',
   'elvira_su:X': 'all\'ora del passaggio Elvira si trova su una particella dell\'elemento X: le Fade le girano attorno e se ne vanno (regola 4); il sistema accende flag:notte_su_X.',
   'sintassi': 'come nei passi di missione: atomi uniti da e / o, ! per negare'},
 'leggi': [
   {'id': 'legge_1', 'articolo': 'Le macchine di manutenzione riportano al progetto ogni particella che nessun Giardiniere ha verificato sul terreno negli ultimi cinquant\'anni.', 'proverbio': 'Quel che la Giardinéra la mesüra, la nocc la tóca mía.', 'italiano': 'Ciò che la Giardiniera ha misurato, la notte non lo tocca.', 'fase1': 'si impara col corpo (sentiero sparito, sentiero rilevato che resta)'},
   {'id': 'legge_2', 'articolo': 'Una misura fatta sul terreno da un caposaldo vale più di qualunque correzione fatta al terminale, finché quel caposaldo resta al suo posto. Fra due correzioni al terminale vale quella del Giardiniere di turno più anziano.', 'proverbio': 'La préda mesürada la var püssée che la péna.', 'italiano': 'La pietra misurata vale più della penna.', 'fase1': 'solo come proverbio (Togna, Ottavio); si capisce nella missione 5'},
 ],
 'regole': [
   {'ordine': 1, 'nome': 'Mosse della Madre', 'regola': 'Le mosse in programma per la notte, annunciate la sera prima, spostano capisaldi; le particelle che dipendono solo da un caposaldo spostato tornano a matita. Tetto: 8 capisaldi per notte.', 'fase1': 'Nessuna mossa: la prima mossa possibile (A1) è dell\'Atto I, dopo la missione 1.'},
   {'ordine': 2, 'nome': 'Correzioni al terminale', 'regola': 'Il G3 cancella gli elementi scritti dalla Penna di Elvira e non rimisurati.', 'fase1': 'Nessuna: Elvira non ha la Penna.'},
   {'ordine': 3, 'nome': 'Giro delle Fade', 'regola': 'Ogni elemento mobile non rilevato torna alla variante Carta, o avanza di uno stadio verso la Carta, all\'ora fissa del suo passaggio. Una particella rilevata è fuori dal giro: la notte non la tocca, qualunque cosa ci sia sopra. Il rilievo non fotografa, protegge: di giorno la gente può ancora cambiarla.', 'fase1': 'Attiva su E1-E4 (vedi giro_corbella).'},
   {'ordine': 4, 'nome': 'Eccezioni fisse', 'regola': 'Mai l\'hub, le vie di trama, i rifugi; mai la particella dove si trova Elvira all\'ora del passaggio (le Fade le girano attorno e tornano all\'alba nelle bocche); mai un sentiero necessario senza un\'alternativa visibile.', 'fase1': 'Hub = particelle di tipo abitato e piazza. Rifugi: il fienile di Ottavio e la Cripta. Alternative: il guado del Sass per E1, la mulattiera delle Terrazze per E4.'},
 ],
 'orari': {'alba': '05:30-06:30', 'linea_sopra_corbella': '05:40', 'giorno': '06:30-19:30', 'brace': '19:30-21:00', 'notte': '21:00-05:30', 'giro_delle_fade': '22:00-04:30', 'ombrista': '19:45-20:30', 'ora_reale': '1 ora di gioco = 100 s; giorno di 24 ore = 40 minuti'},
 'elementi_mobili': list(ELEMENTI.values()),
 'giro_corbella': [
   {'ora': '22:05', 'dove': 'Bocca del Ronco (1215, 41) e bocca delle Terrazze (975, 20)', 'che_cosa': 'Le Fade escono: lumi caldi in cerchio.'},
   {'ora': '22:20', 'dove': 'Terrazze', 'elemento': 'E4', 'durata_min': 30, 'che_cosa': 'Tolgono i gradini e li accatastano; pettinano il sentiero.'},
   {'ora': '23:20', 'dove': 'Riale e prato di Ronco', 'elemento': 'E1', 'durata_min': 30, 'che_cosa': 'Sollevano le assi, le posano in ordine sulla riva, pettinano il prato.'},
   {'ora': '00:30', 'dove': 'I Ronchi', 'elemento': ['E2', 'E3'], 'durata_min': 40, 'che_cosa': 'Prendono le pietre del muro a Sera della casa di Nando e le rimettono nella breccia del muro di Ronco.'},
   {'ora': '02:00', 'dove': 'Selve alte', 'che_cosa': 'Ballo dei lumi fra i castagni, lontano.'},
   {'ora': '04:30', 'dove': 'bocche', 'che_cosa': 'Rientro.'},
 ],
 'notti': [notte1, notte2],
 'resoconto_del_mattino': {
   'titolo': 'Che cosa è cambiato stanotte',
   'righe': {
     'Carta': '{nome}: non misurata, tornata alla Carta.',
     'Smontata': '{nome}: non misurata, un muro in meno.',
     'nessun_cambiamento': 'Notte quieta.',
     'rilevata_rimasta': '{nome}: misurata, è rimasta.'},
   'prossima_finestra': 'Riga in fondo: il prossimo evento utile (in Fase 1: «Bortolo rimette i gradini alle 07:00», «Nando ricostruisce alle 08:30», «Ottavio rimette la passerella alla brace»).',
   'colore': 'Le particelle cambiate sono segnate in rosso sulla Pianta per tutto il mattino (fino alle 12:00).'},
 'inventario_corbella': {'descrizione': 'Le particelle del nucleo di Corbella (iz 22-29, itheta 5-16) che la rete della Fase 1 può rilevare. Quando sono tutte a colore, Meridiana rende il primo servizio: le campane di San Vigilio tornano a segnare l\'ora (un rintocco per ora, dalle 06:00 alle 21:00).', 'particelle': inventario, 'quante': len(inventario)},
 'particelle': particelle,
}

capisaldi = {
 '_nota': 'Rete di rilievo di Corbella per la Fase 1 e pilastri lontani visti di notte. Coordinate (z, theta, altezza); altezza = quota sopra il fondo verso l\'asse (r = 646 - altezza), già comprensiva del terreno. visibile_da: capisaldi da cui questo si può collimare di giorno. Il ventaglio di un lato contiene le particelle il cui centro dista al massimo 60 m dal segmento.',
 'versione': 1,
 'regole': {'lato_min_m': 40, 'lato_max_giorno_m': 600, 'buffer_ventaglio_m': BUFFER, 'abbagliamento_asse_m': 150, 'giorno': 'solo lati nella stessa valle', 'notte': 'lati attraverso il cielo sui lumi (dalla Fase 3)'},
 'rete_corbella': [],
 'lati': lati_out,
 'lontani_di_notte': [],
}
for (cid_, num, tipo, nome, luogo, z, t, q, seg, mono, note) in CS:
    vis = sorted({(l['b'] if l['a'] == cid_ else l['a']) for l in lati_out if l['chiudibile'] and cid_ in (l['a'], l['b'])}, key=lambda s: int(s[3:]))
    nonvis = [{'id': (l['b'] if l['a'] == cid_ else l['a']), 'motivo': l['nota']} for l in lati_out if not l['chiudibile'] and cid_ in (l['a'], l['b'])]
    capisaldi['rete_corbella'].append({
        'id': cid_, 'numero': num, 'tipo': tipo, 'nome': nome, 'luogo': luogo,
        'z': z, 'theta': t, 'altezza': pos[cid_][2], 'altezza_segnale': seg, 'cella': cell(z, t),
        'visibile_da': vis, 'non_visibile_da': nonvis, 'monografia': f'libretto.{mono}', 'note': note,
        'stato_iniziale': 'gia_rilevato_G4' if cid_ in ('cs_1', 'cs_11') else 'mai_usato'})
for (cid_, num, nome, z, t, h, valle, lume, lume_desc, vis, ore, collare, att, note) in LONTANI:
    capisaldi['lontani_di_notte'].append({
        'id': cid_, 'numero': num, 'nome': nome, 'z': z, 'theta': t, 'altezza': h, 'valle': valle,
        'lume': lume, 'lume_descrizione': lume_desc, 'visibile_da': vis, 'ore': ore, 'collare': collare,
        'attivo_fase1': att, 'in_fase1': 'si può appuntare (diventa matita sulla Pianta e una nota nel Taccuino), non rilevare' if lume == 'permanente' else ('si appunta come «disco bianco»' if cid_ == 'cs_0' else 'buio: si vede solo con il lume di Ottavio (Fase 3)'),
        'note': note})

os.makedirs(OUT, exist_ok=True)
json.dump(luoghi, open(f'{OUT}/luoghi.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
json.dump(capisaldi, open(f'{OUT}/capisaldi.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
json.dump(fade, open(f'{OUT}/fade_fase1.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1)

# riepilogo per il designer
print('luoghi', len(luoghi), 'capisaldi', len(CS), 'lati', len(lati_out), 'particelle', len(particelle), 'inventario', len(inventario))
for l in lati_out:
    els = sorted({el_by_cell[c] for c in l['particelle'] if c in el_by_cell})
    print(f"lato {l['id']:6s} {l['lunghezza']:6.1f} m  chiud={l['chiudibile']!s:5s} n={len(l['particelle']):3d} elementi={els}")
print('G4 band', sorted(g4))
print('elementi', {k: v['particelle'] for k, v in ELEMENTI.items()})
from collections import Counter
print(Counter(p['tipo'] for p in particelle))
print(Counter(p['stato_iniziale'] for p in particelle))
nuc = [iz * NTH + it for iz in range(22, 30) for it in range(5, 17)]
print('nucleo', len(nuc), 'coperte', len([c for c in nuc if c in cover]), 'scoperte', [c for c in nuc if c not in cover])
for k in ['castagno_morto', 'terrazza_pedrazzini', 'piazza_ore', 'cella_campanaria', 'fienile_ottavio', 'belvedere_ponti', 'casa_nando']:
    l = next(x for x in luoghi if x['id'] == k)
    print(k, l['cella'], l['altezza'])
