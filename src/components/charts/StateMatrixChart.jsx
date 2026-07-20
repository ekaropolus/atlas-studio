import { useEffect } from 'react'
import * as d3 from 'd3'
import { useElementSize } from '../../hooks/useElementSize'
import { formatMetricValue } from '../../lib/format'

function buildScale(metric, values) {
  const extent = d3.extent(values)

  if (metric.higherIsBetter) {
    return d3.scaleSequential(d3.interpolateBuGn).domain(extent)
  }

  return d3.scaleSequential(d3.interpolateOrRd).domain(extent)
}

export default function StateMatrixChart({ data, metrics, selectedStateId, onSelectState }) {
  const [containerRef, size] = useElementSize()

  useEffect(() => {
    if (!size.width || !data.length || !metrics.length) {
      return undefined
    }

    const width = size.width
    const labelWidth = 150
    const rowHeight = 30
    const headerHeight = 46
    const height = headerHeight + data.length * rowHeight + 20
    const margin = { top: 10, right: 10, bottom: 10, left: 0 }
    const columnWidth = (width - labelWidth - margin.right) / metrics.length

    const scales = Object.fromEntries(
      metrics.map((metric) => [
        metric.id,
        buildScale(
          metric,
          data.map((state) => state[metric.id]),
        ),
      ]),
    )

    const svg = d3
      .create('svg')
      .attr('viewBox', `0 0 ${width} ${height}`)
      .attr('role', 'img')
      .attr('aria-label', 'Matriz estatal comparada')

    svg
      .append('g')
      .selectAll('text')
      .data(metrics)
      .join('text')
      .attr('x', (_metric, index) => labelWidth + index * columnWidth + columnWidth / 2)
      .attr('y', 20)
      .attr('text-anchor', 'middle')
      .attr('font-size', 11)
      .attr('font-weight', 700)
      .attr('letter-spacing', '0.06em')
      .attr('fill', '#475569')
      .text((metric) => metric.shortLabel.toUpperCase())

    const rows = svg
      .append('g')
      .attr('transform', `translate(0, ${headerHeight})`)
      .selectAll('g')
      .data(data, (state) => state.id)
      .join('g')
      .attr('transform', (_state, index) => `translate(0, ${index * rowHeight})`)
      .style('cursor', 'pointer')
      .on('click', (_event, state) => onSelectState(state.id))

    rows
      .append('rect')
      .attr('x', 0)
      .attr('y', 0)
      .attr('width', width)
      .attr('height', rowHeight - 2)
      .attr('fill', (state) => (state.id === selectedStateId ? 'rgba(15, 118, 110, 0.08)' : 'transparent'))
      .attr('rx', 8)

    rows
      .append('text')
      .attr('x', 8)
      .attr('y', 19)
      .attr('font-size', 12.5)
      .attr('font-weight', (state) => (state.id === selectedStateId ? 700 : 500))
      .attr('fill', '#0f172a')
      .text((state) => state.name)

    metrics.forEach((metric, columnIndex) => {
      const scale = scales[metric.id]

      const cells = rows
        .append('g')
        .attr('transform', `translate(${labelWidth + columnIndex * columnWidth}, 0)`)

      cells
        .append('rect')
        .attr('x', 2)
        .attr('y', 2)
        .attr('width', Math.max(columnWidth - 6, 0))
        .attr('height', rowHeight - 6)
        .attr('rx', 6)
        .attr('fill', (state) =>
          Number.isFinite(state[metric.id]) ? scale(state[metric.id]) : 'rgba(148, 163, 184, 0.18)',
        )
        .attr('opacity', 0)
        .attr('stroke', (state) => (state.id === selectedStateId ? '#0f172a' : 'rgba(15, 23, 42, 0.08)'))
        .attr('stroke-width', (state) => (state.id === selectedStateId ? 1.8 : 1))
        .transition()
        .duration(700)
        .delay((_state, index) => index * 8 + columnIndex * 24)
        .attr('opacity', 1)

      cells
        .append('text')
        .attr('x', columnWidth / 2)
        .attr('y', 19)
        .attr('text-anchor', 'middle')
        .attr('font-size', 11)
        .attr('font-weight', 700)
        .attr('fill', (state) => {
          const fill = d3.color(
            Number.isFinite(state[metric.id]) ? scale(state[metric.id]) : 'rgba(148, 163, 184, 0.18)',
          )
          return fill && fill.formatHex() ? (d3.lab(fill).l < 55 ? '#f8fafc' : '#0f172a') : '#0f172a'
        })
        .text((state) => (Number.isFinite(state[metric.id]) ? formatMetricValue(state[metric.id], metric.id) : 's/d'))
    })

    const container = d3.select(containerRef.current)
    container.selectAll('*').remove()
    container.append(() => svg.node())

    return () => {
      svg.remove()
    }
  }, [containerRef, data, metrics, onSelectState, selectedStateId, size.width])

  return <div className="d3-chart d3-chart--matrix" ref={containerRef} />
}
