import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import React, { useCallback, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";

import { AppBar, Group, RowDivider, SectionLabel, SwitchRow, ValueRow } from "../components/ui";
import { SettingKeys, isExpoGo, readBool, readSetting, writeBool } from "../db/database";
import type { RootStackParamList } from "../navigation";
import { resolveEffect } from "../purge/registry";
import { C, F, INSETS, mono } from "../theme";

type Props = NativeStackScreenProps<RootStackParamList, "Settings">;

export const SettingsScreen: React.FC<Props> = ({ navigation }) => {
  const [effectName, setEffectName] = useState("—");
  const [lock, setLock] = useState(false);
  const [haptics, setHaptics] = useState(true);
  const [sound, setSound] = useState(false);
  const [reduce, setReduce] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      void (async () => {
        const [id, l, h, s, r] = await Promise.all([
          readSetting(SettingKeys.effectId),
          readBool(SettingKeys.lockEnabled, false),
          readBool(SettingKeys.haptics, true),
          readBool(SettingKeys.sound, false),
          readBool(SettingKeys.reduceMotion, false),
        ]);
        if (!alive) return;
        setEffectName(resolveEffect(id).manifest.name);
        setLock(l);
        setHaptics(h);
        setSound(s);
        setReduce(r);
      })();
      return () => {
        alive = false;
      };
    }, []),
  );

  const toggle = (key: string, set: (v: boolean) => void) => (v: boolean) => {
    set(v);
    void writeBool(key, v);
  };

  return (
    <View style={styles.root}>
      <View style={{ height: INSETS.statusBarReserve }} />
      <AppBar title="設定" />

      <ScrollView contentContainerStyle={styles.body}>
        <SectionLabel>ロック</SectionLabel>
        <Group>
          <SwitchRow
            label="アプリを開くときにロック"
            value={lock}
            onChange={toggle(SettingKeys.lockEnabled, setLock)}
          />
          <RowDivider />
          <ValueRow label="ロックの方法" value="生体認証 ／ PIN" enabled={false} />
        </Group>

        <View style={styles.gap} />

        <SectionLabel>消し方</SectionLabel>
        <Group>
          <ValueRow
            label="消し方"
            value={effectName}
            valueColor={C.destructiveText}
            chevron
            height={56}
            onPress={() => navigation.navigate("EffectPicker")}
          />
          <RowDivider />
          <SwitchRow
            label="振動"
            value={haptics}
            onChange={toggle(SettingKeys.haptics, setHaptics)}
          />
          <RowDivider />
          <SwitchRow label="効果音" value={sound} onChange={toggle(SettingKeys.sound, setSound)} />
          <RowDivider />
          <SwitchRow
            label="演出を控えめにする"
            value={reduce}
            onChange={toggle(SettingKeys.reduceMotion, setReduce)}
          />
        </Group>

        <View style={styles.gap} />

        <View style={styles.note}>
          <Ionicons name="shield-outline" size={17} color="#55555C" style={styles.noteIcon} />
          <Text style={styles.noteText}>
            このアプリは通信しません。書いた内容は端末の中だけに保存され、外に出ることはありません。
          </Text>
        </View>

        {isExpoGo && (
          <View style={styles.warn}>
            <Text style={styles.warnText}>
              いまは Expo Go で動いています。この環境では保存内容が暗号化されません。配布前に開発ビルドで確認してください。
            </Text>
          </View>
        )}

        <View style={styles.gap} />

        <View style={styles.footer}>
          <Text style={styles.footerLink}>相談できる窓口</Text>
          <Text style={mono(10, C.textGhost)}>v0.1.0</Text>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.background },
  body: { paddingHorizontal: INSETS.screenH, paddingTop: 22, paddingBottom: 32 },
  gap: { height: 30 },
  note: {
    flexDirection: "row",
    borderWidth: 1,
    borderColor: "#1A1A1E",
    borderRadius: 6,
    padding: 15,
    gap: 12,
  },
  noteIcon: { marginTop: 2 },
  noteText: {
    flex: 1,
    fontFamily: F.sans,
    fontSize: 12,
    lineHeight: 22.8,
    color: C.textQuaternary,
  },
  warn: {
    marginTop: 12,
    borderWidth: 1,
    borderColor: C.destructiveBorder,
    borderRadius: 6,
    padding: 15,
  },
  warnText: {
    fontFamily: F.sans,
    fontSize: 12,
    lineHeight: 22.8,
    color: C.destructiveText,
  },
  footer: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  footerLink: { fontFamily: F.sans, fontSize: 12.5, color: C.textQuaternary },
});
