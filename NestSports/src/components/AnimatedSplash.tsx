import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  StyleSheet,
  View,
} from 'react-native';
import SplashScreen from 'react-native-splash-screen';
import { colors, FONT } from '../theme/colors';

// The native launch screens (Android launch_screen.xml / iOS LaunchScreen.storyboard)
// are blank white on purpose, so this animation is the only splash users see.
const LOGO_W = 240;
const LOGO_H = Math.round((LOGO_W * 370) / 1020);
const BAR_W = 160;
// Shortest time the animation stays up, so a fast session restore doesn't cut
// it off after a blink.
const MIN_MS = 2400;

function Ring({ delay, color }: { delay: number; color: string }) {
  const t = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(t, {
          toValue: 1,
          duration: 2000,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [t, delay]);
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.ring,
        { borderColor: color },
        {
          opacity: t.interpolate({
            inputRange: [0, 0.15, 1],
            outputRange: [0, 0.35, 0],
          }),
          transform: [
            {
              scale: t.interpolate({
                inputRange: [0, 1],
                outputRange: [0.7, 2.4],
              }),
            },
          ],
        },
      ]}
    />
  );
}

export default function AnimatedSplash({
  ready,
  onFinish,
}: {
  // True once the app has restored the session and can show real content.
  ready: boolean;
  onFinish: () => void;
}) {
  const float = useRef(new Animated.Value(0)).current;
  const tagline = useRef(new Animated.Value(0)).current;
  const bar = useRef(new Animated.Value(0)).current;
  const exit = useRef(new Animated.Value(0)).current;
  const [minDone, setMinDone] = useState(false);
  const started = useRef(false);

  const start = () => {
    if (started.current) return;
    started.current = true;
    // Native splash is blank white; drop it now that the animation is on screen.
    SplashScreen.hide();

    Animated.loop(
      Animated.sequence([
        Animated.timing(float, {
          toValue: 1,
          duration: 1400,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(float, {
          toValue: 0,
          duration: 1400,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    ).start();
    Animated.timing(tagline, {
      toValue: 1,
      delay: 500,
      duration: 700,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
    Animated.timing(bar, {
      toValue: 1,
      duration: MIN_MS,
      easing: Easing.inOut(Easing.cubic),
      useNativeDriver: true,
    }).start();
    setTimeout(() => {
      setMinDone(true);
    }, MIN_MS);
  };

  useEffect(() => {
    if (!ready || !minDone) return;
    Animated.timing(exit, {
      toValue: 1,
      duration: 450,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start(({ finished }) => finished && onFinish());
  }, [ready, minDone, exit, onFinish]);

  return (
    <Animated.View
      onLayout={start}
      style={[
        styles.root,
        {
          opacity: exit.interpolate({
            inputRange: [0, 1],
            outputRange: [1, 0],
          }),
        },
      ]}
    >
      <View style={styles.center}>
        <Ring delay={0} color={colors.blue} />
        <Ring delay={1000} color={colors.orange} />
        <Animated.Image
          source={require('../assets/logo.png')}
          resizeMode="contain"
          style={{
            width: LOGO_W,
            height: LOGO_H,
            transform: [
              {
                translateY: float.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, -6],
                }),
              },
              {
                scale: exit.interpolate({
                  inputRange: [0, 1],
                  outputRange: [1, 1.15],
                }),
              },
            ],
          }}
        />
      </View>

      <Animated.Text
        style={[
          styles.tagline,
          {
            opacity: tagline,
            transform: [
              {
                translateY: tagline.interpolate({
                  inputRange: [0, 1],
                  outputRange: [14, 0],
                }),
              },
            ],
          },
        ]}
      >
        Train. Track. Grow.
      </Animated.Text>

      <View style={styles.barTrack}>
        <Animated.View
          style={[
            styles.barFill,
            {
              transform: [
                {
                  translateX: bar.interpolate({
                    inputRange: [0, 1],
                    outputRange: [-BAR_W, 0],
                  }),
                },
              ],
            },
          ]}
        />
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFill,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
    elevation: 100,
  },
  center: { alignItems: 'center', justifyContent: 'center' },
  ring: {
    position: 'absolute',
    width: 140,
    height: 140,
    borderRadius: 70,
    borderWidth: 2,
  },
  tagline: {
    position: 'absolute',
    bottom: '30%',
    fontFamily: FONT.medium,
    fontSize: 14,
    letterSpacing: 3,
    color: colors.muted,
    textTransform: 'uppercase',
  },
  barTrack: {
    position: 'absolute',
    bottom: '14%',
    width: BAR_W,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#E8EEF9',
    overflow: 'hidden',
  },
  barFill: {
    width: BAR_W,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.orange,
  },
});
