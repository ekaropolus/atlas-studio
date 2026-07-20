import { useEffect } from 'react'
import * as d3 from 'd3'
import { useElementSize } from '../../hooks/useElementSize'

export default function DimensionStripChart({ data }) {
  const [containerRef, size] = useElementSize()

  useEffect(() => {
    if (!size.width || !data.length) {
      return undefined
    }

    const width = size.width
    const height = data.length * 58 + 18
    const margin = { top: 10, right: 18, bottom: 10, left: 130 }

    const x = d3.scaleLinear().domain([0, 100]).range([margin.left, width - margin.right])

    const svg = d3
      .create('svg')
      .attr('viewBox', `0 0 ${width} ${height}`)
      .attr('role', 'img')
      .attr('aria-label', 'Resumen nacional por dimension')

    const row = svg
      .append('g')
      .selectAll('g')
      .data(data)
      .join('g')
      .attr('transform', (_item, index) => `translate(0, ${index * 58 + margin.top})`)

    row
      .append('text')
      .attr('x', margin.left - 14)
      .attr('y', 17)
      .attr('fill', '#1d1b1a')
      .attr('font-size', 13)
      .attr('font-weight', 600)
      .attr('text-anchor', 'end')
      .text((item) => item.label)

    row
      .append('rect')
      .attr('x', margin.left)
      .attr('y', 4)
      .attr('width', width - margin.left - margin.right)
      .attr('height', 14)
      .attr('rx', 2)
      .attr('fill', '#ebe2d6')

    row
      .append('rect')
      .attr('x', margin.left)
      .attr('y', 4)
      .attr('width', 0)
      .attr('height', 14)
      .attr('fill', (item) => item.accent)
      .transition()
      .duration(1100)
      .ease(d3.easeCubicOut)
      .attr('width', (item) => x(item.value) - margin.left)

    row
      .append('line')
      .attr('x1', (item) => x(item.value))
      .attr('x2', (item) => x(item.value))
      .attr('y1', 1)
      .attr('y2', 25)
      .attr('stroke', '#121212')
      .attr('stroke-width', 1.5)
      .attr('opacity', 0)
      .transition()
      .delay(350)
      .duration(700)
      .attr('opacity', 1)

    row
      .append('text')
      .attr('x', (item) => x(item.value) + 8)
      .attr('y', 16)
      .attr('fill', '#111111')
      .attr('font-size', 13)
      .attr('font-weight', 700)
      .text((item) => `${item.value}`)

    const container = d3.select(containerRef.current)
    container.selectAll('*').remove()
    container.append(() => svg.node())

    return () => {
      svg.remove()
    }
  }, [containerRef, data, size.width])

  return <div className="d3-chart d3-chart--compact" ref={containerRef} />
}
