import { formatCurrencyValue, formatPercentValue } from '../lib/format'

const statusLabel = {
  reported: 'Reportado',
  missing: 'Falta dato',
  unknown: 'No concluido',
  no: 'No reporta',
  yes: 'Reporta',
}

function toneForRow(row) {
  if (row.status === 'missing' || row.status === 'unknown') {
    return 'tone-risk'
  }

  if (row.amount > 0) {
    return 'tone-good'
  }

  return 'tone-neutral'
}

export default function BudgetSourceTable({ description, rows, title }) {
  return (
    <div className="source-stack">
      <div className="panel-head">
        <div>
          <p className="eyebrow">Detalle estatal</p>
          <h3>{title}</h3>
        </div>
        <p>{description}</p>
      </div>

      <div className="source-table source-table--detail">
        <div className="source-row source-row--head source-row--detail">
          <span>Componente</span>
          <span>Monto</span>
          <span>% ejercido</span>
          <span>% bloque</span>
          <span>Estatus</span>
        </div>
        {rows.map((row) => (
          <div className="source-row source-row--detail" key={row.id}>
            <strong>{row.label}</strong>
            <span>{formatCurrencyValue(row.amount)}</span>
            <span>{formatPercentValue(row.shareOfExercised)}</span>
            <span>{formatPercentValue(row.shareOfParent)}</span>
            <span>
              <span className={`status-pill ${toneForRow(row)}`}>
                {statusLabel[row.status] ?? 'Sin clasificar'}
              </span>
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
