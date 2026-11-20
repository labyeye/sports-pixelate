import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import {
  ArrowLeft,
  CalendarClock,
  Layers,
  LayoutGrid,
  Receipt,
  UserPlus,
  Wallet,
} from 'lucide-react-native';
import { navGroups } from '../navigation/navConfig';
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

// Page icon per screen, taken from the menu config so every main page gets the
// same blue icon NestHR shows next to its title.
const PAGE_ICONS: Record<string, any> = {};
navGroups.forEach(g => g.items.forEach(i => (PAGE_ICONS[i.screen] = i.icon)));
Object.assign(PAGE_ICONS, {
  Groups: Layers,
  Plans: Wallet,
  Subscriptions: Wallet,
  Bookings: CalendarClock,
  ExpenseClaims: Receipt,
  Expenses: Receipt,
  Leads: UserPlus,
  MakeupClasses: CalendarClock,
  Notifications: LayoutGrid,
});

// Title row in NestHR's style: page icon + title, no back arrow on main pages
// (swipe / system back still works). Detail, form and report screens have no
// page icon, so they keep an explicit back arrow.
export function BackTitle({ title, showBack, onBack }: Omit<Props, 'right'>) {
  const navigation = useNavigation<any>();
  const route = useRoute();
  const PageIcon =
    PAGE_ICONS[route.name] || PAGE_ICONS[route.name.replace(/Tab$/, '')];
  const canGoBack = navigation.canGoBack();
  const back = showBack ?? (PageIcon ? false : canGoBack);
  return (
    <View style={styles.left}>
      {PageIcon && !back ? (
        <PageIcon size={20} color={colors.blue} strokeWidth={2.5} />
      ) : null}
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
    fontWeight: '400',
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
  padding: 4,
  alignItems: 'center',
  justifyContent: 'center',
} as const;
