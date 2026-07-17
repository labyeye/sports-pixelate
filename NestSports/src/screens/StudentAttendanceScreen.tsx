import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ScrollView,
  View,
  Text,
  TouchableOpacity,
  TextInput,
  RefreshControl,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { launchCamera } from 'react-native-image-picker';
import {
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  XCircle,
  AlertCircle,
  MinusCircle,
  Save,
  Users,
  CalendarClock,
  Search,
  X,
  Trophy,
  UserCog,
  ClipboardCheck,
  ScanFace,
} from 'lucide-react-native';
import {
  studentAPI,
  studentAttendanceAPI,
  sportAPI,
  employeeAPI,
  RNFile,
} from '../api/client';
import { Card, EmptyState, LoadingView, Avatar } from '../components/ui';
import { colors, FONT } from '../theme/colors';
import { useAuth } from '../contexts/AuthContext';

const STATUS_COLORS: Record<string, string> = {
  present: colors.green,
  late: colors.orange,
  absent: colors.red,
  excused: colors.orange,
};

const STATUS_ICONS: Record<string, typeof CheckCircle2> = {
  present: CheckCircle2,
  late: CalendarClock,
  absent: XCircle,
  excused: AlertCircle,
};

type MarkStatus = 'present' | 'late' | 'absent';

const MARK_OPTIONS: { value: MarkStatus; label: string }[] = [
  { value: 'present', label: 'Present' },
  { value: 'late', label: 'Late' },
  { value: 'absent', label: 'Absent' },
];

// Builds a local (device-timezone) YYYY-MM-DD string, matching the format
// the server expects — never use toISOString() here, it shifts by the UTC
// offset and can land on the wrong calendar day.
function toDateStr(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(
    2,
    '0',
  )}-${String(d.getDate()).padStart(2, '0')}`;
}

// Parses a "YYYY-MM-DD" string as local midnight (not UTC midnight, which is
// what `new Date("YYYY-MM-DD")` would give and can shift the day when the
// device is ahead of UTC).
function fromDateStr(s: string) {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

type MarkStep = 'closed' | 'sport' | 'coach' | 'list';

export default function StudentAttendanceScreen() {
  const { user } = useAuth();
  const [isCoach, setIsCoach] = useState(false);
  const [checkingRole, setCheckingRole] = useState(true);

  const todayStr = useMemo(() => toDateStr(new Date()), []);
  const [selectedDate, setSelectedDate] = useState(todayStr);
  // The most recent date shown in the 7-day chip strip; paging moves this by
  // a week at a time but never past today.
  const [weekEnd, setWeekEnd] = useState(todayStr);

  // ── Full roster + this-month's records (read-only list) ──────────────────
  const [students, setStudents] = useState<any[]>([]);
  const [rosterLoading, setRosterLoading] = useState(true);
  const [monthRecords, setMonthRecords] = useState<any[]>([]);
  const [recordsLoading, setRecordsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');

  // ── Mark-attendance wizard ─────────────────────────────────────────────
  const [markStep, setMarkStep] = useState<MarkStep>('closed');
  const [sports, setSports] = useState<any[]>([]);
  const [coaches, setCoaches] = useState<any[]>([]);
  const [sportChoice, setSportChoice] = useState('');
  const [coachChoice, setCoachChoice] = useState('');
  const [markStudents, setMarkStudents] = useState<any[]>([]);
  const [marks, setMarks] = useState<Record<string, MarkStatus>>({});
  const [markLoading, setMarkLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [verifyingFaceId, setVerifyingFaceId] = useState<string | null>(null);

  const weekScrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    weekScrollRef.current?.scrollToEnd({ animated: false });
  }, [weekEnd]);

  useEffect(() => {
    if (user?.role !== 'employee') {
      setCheckingRole(false);
      return;
    }
    employeeAPI
      .getMe()
      .then((res: any) => setIsCoach(res?.data?.role === 'coach'))
      .catch(() => {})
      .finally(() => setCheckingRole(false));
  }, [user?.role]);

  const loadRoster = useCallback(() => {
    return studentAPI
      .getAll({ status: 'active' })
      .then((res: any) => setStudents(res.data || []));
  }, []);

  const loadMonthRecords = useCallback((dateStr: string) => {
    const d = fromDateStr(dateStr);
    return studentAttendanceAPI
      .getAll({ month: String(d.getMonth() + 1), year: String(d.getFullYear()) })
      .then((res: any) => setMonthRecords(res.data || []));
  }, []);

  useEffect(() => {
    if (checkingRole) return;
    setRosterLoading(true);
    loadRoster()
      .catch(() => {})
      .finally(() => setRosterLoading(false));
  }, [checkingRole, loadRoster]);

  useEffect(() => {
    if (checkingRole || markStep !== 'closed') return;
    setRecordsLoading(true);
    loadMonthRecords(selectedDate)
      .catch(() => {})
      .finally(() => setRecordsLoading(false));
  }, [checkingRole, markStep, selectedDate, loadMonthRecords]);

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([loadRoster(), loadMonthRecords(selectedDate)]).catch(
      () => {},
    );
    setRefreshing(false);
  };

  // ── Week strip ────────────────────────────────────────────────────────
  const weekDates = useMemo(() => {
    const end = fromDateStr(weekEnd);
    const arr: string[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(end);
      d.setDate(d.getDate() - i);
      arr.push(toDateStr(d));
    }
    return arr;
  }, [weekEnd]);

  const shiftWeek = (n: number) => {
    setWeekEnd(prev => {
      const d = fromDateStr(prev);
      d.setDate(d.getDate() + n * 7);
      const next = toDateStr(d);
      return next > todayStr ? todayStr : next;
    });
  };

  const jumpToToday = () => {
    setWeekEnd(todayStr);
    setSelectedDate(todayStr);
  };

  const isFutureWeek = weekEnd >= todayStr;

  // ── Wizard control ────────────────────────────────────────────────────
  const openWizard = () => {
    setSportChoice('');
    setCoachChoice('');
    setMarks({});
    setMarkStudents([]);
    if (isCoach) {
      startList('', '');
    } else {
      setMarkStep('sport');
      if (sports.length === 0) {
        sportAPI
          .getAll()
          .then((res: any) => setSports(res.data || []))
          .catch(() => {});
      }
      if (coaches.length === 0) {
        employeeAPI
          .getAll({ role: 'coach' })
          .then((res: any) => setCoaches(res.data || []))
          .catch(() => {});
      }
    }
  };

  const closeWizard = () => setMarkStep('closed');

  const pickSport = (name: string) => {
    setSportChoice(name);
    setMarkStep('coach');
  };

  const coachOptions = useMemo(
    () => (sportChoice ? coaches.filter(c => c.sport === sportChoice) : coaches),
    [coaches, sportChoice],
  );

  const startList = (sport: string, coach: string) => {
    setMarkStep('list');
    setMarkLoading(true);
    const params: Record<string, string> = { status: 'active' };
    if (sport) params.sport = sport;
    if (coach) params.coach = coach;
    const d = fromDateStr(selectedDate);
    Promise.all([
      studentAPI.getAll(params),
      studentAttendanceAPI.getAll({
        month: String(d.getMonth() + 1),
        year: String(d.getFullYear()),
      }),
    ])
      .then(([studentsRes, attRes]: any[]) => {
        const list = studentsRes.data || [];
        setMarkStudents(list);
        const existing: Record<string, MarkStatus> = {};
        (attRes.data || []).forEach((r: any) => {
          if (r.date?.slice(0, 10) === selectedDate && r.student?._id) {
            existing[r.student._id] =
              r.status === 'present' || r.status === 'late'
                ? r.status
                : 'absent';
          }
        });
        setMarks(existing);
      })
      .catch(() => {})
      .finally(() => setMarkLoading(false));
  };

  const pickCoach = (coachId: string) => {
    setCoachChoice(coachId);
    startList(sportChoice, coachId);
  };

  const setStudentStatus = (studentId: string, status: MarkStatus) => {
    setMarks(p => ({ ...p, [studentId]: status }));
  };

  // Coach points the camera at the student; a match marks them present
  // immediately (server-side), same verification flow as employee check-in.
  // Only offered for today — a selfie can't retroactively verify a past day.
  const verifyFaceForStudent = (s: any) => {
    launchCamera({ mediaType: 'photo', quality: 0.7, cameraType: 'front' }, async r => {
      const asset = r.assets?.[0];
      if (!asset?.uri) return;
      const selfie: RNFile = {
        uri: asset.uri,
        name: asset.fileName || `selfie_${Date.now()}.jpg`,
        type: asset.type || 'image/jpeg',
      };
      setVerifyingFaceId(s._id);
      try {
        await studentAttendanceAPI.markByFace(
          { student: s._id, date: selectedDate, batch: s.batch },
          selfie,
        );
        setMarks(p => ({ ...p, [s._id]: 'present' }));
      } catch (e: any) {
        Alert.alert('Face check-in failed', e?.message || 'Could not verify face');
      } finally {
        setVerifyingFaceId(null);
      }
    });
  };

  const visibleMarkStudents = useMemo(() => {
    if (!search.trim()) return markStudents;
    const q = search.trim().toLowerCase();
    return markStudents.filter(s =>
      `${s.firstName} ${s.lastName}`.toLowerCase().includes(q),
    );
  }, [markStudents, search]);

  const markSummary = useMemo(
    () => ({
      total: markStudents.length,
      present: markStudents.filter(s => (marks[s._id] || 'absent') === 'present').length,
      late: markStudents.filter(s => marks[s._id] === 'late').length,
      absent: markStudents.filter(s => (marks[s._id] || 'absent') === 'absent').length,
    }),
    [markStudents, marks],
  );

  const saveAll = async () => {
    if (markStudents.length === 0) {
      Alert.alert('No students', 'There are no students to mark here');
      return;
    }
    const records = markStudents.map(s => ({
      student: s._id,
      status: marks[s._id] || 'absent',
      batch: s.batch,
    }));
    setSaving(true);
    try {
      await studentAttendanceAPI.bulkMark({ date: selectedDate, records });
      Alert.alert('Saved', `Attendance saved for ${records.length} student(s)`);
      closeWizard();
      setSearch('');
      await loadMonthRecords(selectedDate);
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Could not save attendance');
    } finally {
      setSaving(false);
    }
  };

  // ── Read-only roster for the selected date ────────────────────────────
  const recordByStudent = useMemo(() => {
    const map: Record<string, any> = {};
    monthRecords.forEach((r: any) => {
      if (r.date?.slice(0, 10) === selectedDate && r.student?._id) {
        map[r.student._id] = r;
      }
    });
    return map;
  }, [monthRecords, selectedDate]);

  const visibleRoster = useMemo(() => {
    if (!search.trim()) return students;
    const q = search.trim().toLowerCase();
    return students.filter(s =>
      `${s.firstName} ${s.lastName}`.toLowerCase().includes(q),
    );
  }, [students, search]);

  const rosterSummary = useMemo(() => {
    let marked = 0;
    students.forEach(s => {
      if (recordByStudent[s._id]) marked += 1;
    });
    return { total: students.length, marked, unmarked: students.length - marked };
  }, [students, recordByStudent]);

  if (checkingRole) return <LoadingView />;

  return (
    <SafeAreaView edges={['top']} style={styles.screen}>
      <View style={styles.screen}>
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <ClipboardCheck size={18} color={colors.blue} strokeWidth={2.5} />
            <Text style={styles.headerTitle}>Student Attendance</Text>
          </View>
          {markStep === 'closed' && (
            <TouchableOpacity
              style={styles.markIconBtn}
              onPress={openWizard}
              activeOpacity={0.8}
            >
              <ClipboardCheck size={15} color={colors.white} strokeWidth={2.5} />
              <Text style={styles.markIconBtnText}>Mark</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* ── Mark-attendance wizard ─────────────────────────────────────── */}
        {markStep === 'sport' && (
          <ScrollView contentContainerStyle={{ padding: 16 }}>
            <View style={styles.wizardHeaderRow}>
              <TouchableOpacity onPress={closeWizard} style={styles.backBtn}>
                <ChevronLeft size={18} color={colors.black} strokeWidth={2.5} />
              </TouchableOpacity>
              <Text style={styles.wizardTitle}>Which sport?</Text>
            </View>
            {sports.length === 0 ? (
              <Card>
                <EmptyState title="No sports configured" icon={Trophy} />
              </Card>
            ) : (
              sports.map(sp => (
                <TouchableOpacity
                  key={sp._id}
                  style={styles.optionRow}
                  onPress={() => pickSport(sp.name)}
                  activeOpacity={0.7}
                >
                  <Trophy size={16} color={colors.blue} strokeWidth={2.5} />
                  <Text style={styles.optionText}>{sp.name}</Text>
                  <Text style={styles.optionSub}>
                    {sp.studentCount ?? 0} students
                  </Text>
                </TouchableOpacity>
              ))
            )}
          </ScrollView>
        )}

        {markStep === 'coach' && (
          <ScrollView contentContainerStyle={{ padding: 16 }}>
            <View style={styles.wizardHeaderRow}>
              <TouchableOpacity
                onPress={() => setMarkStep('sport')}
                style={styles.backBtn}
              >
                <ChevronLeft size={18} color={colors.black} strokeWidth={2.5} />
              </TouchableOpacity>
              <Text style={styles.wizardTitle}>Which coach? · {sportChoice}</Text>
            </View>
            <TouchableOpacity
              style={styles.optionRow}
              onPress={() => pickCoach('')}
              activeOpacity={0.7}
            >
              <UserCog size={16} color={colors.blue} strokeWidth={2.5} />
              <Text style={styles.optionText}>All coaches</Text>
            </TouchableOpacity>
            {coachOptions.length === 0 ? (
              <Card>
                <EmptyState title="No coaches for this sport" icon={UserCog} />
              </Card>
            ) : (
              coachOptions.map(c => (
                <TouchableOpacity
                  key={c._id}
                  style={styles.optionRow}
                  onPress={() => pickCoach(c._id)}
                  activeOpacity={0.7}
                >
                  <UserCog size={16} color={colors.blue} strokeWidth={2.5} />
                  <Text style={styles.optionText}>
                    {c.firstName} {c.lastName}
                  </Text>
                </TouchableOpacity>
              ))
            )}
          </ScrollView>
        )}

        {markStep === 'list' && (
          <>
            <View style={styles.wizardHeaderRow}>
              <TouchableOpacity
                onPress={() => (isCoach ? closeWizard() : setMarkStep('coach'))}
                style={styles.backBtn}
              >
                <ChevronLeft size={18} color={colors.black} strokeWidth={2.5} />
              </TouchableOpacity>
              <Text style={styles.wizardTitle} numberOfLines={1}>
                {isCoach
                  ? `Mark Attendance · ${fromDateStr(selectedDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}`
                  : `${sportChoice}${coachChoice ? ' · selected coach' : ' · all coaches'}`}
              </Text>
            </View>

            <View style={styles.searchWrap}>
              <Search size={15} color={colors.muted} />
              <TextInput
                style={styles.searchInput}
                value={search}
                onChangeText={setSearch}
                placeholder="Search by student name…"
                placeholderTextColor={colors.muted}
              />
              {search.length > 0 && (
                <TouchableOpacity onPress={() => setSearch('')}>
                  <X size={14} color={colors.muted} />
                </TouchableOpacity>
              )}
            </View>

            {markLoading ? (
              <LoadingView />
            ) : (
              <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 90 }}>
                <View style={styles.summaryRow}>
                  <View style={styles.summaryPill}>
                    <Text style={[styles.summaryValue, { color: colors.blue }]}>
                      {markSummary.total}
                    </Text>
                    <Text style={styles.summaryLabel}>Total</Text>
                  </View>
                  <View style={styles.summaryPill}>
                    <Text style={[styles.summaryValue, { color: colors.green }]}>
                      {markSummary.present}
                    </Text>
                    <Text style={styles.summaryLabel}>Present</Text>
                  </View>
                  <View style={styles.summaryPill}>
                    <Text style={[styles.summaryValue, { color: colors.orange }]}>
                      {markSummary.late}
                    </Text>
                    <Text style={styles.summaryLabel}>Late</Text>
                  </View>
                  <View style={styles.summaryPill}>
                    <Text style={[styles.summaryValue, { color: colors.red }]}>
                      {markSummary.absent}
                    </Text>
                    <Text style={styles.summaryLabel}>Absent</Text>
                  </View>
                </View>

                {visibleMarkStudents.length === 0 ? (
                  <Card>
                    <EmptyState
                      title={
                        markStudents.length === 0
                          ? 'No active students found'
                          : 'No students match your search'
                      }
                      icon={Users}
                    />
                  </Card>
                ) : (
                  visibleMarkStudents.map(s => {
                    const current: MarkStatus = marks[s._id] || 'absent';
                    return (
                      <Card
                        key={s._id}
                        accentColor={STATUS_COLORS[current] || '#E5E7EB'}
                      >
                        <View style={styles.studentRow}>
                          <Avatar uri={s.avatar} name={s.firstName} size={36} />
                          <View style={{ flex: 1, minWidth: 0 }}>
                            <Text style={styles.studentName} numberOfLines={1}>
                              {s.firstName} {s.lastName}
                            </Text>
                            <Text style={styles.studentMeta} numberOfLines={1}>
                              {s.sport}
                              {s.batch ? ` · ${s.batch}` : ''}
                            </Text>
                          </View>
                          {selectedDate === todayStr && (
                            <TouchableOpacity
                              style={styles.faceVerifyBtn}
                              onPress={() => verifyFaceForStudent(s)}
                              disabled={verifyingFaceId === s._id}
                            >
                              {verifyingFaceId === s._id ? (
                                <ActivityIndicator size="small" color={colors.blue} />
                              ) : (
                                <ScanFace size={18} color={colors.blue} strokeWidth={2.5} />
                              )}
                            </TouchableOpacity>
                          )}
                        </View>
                        <View style={styles.statusRow}>
                          {MARK_OPTIONS.map(opt => {
                            const selected = current === opt.value;
                            const color = STATUS_COLORS[opt.value];
                            return (
                              <TouchableOpacity
                                key={opt.value}
                                style={[
                                  styles.statusBtn,
                                  selected && {
                                    backgroundColor: color,
                                    borderColor: color,
                                  },
                                ]}
                                onPress={() => setStudentStatus(s._id, opt.value)}
                                activeOpacity={0.7}
                              >
                                <Text
                                  style={[
                                    styles.statusBtnText,
                                    selected && styles.statusBtnTextActive,
                                  ]}
                                >
                                  {opt.label}
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
            )}

            {markStudents.length > 0 && (
              <TouchableOpacity
                style={styles.saveBar}
                onPress={saveAll}
                disabled={saving}
              >
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
          </>
        )}

        {/* ── Date tabs + full roster (read-only) ───────────────────────── */}
        {markStep === 'closed' && (
          <>
            <View style={styles.searchWrap}>
              <Search size={15} color={colors.muted} />
              <TextInput
                style={styles.searchInput}
                value={search}
                onChangeText={setSearch}
                placeholder="Search by student name…"
                placeholderTextColor={colors.muted}
              />
              {search.length > 0 && (
                <TouchableOpacity onPress={() => setSearch('')}>
                  <X size={14} color={colors.muted} />
                </TouchableOpacity>
              )}
            </View>

            <View style={styles.weekBar}>
              <TouchableOpacity onPress={() => shiftWeek(-1)} style={styles.dateNavBtn}>
                <ChevronLeft size={16} color={colors.black} strokeWidth={2.5} />
              </TouchableOpacity>
              <ScrollView
                ref={weekScrollRef}
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.weekScrollContent}
              >
                {weekDates.map(dateStr => {
                  const d = fromDateStr(dateStr);
                  const active = dateStr === selectedDate;
                  const isToday = dateStr === todayStr;
                  return (
                    <TouchableOpacity
                      key={dateStr}
                      style={[styles.dayChip, active && styles.dayChipActive]}
                      onPress={() => setSelectedDate(dateStr)}
                      activeOpacity={0.8}
                    >
                      <Text
                        style={[
                          styles.dayChipDow,
                          active && styles.dayChipTextActive,
                        ]}
                      >
                        {DAY_LABELS[d.getDay()]}
                      </Text>
                      <Text
                        style={[
                          styles.dayChipNum,
                          active && styles.dayChipTextActive,
                        ]}
                      >
                        {d.getDate()}
                      </Text>
                      {isToday && !active && <View style={styles.todayDot} />}
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
              <TouchableOpacity
                onPress={() => shiftWeek(1)}
                style={styles.dateNavBtn}
                disabled={isFutureWeek}
              >
                <ChevronRight
                  size={16}
                  color={isFutureWeek ? '#D1D5DB' : colors.black}
                  strokeWidth={2.5}
                />
              </TouchableOpacity>
            </View>

            {rosterLoading || recordsLoading ? (
              <LoadingView />
            ) : (
              <ScrollView
                contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
                refreshControl={
                  <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
                }
              >
                <View style={styles.summaryRow}>
                  <View style={styles.summaryPill}>
                    <Text style={[styles.summaryValue, { color: colors.blue }]}>
                      {rosterSummary.total}
                    </Text>
                    <Text style={styles.summaryLabel}>Total</Text>
                  </View>
                  <View style={styles.summaryPill}>
                    <Text style={[styles.summaryValue, { color: colors.green }]}>
                      {rosterSummary.marked}
                    </Text>
                    <Text style={styles.summaryLabel}>Marked</Text>
                  </View>
                  <View style={styles.summaryPill}>
                    <Text style={[styles.summaryValue, { color: colors.muted }]}>
                      {rosterSummary.unmarked}
                    </Text>
                    <Text style={styles.summaryLabel}>Not Marked</Text>
                  </View>
                </View>

                {visibleRoster.length === 0 ? (
                  <Card>
                    <EmptyState
                      title={
                        students.length === 0
                          ? 'No active students found'
                          : 'No students match your search'
                      }
                      icon={Users}
                    />
                  </Card>
                ) : (
                  visibleRoster.map(s => {
                    const record = recordByStudent[s._id];
                    const status = record?.status as string | undefined;
                    const Icon = status ? STATUS_ICONS[status] || AlertCircle : MinusCircle;
                    const color = status ? STATUS_COLORS[status] || colors.muted : '#D1D5DB';
                    return (
                      <Card key={s._id} accentColor={color}>
                        <View style={styles.studentRow}>
                          <Avatar uri={s.avatar} name={s.firstName} size={36} />
                          <View style={{ flex: 1, minWidth: 0 }}>
                            <Text style={styles.studentName} numberOfLines={1}>
                              {s.firstName} {s.lastName}
                            </Text>
                            <Text style={styles.studentMeta} numberOfLines={1}>
                              {s.sport}
                              {s.batch ? ` · ${s.batch}` : ''}
                            </Text>
                            {record?.markedBy?.name && (
                              <View style={styles.markedByRow}>
                                <UserCog size={11} color={colors.muted} strokeWidth={2.5} />
                                <Text style={styles.markedByText} numberOfLines={1}>
                                  Marked by {record.markedBy.name}
                                </Text>
                              </View>
                            )}
                          </View>
                          <View style={styles.historyStatus}>
                            <Icon size={14} color={color} strokeWidth={2.5} />
                            <Text style={[styles.historyStatusText, { color }]}>
                              {status || 'Not marked'}
                            </Text>
                          </View>
                        </View>
                      </Card>
                    );
                  })
                )}
              </ScrollView>
            )}
          </>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.white,
    borderBottomWidth: 2,
    borderBottomColor: colors.black,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerTitle: {
    fontFamily: FONT.bold,
    fontWeight: '700',
    fontSize: 17,
    color: colors.black,
  },
  markIconBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: colors.blue,
    borderWidth: 2,
    borderColor: colors.black,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  markIconBtnText: {
    color: colors.white,
    fontFamily: FONT.bold,
    fontWeight: '800',
    fontSize: 12,
    textTransform: 'uppercase',
  },
  weekBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderBottomWidth: 2,
    borderBottomColor: colors.black,
    paddingVertical: 8,
    paddingHorizontal: 6,
    gap: 4,
  },
  weekScrollContent: { gap: 6, paddingHorizontal: 4 },
  dayChip: {
    width: 44,
    paddingVertical: 8,
    borderWidth: 2,
    borderColor: '#E5E7EB',
    backgroundColor: colors.white,
    alignItems: 'center',
  },
  dayChipActive: { backgroundColor: colors.blue, borderColor: colors.black },
  dayChipDow: {
    fontFamily: FONT.bold,
    fontWeight: '700',
    fontSize: 9,
    color: colors.muted,
    textTransform: 'uppercase',
  },
  dayChipNum: {
    fontFamily: FONT.bold,
    fontWeight: '800',
    fontSize: 15,
    color: colors.black,
    marginTop: 2,
  },
  dayChipTextActive: { color: colors.white },
  todayDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.blue,
    marginTop: 3,
  },
  dateNavBtn: {
    width: 28,
    height: 28,
    borderWidth: 2,
    borderColor: colors.black,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateInfoBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.white,
    borderBottomWidth: 2,
    borderBottomColor: colors.black,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  dateInfoText: {
    fontFamily: FONT.bold,
    fontWeight: '700',
    fontSize: 13,
    color: colors.black,
  },
  todayLink: {
    fontFamily: FONT.bold,
    fontWeight: '700',
    fontSize: 12,
    color: colors.blue,
    textTransform: 'uppercase',
  },
  wizardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.white,
    borderBottomWidth: 2,
    borderBottomColor: colors.black,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  backBtn: {
    width: 32,
    height: 32,
    borderWidth: 2,
    borderColor: colors.black,
    alignItems: 'center',
    justifyContent: 'center',
  },
  wizardTitle: {
    flex: 1,
    fontFamily: FONT.bold,
    fontWeight: '700',
    fontSize: 15,
    color: colors.black,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 2,
    borderColor: colors.black,
    backgroundColor: colors.white,
    paddingHorizontal: 14,
    paddingVertical: 14,
    marginBottom: 10,
  },
  optionText: {
    flex: 1,
    fontFamily: FONT.bold,
    fontWeight: '700',
    fontSize: 14,
    color: colors.black,
  },
  optionSub: {
    fontFamily: FONT.medium,
    fontSize: 11,
    color: colors.muted,
  },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.white,
    borderBottomWidth: 2,
    borderBottomColor: colors.black,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  searchInput: {
    flex: 1,
    fontFamily: FONT.medium,
    fontSize: 14,
    color: colors.black,
  },
  sectionLabel: {
    fontFamily: FONT.bold,
    fontWeight: '700',
    fontSize: 11,
    color: colors.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 10,
  },
  summaryRow: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  summaryPill: {
    flex: 1,
    borderWidth: 2,
    borderColor: colors.black,
    backgroundColor: colors.white,
    paddingVertical: 8,
    alignItems: 'center',
  },
  summaryValue: { fontFamily: FONT.bold, fontWeight: '800', fontSize: 18 },
  summaryLabel: {
    fontFamily: FONT.bold,
    fontWeight: '700',
    fontSize: 9,
    color: colors.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
    marginTop: 2,
  },
  studentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  studentName: {
    fontFamily: FONT.bold,
    fontWeight: '700',
    fontSize: 14,
    color: colors.black,
  },
  studentMeta: {
    fontFamily: FONT.medium,
    fontSize: 12,
    color: colors.muted,
    marginTop: 1,
  },
  markedByRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 3,
  },
  markedByText: {
    fontFamily: FONT.medium,
    fontSize: 10,
    color: colors.muted,
    fontStyle: 'italic',
  },
  faceVerifyBtn: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: colors.blue,
  },
  statusRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
  },
  statusBtn: {
    flex: 1,
    borderWidth: 2,
    borderColor: '#E5E7EB',
    backgroundColor: colors.white,
    paddingVertical: 8,
    alignItems: 'center',
  },
  statusBtnText: {
    fontFamily: FONT.bold,
    fontWeight: '700',
    fontSize: 11,
    color: colors.muted,
    textTransform: 'uppercase',
  },
  statusBtnTextActive: { color: colors.white },
  historyStatus: { alignItems: 'center', gap: 2 },
  historyStatusText: {
    fontFamily: FONT.bold,
    fontWeight: '700',
    fontSize: 10,
    textTransform: 'capitalize',
  },
  saveBar: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 16,
    backgroundColor: colors.blue,
    borderWidth: 2,
    borderColor: colors.black,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  saveBarText: {
    color: colors.white,
    fontFamily: FONT.bold,
    fontWeight: '800',
    fontSize: 14,
  },
});
