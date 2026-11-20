import React, { useEffect, useRef } from 'react';
import { Animated, Easing } from 'react-native';
import { useReduceMotion } from './useReduceMotion';

/**
 * Wraps every screen (via the navigators' screenLayout): whenever you open or
 * come back to a screen its cards and text fade in and rise into place.
 */
export default function ScreenEntrance({
  navigation,
  children,
}: {
  navigation: any;
  children: React.ReactNode;
}) {
  const reduce = useReduceMotion();
  const v = useRef(new Animated.Value(reduce ? 1 : 0)).current;

  useEffect(() => {
    const play = () => {
      if (reduce) {
        v.setValue(1);
        return;
      }
      v.setValue(0);
      Animated.timing(v, {
        toValue: 1,
        duration: 520,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    };
    play();
    const unsub = navigation.addListener('focus', play);
    return unsub;
  }, [navigation, reduce, v]);

  return (
    <Animated.View
      style={{
        flex: 1,
        opacity: v,
        transform: [
          {
            translateY: v.interpolate({
              inputRange: [0, 1],
              outputRange: [18, 0],
            }),
          },
        ],
      }}
    >
      {children}
    </Animated.View>
  );
}
