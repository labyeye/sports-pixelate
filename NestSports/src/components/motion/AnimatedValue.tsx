import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleProp, Text, TextStyle } from 'react-native';
import { useReduceMotion } from './useReduceMotion';
import { useFocusReplay } from './useFocusReplay';

interface Props {
  value: string | number;
  duration?: number;
  style?: StyleProp<TextStyle>;
  numberOfLines?: number;
  /** Shrink the text to the available width instead of truncating. */
  fit?: boolean;
}

// prefix (no digits) + number + suffix (no digits): "₹12.5K", "85%", "1,20,000", "4.2". Anything else ("3/5", "12 Jan", a name) is shown as is.
const NUMERIC = /^(\D*?)(-?\d[\d,]*(?:\.\d+)?)(\D*)$/;

function parse(value: string | number) {
  const m = NUMERIC.exec(String(value).trim());
  if (!m) return null;
  const target = Number(m[2].replace(/,/g, ''));
  if (!Number.isFinite(target)) return null;
  return {
    prefix: m[1],
    suffix: m[3],
    target,
    decimals: (m[2].split('.')[1] || '').length,
    grouped: m[2].includes(','),
  };
}

/**
 * Counts up to the number inside a summary-card value, keeping its prefix, suffix, decimals and comma grouping.
 * Non-numeric values render as plain text. Replays whenever the screen is opened again.
 */
export default function AnimatedValue({
  value,
  duration = 1200,
  style,
  numberOfLines = 1,
  fit = false,
}: Props) {
  const reduce = useReduceMotion();
  const replay = useFocusReplay();
  const anim = useRef(new Animated.Value(0)).current;
  const text = String(value);
  const [display, setDisplay] = useState(text);

  useEffect(() => {
    const p = parse(text);
    if (reduce || !p || p.target === 0) {
      setDisplay(text);
      return;
    }
    const fmt = (v: number) => {
      const n = p.grouped
        ? v.toLocaleString('en-IN', {
            minimumFractionDigits: p.decimals,
            maximumFractionDigits: p.decimals,
          })
        : v.toFixed(p.decimals);
      return p.prefix + n + p.suffix;
    };
    anim.setValue(0);
    setDisplay(fmt(0));
    const id = anim.addListener(({ value: v }) => setDisplay(fmt(v)));
    Animated.timing(anim, {
      toValue: p.target,
      duration,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start(({ finished }) => finished && setDisplay(text));
    return () => {
      anim.stopAnimation();
      anim.removeListener(id);
    };
  }, [text, duration, reduce, replay, anim]);

  return (
    <Text
      style={style}
      numberOfLines={numberOfLines}
      adjustsFontSizeToFit={fit}
      minimumFontScale={0.6}
    >
      {display}
    </Text>
  );
}
