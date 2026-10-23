'use strict';
const { DatabaseSync } = require('node:sqlite');
const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');

class MemoryStore {
  constructor(directory) {
    fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
    this.db = new DatabaseSync(path.join(directory, 'companion.sqlite'));
    this.db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;
      CREATE TABLE IF NOT EXISTS meta(key TEXT PRIMARY KEY, value TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS turns(id TEXT PRIMARY KEY, text TEXT NOT NULL, channel TEXT NOT NULL, result TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS messages(id INTEGER PRIMARY KEY, turn_id TEXT NOT NULL, role TEXT NOT NULL,
        content TEXT NOT NULL, channel TEXT NOT NULL, kind TEXT NOT NULL, epoch INTEGER NOT NULL, created_at TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS memories(id TEXT PRIMARY KEY, topic TEXT UNIQUE NOT NULL, text TEXT NOT NULL,
        kind TEXT NOT NULL, evidence TEXT NOT NULL, source_turn TEXT, channel TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);`);
    this.revision = 0;
  }
  close() { this.db.close(); }
  meta(key, fallback = '') { return this.db.prepare('SELECT value FROM meta WHERE key=?').get(key)?.value ?? fallback; }
  setMeta(key, value) { this.db.prepare('INSERT INTO meta VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').run(key, value); }
  epoch() { return Number(this.meta('epoch', '0')); }
  transaction(fn) {
    this.db.exec('BEGIN IMMEDIATE');
    try { const result = fn(); this.db.exec('COMMIT'); return result; }
    catch (error) { this.db.exec('ROLLBACK'); throw error; }
  }
  memories() { return this.db.prepare('SELECT * FROM memories ORDER BY updated_at DESC, rowid DESC').all(); }
  history(limit = 60, contextOnly = false) {
    const rows = this.db.prepare(`SELECT * FROM messages ${contextOnly ? 'WHERE epoch=?' : ''} ORDER BY id DESC LIMIT ?`);
    return (contextOnly ? rows.all(this.epoch(), limit) : rows.all(limit)).reverse();
  }
  findTurn(id) { const row = this.db.prepare('SELECT * FROM turns WHERE id=?').get(id); return row && { ...row, result: JSON.parse(row.result) }; }
  commitTurn(input, result) {
    const created = new Date().toISOString();
    this.transaction(() => {
      const insert = this.db.prepare('INSERT INTO messages(turn_id,role,content,channel,kind,epoch,created_at) VALUES(?,?,?,?,?,?,?)');
      insert.run(input.id, 'user', input.text, input.channel, input.kind, this.epoch(), created);
      if (result.reply) insert.run(input.id, 'assistant', result.reply, input.channel, input.kind, this.epoch(), created);
      for (const note of result.memories) {
        this.db.prepare(`INSERT INTO memories VALUES(?,?,?,?,?,?,?,?,?)
          ON CONFLICT(topic) DO UPDATE SET text=excluded.text, kind=excluded.kind, evidence=excluded.evidence,
          source_turn=excluded.source_turn, channel=excluded.channel, updated_at=excluded.updated_at`)
          .run(randomUUID(), note.topic, note.text, note.kind, note.evidence, input.id, input.channel, created, created);
      }
      this.db.prepare('INSERT INTO turns VALUES(?,?,?,?)').run(input.id, input.text, input.channel, JSON.stringify(result));
      this.setMeta('expression', result.expression);
      if (input.state) this.setMeta('state', JSON.stringify({ ...input.state, updatedAt: created }));
    });
  }
  reviseMemory(id, text) {
    const current = this.db.prepare('SELECT * FROM memories WHERE id=?').get(id);
    if (!current) throw new Error('这条记忆已不存在，请刷新。');
    this.transaction(() => {
      // 清除该来源并切换上下文代次，防止旧对话和进行中的整理重新带回已纠正的内容。
      if (current.source_turn) {
        this.db.prepare('DELETE FROM messages WHERE turn_id=?').run(current.source_turn);
        this.db.prepare('DELETE FROM turns WHERE id=?').run(current.source_turn);
      }
      if (text === null) this.db.prepare('DELETE FROM memories WHERE id=?').run(id);
      else this.db.prepare("UPDATE memories SET text=?,evidence='用户手动修正',source_turn=NULL,updated_at=? WHERE id=?")
        .run(text, new Date().toISOString(), id);
      this.setMeta('epoch', String(this.epoch() + 1));
    });
    this.revision++;
  }
  clearHistory() {
    this.transaction(() => { this.db.exec('DELETE FROM messages; DELETE FROM turns;'); this.setMeta('epoch', String(this.epoch() + 1)); });
    this.revision++;
  }
}

function selectMemories(text, notes) {
  const terms = new Set((text.toLowerCase().match(/[\p{L}\p{N}]{2,}/gu) || []).flatMap(word => {
    if (!/[\u4e00-\u9fff]/u.test(word)) return [word];
    return Array.from({ length: word.length - 1 }, (_, i) => word.slice(i, i + 2));
  }));
  const relevant = notes.map(note => ({ note, score: [...terms].filter(term => note.text.toLowerCase().includes(term)).length }))
    .filter(row => row.score > 0).sort((a, b) => b.score - a.score).slice(0, 12).map(row => row.note);
  return [...new Map([...relevant, ...notes.slice(0, 20)].map(note => [note.id, note])).values()]
    .map(({ topic, text: content, kind, updated_at }) => ({ topic, text: content, kind, updated_at }));
}
module.exports = { MemoryStore, selectMemories };
