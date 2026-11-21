const NS = 'http://www.w3.org/2000/svg';

function element(name, attributes) {
  const node = document.createElementNS(NS, name);
  for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, String(value));
  return node;
}

export function speedChart(timeline) {
  const samples = timeline.samples;
  if (samples.length < 2) return null;
  const width = 460;
  const height = 120;
  const top = Math.max(...samples, 1) * 1.1;
  const x = (index) => (index / (samples.length - 1)) * width;
  const y = (value) => height - (value / top) * height;
  const svg = element('svg', { viewBox: `0 0 ${width} ${height + 4}`, class: 'speed-chart', role: 'img' });
  svg.append(element('polyline', { points: samples.map((value, index) => `${x(index)},${y(value)}`).join(' '), class: 'line' }));
  const average = samples.reduce((sum, value) => sum + value, 0) / samples.length;
  svg.append(element('line', { x1: 0, x2: width, y1: y(average), y2: y(average), class: 'average' }));
  for (const time of timeline.errors) {
    const index = Math.min(Math.floor(time), samples.length - 1);
    svg.append(element('circle', { cx: x(index), cy: y(samples[index]), r: 3.5, class: 'error' }));
  }
  return svg;
}
