import type {Report} from './audit';

export type CommercialDraft={subject:string;body:string;sender:string;recipient:null;status:'draft';needsConfirmation:string[]};
export function commercialDraft(report:Report,sender=''):CommercialDraft{
 const name=report.business.name.replace(/[\r\n]/g,' ').slice(0,180);
 const idea=report.prototypes?.length?report.prototypes.map(p=>p.title).join('; '):report.proposal.title.replace(/^Demo (di )?/,'');
 const observation=report.fetched
  ? `Ho consultato le informazioni pubbliche e la pagina iniziale del vostro sito. ${report.proposal.trigger||report.proposal.description} Questa osservazione non dimostra che il servizio manchi: potrebbe essere presente altrove.`
  : 'Ho trovato la vostra attività nelle fonti pubbliche. Non ho informazioni sufficienti per individuare una necessità: vorrei prima capire se questa idea può esservi utile.';
 const body=`Buongiorno,\n\nvi scrivo per ${name}. Ho preparato ${report.prototypes&&report.prototypes.length>1?'alcuni esempi':'un piccolo esempio'} da valutare: ${idea}.\n\n${observation}\n\nGli esempi sono demo HTML locali: mostrano un possibile funzionamento, senza inviare o salvare le richieste. Non sono ancora prodotti operativi.\n\nSe l’idea vi interessa, possiamo verificare insieme il bisogno e concordare funzioni, integrazioni, tempi e prezzo di uno sviluppo.\n\nVi andrebbe un breve confronto?\n\nGrazie,\n${sender||'[Nome e recapito da completare]'}\n\nFonte dell’attività: ${report.business.sourceUrl}`;
 return {subject:`Una demo da valutare per ${name}`,body,sender,recipient:null,status:'draft',needsConfirmation:['Bisogno confermato dal titolare','Indirizzo del destinatario verificato','Prodotto operativo e verifiche funzionali','Funzioni, prezzo e condizioni concordati']};
}
export function commercialText(report:Report,sender=''){
 const draft=commercialDraft(report,sender);
 return `PROPOSTA PRELIMINARE — BARI AGENT CITY\n\nAttività: ${report.business.name}\nIdea: ${report.proposal.title}\nVerifica: ${report.checkedAt}\nFonte: ${report.business.sourceUrl}\n\nOsservazione:\n${report.proposal.trigger||report.proposal.description}\n\nDisponibile: demo HTML locale. Le richieste di prova non vengono inviate o salvate.\nStato: bozza, nessuna email inviata.\n\nDA CONCORDARE\n${draft.needsConfirmation.map(s=>'- '+s).join('\n')}\n\nEMAIL\nMittente previsto: ${draft.sender||'da configurare'}\nDestinatario: da verificare\nOggetto: ${draft.subject}\n\n${draft.body}\n`;
}
