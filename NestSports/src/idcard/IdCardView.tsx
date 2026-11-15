import React from 'react';
import { Image, Platform, Text, TouchableWithoutFeedback, View } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Svg, { Path } from 'react-native-svg';
import { assetUrl } from './data';
import { qrPath } from './qr';
import {
  cardDims,
  fieldValue,
  qrValue,
  type FontKey,
  type IdCardTemplate,
  type IdCompany,
  type IdEl,
} from './idCard';

const IOS_FONT: Record<FontKey, string> = {
  sans: 'Helvetica',
  serif: 'Georgia',
  mono: 'Courier',
  verdana: 'Verdana',
  trebuchet: 'Trebuchet MS',
  tahoma: 'Verdana',
  impact: 'Helvetica',
  palatino: 'Palatino',
  narrow: 'Helvetica',
};
const ANDROID_FONT: Record<FontKey, string> = {
  sans: 'sans-serif',
  serif: 'serif',
  mono: 'monospace',
  verdana: 'sans-serif',
  trebuchet: 'sans-serif',
  tahoma: 'sans-serif',
  impact: 'sans-serif-condensed',
  palatino: 'serif',
  narrow: 'sans-serif-condensed',
};
const fontOf = (k: FontKey) => (Platform.OS === 'ios' ? IOS_FONT : ANDROID_FONT)[k];

/** CSS-style gradient angle (0° = to top, 90° = to right) as start/end points for LinearGradient. */
export function gradientPoints(angle: number) {
  const r = ((angle - 90) * Math.PI) / 180;
  const dx = Math.cos(r) / 2;
  const dy = Math.sin(r) / 2;
  return { start: { x: 0.5 - dx, y: 0.5 - dy }, end: { x: 0.5 + dx, y: 0.5 + dy } };
}

const PT_MM = 25.4 / 72;
const initials = (emp: any) =>
  `${emp?.firstName?.[0] || ''}${emp?.lastName?.[0] || ''}`.toUpperCase() || 'ID';

function Fill({ a, b, angle, style }: { a: string; b?: string; angle: number; style?: any }) {
  if (!b) return <View style={[{ backgroundColor: a }, style]} />;
  const { start, end } = gradientPoints(angle);
  return <LinearGradient colors={[a, b]} start={start} end={end} style={style} />;
}

function Body({
  el,
  emp,
  company,
  pxMm,
}: {
  el: IdEl;
  emp: any;
  company: IdCompany;
  pxMm: number;
}) {
  const radius = (w: number, h: number) =>
    el.shape === 'circle'
      ? 9999
      : el.shape === 'rounded'
      ? (Math.min(w, h) * el.radius) / 100
      : 0;
  const border = el.borderWidth > 0 ? { borderWidth: el.borderWidth * pxMm, borderColor: el.borderColor } : null;
  const fill = { width: '100%' as const, height: '100%' as const };

  if (el.kind === 'text' || el.kind === 'field') {
    const raw = el.kind === 'text' ? el.text : fieldValue(el.field, emp, company);
    const v = el.kind === 'field' ? (raw ? `${el.prefix}${raw}` : '') : raw;
    return (
      <View
        style={{
          ...fill,
          justifyContent: 'center',
          overflow: 'hidden',
        }}
      >
        <Text
          style={{
            color: el.color,
            fontFamily: fontOf(el.font),
            fontSize: el.size * PT_MM * pxMm,
            lineHeight: el.size * PT_MM * pxMm * 1.15,
            fontWeight: el.bold ? '700' : '400',
            fontStyle: el.italic ? 'italic' : 'normal',
            textAlign: el.align,
            letterSpacing: el.spacing ? el.spacing * el.size * PT_MM * pxMm : undefined,
          }}
        >
          {el.upper ? v.toUpperCase() : v}
        </Text>
      </View>
    );
  }

  // sized containers need their pixel box for rounding, so measure via onLayout-free percentages: use big radius cap
  if (el.kind === 'photo') {
    const src = assetUrl(emp?.avatar);
    const r = el.shape === 'circle' ? 9999 : el.shape === 'rounded' ? 24 * (el.radius / 12) : 0;
    return src ? (
      <Image
        source={{ uri: src }}
        resizeMode="cover"
        style={{ ...fill, borderRadius: r, ...(border || {}) }}
      />
    ) : (
      <View
        style={{
          ...fill,
          borderRadius: r,
          backgroundColor: '#e2e8f0',
          alignItems: 'center',
          justifyContent: 'center',
          ...(border || {}),
        }}
      >
        <Text style={{ color: '#64748b', fontWeight: '700', fontSize: 14 * PT_MM * pxMm }}>
          {initials(emp)}
        </Text>
      </View>
    );
  }

  if (el.kind === 'logo') {
    return company.logoUrl ? (
      <Image source={{ uri: company.logoUrl }} resizeMode="contain" style={fill} />
    ) : null;
  }

  if (el.kind === 'image') {
    const src = assetUrl(el.src);
    return src ? (
      <Image
        source={{ uri: src }}
        resizeMode={el.fit === 'contain' ? 'contain' : 'cover'}
        style={{ ...fill, ...(border || {}) }}
      />
    ) : null;
  }

  if (el.kind === 'qr') {
    const q = qrPath(qrValue(el, emp, company));
    if (!q) return null;
    return (
      <Svg width="100%" height="100%" viewBox={`0 0 ${q.size} ${q.size}`}>
        <Path d={q.d} fill="#000" />
      </Svg>
    );
  }

  // shape
  const r = el.shape === 'circle' ? 9999 : el.shape === 'rounded' ? 20 * (el.radius / 12) : 0;
  return (
    <Fill
      a={el.fill}
      b={el.fill2}
      angle={el.angle}
      style={{ ...fill, borderRadius: r, overflow: 'hidden', ...(border || {}) }}
    />
  );
}

/** One side of an ID card, drawn at `width` px wide (height follows the card's proportions). */
export default function IdCardView({
  template,
  side,
  employee,
  company,
  width,
  selectedId,
  onSelect,
}: {
  template: IdCardTemplate;
  side: 'front' | 'back';
  employee: any;
  company: IdCompany;
  width: number;
  selectedId?: string | null;
  onSelect?: (id: string | null) => void;
}) {
  const { w, h } = cardDims(template);
  const pxMm = width / w;
  const height = h * pxMm;
  const s = side === 'front' ? template.front : template.back;
  const bgImg = assetUrl(s.bgImage);

  return (
    <TouchableWithoutFeedback onPress={() => onSelect?.(null)}>
      <View
        style={{
          width,
          height,
          borderRadius: template.cornerRadius * pxMm,
          overflow: 'hidden',
        }}
      >
        <Fill a={s.bg} b={s.bg2} angle={s.bgAngle ?? 135} style={{ position: 'absolute', width, height }} />
        {!!bgImg && (
          <Image
            source={{ uri: bgImg }}
            resizeMode="cover"
            style={{ position: 'absolute', width, height }}
          />
        )}
        {s.elements
          .filter(el => el.visible)
          .map(el => (
            <TouchableWithoutFeedback key={el.id} onPress={() => onSelect?.(el.id)} disabled={!onSelect}>
              <View
                style={{
                  position: 'absolute',
                  left: `${el.x}%`,
                  top: `${el.y}%`,
                  width: `${el.w}%`,
                  height: `${el.h}%`,
                  opacity: el.opacity,
                  transform: el.rotate ? [{ rotate: `${el.rotate}deg` }] : undefined,
                  borderWidth: selectedId === el.id ? 1 : 0,
                  borderColor: '#044bab',
                  borderStyle: 'dashed',
                }}
              >
                <Body el={el} emp={employee} company={company} pxMm={pxMm} />
              </View>
            </TouchableWithoutFeedback>
          ))}
      </View>
    </TouchableWithoutFeedback>
  );
}
