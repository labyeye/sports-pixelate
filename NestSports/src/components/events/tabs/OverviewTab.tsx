import React, { useEffect, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import {
  Users,
  UserCheck,
  CalendarClock,
  CheckCircle2,
  IndianRupee,
  Wallet,
  Award,
  Percent,
} from 'lucide-react-native';
import { KpiTile, Card, SectionTitle, Row } from '../../ui';
import { colors, FONT } from '../../../theme/colors';
import { eventAPI } from '../../../api/client';
import { Text } from 'react-native';

export default function OverviewTab({ event }: { event: any }) {
  const [stats, setStats] = useState<any>(null);

  useEffect(() => {
    let alive = true;
    eventAPI
      .getDashboard(event._id)
      .then((res: any) => {
        if (alive) setStats(res.data || {});
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [event._id]);

  return (
    <View>
      <Card>
        <SectionTitle title="About" />
        {event.description ? (
          <Text style={styles.description}>{event.description}</Text>
        ) : (
          <Text style={styles.muted}>No description added.</Text>
        )}
        {event.organizerName ? (
          <Row title="Organizer" subtitle={event.organizerName} noBorder />
        ) : null}
        {event.contactPerson ? (
          <Row title="Contact Person" subtitle={event.contactPerson} noBorder />
        ) : null}
        {event.mobileNumber ? (
          <Row title="Mobile" subtitle={event.mobileNumber} noBorder />
        ) : null}
      </Card>
      <View style={styles.grid}>
        <KpiTile
          label="Registrations"
          value={stats?.totalRegistrations ?? event.registrationCount ?? 0}
          color={colors.blue}
          icon={Users}
        />
        <KpiTile
          label="Participants"
          value={stats?.totalParticipants ?? 0}
          color={colors.green}
          icon={UserCheck}
        />
        <KpiTile
          label="Upcoming Sessions"
          value={stats?.upcomingSessions ?? 0}
          color={colors.orange}
          icon={CalendarClock}
        />
        <KpiTile
          label="Completed Sessions"
          value={stats?.completedSessions ?? 0}
          color={colors.purple}
          icon={CheckCircle2}
        />
        <KpiTile
          label="Revenue"
          value={stats?.revenue ? `₹${stats.revenue}` : '₹0'}
          color={colors.blue}
          icon={IndianRupee}
        />
        <KpiTile
          label="Pending Payments"
          value={stats?.pendingPayments ?? 0}
          color={colors.red}
          icon={Wallet}
        />
        <KpiTile
          label="Certificates Issued"
          value={stats?.certificatesIssued ?? 0}
          color={colors.lime}
          icon={Award}
        />
        <KpiTile
          label="Attendance"
          value={stats?.attendancePercent != null ? `${stats.attendancePercent}%` : '—'}
          color={colors.muted}
          icon={Percent}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  description: { fontFamily: FONT.medium, fontSize: 13, color: colors.black, marginBottom: 6 },
  muted: { fontFamily: FONT.medium, fontSize: 12, color: colors.muted, marginBottom: 6 },
});
