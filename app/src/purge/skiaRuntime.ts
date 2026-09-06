/**
 * Skia を実行時に読み込む。
 *
 * `@shopify/react-native-skia` は Expo Go に同梱されていないので、Expo Go で普通に
 * import するとアプリごと落ちる。ここで一段クッションを置き、使えない環境では
 * `null` を返して呼び出し側が代替表示へ落とせるようにする。
 *
 * この仕組みは **Expo Go で触れるようにするための一時的な措置**であって、
 * 出荷形態ではない。炎を見るには開発ビルドが要る。
 */

type SkiaModule = typeof import("@shopify/react-native-skia");

let runtime: SkiaModule | null = null;

try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const mod = require("@shopify/react-native-skia") as SkiaModule;
  // import が通っても、ネイティブ側が無ければ最初の呼び出しで落ちる。
  // ここで一度だけ触って確かめておく。
  if (typeof mod?.Skia?.Paint === "function") {
    mod.Skia.Paint();
    runtime = mod;
  }
} catch {
  runtime = null;
}

export const SkiaRuntime: SkiaModule | null = runtime;

/** 炎の描画が使えるか。false なら代替表示になる。 */
export const skiaAvailable = runtime !== null;

/** 描画中に使う。skiaAvailable が真のときだけ呼ぶこと。 */
export const requireSkia = (): SkiaModule => {
  if (!runtime) {
    throw new Error("Skia が利用できない環境で描画が呼ばれた");
  }
  return runtime;
};
