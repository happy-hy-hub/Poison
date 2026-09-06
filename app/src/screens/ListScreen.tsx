import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import React, { useCallback, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";

import { listEntries, purgedCount, type Entry } from "../db/database";
import type { RootStackParamList } from "../navigation";
import { C, F, INSETS, mono } from "../theme";

type Props = NativeStackScreenProps<RootStackParamList, "List">;

/**
 * S-01 一覧。
 *
 * カードは使わない。罫線で区切るだけの静かな並びにする。記録ごとの強弱表現も持たない。
 */
export const ListScreen: React.FC<Props> = ({ navigation }) => {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [purged, setPurged] = useState(0);

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      void (async () => {
        const [e, p] = await Promise.all([listEntries(), purgedCount()]);
        if (alive) {
          setEntries(e);
          setPurged(p);
        }
      })();
      return () => {
        alive = false;
      };
    }, []),
  );

  return (
    <View style={styles.root}>
      <View style={{ height: INSETS.statusBarReserve }} />

      <View style={styles.header}>
        <Text style={mono(11, C.textQuaternary, 4)}>ASH</Text>
        <Pressable onPress={() => navigation.navigate("Settings")} hitSlop={12} style={styles.iconBtn}>
          <Ionicons name="settings-outline" size={20} color="#5A5A62" />
        </Pressable>
      </View>

      <View style={styles.counter}>
        <Text style={mono()}>
          {entries.length}件　／　これまでに {purged}件
        </Text>
      </View>

      {entries.length === 0 ? (
        <EmptyState />
      ) : (
        <FlatList
          data={entries}
          keyExtractor={(e) => String(e.id)}
          contentContainerStyle={styles.list}
          renderItem={({ item, index }) => (
            <Pressable
              onPress={() => navigation.navigate("Detail", { entryId: item.id })}
              style={[styles.row, index === entries.length - 1 && styles.rowLast]}
            >
              <Text numberOfLines={2} style={styles.rowBody}>
                {item.body}
              </Text>
              <Text style={[styles.rowMeta, mono(10, C.textFaint, 0.4)]}>
                {relative(item.createdAt)}
              </Text>
            </Pressable>
          )}
        />
      )}

      <Pressable style={styles.fab} onPress={() => navigation.navigate("Compose")}>
        <Ionicons name="add" size={21} color="#AFAFB7" />
      </Pressable>
    </View>
  );
};

const EmptyState: React.FC = () => (
  <View style={styles.empty}>
    <View style={styles.emptyRule} />
    <Text style={styles.emptyTitle}>なにも残っていません</Text>
    <Text style={styles.emptyBody}>また書きたくなったら、{"\n"}右下から追加してください。</Text>
  </View>
);

const relative = (epochMs: number): string => {
  const min = Math.floor((Date.now() - epochMs) / 60000);
  if (min < 1) return "たった今";
  if (min < 60) return `${min}分前`;
  const hours = Math.floor(min / 60);
  if (hours < 24) return `${hours}時間前`;
  const days = Math.floor(hours / 24);
  return days === 1 ? "昨日" : `${days}日前`;
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.background },
  header: {
    height: INSETS.appBarHeight,
    paddingLeft: INSETS.screenH,
    paddingRight: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  iconBtn: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  counter: { paddingHorizontal: INSETS.screenH, paddingTop: 6, paddingBottom: 12 },
  list: { paddingHorizontal: INSETS.screenH, paddingBottom: 130 },
  row: { paddingTop: 16, paddingBottom: 17, borderTopWidth: 1, borderTopColor: C.hairline },
  rowLast: { borderBottomWidth: 1, borderBottomColor: C.hairline },
  rowBody: { fontFamily: F.sans, fontSize: 14.5, lineHeight: 24.9, color: C.textSecondary },
  rowMeta: { marginTop: 9 },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", paddingBottom: 120 },
  emptyRule: { width: 28, height: 1, backgroundColor: C.outline },
  emptyTitle: {
    marginTop: 18,
    fontFamily: F.sans,
    fontSize: 15,
    color: C.textTertiary,
    letterSpacing: 0.6,
  },
  emptyBody: {
    marginTop: 18,
    fontFamily: F.sans,
    fontSize: 12.5,
    lineHeight: 23.75,
    color: C.textFaint,
    textAlign: "center",
  },
  fab: {
    position: "absolute",
    right: INSETS.screenH,
    bottom: 30,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: C.surfaceRaised,
    borderWidth: 1,
    borderColor: C.outline,
    alignItems: "center",
    justifyContent: "center",
  },
});
