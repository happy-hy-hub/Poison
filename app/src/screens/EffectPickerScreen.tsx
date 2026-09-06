import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import React, { useCallback, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { AppBar } from "../components/ui";
import { SettingKeys, readSetting, writeSetting } from "../db/database";
import type { RootStackParamList } from "../navigation";
import { DEFAULT_EFFECT_ID, availableEffects, resolveEffect } from "../purge/registry";
import { C, F, INSETS, mono } from "../theme";

type Props = NativeStackScreenProps<RootStackParamList, "EffectPicker">;

/**
 * S-06 消し方の選択。
 *
 * 一覧はレジストリを列挙して組み立てる。演出を足してもこの画面は書き換えない。
 */
export const EffectPickerScreen: React.FC<Props> = () => {
  const [currentId, setCurrentId] = useState<string>(DEFAULT_EFFECT_ID);

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      void (async () => {
        const id = await readSetting(SettingKeys.effectId);
        if (alive) setCurrentId(resolveEffect(id).manifest.id);
      })();
      return () => {
        alive = false;
      };
    }, []),
  );

  const choose = (id: string) => {
    setCurrentId(id);
    void writeSetting(SettingKeys.effectId, id);
  };

  return (
    <View style={styles.root}>
      <View style={{ height: INSETS.statusBarReserve }} />
      <AppBar title="消し方" />

      <ScrollView contentContainerStyle={styles.body}>
        {availableEffects.map((effect) => {
          const m = effect.manifest;
          const selected = m.id === currentId;
          return (
            <Pressable
              key={m.id}
              onPress={() => choose(m.id)}
              style={[styles.tile, selected && styles.tileSelected]}
            >
              {m.thumbnail()}
              <View style={styles.tileText}>
                <View style={styles.tileTitleRow}>
                  <Text style={[styles.tileName, selected && styles.tileNameSelected]}>
                    {m.name}
                  </Text>
                  {m.id === DEFAULT_EFFECT_ID && (
                    <View style={styles.badge}>
                      <Text style={mono(9, "#8A6242")}>既定</Text>
                    </View>
                  )}
                </View>
                <Text style={[styles.tileDesc, selected && styles.tileDescSelected]}>
                  {m.description}
                </Text>
              </View>
              {selected && <Ionicons name="checkmark" size={19} color={C.destructiveText} />}
            </Pressable>
          );
        })}
      </ScrollView>

      <View style={styles.footer}>
        <Text style={styles.footerText}>
          消し方が変わっても、消える結果は同じです。長押しで溜めて、指を離すと消える操作も共通です。
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.background },
  body: { paddingHorizontal: INSETS.screenH, paddingTop: 22, gap: 10 },
  tile: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    padding: 13,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.surface,
  },
  tileSelected: { backgroundColor: "#121012", borderColor: C.destructiveBorder },
  tileText: { flex: 1, gap: 6 },
  tileTitleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  tileName: { fontFamily: F.sans, fontSize: 15, fontWeight: "500", color: C.textSecondary },
  tileNameSelected: { color: "#E0C6AE" },
  tileDesc: { fontFamily: F.sans, fontSize: 12, lineHeight: 21, color: "#62626A" },
  tileDescSelected: { color: "#7A6754" },
  badge: {
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: C.destructiveBorder,
    borderRadius: 3,
  },
  footer: { paddingHorizontal: 22, paddingTop: 22, paddingBottom: 34 },
  footerText: { fontFamily: F.sans, fontSize: 11.5, lineHeight: 21.85, color: "#4E4E56" },
});
