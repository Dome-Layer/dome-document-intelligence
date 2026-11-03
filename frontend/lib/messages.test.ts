import { describe, expect, it } from 'vitest'
import { flagMessage, makeFmt, ruleDescription, ruleName } from './labels'
import { MESSAGES, type RuleId } from './messages'
import type { GovernanceRule, ValidationFlag } from './types'

/** The shape of a catalogue, with functions and arrays reduced to markers, for comparing languages. */
function shape(value: unknown): unknown {
  if (typeof value === 'function') return 'fn'
  if (Array.isArray(value)) return `array/${value.length}`
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, shape((value as Record<string, unknown>)[key])]),
    )
  }
  return typeof value
}

const LOCALES = ['en', 'it', 'nl', 'de'] as const

/** The sixteen rules of backend/app/services/validation.py. */
const RULE_IDS: RuleId[] = [
  'low_confidence_field',
  'very_low_confidence_field',
  'missing_critical_value',
  'currency_mismatch',
  'future_date_anomaly',
  'past_date_anomaly',
  'overall_low_confidence',
  'no_identifiers_found',
  'unsupported_language',
  'amount_zero',
  'short_extraction',
  'missing_date',
  'expired_due_date',
  'large_monetary_amount',
  'potential_personal_data',
  'duplicate_field_name',
]

/** Intl puts a no-break space before % and inside numbers in some languages; compare as plain spaces. */
const plain = (text: string) => text.replace(/[\u00a0\u202f]/g, ' ')

function flag(rule_id: string, params?: ValidationFlag['params']): ValidationFlag {
  return { rule_id, rule_name: 'English name', severity: 'warning', field_name: null, message: 'English record', params }
}

describe('Document Intelligence catalogue (roadmap row 6)', () => {
  it('has the same keys, functions and list lengths in every language', () => {
    const english = shape(MESSAGES.en)
    for (const locale of ['it', 'nl', 'de'] as const) {
      expect(shape(MESSAGES[locale]), locale).toEqual(english)
    }
  })

  it('names every rule, document type and data type in every language', () => {
    for (const locale of LOCALES) {
      const t = MESSAGES[locale]
      expect(Object.keys(t.rules).sort()).toEqual([...RULE_IDS].sort())
      for (const id of RULE_IDS) expect(ruleName(t, id, 'x'), `${locale} ${id}`).not.toBe('x')
      expect(Object.keys(t.docTypes)).toHaveLength(15)
      expect(Object.keys(t.dataTypes).sort()).toEqual(['currency', 'date', 'identifier', 'percentage', 'text'])
    }
  })
})

describe('flag messages', () => {
  const de = MESSAGES.de
  const fmt = makeFmt('de-DE')

  it('words a flag from its params in the visitor language', () => {
    const text = flagMessage(de, fmt, flag('low_confidence_field', { field: 'total', confidence: 0.55, threshold: 0.7 }))
    expect(plain(text)).toBe("Feld 'total' hat eine Konfidenz von 55 % (unter 70 %)")
    expect(plain(flagMessage(de, fmt, flag('currency_mismatch', { currencies: ['EUR', 'USD'] })))).toBe(
      'Mehrere Währungen erkannt: EUR und USD. Prüfen Sie die Umrechnung',
    )
    expect(flagMessage(MESSAGES.it, makeFmt('it-IT'), flag('unsupported_language', { language: 'ja' }))).toContain(
      'giapponese',
    )
  })

  it('names at most five personal data fields and counts the rest', () => {
    const fields = ['a', 'b', 'c', 'd', 'e', 'f', 'g']
    expect(flagMessage(MESSAGES.en, makeFmt('en-GB'), flag('potential_personal_data', { fields }))).toBe(
      "Personal data fields detected: 'a', 'b', 'c', 'd', 'e' and 2 more. Ensure GDPR and HIPAA compliance",
    )
  })

  it('keeps the English record when params are missing or the rule is unknown', () => {
    expect(flagMessage(de, fmt, flag('low_confidence_field'))).toBe('English record')
    expect(flagMessage(de, fmt, flag('low_confidence_field', { field: 'total' }))).toBe('English record')
    expect(flagMessage(de, fmt, flag('a_rule_added_later', { field: 'x' }))).toBe('English record')
    expect(ruleName(de, 'a_rule_added_later', 'English name')).toBe('English name')
  })

  it('needs no params for the rules whose message has no values', () => {
    expect(flagMessage(de, fmt, flag('missing_date'))).toBe('Kein Datum gefunden. Prüfen Sie, ob das Dokument datiert ist')
  })

  it('puts a rule configured threshold in its description', () => {
    const rule: GovernanceRule = {
      id: '1',
      rule_id: 'large_monetary_amount',
      name: 'Large monetary amount',
      description: 'English description',
      severity: 'warning',
      enabled: true,
      config: { threshold: 250000 },
    }
    expect(plain(ruleDescription(de, fmt, rule))).toBe('Ein Währungsfeld übersteigt 250.000: Eskalation empfohlen')
    expect(plain(ruleDescription(de, fmt, { ...rule, config: {} }))).toContain('100.000')
  })
})
