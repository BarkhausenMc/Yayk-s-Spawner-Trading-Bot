const Database = require('better-sqlite3');

const db = new Database('./trading.db');

db.pragma('journal_mode = WAL');

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

db.exec(`
  CREATE TABLE IF NOT EXISTS trades (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    trade_number INTEGER UNIQUE NOT NULL,
    guild_id TEXT NOT NULL,
    thread_id TEXT UNIQUE NOT NULL,

    customer_id TEXT NOT NULL,
    trader_id TEXT,

    minecraft_name TEXT NOT NULL,
    spawner_name TEXT NOT NULL,

    amount INTEGER NOT NULL,
    price_per_item REAL NOT NULL,
    total_price REAL NOT NULL,

    trade_type TEXT NOT NULL,

    status TEXT NOT NULL DEFAULT 'open',

    close_requester_id TEXT,

    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
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

/* =========================================================
   TRADES
========================================================= */

function createTrade({
  tradeNumber,
  guildId,
  threadId,
  customerId,
  minecraftName,
  spawnerName,
  amount,
  pricePerItem,
  totalPrice,
  tradeType
}) {
  return db.prepare(`
    INSERT INTO trades (
      trade_number,
      guild_id,
      thread_id,
      customer_id,
      minecraft_name,
      spawner_name,
      amount,
      price_per_item,
      total_price,
      trade_type,
      status
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'open')
  `).run(
    tradeNumber,
    guildId,
    threadId,
    customerId,
    minecraftName,
    spawnerName,
    amount,
    pricePerItem,
    totalPrice,
    tradeType
  );
}

function getTradeByThreadId(threadId) {
  return db
    .prepare(`
      SELECT *
      FROM trades
      WHERE thread_id = ?
    `)
    .get(threadId);
}

function getTradeById(id) {
  return db
    .prepare(`
      SELECT *
      FROM trades
      WHERE id = ?
    `)
    .get(id);
}

function claimTrade(threadId, traderId) {
  return db.prepare(`
    UPDATE trades
    SET
      trader_id = ?,
      status = 'claimed',
      updated_at = CURRENT_TIMESTAMP
    WHERE thread_id = ?
      AND status = 'open'
  `).run(traderId, threadId);
}

function releaseTrade(threadId, traderId) {
  return db.prepare(`
    UPDATE trades
    SET
      trader_id = NULL,
      status = 'open',
      updated_at = CURRENT_TIMESTAMP
    WHERE thread_id = ?
      AND trader_id = ?
      AND status = 'claimed'
  `).run(threadId, traderId);
}

function markTradeBought(threadId, traderId) {
  return db.prepare(`
    UPDATE trades
    SET
      status = 'bought',
      updated_at = CURRENT_TIMESTAMP
    WHERE thread_id = ?
      AND trader_id = ?
      AND status = 'claimed'
  `).run(threadId, traderId);
}

function createCloseRequest(threadId, requesterId) {
  return db.prepare(`
    UPDATE trades
    SET
      close_requester_id = ?,
      status = 'close_requested',
      updated_at = CURRENT_TIMESTAMP
    WHERE thread_id = ?
      AND status IN ('open', 'claimed')
      AND close_requester_id IS NULL
  `).run(requesterId, threadId);
}

function cancelCloseRequest(threadId) {
  return db.prepare(`
    UPDATE trades
    SET
      close_requester_id = NULL,
      status = CASE
        WHEN trader_id IS NULL THEN 'open'
        ELSE 'claimed'
      END,
      updated_at = CURRENT_TIMESTAMP
    WHERE thread_id = ?
      AND status = 'close_requested'
  `).run(threadId);
}

function closeTrade(threadId) {
  return db.prepare(`
    UPDATE trades
    SET
      status = 'closed',
      updated_at = CURRENT_TIMESTAMP
    WHERE thread_id = ?
      AND status = 'close_requested'
  `).run(threadId);
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
  getNextTradeNumber,

  createTrade,
  getTradeByThreadId,
  getTradeById,

  claimTrade,
  releaseTrade,
  markTradeBought,

  createCloseRequest,
  cancelCloseRequest,
  closeTrade
};
