import { useEffect, useRef, useState } from 'react';
import { useIsFocused } from '@react-navigation/native';

/**
 * Bumps a counter each time the screen regains focus (not on first mount - the mount animation already covers that).
 * Tab screens stay mounted, so animations that only run on mount never replay; include this in their effect deps.
 */
export function useFocusReplay(): number {
  const focused = useIsFocused();
  const was = useRef(focused);
  const [n, setN] = useState(0);
  useEffect(() => {
    if (focused && !was.current) setN(x => x + 1);
    was.current = focused;
  }, [focused]);
  return n;
}
