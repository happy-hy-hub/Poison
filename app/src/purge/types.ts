import type { SkCanvas } from "@shopify/react-native-skia";
import type { ReactNode } from "react";

/** 消去のフェーズ。全演出で共通。演出側が増やしたり飛ばしたりはできない。 */
export type PurgePhase =
  | "idle"
  /** 押している。progress が 0→1 へ進む。 */
  | "charging"
  /** 溜まりきった。指を離せば実行される。 */
  | "critical"
  /** 指を離した。この間に削除がコミットされる。 */
  | "releasing"
  /** 消えたあと。 */
  | "afterglow"
  /** 臨界前に指を離した。progress が 1→0 へ戻る。 */
  | "cancelling";

/** 触覚の強さ。演出はここから選ぶだけで、振動の刻み自体はコアが持つ。 */
export type HapticProfile = "gentle" | "standard" | "heavy";

/** 紙の位置。演出はこの矩形の中に破壊を描く。 */
export type PaperGeometry = {
  x: number;
  y: number;
  width: number;
  height: number;
  /** 紙の上端から本文1行目まで。 */
  contentTop: number;
  lineHeight: number;
};

/**
 * 画面に出る言葉のうち、**演出が供給する分**。
 *
 * 待機時の動詞（「長押しで消す」）、取り消し不能の注記（「消した紙は戻せません」）、
 * 完了表示（「消えました」）はコアが持つ中立語なので、ここには含めない。
 * 消し方を切り替えても、その3つは動かない。
 */
export type PurgeCopy = {
  /** 例:「燃やしています」 */
  charging: string;
  /** 例:「離して燃やす」 */
  critical: string;
  /** 例:「指を離すと火が消えます」 */
  cancelHint: string;
};

/** ゲージと余韻の配色。ゲージの形と配置はコアが決め、色だけを演出が決める。 */
export type PurgePalette = {
  backdrop: string;
  gaugeTrack: string;
  gaugeFill: string;
  gaugeCriticalRing: string;
  buttonIdleFill: string;
  buttonIdleBorder: string;
  buttonCriticalFill: string;
  buttonCriticalBorder: string;
  iconIdle: string;
  iconCritical: string;
  label: string;
  labelCritical: string;
  hint: string;
};

/** インターフェースの版。合わない演出はレジストリから除外され、既定へ退避する。 */
export const PURGE_CONTRACT = 1;

export type PurgeEffectManifest = {
  /**
   * 永続化される識別子。**一度決めたら変更しない。**
   * 設定にはこの文字列を保存する（配列の添字は保存しない）ので、
   * 変えると既存ユーザーの選択が失われる。
   */
  id: string;
  /** 「燃やす」 */
  name: string;
  /** 一行説明。 */
  description: string;
  copy: PurgeCopy;
  palette: PurgePalette;
  haptic: HapticProfile;
  /** 選択画面のサムネイル。64x84 程度。 */
  thumbnail: () => ReactNode;
  contract: number;
};

export type PurgePaintArgs = {
  canvas: SkCanvas;
  width: number;
  height: number;
  phase: PurgePhase;
  /** フェーズ内の進捗 0〜1。 */
  progress: number;
  paper: PaperGeometry;
  /** コアが端末性能から決めた粒子数の上限。これを超えて描かない。 */
  particleBudget: number;
};

/**
 * 演出が実装する唯一の口。
 *
 * **純粋な描画のみ**を行う。DB・ファイル・通信・画面遷移には触れない。
 * 消去の実行はコアの責務であり、ここが例外を投げても削除は完了する
 * （コアが素のフェードに切り替えるだけ）。
 */
export type PurgeEffect = {
  manifest: PurgeEffectManifest;
  paint: (args: PurgePaintArgs) => void;
  /** 「演出を控えめにする」が有効なときの静止画。省略時はコアのフェード。 */
  paintReducedMotion?: (args: PurgePaintArgs) => void;
  /**
   * 解放フェーズで紙そのものを隠すか。
   * 燃やす・破るのように紙が失われる演出は true。
   */
  hidesPaperOnRelease: boolean;

  /**
   * Skia が使えない環境（Expo Go）での近似表示に使う色。
   *
   * ここが埋まっていると、コアが素の View だけで進行を示す簡易表示を組み立てる。
   * 操作・触覚・状態遷移は本番と同じものが動くので、手触りの確認には使える。
   * **出荷形態ではない。** 演出そのものは開発ビルドでしか見られない。
   */
  fallbackTint?: {
    /** 炭化した部分の色。 */
    char: string;
    /** 境界の線の色。 */
    ember: string;
    /** 解放時に一瞬かぶせる色。 */
    flash: string;
    /** 紙の高さに対して、チャージ完了時にどこまで進むか。 */
    reach: number;
  };
};

/** 全演出で共通の時間。演出側から変更できない。 */
export const TIMING = {
  /** 溜めきるまで。全記録で一律。 */
  charge: 1200,
  /** 指を離してから消え終わるまで。 */
  release: 800,
  /** 「消えました」を見せている時間。 */
  afterglow: 1200,
  /** 臨界前に離したときに巻き戻る時間。 */
  cancel: 260,
  /** 演出が描き終わらない場合にコアが打ち切るまで。 */
  releaseHardStop: 1600,
} as const;

/** 消し方によらず動かない言葉。 */
export const STRINGS = {
  idleAction: "長押しで消す",
  irreversible: "消した紙は戻せません",
  done: "消えました",
  failed: "消せませんでした。もう一度お試しください。",
} as const;
