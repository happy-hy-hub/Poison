/**
 * Web（PWA）版の保存先。
 *
 * `expo-sqlite` の Web 実装は wasm の解決に失敗するうえ、OPFS を使う都合で
 * 特別なHTTPヘッダーが要る。GitHub Pages ではそのヘッダーを設定できないので、
 * Web では素の localStorage を使う。
 *
 * 扱う量が「書いたメモ数十件」なので、これで十分に足りる。
 * インターフェースは database.native.ts と完全に同じにしてあるので、
 * 呼び出し側は Web かネイティブかを気にしなくてよい。
 *
 * **注意**: localStorage は暗号化されない。ネイティブ版の SQLCipher に相当する
 * 保護は無い。ブラウザのサイトデータを消せば内容も消える。
 */

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

/** Web では常に false。設定画面の分岐で使う。 */
export const isExpoGo: boolean = false;

/** Web 版であること。設定画面の文言を変えるために公開する。 */
export const isWeb: boolean = true;

const ENTRIES_KEY = "ash.entries";
const PURGED_KEY = "ash.purged";
const SETTING_PREFIX = "ash.setting.";

/** プライベートブラウズなどで localStorage が使えないことがある。その場合は揮発で動かす。 */
const memory = new Map<string, string>();

const read = (key: string): string | null => {
  try {
    return globalThis.localStorage?.getItem(key) ?? memory.get(key) ?? null;
  } catch {
    return memory.get(key) ?? null;
  }
};

const write = (key: string, value: string): void => {
  memory.set(key, value);
  try {
    globalThis.localStorage?.setItem(key, value);
  } catch {
    // 保存できない環境。この起動中だけ保持する。
  }
};

const loadEntries = (): Entry[] => {
  const raw = read(ENTRIES_KEY);
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (e): e is Entry =>
        typeof e === "object" &&
        e !== null &&
        typeof (e as Entry).id === "number" &&
        typeof (e as Entry).body === "string",
    );
  } catch {
    return [];
  }
};

const saveEntries = (entries: Entry[]): void => {
  write(ENTRIES_KEY, JSON.stringify(entries));
};

type PurgeTotals = { count: number; chars: number };

const loadPurged = (): PurgeTotals => {
  const raw = read(PURGED_KEY);
  if (!raw) return { count: 0, chars: 0 };
  try {
    const parsed = JSON.parse(raw) as Partial<PurgeTotals>;
    return { count: parsed.count ?? 0, chars: parsed.chars ?? 0 };
  } catch {
    return { count: 0, chars: 0 };
  }
};

// ---------------------------------------------------------------- 読み取り

export const listEntries = async (): Promise<Entry[]> =>
  loadEntries().sort((a, b) => b.createdAt - a.createdAt);

export const getEntry = async (id: number): Promise<Entry | null> =>
  loadEntries().find((e) => e.id === id) ?? null;

export const purgedCount = async (): Promise<number> => loadPurged().count;

// ---------------------------------------------------------------- 書き込み

export const createEntry = async (body: string): Promise<number> => {
  const entries = loadEntries();
  const now = Date.now();
  const id = entries.reduce((max, e) => Math.max(max, e.id), 0) + 1;
  entries.push({ id, body, createdAt: now, updatedAt: now });
  saveEntries(entries);
  return id;
};

export const updateBody = async (id: number, body: string): Promise<void> => {
  const entries = loadEntries();
  const target = entries.find((e) => e.id === id);
  if (!target) return;
  target.body = body;
  target.updatedAt = Date.now();
  saveEntries(entries);
};

export const deleteEntry = async (id: number): Promise<void> => {
  saveEntries(loadEntries().filter((e) => e.id !== id));
};

/**
 * 消去のコミット。**演出からは絶対に呼ばない。**
 *
 * 本文は残さず、件数と文字数だけを積む。消したものが復元可能であってはならない。
 */
export const commitPurge = async (entry: Entry, _method: string): Promise<void> => {
  saveEntries(loadEntries().filter((e) => e.id !== entry.id));
  const totals = loadPurged();
  write(
    PURGED_KEY,
    JSON.stringify({
      count: totals.count + 1,
      chars: totals.chars + [...entry.body].length,
    } satisfies PurgeTotals),
  );
};

// ---------------------------------------------------------------- 設定

export const readSetting = async (key: string): Promise<string | null> =>
  read(SETTING_PREFIX + key);

export const writeSetting = async (key: string, value: string): Promise<void> => {
  write(SETTING_PREFIX + key, value);
};

export const readBool = async (key: string, orElse: boolean): Promise<boolean> => {
  const v = await readSetting(key);
  return v === null ? orElse : v === "1";
};

export const writeBool = (key: string, value: boolean): Promise<void> =>
  writeSetting(key, value ? "1" : "0");
