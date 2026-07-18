import React from 'react';
import { FlatList, View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Clock,
  Wallet,
  Users,
  TrendingUp,
  UserPlus,
  Layers,
  Trophy,
  Phone,
  Receipt,
  ChevronRight,
  LucideIcon,
} from 'lucide-react-native';
import { colors, FONT } from '../theme/colors';

// The hub for the new Student Reports section — a simple catalog of the 9
// report screens. Each entry navigates to its own dedicated report screen;
// none of these sub-screens get their own nav-menu entry (see navConfig.ts).
interface ReportEntry {
  title: string;
  desc: string;
  screen: string;
  icon: LucideIcon;
  color: string;
}

const REPORTS: ReportEntry[] = [
  {
    title: 'Student Attendance Report',
    desc: 'Attendance by date, batch, sport & status',
    screen: 'StudentAttendanceReport',
    icon: Clock,
    color: colors.blue,
  },
  {
    title: 'Student Subscription Report',
    desc: 'Plan, payment & verification status',
    screen: 'StudentSubscriptionReport',
    icon: Wallet,
    color: colors.green,
  },
  {
    title: 'Student Directory',
    desc: 'Search & view full student profiles',
    screen: 'StudentDirectory',
    icon: Users,
    color: colors.purple,
  },
  {
    title: 'Student Performance Report',
    desc: 'Attendance rate, tournaments & fee status',
    screen: 'StudentPerformanceReport',
    icon: TrendingUp,
    color: colors.orange,
  },
  {
    title: 'Enrollment Report',
    desc: 'New enrollments & exits over a date range',
    screen: 'StudentEnrollmentReport',
    icon: UserPlus,
    color: colors.blue,
  },
  {
    title: 'Batch Summary',
    desc: 'Student counts & status by batch',
    screen: 'BatchSummaryReport',
    icon: Layers,
    color: colors.green,
  },
  {
    title: 'Sport-wise Summary',
    desc: 'Student counts & revenue by sport',
    screen: 'SportSummaryReport',
    icon: Trophy,
    color: colors.purple,
  },
  {
    title: 'Guardian Contact List',
    desc: 'Parent & guardian phone numbers',
    screen: 'GuardianContactList',
    icon: Phone,
    color: colors.orange,
  },
  {
    title: 'Student Payment History',
    desc: 'Every fee payment with method & UTR',
    screen: 'StudentPaymentHistory',
    icon: Receipt,
    color: colors.blue,
  },
];

export default function StudentReportsScreen({ navigation }: any) {
  return (
    <SafeAreaView edges={['top']} style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Student Reports</Text>
        <Text style={styles.headerSub}>9 reports across attendance, fees & performance</Text>
      </View>
      <FlatList
        data={REPORTS}
        keyExtractor={r => r.screen}
        contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 32 }}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => {
          const Icon = item.icon;
          return (
            <TouchableOpacity
              style={[styles.card, { borderLeftWidth: 4, borderLeftColor: item.color }]}
              activeOpacity={0.85}
              onPress={() => navigation.navigate(item.screen)}
            >
              <View style={[styles.iconWrap, { backgroundColor: item.color }]}>
                <Icon size={18} color={colors.white} strokeWidth={2.5} />
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={styles.title}>{item.title}</Text>
                <Text style={styles.desc} numberOfLines={1}>
                  {item.desc}
                </Text>
              </View>
              <ChevronRight size={18} color={colors.muted} strokeWidth={2.5} />
            </TouchableOpacity>
          );
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.white },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: colors.white,
    borderBottomWidth: 2,
    borderBottomColor: colors.black,
  },
  headerTitle: { fontSize: 20, fontWeight: '800', color: colors.black, fontFamily: FONT.bold },
  headerSub: { color: colors.muted, fontSize: 12, marginTop: 2 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderWidth: 2,
    borderColor: colors.black,
    padding: 14,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderWidth: 2,
    borderColor: colors.black,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontFamily: FONT.bold, fontWeight: '700', fontSize: 14, color: colors.black },
  desc: { fontFamily: FONT.medium, fontSize: 11, color: colors.muted, marginTop: 2 },
});
