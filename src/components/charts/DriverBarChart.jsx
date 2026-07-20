import { useEffect } from 'react'
import * as d3 from 'd3'
import { useElementSize } from '../../hooks/useElementSize'
import { formatDriverValue } from '../../lib/format'

const tone = {
  positive: '#61efc0',
  risk: '#ff6b6b',
}

export default function DriverBarChart({ drivers, title }) {
  const [containerRef, size] = useElementSize()

  useEffect(() => {
    if (!size.width || !drivers.length) {
      return undefined
    }

    const width = size.width
    const height = drivers.length * 66 + 30
    const margin = { top: 10, right: 18, bottom: 16, left: 18 }

    const x = d3.scaleLinear().domain([0, 100]).range([margin.left, width - margin.right])

    const svg = d3
      .create('svg')
      .attr('viewBox', `0 0 ${width} ${height}`)
      .attr('role', 'img')
      .attr('aria-label', title)

    const row = svg
      .append('g')
      .selectAll('g')
      .data(drivers)
      .join('g')
      .attr('transform', (_driver, index) => `translate(0, ${index * 66 + margin.top})`)

    row
      .append('text')
      .attr('x', margin.left)
      .attr('y', 12)
      .attr('fill', '#1d1b1a')
      .attr('font-size', 13)
      .attr('font-weight', 700)
      .text((driver) => driver.label)

    row
      .append('rect')
      .attr('x', margin.left)
      .attr('y', 22)
      .attr('rx', 9)
      .attr('height', 14)
      .attr('width', width - margin.left - margin.right)
      .attr('fill', '#ebe2d6')

    row
      .append('rect')
      .attr('x', margin.left)
      .attr('y', 22)
      .attr('rx', 9)
      .attr('height', 14)
      .attr('width', 0)
      .attr('fill', (driver) => tone[driver.direction] ?? '#9ad6ff')
      .transition()
      .duration(1000)
      .ease(d3.easeCubicOut)
      .attr('width', (driver) => x(driver.value) - margin.left)

    row
      .append('text')
      .attr('x', (driver) => x(driver.value) + 8)
      .attr('y', 34)
      .attr('fill', '#111111')
      .attr('font-size', 12)
      .attr('font-weight', 700)
      .text((driver) => formatDriverValue(driver.value))

    row
      .append('text')
      .attr('x', margin.left)
      .attr('y', 56)
      .attr('fill', '#6a645d')
      .attr('font-size', 12)
      .text((driver) => driver.note)

    const container = d3.select(containerRef.current)
    container.selectAll('*').remove()
    container.append(() => svg.node())

    return () => {
      svg.remove()
    }
  }, [containerRef, drivers, size.width, title])

  return <div className="d3-chart d3-chart--drivers" ref={containerRef} />
}
