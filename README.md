# Bari Agent City

Città 3D navigabile di Bari con catalogo di attività reali, quattro ruoli di agente, analisi preliminari delle fonti pubbliche e laboratorio per creare demo e proposte commerciali.

## Avvio sul tuo computer

Installa Node.js 24. Scarica il progetto, estrailo e apri un terminale nella cartella che contiene `package.json`, poi esegui:

```sh
npm run install:ci
npm run dev
```

Apri http://127.0.0.1:5173. Trascina per spostare la camera, usa il tasto destro per ruotarla e la rotella per lo zoom. «Squadra» avvicina la camera agli agenti; «Vista strada» abilita mouse e WASD/frecce. Nella sezione Aziende seleziona fino a quattro attività, scegli 1, 2 o 4 aziende in parallelo e premi «Attiva agenti». Analisi, prototipi e verifica partono insieme; apri le anteprime e scarica i singoli HTML dalle missioni salvate.

Per il laboratorio locale visita `/signin-with-chatgpt?return_to=/`: l’identità di prova è condivisa da tutte le sessioni locali e non sostituisce l’autenticazione di produzione. Per creare l’archivio locale, dopo il primo build:

```sh
npm run build
npx wrangler d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_lovely_living_lightning.sql
```

Il file `.env.example` mostra la variabile facoltativa del mittente. Le password e i file `.env` non fanno parte del repository. La pubblicazione attuale è gestita da Sites e resta privata; il manifest `.openai/hosting.json` collega questo progetto alla sua pubblicazione esistente. Un clone non viene pubblicato automaticamente. Per un nuovo hosting servono un proprio database D1 e un’autenticazione verificata sul server.

## Verifiche

```sh
npm test
npm run typecheck
npm run lint
npm run build
```

I test usano fixture locali per analisi, prototipi, coda, geometria e percorsi. GitHub Actions esegue test, TypeScript, lint e build su Node 24. Le verifiche browser sono descritte in `docs/verification-v7.md` e `docs/verification-v8.md`.

## Prototipi automatici della versione 8

Un sito non indicato nella fonte genera un sito vetrina da valutare, senza affermare che il sito aziendale sia assente. Una pagina iniziale accessibile può generare più prototipi: richiesta soggiorno/tavolo/preventivo, accoglienza italiano/inglese e informazioni/contatti. Gli indizi «da confermare» non generano carenze inventate. Se tutte le funzioni sono presenti, o il sito non è accessibile, viene salvata un’analisi senza prototipi.

Il generatore usa regole e modelli HTML specifici; non è un servizio di agenti LLM. Le demo non inventano recapiti, prezzi, fotografie, servizi o recensioni. Le richieste sono locali, senza trasmissione o salvataggio. Ogni documento HTML viene conservato nel rapporto della missione; l’archivio restituisce soltanto i descrittori, mentre download e anteprima verificano il proprietario. Gli HTML sono piccoli documenti testuali, senza asset caricati separatamente o nuove migrazioni.

La coda lavora nella pagina aperta, con massimo quattro nuove analisi al minuto e fino a quattro aziende in parallelo. Un errore lascia disponibili i risultati delle altre aziende e consente di riprovare solo quelle fallite. I risultati già salvati persistono nel database. Le vecchie missioni in revisione mantengono il flusso di approvazione e i vecchi download. I bisogni, il prodotto operativo e l’offerta commerciale richiedono ancora verifica prima della vendita; nessuna email viene inviata.

## Correzioni e grafica della versione 7

Materiale di intonaco originale, facciate con dettagli o texture in base alla distanza, correzione delle normali di pareti e tetti e maggiore dettaglio nella vista strada. Gli avatar hanno proporzioni fisse e la visuale della squadra è più vicina; i segnaposto colorati appaiono sulla mappa. La chiusura delle schede resta accessibile sugli schermi bassi e le finestre restituiscono il focus al pulsante usato.

Le analisi parziali mantengono l’incertezza sulle funzioni non individuate. Commenti e script non vengono usati come prova di un servizio. Il limite delle quattro nuove missioni al minuto è atomico anche con richieste simultanee; il backend rifiuta richieste malformate e protegge l’archivio per proprietario. La demo bilingue traduce tutti i testi visibili.

Owner-private navigable prototype of Bari. Three.js camera pan/orbit/zoom, searchable real public business records, source-linked preliminary public audits, automatic targeted local HTML prototypes and D1 mission history. Legacy review missions retain owner approval.

Data snapshot 2026-10-07: 3,123 deduplicated named OSM commercial candidates (not a census), 886 ARET hospitality registrations and 3,770 ARET tourist rentals. Source catalogs remain separate and can overlap. Missing/suspicious shared coordinates are omitted from positioning. No Airbnb affiliation inferred.

OpenStreetMap data and derived database: © OpenStreetMap contributors, ODbL 1.0, https://www.openstreetmap.org/copyright . ARET Pugliapromozione / Regione Puglia records: CC BY 4.0, https://dati.puglia.it/v2/dataset/puglia-elenco-delle-strutture-ricettive-e-delle-locazioni-turistiche-progressivo . Source URLs and timestamps travel with records. Public exports available at /data/businesses.json and /data/geography.json. Application source is separate from these licensed datasets.

Agent avatars are prototype workflow roles. Public-page keyword rules provide limited evidence, not comprehensive AI analysis or confirmed company needs. Website scans are allowlisted to catalog URLs with public URL validation, bounded redirects, size/time limits, and four user-triggered missions per minute. No messages are sent to businesses. Demos do not transmit form data or represent finished products. QA checks are basic structural checks. No guaranteed revenue.

Run npm run dev. Optional local ChatGPT identity at /signin-with-chatgpt?return_to=/. D1 binding DB; apply generated drizzle migration locally per starter workflow after build. Production auth and private access are platform-owned. Missions are scoped by stable authenticated user ID.

## Realistic city graphics (version 2)

The central architectural layer uses 8,788 OSM footprint polygons including recorded courtyard holes; tiny/degenerate polygons are omitted by rendering. Coastline and street layouts use the public geographic snapshot. Most OSM footprints lack height data, so missing heights and all facade/window/balcony details are visual reconstructions. Buildings outside the detailed central survey are indicative volumes located at published business coordinates. Do not treat reconstructed visuals as an architectural survey.

Materials include an original generated limestone texture and the Three.js water-normal texture (MIT, source https://github.com/mrdoob/three.js/blob/dev/examples/textures/waternormals.jpg ; license at public/textures/THREE-LICENSE.txt). PBR rendering, bounded shadow maps, instanced street objects, merged architecture, and facade LOD retain mouse navigation and existing business workflows.

## Streets, exploration and proposals (version 3)

A second OSM snapshot adds 2,125 local ways in the central core (source timestamp 2026-10-07T13:47:51Z, fetched 13:49:26Z), with provenance in public/data/local-streets.json. Underground/covered/indoor/area ways and crossings are excluded from the rendered surface layer. Reconstructed doors, shutters, awnings, landmark geometry, benches and lamps are not a surveyed model. Street view starts on the reconstructed pavement beside the published Lungomare coastline; WASD moves the camera with the basic collision checks described in version 6. Day/sunset/night update sunlight, sea and a subset of window/lamp emission. Shared instanced geometry animates a limited crowd and traffic along public ways. Agent avatars follow road routes where connected and remain role visualizations.

Completed missions derive an email draft and downloadable commercial brief from the existing report. Missing homepage evidence is never described as a confirmed company need. QA must pass before a new mission is completed. SALES_SENDER_EMAIL configures the intended sender through Sites runtime; it is not an email credential. Recipient verification, operational product development, pricing and a sending integration are still required. No email is sent, and a Gmail plugin in chat does not create an unattended Site mail service.

## Map-inspired graphics (version 4)

The map control uses the existing OSM geometry in a north-oriented overhead view, with neutral buildings, white local roads, pale-gold arterial roads and blue water. It does not use Google Maps tiles, Street View imagery or photogrammetry. The compass returns the camera to north; the scale samples ground-plane rays and uses the scene scale of approximately 25 meters per world unit.

Shared, bounded miter joins replace independent road and pavement segments; endpoint caps close road junctions. The promenade follows contiguous original coastline segments, with its inland side determined from the source's northwest-to-southeast order. Continuous seawalls and pavement support the reconstructed furniture. Street mode starts on the coastal pavement and looks along the shore. The facade palette is more varied and less uniformly beige. Day/sunset/night, business search and owner-controlled mission workflows are retained.

## Coastal game redesign (version 5)

The default camera now frames a compact Bari Vecchia / Ferrarese waterfront district with the virtual command pavilion in the foreground. The full public business catalogs, geometry, map/street views and owner-controlled workflows are retained. Nearby buildings use several plaster/stone families, varied reconstructed roofs, shutters and projecting balconies; distant buildings are simpler. The default view exposes people and traffic rather than hiding them behind an aerial LOD threshold. Landmark footprint blocks are omitted beneath the custom reconstructions. The relocated command pavilion is fictional, and agent avatars visualize workflow roles; version 7 replaces enlarged avatars with fixed human proportions. Reconstructed seafront planters include small trees.

The interface uses a restrained navy game HUD: collapsed business drawer, selected-business panel, four-agent dock, and a squad camera. Materials, camera composition, detailed geometry budget and shadow framing were changed together. Facade details are concentrated within about475m of the hero center, with a bounded32k window budget and8-world-unit spatial tiles; they do not constitute surveyed architecture. Animation is capped at30fps. The separately generated concept preview is a design illustration with invented interface figures, not a screenshot, revenue report or promised fidelity of the running application.

Facade materials also use bounded procedural stucco and window textures for less detailed buildings. These are illustrative material patterns, not photographs or measured window arrangements. The command pavilion footprint is checked against the source coastline's land side. Tight sunlight depth bounds and a small depth bias retain contact shadows in the foreground district.

## Navigation and reliability fixes (version 6)

Company and mission drawers now share one visible panel, retaining the selected company when switching views. Header navigation exits the immersive view. Short-screen drawers scroll as a whole so analysis, approval, downloads and proposals remain reachable. Mission history distinguishes loading, authentication, network/storage failure and an empty archive, with recovery controls. Failed or incomplete approval returns to review instead of displaying development as active. Sources uses the existing accessible dialog with keyboard dismissal and explicit focus restoration; commercial dialogs also restore focus.

Architecture generation yields between bounded work slices and mesh batches, with cancellation on teardown. Loading and geometry/WebGL failures are visible with a scene retry that preserves company/mission state. Spatial controls wait for resolved geography. Manual camera gestures cancel scripted flights. Street mode uses fixed eye height and mouse look, with basic ground movement checks against published footprint polygons, courtyards, the coast and reconstructed furniture; the initial coastal spawn is kept clear of nearby reconstructed furniture. This replaces the earlier unrestricted ground camera, but remains an approximate navigation model rather than full physical collision. Company-bound agent animation ends at a nearby road node rather than inside the company footprint. Picking checks intervening architectural geometry, animated shadows refresh at a bounded rate, and generated label/material resources are released on scene teardown.
