import { sessions } from './storage.js';
import { totals, streak, wordsPerMinute, accuracy, minutesOn, lastDays, DAILY_GOAL_MINUTES } from './core/statistics.js';

const NS = 'http://www.w3.org/2000/svg';
const RING_LENGTH = 289;
const all = sessions.all();
const strings = JSON.parse(document.getElementById('stats-strings').textContent);
const language = document.documentElement.lang || 'fr';
const locale = language === 'fr' ? 'fr-FR' : 'en-US';

function format(template, values) {
  return template.replace(/\{(\w+)\}/g, (match, name) => values[name] ?? match);
}

function totalDuration(seconds) {
  const minutes = Math.round(seconds / 60);
  return minutes < 60 ? `${minutes} min` : `${Math.floor(minutes / 60)} h ${String(minutes % 60).padStart(2, '0')}`;
}

function percent(value) {
  return new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: 0 }).format(value);
}

function svgElement(name, attributes) {
  const node = document.createElementNS(NS, name);
  for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, String(value));
  return node;
}

function renderGoal() {
  const done = Math.floor(minutesOn(all));
  const fraction = Math.min(done / DAILY_GOAL_MINUTES, 1);
  document.getElementById('goal-fill').setAttribute('stroke-dasharray', `${fraction * RING_LENGTH} ${RING_LENGTH}`);
  document.getElementById('goal-text').textContent = `${Math.min(done, 99)}/${DAILY_GOAL_MINUTES}`;
  document.getElementById('goal-ring').setAttribute('aria-label', format(strings.goalLabel, { done, goal: DAILY_GOAL_MINUTES }));
  document.getElementById('goal-message').textContent = done >= DAILY_GOAL_MINUTES ? strings.goalDone : format(strings.goalLeft, { minutes: DAILY_GOAL_MINUTES - done });
  const days = streak(all);
  document.getElementById('streak').textContent = days === 0 ? strings.streakNone : days === 1 ? strings.streakOne : format(strings.streakDays, { count: days });
}

function renderChart() {
  const days = lastDays(all);
  const width = 720;
  const height = 180;
  const top = Math.max(...days.map((day) => day.wpm), 10) * 1.1;
  const slot = width / days.length;
  const svg = svgElement('svg', { viewBox: `0 0 ${width} ${height}`, class: 'bars', role: 'img' });
  days.forEach((day, index) => {
    const barHeight = day.wpm ? Math.max((day.wpm / top) * height, 3) : 3;
    const bar = svgElement('rect', { x: index * slot + slot * 0.15, y: height - barHeight, width: slot * 0.7, height: barHeight, rx: 3, class: day.wpm ? '' : 'empty-day' });
    const title = svgElement('title', {});
    title.textContent = `${day.date.toLocaleDateString(locale, { day: 'numeric', month: 'short' })} · ${Math.round(day.wpm)}`;
    bar.append(title);
    svg.append(bar);
  });
  document.getElementById('day-chart').append(svg);
  document.getElementById('range-start').textContent = days[0].date.toLocaleDateString(locale, { day: 'numeric', month: 'short' });
  document.getElementById('range-end').textContent = days.at(-1).date.toLocaleDateString(locale, { day: 'numeric', month: 'short' });
}

function sessionRow(session) {
  const row = document.createElement('tr');
  const cells = [
    session.title,
    new Date(session.startedAt).toLocaleString(locale, { dateStyle: 'medium', timeStyle: 'short' }),
    totalDuration(session.activeDuration),
    String(Math.round(wordsPerMinute(session))),
    percent(accuracy(session)),
  ];
  cells.forEach((text, index) => {
    const cell = document.createElement('td');
    cell.textContent = text;
    if (index >= 3) cell.className = 'number';
    row.append(cell);
  });
  return row;
}

if (all.length === 0) {
  document.getElementById('stats-empty').hidden = false;
} else {
  const summary = totals(all);
  document.getElementById('stats-content').hidden = false;
  document.getElementById('total-time').textContent = totalDuration(summary.duration);
  document.getElementById('average-wpm').textContent = String(Math.round(summary.averageWPM));
  document.getElementById('best-wpm').textContent = String(Math.round(summary.bestWPM));
  document.getElementById('accuracy').textContent = percent(summary.accuracy);
  renderGoal();
  renderChart();
  document.getElementById('recent-sessions').append(...all.slice(0, 15).map(sessionRow));
}
