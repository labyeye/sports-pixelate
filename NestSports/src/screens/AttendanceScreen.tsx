import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ScrollView, View, Text, TouchableOpacity, RefreshControl, StyleSheet, ActivityIndicator, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ChevronLeft, ChevronRight, CheckCircle2, XCircle, Clock, Clock3, CalendarDays, Save, Users } from "lucide-react-native";
import { employeeAPI, attendanceAPI } from "../api/client";
import { Card, EmptyState, LoadingView, Avatar } from "../components/ui";
import { colors, FONT } from "../theme/colors";

const STATUS_OPTIONS = ["present", "absent", "late", "half_day", "on_leave"] as const;
type Status = (typeof STATUS_OPTIONS)[number];

const STATUS_LABELS: Record<Status, string> = {
  present: "Present",
  absent: "Absent",
  late: "Late",
  half_day: "Half Day",
  on_leave: "On Leave",
};

const STATUS_COLORS: Record<Status, string> = {
  present: colors.green,
  absent: colors.red,
  late: colors.orange,
  half_day: colors.orange,
  on_leave: colors.blue,
};

const STATUS_ICONS: Record<Status, typeof CheckCircle2> = {
  present: CheckCircle2,
  absent: XCircle,
  late: Clock,
  half_day: Clock3,
  on_leave: CalendarDays,
};

function toDateStr(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function AttendanceScreen() {
  const [date, setDate] = useState(() => toDateStr(new Date()));
  const [employees, setEmployees] = useState<any[]>([]);
  const [marks, setMarks] = useState<Record<string, Status>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    const d = new Date(date);
    return Promise.all([
      employeeAPI.getAll({ status: "active" }),
      attendanceAPI.getAll({ month: String(d.getMonth() + 1), year: String(d.getFullYear()) }),
    ]).then(([empRes, attRes]: any[]) => {
      setEmployees(empRes.data || []);
      const existing: Record<string, Status> = {};
      (attRes.data || []).forEach((r: any) => {
        if (r.date?.slice(0, 10) === date && r.employee?._id && STATUS_LABELS[r.status as Status]) {
          existing[r.employee._id] = r.status;
        }
      });
      setMarks(existing);
    });
  }, [date]);

  useEffect(() => {
    setLoading(true);
    load()
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load().catch(() => {});
    setRefreshing(false);
  };

  const shiftDate = (days: number) => {
    const d = new Date(date);
    d.setDate(d.getDate() + days);
    setDate(toDateStr(d));
  };

  const setStatus = (employeeId: string, status: Status) => {
    setMarks((p) => ({ ...p, [employeeId]: status }));
  };

  const summary = useMemo(
    () => ({
      total: employees.length,
      present: employees.filter((e) => marks[e._id] === "present").length,
      absent: employees.filter((e) => marks[e._id] === "absent").length,
      onLeave: employees.filter((e) => marks[e._id] === "on_leave").length,
      unmarked: employees.filter((e) => !marks[e._id]).length,
    }),
    [employees, marks],
  );

  const saveAll = async () => {
    const records = employees
      .filter((e) => marks[e._id])
      .map((e) => ({ employee: e._id, status: marks[e._id], verifyMode: "manual" }));
    if (records.length === 0) {
      Alert.alert("Nothing to save", "Mark at least one employee first");
      return;
    }
    setSaving(true);
    try {
      await attendanceAPI.bulkMark({ date, records });
      Alert.alert("Saved", `Attendance saved for ${records.length} employee(s)`);
    } catch (e: any) {
      Alert.alert("Error", e?.message || "Could not save attendance");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <LoadingView />;

  return (
    <SafeAreaView edges={["top"]} style={styles.screen}>
      <View style={styles.screen}>
        <View style={styles.dateBar}>
          <TouchableOpacity onPress={() => shiftDate(-1)} style={styles.dateNavBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <ChevronLeft size={18} color={colors.black} strokeWidth={2.5} />
          </TouchableOpacity>
          <Text style={styles.dateText}>
            {new Date(date).toLocaleDateString("en-IN", { weekday: "short", day: "2-digit", month: "short", year: "numeric" })}
          </Text>
          <TouchableOpacity onPress={() => shiftDate(1)} style={styles.dateNavBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <ChevronRight size={18} color={colors.black} strokeWidth={2.5} />
          </TouchableOpacity>
        </View>

        <ScrollView
          contentContainerStyle={{ padding: 16, paddingBottom: 90 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          <View style={styles.summaryRow}>
            {[
              { label: "Total", value: summary.total, color: colors.blue },
              { label: "Present", value: summary.present, color: colors.green },
              { label: "Absent", value: summary.absent, color: colors.red },
              { label: "On Leave", value: summary.onLeave, color: colors.blue },
              { label: "Unmarked", value: summary.unmarked, color: colors.muted },
            ].map((s) => (
              <View key={s.label} style={styles.summaryPill}>
                <Text style={[styles.summaryValue, { color: s.color }]}>{s.value}</Text>
                <Text style={styles.summaryLabel}>{s.label}</Text>
              </View>
            ))}
          </View>

          {employees.length === 0 ? (
            <Card>
              <EmptyState title="No active staff" icon={Users} />
            </Card>
          ) : (
            employees.map((e) => {
              const current = marks[e._id] as Status | undefined;
              return (
                <Card key={e._id} accentColor={current ? STATUS_COLORS[current] : "#E5E7EB"}>
                  <View style={styles.empRow}>
                    <Avatar uri={e.avatar} name={e.firstName} size={36} />
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={styles.empName} numberOfLines={1}>
                        {e.firstName} {e.lastName}
                      </Text>
                      <Text style={styles.empMeta} numberOfLines={1}>
                        {e.designation || e.department?.name || "-"}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.statusRow}>
                    {STATUS_OPTIONS.map((opt) => {
                      const Icon = STATUS_ICONS[opt];
                      const selected = current === opt;
                      return (
                        <TouchableOpacity
                          key={opt}
                          onPress={() => setStatus(e._id, opt)}
                          style={[
                            styles.statusChip,
                            selected
                              ? { backgroundColor: STATUS_COLORS[opt], borderColor: colors.black }
                              : { backgroundColor: colors.white, borderColor: "#D1D5DB" },
                          ]}
                        >
                          <Icon size={12} color={selected ? colors.white : colors.muted} strokeWidth={2.5} />
                          <Text style={[styles.statusChipText, { color: selected ? colors.white : colors.muted }]}>
                            {STATUS_LABELS[opt]}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </Card>
              );
            })
          )}
        </ScrollView>

        {employees.length > 0 && (
          <TouchableOpacity style={styles.saveBar} onPress={saveAll} disabled={saving}>
            {saving ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <>
                <Save size={16} color={colors.white} strokeWidth={2.5} />
                <Text style={styles.saveBarText}>Save Attendance</Text>
              </>
            )}
          </TouchableOpacity>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  dateBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.white,
    borderBottomWidth: 2,
    borderBottomColor: colors.black,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  dateNavBtn: {
    width: 32,
    height: 32,
    borderWidth: 2,
    borderColor: colors.black,
    alignItems: "center",
    justifyContent: "center",
  },
  dateText: { fontFamily: FONT.bold, fontWeight: "700", fontSize: 14, color: colors.black },
  summaryRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 14 },
  summaryPill: {
    flexGrow: 1,
    flexBasis: "18%",
    borderWidth: 2,
    borderColor: colors.black,
    backgroundColor: colors.white,
    paddingVertical: 8,
    alignItems: "center",
  },
  summaryValue: { fontFamily: FONT.bold, fontWeight: "800", fontSize: 18 },
  summaryLabel: {
    fontFamily: FONT.bold,
    fontWeight: "700",
    fontSize: 9,
    color: colors.muted,
    textTransform: "uppercase",
    letterSpacing: 0.3,
    marginTop: 2,
  },
  empRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 10 },
  empName: { fontFamily: FONT.bold, fontWeight: "700", fontSize: 14, color: colors.black },
  empMeta: { fontFamily: FONT.medium, fontSize: 12, color: colors.muted, marginTop: 1 },
  statusRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  statusChip: {
    flexGrow: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    borderWidth: 2,
    paddingVertical: 7,
    paddingHorizontal: 6,
    minWidth: "31%",
  },
  statusChipText: {
    fontFamily: FONT.bold,
    fontWeight: "700",
    fontSize: 10,
    textTransform: "capitalize",
  },
  saveBar: {
    position: "absolute",
    left: 16,
    right: 16,
    bottom: 16,
    backgroundColor: colors.blue,
    borderWidth: 2,
    borderColor: colors.black,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  saveBarText: { color: colors.white, fontFamily: FONT.bold, fontWeight: "800", fontSize: 14 },
});
