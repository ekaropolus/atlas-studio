import { useEffect } from 'react'
import * as d3 from 'd3'
import { useElementSize } from '../../hooks/useElementSize'
import { formatPercentValue } from '../../lib/format'

function formatGapLabel(value) {
  const points = (value ?? 0) * 100
  const sign = points > 0 ? '+' : ''
  return `${sign}${points.toFixed(1)} pp`
}

export default function BudgetChapterDeltaChart({ chapterRows, stateName }) {
  const [containerRef, size] = useElementSize()

  useEffect(() => {
    const container = d3.select(containerRef.current)
    container.selectAll('*').remove()

    if (!size.width || !chapterRows?.length) {
      return undefined
    }

    const rows = [...chapterRows]
      .filter((row) => Number.isFinite(row.shareGap))
      .sort((left, right) => Math.abs(right.shareGap) - Math.abs(left.shareGap))

    const width = size.width
    const height = rows.length * 48 + 76
    const margin = { top: 18, right: 130, bottom: 34, left: 244 }
    const maxAbsGap = Math.max(d3.max(rows, (row) => Math.abs(row.shareGap)) ?? 0, 0.04)

    const x = d3
      .scaleLinear()
      .domain([-maxAbsGap * 1.18, maxAbsGap * 1.18])
      .range([margin.left, width - margin.right])

    const y = d3
      .scaleBand()
      .domain(rows.map((row) => row.id))
      .range([margin.top, height - margin.bottom])
      .padding(0.22)

    const svg = d3
      .create('svg')
      .attr('viewBox', `0 0 ${width} ${height}`)
      .attr('role', 'img')
      .attr('aria-label', `Brecha por capitulo contra la mezcla nacional para ${stateName}`)

    svg
      .append('g')
      .attr('transform', `translate(0, ${height - margin.bottom})`)
      .call(
        d3
          .axisBottom(x)
          .ticks(6)
          .tickFormat((value) => formatGapLabel(value)),
      )
      .call((group) => group.selectAll('path, line').attr('stroke', 'rgba(100, 116, 139, 0.3)'))
      .call((group) => group.selectAll('text').attr('fill', '#64748b').attr('font-size', 11))

    svg
      .append('line')
      .attr('x1', x(0))
      .attr('x2', x(0))
      .attr('y1', margin.top - 8)
      .attr('y2', height - margin.bottom)
      .attr('stroke', 'rgba(15, 23, 42, 0.24)')
      .attr('stroke-dasharray', '4 6')

    svg
      .append('text')
      .attr('x', x(0))
      .attr('y', 14)
      .attr('text-anchor', 'middle')
      .attr('fill', '#64748b')
      .attr('font-size', 11)
      .attr('font-weight', 700)
      .text('mezcla nacional')

    const groups = svg
      .append('g')
      .selectAll('g')
      .data(rows)
      .join('g')
      .attr('transform', (row) => `translate(0, ${y(row.id)})`)

    groups
      .append('rect')
      .attr('x', (row) => x(Math.min(0, row.shareGap)))
      .attr('y', 4)
      .attr('height', y.bandwidth() - 8)
      .attr('width', 0)
      .attr('rx', 8)
      .attr('fill', (row) => (row.shareGap >= 0 ? '#0f766e' : '#b45309'))
      .transition()
      .duration(760)
      .ease(d3.easeCubicOut)
      .attr('width', (row) => Math.abs(x(row.shareGap) - x(0)))

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
      .attr('y', 34)
      .attr('text-anchor', 'end')
      .attr('fill', '#64748b')
      .attr('font-size', 11)
      .text((row) => `${formatPercentValue(row.shareOfExercised)} estado / ${formatPercentValue(row.nationalShare)} pais`)

    groups
      .append('text')
      .attr('x', (row) => (row.shareGap >= 0 ? x(row.shareGap) + 10 : x(row.shareGap) - 10))
      .attr('y', 26)
      .attr('text-anchor', (row) => (row.shareGap >= 0 ? 'start' : 'end'))
      .attr('fill', '#0f172a')
      .attr('font-size', 11)
      .attr('font-weight', 700)
      .text((row) => formatGapLabel(row.shareGap))

    container.append(() => svg.node())

    return () => {
      svg.remove()
    }
  }, [chapterRows, containerRef, size.width, stateName])

  return <div className="d3-chart d3-chart--budget-delta" ref={containerRef} />
}
