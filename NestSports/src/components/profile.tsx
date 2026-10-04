import React from 'react';
import {
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { Camera, ChevronRight } from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';
import { colors, FONT } from '../theme/colors';

// Soft, rounded "person card" building blocks shared by the account profile
// and the student profile: photo hero, swipeable info pills, a bar card and
// tappable action tiles.

export const SOFT = {
  screenBg: '#F3F6FB',
  card: colors.white,
  chip: '#F1F4F9',
  text: '#0F172A',
  sub: '#8A94A6',
  bar: '#C9D6F2',
  barOff: '#E6EAF0',
};

const softShadow = {
  shadowColor: '#1E3A8A',
  shadowOpacity: 0.08,
  shadowRadius: 14,
  shadowOffset: { width: 0, height: 6 },
  elevation: 3,
};

export function SoftCard({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: object;
}) {
  return <View style={[styles.card, style]}>{children}</View>;
}

function RoundButton({
  icon: Icon,
  onPress,
  brutal,
}: {
  icon: LucideIcon;
  onPress: () => void;
  brutal?: boolean;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      hitSlop={8}
      style={[styles.roundBtn, brutal && styles.roundBtnBrutal]}
      activeOpacity={0.8}
    >
      <Icon size={18} color={SOFT.text} strokeWidth={2.2} />
    </TouchableOpacity>
  );
}

export function ProfileHero({
  uri,
  name,
  subtitle,
  leftIcon,
  onLeft,
  rightIcon,
  onRight,
  onCamera,
  height = 300,
  brutal,
}: {
  uri?: string;
  name: string;
  subtitle?: string;
  leftIcon?: LucideIcon;
  onLeft?: () => void;
  rightIcon?: LucideIcon;
  onRight?: () => void;
  onCamera?: () => void;
  height?: number;
  brutal?: boolean;
}) {
  const initials = name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map(p => p[0])
    .join('')
    .toUpperCase();

  return (
    <View style={[styles.hero, brutal && styles.heroBrutal, { height }]}>
      {uri ? (
        <Image source={{ uri }} style={StyleSheet.absoluteFill} />
      ) : (
        <View
          style={[
            StyleSheet.absoluteFill,
            styles.heroFallback,
            brutal && styles.heroFallbackBrutal,
          ]}
        >
          <View
            style={[styles.initialsCircle, brutal && styles.initialsBrutal]}
          >
            <Text style={styles.initialsText}>{initials || '?'}</Text>
          </View>
        </View>
      )}
      {/* Fade the photo into the white name area, like the reference. */}
      {!brutal && (
        <Svg
          style={StyleSheet.absoluteFill}
          width="100%"
          height="100%"
          preserveAspectRatio="none"
        >
          <Defs>
            <LinearGradient id="fade" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0.5" stopColor="#fff" stopOpacity="0" />
              <Stop offset="0.82" stopColor="#fff" stopOpacity="0.92" />
              <Stop offset="1" stopColor="#fff" stopOpacity="1" />
            </LinearGradient>
          </Defs>
          <Rect x="0" y="0" width="100%" height="100%" fill="url(#fade)" />
        </Svg>
      )}

      {leftIcon && onLeft ? (
        <View style={styles.heroLeft}>
          <RoundButton icon={leftIcon} onPress={onLeft} brutal={brutal} />
        </View>
      ) : null}
      {rightIcon && onRight ? (
        <View style={styles.heroRight}>
          <RoundButton icon={rightIcon} onPress={onRight} brutal={brutal} />
        </View>
      ) : null}
      {onCamera ? (
        <TouchableOpacity
          style={[styles.cameraBadge, brutal && styles.cameraBrutal]}
          onPress={onCamera}
          activeOpacity={0.8}
        >
          <Camera size={16} color={colors.white} strokeWidth={2.4} />
        </TouchableOpacity>
      ) : null}

      <View style={[styles.heroText, brutal && styles.heroTextBrutal]}>
        <Text
          style={[styles.heroName, brutal && styles.heroNameBrutal]}
          numberOfLines={1}
        >
          {name}
        </Text>
        {subtitle ? (
          <Text style={styles.heroSub} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

export interface Pill {
  icon: LucideIcon;
  label: string;
  value: string;
  color?: string;
}

export function InfoPills({
  items,
  brutal,
}: {
  items: Pill[];
  brutal?: boolean;
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ gap: 10, paddingVertical: 4, paddingRight: 4 }}
      style={{ marginTop: 14, marginBottom: 6, overflow: 'visible' }}
    >
      {items.map(p => (
        <View
          key={p.label + p.value}
          style={[styles.pill, brutal ? styles.pillBrutal : softShadow]}
        >
          <View style={[styles.pillIcon, brutal && styles.pillIconBrutal]}>
            <p.icon size={18} color={p.color || SOFT.text} strokeWidth={2} />
          </View>
          <View>
            <Text style={styles.pillLabel}>{p.label}</Text>
            <Text
              style={[styles.pillValue, p.color ? { color: p.color } : null]}
              numberOfLines={1}
            >
              {p.value || '—'}
            </Text>
          </View>
        </View>
      ))}
    </ScrollView>
  );
}

export interface SoftBar {
  label: string;
  value: number;
  color?: string;
}

// Slim rounded bars on a pale track, labelled underneath — the reference's
// "monthly engagement" look, fed with whatever few categories we have.
export function SoftBars({
  data,
  height = 90,
}: {
  data: SoftBar[];
  height?: number;
}) {
  const max = Math.max(1, ...data.map(d => d.value));
  return (
    <View style={styles.barsRow}>
      {data.map(d => {
        const h = Math.max(8, (d.value / max) * height);
        return (
          <View key={d.label} style={styles.barCol}>
            <Text style={styles.barValue}>{d.value}</Text>
            <View style={[styles.barTrack, { height }]}>
              <View
                style={[
                  styles.bar,
                  { height: h, backgroundColor: d.color || colors.blue },
                ]}
              />
            </View>
            <Text style={styles.barLabel}>{d.label}</Text>
          </View>
        );
      })}
    </View>
  );
}

export function ActionTile({
  icon: Icon,
  title,
  sub,
  onPress,
  brutal,
}: {
  icon: LucideIcon;
  title: string;
  sub?: string;
  onPress: () => void;
  brutal?: boolean;
}) {
  return (
    <TouchableOpacity
      style={[styles.tile, brutal ? styles.tileBrutal : softShadow]}
      onPress={onPress}
      activeOpacity={0.85}
    >
      <View style={styles.tileTop}>
        <View style={[styles.pillIcon, brutal && styles.pillIconBrutal]}>
          <Icon size={18} color={SOFT.text} strokeWidth={2} />
        </View>
        <View style={[styles.tileArrow, brutal && styles.tileArrowBrutal]}>
          <ChevronRight size={16} color={SOFT.text} strokeWidth={2.2} />
        </View>
      </View>
      <Text
        style={[styles.tileTitle, brutal && styles.tileTitleBrutal]}
        numberOfLines={1}
      >
        {title}
      </Text>
      {sub ? (
        <Text style={styles.tileSub} numberOfLines={1}>
          {sub}
        </Text>
      ) : null}
    </TouchableOpacity>
  );
}

const BK = colors.black;
const brutalBox = {
  borderWidth: 2,
  borderColor: BK,
  borderRightWidth: 5,
  borderBottomWidth: 5,
  borderRightColor: BK,
  borderBottomColor: BK,
  borderRadius: 8,
};

const styles = StyleSheet.create({
  heroFallbackBrutal: { backgroundColor: colors.yellow },
  heroBrutal: { ...brutalBox, backgroundColor: colors.yellow },
  initialsBrutal: {
    borderRadius: 8,
    borderWidth: 2,
    borderColor: BK,
    borderRightWidth: 5,
    borderBottomWidth: 5,
    shadowOpacity: 0,
    elevation: 0,
  },
  roundBtnBrutal: {
    borderRadius: 8,
    borderWidth: 2,
    borderColor: BK,
    shadowOpacity: 0,
    elevation: 0,
  },
  cameraBrutal: {
    bottom: 72,
    borderRadius: 8,
    borderColor: BK,
    borderWidth: 2,
  },
  heroTextBrutal: {
    left: 0,
    right: 0,
    bottom: 0,
    paddingVertical: 12,
    backgroundColor: colors.white,
    borderTopWidth: 2,
    borderTopColor: BK,
  },
  heroNameBrutal: { textTransform: 'uppercase', color: BK },
  pillBrutal: { ...brutalBox, borderRadius: 8, paddingRight: 14 },
  pillIconBrutal: {
    borderRadius: 6,
    borderWidth: 2,
    borderColor: BK,
    backgroundColor: '#E8F0FB',
  },
  tileBrutal: { ...brutalBox },
  tileArrowBrutal: { borderRadius: 6, borderWidth: 2 },
  tileTitleBrutal: { textTransform: 'uppercase' },
  card: {
    backgroundColor: SOFT.card,
    borderRadius: 24,
    padding: 18,
    marginTop: 14,
    ...softShadow,
  },
  hero: {
    borderRadius: 28,
    overflow: 'hidden',
    backgroundColor: '#E8EEF9',
  },
  heroFallback: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 70,
    backgroundColor: '#E3ECFA',
  },
  initialsCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    ...softShadow,
  },
  initialsText: {
    fontFamily: FONT.bold,
    fontSize: 44,
    fontWeight: '700',
    color: colors.blue,
  },
  heroLeft: { position: 'absolute', top: 14, left: 14 },
  heroRight: { position: 'absolute', top: 14, right: 14 },
  roundBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    ...softShadow,
  },
  cameraBadge: {
    position: 'absolute',
    right: 18,
    bottom: 84,
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.blue,
    borderWidth: 3,
    borderColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroText: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 16,
    alignItems: 'center',
  },
  heroName: {
    fontFamily: FONT.bold,
    fontSize: 24,
    fontWeight: '700',
    color: SOFT.text,
  },
  heroSub: {
    fontFamily: FONT.medium,
    fontSize: 13,
    color: SOFT.sub,
    marginTop: 3,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.white,
    borderRadius: 999,
    paddingVertical: 8,
    paddingLeft: 8,
    paddingRight: 18,
  },
  pillIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: SOFT.chip,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillLabel: { fontFamily: FONT.medium, fontSize: 11, color: SOFT.sub },
  pillValue: {
    fontFamily: FONT.bold,
    fontSize: 14,
    fontWeight: '700',
    color: SOFT.text,
    maxWidth: 190,
  },
  barsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'flex-end',
    marginTop: 16,
  },
  barCol: { alignItems: 'center', gap: 6, minWidth: 54 },
  barValue: {
    fontFamily: FONT.bold,
    fontSize: 13,
    fontWeight: '700',
    color: SOFT.text,
  },
  barTrack: {
    width: 10,
    borderRadius: 5,
    backgroundColor: SOFT.barOff,
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  bar: { width: 10, borderRadius: 5 },
  barLabel: { fontFamily: FONT.medium, fontSize: 11, color: SOFT.sub },
  tile: {
    flex: 1,
    backgroundColor: colors.white,
    borderRadius: 24,
    padding: 14,
    minHeight: 112,
    justifyContent: 'space-between',
  },
  tileTop: { flexDirection: 'row', justifyContent: 'space-between' },
  tileArrow: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: SOFT.text,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileTitle: {
    fontFamily: FONT.bold,
    fontSize: 14,
    fontWeight: '700',
    color: SOFT.text,
    marginTop: 12,
  },
  tileSub: { fontFamily: FONT.medium, fontSize: 11, color: SOFT.sub },
});
