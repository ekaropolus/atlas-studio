import { formatCurrencyValue, formatPercentValue } from '../lib/format'

function gapTone(row) {
  if (!Number.isFinite(row.shareGap)) {
    return 'tone-neutral'
  }

  if (row.shareGap > 0.015) {
    return 'tone-good'
  }

  if (row.shareGap < -0.015) {
    return 'tone-risk'
  }

  return 'tone-neutral'
}

function formatGap(row) {
  if (!Number.isFinite(row.shareGap)) {
    return 'Sin dato'
  }

  const points = row.shareGap * 100
  const sign = points > 0 ? '+' : ''
  return `${sign}${points.toFixed(1)} pp`
}

export default function BudgetChapterDetailTable({ rows }) {
  return (
    <>
      <div className="table-wrap table-wrap--budget-detail">
        <table className="state-table state-table--chapter-detail">
          <thead>
            <tr>
              <th>Capitulo</th>
              <th>Monto</th>
              <th>% estado</th>
              <th>% pais</th>
              <th>Brecha</th>
              <th>MXN/hab</th>
              <th>Rank share</th>
              <th>Rank MXN/hab</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td>
                  <strong>{row.code}</strong>
                  <span>{row.label}</span>
                </td>
                <td>{formatCurrencyValue(row.amount)}</td>
                <td>{formatPercentValue(row.shareOfExercised)}</td>
                <td>{formatPercentValue(row.nationalShare)}</td>
                <td>
                  <span className={`status-pill ${gapTone(row)}`}>{formatGap(row)}</span>
                </td>
                <td>{formatCurrencyValue(row.perCapita)}</td>
                <td>{row.shareRank ? `#${row.shareRank}` : 'Sin dato'}</td>
                <td>{row.perCapitaRank ? `#${row.perCapitaRank}` : 'Sin dato'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="table-footnote">
        Brecha = diferencia en puntos porcentuales entre la mezcla del estado y la mezcla nacional
        del ejercido visible.
      </p>
    </>
  )
}
