import type { GovernanceRule, ValidationFlag } from './types'
import type { FlagParams, Fmt, Messages, RuleConfig, RuleId, RuleText } from './messages'

/** `line_items` to "Line items": for ids the catalogue has no label for (model-chosen sections, new types). */
export function humanize(id: string): string {
  const text = id.replace(/_/g, ' ').trim()
  return text.charAt(0).toUpperCase() + text.slice(1)
}

/** The label for a canonical id, or the id made readable when the catalogue does not know it. */
export function labelFor(labels: Record<string, string>, id: string): string {
  return labels[id] ?? humanize(id)
}

export function makeFmt(intlLocale: string): Fmt {
  const pct = new Intl.NumberFormat(intlLocale, { style: 'percent', maximumFractionDigits: 0 })
  const num = new Intl.NumberFormat(intlLocale)
  const list = new Intl.ListFormat(intlLocale, { style: 'long', type: 'conjunction' })
  let names: Intl.DisplayNames | null = null
  try {
    names = new Intl.DisplayNames([intlLocale], { type: 'language' })
  } catch {
    names = null
  }
  return {
    pct: (value) => pct.format(value),
    num: (value) => num.format(value),
    list: (items) => list.format(items),
    language: (code) => {
      try {
        const name = names?.of(code)
        if (name && name.toLowerCase() !== code.toLowerCase()) return name
      } catch {
        // not a language code the browser knows
      }
      return code.toUpperCase()
    },
  }
}

function ruleText(t: Messages, ruleId: string): RuleText | undefined {
  return (t.rules as Record<string, RuleText>)[ruleId]
}

/** A rule's name in the visitor's language; the backend's English name for a rule the catalogue lacks. */
export function ruleName(t: Messages, ruleId: string, fallback: string): string {
  return ruleText(t, ruleId)?.name ?? fallback
}

/** The backend's defaults (validation.py RULES_DEFINITIONS), for a rule whose config leaves one out. */
const DEFAULT_THRESHOLD: Partial<Record<RuleId, number>> = {
  low_confidence_field: 0.7,
  very_low_confidence_field: 0.4,
  overall_low_confidence: 0.6,
  large_monetary_amount: 100000,
}

function ruleConfig(rule: GovernanceRule): RuleConfig {
  const c = rule.config ?? {}
  const n = (key: string, fallback: number) => (typeof c[key] === 'number' ? (c[key] as number) : fallback)
  return {
    threshold: n('threshold', DEFAULT_THRESHOLD[rule.rule_id as RuleId] ?? 0),
    days_ahead: n('days_ahead', 90),
    years_back: n('years_back', 5),
    min_fields: n('min_fields', 3),
  }
}

/** A rule's description in the visitor's language, with its configured numbers. */
export function ruleDescription(t: Messages, f: Fmt, rule: GovernanceRule): string {
  const text = ruleText(t, rule.rule_id)
  return text ? text.description(ruleConfig(rule), f) : rule.description
}

type ParamKey = keyof FlagParams

function has(p: Partial<FlagParams>, ...keys: ParamKey[]): boolean {
  return keys.every((key) => p[key] !== undefined && p[key] !== null)
}

/** The params each rule's wording needs; a flag without them (saved before 2026-11-03) keeps its English message. */
const READY: Record<RuleId, (p: Partial<FlagParams>) => boolean> = {
  low_confidence_field: (p) => has(p, 'field', 'confidence', 'threshold'),
  very_low_confidence_field: (p) => has(p, 'field', 'confidence', 'threshold'),
  missing_critical_value: (p) => has(p, 'field'),
  currency_mismatch: (p) => has(p, 'currencies'),
  future_date_anomaly: (p) => has(p, 'field', 'days', 'value'),
  past_date_anomaly: (p) => has(p, 'field', 'years', 'value'),
  overall_low_confidence: (p) => has(p, 'confidence', 'threshold'),
  no_identifiers_found: () => true,
  unsupported_language: (p) => has(p, 'language') || has(p, 'field'),
  amount_zero: (p) => has(p, 'field'),
  short_extraction: (p) => has(p, 'count', 'min_fields'),
  missing_date: () => true,
  expired_due_date: (p) => has(p, 'field', 'value'),
  large_monetary_amount: (p) => has(p, 'field', 'value', 'threshold'),
  potential_personal_data: (p) => has(p, 'fields'),
  duplicate_field_name: (p) => has(p, 'field', 'first', 'second'),
}

/** A flag's message in the visitor's language, worded from its params; the English record otherwise. */
export function flagMessage(t: Messages, f: Fmt, flag: ValidationFlag): string {
  const text = ruleText(t, flag.rule_id)
  const ready = READY[flag.rule_id as RuleId]
  const params = (flag.params ?? {}) as Partial<FlagParams>
  if (!text || !ready || !ready(params)) return flag.message
  return text.message(params as FlagParams, f)
}
