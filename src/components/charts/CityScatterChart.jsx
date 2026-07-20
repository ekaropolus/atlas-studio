import { useEffect } from 'react'
import * as d3 from 'd3'
import { useElementSize } from '../../hooks/useElementSize'

const toneColors = {
  anchor: '#61efc0',
  watch: '#ffb84d',
  alert: '#ff6b6b',
}

export default function CityScatterChart({
  data,
  selectedCityId,
  onSelectCity,
  stateName,
}) {
  const [containerRef, size] = useElementSize()

  useEffect(() => {
    if (!size.width || !data.length) {
      return undefined
    }

    const width = size.width
    const height = 380
    const margin = { top: 26, right: 18, bottom: 48, left: 56 }

    const x = d3
      .scaleLinear()
      .domain([0, d3.max(data, (city) => city.violence) * 1.15])
      .nice()
      .range([margin.left, width - margin.right])

    const y = d3.scaleLinear().domain([0, 100]).range([height - margin.bottom, margin.top])
    const radius = d3
      .scaleSqrt()
      .domain(d3.extent(data, (city) => city.resilience))
      .range([12, 28])

    const svg = d3
      .create('svg')
      .attr('viewBox', `0 0 ${width} ${height}`)
      .attr('role', 'img')
      .attr('aria-label', `Ciudades del estado ${stateName}`)

    svg
      .append('g')
      .attr('transform', `translate(0,${height - margin.bottom})`)
      .call(d3.axisBottom(x).ticks(6))
      .call((group) => group.selectAll('path, line').attr('stroke', 'rgba(17,17,17,0.18)'))
      .call((group) => group.selectAll('text').attr('fill', '#5d554e'))

    svg
      .append('g')
      .attr('transform', `translate(${margin.left},0)`)
      .call(d3.axisLeft(y).ticks(5))
      .call((group) => group.selectAll('path, line').attr('stroke', 'rgba(17,17,17,0.18)'))
      .call((group) => group.selectAll('text').attr('fill', '#5d554e'))

    svg
      .append('line')
      .attr('x1', margin.left)
      .attr('x2', width - margin.right)
      .attr('y1', y(50))
      .attr('y2', y(50))
      .attr('stroke', 'rgba(17,17,17,0.12)')
      .attr('stroke-dasharray', '5 7')

    svg
      .append('line')
      .attr('x1', x(d3.median(data, (city) => city.violence)))
      .attr('x2', x(d3.median(data, (city) => city.violence)))
      .attr('y1', margin.top)
      .attr('y2', height - margin.bottom)
      .attr('stroke', 'rgba(17,17,17,0.12)')
      .attr('stroke-dasharray', '5 7')

    svg
      .append('text')
      .attr('x', width / 2)
      .attr('y', height - 10)
      .attr('fill', '#5d554e')
      .attr('font-size', 12)
      .attr('text-anchor', 'middle')
      .text('Violencia letal por 100 mil')

    svg
      .append('text')
      .attr('transform', 'rotate(-90)')
      .attr('x', -(height / 2))
      .attr('y', 18)
      .attr('fill', '#5d554e')
      .attr('font-size', 12)
      .attr('text-anchor', 'middle')
      .text('Percepcion de inseguridad (%)')

    const nodes = svg
      .append('g')
      .selectAll('g')
      .data(data, (city) => city.id)
      .join('g')
      .style('cursor', 'pointer')
      .on('click', (_event, city) => {
        onSelectCity(city.id)
      })

    nodes
      .append('circle')
      .attr('cx', width / 2)
      .attr('cy', height / 2)
      .attr('r', 0)
      .attr('fill', (city) => toneColors[city.emphasis] ?? '#9ad6ff')
      .attr('fill-opacity', (city) => (city.id === selectedCityId ? 0.95 : 0.7))
      .attr('stroke', (city) => (city.id === selectedCityId ? '#121212' : '#ffffff'))
      .attr('stroke-width', (city) => (city.id === selectedCityId ? 3 : 2))
      .transition()
      .duration(900)
      .ease(d3.easeCubicOut)
      .attr('cx', (city) => x(city.violence))
      .attr('cy', (city) => y(city.perception))
      .attr('r', (city) => radius(city.resilience))

    nodes
      .append('text')
      .attr('x', (city) => x(city.violence) + radius(city.resilience) + 8)
      .attr('y', (city) => y(city.perception) + 4)
      .attr('fill', '#1c1917')
      .attr('font-size', 12)
      .text((city) => city.name)

    const selectedCircle = nodes.filter((city) => city.id === selectedCityId).select('circle')

    function pulse() {
      selectedCircle
        .transition()
        .duration(650)
        .attr('stroke-width', 5)
        .attr('fill-opacity', 1)
        .transition()
        .duration(650)
        .attr('stroke-width', 3)
        .attr('fill-opacity', 0.9)
        .on('end', pulse)
    }

    if (!selectedCircle.empty()) {
      pulse()
    }

    const container = d3.select(containerRef.current)
    container.selectAll('*').remove()
    container.append(() => svg.node())

    return () => {
      nodes.interrupt()
      svg.remove()
    }
  }, [containerRef, data, onSelectCity, selectedCityId, size.width, stateName])

  return <div className="d3-chart" ref={containerRef} />
}
