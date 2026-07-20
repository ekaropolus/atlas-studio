import { useEffect } from 'react'
import * as d3 from 'd3'
import { useElementSize } from '../../hooks/useElementSize'
import { formatCurrencyValue, formatPercentValue } from '../../lib/format'

export default function BudgetCompositionChart({
  budgetBenchmarks,
  chapters,
  stateName,
}) {
  const [containerRef, size] = useElementSize()

  useEffect(() => {
    const container = d3.select(containerRef.current)
    container.selectAll('*').remove()

    if (!size.width || !chapters?.length || !budgetBenchmarks?.chapterShares) {
      return undefined
    }

    const rows = chapters.map((chapter) => ({
      ...chapter,
      stateShare: Number.isFinite(chapter.shareOfExercised) ? chapter.shareOfExercised : 0,
      nationalShare: Number.isFinite(budgetBenchmarks.chapterShares[chapter.id])
        ? budgetBenchmarks.chapterShares[chapter.id]
        : 0,
    }))

    const width = size.width
    const height = rows.length * 54 + 80
    const margin = { top: 24, right: 64, bottom: 28, left: 220 }
    const maxShare = Math.max(
      d3.max(rows, (row) => Math.max(row.stateShare, row.nationalShare)) ?? 0,
      0.05,
    )

    const x = d3
      .scaleLinear()
      .domain([0, maxShare * 1.12])
      .nice()
      .range([margin.left, width - margin.right])

    const y = d3
      .scaleBand()
      .domain(rows.map((row) => row.id))
      .range([margin.top, height - margin.bottom])
      .padding(0.32)

    const svg = d3
      .create('svg')
      .attr('viewBox', `0 0 ${width} ${height}`)
      .attr('role', 'img')
      .attr('aria-label', `Comparacion de capitulos de gasto para ${stateName}`)

    svg
      .append('g')
      .attr('transform', `translate(0, ${height - margin.bottom})`)
      .call(
        d3
          .axisBottom(x)
          .ticks(5)
          .tickFormat((value) => formatPercentValue(value)),
      )
      .call((group) => group.selectAll('path, line').attr('stroke', 'rgba(148, 163, 184, 0.35)'))
      .call((group) => group.selectAll('text').attr('fill', '#64748b').attr('font-size', 11))

    svg
      .append('g')
      .selectAll('text')
      .data([
        { x: width - 190, label: 'Promedio nacional', color: '#d1c8bc' },
        { x: width - 92, label: stateName, color: '#0f766e' },
      ])
      .join('text')
      .attr('x', (item) => item.x)
      .attr('y', 16)
      .attr('fill', (item) => item.color)
      .attr('font-size', 11)
      .attr('font-weight', 700)
      .text((item) => item.label)

    const groups = svg
      .append('g')
      .selectAll('g')
      .data(rows)
      .join('g')
      .attr('transform', (row) => `translate(0, ${y(row.id)})`)

    groups
      .append('rect')
      .attr('x', margin.left)
      .attr('y', 4)
      .attr('height', y.bandwidth() - 8)
      .attr('width', 0)
      .attr('rx', 8)
      .attr('fill', '#d1c8bc')
      .transition()
      .duration(700)
      .ease(d3.easeCubicOut)
      .attr('width', (row) => x(row.nationalShare) - margin.left)

    groups
      .append('rect')
      .attr('x', margin.left)
      .attr('y', 13)
      .attr('height', Math.max(y.bandwidth() - 26, 6))
      .attr('width', 0)
      .attr('rx', 6)
      .attr('fill', '#0f766e')
      .transition()
      .delay(90)
      .duration(820)
      .ease(d3.easeCubicOut)
      .attr('width', (row) => x(row.stateShare) - margin.left)

    groups
      .append('text')
      .attr('x', margin.left - 14)
      .attr('y', 17)
      .attr('text-anchor', 'end')
      .attr('fill', '#0f172a')
      .attr('font-size', 12.5)
      .attr('font-weight', 700)
      .text((row) => `${row.code} ${row.label}`)

    groups
      .append('text')
      .attr('x', margin.left - 14)
      .attr('y', 35)
      .attr('text-anchor', 'end')
      .attr('fill', '#64748b')
      .attr('font-size', 11)
      .text((row) => formatCurrencyValue(row.amount))

    groups
      .append('text')
      .attr('x', (row) => x(Math.max(row.stateShare, row.nationalShare)) + 10)
      .attr('y', 26)
      .attr('fill', '#0f172a')
      .attr('font-size', 11)
      .attr('font-weight', 700)
      .text((row) => `${formatPercentValue(row.stateShare)} / ${formatPercentValue(row.nationalShare)}`)

    container.append(() => svg.node())

    return () => {
      svg.remove()
    }
  }, [budgetBenchmarks, chapters, containerRef, size.width, stateName])

  return <div className="d3-chart d3-chart--budget-composition" ref={containerRef} />
}
