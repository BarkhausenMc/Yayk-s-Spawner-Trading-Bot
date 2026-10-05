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

db.exec(`
  CREATE TABLE IF NOT EXISTS panel_messages (
    guild_id TEXT PRIMARY KEY,
    channel_id TEXT NOT NULL,
    message_id TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS trade_counter (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    trade_number INTEGER NOT NULL
  )
`);

function getNextTradeNumber() {
  const transaction = db.transaction(() => {
    const existing = db
      .prepare('SELECT trade_number FROM trade_counter WHERE id = 1')
      .get();

    if (!existing) {
      db.prepare(`
        INSERT INTO trade_counter (id, trade_number)
        VALUES (1, 1)
      `).run();

      return 1;
    }

    const nextNumber = existing.trade_number + 1;

    db.prepare(`
      UPDATE trade_counter
      SET trade_number = ?
      WHERE id = 1
    `).run(nextNumber);

    return nextNumber;
  });

  return transaction();
}


function initDefaultSpawner(name, kauf, verkauf) {
  const stmt = db.prepare(`
    INSERT OR IGNORE INTO spawner_preise
    (spawner_name, kaufpreis, verkaufspreis)
    VALUES (?, ?, ?)
  `);

  stmt.run(name, kauf, verkauf);
}

function getAllSpawnerPreise() {
  return db
    .prepare(`
      SELECT spawner_name, kaufpreis, verkaufspreis
      FROM spawner_preise
      ORDER BY spawner_name ASC
    `)
    .all();
}

function getSpawnerPreis(spawnerName) {
  return db
    .prepare(`
      SELECT kaufpreis, verkaufspreis
      FROM spawner_preise
      WHERE spawner_name = ?
    `)
    .get(spawnerName);
}

function updateSpawnerPreis(spawnerName, kauf, verkauf) {
  return db
    .prepare(`
      UPDATE spawner_preise
      SET kaufpreis = ?,
          verkaufspreis = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE spawner_name = ?
    `)
    .run(kauf, verkauf, spawnerName);
}

function savePanelMessage(guildId, channelId, messageId) {
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO panel_messages
    (guild_id, channel_id, message_id)
    VALUES (?, ?, ?)
  `);

  stmt.run(guildId, channelId, messageId);
}

function getPanelMessage(guildId) {
  return db
    .prepare(`
      SELECT channel_id, message_id
      FROM panel_messages
      WHERE guild_id = ?
    `)
    .get(guildId);
}

function getAllSpawnerNamen() {
  return db
    .prepare(`
      SELECT spawner_name
      FROM spawner_preise
    `)
    .all()
    .map(row => row.spawner_name);
}

module.exports = {
  db,
  initDefaultSpawner,
  getAllSpawnerPreise,
  getSpawnerPreis,
  updateSpawnerPreis,
  getAllSpawnerNamen,
  savePanelMessage,
  getPanelMessage,
  getNextTradeNumber
};

