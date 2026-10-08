# Verifica della versione 7 · 8 ottobre 2026

Ambiente: Node 24, Chromium headless, rendering 3D con SwiftShader. Fixture locali per la scansione: nessun sito aziendale contattato nei test e nessuna email inviata. Il rendering su una GPU reale può avere prestazioni diverse.

- 21 test automatici: lettura HTML limitata, incertezza, escape dei documenti, normali delle facciate e dei tetti, cortili, LOD e percorsi stradali scollegati.
- 107 controlli UI: cataloghi, ricerca, filtri, documenti, approvazione, proposte, copia e download; sei dimensioni di viewport, zoom testo al 200%, accessibilità dei dialoghi, errori e retry.
- 7 regressioni mirate: focus da Fonti/Copertura e pulsante di chiusura dopo lo scorrimento su schermi bassi.
- 12 controlli aggiuntivi sul caricamento iniziale dell’archivio, errori 401/503/rete/risposte non valide, retry e ritorno al centro della città.
- 42 verifiche sull’API reale con database D1 locale: identità, input non validi, cinque richieste simultanee (quattro accettate e una 429), approvazione, QA, download, proposte, riserve pending e isolamento del proprietario. Il mock locale assegna la stessa identità alle sessioni: l’isolamento è verificato con righe di un proprietario distinto nel database, senza inventare header di autenticazione. Tutte le righe di prova sono state eliminate.
- Demo bilingue in Chromium 320×568: traduzione di tutti i testi, validazione nativa, zero richieste di rete e zero overflow.
- Anteprime reali di città, squadra, mobile e strada: nessun errore JavaScript rilevato.

TypeScript e ESLint completati senza errori. La navigazione 3D ha superato la verifica separata con errori di geometria, retry, controllo della camera, mappa, annullamento dei voli, movimento a quota fissa, collisioni e perdita del contesto WebGL.

Queste verifiche coprono i flussi esercitati; non certificano tutte le combinazioni di dispositivi o l’esattezza delle ricostruzioni architettoniche. Gli agenti rappresentano ruoli del prototipo e le analisi per regole non accertano bisogni commerciali.
