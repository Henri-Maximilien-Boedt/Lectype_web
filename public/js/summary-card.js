import { speedChart } from './speed-chart.js';

function element(name, className, text) {
  const node = document.createElement(name);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

export function summaryCard({ eyebrow, heading, subtitle, tiles, missed, timeline, strings, extra = [], actions }) {
  const card = element('div', 'summary-card');
  card.setAttribute('role', 'dialog');
  card.setAttribute('aria-label', heading);
  if (eyebrow) card.append(element('p', 'eyebrow', eyebrow));
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
  if (missed) {
    const row = element('p', 'missed-keys');
    if (missed.length) {
      row.append(element('span', '', strings.missed));
      for (const key of missed) row.append(element('span', 'key-chip', key === ' ' ? '␣' : key === '\n' ? '↵' : key));
    } else {
      row.append(element('span', '', strings.noMissed));
    }
    card.append(row);
  }
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

export function duration(seconds) {
  const total = Math.round(seconds);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

export function percent(value) {
  return `${Math.round(value * 100)} %`;
}
