import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, LayoutChangeEvent, View } from 'react-native';
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
  value: number;
}

interface Props {
  data: LinePoint[];
  height?: number;
  color?: string;
  format?: (n: number) => string;
}

// Round the axis max up so grid lines land on clean values.
function niceMax(max: number) {
  if (max <= 0) return 1;
  const pow = Math.pow(10, Math.floor(Math.log10(max)));
  const n = max / pow;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * pow;
}

/** Brutalist line chart: line draws itself in, area fades up, dots pop in. */
export default function AnimatedLineChart({
  data,
  height = 170,
  color = C.primary,
  format = n => String(n),
}: Props) {
  const [w, setW] = useState(280);
  const reduce = useReduceMotion();
  const progress = useRef(new Animated.Value(0)).current;
  const key = data.map(d => d.value).join(',');

  useEffect(() => {
    progress.setValue(reduce ? 1 : 0);
    if (reduce) return;
    Animated.timing(progress, {
      toValue: 1,
      duration: 1100,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [key, reduce, progress]);

  const onLayout = (e: LayoutChangeEvent) => {
    const next = Math.floor(e.nativeEvent.layout.width);
    if (next > 0 && next !== w) setW(next);
  };

  const padL = 34;
  const padR = 14;
  const padT = 16;
  const padB = 24;
  const max = niceMax(Math.max(0, ...data.map(d => d.value)));
  const plotW = w - padL - padR;
  const plotH = height - padT - padB;
  const pts = data.map((d, i) => ({
    x: padL + (data.length === 1 ? plotW / 2 : (plotW * i) / (data.length - 1)),
    y: padT + plotH - (d.value / max) * plotH,
  }));
  const line = pts.map((p, i) => `${i ? 'L' : 'M'}${p.x},${p.y}`).join(' ');
  const area = pts.length
    ? `${line} L${pts[pts.length - 1].x},${padT + plotH} L${pts[0].x},${padT + plotH} Z`
    : '';
  let len = 0;
  for (let i = 1; i < pts.length; i++) {
    len += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
  }
  len = Math.ceil(len) + 2;
  const dashOffset = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [len, 0],
  });
  const dotR = progress.interpolate({
    inputRange: [0, 0.7, 1],
    outputRange: [0, 0, 5],
  });
  const areaOpacity = progress.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0, 0, 1],
  });
  const gid = 'lg' + color.replace('#', '');

  return (
    <View onLayout={onLayout}>
      <Svg width={w} height={height}>
        <Defs>
          <LinearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={color} stopOpacity={0.3} />
            <Stop offset="1" stopColor={color} stopOpacity={0.02} />
          </LinearGradient>
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
        {area ? (
          <AnimatedPath d={area} fill={`url(#${gid})`} opacity={areaOpacity} />
        ) : null}
        {line ? (
          <AnimatedPath
            d={line}
            stroke={color}
            strokeWidth={3}
            fill="none"
            strokeLinejoin="round"
            strokeLinecap="round"
            strokeDasharray={[len, len]}
            strokeDashoffset={dashOffset}
          />
        ) : null}
        {pts.map((p, i) => (
          <React.Fragment key={i}>
            <AnimatedCircle
              cx={p.x}
              cy={p.y}
              r={dotR}
              fill={C.white}
              stroke={C.black}
              strokeWidth={2}
            />
            <SvgText
              x={p.x}
              y={height - 8}
              fontSize={10}
              fontFamily={FONT.bold}
              fill={C.black}
              textAnchor="middle"
            >
              {data[i].label}
            </SvgText>
          </React.Fragment>
        ))}
      </Svg>
    </View>
  );
}
