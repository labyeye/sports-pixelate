import React, { useCallback, useEffect, useState } from "react";
import { ScrollView, View, Text, RefreshControl, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Users, Clock, GraduationCap, CalendarClock, Wallet, IndianRupee, CalendarDays, Building2 } from "lucide-react-native";
import { dashboardAPI, payrollAPI } from "../api/client";
import { KpiTile, LoadingView, EmptyState } from "../components/ui";
import { colors } from "../theme/colors";

function formatCurrency(n: number) {
  return `₹${Math.round(n || 0).toLocaleString("en-IN")}`;
}

export default function ReportsScreen() {
  const [stats, setStats] = useState<any>(null);
  const [paidCount, setPaidCount] = useState(0);
  const [processedCount, setProcessedCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const now = new Date();
    const [dashRes, payrollRes] = await Promise.all([
      dashboardAPI.getStats(),
      payrollAPI.getAll({ month: String(now.getMonth() + 1), year: String(now.getFullYear()) }),
    ]);
    if ((dashRes as any).success) setStats((dashRes as any).data.stats);
    const payrolls: any[] = (payrollRes as any).data || [];
    setPaidCount(payrolls.filter((p) => p.status === "paid").length);
    setProcessedCount(payrolls.filter((p) => p.status === "processed").length);
  }, []);

  useEffect(() => {
    load()
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load().catch(() => {});
    setRefreshing(false);
  };

  if (loading) return <LoadingView />;
  if (!stats) return <EmptyState title="Couldn't load reports summary" />;

  return (
    <SafeAreaView edges={["top"]} style={styles.screen}>
      <ScrollView
        style={styles.screen}
        contentContainerStyle={{ padding: 16 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <Text style={styles.title}>Reports</Text>
        <Text style={styles.subtitle}>Quick summary across the academy</Text>

        <View style={styles.kpiGrid}>
          <KpiTile label="Total Employees" value={stats.totalEmployees} sub={`${stats.activeEmployees} active`} color={colors.blue} icon={Users} />
          <KpiTile label="Attendance Rate" value={`${stats.attendanceRate}%`} sub={`${stats.todayPresent} present today`} color={colors.orange} icon={Clock} />
          <KpiTile label="Total Students" value={stats.totalStudents} sub="Active enrollments" color={colors.purple} icon={GraduationCap} />
          <KpiTile label="Bookings" value={stats.totalBookings} sub={`${stats.todayBookings} today`} color={colors.orange} icon={CalendarClock} />
          <KpiTile label="Subscription Income" value={formatCurrency(stats.subscriptionIncome)} sub="This month" color={colors.green} icon={Wallet} />
          <KpiTile label="Monthly Payroll" value={formatCurrency(stats.monthlyPayroll)} sub={`${paidCount} paid, ${processedCount} pending`} color={colors.orange} icon={IndianRupee} />
          <KpiTile label="Pending Leaves" value={stats.pendingLeaves} sub="Awaiting approval" color={colors.blue} icon={CalendarDays} />
          <KpiTile label="Departments" value={stats.departments} sub="Active teams" color={colors.green} icon={Building2} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  title: { fontSize: 24, fontWeight: "800", color: colors.black },
  subtitle: { color: colors.muted, marginTop: 2, marginBottom: 16 },
  kpiGrid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between" },
});
