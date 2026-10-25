import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { ArrowLeft } from 'lucide-react-native';
import { colors, FONT } from '../theme/colors';

interface Props {
  title: string;
  right?: React.ReactNode;
  // Force the back button on/off. By default it shows whenever there is a
  // screen to go back to, except on bottom-tab roots.
  showBack?: boolean;
  onBack?: () => void;
}

// Shared screen header: back button, title and optional right-side actions.
export default function ScreenHeader({
  title,
  right,
  showBack,
  onBack,
}: Props) {
  return (
    <View style={styles.header}>
      <BackTitle title={title} showBack={showBack} onBack={onBack} />
      {right ? <View style={styles.actions}>{right}</View> : null}
    </View>
  );
}

// Back button + title, for screens that already draw their own header row.
export function BackTitle({ title, showBack, onBack }: Omit<Props, 'right'>) {
  const navigation = useNavigation<any>();
  const canGoBack = navigation.canGoBack();
  const back = showBack ?? canGoBack;
  return (
    <View style={styles.left}>
      {back && (
        <TouchableOpacity
          onPress={onBack ?? (() => navigation.goBack())}
          style={styles.iconBtn}
          hitSlop={8}
        >
          <ArrowLeft size={20} color={colors.black} strokeWidth={2.5} />
        </TouchableOpacity>
      )}
      <Text style={styles.title} numberOfLines={1}>
        {title}
      </Text>
    </View>
  );
}

export function HeaderAction({
  onPress,
  children,
}: {
  onPress: () => void;
  children: React.ReactNode;
}) {
  return (
    <TouchableOpacity onPress={onPress} style={styles.iconBtn} hitSlop={8}>
      {children}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: colors.white,
    borderBottomWidth: 2,
    borderBottomColor: colors.black,
  },
  left: { flexShrink: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  title: {
    flexShrink: 1,
    fontSize: 20,
    fontWeight: '800',
    color: colors.black,
    fontFamily: FONT.bold,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginLeft: 10,
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

// Plain header action: no border or background, just the icon.
export const headerBtn = {
  width: 36,
  height: 36,
  alignItems: 'center',
  justifyContent: 'center',
} as const;
