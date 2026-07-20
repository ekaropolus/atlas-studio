import { useEffect } from 'react'
import * as d3 from 'd3'
import { useElementSize } from '../../hooks/useElementSize'

export default function MethodologyWeightChart({ weights }) {
  const [containerRef, size] = useElementSize()

  useEffect(() => {
    if (!size.width || !weights.length) {
      return undefined
    }

    const width = size.width
    const height = weights.length * 56 + 14
    const margin = { top: 8, right: 20, bottom: 8, left: 170 }
    const maxWeight = Math.max(...weights.map((weight) => weight.weight), 1)
    const x = d3.scaleLinear().domain([0, maxWeight]).range([margin.left, width - margin.right])

    const svg = d3
      .create('svg')
      .attr('viewBox', `0 0 ${width} ${height}`)
      .attr('role', 'img')
      .attr('aria-label', 'Pesos metodologicos del indice')

    const row = svg
      .append('g')
      .selectAll('g')
      .data(weights)
      .join('g')
      .attr('transform', (_weight, index) => `translate(0, ${index * 56 + margin.top})`)

    row
      .append('text')
      .attr('x', margin.left - 14)
      .attr('y', 17)
      .attr('fill', '#1d1b1a')
      .attr('font-size', 13)
      .attr('font-weight', 600)
      .attr('text-anchor', 'end')
      .text((weight) => weight.label)

    row
      .append('rect')
      .attr('x', margin.left)
      .attr('y', 4)
      .attr('width', width - margin.left - margin.right)
      .attr('height', 12)
      .attr('fill', '#ebe2d6')

    row
      .append('rect')
      .attr('x', margin.left)
      .attr('y', 4)
      .attr('width', 0)
      .attr('height', 12)
      .attr('fill', (weight) => weight.accent)
      .transition()
      .duration(900)
      .ease(d3.easeCubicOut)
      .attr('width', (weight) => x(weight.weight) - margin.left)

    row
      .append('text')
      .attr('x', (weight) => x(weight.weight) + 8)
      .attr('y', 16)
      .attr('fill', '#111111')
      .attr('font-size', 12)
      .attr('font-weight', 700)
      .text((weight) => `${weight.weight}%`)

    const container = d3.select(containerRef.current)
    container.selectAll('*').remove()
    container.append(() => svg.node())

    return () => {
      svg.remove()
    }
  }, [containerRef, size.width, weights])

  return <div className="d3-chart d3-chart--compact" ref={containerRef} />
}
