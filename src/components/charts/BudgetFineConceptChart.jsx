import { useEffect } from 'react'
import * as d3 from 'd3'
import { useElementSize } from '../../hooks/useElementSize'
import { formatCurrencyValue, formatPercentValue } from '../../lib/format'

export default function BudgetFineConceptChart({ items, itemLabel, scopeName }) {
  const [containerRef, size] = useElementSize()

  useEffect(() => {
    const container = d3.select(containerRef.current)
    container.selectAll('*').remove()

    if (!size.width || !items?.length) {
      return undefined
    }

    const rows = items.slice(0, 10)
    const width = Math.max(size.width, 980)
    const height = rows.length * 54 + 70
    const margin = { top: 20, right: 82, bottom: 28, left: 300 }
    const maxValue = Math.max(d3.max(rows, (row) => row.devengado) ?? 0, 1)

    const x = d3
      .scaleLinear()
      .domain([0, maxValue * 1.1])
      .nice()
      .range([margin.left, width - margin.right])

    const y = d3
      .scaleBand()
      .domain(rows.map((row) => row.id))
      .range([margin.top, height - margin.bottom])
      .padding(0.22)

    const svg = d3
      .create('svg')
      .attr('width', width)
      .attr('height', height)
      .attr('viewBox', `0 0 ${width} ${height}`)
      .attr('role', 'img')
      .attr('aria-label', `Top ${itemLabel.toLowerCase()}s devengados para ${scopeName}`)
      .style('display', 'block')
      .style('max-width', 'none')

    svg
      .append('g')
      .attr('transform', `translate(0, ${height - margin.bottom})`)
      .call(
        d3
          .axisBottom(x)
          .ticks(5)
          .tickFormat((value) => formatCurrencyValue(value, { compact: true })),
      )
      .call((group) => group.selectAll('path, line').attr('stroke', 'rgba(100, 116, 139, 0.3)'))
      .call((group) => group.selectAll('text').attr('fill', '#64748b').attr('font-size', 11))

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
      .attr('fill', '#0f766e')
      .transition()
      .duration(760)
      .ease(d3.easeCubicOut)
      .attr('width', (row) => x(row.devengado) - margin.left)

    groups
      .append('text')
      .attr('x', margin.left - 12)
      .attr('y', 15)
      .attr('text-anchor', 'end')
      .attr('fill', '#0f172a')
      .attr('font-size', 12.5)
      .attr('font-weight', 700)
      .text((row) => row.label)

    groups
      .append('text')
      .attr('x', margin.left - 12)
      .attr('y', 32)
      .attr('text-anchor', 'end')
      .attr('fill', '#64748b')
      .attr('font-size', 11)
      .text((row) => {
        const groupToken = row.code ?? row.groupCode ?? row.chapterCode ?? row.groupLabel ?? itemLabel
        return `${groupToken} · ${formatPercentValue(row.shareOfScope)}`
      })

    groups
      .append('text')
      .attr('x', (row) => x(row.devengado) + 10)
      .attr('y', 26)
      .attr('fill', '#0f172a')
      .attr('font-size', 11)
      .attr('font-weight', 700)
      .text((row) => formatCurrencyValue(row.devengado, { compact: true }))

    container.append(() => svg.node())

    return () => {
      svg.remove()
    }
  }, [containerRef, itemLabel, items, scopeName, size.width])

  return <div className="d3-chart d3-chart--budget-fine-concepts" ref={containerRef} />
}
