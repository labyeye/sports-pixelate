import React, { useState } from 'react';
import { View, Text, StyleSheet, LayoutChangeEvent } from 'react-native';
import Svg, {
  Circle,
  Rect,
  Path,
  Line,
  Defs,
  LinearGradient,
  Stop,
  Text as SvgText,
} from 'react-native-svg';
import { colors, FONT } from '../theme/colors';

const GRID = '#E5E7EB';

export interface ChartDatum {
  label: string;
  value: number;
  color?: string;
}

function useWidth(initial = 280) {
  const [w, setW] = useState(initial);
  const onLayout = (e: LayoutChangeEvent) => {
    const next = Math.floor(e.nativeEvent.layout.width);
    if (next > 0 && next !== w) setW(next);
  };
  return { w, onLayout };
}

// Round the axis max up to a "nice" number so grid lines land on clean values.
function niceMax(max: number) {
  if (max <= 0) return 1;
  const pow = Math.pow(10, Math.floor(Math.log10(max)));
  const n = max / pow;
  const step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10;
  return step * pow;
}

export function DonutChart({
  data,
  size = 140,
  centerLabel,
  centerSub,
}: {
  data: ChartDatum[];
  size?: number;
  centerLabel?: string;
  centerSub?: string;
}) {
  const total = data.reduce((t, d) => t + d.value, 0);
  const stroke = 22;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  let offset = 0;
  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={GRID}
          strokeWidth={stroke}
          fill="none"
        />
        {total > 0 &&
          data.map(d => {
            const len = (d.value / total) * c;
            const el = (
              <Circle
                key={d.label}
                cx={size / 2}
                cy={size / 2}
                r={r}
                stroke={d.color || colors.blue}
                strokeWidth={stroke}
                fill="none"
                strokeDasharray={`${len} ${c - len}`}
                strokeDashoffset={-offset}
                rotation={-90}
                origin={`${size / 2}, ${size / 2}`}
              />
            );
            offset += len;
            return el;
          })}
      </Svg>
      <View style={styles.donutCenter} pointerEvents="none">
        <Text style={styles.donutValue}>{centerLabel}</Text>
        {centerSub ? <Text style={styles.donutSub}>{centerSub}</Text> : null}
      </View>
    </View>
  );
}

export function BarChart({
  data,
  height = 170,
  format = (n: number) => String(n),
}: {
  data: ChartDatum[];
  height?: number;
  format?: (n: number) => string;
}) {
  const { w, onLayout } = useWidth();
  const padL = 30;
  const padB = 24;
  const padT = 16;
  const max = niceMax(Math.max(0, ...data.map(d => d.value)));
  const plotH = height - padB - padT;
  const slot = (w - padL) / Math.max(1, data.length);
  const barW = Math.min(36, slot * 0.6);
  return (
    <View onLayout={onLayout}>
      <Svg width={w} height={height}>
        {[0, 0.5, 1].map(t => {
          const y = padT + plotH * (1 - t);
          return (
            <React.Fragment key={t}>
              <Line
                x1={padL}
                x2={w}
                y1={y}
                y2={y}
                stroke={GRID}
                strokeDasharray="3 3"
              />
              <SvgText
                x={padL - 6}
                y={y + 3}
                fontSize={10}
                fill={colors.muted}
                textAnchor="end"
              >
                {format(Math.round(max * t))}
              </SvgText>
            </React.Fragment>
          );
        })}
        {data.map((d, i) => {
          const h = (d.value / max) * plotH;
          const x = padL + slot * i + (slot - barW) / 2;
          return (
            <React.Fragment key={d.label + i}>
              <Rect
                x={x}
                y={padT + plotH - h}
                width={barW}
                height={Math.max(h, 1)}
                fill={d.color || colors.blue}
                stroke={colors.black}
                strokeWidth={2}
              />
              <SvgText
                x={x + barW / 2}
                y={padT + plotH - h - 4}
                fontSize={10}
                fontWeight="bold"
                fill={colors.black}
                textAnchor="middle"
              >
                {format(d.value)}
              </SvgText>
              <SvgText
                x={x + barW / 2}
                y={height - 8}
                fontSize={10}
                fontWeight="bold"
                fill={colors.muted}
                textAnchor="middle"
              >
                {d.label.length > 7 ? d.label.slice(0, 6) + '…' : d.label}
              </SvgText>
            </React.Fragment>
          );
        })}
      </Svg>
    </View>
  );
}

export function AreaChart({
  data,
  height = 160,
  color = colors.blue,
  format = (n: number) => String(n),
}: {
  data: { label: string; value: number }[];
  height?: number;
  color?: string;
  format?: (n: number) => string;
}) {
  const { w, onLayout } = useWidth();
  const padL = 34;
  const padR = 12;
  const padB = 24;
  const padT = 16;
  const max = niceMax(Math.max(0, ...data.map(d => d.value)));
  const plotW = w - padL - padR;
  const plotH = height - padB - padT;
  const pts = data.map((d, i) => ({
    x: padL + (data.length === 1 ? plotW / 2 : (plotW * i) / (data.length - 1)),
    y: padT + plotH - (d.value / max) * plotH,
  }));
  const line = pts.map((p, i) => `${i ? 'L' : 'M'}${p.x},${p.y}`).join(' ');
  const area = pts.length
    ? `${line} L${pts[pts.length - 1].x},${padT + plotH} L${pts[0].x},${
        padT + plotH
      } Z`
    : '';
  const gid = 'grad' + color.replace('#', '');
  // Dense series (daily over 1M) get smaller dots and every Nth label.
  const dense = data.length > 12;
  const labelStep = Math.ceil(data.length / 6);
  return (
    <View onLayout={onLayout}>
      <Svg width={w} height={height}>
        <Defs>
          <LinearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={color} stopOpacity={0.35} />
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
                stroke={GRID}
                strokeDasharray="3 3"
              />
              <SvgText
                x={padL - 6}
                y={y + 3}
                fontSize={10}
                fill={colors.muted}
                textAnchor="end"
              >
                {format(Math.round(max * t))}
              </SvgText>
            </React.Fragment>
          );
        })}
        {area ? <Path d={area} fill={`url(#${gid})`} /> : null}
        {line ? (
          <Path
            d={line}
            stroke={color}
            strokeWidth={3}
            fill="none"
            strokeLinejoin="round"
          />
        ) : null}
        {pts.map((p, i) => (
          <React.Fragment key={i}>
            <Circle
              cx={p.x}
              cy={p.y}
              r={dense ? 3 : 5}
              fill={colors.white}
              stroke={colors.black}
              strokeWidth={2}
            />
            {i % labelStep === 0 || i === data.length - 1 ? (
              <SvgText
                x={p.x}
                y={height - 8}
                fontSize={10}
                fontWeight="bold"
                fill={colors.muted}
                textAnchor="middle"
              >
                {data[i].label}
              </SvgText>
            ) : null}
          </React.Fragment>
        ))}
      </Svg>
    </View>
  );
}

export function LegendDot({
  color,
  label,
  value,
}: {
  color: string;
  label: string;
  value?: string | number;
}) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.legendDot, { backgroundColor: color }]} />
      <Text style={styles.legendText}>
        {label}
        {value !== undefined ? ` · ${value}` : ''}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  donutCenter: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  donutValue: { fontFamily: FONT.bold, fontSize: 24, color: colors.black },
  donutSub: {
    fontFamily: FONT.bold,
    fontSize: 10,
    color: colors.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: {
    width: 12,
    height: 12,
    borderWidth: 2,
    borderColor: colors.black,
  },
  legendText: { fontFamily: FONT.bold, fontSize: 12, color: colors.black },
});
