import Constants, { ExecutionEnvironment } from "expo-constants";
import * as SecureStore from "expo-secure-store";
import * as SQLite from "expo-sqlite";

export type Entry = {
  id: number;
  body: string;
  createdAt: number;
  updatedAt: number;
};

export const SettingKeys = {
  effectId: "effect_id",
  lockEnabled: "lock_enabled",
  haptics: "haptics_enabled",
  sound: "sound_enabled",
  reduceMotion: "reduce_motion",
} as const;

const DB_NAME = "ash.db";
const KEY_ALIAS = "ash.db.key";

/**
 * Expo Go では SQLCipher が使えない（ネイティブモジュールが同梱されていない）。
 * 開発ビルドでのみ暗号化を有効にする。
 *
 * **配布前に必ず開発ビルド／本番ビルドで動かすこと。** Expo Go のまま出荷すると
 * 平文のまま端末に残り、要件（6.1 プライバシー）を満たさない。
 */
export const isExpoGo =
  Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

/** Web 版であること。database.web.ts と対になる。 */
export const isWeb: boolean = false;

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

const obtainKey = async (): Promise<string> => {
  const existing = await SecureStore.getItemAsync(KEY_ALIAS);
  if (existing) return existing;

  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  const generated = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  await SecureStore.setItemAsync(KEY_ALIAS, generated);
  return generated;
};

export const getDb = (): Promise<SQLite.SQLiteDatabase> => {
  dbPromise ??= (async () => {
    const db = await SQLite.openDatabaseAsync(DB_NAME);

    if (!isExpoGo) {
      const key = await obtainKey();
      // 鍵の適用は他のいかなる文よりも先に行う必要がある。
      await db.execAsync(`PRAGMA key = '${key.replace(/'/g, "''")}'`);
    }

    await db.execAsync(`
      PRAGMA journal_mode = WAL;
      CREATE TABLE IF NOT EXISTS entries (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        body TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_entries_created ON entries (created_at DESC);
      CREATE TABLE IF NOT EXISTS purge_stats (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        purged_at INTEGER NOT NULL,
        char_count INTEGER NOT NULL,
        method TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
    `);

    return db;
  })();

  return dbPromise;
};

type Row = { id: number; body: string; created_at: number; updated_at: number };

const toEntry = (r: Row): Entry => ({
  id: r.id,
  body: r.body,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

// ---------------------------------------------------------------- 読み取り

export const listEntries = async (): Promise<Entry[]> => {
  const db = await getDb();
  const rows = await db.getAllAsync<Row>("SELECT * FROM entries ORDER BY created_at DESC");
  return rows.map(toEntry);
};

export const getEntry = async (id: number): Promise<Entry | null> => {
  const db = await getDb();
  const row = await db.getFirstAsync<Row>("SELECT * FROM entries WHERE id = ?", id);
  return row ? toEntry(row) : null;
};

export const purgedCount = async (): Promise<number> => {
  const db = await getDb();
  const row = await db.getFirstAsync<{ n: number }>("SELECT count(*) AS n FROM purge_stats");
  return row?.n ?? 0;
};

// ---------------------------------------------------------------- 書き込み

export const createEntry = async (body: string): Promise<number> => {
  const db = await getDb();
  const now = Date.now();
  const res = await db.runAsync(
    "INSERT INTO entries (body, created_at, updated_at) VALUES (?, ?, ?)",
    body,
    now,
    now,
  );
  return res.lastInsertRowId;
};

export const updateBody = async (id: number, body: string): Promise<void> => {
  const db = await getDb();
  await db.runAsync("UPDATE entries SET body = ?, updated_at = ? WHERE id = ?", body, Date.now(), id);
};

export const deleteEntry = async (id: number): Promise<void> => {
  const db = await getDb();
  await db.runAsync("DELETE FROM entries WHERE id = ?", id);
};

/**
 * 消去のコミット。**演出からは絶対に呼ばない。**
 *
 * 物理削除と実績の記録を1トランザクションにまとめる。演出の途中でアプリが落ちても、
 * 「削除済み」か「未実行」のどちらかにしかならない。
 *
 * 本文は purge_stats に残さない。消したものが復元可能であってはならない。
 */
export const commitPurge = async (entry: Entry, method: string): Promise<void> => {
  const db = await getDb();
  await db.withTransactionAsync(async () => {
    await db.runAsync("DELETE FROM entries WHERE id = ?", entry.id);
    await db.runAsync(
      "INSERT INTO purge_stats (purged_at, char_count, method) VALUES (?, ?, ?)",
      Date.now(),
      [...entry.body].length,
      method,
    );
  });
};

// ---------------------------------------------------------------- 設定

export const readSetting = async (key: string): Promise<string | null> => {
  const db = await getDb();
  const row = await db.getFirstAsync<{ value: string }>(
    "SELECT value FROM settings WHERE key = ?",
    key,
  );
  return row?.value ?? null;
};

export const writeSetting = async (key: string, value: string): Promise<void> => {
  const db = await getDb();
  await db.runAsync(
    "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
    key,
    value,
  );
};

export const readBool = async (key: string, orElse: boolean): Promise<boolean> => {
  const v = await readSetting(key);
  return v === null ? orElse : v === "1";
};

export const writeBool = (key: string, value: boolean): Promise<void> =>
  writeSetting(key, value ? "1" : "0");
