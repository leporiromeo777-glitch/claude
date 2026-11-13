// Collegamenti dell'interfaccia e partenza.

$$('[data-icona]').forEach((e) => e.insertAdjacentHTML('beforeend', ICONE[e.dataset.icona]));

$('#apri-esplora').addEventListener('click', () => apriPannello('esplora'));
$('#apri-percorso').addEventListener('click', () => apriPannello('percorso'));
$('#pannello-chiudi').addEventListener('click', chiudiPannello);
$('#velo').addEventListener('click', chiudiPannello);
$('#marchio').addEventListener('click', () => {
  if (stato.filtro.tipo === 'tutti') feed.scrollTo({ top: 0, behavior: 'smooth' });
  else impostaFiltro({ tipo: 'tutti' });
});
$('#freccia-su').addEventListener('click', () => vaiAClip(-1));
$('#freccia-giu').addEventListener('click', () => vaiAClip(1));

document.addEventListener('keydown', (ev) => {
  if (ev.key === 'Escape') return chiudiPannello();
  if (ev.target.closest?.('input, textarea') || pannelloAperto() || ev.metaKey || ev.ctrlKey || ev.altKey) return;
  const a = stato.attivo;
  const tasti = {
    ArrowDown: () => vaiAClip(1), PageDown: () => vaiAClip(1), j: () => vaiAClip(1),
    ArrowUp: () => vaiAClip(-1), PageUp: () => vaiAClip(-1), k: () => vaiAClip(-1),
    ArrowRight: () => a?.riproduttore?.salta(1),
    ArrowLeft: () => a?.riproduttore?.salta(-1),
    ' ': () => { if (!ev.target.closest?.('button')) a?.riproduttore?.pausa(); else return false; },
    l: () => a?.video && alternaSegno(a.video, 'piaciuti'),
    s: () => a?.video && alternaSegno(a.video, 'salvati'),
  };
  const fa = tasti[ev.key];
  if (fa && fa() !== false) ev.preventDefault();
});

// Quando cambia la misura dello schermo (o arrivano i caratteri) il testo va rimisurato.
let misura = 0;
function rimisura() {
  $$('.clip[data-pronta] .scena.fermo', feed).forEach(adatta);
  stato.attivo?.riproduttore?.riadatta();
}
window.addEventListener('resize', () => { clearTimeout(misura); misura = setTimeout(rimisura, 150); });
document.fonts?.ready.then(rimisura);

document.addEventListener('visibilitychange', () => { if (document.hidden) voce.zitta(); });
if (voce.ok) { try { speechSynthesis.addEventListener('voiceschanged', () => { voce._scelta = null; }); } catch (e) { /* niente */ } }

window.addEventListener('hashchange', () => {
  const id = decodeURIComponent(location.hash.slice(1));
  if (PER_ID.has(id) && stato.attivo?.video?.id !== id) impostaFiltro({ tipo: 'tutti' }, id);
});

feed.addEventListener('scroll', () => {
  if (!memoria.guida && feed.scrollTop > 40) { memoria.guida = 1; ricorda(); }
}, { passive: true });

costruisciFeed(decodeURIComponent(location.hash.slice(1)));
aggiornaCromo();
if (!memoria.guida) setTimeout(() => { if (!memoria.guida && !pannelloAperto()) avviso('Scorri in su per la prossima idea. Un tocco mette in pausa.', 5200); }, 3200);
