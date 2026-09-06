import { DarkTheme, NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { StatusBar } from "expo-status-bar";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { AppState, type AppStateStatus } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { SettingKeys, readBool } from "./src/db/database";
import type { RootStackParamList } from "./src/navigation";
import { ComposeScreen } from "./src/screens/ComposeScreen";
import { DetailScreen } from "./src/screens/DetailScreen";
import { EffectPickerScreen } from "./src/screens/EffectPickerScreen";
import { ListScreen } from "./src/screens/ListScreen";
import { LockScreen } from "./src/screens/LockScreen";
import { SettingsScreen } from "./src/screens/SettingsScreen";
import { C } from "./src/theme";

const Stack = createNativeStackNavigator<RootStackParamList>();

const navTheme = {
  ...DarkTheme,
  colors: { ...DarkTheme.colors, background: C.background, card: C.background, text: C.textPrimary },
};

export default function App() {
  const [lockEnabled, setLockEnabled] = useState<boolean | null>(null);
  const [unlocked, setUnlocked] = useState(false);
  const appState = useRef<AppStateStatus>(AppState.currentState);

  useEffect(() => {
    void readBool(SettingKeys.lockEnabled, false).then(setLockEnabled);
  }, []);

  // バックグラウンドへ回ったら閉じ直す。
  useEffect(() => {
    const sub = AppState.addEventListener("change", (next) => {
      if (next.match(/inactive|background/)) setUnlocked(false);
      appState.current = next;
    });
    return () => sub.remove();
  }, []);

  const onUnlocked = useCallback(() => setUnlocked(true), []);

  if (lockEnabled === null) {
    return null; // 設定を読むまでの一瞬。中身を見せない。
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StatusBar style="light" />
        {lockEnabled && !unlocked ? (
          <LockScreen onUnlocked={onUnlocked} />
        ) : (
          <NavigationContainer theme={navTheme}>
            <Stack.Navigator
              screenOptions={{
                headerShown: false,
                contentStyle: { backgroundColor: C.background },
                animation: "fade",
              }}
            >
              <Stack.Screen name="List" component={ListScreen} />
              <Stack.Screen name="Compose" component={ComposeScreen} />
              <Stack.Screen name="Detail" component={DetailScreen} />
              <Stack.Screen name="Settings" component={SettingsScreen} />
              <Stack.Screen name="EffectPicker" component={EffectPickerScreen} />
            </Stack.Navigator>
          </NavigationContainer>
        )}
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
