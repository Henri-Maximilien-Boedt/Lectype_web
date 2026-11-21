import { speedChart } from './speed-chart.js';

function element(name, className, text) {
  const node = document.createElement(name);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

export function summaryCard({ heading, subtitle, tiles, missed, timeline, strings, extra = [], actions }) {
  const card = element('div', 'summary-card');
  card.append(element('h2', '', heading));
  if (subtitle) card.append(element('p', 'muted', subtitle));
  const stats = element('div', 'stats');
  for (const [value, label] of tiles) {
    const tile = element('div');
    tile.append(element('b', '', value), element('span', '', label));
    stats.append(tile);
  }
  card.append(stats);
  const chart = timeline ? speedChart(timeline) : null;
  if (chart) card.append(chart);
  if (missed) card.append(element('p', '', missed.length ? `${strings.missed} : ${missed.join('  ')}` : strings.noMissed));
  card.append(...extra);
  const buttons = element('p', 'actions');
  for (const action of actions) {
    const button = element('button', action.primary ? 'button primary' : 'button', action.label);
    button.type = 'button';
    button.addEventListener('click', action.run);
    buttons.append(button);
  }
  card.append(buttons);
  return card;
}

export function percent(value) {
  return `${Math.round(value * 100)} %`;
}
