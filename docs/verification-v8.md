# Verifica della versione 8 · 8 ottobre 2026

Node 24, Chromium headless e D1 locale. I siti delle aziende non sono stati contattati durante i test; sono state usate fixture locali. Nessuna email inviata. La vista 3D non è cambiata in questa versione: per l’ultima verifica grafica completa vedi `verification-v7.md`.

- 31 test automatici: conservate le 21 verifiche precedenti, aggiunte 10 verifiche su tutti i prototipi richiesti, dati incerti, moduli per categoria, escape di HTML e traduzioni, artefatti conservati e descrittori pubblici, limiti di concorrenza e isolamento degli errori nella coda.
- 56 controlli sull’API reale con D1 locale: creazione automatica di un sito vetrina, archivio senza payload HTML, scelta del singolo artefatto, anteprima con CSP, limite atomico di quattro missioni su cinque richieste simultanee, identità, input non validi, proprietà, compatibilità delle vecchie missioni e assenza di download quando non è stato generato alcun prototipo.
- Prototipi salvati di richiesta soggiorno, accoglienza bilingue e contatti: documento identico al generato, date coerenti, validazione email, risultato locale, traduzione IT/EN e assenza di overflow a 320 e 1440 pixel. Le richieste dei moduli non avviano operazioni di rete; la richiesta automatica del browser a `/favicon.ico` è estranea al modulo.
- 20 controlli sull’interfaccia con fixture: selezione massima di quattro aziende, ricerca senza perdita della selezione, due richieste effettivamente simultanee, errore per una sola azienda, retry della sola azienda fallita, nessuna sostituzione dell’azienda selezionata da risultati di altre aziende, archivio, tre demo distinte, anteprima nel frame limitato, moduli, Esc e restituzione del focus.
- Anteprime e chiusura delle schede controllate su desktop, telefono 390×844 e schermo basso 844×390. Esc dentro la demo viene trasmesso solo alla finestra contenitore; questa accetta il messaggio esclusivamente dal proprio frame.

Le 12 verifiche precedenti su caricamento iniziale dell’archivio, errori 401/503/rete, risposte non valide, retry e ritorno alla città sono state ripetute con esito positivo. TypeScript ed ESLint completati senza errori.

L’identità locale del modello Sites è condivisa dalle sessioni legittime; le verifiche di isolamento usano righe reversibili di un proprietario distinto, senza modificare header o cookie di autenticazione. Tutte le righe di prova vengono eliminate.

Le verifiche automatiche di ciascun HTML sono controlli strutturali di base. Non dimostrano che il servizio manchi in tutta l’azienda, che il prodotto sia operativo o che generi ricavi. Il lavoro nella coda richiede di mantenere aperta la pagina; i risultati già salvati restano nel database.
