import { registerRootComponent } from "expo";
import type { ComponentType } from "react";
import { Platform } from "react-native";

/**
 * 入口。
 *
 * Web（PWA）では、Skia の実体である CanvasKit を wasm から読み込んでからでないと
 * 描画できない。読み込みが終わってから App を import することで、
 * src/purge/skiaRuntime.ts が「Skia は使える」と判定できる状態にしてから
 * アプリを起動する。
 *
 * ネイティブでは wasm は要らないので、そのまま起動する。
 */
if (Platform.OS === "web") {
  void (async () => {
    try {
      const { LoadSkiaWeb } = await import("@shopify/react-native-skia/lib/commonjs/web");
      await LoadSkiaWeb({
        // GitHub Pages のようにサブディレクトリで配信される場合にも当たるよう、
        // ページの位置からの相対で解決する。
        locateFile: () => new URL("canvaskit.wasm", document.baseURI).toString(),
      });
    } catch {
      // wasm が読めなくてもアプリ自体は動かす。演出は代替表示に落ちる。
    }
    const App = (await import("./App")).default;
    registerRootComponent(App);
  })();
} else {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const App = (require("./App") as { default: ComponentType }).default;
  registerRootComponent(App);
}
