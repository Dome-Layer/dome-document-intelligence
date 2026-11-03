import type { Catalogue } from '@dome-layer/dome-ui'

/**
 * Document Intelligence's own words in the four site languages (roadmap row 6, design note
 * dome-docs/sprints/SPRINT_TL_TOOL_LANGUAGES.md). English is the source type, so a key missing
 * from another language fails the type check. The register follows domelayer.com: Sie in German,
 * u in Dutch, voi in Italian, with the short imperative on Italian buttons.
 *
 * The model writes no prose here: field keys, extracted values and section names arrive as the
 * document has them and are never translated. Document types, industries, data types and the
 * sixteen governance rules are canonical English ids, labelled below; a flag's message is worded
 * from the values the backend sends with it (`params`), so the English `message` stays the record.
 */

/** The governance rules the backend evaluates (backend/app/services/validation.py). */
export type RuleId =
  | 'low_confidence_field'
  | 'very_low_confidence_field'
  | 'missing_critical_value'
  | 'currency_mismatch'
  | 'future_date_anomaly'
  | 'past_date_anomaly'
  | 'overall_low_confidence'
  | 'no_identifiers_found'
  | 'unsupported_language'
  | 'amount_zero'
  | 'short_extraction'
  | 'missing_date'
  | 'expired_due_date'
  | 'large_monetary_amount'
  | 'potential_personal_data'
  | 'duplicate_field_name'

/** Numbers, lists and language names in the visitor's language. */
export interface Fmt {
  pct: (value: number) => string
  num: (value: number) => string
  list: (items: string[]) => string
  language: (code: string) => string
}

/** A flag's values (backend FlagParam), every key present once lib/labels.ts has checked them. */
export interface FlagParams {
  field: string
  confidence: number
  threshold: number
  value: string
  days: number
  years: number
  currencies: string[]
  language: string
  count: number
  min_fields: number
  fields: string[]
  first: string
  second: string
}

/** A rule's settings, with the backend's defaults filled in. */
export interface RuleConfig {
  threshold: number
  days_ahead: number
  years_back: number
  min_fields: number
}

export interface RuleText {
  name: string
  description: (c: RuleConfig, f: Fmt) => string
  message: (p: FlagParams, f: Fmt) => string
}

const q = (name: string) => `'${name}'`

/** The first five names, quoted, and how many more there are. */
function firstFive(fields: string[]): { names: string; more: number } {
  return { names: fields.slice(0, 5).map(q).join(', '), more: Math.max(0, fields.length - 5) }
}

const rulesEn: Record<RuleId, RuleText> = {
  low_confidence_field: {
    name: 'Low confidence field',
    description: (c, f) => `Any extracted field with confidence below ${f.pct(c.threshold)}`,
    message: (p, f) => `Field ${q(p.field)} has confidence ${f.pct(p.confidence)} (below ${f.pct(p.threshold)})`,
  },
  very_low_confidence_field: {
    name: 'Very low confidence',
    description: (c, f) => `Any extracted field with confidence below ${f.pct(c.threshold)}`,
    message: (p, f) =>
      `Field ${q(p.field)} has very low confidence ${f.pct(p.confidence)} (below ${f.pct(p.threshold)}). Manual verification required`,
  },
  missing_critical_value: {
    name: 'Missing critical value',
    description: () => 'A field the model marked as critical has no value',
    message: (p) => `Critical field ${q(p.field)} has no value`,
  },
  currency_mismatch: {
    name: 'Currency mismatch',
    description: () => 'Multiple currencies detected without explicit FX conversion',
    message: (p, f) => `Multiple currencies detected: ${f.list(p.currencies)}. Verify FX conversion`,
  },
  future_date_anomaly: {
    name: 'Future date anomaly',
    description: (c, f) => `A date field is more than ${f.num(c.days_ahead)} days in the future`,
    message: (p, f) => `Field ${q(p.field)} has a date more than ${f.num(p.days)} days in the future: ${p.value}`,
  },
  past_date_anomaly: {
    name: 'Past date anomaly',
    description: (c, f) => `A date field is more than ${f.num(c.years_back)} years in the past`,
    message: (p, f) => `Field ${q(p.field)} has a date more than ${f.num(p.years)} years in the past: ${p.value}`,
  },
  overall_low_confidence: {
    name: 'Low overall confidence',
    description: (c, f) => `Overall extraction confidence below ${f.pct(c.threshold)}: recommend manual review`,
    message: (p, f) =>
      `Overall extraction confidence ${f.pct(p.confidence)} is below ${f.pct(p.threshold)}. Manual review recommended`,
  },
  no_identifiers_found: {
    name: 'No identifiers found',
    description: () => 'No reference keys detected (no PO, invoice or contract ID)',
    message: () => 'No reference identifiers detected (no invoice number, PO, contract ID, etc.)',
  },
  unsupported_language: {
    name: 'Non-Latin script',
    description: () => 'Document contains non-Latin characters, so extraction may be partial',
    message: (p, f) =>
      p.language
        ? `Document language (${f.language(p.language)}) may use a non-Latin script, so extraction may be partial`
        : `Non-Latin characters detected in field ${q(p.field)}; extraction accuracy may be reduced`,
  },
  amount_zero: {
    name: 'Zero amount detected',
    description: () => 'A currency field extracted as zero or empty',
    message: (p) => `Currency field ${q(p.field)} has a zero or empty value`,
  },
  short_extraction: {
    name: 'Very few fields extracted',
    description: (c, f) =>
      `Fewer than ${f.num(c.min_fields)} fields extracted, likely a scan quality issue or blank page`,
    message: (p, f) =>
      `Only ${f.num(p.count)} ${p.count === 1 ? 'field' : 'fields'} extracted (minimum ${f.num(p.min_fields)}). Check scan quality or document format`,
  },
  missing_date: {
    name: 'No date field found',
    description: () => 'No date-type field extracted; undated documents may be invalid',
    message: () => 'No date field found. Verify the document is dated',
  },
  expired_due_date: {
    name: 'Expired due date',
    description: () => 'A due date, expiry date or payment deadline is in the past',
    message: (p) => `Field ${q(p.field)} is a past due or expiry date: ${p.value}`,
  },
  large_monetary_amount: {
    name: 'Large monetary amount',
    description: (c, f) => `A currency field exceeds ${f.num(c.threshold)}: recommend escalation`,
    message: (p, f) =>
      `Field ${q(p.field)} contains a large amount (${p.value}) exceeding ${f.num(p.threshold)}. Recommend escalation`,
  },
  potential_personal_data: {
    name: 'Personal data detected',
    description: () => 'Fields containing personal data (names, IDs, addresses): handle per GDPR and HIPAA',
    message: (p) => {
      const { names, more } = firstFive(p.fields)
      return `Personal data fields detected: ${names}${more ? ` and ${more} more` : ''}. Ensure GDPR and HIPAA compliance`
    },
  },
  duplicate_field_name: {
    name: 'Duplicate field name',
    description: () => 'The same field name was extracted twice with different values',
    message: (p) =>
      `Field ${q(p.field)} extracted twice with different values: ${q(p.first)} and ${q(p.second)}`,
  },
}

const en = {
  nav: { upload: 'Upload', history: 'History', rules: 'Rules', audit: 'Audit log' },
  errors: {
    status: (status: number, message: string) => `Error ${status}: ${message}`,
    unexpected: 'An unexpected error occurred',
  },
  upload: {
    lead: 'Upload any document: invoices, lab reports, utility bills, contracts. Extract structured data with governance validation in seconds.',
    steps: {
      detecting: 'Detecting document type…',
      extracting: 'Extracting fields…',
      validating: 'Applying governance rules…',
    },
    tryAgain: 'Try again',
    drop: 'Drop your document here',
    dropping: 'Drop it here',
    limits: 'Up to 20 MB · Scanned documents auto-optimised · Never stored',
    browse: 'Browse files',
    camera: 'Capture with camera',
    capture: 'Capture photo',
    cancel: 'Cancel',
    unsupported: 'Unsupported file type. Accepted formats: PDF, JPG, PNG, XLSX.',
    tooLarge: 'File too large. Maximum size is 20 MB.',
    cameraDenied: 'Camera access denied or not available.',
    captureFailed: 'Failed to capture photo.',
  },
  result: {
    failedSaved: 'Failed to load saved extraction.',
    expired: 'Result has expired. Please upload again.',
    failedLoad: 'Failed to load result.',
    noResult: 'No result found. Please upload a document first.',
    backToUpload: 'Back to upload',
    backToHistory: 'Back to history',
    newDocument: 'New document',
    viewInHistory: 'View in history',
    processedIn: (seconds: string) => `Processed in ${seconds}s`,
    save: 'Save',
    saving: 'Saving…',
    saved: 'Saved',
    saveFailed: 'Failed to save. Please try again.',
    savedOn: (date: string) => `Saved on ${date}`,
    referenceKeys: 'Reference keys',
    extractedFields: 'Extracted fields',
    governanceFlags: 'Governance flags',
  },
  review: {
    requiredTitle: 'Human review required',
    recommendedTitle: 'Human review recommended',
    requiredBody:
      'One or more critical governance rules were triggered. This extraction must be reviewed by a human before use.',
    recommendedBody:
      'One or more warnings were raised. Review this extraction before relying on it for decisions.',
    /** The short form in the history table. */
    short: { not_required: 'Passed', recommended: 'Review', required: 'Required' },
    /** The audit log's column. */
    status: { not_required: 'Not required', recommended: 'Recommended', required: 'Required' },
  },
  profile: {
    eyebrow: 'Document profile',
    type: 'Type',
    industry: 'Industry',
    language: 'Language',
    currency: 'Currency',
    sections: 'Sections detected',
  },
  docTypes: {
    invoice: 'Invoice',
    purchase_order: 'Purchase order',
    utility_bill: 'Utility bill',
    trade_confirmation: 'Trade confirmation',
    letter_of_credit: 'Letter of credit',
    contract: 'Contract',
    commodity_report: 'Commodity report',
    lab_report: 'Lab report',
    medical_record: 'Medical record',
    clinical_form: 'Clinical form',
    prescription: 'Prescription',
    bank_statement: 'Bank statement',
    tax_form: 'Tax form',
    cv_resume: 'CV / Résumé',
    other: 'Other',
  } as Record<string, string>,
  industries: {
    healthcare: 'Healthcare',
    medical: 'Medical',
    utilities: 'Utilities',
    financial_services: 'Financial services',
    banking: 'Banking',
    insurance: 'Insurance',
    legal: 'Legal',
    hr: 'HR',
    procurement: 'Procurement',
    logistics: 'Logistics',
    commodity_finance: 'Commodity finance',
    real_estate: 'Real estate',
    education: 'Education',
    government: 'Government',
    retail: 'Retail',
    technology: 'Technology',
    other: 'Other',
  } as Record<string, string>,
  dataTypes: {
    currency: 'Currency',
    date: 'Date',
    text: 'Text',
    identifier: 'Identifier',
    percentage: 'Percentage',
  } as Record<string, string>,
  table: {
    field: 'Field',
    value: 'Value',
    section: 'Section',
    type: 'Type',
    confidence: 'Confidence',
    critical: 'Critical',
    criticalLegend: 'essential to document purpose',
    confidenceLegend: 'Confidence:',
    high: 'high ≥85%',
    moderate: 'moderate 60 to 84%',
    low: 'low <60%',
    empty: 'empty',
    none: 'N/A',
    noFields: 'No fields extracted.',
    exportCsv: 'Export CSV',
    exportTitle: 'Export to CSV (opens in Excel)',
    csvHeaders: ['Field', 'Value', 'Section', 'Type', 'Confidence', 'Critical'],
    yes: 'Yes',
    no: 'No',
  },
  flags: {
    none: 'No governance issues detected',
    severity: { error: 'error', warning: 'warning', info: 'info' },
    legend: {
      error: 'manual review required',
      warning: 'attention recommended',
      info: 'informational',
    },
  },
  rules: rulesEn,
  rulesPage: {
    title: 'Governance rules',
    lead: 'Enable or disable rules applied during extraction. Changes take effect on the next document.',
    failed: 'Failed to load rules',
    none: 'No rules found.',
    updateFailed: 'Failed to update rule',
    enable: (name: string) => `Enable ${name}`,
    disable: (name: string) => `Disable ${name}`,
  },
  audit: {
    title: 'Audit log',
    lead: 'Governance events from all processed documents. Metadata only: no document content is stored.',
    failed: 'Failed to load audit log',
    empty: 'No audit events yet. Process a document to generate an event.',
    columns: {
      timestamp: 'Timestamp',
      docType: 'Document type',
      fields: 'Fields',
      flags: 'Flags triggered',
      confidence: 'Confidence',
      review: 'Review',
    },
    flagCount: (n: number) => (n === 1 ? '1 flag' : `${n} flags`),
    noFlags: 'None',
    none: 'N/A',
    summary: (total: number, page: number, pages: number) =>
      `${total} ${total === 1 ? 'event' : 'events'} · Page ${page} of ${pages}`,
    previous: 'Previous page',
    next: 'Next page',
  },
  history: {
    title: 'History',
    lead: 'Saved extractions. Click any row to reopen the full result.',
    search: 'Search by filename…',
    clearSearch: 'Clear search',
    allTypes: 'All types',
    count: (n: number) => (n === 1 ? '1 document' : `${n} documents`),
    failed: 'Failed to load history',
    pageOf: (page: number, pages: number) => `Page ${page} of ${pages}`,
    previous: 'Previous',
    next: 'Next',
    empty: 'No saved documents yet.',
    uploadCta: 'Upload a document',
    confirmDelete: 'Delete this saved extraction?',
    deleteFailed: 'Delete failed',
    columns: {
      document: 'Document',
      type: 'Type',
      industry: 'Industry',
      confidence: 'Confidence',
      review: 'Review',
      saved: 'Saved',
    },
    cameraCapture: 'camera capture',
    none: 'N/A',
    view: 'View',
    delete: 'Delete',
  },
  globalError: { title: 'Something went wrong', retry: 'Try again' },
}

export type Messages = typeof en

export const MESSAGES: Catalogue<Messages> = {
  en,
  it: {
    nav: { upload: 'Carica', history: 'Cronologia', rules: 'Regole', audit: 'Registro di audit' },
    errors: {
      status: (status, message) => `Errore ${status}: ${message}`,
      unexpected: 'Si è verificato un errore imprevisto',
    },
    upload: {
      lead: 'Caricate qualsiasi documento: fatture, referti di laboratorio, bollette, contratti. Estraete dati strutturati, validati dalle regole di governance, in pochi secondi.',
      steps: {
        detecting: 'Riconoscimento del tipo di documento…',
        extracting: 'Estrazione dei campi…',
        validating: 'Applicazione delle regole di governance…',
      },
      tryAgain: 'Riprova',
      drop: 'Trascinate qui il documento',
      dropping: 'Rilasciatelo qui',
      limits: 'Fino a 20 MB · Scansioni ottimizzate in automatico · Mai conservati',
      browse: 'Sfoglia i file',
      camera: 'Scatta con la fotocamera',
      capture: 'Scatta la foto',
      cancel: 'Annulla',
      unsupported: 'Tipo di file non supportato. Formati accettati: PDF, JPG, PNG, XLSX.',
      tooLarge: 'File troppo grande. La dimensione massima è 20 MB.',
      cameraDenied: 'Accesso alla fotocamera negato o fotocamera non disponibile.',
      captureFailed: 'Impossibile scattare la foto.',
    },
    result: {
      failedSaved: "Impossibile caricare l'estrazione salvata.",
      expired: 'Il risultato è scaduto. Caricate di nuovo il documento.',
      failedLoad: 'Impossibile caricare il risultato.',
      noResult: 'Nessun risultato. Caricate prima un documento.',
      backToUpload: 'Torna al caricamento',
      backToHistory: 'Torna alla cronologia',
      newDocument: 'Nuovo documento',
      viewInHistory: 'Vedi nella cronologia',
      processedIn: (seconds) => `Elaborato in ${seconds} s`,
      save: 'Salva',
      saving: 'Salvataggio…',
      saved: 'Salvato',
      saveFailed: 'Salvataggio non riuscito. Riprovate.',
      savedOn: (date) => `Salvato il ${date}`,
      referenceKeys: 'Chiavi di riferimento',
      extractedFields: 'Campi estratti',
      governanceFlags: 'Segnalazioni di governance',
    },
    review: {
      requiredTitle: 'Revisione umana obbligatoria',
      recommendedTitle: 'Revisione umana consigliata',
      requiredBody:
        "Sono scattate una o più regole di governance critiche. Questa estrazione deve essere rivista da una persona prima dell'uso.",
      recommendedBody:
        'Sono stati segnalati uno o più avvisi. Rivedete questa estrazione prima di usarla per prendere decisioni.',
      short: { not_required: 'Superata', recommended: 'Da rivedere', required: 'Obbligatoria' },
      status: { not_required: 'Non necessaria', recommended: 'Consigliata', required: 'Obbligatoria' },
    },
    profile: {
      eyebrow: 'Profilo del documento',
      type: 'Tipo',
      industry: 'Settore',
      language: 'Lingua',
      currency: 'Valuta',
      sections: 'Sezioni rilevate',
    },
    docTypes: {
      invoice: 'Fattura',
      purchase_order: "Ordine d'acquisto",
      utility_bill: 'Bolletta',
      trade_confirmation: 'Conferma di negoziazione',
      letter_of_credit: 'Lettera di credito',
      contract: 'Contratto',
      commodity_report: 'Report sulle materie prime',
      lab_report: 'Referto di laboratorio',
      medical_record: 'Cartella clinica',
      clinical_form: 'Modulo clinico',
      prescription: 'Ricetta medica',
      bank_statement: 'Estratto conto',
      tax_form: 'Modulo fiscale',
      cv_resume: 'Curriculum vitae',
      other: 'Altro',
    },
    industries: {
      healthcare: 'Sanità',
      medical: 'Medicina',
      utilities: 'Servizi di pubblica utilità',
      financial_services: 'Servizi finanziari',
      banking: 'Banche',
      insurance: 'Assicurazioni',
      legal: 'Legale',
      hr: 'Risorse umane',
      procurement: 'Acquisti',
      logistics: 'Logistica',
      commodity_finance: 'Finanza delle materie prime',
      real_estate: 'Immobiliare',
      education: 'Istruzione',
      government: 'Pubblica amministrazione',
      retail: 'Commercio al dettaglio',
      technology: 'Tecnologia',
      other: 'Altro',
    },
    dataTypes: {
      currency: 'Valuta',
      date: 'Data',
      text: 'Testo',
      identifier: 'Identificativo',
      percentage: 'Percentuale',
    },
    table: {
      field: 'Campo',
      value: 'Valore',
      section: 'Sezione',
      type: 'Tipo',
      confidence: 'Affidabilità',
      critical: 'Critico',
      criticalLegend: 'essenziale per lo scopo del documento',
      confidenceLegend: 'Affidabilità:',
      high: 'alta ≥85%',
      moderate: "media dal 60 all'84%",
      low: 'bassa <60%',
      empty: 'vuoto',
      none: 'N/D',
      noFields: 'Nessun campo estratto.',
      exportCsv: 'Esporta CSV',
      exportTitle: 'Esporta in CSV (si apre in Excel)',
      csvHeaders: ['Campo', 'Valore', 'Sezione', 'Tipo', 'Affidabilità', 'Critico'],
      yes: 'Sì',
      no: 'No',
    },
    flags: {
      none: 'Nessun problema di governance rilevato',
      severity: { error: 'errore', warning: 'avviso', info: 'info' },
      legend: {
        error: 'revisione manuale obbligatoria',
        warning: 'attenzione consigliata',
        info: 'a titolo informativo',
      },
    },
    rules: {
      low_confidence_field: {
        name: 'Campo con bassa affidabilità',
        description: (c, f) => `Qualsiasi campo estratto con affidabilità inferiore al ${f.pct(c.threshold)}`,
        message: (p, f) =>
          `Il campo ${q(p.field)} ha un'affidabilità del ${f.pct(p.confidence)} (sotto il ${f.pct(p.threshold)})`,
      },
      very_low_confidence_field: {
        name: 'Affidabilità molto bassa',
        description: (c, f) => `Qualsiasi campo estratto con affidabilità inferiore al ${f.pct(c.threshold)}`,
        message: (p, f) =>
          `Il campo ${q(p.field)} ha un'affidabilità molto bassa, del ${f.pct(p.confidence)} (sotto il ${f.pct(p.threshold)}). Serve una verifica manuale`,
      },
      missing_critical_value: {
        name: 'Valore critico mancante',
        description: () => 'Un campo che il modello ha indicato come critico non ha valore',
        message: (p) => `Il campo critico ${q(p.field)} non ha valore`,
      },
      currency_mismatch: {
        name: 'Valute diverse',
        description: () => 'Più valute rilevate senza una conversione esplicita',
        message: (p, f) => `Più valute rilevate: ${f.list(p.currencies)}. Verificate la conversione dei cambi`,
      },
      future_date_anomaly: {
        name: 'Data anomala nel futuro',
        description: (c, f) => `Una data è più di ${f.num(c.days_ahead)} giorni nel futuro`,
        message: (p, f) =>
          `Il campo ${q(p.field)} ha una data più di ${f.num(p.days)} giorni nel futuro: ${p.value}`,
      },
      past_date_anomaly: {
        name: 'Data anomala nel passato',
        description: (c, f) => `Una data è più di ${f.num(c.years_back)} anni nel passato`,
        message: (p, f) =>
          `Il campo ${q(p.field)} ha una data più di ${f.num(p.years)} anni nel passato: ${p.value}`,
      },
      overall_low_confidence: {
        name: 'Affidabilità complessiva bassa',
        description: (c, f) =>
          `Affidabilità complessiva dell'estrazione inferiore al ${f.pct(c.threshold)}: si consiglia una revisione manuale`,
        message: (p, f) =>
          `L'affidabilità complessiva dell'estrazione è del ${f.pct(p.confidence)}, sotto il ${f.pct(p.threshold)}. Si consiglia una revisione manuale`,
      },
      no_identifiers_found: {
        name: 'Nessun identificativo trovato',
        description: () => "Nessuna chiave di riferimento rilevata (nessun ordine d'acquisto, fattura o ID contratto)",
        message: () =>
          "Nessun identificativo di riferimento rilevato (numero di fattura, ordine d'acquisto, ID contratto e simili)",
      },
      unsupported_language: {
        name: 'Alfabeto non latino',
        description: () => "Il documento contiene caratteri non latini, quindi l'estrazione può essere parziale",
        message: (p, f) =>
          p.language
            ? `La lingua del documento (${f.language(p.language)}) può usare un alfabeto non latino, quindi l'estrazione può essere parziale`
            : `Caratteri non latini nel campo ${q(p.field)}: l'estrazione può essere meno precisa`,
      },
      amount_zero: {
        name: 'Importo pari a zero',
        description: () => 'Un campo di valuta estratto come zero o vuoto',
        message: (p) => `Il campo di valuta ${q(p.field)} è zero o vuoto`,
      },
      short_extraction: {
        name: 'Pochissimi campi estratti',
        description: (c, f) =>
          `Meno di ${f.num(c.min_fields)} campi estratti: probabilmente una scansione di scarsa qualità o una pagina vuota`,
        message: (p, f) =>
          `Estratti solo ${f.num(p.count)} ${p.count === 1 ? 'campo' : 'campi'} (minimo ${f.num(p.min_fields)}). Controllate la qualità della scansione o il formato del documento`,
      },
      missing_date: {
        name: 'Nessuna data trovata',
        description: () => 'Nessun campo di tipo data estratto; un documento senza data può non essere valido',
        message: () => 'Nessuna data trovata. Verificate che il documento sia datato',
      },
      expired_due_date: {
        name: 'Scadenza superata',
        description: () => 'Una data di scadenza o un termine di pagamento è già passato',
        message: (p) => `Il campo ${q(p.field)} è una scadenza già passata: ${p.value}`,
      },
      large_monetary_amount: {
        name: 'Importo elevato',
        description: (c, f) => `Un campo di valuta supera ${f.num(c.threshold)}: si consiglia l'escalation`,
        message: (p, f) =>
          `Il campo ${q(p.field)} contiene un importo elevato (${p.value}) oltre ${f.num(p.threshold)}. Si consiglia l'escalation`,
      },
      potential_personal_data: {
        name: 'Dati personali rilevati',
        description: () => 'Campi con dati personali (nomi, identificativi, indirizzi): da trattare secondo GDPR e HIPAA',
        message: (p) => {
          const { names, more } = firstFive(p.fields)
          return `Campi con dati personali: ${names}${more ? ` e altri ${more}` : ''}. Assicurate la conformità a GDPR e HIPAA`
        },
      },
      duplicate_field_name: {
        name: 'Nome di campo duplicato',
        description: () => 'Lo stesso nome di campo è stato estratto due volte con valori diversi',
        message: (p) =>
          `Il campo ${q(p.field)} è stato estratto due volte con valori diversi: ${q(p.first)} e ${q(p.second)}`,
      },
    },
    rulesPage: {
      title: 'Regole di governance',
      lead: "Attivate o disattivate le regole applicate durante l'estrazione. Le modifiche valgono dal documento successivo.",
      failed: 'Impossibile caricare le regole',
      none: 'Nessuna regola trovata.',
      updateFailed: 'Impossibile aggiornare la regola',
      enable: (name) => `Attiva ${name}`,
      disable: (name) => `Disattiva ${name}`,
    },
    audit: {
      title: 'Registro di audit',
      lead: 'Eventi di governance di tutti i documenti elaborati. Solo metadati: nessun contenuto dei documenti viene conservato.',
      failed: 'Impossibile caricare il registro di audit',
      empty: 'Ancora nessun evento. Elaborate un documento per generarne uno.',
      columns: {
        timestamp: 'Data e ora',
        docType: 'Tipo di documento',
        fields: 'Campi',
        flags: 'Regole scattate',
        confidence: 'Affidabilità',
        review: 'Revisione',
      },
      flagCount: (n) => (n === 1 ? '1 segnalazione' : `${n} segnalazioni`),
      noFlags: 'Nessuna',
      none: 'N/D',
      summary: (total, page, pages) =>
        `${total} ${total === 1 ? 'evento' : 'eventi'} · Pagina ${page} di ${pages}`,
      previous: 'Pagina precedente',
      next: 'Pagina successiva',
    },
    history: {
      title: 'Cronologia',
      lead: 'Estrazioni salvate. Fate clic su una riga per riaprire il risultato completo.',
      search: 'Cerca per nome del file…',
      clearSearch: 'Cancella la ricerca',
      allTypes: 'Tutti i tipi',
      count: (n) => (n === 1 ? '1 documento' : `${n} documenti`),
      failed: 'Impossibile caricare la cronologia',
      pageOf: (page, pages) => `Pagina ${page} di ${pages}`,
      previous: 'Precedente',
      next: 'Successiva',
      empty: 'Ancora nessun documento salvato.',
      uploadCta: 'Carica un documento',
      confirmDelete: 'Eliminare questa estrazione salvata?',
      deleteFailed: 'Eliminazione non riuscita',
      columns: {
        document: 'Documento',
        type: 'Tipo',
        industry: 'Settore',
        confidence: 'Affidabilità',
        review: 'Revisione',
        saved: 'Salvato',
      },
      cameraCapture: 'foto dalla fotocamera',
      none: 'N/D',
      view: 'Apri',
      delete: 'Elimina',
    },
    globalError: { title: 'Si è verificato un problema', retry: 'Riprova' },
  },
  nl: {
    nav: { upload: 'Uploaden', history: 'Geschiedenis', rules: 'Regels', audit: 'Auditlog' },
    errors: {
      status: (status, message) => `Fout ${status}: ${message}`,
      unexpected: 'Er is een onverwachte fout opgetreden',
    },
    upload: {
      lead: 'Upload elk document: facturen, laboratoriumrapporten, energierekeningen, contracten. Haal er binnen enkele seconden gestructureerde gegevens uit, gecontroleerd met governance-regels.',
      steps: {
        detecting: 'Documenttype herkennen…',
        extracting: 'Velden extraheren…',
        validating: 'Governance-regels toepassen…',
      },
      tryAgain: 'Opnieuw proberen',
      drop: 'Sleep uw document hierheen',
      dropping: 'Laat het hier los',
      limits: 'Tot 20 MB · Scans automatisch geoptimaliseerd · Nooit opgeslagen',
      browse: 'Bestanden kiezen',
      camera: 'Vastleggen met de camera',
      capture: 'Foto maken',
      cancel: 'Annuleren',
      unsupported: 'Bestandstype niet ondersteund. Toegestane formaten: PDF, JPG, PNG, XLSX.',
      tooLarge: 'Bestand te groot. De maximale grootte is 20 MB.',
      cameraDenied: 'Geen toegang tot de camera, of er is geen camera beschikbaar.',
      captureFailed: 'De foto kon niet worden gemaakt.',
    },
    result: {
      failedSaved: 'De opgeslagen extractie kon niet worden geladen.',
      expired: 'Het resultaat is verlopen. Upload het document opnieuw.',
      failedLoad: 'Het resultaat kon niet worden geladen.',
      noResult: 'Geen resultaat gevonden. Upload eerst een document.',
      backToUpload: 'Terug naar uploaden',
      backToHistory: 'Terug naar de geschiedenis',
      newDocument: 'Nieuw document',
      viewInHistory: 'Bekijken in de geschiedenis',
      processedIn: (seconds) => `Verwerkt in ${seconds} s`,
      save: 'Opslaan',
      saving: 'Bezig met opslaan…',
      saved: 'Opgeslagen',
      saveFailed: 'Opslaan mislukt. Probeer het opnieuw.',
      savedOn: (date) => `Opgeslagen op ${date}`,
      referenceKeys: 'Referentiesleutels',
      extractedFields: 'Geëxtraheerde velden',
      governanceFlags: 'Governance-meldingen',
    },
    review: {
      requiredTitle: 'Menselijke beoordeling vereist',
      recommendedTitle: 'Menselijke beoordeling aanbevolen',
      requiredBody:
        'Een of meer kritieke governance-regels zijn geactiveerd. Een mens moet deze extractie beoordelen voordat u ze gebruikt.',
      recommendedBody:
        'Er zijn een of meer waarschuwingen. Beoordeel deze extractie voordat u er beslissingen op baseert.',
      short: { not_required: 'Geslaagd', recommended: 'Beoordelen', required: 'Vereist' },
      status: { not_required: 'Niet vereist', recommended: 'Aanbevolen', required: 'Vereist' },
    },
    profile: {
      eyebrow: 'Documentprofiel',
      type: 'Type',
      industry: 'Sector',
      language: 'Taal',
      currency: 'Valuta',
      sections: 'Gevonden secties',
    },
    docTypes: {
      invoice: 'Factuur',
      purchase_order: 'Inkooporder',
      utility_bill: 'Energierekening',
      trade_confirmation: 'Handelsbevestiging',
      letter_of_credit: 'Kredietbrief',
      contract: 'Contract',
      commodity_report: 'Grondstoffenrapport',
      lab_report: 'Laboratoriumrapport',
      medical_record: 'Medisch dossier',
      clinical_form: 'Klinisch formulier',
      prescription: 'Recept',
      bank_statement: 'Bankafschrift',
      tax_form: 'Belastingformulier',
      cv_resume: 'Cv',
      other: 'Overig',
    },
    industries: {
      healthcare: 'Zorg',
      medical: 'Medisch',
      utilities: 'Nutsvoorzieningen',
      financial_services: 'Financiële dienstverlening',
      banking: 'Bankwezen',
      insurance: 'Verzekeringen',
      legal: 'Juridisch',
      hr: 'HR',
      procurement: 'Inkoop',
      logistics: 'Logistiek',
      commodity_finance: 'Grondstoffenfinanciering',
      real_estate: 'Vastgoed',
      education: 'Onderwijs',
      government: 'Overheid',
      retail: 'Detailhandel',
      technology: 'Technologie',
      other: 'Overig',
    },
    dataTypes: {
      currency: 'Valuta',
      date: 'Datum',
      text: 'Tekst',
      identifier: 'Kenmerk',
      percentage: 'Percentage',
    },
    table: {
      field: 'Veld',
      value: 'Waarde',
      section: 'Sectie',
      type: 'Type',
      confidence: 'Betrouwbaarheid',
      critical: 'Kritiek',
      criticalLegend: 'essentieel voor het doel van het document',
      confidenceLegend: 'Betrouwbaarheid:',
      high: 'hoog ≥85%',
      moderate: 'gemiddeld 60 tot 84%',
      low: 'laag <60%',
      empty: 'leeg',
      none: 'n.v.t.',
      noFields: 'Geen velden geëxtraheerd.',
      exportCsv: 'CSV exporteren',
      exportTitle: 'Exporteren naar CSV (opent in Excel)',
      csvHeaders: ['Veld', 'Waarde', 'Sectie', 'Type', 'Betrouwbaarheid', 'Kritiek'],
      yes: 'Ja',
      no: 'Nee',
    },
    flags: {
      none: 'Geen governance-problemen gevonden',
      severity: { error: 'fout', warning: 'waarschuwing', info: 'info' },
      legend: {
        error: 'handmatige beoordeling vereist',
        warning: 'aandacht aanbevolen',
        info: 'ter informatie',
      },
    },
    rules: {
      low_confidence_field: {
        name: 'Veld met lage betrouwbaarheid',
        description: (c, f) => `Elk geëxtraheerd veld met een betrouwbaarheid onder ${f.pct(c.threshold)}`,
        message: (p, f) =>
          `Veld ${q(p.field)} heeft een betrouwbaarheid van ${f.pct(p.confidence)} (onder ${f.pct(p.threshold)})`,
      },
      very_low_confidence_field: {
        name: 'Zeer lage betrouwbaarheid',
        description: (c, f) => `Elk geëxtraheerd veld met een betrouwbaarheid onder ${f.pct(c.threshold)}`,
        message: (p, f) =>
          `Veld ${q(p.field)} heeft een zeer lage betrouwbaarheid van ${f.pct(p.confidence)} (onder ${f.pct(p.threshold)}). Handmatige controle vereist`,
      },
      missing_critical_value: {
        name: 'Kritieke waarde ontbreekt',
        description: () => 'Een veld dat het model als kritiek aanmerkt, heeft geen waarde',
        message: (p) => `Kritiek veld ${q(p.field)} heeft geen waarde`,
      },
      currency_mismatch: {
        name: 'Verschillende valuta',
        description: () => 'Meerdere valuta gevonden zonder expliciete omrekening',
        message: (p, f) => `Meerdere valuta gevonden: ${f.list(p.currencies)}. Controleer de omrekening`,
      },
      future_date_anomaly: {
        name: 'Datum ver in de toekomst',
        description: (c, f) => `Een datumveld ligt meer dan ${f.num(c.days_ahead)} dagen in de toekomst`,
        message: (p, f) =>
          `Veld ${q(p.field)} heeft een datum meer dan ${f.num(p.days)} dagen in de toekomst: ${p.value}`,
      },
      past_date_anomaly: {
        name: 'Datum ver in het verleden',
        description: (c, f) => `Een datumveld ligt meer dan ${f.num(c.years_back)} jaar in het verleden`,
        message: (p, f) =>
          `Veld ${q(p.field)} heeft een datum meer dan ${f.num(p.years)} jaar in het verleden: ${p.value}`,
      },
      overall_low_confidence: {
        name: 'Lage totale betrouwbaarheid',
        description: (c, f) =>
          `Totale betrouwbaarheid van de extractie onder ${f.pct(c.threshold)}: handmatige beoordeling aanbevolen`,
        message: (p, f) =>
          `De totale betrouwbaarheid van de extractie is ${f.pct(p.confidence)}, onder ${f.pct(p.threshold)}. Handmatige beoordeling aanbevolen`,
      },
      no_identifiers_found: {
        name: 'Geen kenmerken gevonden',
        description: () => 'Geen referentiesleutels gevonden (geen inkooporder, factuur of contract-ID)',
        message: () => 'Geen referentiekenmerken gevonden (geen factuurnummer, inkooporder, contract-ID en dergelijke)',
      },
      unsupported_language: {
        name: 'Niet-Latijns schrift',
        description: () => 'Het document bevat niet-Latijnse tekens, dus de extractie kan onvolledig zijn',
        message: (p, f) =>
          p.language
            ? `De documenttaal (${f.language(p.language)}) gebruikt mogelijk een niet-Latijns schrift, dus de extractie kan onvolledig zijn`
            : `Niet-Latijnse tekens in veld ${q(p.field)}: de extractie kan minder nauwkeurig zijn`,
      },
      amount_zero: {
        name: 'Bedrag van nul',
        description: () => 'Een valutaveld is als nul of leeg geëxtraheerd',
        message: (p) => `Valutaveld ${q(p.field)} is nul of leeg`,
      },
      short_extraction: {
        name: 'Zeer weinig velden geëxtraheerd',
        description: (c, f) =>
          `Minder dan ${f.num(c.min_fields)} velden geëxtraheerd, waarschijnlijk door een slechte scan of een lege pagina`,
        message: (p, f) =>
          `Slechts ${f.num(p.count)} ${p.count === 1 ? 'veld' : 'velden'} geëxtraheerd (minimaal ${f.num(p.min_fields)}). Controleer de scankwaliteit of het documentformaat`,
      },
      missing_date: {
        name: 'Geen datum gevonden',
        description: () => 'Geen datumveld geëxtraheerd; een document zonder datum is mogelijk ongeldig',
        message: () => 'Geen datum gevonden. Controleer of het document gedateerd is',
      },
      expired_due_date: {
        name: 'Vervaldatum verstreken',
        description: () => 'Een vervaldatum of betalingstermijn ligt in het verleden',
        message: (p) => `Veld ${q(p.field)} is een verstreken vervaldatum: ${p.value}`,
      },
      large_monetary_amount: {
        name: 'Groot bedrag',
        description: (c, f) => `Een valutaveld is hoger dan ${f.num(c.threshold)}: escalatie aanbevolen`,
        message: (p, f) =>
          `Veld ${q(p.field)} bevat een groot bedrag (${p.value}) boven ${f.num(p.threshold)}. Escalatie aanbevolen`,
      },
      potential_personal_data: {
        name: 'Persoonsgegevens gevonden',
        description: () => "Velden met persoonsgegevens (namen, ID's, adressen): behandelen volgens AVG en HIPAA",
        message: (p) => {
          const { names, more } = firstFive(p.fields)
          return `Velden met persoonsgegevens: ${names}${more ? ` en nog ${more}` : ''}. Zorg voor naleving van AVG en HIPAA`
        },
      },
      duplicate_field_name: {
        name: 'Dubbele veldnaam',
        description: () => 'Dezelfde veldnaam is twee keer geëxtraheerd met verschillende waarden',
        message: (p) =>
          `Veld ${q(p.field)} is twee keer geëxtraheerd met verschillende waarden: ${q(p.first)} en ${q(p.second)}`,
      },
    },
    rulesPage: {
      title: 'Governance-regels',
      lead: 'Schakel de regels in of uit die tijdens de extractie worden toegepast. Wijzigingen gelden vanaf het volgende document.',
      failed: 'De regels konden niet worden geladen',
      none: 'Geen regels gevonden.',
      updateFailed: 'De regel kon niet worden bijgewerkt',
      enable: (name) => `${name} inschakelen`,
      disable: (name) => `${name} uitschakelen`,
    },
    audit: {
      title: 'Auditlog',
      lead: 'Governance-gebeurtenissen van alle verwerkte documenten. Alleen metadata: er wordt geen documentinhoud opgeslagen.',
      failed: 'Het auditlog kon niet worden geladen',
      empty: 'Nog geen gebeurtenissen. Verwerk een document om er een te maken.',
      columns: {
        timestamp: 'Tijdstip',
        docType: 'Documenttype',
        fields: 'Velden',
        flags: 'Geactiveerde regels',
        confidence: 'Betrouwbaarheid',
        review: 'Beoordeling',
      },
      flagCount: (n) => (n === 1 ? '1 melding' : `${n} meldingen`),
      noFlags: 'Geen',
      none: 'n.v.t.',
      summary: (total, page, pages) =>
        `${total} ${total === 1 ? 'gebeurtenis' : 'gebeurtenissen'} · Pagina ${page} van ${pages}`,
      previous: 'Vorige pagina',
      next: 'Volgende pagina',
    },
    history: {
      title: 'Geschiedenis',
      lead: 'Opgeslagen extracties. Klik op een rij om het volledige resultaat te openen.',
      search: 'Zoeken op bestandsnaam…',
      clearSearch: 'Zoekopdracht wissen',
      allTypes: 'Alle typen',
      count: (n) => (n === 1 ? '1 document' : `${n} documenten`),
      failed: 'De geschiedenis kon niet worden geladen',
      pageOf: (page, pages) => `Pagina ${page} van ${pages}`,
      previous: 'Vorige',
      next: 'Volgende',
      empty: 'Nog geen opgeslagen documenten.',
      uploadCta: 'Document uploaden',
      confirmDelete: 'Deze opgeslagen extractie verwijderen?',
      deleteFailed: 'Verwijderen mislukt',
      columns: {
        document: 'Document',
        type: 'Type',
        industry: 'Sector',
        confidence: 'Betrouwbaarheid',
        review: 'Beoordeling',
        saved: 'Opgeslagen',
      },
      cameraCapture: 'cameraopname',
      none: 'n.v.t.',
      view: 'Bekijken',
      delete: 'Verwijderen',
    },
    globalError: { title: 'Er is iets misgegaan', retry: 'Opnieuw proberen' },
  },
  de: {
    nav: { upload: 'Hochladen', history: 'Verlauf', rules: 'Regeln', audit: 'Prüfprotokoll' },
    errors: {
      status: (status, message) => `Fehler ${status}: ${message}`,
      unexpected: 'Ein unerwarteter Fehler ist aufgetreten',
    },
    upload: {
      lead: 'Laden Sie ein beliebiges Dokument hoch: Rechnungen, Laborberichte, Versorgerrechnungen, Verträge. Sie erhalten in Sekunden strukturierte Daten, geprüft nach Governance-Regeln.',
      steps: {
        detecting: 'Dokumenttyp wird erkannt…',
        extracting: 'Felder werden extrahiert…',
        validating: 'Governance-Regeln werden angewendet…',
      },
      tryAgain: 'Erneut versuchen',
      drop: 'Legen Sie Ihr Dokument hier ab',
      dropping: 'Hier loslassen',
      limits: 'Bis 20 MB · Scans werden automatisch optimiert · Nie gespeichert',
      browse: 'Dateien auswählen',
      camera: 'Mit der Kamera aufnehmen',
      capture: 'Foto aufnehmen',
      cancel: 'Abbrechen',
      unsupported: 'Dateityp nicht unterstützt. Erlaubte Formate: PDF, JPG, PNG, XLSX.',
      tooLarge: 'Datei zu groß. Die maximale Größe beträgt 20 MB.',
      cameraDenied: 'Kein Zugriff auf die Kamera, oder es ist keine Kamera verfügbar.',
      captureFailed: 'Das Foto konnte nicht aufgenommen werden.',
    },
    result: {
      failedSaved: 'Die gespeicherte Extraktion konnte nicht geladen werden.',
      expired: 'Das Ergebnis ist abgelaufen. Bitte laden Sie das Dokument erneut hoch.',
      failedLoad: 'Das Ergebnis konnte nicht geladen werden.',
      noResult: 'Kein Ergebnis gefunden. Bitte laden Sie zuerst ein Dokument hoch.',
      backToUpload: 'Zurück zum Hochladen',
      backToHistory: 'Zurück zum Verlauf',
      newDocument: 'Neues Dokument',
      viewInHistory: 'Im Verlauf ansehen',
      processedIn: (seconds) => `Verarbeitet in ${seconds} s`,
      save: 'Speichern',
      saving: 'Wird gespeichert…',
      saved: 'Gespeichert',
      saveFailed: 'Speichern fehlgeschlagen. Bitte versuchen Sie es erneut.',
      savedOn: (date) => `Gespeichert am ${date}`,
      referenceKeys: 'Referenzschlüssel',
      extractedFields: 'Extrahierte Felder',
      governanceFlags: 'Governance-Hinweise',
    },
    review: {
      requiredTitle: 'Menschliche Prüfung erforderlich',
      recommendedTitle: 'Menschliche Prüfung empfohlen',
      requiredBody:
        'Eine oder mehrere kritische Governance-Regeln wurden ausgelöst. Diese Extraktion muss vor der Verwendung von einem Menschen geprüft werden.',
      recommendedBody:
        'Es gibt eine oder mehrere Warnungen. Prüfen Sie diese Extraktion, bevor Sie Entscheidungen darauf stützen.',
      short: { not_required: 'Bestanden', recommended: 'Prüfen', required: 'Erforderlich' },
      status: { not_required: 'Nicht erforderlich', recommended: 'Empfohlen', required: 'Erforderlich' },
    },
    profile: {
      eyebrow: 'Dokumentprofil',
      type: 'Typ',
      industry: 'Branche',
      language: 'Sprache',
      currency: 'Währung',
      sections: 'Erkannte Abschnitte',
    },
    docTypes: {
      invoice: 'Rechnung',
      purchase_order: 'Bestellung',
      utility_bill: 'Versorgerrechnung',
      trade_confirmation: 'Handelsbestätigung',
      letter_of_credit: 'Akkreditiv',
      contract: 'Vertrag',
      commodity_report: 'Rohstoffbericht',
      lab_report: 'Laborbericht',
      medical_record: 'Krankenakte',
      clinical_form: 'Klinisches Formular',
      prescription: 'Rezept',
      bank_statement: 'Kontoauszug',
      tax_form: 'Steuerformular',
      cv_resume: 'Lebenslauf',
      other: 'Sonstiges',
    },
    industries: {
      healthcare: 'Gesundheitswesen',
      medical: 'Medizin',
      utilities: 'Versorgung',
      financial_services: 'Finanzdienstleistungen',
      banking: 'Bankwesen',
      insurance: 'Versicherungen',
      legal: 'Recht',
      hr: 'Personalwesen',
      procurement: 'Einkauf',
      logistics: 'Logistik',
      commodity_finance: 'Rohstofffinanzierung',
      real_estate: 'Immobilien',
      education: 'Bildung',
      government: 'Öffentliche Verwaltung',
      retail: 'Einzelhandel',
      technology: 'Technologie',
      other: 'Sonstiges',
    },
    dataTypes: {
      currency: 'Währung',
      date: 'Datum',
      text: 'Text',
      identifier: 'Kennung',
      percentage: 'Prozentsatz',
    },
    table: {
      field: 'Feld',
      value: 'Wert',
      section: 'Abschnitt',
      type: 'Typ',
      confidence: 'Konfidenz',
      critical: 'Kritisch',
      criticalLegend: 'wesentlich für den Zweck des Dokuments',
      confidenceLegend: 'Konfidenz:',
      high: 'hoch ≥85 %',
      moderate: 'mittel 60 bis 84 %',
      low: 'niedrig <60 %',
      empty: 'leer',
      none: 'k. A.',
      noFields: 'Keine Felder extrahiert.',
      exportCsv: 'CSV exportieren',
      exportTitle: 'Als CSV exportieren (öffnet in Excel)',
      csvHeaders: ['Feld', 'Wert', 'Abschnitt', 'Typ', 'Konfidenz', 'Kritisch'],
      yes: 'Ja',
      no: 'Nein',
    },
    flags: {
      none: 'Keine Governance-Probleme gefunden',
      severity: { error: 'Fehler', warning: 'Warnung', info: 'Info' },
      legend: {
        error: 'manuelle Prüfung erforderlich',
        warning: 'Aufmerksamkeit empfohlen',
        info: 'zur Information',
      },
    },
    rules: {
      low_confidence_field: {
        name: 'Feld mit niedriger Konfidenz',
        description: (c, f) => `Jedes extrahierte Feld mit einer Konfidenz unter ${f.pct(c.threshold)}`,
        message: (p, f) =>
          `Feld ${q(p.field)} hat eine Konfidenz von ${f.pct(p.confidence)} (unter ${f.pct(p.threshold)})`,
      },
      very_low_confidence_field: {
        name: 'Sehr niedrige Konfidenz',
        description: (c, f) => `Jedes extrahierte Feld mit einer Konfidenz unter ${f.pct(c.threshold)}`,
        message: (p, f) =>
          `Feld ${q(p.field)} hat eine sehr niedrige Konfidenz von ${f.pct(p.confidence)} (unter ${f.pct(p.threshold)}). Manuelle Prüfung erforderlich`,
      },
      missing_critical_value: {
        name: 'Kritischer Wert fehlt',
        description: () => 'Ein Feld, das das Modell als kritisch einstuft, hat keinen Wert',
        message: (p) => `Kritisches Feld ${q(p.field)} hat keinen Wert`,
      },
      currency_mismatch: {
        name: 'Abweichende Währungen',
        description: () => 'Mehrere Währungen ohne ausdrückliche Umrechnung erkannt',
        message: (p, f) => `Mehrere Währungen erkannt: ${f.list(p.currencies)}. Prüfen Sie die Umrechnung`,
      },
      future_date_anomaly: {
        name: 'Datum weit in der Zukunft',
        description: (c, f) => `Ein Datumsfeld liegt mehr als ${f.num(c.days_ahead)} Tage in der Zukunft`,
        message: (p, f) =>
          `Feld ${q(p.field)} enthält ein Datum mehr als ${f.num(p.days)} Tage in der Zukunft: ${p.value}`,
      },
      past_date_anomaly: {
        name: 'Datum weit in der Vergangenheit',
        description: (c, f) => `Ein Datumsfeld liegt mehr als ${f.num(c.years_back)} Jahre in der Vergangenheit`,
        message: (p, f) =>
          `Feld ${q(p.field)} enthält ein Datum mehr als ${f.num(p.years)} Jahre in der Vergangenheit: ${p.value}`,
      },
      overall_low_confidence: {
        name: 'Niedrige Gesamtkonfidenz',
        description: (c, f) =>
          `Gesamtkonfidenz der Extraktion unter ${f.pct(c.threshold)}: manuelle Prüfung empfohlen`,
        message: (p, f) =>
          `Die Gesamtkonfidenz der Extraktion liegt bei ${f.pct(p.confidence)}, unter ${f.pct(p.threshold)}. Manuelle Prüfung empfohlen`,
      },
      no_identifiers_found: {
        name: 'Keine Kennungen gefunden',
        description: () => 'Keine Referenzschlüssel erkannt (keine Bestell-, Rechnungs- oder Vertragsnummer)',
        message: () => 'Keine Referenzkennungen erkannt (keine Rechnungsnummer, Bestellnummer, Vertragsnummer o. Ä.)',
      },
      unsupported_language: {
        name: 'Nicht lateinische Schrift',
        description: () =>
          'Das Dokument enthält nicht lateinische Zeichen, daher kann die Extraktion unvollständig sein',
        message: (p, f) =>
          p.language
            ? `Die Dokumentsprache (${f.language(p.language)}) verwendet möglicherweise eine nicht lateinische Schrift, daher kann die Extraktion unvollständig sein`
            : `Nicht lateinische Zeichen im Feld ${q(p.field)}: Die Extraktion kann ungenauer sein`,
      },
      amount_zero: {
        name: 'Betrag von null',
        description: () => 'Ein Währungsfeld wurde als null oder leer extrahiert',
        message: (p) => `Währungsfeld ${q(p.field)} ist null oder leer`,
      },
      short_extraction: {
        name: 'Sehr wenige Felder extrahiert',
        description: (c, f) =>
          `Weniger als ${f.num(c.min_fields)} Felder extrahiert, wahrscheinlich ein Scanproblem oder eine leere Seite`,
        message: (p, f) =>
          `Nur ${f.num(p.count)} ${p.count === 1 ? 'Feld' : 'Felder'} extrahiert (mindestens ${f.num(p.min_fields)}). Prüfen Sie die Scanqualität oder das Dokumentformat`,
      },
      missing_date: {
        name: 'Kein Datum gefunden',
        description: () => 'Kein Datumsfeld extrahiert; ein Dokument ohne Datum ist möglicherweise ungültig',
        message: () => 'Kein Datum gefunden. Prüfen Sie, ob das Dokument datiert ist',
      },
      expired_due_date: {
        name: 'Fälligkeit überschritten',
        description: () => 'Ein Fälligkeits- oder Ablaufdatum oder eine Zahlungsfrist liegt in der Vergangenheit',
        message: (p) => `Feld ${q(p.field)} ist ein überschrittenes Fälligkeits- oder Ablaufdatum: ${p.value}`,
      },
      large_monetary_amount: {
        name: 'Hoher Geldbetrag',
        description: (c, f) => `Ein Währungsfeld übersteigt ${f.num(c.threshold)}: Eskalation empfohlen`,
        message: (p, f) =>
          `Feld ${q(p.field)} enthält einen hohen Betrag (${p.value}) über ${f.num(p.threshold)}. Eskalation empfohlen`,
      },
      potential_personal_data: {
        name: 'Personenbezogene Daten erkannt',
        description: () =>
          'Felder mit personenbezogenen Daten (Namen, Kennungen, Adressen): nach DSGVO und HIPAA behandeln',
        message: (p) => {
          const { names, more } = firstFive(p.fields)
          return `Felder mit personenbezogenen Daten: ${names}${more ? ` und ${more} weitere` : ''}. Stellen Sie die Einhaltung von DSGVO und HIPAA sicher`
        },
      },
      duplicate_field_name: {
        name: 'Doppelter Feldname',
        description: () => 'Derselbe Feldname wurde zweimal mit unterschiedlichen Werten extrahiert',
        message: (p) =>
          `Feld ${q(p.field)} wurde zweimal mit unterschiedlichen Werten extrahiert: ${q(p.first)} und ${q(p.second)}`,
      },
    },
    rulesPage: {
      title: 'Governance-Regeln',
      lead: 'Aktivieren oder deaktivieren Sie die Regeln, die bei der Extraktion angewendet werden. Änderungen gelten ab dem nächsten Dokument.',
      failed: 'Die Regeln konnten nicht geladen werden',
      none: 'Keine Regeln gefunden.',
      updateFailed: 'Die Regel konnte nicht aktualisiert werden',
      enable: (name) => `${name} aktivieren`,
      disable: (name) => `${name} deaktivieren`,
    },
    audit: {
      title: 'Prüfprotokoll',
      lead: 'Governance-Ereignisse aller verarbeiteten Dokumente. Nur Metadaten: Es werden keine Dokumentinhalte gespeichert.',
      failed: 'Das Prüfprotokoll konnte nicht geladen werden',
      empty: 'Noch keine Ereignisse. Verarbeiten Sie ein Dokument, um eines zu erzeugen.',
      columns: {
        timestamp: 'Zeitpunkt',
        docType: 'Dokumenttyp',
        fields: 'Felder',
        flags: 'Ausgelöste Regeln',
        confidence: 'Konfidenz',
        review: 'Prüfung',
      },
      flagCount: (n) => (n === 1 ? '1 Hinweis' : `${n} Hinweise`),
      noFlags: 'Keine',
      none: 'k. A.',
      summary: (total, page, pages) =>
        `${total} ${total === 1 ? 'Ereignis' : 'Ereignisse'} · Seite ${page} von ${pages}`,
      previous: 'Vorherige Seite',
      next: 'Nächste Seite',
    },
    history: {
      title: 'Verlauf',
      lead: 'Gespeicherte Extraktionen. Klicken Sie auf eine Zeile, um das vollständige Ergebnis zu öffnen.',
      search: 'Nach Dateiname suchen…',
      clearSearch: 'Suche löschen',
      allTypes: 'Alle Typen',
      count: (n) => (n === 1 ? '1 Dokument' : `${n} Dokumente`),
      failed: 'Der Verlauf konnte nicht geladen werden',
      pageOf: (page, pages) => `Seite ${page} von ${pages}`,
      previous: 'Zurück',
      next: 'Weiter',
      empty: 'Noch keine gespeicherten Dokumente.',
      uploadCta: 'Dokument hochladen',
      confirmDelete: 'Diese gespeicherte Extraktion löschen?',
      deleteFailed: 'Löschen fehlgeschlagen',
      columns: {
        document: 'Dokument',
        type: 'Typ',
        industry: 'Branche',
        confidence: 'Konfidenz',
        review: 'Prüfung',
        saved: 'Gespeichert',
      },
      cameraCapture: 'Kameraaufnahme',
      none: 'k. A.',
      view: 'Ansehen',
      delete: 'Löschen',
    },
    globalError: { title: 'Etwas ist schiefgelaufen', retry: 'Erneut versuchen' },
  },
}
