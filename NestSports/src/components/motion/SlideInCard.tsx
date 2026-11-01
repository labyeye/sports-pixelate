import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleProp, ViewStyle } from 'react-native';
import { useReduceMotion } from './useReduceMotion';
import { useFocusReplay } from './useFocusReplay';

interface Props {
  children: React.ReactNode;
  /** Position in the list; each card starts a little after the previous one (capped so long lists stay snappy). */
  index?: number;
  style?: StyleProp<ViewStyle>;
}

/** Slides a card in from the left to its place with a fade; replays whenever the screen is opened again. */
export default function SlideInCard({ children, index = 0, style }: Props) {
  const reduce = useReduceMotion();
  const replay = useFocusReplay();
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (reduce) {
      progress.setValue(1);
      return;
    }
    progress.setValue(0);
    Animated.timing(progress, {
      toValue: 1,
      duration: 520,
      delay: Math.min(index, 8) * 70,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [reduce, replay, index, progress]);

  return (
    <Animated.View
      style={[
        style,
        {
          opacity: progress,
          transform: [
            {
              translateX: progress.interpolate({
                inputRange: [0, 1],
                outputRange: [-48, 0],
              }),
            },
          ],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}
