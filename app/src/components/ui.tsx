import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { C, F, INSETS, mono } from "../theme";

export const AppBar: React.FC<{ title: string }> = ({ title }) => {
  const navigation = useNavigation();
  return (
    <View style={styles.bar}>
      <Pressable onPress={() => navigation.goBack()} hitSlop={12} style={styles.iconBtn}>
        <Ionicons name="chevron-back" size={21} color={C.textTertiary} />
      </Pressable>
      <Text style={styles.barTitle}>{title}</Text>
    </View>
  );
};

export const SectionLabel: React.FC<{ children: string }> = ({ children }) => (
  <Text style={[styles.sectionLabel, mono(9.5, C.textFaint, 2)]}>{children}</Text>
);

export const Group: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <View style={styles.group}>{children}</View>
);

export const RowDivider: React.FC = () => <View style={styles.divider} />;

export const SwitchRow: React.FC<{
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
}> = ({ label, value, onChange }) => (
  <Pressable onPress={() => onChange(!value)} style={styles.row}>
    <Text style={styles.rowLabel}>{label}</Text>
    <View style={[styles.track, value ? styles.trackOn : styles.trackOff]}>
      <View style={[styles.thumb, value ? styles.thumbOn : styles.thumbOff]} />
    </View>
  </Pressable>
);

export const ValueRow: React.FC<{
  label: string;
  value: string;
  valueColor?: string;
  chevron?: boolean;
  enabled?: boolean;
  height?: number;
  onPress?: () => void;
}> = ({ label, value, valueColor, chevron = false, enabled = true, height = 52, onPress }) => {
  const content = (
    <View style={[styles.row, { height, opacity: enabled ? 1 : 0.38 }]}>
      <Text style={styles.rowLabel}>{label}</Text>
      <View style={styles.rowRight}>
        <Text
          style={
            chevron
              ? { fontFamily: F.sans, fontSize: 13.5, color: valueColor ?? C.textSecondary }
              : mono(12, C.textQuaternary)
          }
        >
          {value}
        </Text>
        {chevron && <Ionicons name="chevron-forward" size={13} color={C.textFaint} />}
      </View>
    </View>
  );
  return onPress ? <Pressable onPress={onPress}>{content}</Pressable> : content;
};

const styles = StyleSheet.create({
  bar: {
    height: INSETS.appBarHeight,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
  },
  iconBtn: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  barTitle: {
    fontFamily: F.sans,
    fontSize: 16,
    fontWeight: "500",
    color: C.textPrimary,
    letterSpacing: 0.96,
    marginLeft: 4,
  },
  sectionLabel: { paddingLeft: 1, marginBottom: 11 },
  group: {
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 6,
    overflow: "hidden",
  },
  divider: { height: 1, marginHorizontal: 15, backgroundColor: C.divider },
  row: {
    height: 52,
    paddingHorizontal: 15,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  rowLabel: { fontFamily: F.sans, fontSize: 14, color: C.textSecondary },
  rowRight: { flexDirection: "row", alignItems: "center", gap: 9 },
  track: { width: 44, height: 26, borderRadius: 13, paddingHorizontal: 3, justifyContent: "center" },
  trackOn: { backgroundColor: C.switchOnTrack, alignItems: "flex-end" },
  trackOff: { backgroundColor: C.switchOffTrack, alignItems: "flex-start" },
  thumb: { width: 20, height: 20, borderRadius: 10 },
  thumbOn: { backgroundColor: C.switchOnThumb },
  thumbOff: { backgroundColor: C.switchOffThumb },
});
