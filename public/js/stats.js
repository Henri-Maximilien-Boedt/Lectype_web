import { sessions } from './storage.js';
import { totals, perDay, streak, wordsPerMinute, accuracy } from './core/statistics.js';

const NS = 'http://www.w3.org/2000/svg';
const all = sessions.all();
const language = document.documentElement.lang || 'fr';

function duration(seconds) {
  const minutes = Math.round(seconds / 60);
  return minutes < 60 ? `${minutes} min` : `${Math.floor(minutes / 60)} h ${String(minutes % 60).padStart(2, '0')}`;
}

function percent(value) {
  return new Intl.NumberFormat(language, { style: 'percent', maximumFractionDigits: 0 }).format(value);
}

function svgElement(name, attributes) {
  const node = document.createElementNS(NS, name);
  for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, String(value));
  return node;
}

function dayChart(days) {
  const shown = days.slice(-30);
  const width = 720;
  const height = 160;
  const top = Math.max(...shown.map((day) => day.wpm), 1) * 1.1;
  const slot = width / Math.max(shown.length, 14);
  const svg = svgElement('svg', { viewBox: `0 0 ${width} ${height + 20}`, class: 'bars', role: 'img' });
  shown.forEach((day, index) => {
    const barHeight = (day.wpm / top) * height;
    const bar = svgElement('rect', { x: index * slot + slot * 0.18, y: height - barHeight, width: slot * 0.64, height: barHeight, rx: 4 });
    const title = svgElement('title', {});
    title.textContent = `${new Date(day.day).toLocaleDateString(language)} · ${Math.round(day.wpm)}`;
    bar.append(title);
    svg.append(bar);
  });
  return svg;
}

function recentItem(session) {
  const item = document.createElement('li');
  const title = document.createElement('span');
  title.textContent = session.title;
  const date = document.createElement('span');
  date.className = 'muted';
  date.textContent = new Date(session.startedAt).toLocaleString(language, { dateStyle: 'medium', timeStyle: 'short' });
  const result = document.createElement('b');
  result.textContent = `${Math.round(wordsPerMinute(session))} · ${percent(accuracy(session))}`;
  item.append(title, date, result);
  return item;
}

if (all.length === 0) {
  document.getElementById('stats-empty').hidden = false;
} else {
  const summary = totals(all);
  document.getElementById('stats-content').hidden = false;
  document.getElementById('total-time').textContent = duration(summary.duration);
  document.getElementById('session-count').textContent = String(summary.count);
  document.getElementById('average-wpm').textContent = String(Math.round(summary.averageWPM));
  document.getElementById('best-wpm').textContent = String(Math.round(summary.bestWPM));
  document.getElementById('accuracy').textContent = percent(summary.accuracy);
  document.getElementById('streak').textContent = String(streak(all));
  document.getElementById('day-chart').append(dayChart(perDay(all)));
  document.getElementById('recent-sessions').append(...all.slice(0, 15).map(recentItem));
}
