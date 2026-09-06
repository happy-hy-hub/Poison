import React from "react";
import { Platform, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import { C, F, PAPER_LINE_HEIGHT, mono } from "../theme";

/** 紙の上端から本文1行目まで。 */
export const PAPER_CONTENT_TOP = 56;
const PAD_LEFT = 30;
const PAD_RIGHT = 26;

type Props = {
  createdAt: Date;
  height: number;
  /** 閲覧時の本文。 */
  body?: string;
  /** 編集時。 */
  value?: string;
  onChangeText?: (t: string) => void;
  editable?: boolean;
  autoFocus?: boolean;
};

/**
 * 1枚の紙。閲覧と編集で同じものを使うので、見た目が飛ばない。
 *
 * 罫線の間隔と本文の行送りは必ず PAPER_LINE_HEIGHT で揃える。ずれると
 * 文字が罫線に乗らず、紙に見えなくなる。
 */
export const Paper: React.FC<Props> = ({
  createdAt,
  height,
  body,
  value,
  onChangeText,
  editable = false,
  autoFocus = false,
}) => {
  const ruleCount = Math.max(0, Math.floor((height - PAPER_CONTENT_TOP) / PAPER_LINE_HEIGHT));

  return (
    <View style={[styles.sheet, { height }]}>
      {/* 罫線 */}
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        {Array.from({ length: ruleCount }, (_, i) => (
          <View
            key={i}
            style={[styles.rule, { top: PAPER_CONTENT_TOP + (i + 1) * PAPER_LINE_HEIGHT }]}
          />
        ))}
      </View>

      <Text style={[styles.date, mono(11, C.paperMeta)]}>{formatDate(createdAt)}</Text>

      <View style={styles.content}>
        {editable ? (
          <TextInput
            value={value}
            onChangeText={onChangeText}
            multiline
            autoFocus={autoFocus}
            style={styles.ink}
            cursorColor={C.paperInk}
            selectionColor="#B9CBE8"
            keyboardAppearance="light"
            textAlignVertical="top"
            underlineColorAndroid="transparent"
          />
        ) : (
          <ScrollView showsVerticalScrollIndicator={false}>
            <Text style={styles.ink}>{body}</Text>
          </ScrollView>
        )}
      </View>
    </View>
  );
};

const formatDate = (d: Date): string => {
  const two = (v: number) => String(v).padStart(2, "0");
  return `${d.getFullYear()}.${two(d.getMonth() + 1)}.${two(d.getDate())}　${two(d.getHours())}:${two(
    d.getMinutes(),
  )}`;
};

const styles = StyleSheet.create({
  sheet: {
    width: "100%",
    backgroundColor: C.paper,
    overflow: "hidden",
    // ごくわずかに傾ける。まっすぐだと画面の一部に見え、傾けすぎると軽く見える。
    transform: [{ rotate: "-0.3deg" }],
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 26 },
        shadowOpacity: 0.72,
        shadowRadius: 26,
      },
      android: { elevation: 24 },
      default: {},
    }),
  },
  rule: {
    position: "absolute",
    left: 0,
    right: 0,
    height: StyleSheet.hairlineWidth,
    backgroundColor: C.paperRule,
  },
  date: {
    position: "absolute",
    left: PAD_LEFT,
    top: 22,
  },
  content: {
    position: "absolute",
    left: PAD_LEFT,
    right: PAD_RIGHT,
    top: PAPER_CONTENT_TOP,
    bottom: 0,
  },
  ink: {
    fontFamily: F.sans,
    fontSize: 15.5,
    lineHeight: PAPER_LINE_HEIGHT,
    color: C.paperInk,
    padding: 0,
    margin: 0,
    flex: 1,
  },
});
