// Lingua dell'app (italiano / inglese).
// L'app è scritta in italiano; in inglese ogni testo che compare sullo schermo viene tradotto
// qui (testi fissi, testi con numeri/nomi tramite regole, messaggi del server).
"use strict";
const LANGS = ["it", "en"];
let LANG = "it";
try { LANG = localStorage.getItem("coronel_lang") || ""; } catch (e) {}
if (!LANGS.includes(LANG)) LANG = (navigator.language || "it").toLowerCase().startsWith("it") ? "it" : "en";
document.documentElement.lang = LANG;

function setLang(l) {
  try { localStorage.setItem("coronel_lang", l); } catch (e) {}
  location.reload();
}

const DATES = {
  it: { days: ["Dom", "Lun", "Mar", "Mer", "Gio", "Ven", "Sab"], daysL: ["domenica", "lunedì", "martedì", "mercoledì", "giovedì", "venerdì", "sabato"], months: ["gen", "feb", "mar", "apr", "mag", "giu", "lug", "ago", "set", "ott", "nov", "dic"] },
  en: { days: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"], daysL: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"], months: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] },
}[LANG];

const SVC_EN = { "Taglio Uomo": "Men's Cut", "Taglio studente": "Student Cut", "Barba": "Beard", "Decolorazione": "Bleaching", "Lavaggio": "Wash" };
const svcEn = s => SVC_EN[s] || s;

// Testi fissi (devono coincidere esattamente, spazi esterni esclusi)
const EN = {
  // accesso
  "Crea il tuo account": "Create your account", "Bentornato": "Welcome back", "Accedi": "Log in", "Registrati": "Sign up",
  "Entra nel": "Join the", "club Coronel": "Coronel club",
  "Raccogli un timbro a ogni visita: al 10° il taglio è omaggio.": "Collect a stamp at every visit: your 10th cut is on us.",
  "Prenota, controlla i tuoi timbri e i tuoi premi.": "Book, check your stamps and your rewards.",
  "Nome e cognome": "Full name", "Telefono (facoltativo)": "Phone (optional)", "Email": "Email", "Password": "Password",
  "Password (almeno 8 caratteri)": "Password (at least 8 characters)", "Crea account": "Create account",
  "Hai già un account?": "Already have an account?", "Non hai un account?": "Don't have an account?",
  "Password dimenticata?": "Forgot your password?", "Scrivi a Coronel": "Message Coronel",
  "Benvenuto da Coronel!": "Welcome to Coronel!",
  // navigazione
  "Home": "Home", "Prenota": "Book", "Tessera": "Card", "Profilo": "Profile", "Admin": "Admin", "Indietro": "Back", "Chiudi": "Close",
  // home
  "Il tuo prossimo taglio ti aspetta.": "Your next cut is waiting for you.", "La tua tessera": "Your card", "Vedi": "View",
  "Il mio QR": "My QR", "Scansiona": "Scan", "Prossimo appuntamento": "Next appointment", "Servizi": "Services",
  "Caricamento…": "Loading…", "Nessun appuntamento.": "No appointments.", "Prenota ora": "Book now",
  // prenotazione
  "Scegli servizio, giorno e orario. Coronel conferma la prenotazione.": "Choose service, day and time. Coronel confirms your booking.",
  "1 · Servizio": "1 · Service", "2 · Giorno": "2 · Day", "3 · Orario": "3 · Time", "Riepilogo": "Summary",
  "Nessun orario libero questo giorno. Prova un altro giorno.": "No free times on this day. Try another day.",
  "Nota (facoltativa)": "Note (optional)", "Es. prima volta, richieste particolari": "E.g. first time, special requests",
  "Invia prenotazione": "Send booking", "I miei appuntamenti": "My appointments", "Non hai ancora prenotazioni.": "You have no bookings yet.",
  "Annulla": "Cancel", "Prenotazione inviata! Riceverai la conferma qui nell'app.": "Booking sent! You'll get the confirmation here in the app.",
  "Prenotazione annullata": "Booking cancelled", "Vuoi annullare questa prenotazione?": "Do you want to cancel this booking?",
  "richiesta": "requested", "confermata": "confirmed", "completata": "done", "rifiutata": "declined", "annullata": "cancelled",
  "richiesto": "requested", "attivo": "active", "usato": "used", "annullato": "cancelled",
  // tessera
  "La mia tessera": "My card", "Il tuo livello": "Your level", "Storico": "History",
  "Sali di livello per avere timbri bonus.": "Level up to get bonus stamps.", "Sei al livello più alto!": "You're at the top level!",
  "Gold: +1 timbro bonus ogni 5 visite · Black: +1 timbro bonus ogni 3 visite.": "Gold: +1 bonus stamp every 5 visits · Black: +1 bonus stamp every 3 visits.",
  "Ancora nessun timbro: il primo arriva alla prossima visita.": "No stamps yet: the first one comes at your next visit.",
  "Visita": "Visit", "Timbro bonus": "Bonus stamp", "Premio riscattato": "Reward redeemed", "Correzione": "Correction",
  "Il mio codice": "My code", "Mostralo in studio": "Show it in the studio",
  "Coronel lo scansiona dopo il servizio e il timbro arriva sulla tua tessera.": "Coronel scans it after your service and the stamp lands on your card.",
  "Timbro aggiunto!": "Stamp added!", "Timbro aggiunto + timbro bonus!": "Stamp + bonus stamp added!",
  // scanner
  "Scanner": "Scanner", "QR del negozio": "Shop QR", "QR del cliente": "Client QR", "Inquadra il codice QR.": "Point the camera at the QR code.",
  "Non riesci a scansionare? Inserisci il codice": "Can't scan? Enter the code", "Codice": "Code", "Conferma codice": "Confirm code",
  "Non riesco ad aprire la fotocamera: consenti l'accesso alla fotocamera oppure inserisci il codice a mano.": "I can't open the camera: allow camera access or enter the code manually.",
  // profilo
  "Nome": "Name", "Telefono": "Phone", "Cambia password": "Change password", "Password attuale": "Current password", "Nuova password": "New password",
  "Salva": "Save", "Salvato": "Saved", "Profilo aggiornato": "Profile updated", "Buoni regalo": "Gift vouchers",
  "Regala un momento da Coronel: scegli l'importo, Coronel attiva il buono e ti dà il codice da regalare.": "Give a moment at Coronel: choose the amount, Coronel activates the voucher and gives you the code to gift.",
  "Richiedi un buono regalo": "Request a gift voucher", "Buono regalo": "Gift voucher", "Richiedi un buono": "Request a voucher",
  "Importo (€)": "Amount (€)", "Per chi è? (facoltativo)": "Who is it for? (optional)", "Messaggio (facoltativo)": "Message (optional)",
  "Invia richiesta": "Send request", "Richiesta inviata": "Request sent",
  "Il pagamento si fa in studio: dopo, Coronel attiva il buono e qui compare il codice.": "You pay in the studio: then Coronel activates the voucher and the code appears here.",
  "Contatti": "Contacts", "Mar–Ven 9–19 · Sab 9–18 · Dom–Lun chiuso": "Tue–Fri 9–19 · Sat 9–18 · Sun–Mon closed",
  "Instagram": "Instagram", "Sito web": "Website", "Esci": "Log out", "Lingua": "Language",
  "Elimina il mio account": "Delete my account", "Attenzione": "Warning", "Elimina account": "Delete account",
  "Verranno cancellati il tuo profilo, i timbri e le prenotazioni future. L'operazione non si può annullare.": "Your profile, stamps and future bookings will be deleted. This cannot be undone.",
  "Conferma con la tua password": "Confirm with your password", "Elimina definitivamente": "Delete permanently", "Account eliminato": "Account deleted",
  // admin
  "Area riservata": "Restricted area", "Prenotazioni": "Bookings", "Scansiona cliente": "Scan client", "QR negozio": "Shop QR",
  "Clienti": "Clients", "Sconti e chiusure": "Discounts & closures", "Buoni": "Vouchers", "Agenda": "Schedule",
  "Conferma": "Confirm", "Rifiuta": "Decline", "Fatto · +timbro": "Done · +stamp", "Nessuna prenotazione in questo giorno.": "No bookings on this day.",
  "Timbro + bonus aggiunti": "Stamp + bonus added", "Timbro aggiunto": "Stamp added", "Timbro + bonus aggiunti!": "Stamp + bonus added!",
  "Prenotazione confermata": "Booking confirmed", "Prenotazione rifiutata": "Booking declined", "Prenotazione annullata ": "Booking cancelled",
  "Prenotazione completata": "Booking completed",
  "Scansiona il QR che il cliente mostra nella sua app, scegli il servizio e aggiungi il timbro.": "Scan the QR the client shows in their app, choose the service and add the stamp.",
  "Apri la fotocamera": "Open the camera", "Servizio fatto": "Service done", "+1 timbro per questa visita": "+1 stamp for this visit",
  "Altre azioni": "More actions", "+1 correzione": "+1 correction", "−1 correzione": "−1 correction", "Imposta nuova password": "Set new password",
  "Corretto": "Corrected", "Premio riscattato ": "Reward redeemed", "Password aggiornata: comunicala al cliente": "Password updated: tell the client",
  "Genera un QR valido una sola volta per 5 minuti: il cliente lo scansiona con l'app e riceve il timbro.": "Create a QR valid once for 5 minutes: the client scans it with the app and gets the stamp.",
  "Genera QR": "Create QR", "QR scaduto: generane uno nuovo.": "QR expired: create a new one.",
  "Cerca per nome, email o telefono": "Search by name, email or phone", "Nessun cliente trovato.": "No clients found.",
  "Ultime prenotazioni": "Latest bookings", "Nessuna prenotazione.": "No bookings.",
  "Giorni di sconto": "Discount days", "Giorno": "Day", "Sconto %": "Discount %", "Nome (facoltativo)": "Name (optional)",
  "Es. Martedì studenti": "E.g. Student Tuesday", "Aggiungi sconto": "Add discount", "Nessuno sconto in programma.": "No discounts scheduled.",
  "Chiusure straordinarie": "Special closures", "Motivo": "Reason", "Ferie, festivo…": "Holiday, vacation…", "Aggiungi chiusura": "Add closure",
  "Nessuna chiusura in programma.": "No closures scheduled.", "Elimina": "Delete", "Giorno di sconto": "Discount day", "Chiuso": "Closed",
  "Pagato · attiva": "Paid · activate", "Segna come usato": "Mark as used", "Nessuna richiesta di buono.": "No voucher requests.", "Aggiornato": "Updated",
  "Taglio Uomo omaggio": "Free Men's Cut", "Codice:": "Code:", "codice": "code",
  // messaggi del server
  "Email non valida": "Invalid email", "Scrivi il tuo nome": "Enter your name", "La password deve avere almeno 8 caratteri": "The password must be at least 8 characters",
  "Esiste già un account con questa email": "An account with this email already exists", "Email o password non corretti": "Wrong email or password",
  "Accedi di nuovo": "Please log in again", "Sessione scaduta, accedi di nuovo": "Session expired, please log in again",
  "La password attuale non è corretta": "The current password is wrong", "La nuova password deve avere almeno 8 caratteri": "The new password must be at least 8 characters",
  "Data non valida": "Invalid date", "Servizio non valido": "Invalid service", "Data o ora non valida": "Invalid date or time",
  "Quel giorno siamo chiusi": "We're closed that day", "Puoi prenotare fino a 4 settimane in anticipo": "You can book up to 4 weeks ahead",
  "Orario fuori dagli orari di apertura": "Time outside opening hours", "Scegli un orario più avanti": "Choose a later time",
  "Questo orario è appena stato preso: scegline un altro": "This time was just taken: choose another one",
  "Prenotazione non trovata": "Booking not found", "Questa prenotazione non si può annullare": "This booking can't be cancelled",
  "Codice non valido": "Invalid code", "Codice scaduto: chiedi un nuovo QR": "Code expired: ask for a new QR", "Questo codice è già stato usato": "This code has already been used",
  "Importo tra 10 e 500": "Amount between 10 and 500", "Solo per l'amministratore": "Admin only", "Azione sconosciuta": "Unknown action",
  "Stato non valido": "Invalid status", "Già segnata come fatta": "Already marked as done", "QR non riconosciuto": "QR not recognised",
  "Cliente non trovato": "Client not found", "Timbri insufficienti per il premio": "Not enough stamps for the reward",
  "Correzione tra -20 e +20": "Correction between -20 and +20", "Non puoi togliere i permessi a te stesso": "You can't remove your own admin rights",
  "Sconto tra 5% e 70%": "Discount between 5% and 70%", "Buono non trovato": "Voucher not found", "Password non corretta": "Wrong password",
  "Errore del server, riprova": "Server error, try again", "Errore di rete, riprova": "Network error, try again", "Connessione assente: riprova": "No connection: try again",
};

// Testi con parti variabili: [regola, sostituzione]
const EN_RX = [
  [/^Ciao, (.+)$/, "Hi, $1"],
  [/^(\d+)\/(\d+) timbri$/, "$1/$2 stamps"],
  [/^(\d+) min$/, "$1 min"],
  [/^Hai (\d+) premi?: (.+)\. Mostra il tuo QR in studio\.$/, (m, n, r) => `You have ${n} reward${n > 1 ? "s" : ""}: ${tr(r)}. Show your QR in the studio.`],
  [/^🎉 Hai (\d+) premi?: (.+)\. Mostra il tuo QR in studio\.$/, (m, n, r) => `🎉 You have ${n} reward${n > 1 ? "s" : ""}: ${tr(r)}. Show your QR in the studio.`],
  [/^🎉 (\d+) premi? disponibil[ei]: (.+)$/, (m, n, r) => `🎉 ${n} reward${n > 1 ? "s" : ""} available: ${tr(r)}`],
  [/^Un timbro a ogni visita\. Al (\d+)° timbro: (.+)\.$/, (m, n, r) => `One stamp per visit. At stamp ${n}: ${tr(r)}.`],
  [/^(.+) · (\d+) min$/, (m, s, n) => `${svcEn(s)} · ${n} min`],
  [/^(\d+) visit[ae] negli ultimi 12 mesi$/, (m, n) => `${n} visit${n == 1 ? "" : "s"} in the last 12 months`],
  [/^· (\d+) visit[ae] negli ultimi 12 mesi$/, (m, n) => `· ${n} visit${n == 1 ? "" : "s"} in the last 12 months`],
  [/^(.+) · (\d+)\/(\d+) timbri$/, "$1 · $2/$3 stamps"],
  [/^(\d\d:\d\d) · (.+)$/, (m, t, sv) => `${t} · ${svcEn(sv)}`],
  [/^(.+) · (\d+)€$/, (m, s, p) => `${svcEn(s)} · ${p}€`],
  [/^da (.+?) · per (.+?) · (.+)$/, "from $1 · for $2 · $3"],
  [/^Per (.+?) · (.+?) · codice$/, "For $1 · $2 · code"],
  [/^(.+?) · codice$/, "$1 · code"],
  [/^Per (.+?) · (.+)$/, "For $1 · $2"],
  [/^Vantaggio: un timbro bonus ogni (\d+) visite\.$/, "Perk: one bonus stamp every $1 visits."],
  [/^Ti mancano$/, "You need"], [/^visite per diventare (.+)\.$/, "more visits to become $1."],
  [/^(Sali di livello per avere timbri bonus\.|Vantaggio: un timbro bonus ogni \d+ visite\.) Ti mancano$/, (m, a) => `${tr(a)} You need`],
  [/^(\d+)\+ visite$/, "$1+ visits"],
  [/^(\d+) timbri · (\d+) visite in 12 mesi$/, "$1 stamps · $2 visits in 12 months"],
  [/^timbri · (\d+) visit[ae] in 12 mesi$/, "stamps · $1 visits in 12 months"],
  [/^timbri · (\d+) visit[ae] in 12 mesi ·$/, "stamps · $1 visits in 12 months ·"],
  [/^(\d+) premi da riscattare$/, "$1 rewards to redeem"],
  [/^Riscatta premio: (.+)$/, (m, r) => `Redeem reward: ${tr(r)}`],
  [/^(\d+) clienti registrati$/, "$1 registered clients"],
  [/^Da confermare \((\d+)\)$/, "To confirm ($1)"],
  [/^Buono (\d+)€$/, "Voucher €$1"],
  [/^da (.+)$/, "from $1"], [/^Per (.+) · $/, "For $1 · "],
  [/^Valido ancora$/, "Still valid for"],
  [/^✓ Usato da (.+)$/, "✓ Used by $1"], [/^Timbro assegnato a (.+)$/, "Stamp given to $1"],
  [/^Codice manuale: (.+)$/, "Manual code: $1"],
  [/^(.+) alle (\d\d:\d\d)$/, "$1 at $2"],
  [/^sconto (\d+)%$/, "$1% discount"], [/^ · sconto (\d+)%$/, " · $1% discount"],
  [/^(.+): prenota quel giorno per lo sconto$/, "$1: book that day for the discount"],
  [/^Hai già (\d+) prenotazioni aperte$/, "You already have $1 open bookings"],
  [/^Confermi il premio per (.+)\?$/, "Confirm the reward for $1?"],
  [/^Nuova password per (.+) \(almeno 8 caratteri\):$/, "New password for $1 (at least 8 characters):"],
  [/^Prenotazione (confermata|rifiutata|annullata|completata)$/, (m, s) => `Booking ${tr(s)}`],
  [/^Pi[uù] richiesto$/, "Most popular"],
  [/^(.+) · admin$/, "$1 · admin"],
];

function tr(text) {
  if (LANG === "it" || text == null) return text;
  const raw = String(text), trimmed = raw.trim();
  if (!trimmed) return raw;
  const lead = raw.slice(0, raw.indexOf(trimmed)), trail = raw.slice(raw.indexOf(trimmed) + trimmed.length);
  const core = trimmed.replace(/\s+/g, " ");
  if (EN[core] !== undefined) return lead + EN[core] + trail;
  if (SVC_EN[core]) return lead + SVC_EN[core] + trail;
  for (const [rx, rep] of EN_RX) if (rx.test(core)) return lead + core.replace(rx, rep) + trail;
  // giorni e mesi nelle date ("martedì 10 nov")
  const d = core.match(/^(domenica|lunedì|martedì|mercoledì|giovedì|venerdì|sabato) (\d+) (\w+)$/);
  if (d) {
    const it = { domenica: 0, lunedì: 1, martedì: 2, mercoledì: 3, giovedì: 4, venerdì: 5, sabato: 6 }[d[1]];
    return lead + `${DATES.daysL[it]} ${d[2]} ${d[3]}` + trail;
  }
  return raw;
}

function translateTree(root) {
  if (LANG === "it" || !root) return;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);
  for (const n of nodes) { const t = tr(n.nodeValue); if (t !== n.nodeValue) n.nodeValue = t; }
  const els = root.querySelectorAll ? root.querySelectorAll("[placeholder],[aria-label],[title]") : [];
  for (const el of [root, ...els]) {
    if (!el.getAttribute) continue;
    for (const a of ["placeholder", "aria-label", "title"]) {
      const v = el.getAttribute(a); if (v) { const t = tr(v); if (t !== v) el.setAttribute(a, t); }
    }
  }
}
if (LANG !== "it") {
  new MutationObserver(muts => {
    for (const m of muts) {
      if (m.type === "characterData") { const t = tr(m.target.nodeValue); if (t !== m.target.nodeValue) m.target.nodeValue = t; }
      else m.addedNodes.forEach(n => n.nodeType === 3 ? (n.nodeValue = tr(n.nodeValue)) : translateTree(n));
    }
  }).observe(document.documentElement, { childList: true, subtree: true, characterData: true });
}
