import { formatCurrencyValue, formatMetricValue, formatPercentValue } from '../lib/format'

export default function BudgetTable({
  activeMetricId,
  chapters,
  data,
  onSelectState,
  selectedStateId,
}) {
  return (
    <>
      <div className="table-wrap table-wrap--budget">
        <table className="state-table state-table--budget">
          <thead>
            <tr>
              <th>Rank</th>
              <th>Estado</th>
              <th>Ejercido</th>
              <th>Per capita</th>
              <th>Peso federal</th>
              <th>Peso tec.</th>
              {chapters.map((chapter) => (
                <th key={chapter.id}>{chapter.code}</th>
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
                <td>{formatCurrencyValue(state.budgetExercised)}</td>
                <td>{formatMetricValue(state.budgetPerCapita, 'budgetPerCapita')}</td>
                <td>{formatPercentValue(state.federalFundsShare)}</td>
                <td>{formatPercentValue(state.techPlatformShare)}</td>
                {chapters.map((chapter) => {
                  const row = state.chapters.find((item) => item.id === chapter.id)
                  return <td key={chapter.id}>{formatCurrencyValue(row?.amount)}</td>
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="table-footnote">Abreviaturas monetarias: `$M` = millones de MXN; `$ mil M` = miles de millones de MXN.</p>
    </>
  )
}
