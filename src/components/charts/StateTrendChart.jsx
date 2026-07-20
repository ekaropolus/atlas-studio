import { useEffect } from 'react'
import * as d3 from 'd3'
import { useElementSize } from '../../hooks/useElementSize'
import { formatMetricValue } from '../../lib/format'

export default function StateTrendChart({
  metric,
  nationalMonthly,
  selectedMonthly,
  stateName,
}) {
  const [containerRef, size] = useElementSize()

  useEffect(() => {
    const container = d3.select(containerRef.current)
    container.selectAll('*').remove()

    if (!size.width || !metric || !nationalMonthly?.length || !selectedMonthly?.length) {
      return undefined
    }

    const points = selectedMonthly
      .map((month, index) => ({
        month: month.month,
        stateValue: Number(month[metric.id]),
        nationalValue: Number(nationalMonthly[index]?.[metric.id]),
      }))
      .filter(
        (point) =>
          point.month &&
          Number.isFinite(point.stateValue) &&
          Number.isFinite(point.nationalValue),
      )

    if (!points.length) {
      const emptySvg = d3
        .create('svg')
        .attr('viewBox', `0 0 ${size.width} 290`)
        .attr('role', 'img')
        .attr('aria-label', `Serie mensual no disponible para ${stateName}`)

      emptySvg
        .append('text')
        .attr('x', size.width / 2)
        .attr('y', 145)
        .attr('text-anchor', 'middle')
        .attr('fill', '#64748b')
        .attr('font-size', 13)
        .text('Serie mensual no disponible para esta dimension')

      container.append(() => emptySvg.node())
      return () => {
        emptySvg.remove()
      }
    }

    const width = size.width
    const height = 290
    const margin = { top: 22, right: 20, bottom: 40, left: 44 }
    const x = d3
      .scalePoint()
      .domain(points.map((point) => point.month))
      .range([margin.left, width - margin.right])

    const y = d3
      .scaleLinear()
      .domain([
        0,
        Math.max(d3.max(points, (point) => Math.max(point.stateValue, point.nationalValue)) ?? 0, 1) *
          1.15,
      ])
      .nice()
      .range([height - margin.bottom, margin.top])

    const line = d3
      .line()
      .x((point) => x(point.month))
      .y((point) => y(point.value))
      .curve(d3.curveCatmullRom.alpha(0.6))

    const svg = d3
      .create('svg')
      .attr('viewBox', `0 0 ${width} ${height}`)
      .attr('role', 'img')
      .attr('aria-label', `Serie mensual de ${stateName}`)

    svg
      .append('g')
      .attr('transform', `translate(0, ${height - margin.bottom})`)
      .call(d3.axisBottom(x))
      .call((group) => group.selectAll('path, line').attr('stroke', 'rgba(148, 163, 184, 0.45)'))
      .call((group) => group.selectAll('text').attr('fill', '#64748b').attr('font-size', 11))

    svg
      .append('g')
      .attr('transform', `translate(${margin.left}, 0)`)
      .call(d3.axisLeft(y).ticks(5))
      .call((group) => group.selectAll('path, line').attr('stroke', 'rgba(148, 163, 184, 0.45)'))
      .call((group) => group.selectAll('text').attr('fill', '#64748b').attr('font-size', 11))

    const series = [
      {
        id: 'national',
        color: '#94a3b8',
        strokeWidth: 2.2,
        label: 'Promedio nacional',
        values: points.map((point) => ({ month: point.month, value: point.nationalValue })),
      },
      {
        id: 'state',
        color: metric.color,
        strokeWidth: 3.4,
        label: stateName,
        values: points.map((point) => ({ month: point.month, value: point.stateValue })),
      },
    ]

    series.forEach((serie, index) => {
      const path = svg
        .append('path')
        .datum(serie.values)
        .attr('fill', 'none')
        .attr('stroke', serie.color)
        .attr('stroke-width', serie.strokeWidth)
        .attr('stroke-linecap', 'round')
        .attr('d', line)

      const totalLength = path.node().getTotalLength()

      path
        .attr('stroke-dasharray', `${totalLength} ${totalLength}`)
        .attr('stroke-dashoffset', totalLength)
        .transition()
        .delay(index * 150)
        .duration(900)
        .ease(d3.easeCubicOut)
        .attr('stroke-dashoffset', 0)

      svg
        .append('g')
        .selectAll('circle')
        .data(serie.values)
        .join('circle')
        .attr('cx', (point) => x(point.month))
        .attr('cy', (point) => y(point.value))
        .attr('r', 0)
        .attr('fill', serie.color)
        .transition()
        .delay(index * 150 + 350)
        .duration(500)
        .attr('r', index === 0 ? 3 : 4.5)

      const finalPoint = serie.values.at(-1)

      svg
        .append('text')
        .attr('x', x(finalPoint.month) + 8)
        .attr('y', y(finalPoint.value) + (index === 0 ? -6 : 5))
        .attr('fill', serie.color)
        .attr('font-size', 12)
        .attr('font-weight', 700)
        .text(`${serie.label} ${formatMetricValue(finalPoint.value, metric.id)}`)
    })

    container.append(() => svg.node())

    return () => {
      svg.remove()
    }
  }, [containerRef, metric, nationalMonthly, selectedMonthly, size.width, stateName])

  return <div className="d3-chart" ref={containerRef} />
}
