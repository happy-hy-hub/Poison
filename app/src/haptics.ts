import * as Haptics from "expo-haptics";
import { Platform } from "react-native";

/**
 * 触覚のラッパー。
 *
 * **Web（PWA）では触覚が一切使えない。** iOS の Safari は振動APIに対応しておらず、
 * 回避策も無い。ここで一括して無効化し、呼び出し側に分岐を書かせない。
 *
 * このアプリの「長押しで溜まる」感触は触覚に依存しているので、Web版はその点で
 * ネイティブ版に劣る。設計上の妥協であって、直せる不具合ではない。
 */
export const hapticsSupported = Platform.OS === "ios" || Platform.OS === "android";

export const ImpactStyle = Haptics.ImpactFeedbackStyle;

export const selection = (): void => {
  if (hapticsSupported) void Haptics.selectionAsync();
};

export const impact = (style: Haptics.ImpactFeedbackStyle): void => {
  if (hapticsSupported) void Haptics.impactAsync(style);
};

export const impactAwait = async (style: Haptics.ImpactFeedbackStyle): Promise<void> => {
  if (hapticsSupported) await Haptics.impactAsync(style);
};

export const error = (): void => {
  if (hapticsSupported) void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
};
