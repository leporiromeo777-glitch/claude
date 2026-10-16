// Inquadrature della rifinitura 1, area «mondo» (docs/grafica/rifinitura-1-mondo.md).
// Ogni setup gira nel browser con g = window.__GAME__ (build e2e), come in scripts/shots.mjs: il
// giro di schermate ferma il ciclo e l'orologio, imposta la qualità (alta se non detto), chiama il
// setup, carica i chunk e avanza `frames` fotogrammi (6 se non detto), poi cattura; `after` rimette
// le cose a posto per l'inquadratura seguente.
export const SHOTS = [
  // confronti con i bozzetti (come scripts/shots.mjs 11-14)
  { id: 'c1-alba-castagno', setup: (g) => { g.setTime(7.0); g.teleport(1117, 26.6, 0); g.lookAt(1046, 37.4, g.game.world.groundAt(1046, 37.4) + 18); } },
  { id: 'c2-terrazze', setup: (g) => { g.setTime(12.5); g.teleport(965, 25.0, 0); g.lookAt(1045, 38, g.game.world.groundAt(1045, 38) - 6); } },
  { id: 'c3-planata-asse', frames: 40, setup: (g) => { g.setTime(11); g.teleport(700, 35, 330, true); g.look(0, 12); g.startGlide(7); } },
  { id: 'c5-notte-paese', setup: (g) => { g.setTime(22.4); g.teleport(1085, 31.5, 0); g.lookAt(1050, 37.2, g.game.world.groundAt(1050, 37.2) + 6); } },
  // provini del motore
  { id: 's01-paese-mezzogiorno', frames: 4, setup: (g) => { g.setTime(12.2); g.teleport(1028, 36.6, 0); g.look(62, 30); } },
  { id: 's02-asse-sordo', frames: 4, setup: (g) => { g.setTime(10.5); g.teleport(470, 44, 0); g.look(0, 9); } },
  { id: 's05-notte-paese', frames: 4, setup: (g) => { g.setTime(23.2); g.teleport(1012, 30.5, 0); g.look(78, 24); } },
  // rilievo di notte: cerchio di 200 m rilevato attorno a Corbella
  { id: 'n7-notte-rilievo', setup: (g) => { const ids = g.cellsInRadius(1040, 36.4, 200); g.__celle = ids.map((id) => [id, g.game.world.cells.get(id)]); for (const id of ids) g.setCellState(id, 2); g.setTime(23.5); const gr = g.game.world.groundAt(1000, 33); g.setCamera(1000, 33, gr + 70, 70, -14); }, after: (g) => { g.setFreeCamera(false); for (const [id, st] of g.__celle) g.setCellState(id, st); } },
  { id: 'n9-notte-rilievo-terra', setup: (g) => { const ids = g.cellsInRadius(1040, 36.4, 200); g.__celle = ids.map((id) => [id, g.game.world.cells.get(id)]); for (const id of ids) g.setCellState(id, 2); g.setTime(23.5); g.teleport(1085, 31.5, 0); g.lookAt(1000, 33, g.game.world.groundAt(1000, 33) + 20); }, after: (g) => { for (const [id, st] of g.__celle) g.setCellState(id, st); } },
  { id: 'n8-giorno-rilievo', setup: (g) => { const ids = g.cellsInRadius(1040, 36.4, 200); g.__celle = ids.map((id) => [id, g.game.world.cells.get(id)]); for (const id of ids) g.setCellState(id, 2); g.setTime(11); const gr = g.game.world.groundAt(1000, 33); g.setCamera(1000, 33, gr + 70, 70, -14); }, after: (g) => { g.setFreeCamera(false); for (const [id, st] of g.__celle) g.setCellState(id, st); } },
  // inquadrature del direttore artistico
  { id: 'a01-piazza-mattino', setup: (g) => { g.setTime(9.5); g.regia.vai(1044, 36.6); g.lookAt(1062, 37.2, g.game.world.groundAt(1062, 37.2) + 10); } },
  { id: 'a02-piazza-case', setup: (g) => { g.setTime(10.5); g.regia.vai(1048, 37.4); g.lookAt(1050, 34.5, g.game.world.groundAt(1050, 34.5) + 3); } },
  { id: 'a03-lavatoio', setup: (g) => { g.setTime(10.5); g.regia.vai(1036, 38.8); g.lookAt(1040.5, 39.6, g.game.world.groundAt(1040.5, 39.6) + 1); } },
  { id: 'a04-lavatoio-retro', setup: (g) => { g.setTime(15); g.regia.vai(1045, 40.2); g.lookAt(1040, 39.5, g.game.world.groundAt(1040, 39.5) + 1); } },
  { id: 'a05-terrazza-castagni', setup: (g) => { g.setTime(11); g.regia.vai(945, 23.6); g.lookAt(951, 22.2, g.game.world.groundAt(951, 22.2) + 3); } },
  { id: 'a06-terrazze-pomeriggio', setup: (g) => { g.setTime(15.5); g.regia.vai(962, 25.0); g.lookAt(925, 21, g.game.world.groundAt(925, 21) + 1); } },
  { id: 'a07-selva-ricci', setup: (g) => { g.setTime(9.0); g.regia.vai(800, 9.0); g.lookAt(830, 12, g.game.world.groundAt(830, 12) + 2); } },
  { id: 'a08-selva-nastri', setup: (g) => { g.setTime(16); g.regia.vai(700, 12); g.lookAt(740, 14, g.game.world.groundAt(740, 14) + 2); } },
  { id: 'a09-tramonto-belvedere', setup: (g) => { g.setTime(19.8); g.regia.vai(1094, 29.8); g.lookAt(1046, 37.2, g.game.world.groundAt(1046, 37.2) + 8); } },
  { id: 'a10-crepuscolo-piazza', setup: (g) => { g.setTime(20.4); g.regia.vai(1050, 36.0); g.lookAt(1062, 37.2, g.game.world.groundAt(1062, 37.2) + 12); } },
  { id: 'a11-notte-piazza', setup: (g) => { g.setTime(22.8); g.regia.vai(1044, 36.6); g.lookAt(1062, 37.2, g.game.world.groundAt(1062, 37.2) + 8); } },
  { id: 'a12-notte-vicolo', setup: (g) => { g.setTime(23.2); g.regia.vai(1056, 34.8); g.lookAt(1072, 33.5, g.game.world.groundAt(1072, 33.5) + 3); } },
  { id: 'a13-planata-paese', frames: 20, setup: (g) => { g.setTime(10.5); g.teleport(1005, 33, 60); g.lookAt(1050, 37, g.game.world.groundAt(1050, 37)); g.startGlide(9); } },
  { id: 'a14-planata-valle', frames: 20, setup: (g) => { g.setTime(16.5); g.teleport(1150, 40, 90); g.look(10, -15); g.startGlide(10); } },
  { id: 'a15-planata-tramonto', frames: 20, setup: (g) => { g.setTime(19.9); g.teleport(1085, 30, 70); g.lookAt(1046, 37, g.game.world.groundAt(1046, 37)); g.startGlide(9); } },
  { id: 'a16-piazza-media', qualita: 'media', setup: (g) => { g.setTime(9.5); g.regia.vai(1044, 36.6); g.lookAt(1062, 37.2, g.game.world.groundAt(1062, 37.2) + 10); } },
  { id: 'a17-terrazza-bassa', qualita: 'bassa', setup: (g) => { g.setTime(11); g.regia.vai(945, 23.6); g.lookAt(951, 22.2, g.game.world.groundAt(951, 22.2) + 3); } },
  { id: 'a18-terrazza-media', qualita: 'media', setup: (g) => { g.setTime(11); g.regia.vai(945, 23.6); g.lookAt(951, 22.2, g.game.world.groundAt(951, 22.2) + 3); } },
  // alba e crepuscolo in più (tramonto e fase rosa)
  { id: 't1-alba-presto', setup: (g) => { g.setTime(5.8); g.teleport(1117, 26.6, 0); g.lookAt(1046, 37.4, g.game.world.groundAt(1046, 37.4) + 18); } },
  { id: 't2-sera-20', setup: (g) => { g.setTime(20.0); g.regia.vai(1094, 29.8); g.lookAt(1046, 37.2, g.game.world.groundAt(1046, 37.2) + 8); } },
  // con la regia in gioco (nuova partita): squadro in mano (alla fine: la partita resta avviata)
  { id: 'b03-squadro-terrazza', frames: 20, setup: (g) => {
    const R = g.regia; const r = R.regia;
    if (!g.__partita) { r.nuovaPartita(); R.avanza(4); R.mira('scritta_vetro'); R.avanza(1.8); R.avanza(2.6); R.premi('KeyE'); R.avanza(2.0); g.__partita = true; }
    R.vai(945, 23.6); r.orologio.ore = 11; r.orologio.fermo = 11; r.orologio.limite = null;
    r.squadro.disponibile = true; if (r.squadro.stato === 'riposto') r.squadro.prendi(); R.avanza(1);
    R.mira([1046, 37, g.game.world.groundAt(1046, 37) + 4]); } },
  { id: 'b05-squadro-mattino-paese', frames: 20, setup: (g) => {
    const R = g.regia; const r = R.regia;
    if (!g.__partita) { r.nuovaPartita(); R.avanza(4); R.mira('scritta_vetro'); R.avanza(1.8); R.avanza(2.6); R.premi('KeyE'); R.avanza(2.0); g.__partita = true; }
    R.vai(1117, 26.6); r.orologio.ore = 7.0; r.orologio.fermo = 7.0;
    r.squadro.disponibile = true; if (r.squadro.stato === 'riposto') r.squadro.prendi(); R.avanza(1);
    R.mira([1046, 37.4, g.game.world.groundAt(1046, 37.4) + 18]); } },
];
