interface ConfidencePillProps {
  value: number
}

export function ConfidencePill({ value }: ConfidencePillProps) {
  const pct = Math.round(value * 100)

  let colorClass: string
  if (value >= 0.85) {
    colorClass = 'badge-success'
  } else if (value >= 0.6) {
    colorClass = 'badge-warning'
  } else {
    colorClass = 'badge-error'
  }

  return (
    <span className={`badge pill ${colorClass}`} style={{ fontSize: '0.6875rem' }}>
      {pct}%
    </span>
  )
}
