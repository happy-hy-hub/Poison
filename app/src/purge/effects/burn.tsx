import type { SkCanvas, SkPaint, SkPath } from "@shopify/react-native-skia";
import React from "react";
import { StyleSheet, View } from "react-native";

import { requireSkia, skiaAvailable } from "../skiaRuntime";
import type { PaperGeometry, PurgeEffect, PurgePaintArgs } from "../types";
import { PURGE_CONTRACT } from "../types";

/**
 * 既定の消し方「燃やす」。
 *
 * 紙の下端に火が入り、炭化しながら上へ広がる。指を離すと燃え落ちて灰になる。
 * 派手さではなく重さを出すため、彩度を抑えた橙で描き、代わりに煙を厚くしている。
 *
 * ここは純粋な描画だけを行う。削除には一切関与しない。
 *
 * 実装メモ: いまは JS スレッドの requestAnimationFrame から呼ばれる。実機で
 * フレーム落ちするようなら、この関数を worklet 化して UI スレッドへ移す
 * （純粋関数なので移せる作りにしてある）。
 */

const CHAR = "#13100D";
const EMBER = "#C4551E";
const EMBER_BRIGHT = "#D2601F";
const EMBER_CORE = "#F6D3A4";
const SMOKE = "#8E877F";
const SPARKS = ["#E8A868", "#D89A5A", "#F0C088"];

/** 火線が最終的に紙のどこまで上がるか（紙の高さに対する比）。 */
const CHARGE_REACH = 0.58;

/** 粒子の配置。毎フレーム乱数を引くとちらつくので、種を固定しておく。 */
type Seed = { a: number; b: number; c: number };
const SEEDS: Seed[] = (() => {
  // 決定的な擬似乱数（線形合同法）。Math.random は使わない。
  let s = 0x8e5f;
  const next = () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
  return Array.from({ length: 64 }, () => ({ a: next(), b: next(), c: next() }));
})();

const fill = (color: string): SkPaint => {
  const { Skia } = requireSkia();
  const p = Skia.Paint();
  p.setColor(Skia.Color(color));
  return p;
};

const stroke = (color: string, width: number, blur?: number): SkPaint => {
  const { Skia, PaintStyle, StrokeCap, BlurStyle } = requireSkia();
  const p = Skia.Paint();
  p.setColor(Skia.Color(color));
  p.setStyle(PaintStyle.Stroke);
  p.setStrokeWidth(width);
  p.setStrokeCap(StrokeCap.Round);
  if (blur !== undefined) {
    p.setMaskFilter(Skia.MaskFilter.MakeBlur(BlurStyle.Normal, blur, true));
  }
  return p;
};

const blurred = (color: string, sigma: number): SkPaint => {
  const { Skia, BlurStyle } = requireSkia();
  const p = fill(color);
  p.setMaskFilter(Skia.MaskFilter.MakeBlur(BlurStyle.Normal, sigma, true));
  return p;
};

const rgba = (hex: string, alpha: number): string => {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${Math.max(0, Math.min(1, alpha))})`;
};

const wave = (x: number, amp: number): number =>
  Math.sin(x * 0.055) * amp + Math.sin(x * 0.017 + 1.3) * amp * 0.7;

/** 紙の幅いっぱいに走る、揺らいだ火線。 */
const emberPath = (p: PaperGeometry, y: number, amp: number): SkPath => {
  const { Skia } = requireSkia();
  const path = Skia.Path.Make();
  path.moveTo(p.x, y + wave(0, amp));
  for (let x = 6; x <= p.width; x += 6) {
    path.lineTo(p.x + x, y + wave(x, amp));
  }
  return path;
};

// ------------------------------------------------------------------ 燃焼中

const paintBurning = (
  canvas: SkCanvas,
  width: number,
  height: number,
  p: PaperGeometry,
  t: number,
  budget: number,
  flames: boolean,
) => {
  const { Skia, TileMode, ClipOp } = requireSkia();
  const bottom = p.y + p.height;
  const lineY = bottom - t * p.height * CHARGE_REACH;
  const amp = 6 + 4 * t;

  paintBackdropGlow(canvas, width, height, p, t);

  canvas.save();
  canvas.clipRect(Skia.XYWHRect(p.x, p.y, p.width, p.height), ClipOp.Intersect, true);

  // 火線の下は炭。
  const charred = emberPath(p, lineY, amp);
  charred.lineTo(p.x + p.width, bottom);
  charred.lineTo(p.x, bottom);
  charred.close();
  canvas.drawPath(charred, fill(CHAR));

  // 火線の上は焦げていく。
  const scorchTop = Math.max(p.y, lineY - 170);
  const scorch = Skia.Paint();
  scorch.setShader(
    Skia.Shader.MakeLinearGradient(
      { x: p.x + p.width / 2, y: lineY },
      { x: p.x + p.width / 2, y: scorchTop },
      [
        Skia.Color(rgba("#34180C", 0.9)),
        Skia.Color(rgba("#34180C", 0.34)),
        Skia.Color(rgba("#34180C", 0)),
      ],
      [0, 0.34, 1],
      TileMode.Clamp,
    ),
  );
  canvas.drawRect(Skia.XYWHRect(p.x, scorchTop, p.width, lineY - scorchTop), scorch);

  if (flames) {
    paintFlames(canvas, p, lineY, amp, budget);
  }

  // 火線そのもの。太いぼかしの上に細い芯を重ねる。
  const line = emberPath(p, lineY, amp);
  canvas.drawPath(line, stroke(flames ? EMBER_BRIGHT : EMBER, flames ? 3.6 : 2.8, 5));
  canvas.drawPath(line, stroke(rgba(EMBER_CORE, flames ? 0.85 : 0.75), flames ? 1.1 : 0.9));

  canvas.restore();

  // 煙と火の粉は紙からはみ出して立ちのぼる。
  paintSmoke(canvas, p, lineY, t, budget, flames, 0);
  paintSparks(canvas, p, lineY, t, budget, 0);
};

const paintFlames = (
  canvas: SkCanvas,
  p: PaperGeometry,
  lineY: number,
  amp: number,
  budget: number,
) => {
  const { Skia } = requireSkia();
  const count = Math.min(5, Math.max(2, Math.floor(budget / 12)));
  for (let i = 0; i < count; i++) {
    const x = p.x + (p.width * (i + 0.5)) / count;
    const baseY = lineY + wave(x - p.x, amp);
    const h = 34 + SEEDS[i].a * 26;
    const tongue = Skia.Path.Make();
    tongue.moveTo(x - 9, baseY);
    tongue.quadTo(x - 7, baseY - h * 0.6, x - 1, baseY - h);
    tongue.quadTo(x + 6, baseY - h * 0.55, x + 9, baseY);
    tongue.close();
    canvas.drawPath(tongue, blurred(rgba(i % 2 === 0 ? EMBER : EMBER_BRIGHT, 0.6), 3));
  }
};

// ------------------------------------------------------------------ 解放

const paintRelease = (
  canvas: SkCanvas,
  width: number,
  height: number,
  p: PaperGeometry,
  t: number,
  budget: number,
) => {
  const { Skia, TileMode } = requireSkia();
  const originX = p.x + p.width / 2;
  const originY = p.y + p.height - p.height * 0.18;

  // 中心の火球。白飛びはさせず、深い橙で膨らませる。
  const radius = 40 + t * height * 0.62;
  const core = Skia.Paint();
  core.setShader(
    Skia.Shader.MakeRadialGradient(
      { x: originX, y: originY },
      radius,
      [
        Skia.Color(rgba("#FFE2B4", 0.95 * (1 - t * 0.35))),
        Skia.Color(rgba("#E88A34", 0.8 * (1 - t * 0.4))),
        Skia.Color(rgba(EMBER_BRIGHT, 0.5 * (1 - t * 0.5))),
        Skia.Color("rgba(0,0,0,0)"),
      ],
      [0, 0.16, 0.36, 1],
      TileMode.Clamp,
    ),
  );
  canvas.drawCircle(originX, originY, radius, core);

  // 燃えさしの紙片。
  const fragments = Math.min(10, Math.max(4, Math.floor(budget / 6)));
  for (let i = 0; i < fragments; i++) {
    const s = SEEDS[i];
    const angle = -Math.PI / 2 + (s.a - 0.5) * 1.9;
    const distance = t * (height * 0.5 + s.b * 260);
    const px = originX + Math.cos(angle) * distance;
    const py = originY + Math.sin(angle) * distance;
    const w = 14 + s.c * 16;

    canvas.save();
    canvas.translate(px, py);
    canvas.rotate(((s.a - 0.5) * 2.4 + t * (s.b - 0.5) * 5) * (180 / Math.PI), 0, 0);
    const rect = Skia.XYWHRect(-w / 2, (-w * 0.66) / 2, w, w * 0.66);
    canvas.drawRect(rect, fill("#171310"));
    canvas.drawRect(rect, stroke(rgba(EMBER, Math.max(0, 1 - t) * 0.9), 1.2));
    canvas.restore();
  }

  paintSmoke(canvas, p, p.y, 1, budget, true, t);
  paintSparks(canvas, p, originY, 1, budget, t);

  // 終わりに向けて暗く落とす。明るさの頂点はこのフェーズの前半にある。
  if (t > 0.55) {
    const k = Math.min(1, (t - 0.55) / 0.45);
    canvas.drawRect(Skia.XYWHRect(0, 0, width, height), fill(rgba("#0A0A0B", k * 0.92)));
  }
};

// ------------------------------------------------------------------ 余韻

const paintAsh = (canvas: SkCanvas, width: number, height: number, t: number, budget: number) => {
  const count = Math.min(14, Math.max(5, Math.floor(budget / 4)));
  for (let i = 0; i < count; i++) {
    const s = SEEDS[i];
    const x = s.a * width;
    const y = ((s.b + t * 0.22) % 1) * height;
    canvas.drawCircle(x, y, 0.9 + s.c * 1.2, fill(rgba(SMOKE, 0.34 * (1 - t * 0.4))));
  }
};

// ------------------------------------------------------------------ 部品

const paintBackdropGlow = (
  canvas: SkCanvas,
  width: number,
  height: number,
  p: PaperGeometry,
  t: number,
) => {
  const { Skia, TileMode } = requireSkia();
  const cx = width / 2;
  const cy = p.y + p.height;
  const radius = height * (0.42 + 0.22 * t);
  const glow = Skia.Paint();
  glow.setShader(
    Skia.Shader.MakeRadialGradient(
      { x: cx, y: cy },
      radius,
      [
        Skia.Color(rgba(EMBER, 0.3 * t)),
        Skia.Color(rgba(EMBER, 0.1 * t)),
        Skia.Color("rgba(0,0,0,0)"),
      ],
      [0, 0.4, 1],
      TileMode.Clamp,
    ),
  );
  canvas.drawCircle(cx, cy, radius, glow);
};

const paintSmoke = (
  canvas: SkCanvas,
  p: PaperGeometry,
  fromY: number,
  t: number,
  budget: number,
  heavy: boolean,
  rise: number,
) => {
  const { Skia } = requireSkia();
  const count = Math.min(heavy ? 6 : 5, Math.max(3, Math.floor(budget / 10)));
  const cx = p.x + p.width / 2;
  for (let i = 0; i < count; i++) {
    const s = SEEDS[i + 8];
    const lift = (i + 1) * 66 + rise * 220;
    const y = fromY - lift * t;
    if (y < -80) continue;
    const rx = (56 + i * 12 + s.a * 26) * (heavy ? 1.35 : 1);
    const alpha = (heavy ? 0.14 : 0.1) * (1 - i / count) * t;
    canvas.drawOval(
      Skia.XYWHRect(cx + (s.b - 0.5) * 90 - rx, y - rx * 0.575, rx * 2, rx * 1.15),
      blurred(rgba(SMOKE, alpha), 18),
    );
  }
};

const paintSparks = (
  canvas: SkCanvas,
  p: PaperGeometry,
  fromY: number,
  t: number,
  budget: number,
  rise: number,
) => {
  const count = Math.min(12, Math.max(4, Math.floor(budget / 5)));
  for (let i = 0; i < count; i++) {
    const s = SEEDS[i + 24];
    const lift = (30 + s.a * 260) * t + rise * 300;
    const y = fromY - lift;
    if (y < -20) continue;
    const x = p.x + s.b * p.width + Math.sin(lift * 0.02 + s.c * 6) * 10;
    const fade = Math.max(0, Math.min(1, 1 - lift / (p.height * 0.9)));
    canvas.drawCircle(x, y, 0.9 + s.c * 1.4, fill(rgba(SPARKS[i % SPARKS.length], 0.75 * fade)));
  }
};

// ------------------------------------------------------------------ 本体

const paint = ({
  canvas,
  width,
  height,
  phase,
  progress,
  paper,
  particleBudget,
}: PurgePaintArgs) => {
  switch (phase) {
    case "idle":
      return;
    case "charging":
    case "cancelling":
      paintBurning(canvas, width, height, paper, progress, particleBudget, false);
      return;
    case "critical":
      paintBurning(canvas, width, height, paper, 1, particleBudget, true);
      return;
    case "releasing":
      paintRelease(canvas, width, height, paper, progress, particleBudget);
      return;
    case "afterglow":
      paintAsh(canvas, width, height, progress, particleBudget);
      return;
  }
};

const paintReducedMotion = ({ canvas, width, height, phase }: PurgePaintArgs) => {
  const { Skia } = requireSkia();
  // 動きを減らす設定のときは、炎も粒子も出さず暖色のかぶりだけにする。
  const alpha =
    phase === "idle"
      ? 0
      : phase === "charging" || phase === "cancelling"
        ? 0.18
        : phase === "critical"
          ? 0.3
          : phase === "releasing"
            ? 0.42
            : 0.06;
  if (alpha === 0) return;
  canvas.drawRect(Skia.XYWHRect(0, 0, width, height), fill(rgba(EMBER, alpha)));
};

/**
 * 選択画面のサムネイル。白い紙の下端が炭化しているところ。
 * Skia が無い環境では、同じ構図を素の View で近似する。
 */
const Thumbnail: React.FC = () => {
  if (!skiaAvailable) {
    return (
      <View style={thumb.sheet}>
        <View style={[thumb.rule, { top: 15, right: 9 }]} />
        <View style={[thumb.rule, { top: 24, right: 9 }]} />
        <View style={[thumb.rule, { top: 33, right: 32 }]} />
        <View style={thumb.char} />
        <View style={thumb.ember} />
      </View>
    );
  }

  const { Canvas, Picture, createPicture, Skia } = requireSkia();
  const picture = createPicture(
    (canvas) => {
      canvas.drawRect(Skia.XYWHRect(0, 0, 64, 84), fill("#FFFFFF"));
      const rule = stroke("#D6D6D6", 1.5);
      canvas.drawLine(9, 15, 55, 15, rule);
      canvas.drawLine(9, 24, 55, 24, rule);
      canvas.drawLine(9, 33, 32, 33, rule);

      const geo: PaperGeometry = {
        x: 0,
        y: 0,
        width: 64,
        height: 84,
        contentTop: 0,
        lineHeight: 0,
      };
      const y = 84 * 0.64;
      const charred = emberPath(geo, y, 4);
      charred.lineTo(64, 84);
      charred.lineTo(0, 84);
      charred.close();
      canvas.drawPath(charred, fill(CHAR));
      canvas.drawPath(emberPath(geo, y, 4), stroke(EMBER, 2.2));
      canvas.drawCircle(64 * 0.34, y - 10, 1.2, fill("#D89A5A"));
    },
    { width: 64, height: 84 },
  );

  return (
    <Canvas style={{ width: 64, height: 84 }}>
      <Picture picture={picture} />
    </Canvas>
  );
};

const thumb = StyleSheet.create({
  sheet: { width: 64, height: 84, backgroundColor: "#FFFFFF", overflow: "hidden" },
  rule: { position: "absolute", left: 9, height: 1.5, backgroundColor: "#D6D6D6" },
  char: { position: "absolute", left: 0, right: 0, bottom: 0, height: 30, backgroundColor: CHAR },
  ember: { position: "absolute", left: 0, right: 0, bottom: 30, height: 2, backgroundColor: EMBER },
});

export const burnEffect: PurgeEffect = {
  manifest: {
    id: "burn",
    name: "燃やす",
    description: "紙の下から火が回り、離すと燃え上がって灰になる。",
    copy: {
      charging: "燃やしています",
      critical: "離して燃やす",
      cancelHint: "指を離すと火が消えます",
    },
    palette: {
      backdrop: "#070707",
      gaugeTrack: "#2A1F18",
      gaugeFill: "#C4551E",
      gaugeCriticalRing: "#E8CBAE",
      buttonIdleFill: "#17110D",
      buttonIdleBorder: "#4A3122",
      buttonCriticalFill: "#C4551E",
      buttonCriticalBorder: "#EFD0AE",
      iconIdle: "#C08055",
      iconCritical: "#FFF4E6",
      label: "#A5764F",
      labelCritical: "#F2DECB",
      hint: "#5A473A",
    },
    haptic: "standard",
    thumbnail: () => <Thumbnail />,
    contract: PURGE_CONTRACT,
  },
  paint,
  paintReducedMotion,
  hidesPaperOnRelease: true,

  /**
   * Skia が無い環境（Expo Go）用の近似。
   * 炎は描かず、炭化の高さと暖色のかぶりだけで進行を示す。
   * 操作・触覚・状態遷移は本番と同じものが動く。
   */
  fallbackTint: {
    char: CHAR,
    ember: EMBER,
    flash: "#E88A34",
    reach: CHARGE_REACH,
  },
};
