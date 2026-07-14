import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ScrollView, View, Text, TouchableOpacity, RefreshControl, StyleSheet, ActivityIndicator, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ChevronLeft, ChevronRight, CheckCircle2, XCircle, AlertCircle, Save, Users } from "lucide-react-native";
import { studentAPI, studentAttendanceAPI } from "../api/client";
import { Card, EmptyState, LoadingView, Avatar } from "../components/ui";
import { colors, FONT } from "../theme/colors";

const STATUS_OPTIONS = ["present", "absent", "excused"] as const;
type Status = (typeof STATUS_OPTIONS)[number];

const STATUS_COLORS: Record<Status, string> = {
  present: colors.green,
  absent: colors.red,
  excused: colors.orange,
};

const STATUS_ICONS: Record<Status, typeof CheckCircle2> = {
  present: CheckCircle2,
  absent: XCircle,
  excused: AlertCircle,
};

function toDateStr(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function StudentAttendanceScreen() {
  const [date, setDate] = useState(() => toDateStr(new Date()));
  const [students, setStudents] = useState<any[]>([]);
  const [marks, setMarks] = useState<Record<string, Status>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    const d = new Date(date);
    return Promise.all([
      studentAPI.getAll({ status: "active" }),
      studentAttendanceAPI.getAll({ month: String(d.getMonth() + 1), year: String(d.getFullYear()) }),
    ]).then(([studentsRes, attRes]: any[]) => {
      setStudents(studentsRes.data || []);
      const existing: Record<string, Status> = {};
      (attRes.data || []).forEach((r: any) => {
        if (r.date?.slice(0, 10) === date && r.student?._id) existing[r.student._id] = r.status;
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

  const setStatus = (studentId: string, status: Status) => {
    setMarks((p) => ({ ...p, [studentId]: p[studentId] === status ? p[studentId] : status }));
  };

  const summary = useMemo(
    () => ({
      total: students.length,
      present: students.filter((s) => marks[s._id] === "present").length,
      absent: students.filter((s) => marks[s._id] === "absent").length,
      excused: students.filter((s) => marks[s._id] === "excused").length,
      unmarked: students.filter((s) => !marks[s._id]).length,
    }),
    [students, marks],
  );

  const saveAll = async () => {
    const records = students
      .filter((s) => marks[s._id])
      .map((s) => ({ student: s._id, status: marks[s._id], batch: s.batch }));
    if (records.length === 0) {
      Alert.alert("Nothing to save", "Mark at least one student first");
      return;
    }
    setSaving(true);
    try {
      await studentAttendanceAPI.bulkMark({ date, records });
      Alert.alert("Saved", `Attendance saved for ${records.length} student(s)`);
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
              { label: "Excused", value: summary.excused, color: colors.orange },
              { label: "Unmarked", value: summary.unmarked, color: colors.muted },
            ].map((s) => (
              <View key={s.label} style={styles.summaryPill}>
                <Text style={[styles.summaryValue, { color: s.color }]}>{s.value}</Text>
                <Text style={styles.summaryLabel}>{s.label}</Text>
              </View>
            ))}
          </View>

          {students.length === 0 ? (
            <Card>
              <EmptyState title="No active students" icon={Users} />
            </Card>
          ) : (
            students.map((s) => {
              const current = marks[s._id];
              return (
                <Card key={s._id} accentColor={current ? STATUS_COLORS[current] : "#E5E7EB"}>
                  <View style={styles.studentRow}>
                    <Avatar uri={s.avatar} name={s.firstName} size={36} />
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={styles.studentName} numberOfLines={1}>
                        {s.firstName} {s.lastName}
                      </Text>
                      <Text style={styles.studentMeta} numberOfLines={1}>
                        {s.sport}
                        {s.batch ? ` · ${s.batch}` : ""}
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
                          onPress={() => setStatus(s._id, opt)}
                          style={[
                            styles.statusChip,
                            selected
                              ? { backgroundColor: STATUS_COLORS[opt], borderColor: colors.black }
                              : { backgroundColor: colors.white, borderColor: "#D1D5DB" },
                          ]}
                        >
                          <Icon size={13} color={selected ? colors.white : colors.muted} strokeWidth={2.5} />
                          <Text style={[styles.statusChipText, { color: selected ? colors.white : colors.muted }]}>
                            {opt}
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

        {students.length > 0 && (
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
  studentRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 10 },
  studentName: { fontFamily: FONT.bold, fontWeight: "700", fontSize: 14, color: colors.black },
  studentMeta: { fontFamily: FONT.medium, fontSize: 12, color: colors.muted, marginTop: 1 },
  statusRow: { flexDirection: "row", gap: 8 },
  statusChip: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    borderWidth: 2,
    paddingVertical: 7,
  },
  statusChipText: {
    fontFamily: FONT.bold,
    fontWeight: "700",
    fontSize: 11,
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
