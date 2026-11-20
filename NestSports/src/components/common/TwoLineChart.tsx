import React, { useState } from 'react';
import { LayoutChangeEvent, Text, View } from 'react-native';
import Svg, { Circle, Line, Path, Text as SvgText } from 'react-native-svg';
import { colors, FONT } from '../../theme/colors';

export interface LineSeries {
  key: string;
  label: string;
  color: string;
}
interface Props {
  series: LineSeries[];
  data: { label: string; values: Record<string, number> }[];
  height?: number;
}

function niceMax(max: number) {
  if (max <= 4) return 4;
  return Math.ceil(max / 4) * 4;
}

/** Multi-series line chart with legend (counts, integer axis). */
export default function TwoLineChart({ series, data, height = 170 }: Props) {
  const [w, setW] = useState(280);
  const onLayout = (e: LayoutChangeEvent) => {
    const n = Math.floor(e.nativeEvent.layout.width);
    if (n > 0 && n !== w) setW(n);
  };
  const padL = 30, padR = 14, padT = 12, padB = 24;
  const max = niceMax(
    Math.max(0, ...data.flatMap(d => series.map(s => d.values[s.key] || 0))),
  );
  const plotW = w - padL - padR;
  const plotH = height - padT - padB;
  const x = (i: number) =>
    padL + (data.length <= 1 ? plotW / 2 : (plotW * i) / (data.length - 1));
  const y = (v: number) => padT + plotH - (v / max) * plotH;

  return (
    <View onLayout={onLayout}>
      <Svg width={w} height={height}>
        {[0, 0.5, 1].map(t => (
          <React.Fragment key={t}>
            <Line x1={padL} x2={w - padR} y1={padT + plotH * (1 - t)} y2={padT + plotH * (1 - t)}
              stroke={colors.black} strokeOpacity={0.15} strokeDasharray="3 3" />
            <SvgText x={padL - 6} y={padT + plotH * (1 - t) + 3} fontSize={10}
              fontFamily={FONT.bold} fill={colors.black} textAnchor="end">
              {Math.round(max * t)}
            </SvgText>
          </React.Fragment>
        ))}
        {series.map(s => (
          <React.Fragment key={s.key}>
            <Path
              d={data.map((d, i) => `${i ? 'L' : 'M'}${x(i)},${y(d.values[s.key] || 0)}`).join(' ')}
              stroke={s.color} strokeWidth={3} fill="none"
              strokeLinejoin="round" strokeLinecap="round" />
            {data.map((d, i) => (
              <Circle key={i} cx={x(i)} cy={y(d.values[s.key] || 0)} r={4}
                fill={colors.white} stroke={s.color} strokeWidth={2} />
            ))}
          </React.Fragment>
        ))}
        {data.map((d, i) => (
          <SvgText key={i} x={x(i)} y={height - 8} fontSize={10}
            fontFamily={FONT.bold} fill={colors.black} textAnchor="middle">
            {d.label}
          </SvgText>
        ))}
      </Svg>
      <View style={{ flexDirection: 'row', gap: 16, marginTop: 6 }}>
        {series.map(s => (
          <View key={s.key} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <View style={{ width: 14, height: 4, backgroundColor: s.color }} />
            <Text style={{ fontFamily: FONT.bold, fontSize: 11, color: colors.black }}>{s.label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}
