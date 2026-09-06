import { Platform } from "react-native";

/**
 * モックから写した配色。ここ以外に色を直書きしない。
 *
 * 日常画面は中性のダークグレーで統一する。暖色が出るのは消去演出のときだけで、
 * その配色は演出側（PurgePalette）が持つ。
 */
export const C = {
  // 面
  background: "#0A0A0B",
  surface: "#111113",
  surfaceRaised: "#16161A",

  // 線
  border: "#1D1D22",
  hairline: "#17171C",
  divider: "#18181C",
  outline: "#2C2C34",

  // 文字（明るい順）
  textPrimary: "#E8E8EA",
  textSecondary: "#C6C6CC",
  textTertiary: "#8A8A92",
  textQuaternary: "#6E6E76",
  textFaint: "#45454C",
  textGhost: "#33333A",

  // 紙
  paper: "#FFFFFF",
  paperInk: "#1C1C1E",
  paperMeta: "#A6A6AA",
  paperRule: "rgba(0,0,0,0.055)",

  // 破壊的操作（既定演出の色味に寄せた抑えめの暖色）
  destructiveText: "#C08055",
  destructiveIcon: "#B4653A",
  destructiveBorder: "#3A2A20",

  // トグル
  switchOnTrack: "#6E6E78",
  switchOnThumb: "#F0F0F2",
  switchOffTrack: "#24242A",
  switchOffThumb: "#55555C",
} as const;

/**
 * 書体。いまは端末の既定に任せている。
 * モックと同じ書体にするなら expo-font で Zen Kaku Gothic New / IBM Plex Mono を
 * 同梱し、ここのファミリ名を差し替える。Google Fonts の動的読み込みは
 * 「通信しない」要件に反するので使わない。
 */
export const F = {
  sans: undefined as string | undefined,
  mono: Platform.select({ ios: "Menlo", android: "monospace", default: "monospace" }),
} as const;

/** 紙面の行送り。罫線の間隔と本文の行の高さは必ず同じ値を使う。 */
export const PAPER_LINE_HEIGHT = 34;

export const INSETS = {
  screenH: 20,
  paperH: 22,
  /** ステータスバーぶんの余白。実機では SafeArea と併用する。 */
  statusBarReserve: 54,
  appBarHeight: 44,
} as const;

/** 日時・件数・補助文言に使う等幅の指定。 */
export const mono = (size = 10, color: string = C.textFaint, letterSpacing = 0.8) => ({
  fontFamily: F.mono,
  fontSize: size,
  color,
  letterSpacing,
});
