import { useEffect } from 'react'
import * as d3 from 'd3'
import { useElementSize } from '../../hooks/useElementSize'
import { formatAxisMetricValue, formatMetricValue } from '../../lib/format'

export default function StateRankingChart({
  data,
  metric,
  selectedStateId,
  onSelectState,
}) {
  const [containerRef, size] = useElementSize()

  useEffect(() => {
    if (!size.width || !data.length || !metric) {
      return undefined
    }

    const sorted = [...data].sort((left, right) =>
      metric.higherIsBetter ? right[metric.id] - left[metric.id] : left[metric.id] - right[metric.id],
    )
    const numericValues = sorted.map((item) => item[metric.id]).filter(Number.isFinite)
    const width = size.width
    const height = sorted.length * 56 + 70
    const margin = { top: 18, right: 24, bottom: 40, left: 120 }
    const maxValue = Math.max(d3.max(numericValues) ?? 0, 1)

    const x = d3
      .scaleLinear()
      .domain([0, maxValue * 1.12])
      .nice()
      .range([margin.left, width - margin.right])

    const y = d3
      .scaleBand()
      .domain(sorted.map((item) => item.id))
      .range([margin.top, height - margin.bottom])
      .padding(0.24)

    const svg = d3
      .create('svg')
      .attr('viewBox', `0 0 ${width} ${height}`)
      .attr('role', 'img')
      .attr('aria-label', `Ranking estatal por ${metric.label}`)

    const average = d3.mean(numericValues) ?? 0

    svg
      .append('g')
      .attr('transform', `translate(0,${height - margin.bottom})`)
      .call(
        d3
          .axisBottom(x)
          .ticks(5)
          .tickFormat((value) => formatAxisMetricValue(value, metric.id)),
      )
      .call((group) => group.selectAll('path, line').attr('stroke', 'rgba(17,17,17,0.18)'))
      .call((group) => group.selectAll('text').attr('fill', '#5d554e'))

    svg
      .append('line')
      .attr('x1', x(average))
      .attr('x2', x(average))
      .attr('y1', margin.top - 4)
      .attr('y2', height - margin.bottom)
      .attr('stroke', 'rgba(191, 96, 28, 0.75)')
      .attr('stroke-dasharray', '5 6')

    svg
      .append('text')
      .attr('x', x(average) + 8)
      .attr('y', margin.top)
      .attr('fill', '#924b10')
      .attr('font-size', 12)
      .text('promedio nacional')

    const rows = svg
      .append('g')
      .selectAll('g')
      .data(sorted, (item) => item.id)
      .join('g')
      .style('cursor', 'pointer')
      .on('click', (_event, item) => {
        onSelectState(item.id)
      })

    rows
      .append('rect')
      .attr('x', margin.left)
      .attr('y', (item) => y(item.id))
      .attr('height', y.bandwidth())
      .attr('rx', 2)
      .attr('width', 0)
      .attr('fill', (item) => (item.id === selectedStateId ? metric.color : '#d9d1c8'))
      .transition()
      .duration(1000)
      .ease(d3.easeCubicOut)
      .attr('width', (item) => x(Number.isFinite(item[metric.id]) ? item[metric.id] : 0) - margin.left)

    rows
      .append('text')
      .attr('x', margin.left - 12)
      .attr('y', (item) => y(item.id) + y.bandwidth() / 2 + 5)
      .attr('fill', '#181512')
      .attr('font-size', 14)
      .attr('font-weight', (item) => (item.id === selectedStateId ? 700 : 500))
      .attr('text-anchor', 'end')
      .text((item) => item.name)

    rows
      .append('text')
      .attr('x', (item) => x(Number.isFinite(item[metric.id]) ? item[metric.id] : 0) + 10)
      .attr('y', (item) => y(item.id) + y.bandwidth() / 2 + 5)
      .attr('fill', '#111111')
      .attr('font-size', 13)
      .attr('font-weight', 700)
      .text((item) => formatMetricValue(item[metric.id], metric.id))

    const container = d3.select(containerRef.current)
    container.selectAll('*').remove()
    container.append(() => svg.node())

    return () => {
      svg.remove()
    }
  }, [containerRef, data, metric, onSelectState, selectedStateId, size.width])

  return <div className="d3-chart" ref={containerRef} />
}
