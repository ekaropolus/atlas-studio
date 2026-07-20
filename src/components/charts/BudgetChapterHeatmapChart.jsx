import { useEffect } from 'react'
import * as d3 from 'd3'
import { useElementSize } from '../../hooks/useElementSize'
import { formatPercentValue } from '../../lib/format'

export default function BudgetChapterHeatmapChart({
  chapters,
  data,
  onSelectState,
  selectedStateId,
}) {
  const [containerRef, size] = useElementSize()

  useEffect(() => {
    if (!size.width || !data.length || !chapters.length) {
      return undefined
    }

    const minColumnWidth = 92
    const labelWidth = 190
    const renderWidth = Math.max(size.width, labelWidth + chapters.length * minColumnWidth + 12)
    const width = renderWidth
    const rowHeight = 36
    const headerHeight = 34
    const height = headerHeight + data.length * rowHeight + 20
    const margin = { top: 8, right: 12, bottom: 12, left: 0 }
    const columnWidth = (width - labelWidth - margin.right) / chapters.length

    const maxShare = Math.max(
      d3.max(
        data.flatMap((state) =>
          chapters.map((chapter) => state.chapters.find((item) => item.id === chapter.id)?.shareOfExercised ?? 0),
        ),
      ) ?? 0,
      0.05,
    )

    const scale = d3.scaleSequential(d3.interpolatePuBuGn).domain([0, maxShare])

    const svg = d3
      .create('svg')
      .attr('width', width)
      .attr('height', height)
      .attr('viewBox', `0 0 ${width} ${height}`)
      .attr('role', 'img')
      .attr('aria-label', 'Matriz detallada de capitulos presupuestales por estado')
      .style('display', 'block')
      .style('max-width', 'none')

    svg
      .append('g')
      .selectAll('text')
      .data(chapters)
      .join('text')
      .attr('x', (_chapter, index) => labelWidth + index * columnWidth + columnWidth / 2)
      .attr('y', 20)
      .attr('text-anchor', 'middle')
      .attr('font-size', 11.5)
      .attr('font-weight', 700)
      .attr('letter-spacing', '0.06em')
      .attr('fill', '#475569')
      .text((chapter) => chapter.code)

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
      .attr('rx', 10)

    rows
      .append('text')
      .attr('x', 8)
      .attr('y', 21)
      .attr('font-size', 12.5)
      .attr('font-weight', (state) => (state.id === selectedStateId ? 700 : 500))
      .attr('fill', '#0f172a')
      .text((state) => state.name)

    rows
      .append('text')
      .attr('x', 8)
      .attr('y', 33)
      .attr('font-size', 10.5)
      .attr('fill', '#64748b')
      .text((state) => `Rank #${state.ranks?.budgetPerCapita ?? 's/d'} · ${state.region}`)

    chapters.forEach((chapter, columnIndex) => {
      const cells = rows
        .append('g')
        .attr('transform', `translate(${labelWidth + columnIndex * columnWidth}, 0)`)

      cells
        .append('rect')
        .attr('x', 2)
        .attr('y', 3)
        .attr('width', Math.max(columnWidth - 6, 0))
        .attr('height', rowHeight - 7)
        .attr('rx', 7)
        .attr('fill', (state) => {
          const row = state.chapters.find((item) => item.id === chapter.id)
          return Number.isFinite(row?.shareOfExercised) ? scale(row.shareOfExercised) : 'rgba(148, 163, 184, 0.15)'
        })
        .attr('opacity', 0)
        .transition()
        .duration(620)
        .delay((_state, index) => index * 7 + columnIndex * 20)
        .attr('opacity', 1)

      cells
        .append('text')
        .attr('x', columnWidth / 2)
        .attr('y', 22)
        .attr('text-anchor', 'middle')
        .attr('font-size', 10.5)
        .attr('font-weight', 700)
        .attr('fill', (state) => {
          const row = state.chapters.find((item) => item.id === chapter.id)
          const fill = d3.color(
            Number.isFinite(row?.shareOfExercised) ? scale(row.shareOfExercised) : 'rgba(148, 163, 184, 0.15)',
          )
          return fill && fill.formatHex() ? (d3.lab(fill).l < 55 ? '#f8fafc' : '#0f172a') : '#0f172a'
        })
        .text((state) => {
          const row = state.chapters.find((item) => item.id === chapter.id)
          return Number.isFinite(row?.shareOfExercised) ? formatPercentValue(row.shareOfExercised) : 's/d'
        })
    })

    const container = d3.select(containerRef.current)
    container.selectAll('*').remove()
    container.append(() => svg.node())

    return () => {
      svg.remove()
    }
  }, [chapters, containerRef, data, onSelectState, selectedStateId, size.width])

  return <div className="d3-chart d3-chart--budget-heatmap" ref={containerRef} />
}
