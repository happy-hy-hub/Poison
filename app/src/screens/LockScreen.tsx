import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as LocalAuthentication from "expo-local-authentication";
import * as SecureStore from "expo-secure-store";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { C, F, mono } from "../theme";

const PIN_KEY = "ash.lock.pin";
const PIN_LENGTH = 4;

/**
 * S-07 ロック解除。
 *
 * 生体認証を先に試し、使えない・失敗した場合にPINへ落とす。
 *
 * なお **PINの設定フロー自体はまだ無い**（モックにも無い）。PINが未登録の端末では
 * 生体認証のみで解除する。
 */
export const LockScreen: React.FC<{ onUnlocked: () => void }> = ({ onUnlocked }) => {
  const [entered, setEntered] = useState("");
  const storedPin = useRef<string | null>(null);

  const tryBiometrics = useCallback(async () => {
    try {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const enrolled = await LocalAuthentication.isEnrolledAsync();
      if (!hasHardware || !enrolled) return;

      const res = await LocalAuthentication.authenticateAsync({
        promptMessage: "ロックを解除します",
        disableDeviceFallback: false,
      });
      if (res.success) onUnlocked();
    } catch {
      // 生体認証が使えない端末。PINにフォールバックする。
    }
  }, [onUnlocked]);

  useEffect(() => {
    void (async () => {
      storedPin.current = await SecureStore.getItemAsync(PIN_KEY);
      await tryBiometrics();
    })();
  }, [tryBiometrics]);

  const push = (digit: string) => {
    if (entered.length >= PIN_LENGTH) return;
    const next = entered + digit;
    setEntered(next);

    if (next.length === PIN_LENGTH) {
      if (storedPin.current !== null && next === storedPin.current) {
        onUnlocked();
      } else {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        setTimeout(() => setEntered(""), 400);
      }
    }
  };

  return (
    <View style={styles.root}>
      <View style={{ height: 150 }} />
      <Text style={mono(11, C.textFaint, 4)}>ASH</Text>

      <View style={styles.dots}>
        {Array.from({ length: PIN_LENGTH }, (_, i) => (
          <View key={i} style={[styles.dot, i < entered.length ? styles.dotFilled : styles.dotEmpty]} />
        ))}
      </View>

      <View style={styles.pad}>
        {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
          <Key key={d} label={d} onPress={() => push(d)} />
        ))}
        <View style={styles.key} />
        <Key label="0" onPress={() => push("0")} />
        <Key icon onPress={() => setEntered((e) => e.slice(0, -1))} />
      </View>

      <View style={{ flex: 1 }} />

      <Pressable onPress={tryBiometrics} style={styles.bio}>
        <Ionicons name="finger-print" size={16} color={C.textTertiary} />
        <Text style={styles.bioText}>生体認証を使う</Text>
      </Pressable>
      <View style={{ height: 46 }} />
    </View>
  );
};

const Key: React.FC<{ label?: string; icon?: boolean; onPress: () => void }> = ({
  label,
  icon,
  onPress,
}) => (
  <Pressable onPress={onPress} style={styles.key}>
    {icon ? (
      <Ionicons name="backspace-outline" size={24} color={C.textQuaternary} />
    ) : (
      <Text style={[styles.keyLabel, mono(26, "#D2D2D8", 0)]}>{label}</Text>
    )}
  </Pressable>
);

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.background, alignItems: "center" },
  dots: { marginTop: 54, flexDirection: "row", gap: 18 },
  dot: { width: 11, height: 11, borderRadius: 6 },
  dotFilled: { backgroundColor: C.textSecondary },
  dotEmpty: { borderWidth: 1, borderColor: C.textGhost },
  pad: {
    marginTop: 62,
    width: 282,
    flexDirection: "row",
    flexWrap: "wrap",
    rowGap: 14,
    columnGap: 30,
  },
  key: { width: 74, height: 66, alignItems: "center", justifyContent: "center" },
  keyLabel: { textAlign: "center" },
  bio: { flexDirection: "row", alignItems: "center", gap: 9, height: 44, paddingHorizontal: 18 },
  bioText: { fontFamily: F.sans, fontSize: 13.5, color: C.textTertiary },
});
