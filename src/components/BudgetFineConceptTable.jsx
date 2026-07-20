import { formatCurrencyValue, formatPercentValue } from '../lib/format'

export default function BudgetFineConceptTable({ groups, labels }) {
  const rows = groups.flatMap((group) =>
    group.items.map((item) => ({
      ...item,
      groupCode: group.code,
      groupLabel: group.label,
      groupShareOfScope: group.shareOfScope,
    })),
  )

  return (
    <>
      <div className="table-wrap table-wrap--budget-detail">
        <table className="state-table state-table--fine">
          <thead>
            <tr>
              <th>{labels.group}</th>
              <th>{labels.item}</th>
              <th>Devengado</th>
              <th>Pagado</th>
              <th>Subejercicio</th>
              <th>% alcance</th>
              <th>% {labels.group.toLowerCase()}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td>
                  <strong>{row.groupCode ?? 'N/A'}</strong>
                  <span>{row.groupLabel}</span>
                </td>
                <td>
                  <strong>{row.label}</strong>
                  <span>{formatPercentValue(row.groupShareOfScope)} del alcance</span>
                </td>
                <td>{formatCurrencyValue(row.devengado)}</td>
                <td>{formatCurrencyValue(row.pagado)}</td>
                <td>{formatCurrencyValue(row.subexercise)}</td>
                <td>{formatPercentValue(row.shareOfScope)}</td>
                <td>{formatPercentValue(row.shareOfGroup)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="table-footnote">
        Esta tabla usa el devengado del alcance fino seleccionado y baja al mayor nivel público
        explotable para ese estado: de {labels.group.toLowerCase()} a {labels.item.toLowerCase()}.
      </p>
    </>
  )
}
