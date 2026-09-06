import { Ionicons } from "@expo/vector-icons";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import React, { useEffect, useRef, useState } from "react";
import {
  Alert,
  Dimensions,
  Keyboard,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { Paper } from "../components/Paper";
import { createEntry, getEntry, updateBody, type Entry } from "../db/database";
import type { RootStackParamList } from "../navigation";
import { C, F, INSETS } from "../theme";

type Props = NativeStackScreenProps<RootStackParamList, "Compose">;

/** キーボードが隠れているときの、紙の下端から画面下端までの距離。 */
const IDLE_BOTTOM_INSET = 260;
const PAPER_TOP = 116;

/**
 * S-02 入力・編集。
 *
 * 入力項目は本文だけ。分類も強度も持たない。
 *
 * 保存は「完了」で確定する。戻る操作は破棄であり、書きかけがあるときだけ確認を出す。
 * 消去の演出を伴わない静かな破棄なので、ここではダイアログでよい。
 */
export const ComposeScreen: React.FC<Props> = ({ navigation, route }) => {
  const entryId = route.params?.entryId;
  const [text, setText] = useState("");
  const [entry, setEntry] = useState<Entry | null>(null);
  const [createdAt] = useState(() => new Date());
  const keyboardHeight = useKeyboardHeight();

  /** 「完了」で抜けるときは確認を出さない。 */
  const leavingIntentionally = useRef(false);

  useEffect(() => {
    if (entryId === undefined) return;
    void (async () => {
      const e = await getEntry(entryId);
      if (e) {
        setEntry(e);
        setText(e.body);
      }
    })();
  }, [entryId]);

  const body = text.trim();
  const canSave = body.length > 0 && (entry === null || body !== entry.body);
  const dirty = entry === null ? body.length > 0 : body !== entry.body;

  // 戻る操作（ヘッダーのボタン、端末の戻る、画面端スワイプ）をまとめて捕まえる。
  useEffect(
    () =>
      navigation.addListener("beforeRemove", (e) => {
        if (!dirty || leavingIntentionally.current) return;

        e.preventDefault();
        Keyboard.dismiss();
        Alert.alert(
          entry === null ? "書いたものは残りません" : "変更は保存されません",
          entry === null
            ? "このまま戻ると、いま書いた内容は保存されません。"
            : "このまま戻ると、加えた変更は元に戻ります。",
          [
            { text: "編集を続ける", style: "cancel" },
            {
              text: "破棄する",
              style: "destructive",
              onPress: () => navigation.dispatch(e.data.action),
            },
          ],
        );
      }),
    [navigation, dirty, entry],
  );

  const finish = async () => {
    Keyboard.dismiss();
    leavingIntentionally.current = true;

    if (canSave) {
      if (entry === null) {
        await createEntry(body);
      } else {
        await updateBody(entry.id, body);
      }
    }
    navigation.goBack();
  };

  const screen = Dimensions.get("window");
  const bottomInset =
    keyboardHeight > 0 ? keyboardHeight + 16 : IDLE_BOTTOM_INSET;
  const paperHeight = Math.max(180, screen.height - PAPER_TOP - bottomInset);

  return (
    <View style={styles.root}>
      {/* 紙の外側を叩いたらキーボードを閉じる。 */}
      <Pressable
        style={StyleSheet.absoluteFill}
        onPress={Keyboard.dismiss}
        accessibilityLabel="キーボードを閉じる"
      />

      <View style={styles.bar}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={12} style={styles.iconBtn}>
          <Ionicons name="chevron-back" size={21} color={C.textTertiary} />
        </Pressable>

        <Pressable onPress={finish} hitSlop={12} style={styles.doneBtn} disabled={!canSave}>
          <Text style={[styles.doneText, !canSave && styles.doneTextDisabled]}>完了</Text>
        </Pressable>
      </View>

      <View style={[styles.paperSlot, { top: PAPER_TOP }]}>
        <Paper
          createdAt={entry ? new Date(entry.createdAt) : createdAt}
          height={paperHeight}
          value={text}
          onChangeText={setText}
          editable
          autoFocus
        />
      </View>
    </View>
  );
};

/** キーボードの高さ。出ている間だけ紙を縮めて、全文が見えるようにする。 */
const useKeyboardHeight = (): number => {
  const [height, setHeight] = useState(0);

  useEffect(() => {
    const showEvent = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";

    const show = Keyboard.addListener(showEvent, (e) => setHeight(e.endCoordinates.height));
    const hide = Keyboard.addListener(hideEvent, () => setHeight(0));

    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  return height;
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
    zIndex: 2,
  },
  iconBtn: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  doneBtn: { height: 44, paddingHorizontal: 14, justifyContent: "center" },
  doneText: { fontFamily: F.sans, fontSize: 15, color: C.textPrimary, letterSpacing: 0.8 },
  doneTextDisabled: { color: C.textGhost },
  paperSlot: {
    position: "absolute",
    left: INSETS.paperH,
    right: INSETS.paperH,
  },
});
