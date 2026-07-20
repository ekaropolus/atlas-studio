import { useEffect } from 'react'
import * as d3 from 'd3'
import { useElementSize } from '../../hooks/useElementSize'

export default function PipelineFlowChart({ steps }) {
  const [containerRef, size] = useElementSize()

  useEffect(() => {
    if (!size.width || !steps.length) {
      return undefined
    }

    const width = size.width
    const height = 170
    const margin = { top: 24, right: 36, bottom: 20, left: 36 }
    const spacing = (width - margin.left - margin.right) / Math.max(steps.length - 1, 1)

    const points = steps.map((step, index) => ({
      ...step,
      x: margin.left + spacing * index,
      y: height / 2,
    }))

    const line = d3
      .line()
      .x((point) => point.x)
      .y((point) => point.y)
      .curve(d3.curveCatmullRom.alpha(0.5))

    const svg = d3
      .create('svg')
      .attr('viewBox', `0 0 ${width} ${height}`)
      .attr('role', 'img')
      .attr('aria-label', 'Pipeline del estudio')

    const path = svg
      .append('path')
      .datum(points)
      .attr('fill', 'none')
      .attr('stroke', '#c85a1a')
      .attr('stroke-width', 2.5)
      .attr('d', line)

    const totalLength = path.node().getTotalLength()

    path
      .attr('stroke-dasharray', `${totalLength} ${totalLength}`)
      .attr('stroke-dashoffset', totalLength)
      .transition()
      .duration(1100)
      .ease(d3.easeCubicOut)
      .attr('stroke-dashoffset', 0)

    const nodes = svg
      .append('g')
      .selectAll('g')
      .data(points)
      .join('g')
      .attr('transform', (point) => `translate(${point.x}, ${point.y})`)

    nodes
      .append('circle')
      .attr('r', 0)
      .attr('fill', '#111111')
      .transition()
      .delay((_point, index) => index * 120)
      .duration(450)
      .attr('r', 8)

    nodes
      .append('text')
      .attr('y', -18)
      .attr('text-anchor', 'middle')
      .attr('fill', '#c85a1a')
      .attr('font-size', 11)
      .attr('letter-spacing', '0.14em')
      .text((point) => point.title.toUpperCase())

    nodes
      .append('text')
      .attr('y', 34)
      .attr('text-anchor', 'middle')
      .attr('fill', '#5d554e')
      .attr('font-size', 11)
      .text((point) => point.body)
      .call((selection) => {
        selection.each(function wrapText(point) {
          const text = d3.select(this)
          const words = point.body.split(' ')
          const lines = []
          let currentLine = []

          words.forEach((word) => {
            currentLine.push(word)
            if (currentLine.join(' ').length > 18) {
              lines.push(currentLine.slice(0, -1).join(' '))
              currentLine = [word]
            }
          })

          if (currentLine.length) {
            lines.push(currentLine.join(' '))
          }

          text.text(null)
          lines.forEach((lineText, index) => {
            text
              .append('tspan')
              .attr('x', 0)
              .attr('dy', index === 0 ? 0 : 14)
              .text(lineText)
          })
        })
      })

    const container = d3.select(containerRef.current)
    container.selectAll('*').remove()
    container.append(() => svg.node())

    return () => {
      svg.remove()
    }
  }, [containerRef, size.width, steps])

  return <div className="d3-chart" ref={containerRef} />
}
