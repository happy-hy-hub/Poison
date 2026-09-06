import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import React, { useCallback, useState } from "react";
import { Dimensions, Pressable, StyleSheet, Text, View } from "react-native";

import { PAPER_CONTENT_TOP, Paper } from "../components/Paper";
import {
  SettingKeys,
  commitPurge,
  getEntry,
  readBool,
  readSetting,
  type Entry,
} from "../db/database";
import type { RootStackParamList } from "../navigation";
import { PurgeSurface } from "../purge/PurgeSurface";
import { resolveEffect } from "../purge/registry";
import { PAPER_LINE_HEIGHT, C, F, INSETS } from "../theme";
import type { PaperGeometry, PurgeEffect } from "../purge/types";

type Props = NativeStackScreenProps<RootStackParamList, "Detail">;

/** 紙の下端から画面下端まで。ここに操作の領域が入る。 */
const BOTTOM_INSET = 182;
const PAPER_TOP = 116;

/**
 * S-03 詳細。一覧から選ぶと、1枚の紙が机の上に置かれたように出る。
 * 消去の演出はこの紙に対して起こる。
 */
export const DetailScreen: React.FC<Props> = ({ navigation, route }) => {
  const { entryId } = route.params;
  const [entry, setEntry] = useState<Entry | null>(null);
  const [effect, setEffect] = useState<PurgeEffect | null>(null);
  const [reduceMotion, setReduceMotion] = useState(false);
  const [haptics, setHaptics] = useState(true);

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      void (async () => {
        const [e, id, rm, h] = await Promise.all([
          getEntry(entryId),
          readSetting(SettingKeys.effectId),
          readBool(SettingKeys.reduceMotion, false),
          readBool(SettingKeys.haptics, true),
        ]);
        if (!alive) return;
        setEntry(e);
        setEffect(resolveEffect(id));
        setReduceMotion(rm);
        setHaptics(h);
      })();
      return () => {
        alive = false;
      };
    }, [entryId]),
  );

  const screen = Dimensions.get("window");
  const paperWidth = screen.width - INSETS.paperH * 2;
  const paperHeight = screen.height - BOTTOM_INSET - PAPER_TOP;

  const geometry: PaperGeometry = {
    x: INSETS.paperH,
    y: PAPER_TOP,
    width: paperWidth,
    height: paperHeight,
    contentTop: PAPER_CONTENT_TOP,
    lineHeight: PAPER_LINE_HEIGHT,
  };

  if (!entry) {
    return <View style={styles.root} />;
  }

  const paper = (
    <Paper createdAt={new Date(entry.createdAt)} height={paperHeight} body={entry.body} />
  );

  return (
    <View style={styles.root}>
      {/* 画面の付属物。演出が始まると背景ごと沈む。 */}
      <View style={styles.bar}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={12} style={styles.iconBtn}>
          <Ionicons name="chevron-back" size={21} color={C.textTertiary} />
        </Pressable>
        <Pressable
          onPress={() => navigation.navigate("Compose", { entryId: entry.id })}
          style={styles.editBtn}
        >
          <Text style={styles.editText}>編集</Text>
        </Pressable>
      </View>

      {effect === null ? (
        <View style={[styles.paperSlot, { width: paperWidth }]}>{paper}</View>
      ) : (
        <PurgeSurface
          geometry={geometry}
          effect={effect}
          reduceMotion={reduceMotion}
          hapticsEnabled={haptics}
          onCommit={() => commitPurge(entry, "manual")}
          onFinished={() => navigation.goBack()}
        >
          {paper}
        </PurgeSurface>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.background },
  bar: {
    position: "absolute",
    left: 0,
    right: 0,
    top: INSETS.statusBarReserve,
    height: INSETS.appBarHeight,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  iconBtn: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  editBtn: { height: 44, paddingHorizontal: 14, justifyContent: "center" },
  editText: { fontFamily: F.sans, fontSize: 14, color: C.textTertiary },
  paperSlot: { position: "absolute", left: INSETS.paperH, top: PAPER_TOP },
});
