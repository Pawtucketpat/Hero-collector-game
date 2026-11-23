// dataLoader.js
// Loads the game's CSV files from the data folder into one object: GAME_DATA

const GAME_DATA = {
  effects: {},
  skills: {},
  gear: {},
  gearSets: {},
  nodes: {},
  mobs: {},
  heroes: {}
};

// Which file goes with which table, and which column holds the ID.
// "files" lists the file names to try in order (the first one that exists is used).
// "idColumn" lists the ID column headers to accept (the first one found is used).
const DATA_FILES = [
  { key: 'effects',  files: ['data/effects.csv', 'data/Effects.csv'], idColumn: ['ID'] },
  { key: 'skills',   files: ['data/skills.csv', 'data/Skills.csv'], idColumn: ['ID'] },
  { key: 'gear',     files: ['data/gear.csv', 'data/Gear.csv'], idColumn: ['ID'] },
  { key: 'gearSets', files: ['data/gear_sets.csv', 'data/gear_set.csv', 'data/Gear_Sets.csv'], idColumn: ['ID'] },
  { key: 'nodes',    files: ['data/nodes.csv', 'data/Nodes.csv'], idColumn: ['Node ID', 'ID'] },
  { key: 'mobs',     files: ['data/mobs.csv', 'data/Mobs.csv'], idColumn: ['ID'] },
  { key: 'heroes',   files: ['data/heroes.csv', 'data/heros.csv', 'data/Hero.csv', 'data/Heroes.csv'], idColumn: ['ID'] }
];

// Splits CSV text into rows, handling quoted cells that contain commas.
function parseCSV(text) {
  const rows = [];
  let row = [];
  let cell = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];

    if (inQuotes) {
      if (ch === '"' && next === '"') { cell += '"'; i++; }
      else if (ch === '"') { inQuotes = false; }
      else { cell += ch; }
    } else {
      if (ch === '"') { inQuotes = true; }
      else if (ch === ',') { row.push(cell); cell = ''; }
      else if (ch === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; }
      else if (ch === '\r') { /* ignore */ }
      else { cell += ch; }
    }
  }
  if (cell !== '' || row.length > 0) { row.push(cell); rows.push(row); }
  return rows;
}

// Turns '12' into the number 12, 'TRUE' into true, leaves other text alone.
function convertValue(value) {
  const v = value.trim();
  if (v === '') return '';
  if (v.toUpperCase() === 'TRUE') return true;
  if (v.toUpperCase() === 'FALSE') return false;
  if (!isNaN(v) && v !== '') return Number(v);
  return v;
}

// Turns CSV text into an object keyed by ID. idColumn is one header or a list of headers to try.
function csvToTable(text, idColumn) {
  const idColumns = Array.isArray(idColumn) ? idColumn : [idColumn];
  const rows = parseCSV(text);
  if (rows.length < 2) return {};

  const headers = rows[0].map(h => h.trim());
  const table = {};

  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    const obj = {};
    headers.forEach((header, c) => {
      if (header) obj[header] = convertValue(row[c] === undefined ? '' : row[c]);
    });
    let id = '';
    for (const col of idColumns) { if (obj[col] !== undefined && obj[col] !== '') { id = obj[col]; break; } }
    if (id) table[id] = obj;   // skip blank rows
  }
  return table;
}

// Call this once before the game starts. Returns a promise.
async function loadGameData() {
  for (const item of DATA_FILES) {
    let response = null;
    for (const file of item.files) {
      try { response = await fetch(file); } catch (e) { response = null; }
      if (response && response.ok) break;
      response = null;
    }
    if (!response) {
      console.error('Could not load ' + item.files.join(' or '));
      continue;
    }
    const text = await response.text();
    GAME_DATA[item.key] = csvToTable(text, item.idColumn);
    console.log('Loaded ' + item.key + ': ' + Object.keys(GAME_DATA[item.key]).length + ' rows');
  }
}
