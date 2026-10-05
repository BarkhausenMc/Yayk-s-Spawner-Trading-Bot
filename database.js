const Database = require('better-sqlite3');
const db = new Database('./trading.db');

db.exec(`
  CREATE TABLE IF NOT EXISTS spawner_preise (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    spawner_name TEXT UNIQUE NOT NULL,
    kaufpreis REAL NOT NULL,
    verkaufspreis REAL NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

function initDefaultSpawner(name, kauf, verkauf) {
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO spawner_preise (spawner_name, kaufpreis, verkaufspreis)
    VALUES (?, ?, ?)
  `);
  stmt.run(name, kauf, verkauf);
}

function getAllSpawnerPreise() {
  return db.prepare('SELECT spawner_name, kaufpreis, verkaufspreis FROM spawner_preise ORDER BY spawner_name ASC').all();
}

function getSpawnerPreis(spawnerName) {
  return db.prepare('SELECT kaufpreis, verkaufspreis FROM spawner_preise WHERE spawner_name = ?').get(spawnerName);
}

function updateSpawnerPreis(spawnerName, kauf, verkauf) {
  return db.prepare(`
    UPDATE spawner_preise 
    SET kaufpreis = ?, verkaufspreis = ?, updated_at = CURRENT_TIMESTAMP 
    WHERE spawner_name = ?
  `).run(kauf, verkauf, spawnerName);
}

function getAllSpawnerNamen() {
  return db.prepare('SELECT spawner_name FROM spawner_preise').all().map(row => row.spawner_name);
}

function resetDatabase() {
  db.prepare('DROP TABLE IF EXISTS spawner_preise').run();
  db.exec(`
    CREATE TABLE IF NOT EXISTS spawner_preise (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      spawner_name TEXT UNIQUE NOT NULL,
      kaufpreis REAL NOT NULL,
      verkaufspreis REAL NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
}

module.exports = {
  db,
  initDefaultSpawner,
  getAllSpawnerPreise,
  getSpawnerPreis,
  updateSpawnerPreis,
  getAllSpawnerNamen,
  resetDatabase
};