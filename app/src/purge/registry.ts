import { burnEffect } from "./effects/burn";
import { PURGE_CONTRACT, type PurgeEffect } from "./types";

/**
 * 消し方の登録簿。
 *
 * **演出を1つ足す手順** ＝ `PurgeEffect` の実装を1ファイル追加し、下の配列に1行足す。
 * 削除処理・画面・設定画面・DBのいずれにも手を入れる必要はない。選択画面はこの一覧を
 * 列挙して自分で組み立てる。
 */
const ALL: PurgeEffect[] = [
  burnEffect,
  // 追加するときはここに1行足すだけでよい。
  // meltEffect,
  // tearEffect,
  // washEffect,
];

/** 既定。保存値が読めない・知らないidだったときはここへ退避する。 */
export const DEFAULT_EFFECT_ID = "burn";

/** 版が合わない演出は載せない。 */
export const availableEffects: PurgeEffect[] = ALL.filter(
  (e) => e.manifest.contract === PURGE_CONTRACT,
);

export const fallbackEffect = (): PurgeEffect => {
  const found = availableEffects.find((e) => e.manifest.id === DEFAULT_EFFECT_ID);
  if (found) return found;
  if (availableEffects.length === 0) {
    throw new Error("演出が1つも登録されていない");
  }
  return availableEffects[0];
};

/**
 * 保存されたidから演出を引く。
 *
 * 見つからない場合（演出を削除した／まだ配信していない版で開いた）は既定で動かす。
 * **保存値は書き換えない**ので、その演出が戻れば選択も戻る。
 */
export const resolveEffect = (storedId: string | null | undefined): PurgeEffect => {
  if (!storedId) return fallbackEffect();
  return availableEffects.find((e) => e.manifest.id === storedId) ?? fallbackEffect();
};
