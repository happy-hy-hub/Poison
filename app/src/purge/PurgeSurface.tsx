import { Ionicons } from "@expo/vector-icons";
import { ImpactStyle, impact, impactAwait, selection } from "../haptics";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";

import { C, F, INSETS, mono } from "../theme";
import { requireSkia, skiaAvailable } from "./skiaRuntime";
import {
  STRINGS,
  TIMING,
  type PaperGeometry,
  type PurgeEffect,
  type PurgePalette,
  type PurgePhase,
} from "./types";

type Props = {
  geometry: PaperGeometry;
  effect: PurgeEffect;
  /** 削除の実行。ここが成功して初めて演出を進める。 */
  onCommit: () => Promise<void>;
  /** 余韻まで終わったあと。通常は一覧へ戻る。 */
  onFinished: () => void;
  /** 紙そのもの。 */
  children: React.ReactNode;
  reduceMotion?: boolean;
  hapticsEnabled?: boolean;
  particleBudget?: number;
};

/**
 * 消去の骨格。
 *
 * 長押し→チャージ→臨界→解放／キャンセルの状態遷移、所要時間、ゲージ、触覚、
 * そして**削除のコミット**を持つ。演出はこの上に絵を描くだけで、ここには関与しない。
 *
 * 削除確認ダイアログは置かない。長押しで溜めること自体が確認であり、臨界前に指を離せば
 * 何も起きない。
 */
export const PurgeSurface: React.FC<Props> = ({
  geometry,
  effect,
  onCommit,
  onFinished,
  children,
  reduceMotion = false,
  hapticsEnabled = true,
  particleBudget = 48,
}) => {
  const [phase, setPhase] = useState<PurgePhase>("idle");
  const [progress, setProgress] = useState(0);
  const [size, setSize] = useState({ width: 0, height: 0 });

  const progressRef = useRef(0);
  const hapticTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hardStop = useRef<ReturnType<typeof setTimeout> | null>(null);
  const committing = useRef(false);

  progressRef.current = progress;

  const clearHaptics = useCallback(() => {
    if (hapticTimer.current) {
      clearTimeout(hapticTimer.current);
      hapticTimer.current = null;
    }
  }, []);

  useEffect(
    () => () => {
      clearHaptics();
      if (hardStop.current) clearTimeout(hardStop.current);
    },
    [clearHaptics],
  );

  // ---------------------------------------------------------------- 進行

  useEffect(() => {
    if (phase === "idle" || phase === "critical") return;

    const duration =
      phase === "charging"
        ? TIMING.charge
        : phase === "releasing"
          ? TIMING.release
          : phase === "afterglow"
            ? TIMING.afterglow
            : TIMING.cancel;

    const from = progressRef.current;
    const to = phase === "cancelling" ? 0 : 1;
    const start = Date.now();
    let raf = 0;

    const tick = () => {
      const k = Math.min(1, (Date.now() - start) / duration);
      setProgress(from + (to - from) * k);
      if (k < 1) {
        raf = requestAnimationFrame(tick);
        return;
      }
      if (phase === "charging") enterCritical();
      else if (phase === "cancelling") setPhase("idle");
      else if (phase === "releasing") enterAfterglow();
      else if (phase === "afterglow") onFinished();
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  // ---------------------------------------------------------------- 遷移

  const enterCritical = () => {
    clearHaptics();
    if (hapticsEnabled && !reduceMotion) {
      impact(ImpactStyle.Heavy);
    }
    setPhase("critical");
  };

  const enterAfterglow = () => {
    if (hardStop.current) {
      clearTimeout(hardStop.current);
      hardStop.current = null;
    }
    setProgress(0);
    setPhase("afterglow");
  };

  const onPressIn = () => {
    if (phase !== "idle") return;
    setProgress(0);
    setPhase("charging");
    scheduleHaptics();
  };

  const onPressOut = () => {
    if (phase === "charging") {
      clearHaptics();
      setPhase("cancelling");
    } else if (phase === "critical") {
      void execute();
    }
  };

  /**
   * 実行。**削除が先、演出はそのあと。**
   *
   * 描画が失敗しても削除は成立しているべきなので、順序を逆にしない。
   */
  const execute = async () => {
    if (committing.current) return;
    committing.current = true;

    try {
      await onCommit();
    } catch {
      committing.current = false;
      setPhase("idle");
      setProgress(0);
      Alert.alert(STRINGS.failed);
      return;
    }

    setProgress(0);
    setPhase("releasing");

    if (hapticsEnabled && !reduceMotion) {
      void releaseHaptics();
    }

    // 演出が描き終わらない場合に備えて、コア側で打ち切る。
    hardStop.current = setTimeout(() => {
      setPhase((p) => (p === "releasing" ? "afterglow" : p));
    }, TIMING.releaseHardStop);
  };

  // ---------------------------------------------------------------- 触覚

  /**
   * 押している時間に比例して間隔を詰める。演出は強度プロファイルを選ぶだけで、
   * この刻み自体には触れない。
   *
   * 注意: iOS は短間隔の連続 impact をシステム側で間引く。狙った「だんだん強くなる」
   * 感触にならない場合は、Core Haptics を使うネイティブモジュールが必要になる。
   */
  const scheduleHaptics = () => {
    if (!hapticsEnabled || reduceMotion) return;

    const tick = () => {
      const t = progressRef.current;
      const profile = effect.manifest.haptic;
      if (profile === "gentle") {
        selection();
      } else if (profile === "standard") {
        if (t > 0.6) impact(ImpactStyle.Light);
        else selection();
      } else {
        impact(t > 0.4 ? ImpactStyle.Medium : ImpactStyle.Light);
      }
      const interval = Math.max(24, Math.min(90, Math.round(90 - 66 * t)));
      hapticTimer.current = setTimeout(tick, interval);
    };

    tick();
  };

  const releaseHaptics = async () => {
    for (let i = 0; i < 3; i++) {
      await impactAwait(ImpactStyle.Heavy);
      await new Promise((r) => setTimeout(r, 70));
    }
  };

  // ---------------------------------------------------------------- 描画

  const dim = phase === "idle" ? 0 : phase === "charging" || phase === "cancelling" ? progress : 1;
  const paperVisible = !(
    phase === "afterglow" ||
    (phase === "releasing" && effect.hidesPaperOnRelease)
  );
  const palette = effect.manifest.palette;
  const pressed = phase !== "idle";
  const critical = phase === "critical";
  const swap = Math.max(0, Math.min(1, progress * 4));

  return (
    <View
      style={StyleSheet.absoluteFill}
      onLayout={(e) => {
        const { width, height } = e.nativeEvent.layout;
        setSize((s) => (s.width === width && s.height === height ? s : { width, height }));
      }}
    >
      {/* 背景を沈める。画面の他の要素はこの下にあるので一緒に暗くなる。 */}
      <View
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, { backgroundColor: palette.backdrop, opacity: dim * 0.94 }]}
      />

      {paperVisible && (
        <View
          style={{
            position: "absolute",
            left: geometry.x,
            top: geometry.y,
            width: geometry.width,
          }}
        >
          {children}
        </View>
      )}

      <EffectLayer
        effect={effect}
        phase={phase}
        progress={progress}
        geometry={geometry}
        size={size}
        reduceMotion={reduceMotion}
        particleBudget={particleBudget}
      />

      {phase === "afterglow" ? (
        <View pointerEvents="none" style={styles.afterglow}>
          <Text style={styles.doneText}>{STRINGS.done}</Text>
          <View style={styles.doneRule} />
        </View>
      ) : (
        (phase === "charging" || critical) && (
          <View pointerEvents="none" style={[styles.label, { top: critical ? 60 : 68 }]}>
            {critical ? (
              <Text style={[styles.criticalText, { color: palette.labelCritical }]}>
                {effect.manifest.copy.critical}
              </Text>
            ) : (
              <Text style={mono(10.5, palette.label, 2.7)}>{effect.manifest.copy.charging}</Text>
            )}
          </View>
        )
      )}

      {phase !== "afterglow" && phase !== "releasing" && (
        <Pressable onPressIn={onPressIn} onPressOut={onPressOut} style={styles.trigger}>
          {/* 待機時は横長のボタン、押している間はゲージつきの丸へ入れ替わる */}
          <View style={[styles.pill, { opacity: 1 - swap }]}>
            <Ionicons name="flame-outline" size={17} color={C.destructiveIcon} />
            <Text style={styles.pillText}>{STRINGS.idleAction}</Text>
          </View>

          <View style={[styles.gaugeWrap, { opacity: swap }]}>
            <Gauge progress={progress} critical={critical} palette={palette} />
          </View>

          <Text
            style={[
              styles.hint,
              mono(10, pressed ? palette.hint : C.textGhost, 0.4),
              { opacity: pressed ? swap : 1 },
            ]}
          >
            {pressed ? effect.manifest.copy.cancelHint : STRINGS.irreversible}
          </Text>
        </Pressable>
      )}
    </View>
  );
};

// ------------------------------------------------------------------ 演出の層

type LayerProps = {
  effect: PurgeEffect;
  phase: PurgePhase;
  progress: number;
  geometry: PaperGeometry;
  size: { width: number; height: number };
  reduceMotion: boolean;
  particleBudget: number;
};

/** Skia があれば本物を、無ければ近似を描く。 */
const EffectLayer: React.FC<LayerProps> = (props) =>
  skiaAvailable ? <SkiaLayer {...props} /> : <FallbackLayer {...props} />;

const SkiaLayer: React.FC<LayerProps> = ({
  effect,
  phase,
  progress,
  geometry,
  size,
  reduceMotion,
  particleBudget,
}) => {
  const { Canvas, Picture, createPicture, Skia } = requireSkia();

  const picture = useMemo(() => {
    if (size.width === 0 || phase === "idle") return null;
    return createPicture(
      (canvas) => {
        const args = {
          canvas,
          width: size.width,
          height: size.height,
          phase,
          progress: Math.max(0, Math.min(1, progress)),
          paper: geometry,
          particleBudget,
        };
        try {
          if (reduceMotion && effect.paintReducedMotion) {
            effect.paintReducedMotion(args);
          } else {
            effect.paint(args);
          }
        } catch {
          // 演出が壊れても消去は止めない。素のフェードに落とす。
          const p = Skia.Paint();
          p.setColor(Skia.Color(`rgba(10,10,11,${Math.min(1, progress) * 0.6})`));
          canvas.drawRect(Skia.XYWHRect(0, 0, size.width, size.height), p);
        }
      },
      { width: size.width, height: size.height },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, progress, size.width, size.height, effect, reduceMotion, particleBudget]);

  if (!picture) return null;

  return (
    <Canvas style={StyleSheet.absoluteFill} pointerEvents="none">
      <Picture picture={picture} />
    </Canvas>
  );
};

/**
 * Skia が使えない環境（Expo Go）での近似。
 *
 * 炎は描かない。炭化の高さと暖色のかぶりだけで進行を示す。
 * **操作・触覚・状態遷移は本番と同じものが動く**ので、手触りの確認には使える。
 */
const FallbackLayer: React.FC<LayerProps> = ({ effect, phase, progress, geometry }) => {
  const tint = effect.fallbackTint;
  if (!tint || phase === "idle" || phase === "afterglow") return null;

  const t = Math.max(0, Math.min(1, progress));

  if (phase === "releasing") {
    return (
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        <View
          style={[
            StyleSheet.absoluteFill,
            { backgroundColor: tint.flash, opacity: Math.max(0, 0.55 * (1 - t)) },
          ]}
        />
        <View
          style={[StyleSheet.absoluteFill, { backgroundColor: C.background, opacity: t * 0.95 }]}
        />
      </View>
    );
  }

  const charHeight = geometry.height * tint.reach * (phase === "critical" ? 1 : t);

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <View
        style={[
          StyleSheet.absoluteFill,
          { backgroundColor: tint.ember, opacity: 0.07 * (phase === "critical" ? 1 : t) },
        ]}
      />
      <View
        style={{
          position: "absolute",
          left: geometry.x,
          top: geometry.y + geometry.height - charHeight,
          width: geometry.width,
          height: charHeight,
          backgroundColor: tint.char,
        }}
      />
      <View
        style={{
          position: "absolute",
          left: geometry.x,
          top: geometry.y + geometry.height - charHeight - 2,
          width: geometry.width,
          height: 2,
          backgroundColor: tint.ember,
        }}
      />
    </View>
  );
};

// ------------------------------------------------------------------ ゲージ

const GAUGE = 112;
const RADIUS = 50;

const Gauge: React.FC<{ progress: number; critical: boolean; palette: PurgePalette }> = (props) => (
  <View style={styles.gauge}>
    {skiaAvailable ? <SkiaRing {...props} /> : <BarRing {...props} />}
    <View
      style={[
        styles.gaugeButton,
        {
          backgroundColor: props.critical
            ? props.palette.buttonCriticalFill
            : props.palette.buttonIdleFill,
          borderColor: props.critical
            ? props.palette.buttonCriticalBorder
            : props.palette.buttonIdleBorder,
        },
      ]}
    >
      <Ionicons
        name="flame-outline"
        size={props.critical ? 26 : 24}
        color={props.critical ? props.palette.iconCritical : props.palette.iconIdle}
      />
    </View>
  </View>
);

const SkiaRing: React.FC<{ progress: number; critical: boolean; palette: PurgePalette }> = ({
  progress,
  critical,
  palette,
}) => {
  const { Canvas, Picture, createPicture, Skia, PaintStyle, StrokeCap } = requireSkia();

  const picture = useMemo(
    () =>
      createPicture(
        (canvas) => {
          const c = GAUGE / 2;

          if (!critical) {
            const track = Skia.Paint();
            track.setColor(Skia.Color(palette.gaugeTrack));
            track.setStyle(PaintStyle.Stroke);
            track.setStrokeWidth(2.4);
            canvas.drawCircle(c, c, RADIUS, track);
          }

          const arc = Skia.Paint();
          arc.setColor(Skia.Color(critical ? palette.gaugeCriticalRing : palette.gaugeFill));
          arc.setStyle(PaintStyle.Stroke);
          arc.setStrokeWidth(critical ? 2.8 : 2.4);
          arc.setStrokeCap(StrokeCap.Round);

          const path = Skia.Path.Make();
          path.addArc(
            Skia.XYWHRect(c - RADIUS, c - RADIUS, RADIUS * 2, RADIUS * 2),
            -90,
            360 * (critical ? 1 : Math.max(0, Math.min(1, progress))),
          );
          canvas.drawPath(path, arc);
        },
        { width: GAUGE, height: GAUGE },
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [progress, critical, palette],
  );

  return (
    <Canvas style={styles.gaugeCanvas}>
      <Picture picture={picture} />
    </Canvas>
  );
};

/** Skia が無いときの代わり。円弧は描けないので、まっすぐな棒で進行を示す。 */
const BarRing: React.FC<{ progress: number; critical: boolean; palette: PurgePalette }> = ({
  progress,
  critical,
  palette,
}) => {
  const t = critical ? 1 : Math.max(0, Math.min(1, progress));
  return (
    <View style={styles.bar}>
      <View style={[styles.barTrack, { backgroundColor: palette.gaugeTrack }]}>
        <View
          style={{
            width: `${t * 100}%`,
            height: "100%",
            backgroundColor: critical ? palette.gaugeCriticalRing : palette.gaugeFill,
          }}
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  label: { position: "absolute", left: 0, right: 0, alignItems: "center" },
  criticalText: { fontFamily: F.sans, fontSize: 20, fontWeight: "500", letterSpacing: 6 },
  afterglow: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  doneText: { fontFamily: F.sans, fontSize: 17, color: C.textTertiary, letterSpacing: 3.7 },
  doneRule: { marginTop: 26, width: 24, height: 1, backgroundColor: C.outline },
  trigger: {
    position: "absolute",
    left: INSETS.paperH,
    right: INSETS.paperH,
    bottom: 40,
    height: 124,
    alignItems: "center",
    justifyContent: "flex-end",
  },
  pill: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 56,
    borderRadius: 4,
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.destructiveBorder,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  pillText: { fontFamily: F.sans, fontSize: 15, color: C.destructiveText, letterSpacing: 1.2 },
  gaugeWrap: { position: "absolute", bottom: 0 },
  hint: { position: "absolute", bottom: -24 },
  gauge: { width: GAUGE, height: GAUGE, alignItems: "center", justifyContent: "center" },
  gaugeCanvas: { position: "absolute", width: GAUGE, height: GAUGE },
  gaugeButton: {
    width: 86,
    height: 86,
    borderRadius: 43,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  bar: { position: "absolute", bottom: 0, left: 0, right: 0, alignItems: "center" },
  barTrack: { width: 140, height: 3, borderRadius: 2, overflow: "hidden" },
});
