import React, { useEffect, useRef, useState } from 'react';
import { useFocusReplay } from '../motion/useFocusReplay';
import {
  Animated,
  Easing,
  LayoutChangeEvent,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Svg, {
  Circle,
  Defs,
  Line,
  LinearGradient,
  Path,
  Stop,
  Text as SvgText,
} from 'react-native-svg';
import { colors, FONT } from '../../theme/colors';

// Same palette names NestHR's components were written with, on NestSports' tokens.
const C = {
  primary: colors.blue,
  secondary: colors.orange,
  success: colors.green,
  warning: '#F59E0B',
  danger: colors.red,
  black: colors.black,
  white: colors.white,
  textMuted: colors.black,
  textLight: '#94a3b8',
};
import { useReduceMotion } from '../motion/useReduceMotion';

const AnimatedPath = Animated.createAnimatedComponent(Path);
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

export interface LinePoint {
  label: string;
  value?: number;
  /** Multi-series mode: value per series key. */
  values?: Record<string, number>;
}

export interface LineSeries {
  key: string;
  label: string;
  color: string;
}

interface Props {
  data: LinePoint[];
  height?: number;
  color?: string;
  /** Several lines on one chart (e.g. present / late / absent). Omit for a single line. */
  series?: LineSeries[];
  legend?: boolean;
  /** Show the value above each dot. Defaults on for one series, off for many. */
  valueLabels?: boolean;
  /** Draw a dot on every point. Defaults on; turn off for a plain line. */
  dots?: boolean;
  /** Glide from the previous data to the new data (e.g. when a range filter changes) instead of redrawing. */
  morph?: boolean;
  format?: (n: number) => string;
}

// Round the axis max up so grid lines land on clean values.
function niceMax(max: number) {
  if (max <= 0) return 1;
  const pow = Math.pow(10, Math.floor(Math.log10(max)));
  const n = max / pow;
  const step = [1, 2, 3, 4, 6, 8, 10].find(x => n <= x) ?? 10;
  return step * pow;
}

// Stretch a value list to n points so two data sets of different length (1M vs 1Y) can be blended.
function resample(arr: number[], n: number): number[] {
  if (arr.length === n) return arr;
  if (!arr.length) return Array(n).fill(0);
  return Array.from({ length: n }, (_, i) => {
    const pos = n === 1 ? 0 : (i * (arr.length - 1)) / (n - 1);
    const lo = Math.floor(pos);
    const hi = Math.min(arr.length - 1, lo + 1);
    return arr[lo] + (arr[hi] - arr[lo]) * (pos - lo);
  });
}

type Pt = { x: number; y: number };

// Smooth curve through the points. Monotone tangents keep it from dipping
// below zero or overshooting a peak between two months.
function buildCurve(pts: Pt[]) {
  const slope = pts
    .slice(1)
    .map((p, i) => (p.y - pts[i].y) / (p.x - pts[i].x || 1));
  const tan = pts.map((_, i) =>
    i === 0
      ? slope[0] || 0
      : i === pts.length - 1
      ? slope[i - 1]
      : slope[i - 1] * slope[i] <= 0
      ? 0
      : (slope[i - 1] + slope[i]) / 2,
  );
  slope.forEach((sl, i) => {
    if (sl === 0) {
      tan[i] = 0;
      tan[i + 1] = 0;
      return;
    }
    const a = tan[i] / sl;
    const b = tan[i + 1] / sl;
    const h = Math.hypot(a, b);
    if (h > 3) {
      tan[i] = (3 / h) * a * sl;
      tan[i + 1] = (3 / h) * b * sl;
    }
  });
  let line = pts.length ? `M${pts[0].x},${pts[0].y}` : '';
  let len = 0;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1];
    const b = pts[i];
    const dx = (b.x - a.x) / 3;
    const c1 = { x: a.x + dx, y: a.y + tan[i - 1] * dx };
    const c2 = { x: b.x - dx, y: b.y - tan[i] * dx };
    line += ` C${c1.x},${c1.y} ${c2.x},${c2.y} ${b.x},${b.y}`;
    // curve length, sampled, for the draw-in dash animation
    let prev = a;
    for (let k = 1; k <= 12; k++) {
      const t = k / 12;
      const u = 1 - t;
      const q = {
        x:
          u * u * u * a.x +
          3 * u * u * t * c1.x +
          3 * u * t * t * c2.x +
          t * t * t * b.x,
        y:
          u * u * u * a.y +
          3 * u * u * t * c1.y +
          3 * u * t * t * c2.y +
          t * t * t * b.y,
      };
      len += Math.hypot(q.x - prev.x, q.y - prev.y);
      prev = q;
    }
  }
  return { line, len: Math.ceil(len) + 2 };
}

/** Brutalist curved line chart: lines draw themselves in, area fades up, dots pop in. */
export default function AnimatedLineChart({
  data,
  height = 170,
  color = C.primary,
  series,
  legend = false,
  valueLabels,
  dots = true,
  morph = false,
  format = n => String(n),
}: Props) {
  const [w, setW] = useState(280);
  const reduce = useReduceMotion();
  const replay = useFocusReplay();
  const progress = useRef(new Animated.Value(0)).current;

  const lines: LineSeries[] = series?.length
    ? series
    : [{ key: '__v', label: '', color }];
  const multi = lines.length > 1;
  const showLabels = valueLabels ?? !multi;
  const valueOf = (d: LinePoint, k: string) =>
    k === '__v' ? d.value ?? 0 : d.values?.[k] ?? 0;
  const key = data
    .map(d => lines.map(l => valueOf(d, l.key)).join(':'))
    .join(',');

  // Morph mode: the plotted values glide from what is on screen to the new data.
  const targetVals: Record<string, number[]> = {};
  lines.forEach(l => {
    targetVals[l.key] = data.map(d => valueOf(d, l.key));
  });
  const targetMax = niceMax(
    Math.max(0, ...Object.values(targetVals).flat()),
  );
  const [disp, setDisp] = useState({ vals: targetVals, max: targetMax });
  const dispRef = useRef(disp);
  dispRef.current = disp;
  const morphT = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!morph) return;
    const from = dispRef.current;
    const fromVals: Record<string, number[]> = {};
    lines.forEach(l => {
      fromVals[l.key] = resample(from.vals[l.key] || [], data.length);
    });
    morphT.setValue(0);
    const id = morphT.addListener(({ value: e }) => {
      const vals: Record<string, number[]> = {};
      lines.forEach(l => {
        vals[l.key] = targetVals[l.key].map(
          (v, i) => fromVals[l.key][i] + (v - fromVals[l.key][i]) * e,
        );
      });
      setDisp({ vals, max: from.max + (targetMax - from.max) * e });
    });
    Animated.timing(morphT, {
      toValue: 1,
      duration: 550,
      easing: Easing.inOut(Easing.cubic),
      useNativeDriver: false,
    }).start();
    return () => {
      morphT.removeListener(id);
      morphT.stopAnimation();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, morph]);

  useEffect(() => {
    progress.setValue(reduce || morph ? 1 : 0);
    if (reduce || morph) return;
    Animated.timing(progress, {
      toValue: 1,
      duration: 1100,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [key, reduce, replay, progress, morph]);

  const onLayout = (e: LayoutChangeEvent) => {
    const next = Math.floor(e.nativeEvent.layout.width);
    if (next > 0 && next !== w) setW(next);
  };

  // Narrow cards get fewer x labels so they never collide.
  const labelEvery = Math.max(
    1,
    Math.ceil(data.length / Math.max(2, Math.floor(w / 46))),
  );
  const padL = 34;
  const padR = 14;
  const padT = 16;
  const padB = 24;
  const max = morph ? disp.max || 1 : targetMax;
  const shownVals = (k: string) =>
    morph ? resample(disp.vals[k] || [], data.length) : targetVals[k];
  const plotW = w - padL - padR;
  const plotH = height - padT - padB;
  const xAt = (i: number) =>
    padL + (data.length === 1 ? plotW / 2 : (plotW * i) / (data.length - 1));
  const built = lines.map(l => {
    const vs = shownVals(l.key);
    const pts = data.map((d, i) => ({
      x: xAt(i),
      y: padT + plotH - ((vs[i] ?? 0) / max) * plotH,
    }));
    const { line, len } = buildCurve(pts);
    const area = pts.length
      ? `${line} L${pts[pts.length - 1].x},${padT + plotH} L${pts[0].x},${
          padT + plotH
        } Z`
      : '';
    return { l, pts, line, len, area };
  });
  const dotR = progress.interpolate({
    inputRange: [0, 0.7, 1],
    outputRange: [0, 0, multi ? 4 : 5],
  });
  const areaOpacity = progress.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0, 0, 1],
  });

  return (
    <View onLayout={onLayout}>
      <Svg width={w} height={height}>
        <Defs>
          {built.map(({ l }) => (
            <LinearGradient
              key={l.key}
              id={'lg' + l.color.replace('#', '')}
              x1="0"
              y1="0"
              x2="0"
              y2="1"
            >
              <Stop offset="0" stopColor={l.color} stopOpacity={0.3} />
              <Stop offset="1" stopColor={l.color} stopOpacity={0.02} />
            </LinearGradient>
          ))}
        </Defs>
        {[0, 0.5, 1].map(t => {
          const y = padT + plotH * (1 - t);
          return (
            <React.Fragment key={t}>
              <Line
                x1={padL}
                x2={w - padR}
                y1={y}
                y2={y}
                stroke={C.black}
                strokeOpacity={0.15}
                strokeDasharray="3 3"
              />
              <SvgText
                x={padL - 6}
                y={y + 3}
                fontSize={10}
                fontFamily={FONT.bold}
                fill={C.black}
                textAnchor="end"
              >
                {format(Math.round(max * t))}
              </SvgText>
            </React.Fragment>
          );
        })}
        {built.map(({ l, line, len, area }) => {
          const dashOffset = progress.interpolate({
            inputRange: [0, 1],
            outputRange: [len, 0],
          });
          return (
            <React.Fragment key={l.key}>
              {!multi && area ? (
                <AnimatedPath
                  d={area}
                  fill={`url(#lg${l.color.replace('#', '')})`}
                  opacity={areaOpacity}
                />
              ) : null}
              {line ? (
                <AnimatedPath
                  d={line}
                  stroke={l.color}
                  strokeWidth={3}
                  fill="none"
                  strokeLinejoin="round"
                  strokeLinecap="round"
                  strokeDasharray={morph ? undefined : [len, len]}
                  strokeDashoffset={morph ? 0 : dashOffset}
                />
              ) : null}
            </React.Fragment>
          );
        })}
        {built.map(({ l, pts }) =>
          pts.map((p, i) => (
            <React.Fragment key={`${l.key}-${i}`}>
              {dots && (
                <AnimatedCircle
                  cx={p.x}
                  cy={p.y}
                  r={dotR}
                  fill={multi ? l.color : C.white}
                  stroke={C.black}
                  strokeWidth={2}
                />
              )}
              {showLabels && (
                <SvgText
                  x={p.x}
                  y={p.y - 9}
                  fontSize={9}
                  fontFamily={FONT.bold}
                  fill={C.black}
                  textAnchor="middle"
                >
                  {format(valueOf(data[i], l.key))}
                </SvgText>
              )}
            </React.Fragment>
          )),
        )}
        {data.map((d, i) =>
          i % labelEvery === 0 || i === data.length - 1 ? (
            <SvgText
              key={i}
              x={xAt(i)}
              y={height - 8}
              fontSize={10}
              fontFamily={FONT.bold}
              fill={C.black}
              textAnchor="middle"
            >
              {d.label}
            </SvgText>
          ) : null,
        )}
      </Svg>
      {legend && multi && (
        <View style={styles.legend}>
          {lines.map(l => (
            <View key={l.key} style={styles.legendItem}>
              <View style={[styles.swatch, { backgroundColor: l.color }]} />
              <Text style={styles.legendText}>{l.label}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  legend: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
    flexWrap: 'wrap',
    marginTop: 4,
    paddingBottom: 12,
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  swatch: {
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: C.black,
  },
  legendText: { fontSize: 11, fontFamily: FONT.bold, color: C.black },
});
