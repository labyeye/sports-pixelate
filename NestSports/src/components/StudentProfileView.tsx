import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import {
  BadgeCheck,
  CalendarDays,
  GraduationCap,
  Layers,
  Phone,
  Trophy,
  UserRound,
  type LucideIcon,
} from 'lucide-react-native';
import { colors, FONT } from '../theme/colors';
import {
  InfoPills,
  Pill,
  ProfileHero,
  SOFT,
  SoftBars,
  SoftCard,
} from './profile';

const cap = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

// Student profile as a soft "person card": photo hero, swipeable info pills,
// an attendance bar card, then plans and tournaments. Shared by the staff
// student directory and the parent's report screen.
export function StudentProfileView({
  profile,
  statusLabel,
  statusColor,
  onBack,
  backIcon,
  onShare,
  shareIcon,
}: {
  profile: any;
  statusLabel?: string;
  statusColor?: string;
  onBack?: () => void;
  backIcon?: LucideIcon;
  onShare?: () => void;
  shareIcon?: LucideIcon;
}) {
  const st = profile.student || {};
  const att = profile.attendance || {};
  const subs: any[] = profile.subscriptions || [];
  const tournaments: any[] = profile.tournaments || [];
  const name = `${st.firstName || ''} ${st.lastName || ''}`.trim();

  const pills: Pill[] = [
    { icon: Trophy, label: 'Sport', value: st.sport || '—' },
    { icon: Layers, label: 'Batch', value: st.batch || '—' },
    {
      icon: UserRound,
      label: 'Coach',
      value: st.coach ? `${st.coach.firstName} ${st.coach.lastName}` : '—',
    },
    {
      icon: CalendarDays,
      label: 'Enrolled',
      value: st.enrollmentDate
        ? new Date(st.enrollmentDate).toLocaleDateString('en-IN', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
          })
        : '—',
    },
    ...(statusLabel
      ? [
          {
            icon: BadgeCheck,
            label: 'Status',
            value: statusLabel,
            color: statusColor,
          },
        ]
      : []),
    ...(st.guardians || []).map((g: any) => ({
      icon: Phone,
      label: cap(g.relation || 'Guardian'),
      value: g.phone ? `${g.name} · ${g.phone}` : g.name,
    })),
  ];

  return (
    <View>
      <ProfileHero
        uri={st.avatar}
        name={name || 'Student'}
        subtitle={[st.studentId, st.sport].filter(Boolean).join(' · ')}
        leftIcon={backIcon}
        onLeft={onBack}
        rightIcon={shareIcon}
        onRight={onShare}
      />
      <InfoPills items={pills} />

      <SoftCard>
        <View style={styles.rowBetween}>
          <View>
            <Text style={styles.cardLabel}>Attendance</Text>
            <Text style={styles.big}>{att.rate || 0}%</Text>
          </View>
          <View style={styles.rateChip}>
            <GraduationCap size={14} color={colors.blue} strokeWidth={2.2} />
            <Text style={styles.rateChipText}>Overall rate</Text>
          </View>
        </View>
        <SoftBars
          data={[
            { label: 'Present', value: att.present || 0, color: colors.green },
            { label: 'Late', value: att.late || 0, color: colors.yellow },
            { label: 'Absent', value: att.absent || 0, color: colors.red },
            { label: 'Excused', value: att.excused || 0, color: colors.blue },
          ]}
        />
      </SoftCard>

      <SoftCard>
        <Text style={styles.cardLabel}>Subscriptions</Text>
        {subs.length === 0 ? (
          <Text style={styles.empty}>No subscriptions</Text>
        ) : (
          subs.map((s: any, i: number) => (
            <View key={s._id || i} style={styles.listRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.listTitle}>{s.planName}</Text>
                <Text style={styles.listSub}>
                  ₹{s.amountPaid || 0} / ₹{s.amount || 0}
                </Text>
              </View>
              <View style={styles.statusChip}>
                <Text style={styles.statusChipText}>
                  {String(s.status || '').replace(/_/g, ' ')}
                </Text>
              </View>
            </View>
          ))
        )}
      </SoftCard>

      <SoftCard>
        <Text style={styles.cardLabel}>Tournaments</Text>
        {tournaments.length === 0 ? (
          <Text style={styles.empty}>No tournament history</Text>
        ) : (
          tournaments.map((t: any, i: number) => (
            <View key={i} style={styles.listRow}>
              <View style={styles.trophyDot}>
                <Trophy size={14} color={colors.purple} strokeWidth={2.2} />
              </View>
              <View style={{ flex: 1, marginLeft: 10 }}>
                <Text style={styles.listTitle}>{t.eventName}</Text>
                <Text style={styles.listSub}>
                  {t.activity} · {t.team || 'Individual'} · {t.status}
                </Text>
              </View>
            </View>
          ))
        )}
      </SoftCard>
    </View>
  );
}

const styles = StyleSheet.create({
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  cardLabel: { fontFamily: FONT.medium, fontSize: 13, color: SOFT.sub },
  big: {
    fontFamily: FONT.bold,
    fontSize: 30,
    fontWeight: '700',
    color: SOFT.text,
    marginTop: 4,
  },
  rateChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: SOFT.chip,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  rateChipText: {
    fontFamily: FONT.medium,
    fontSize: 12,
    color: colors.blue,
  },
  empty: {
    fontFamily: FONT.medium,
    fontSize: 13,
    color: SOFT.sub,
    marginTop: 10,
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E9F0',
  },
  listTitle: {
    fontFamily: FONT.bold,
    fontSize: 14,
    fontWeight: '700',
    color: SOFT.text,
  },
  listSub: {
    fontFamily: FONT.medium,
    fontSize: 12,
    color: SOFT.sub,
    marginTop: 2,
  },
  statusChip: {
    backgroundColor: '#E8F0FB',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  statusChipText: {
    fontFamily: FONT.bold,
    fontSize: 11,
    fontWeight: '700',
    color: colors.blue,
    textTransform: 'capitalize',
  },
  trophyDot: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F3E8FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
