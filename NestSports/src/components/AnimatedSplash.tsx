import React, { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import SplashScreen from 'react-native-splash-screen';
import { Users, Clock, IndianRupee } from 'lucide-react-native';

// Same sequence as NestHR's splash: icons slide in one by one, hold, then fade
// out together. The native launch screens are blank white on purpose, so this
// animation is the only splash users see.
const ICON_SLIDE = 40;
const ICON_DURATION = 400;
const STAGGER = 280;
const FADE_OUT_DELAY = 1000;
const FADE_OUT_DURATION = 350;

const ITEMS = [
  { Icon: Users, label: 'Students' },
  { Icon: Clock, label: 'Attendance' },
  { Icon: IndianRupee, label: 'Fees' },
];

export default function AnimatedSplash({
  ready,
  onFinish,
}: {
  // True once the app has restored the session and can show real content.
  ready: boolean;
  onFinish: () => void;
}) {
  const opacities = useRef(ITEMS.map(() => new Animated.Value(0))).current;
  const ys = useRef(ITEMS.map(() => new Animated.Value(ICON_SLIDE))).current;
  const groupOpacity = useRef(new Animated.Value(1)).current;
  const [animDone, setAnimDone] = useState(false);
  const finished = useRef(false);

  useEffect(() => {
    SplashScreen.hide();
    Animated.sequence([
      Animated.stagger(
        STAGGER,
        ITEMS.map((_, i) =>
          Animated.parallel([
            Animated.timing(opacities[i], {
              toValue: 1,
              duration: ICON_DURATION,
              useNativeDriver: true,
            }),
            Animated.timing(ys[i], {
              toValue: 0,
              duration: ICON_DURATION,
              useNativeDriver: true,
            }),
          ]),
        ),
      ),
      Animated.delay(FADE_OUT_DELAY),
      Animated.timing(groupOpacity, {
        toValue: 0,
        duration: FADE_OUT_DURATION,
        useNativeDriver: true,
      }),
    ]).start(() => setAnimDone(true));
  }, [opacities, ys, groupOpacity]);

  // Wait for the session restore as well, so a slow restore doesn't expose a
  // blank screen after the icons fade out.
  useEffect(() => {
    if (!ready || !animDone || finished.current) return;
    finished.current = true;
    onFinish();
  }, [ready, animDone, onFinish]);

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.iconsRow, { opacity: groupOpacity }]}>
        {ITEMS.map(({ Icon, label }, i) => (
          <Animated.View
            key={label}
            style={[
              styles.iconWrap,
              { opacity: opacities[i], transform: [{ translateY: ys[i] }] },
            ]}
          >
            <View style={styles.iconCircle}>
              <Icon size={32} color="#ffffff" strokeWidth={2} />
            </View>
            <Text style={styles.iconLabel}>{label}</Text>
          </Animated.View>
        ))}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFill,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconsRow: {
    flexDirection: 'row',
    gap: 28,
    position: 'absolute',
  },
  iconWrap: {
    alignItems: 'center',
    gap: 10,
  },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#024bab',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconLabel: {
    color: '#024bab',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
});
