#!/usr/bin/env node
// Colorea los diagramas Mermaid de BOARD.md según la sección "✅ Done":
// - Tickets (flujo por fase): verde si están en Done.
// - Épicas y fases: verde si todos sus tickets están en Done; verde claro si alguno.
// Idempotente: borra los estilos generados antes y los vuelve a escribir.
// Uso: `pnpm board:progress` (tras cerrar y subir un ticket, ver AGENTS.md §4).
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const BOARD = fileURLToPath(new URL('../BOARD.md', import.meta.url));
const MARK = '%% progreso (generado por scripts/board-progress.mjs)';
const STYLES = [
  '  classDef done fill:#2e9e5b,stroke:#1d6b3c,color:#ffffff',
  '  classDef started fill:#c8ecd5,stroke:#2e9e5b,color:#10331f',
];

const original = readFileSync(BOARD, 'utf8');
const eol = original.includes('\r\n') ? '\r\n' : '\n';
const lines = original.split(/\r?\n/);

// Estado y épica de cada ticket a partir de las tablas.
const ticketEpic = new Map();
const done = new Set();
let section = '';
for (const line of lines) {
  if (line.startsWith('## ')) section = line;
  const row = /^\| (HOG-\d+) \|[^|]*\| (E\d\d) \|/.exec(line);
  if (!row) continue;
  ticketEpic.set(row[1], row[2]);
  if (section.includes('Done')) done.add(row[1]);
}

function progress(ids) {
  const total = ids.length;
  const count = ids.filter((id) => done.has(id)).length;
  if (total > 0 && count === total) return 'done';
  return count > 0 ? 'started' : null;
}

const epicTickets = new Map();
for (const [id, epic] of ticketEpic) {
  if (!epicTickets.has(epic)) epicTickets.set(epic, []);
  epicTickets.get(epic).push(id);
}
const epicState = (epic) => progress(epicTickets.get(epic) ?? []);

/** Estilos de un bloque mermaid a partir de sus nodos. */
function classify(block) {
  const classes = { done: [], started: [] };
  for (const line of block) {
    const ticket = /^\s+(HOG(\d+))\[/.exec(line);
    if (ticket) {
      if (done.has(`HOG-${ticket[2]}`)) classes.done.push(ticket[1]);
      continue;
    }
    const epic = /^\s+(E\d\d)\[/.exec(line);
    if (epic) {
      const state = epicState(epic[1]);
      if (state) classes[state].push(epic[1]);
      continue;
    }
    const phase = /^\s+(F\d)\["[^"]*<small>([^<]*)<\/small>/.exec(line);
    if (phase) {
      const ids = phase[2].trim().split(/\s+/).flatMap((e) => epicTickets.get(e) ?? []);
      const state = progress(ids);
      if (state) classes[state].push(phase[1]);
    }
  }
  return classes;
}

const out = [];
let block = null;
for (const line of lines) {
  if (block === null) {
    out.push(line);
    if (line.trim() === '```mermaid') block = [];
    continue;
  }
  if (line.trim() !== '```') {
    block.push(line);
    continue;
  }
  // Fin del bloque: quita lo generado antes y añade el estado actual.
  const markAt = block.indexOf(MARK);
  const body = markAt === -1 ? block : block.slice(0, markAt);
  const { done: d, started: s } = classify(body);
  out.push(...body);
  if (d.length || s.length) {
    out.push(MARK, ...STYLES);
    if (d.length) out.push(`  class ${d.join(',')} done`);
    if (s.length) out.push(`  class ${s.join(',')} started`);
  }
  out.push(line);
  block = null;
}

const result = out.join(eol);
if (result !== original) writeFileSync(BOARD, result);
console.log(`BOARD.md: ${done.size}/${ticketEpic.size} tickets en Done${result === original ? ' (sin cambios)' : ''}`);
