import { formatMetricValue } from '../lib/format'

const fallbackColumns = [
  { id: 'score', label: 'Atlas' },
  { id: 'operationalScore', label: 'Operativo' },
  { id: 'budgetExercised', label: 'Presupuesto' },
  { id: 'budgetPerCapita', label: '$ / hab' },
  { id: 'homicideRate', label: 'Homicidio' },
  { id: 'extortionRate', label: 'Extorsion' },
  { id: 'robberyViolenceRate', label: 'Robo c/viol.' },
  { id: 'violenceFamilyRate', label: 'V. familiar' },
  { id: 'narcomenudeoRate', label: 'Narcomen.' },
  { id: 'totalCrimeRate', label: 'Total' },
]

export default function StatesTable({
  activeMetricId,
  columns = fallbackColumns,
  data,
  onSelectState,
  selectedStateId,
}) {
  const showsBudgetColumns = columns.some(
    (column) => column.id === 'budgetExercised' || column.id === 'budgetPerCapita',
  )

  return (
    <>
      <div className="table-wrap">
        <table className="state-table">
          <thead>
            <tr>
              <th>Rank</th>
              <th>Estado</th>
              {columns.map((column) => (
                <th key={column.id}>{column.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((state) => (
              <tr
                className={state.id === selectedStateId ? 'is-active' : ''}
                key={state.id}
                onClick={() => onSelectState(state.id)}
              >
                <td>{state.ranks[activeMetricId]}</td>
                <td>
                  <strong>{state.name}</strong>
                  <span>{state.region}</span>
                </td>
                {columns.map((column) => (
                  <td key={column.id}>{formatMetricValue(state[column.id], column.id)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {showsBudgetColumns ? (
        <p className="table-footnote">Abreviaturas monetarias: `$M` = millones de MXN; `$ mil M` = miles de millones de MXN.</p>
      ) : null}
    </>
  )
}
