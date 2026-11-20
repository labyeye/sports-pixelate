import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing } from 'react-native';

// Smooth expand/collapse: animates height + fade + slight slide; stays mounted until the collapse ends.
export default function Reveal({
  open,
  children,
}: {
  open: boolean;
  children: React.ReactNode;
}) {
  const p = useRef(new Animated.Value(open ? 1 : 0)).current;
  const [h, setH] = useState(0);
  const [mounted, setMounted] = useState(open);

  useEffect(() => {
    if (open) setMounted(true);
    Animated.timing(p, {
      toValue: open ? 1 : 0,
      duration: 260,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start(({ finished }) => {
      if (finished && !open) setMounted(false);
    });
  }, [open, p]);

  if (!mounted) return null;
  return (
    <Animated.View
      style={{
        overflow: 'hidden',
        opacity: p,
        height: h
          ? p.interpolate({ inputRange: [0, 1], outputRange: [0, h] })
          : undefined,
      }}
    >
      <Animated.View
        style={{
          transform: [
            {
              translateY: p.interpolate({
                inputRange: [0, 1],
                outputRange: [-12, 0],
              }),
            },
          ],
        }}
        onLayout={e => setH(e.nativeEvent.layout.height)}
      >
        {children}
      </Animated.View>
    </Animated.View>
  );
}
