import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { C } from '../../theme';
import { useResponsive } from '../../theme/responsive';

interface Props {
  children: React.ReactNode;
  title: string;
  right?: React.ReactNode;
  loading?: boolean;
}

export default function ScreenLayout({
  children,
  title,
  right,
  loading,
}: Props) {
  const { isTablet, maxContentWidth } = useResponsive();

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <View
          style={[
            styles.headerInner,
            isTablet && {
              maxWidth: maxContentWidth,
              alignSelf: 'center',
              width: '100%',
            },
          ]}
        >
          <Text style={styles.title}>{title}</Text>
          {right && <View>{right}</View>}
        </View>
      </View>
      {loading ? (
        <View style={styles.loader}>
          <ActivityIndicator size="large" color={C.primary} />
        </View>
      ) : (
        <View
          style={[
            styles.body,
            isTablet && {
              maxWidth: maxContentWidth,
              width: '100%',
              alignSelf: 'center',
            },
          ]}
        >
          {children}
        </View>
      )}
    </SafeAreaView>
  );
}

export function HeaderBtn({
  label,
  onPress,
  color = C.primary,
  icon,
}: {
  label: string;
  onPress: () => void;
  color?: string;
  icon?: React.ReactNode;
}) {
  // With an icon the action is icon-only (no border or fill) so the header keeps its space.
  if (React.isValidElement(icon)) {
    return (
      <TouchableOpacity
        onPress={onPress}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel={label}
        style={{ padding: 4 }}
      >
        {React.cloneElement(icon as React.ReactElement<any>, {
          size: 24,
          color,
        })}
      </TouchableOpacity>
    );
  }
  return (
    <TouchableOpacity
      style={[styles.headerBtn, { borderColor: color, backgroundColor: color }]}
      onPress={onPress}
    >
      <Text style={styles.headerBtnText}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 2,
    borderBottomColor: '#000',
  },
  headerInner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: { fontSize: 20, fontWeight: '400', color: '#000' },
  body: { flex: 1 },
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  headerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 2,
    borderRadius: 8,
    borderRightWidth: 4,
    borderBottomWidth: 4,
    borderRightColor: '#0A0A0A',
    borderBottomColor: '#0A0A0A',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  headerBtnText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '400',
  },
});
