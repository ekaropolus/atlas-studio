import { useEffect } from 'react'
import * as d3 from 'd3'
import { useElementSize } from '../../hooks/useElementSize'

const seriesConfig = [
  { id: 'violence', label: 'Violencia controlada', color: '#ff6b6b' },
  { id: 'perception', label: 'Percepcion', color: '#99d8ff' },
  { id: 'capacity', label: 'Capacidad', color: '#61efc0' },
  { id: 'response', label: 'Respuesta', color: '#ffb84d' },
]

export default function TrendLinesChart({ timeline, stateName }) {
  const [containerRef, size] = useElementSize()

  useEffect(() => {
    if (!size.width || !timeline.length) {
      return undefined
    }

    const width = size.width
    const height = 340
    const margin = { top: 26, right: 96, bottom: 42, left: 42 }

    const x = d3
      .scalePoint()
      .domain(timeline.map((point) => point.year))
      .range([margin.left, width - margin.right])

    const y = d3.scaleLinear().domain([0, 100]).range([height - margin.bottom, margin.top])

    const svg = d3
      .create('svg')
      .attr('viewBox', `0 0 ${width} ${height}`)
      .attr('role', 'img')
      .attr('aria-label', `Trayectoria de ${stateName}`)

    svg
      .append('g')
      .attr('transform', `translate(${margin.left},0)`)
      .call(d3.axisLeft(y).ticks(5))
      .call((group) => group.selectAll('path, line').attr('stroke', 'rgba(17,17,17,0.14)'))
      .call((group) => group.selectAll('text').attr('fill', '#5d554e'))

    svg
      .append('g')
      .attr('transform', `translate(0,${height - margin.bottom})`)
      .call(d3.axisBottom(x))
      .call((group) => group.selectAll('path, line').attr('stroke', 'rgba(17,17,17,0.14)'))
      .call((group) => group.selectAll('text').attr('fill', '#5d554e'))

    svg
      .append('text')
      .attr('x', margin.left)
      .attr('y', 14)
      .attr('fill', '#924b10')
      .attr('font-size', 12)
      .attr('letter-spacing', '0.2em')
      .text('TRAYECTORIA 2021-2025')

    const line = d3
      .line()
      .x((point) => x(point.year))
      .y((point) => y(point.value))
      .curve(d3.curveCatmullRom.alpha(0.5))

    seriesConfig.forEach((series) => {
      const values = timeline.map((point) => ({
        year: point.year,
        value: point[series.id],
      }))

      const path = svg
        .append('path')
        .datum(values)
        .attr('fill', 'none')
        .attr('stroke', series.color)
        .attr('stroke-width', 3.4)
        .attr('d', line)

      const totalLength = path.node().getTotalLength()

      path
        .attr('stroke-dasharray', `${totalLength} ${totalLength}`)
        .attr('stroke-dashoffset', totalLength)
        .transition()
        .duration(1100)
        .ease(d3.easeCubicOut)
        .attr('stroke-dashoffset', 0)

      svg
        .append('g')
        .selectAll('circle')
        .data(values)
        .join('circle')
        .attr('cx', (point) => x(point.year))
        .attr('cy', (point) => y(point.value))
        .attr('r', 0)
        .attr('fill', series.color)
        .transition()
        .delay(400)
        .duration(700)
        .attr('r', 4.5)

      const finalPoint = values.at(-1)

      svg
        .append('text')
        .attr('x', x(finalPoint.year) + 10)
        .attr('y', y(finalPoint.value) + 4)
        .attr('fill', series.color)
        .attr('font-size', 12)
        .text(series.label)
    })

    const container = d3.select(containerRef.current)
    container.selectAll('*').remove()
    container.append(() => svg.node())

    return () => {
      svg.remove()
    }
  }, [containerRef, size.width, stateName, timeline])

  return <div className="d3-chart" ref={containerRef} />
}
