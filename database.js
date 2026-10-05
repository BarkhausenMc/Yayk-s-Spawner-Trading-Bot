const Database = require('better-sqlite3');

const db = new Database('./trading.db');

/*
|--------------------------------------------------------------------------
| SPAWNER PREISE
|--------------------------------------------------------------------------
*/

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

/*
|--------------------------------------------------------------------------
| PANEL MESSAGES
|--------------------------------------------------------------------------
*/

db.exec(`
  CREATE TABLE IF NOT EXISTS panel_messages (
    guild_id TEXT PRIMARY KEY,
    channel_id TEXT NOT NULL,
    message_id TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

/*
|--------------------------------------------------------------------------
| TRADE COUNTER
|--------------------------------------------------------------------------
*/

db.exec(`
  CREATE TABLE IF NOT EXISTS trade_counter (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    trade_number INTEGER NOT NULL
  )
`);

/*
|--------------------------------------------------------------------------
| TRADES
|--------------------------------------------------------------------------
*/

db.exec(`
  CREATE TABLE IF NOT EXISTS trades (
    id INTEGER PRIMARY KEY AUTOINCREMENT,

    trade_number INTEGER UNIQUE NOT NULL,

    guild_id TEXT NOT NULL,
    channel_id TEXT NOT NULL,
    thread_id TEXT UNIQUE NOT NULL,
    message_id TEXT,

    customer_id TEXT NOT NULL,
    trader_id TEXT,

    type TEXT NOT NULL,

    minecraft_name TEXT NOT NULL,
    spawner_name TEXT NOT NULL,

    amount INTEGER NOT NULL,

    price_per_unit REAL NOT NULL,
    total_price REAL NOT NULL,

    claimed INTEGER NOT NULL DEFAULT 0,
    bought INTEGER NOT NULL DEFAULT 0,

    close_requested_by TEXT,

    status TEXT NOT NULL DEFAULT 'open',

    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

/*
|--------------------------------------------------------------------------
| TRADE NUMBER
|--------------------------------------------------------------------------
*/

function getNextTradeNumber() {
  const transaction = db.transaction(() => {
    const existing = db
      .prepare(`
        SELECT trade_number
        FROM trade_counter
        WHERE id = 1
      `)
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

/*
|--------------------------------------------------------------------------
| SPAWNER
|--------------------------------------------------------------------------
*/

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
      SELECT
        spawner_name,
        kaufpreis,
        verkaufspreis
      FROM spawner_preise
      ORDER BY spawner_name ASC
    `)
    .all();
}

function getSpawnerPreis(spawnerName) {
  return db
    .prepare(`
      SELECT
        kaufpreis,
        verkaufspreis
      FROM spawner_preise
      WHERE spawner_name = ?
    `)
    .get(spawnerName);
}

function updateSpawnerPreis(spawnerName, kauf, verkauf) {
  return db
    .prepare(`
      UPDATE spawner_preise
      SET
        kaufpreis = ?,
        verkaufspreis = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE spawner_name = ?
    `)
    .run(kauf, verkauf, spawnerName);
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

/*
|--------------------------------------------------------------------------
| PANEL
|--------------------------------------------------------------------------
*/

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
      SELECT
        channel_id,
        message_id
      FROM panel_messages
      WHERE guild_id = ?
    `)
    .get(guildId);
}

/*
|--------------------------------------------------------------------------
| TRADES
|--------------------------------------------------------------------------
*/

function createTrade({
  tradeNumber,
  guildId,
  channelId,
  threadId,
  customerId,
  type,
  minecraftName,
  spawnerName,
  amount,
  pricePerUnit,
  totalPrice
}) {
  const stmt = db.prepare(`
    INSERT INTO trades (
      trade_number,
      guild_id,
      channel_id,
      thread_id,
      customer_id,
      type,
      minecraft_name,
      spawner_name,
      amount,
      price_per_unit,
      total_price
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  return stmt.run(
    tradeNumber,
    guildId,
    channelId,
    threadId,
    customerId,
    type,
    minecraftName,
    spawnerName,
    amount,
    pricePerUnit,
    totalPrice
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

function getTradeByNumber(tradeNumber) {
  return db
    .prepare(`
      SELECT *
      FROM trades
      WHERE trade_number = ?
    `)
    .get(tradeNumber);
}

function setTradeMessageId(threadId, messageId) {
  db.prepare(`
    UPDATE trades
    SET
      message_id = ?,
      updated_at = CURRENT_TIMESTAMP
    WHERE thread_id = ?
  `).run(messageId, threadId);
}

function claimTrade(threadId, traderId) {
  db.prepare(`
    UPDATE trades
    SET
      claimed = 1,
      trader_id = ?,
      updated_at = CURRENT_TIMESTAMP
    WHERE thread_id = ?
  `).run(traderId, threadId);
}

function releaseTrade(threadId) {
  db.prepare(`
    UPDATE trades
    SET
      claimed = 0,
      trader_id = NULL,
      bought = 0,
      updated_at = CURRENT_TIMESTAMP
    WHERE thread_id = ?
  `).run(threadId);
}

function markTradeBought(threadId) {
  db.prepare(`
    UPDATE trades
    SET
      bought = 1,
      updated_at = CURRENT_TIMESTAMP
    WHERE thread_id = ?
  `).run(threadId);
}

function setCloseRequest(threadId, userId) {
  db.prepare(`
    UPDATE trades
    SET
      close_requested_by = ?,
      updated_at = CURRENT_TIMESTAMP
    WHERE thread_id = ?
  `).run(userId, threadId);
}

function clearCloseRequest(threadId) {
  db.prepare(`
    UPDATE trades
    SET
      close_requested_by = NULL,
      updated_at = CURRENT_TIMESTAMP
    WHERE thread_id = ?
  `).run(threadId);
}

function closeTrade(threadId) {
  db.prepare(`
    UPDATE trades
    SET
      status = 'closed',
      updated_at = CURRENT_TIMESTAMP
    WHERE thread_id = ?
  `).run(threadId);
}

function getOpenTrades() {
  return db
    .prepare(`
      SELECT *
      FROM trades
      WHERE status = 'open'
      ORDER BY created_at ASC
    `)
    .all();
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
  getTradeByNumber,
  setTradeMessageId,

  claimTrade,
  releaseTrade,
  markTradeBought,

  setCloseRequest,
  clearCloseRequest,
  closeTrade,

  getOpenTrades
};
