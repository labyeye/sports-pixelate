import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Modal,
  ScrollView,
  Platform,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { launchCamera } from 'react-native-image-picker';
import {
  Clock,
  Search,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Calendar,
  LogIn,
  LogOut,
  X,
  Pencil,
  Trophy,
  ScanFace,
} from 'lucide-react-native';
import { studentAttendanceAPI, studentAPI, RNFile } from '../api/client';
import { colors, FONT } from '../theme/colors';
import { DateTimeField } from '../components/ui';
import { requestSelfMarkPermissions } from '../utils/location';

// Mirrors AttendanceScreen's (staff) STATUS_CONFIG 1:1 — same colors, same
// bg tints, same icon set — so the two attendance screens read as one
// consistent design instead of two different apps bolted together.
const STATUS_CONFIG: Record<string, { color: string; bg: string; icon: any }> = {
  present: { color: colors.green, bg: '#E7F9F1', icon: CheckCircle2 },
  absent: { color: colors.red, bg: '#FDEBEB', icon: XCircle },
  late: { color: colors.yellow, bg: '#FEF3E2', icon: AlertCircle },
  excused: { color: colors.blue, bg: '#E8F0FB', icon: Calendar },
  not_marked: { color: '#9CA3AF', bg: '#F3F4F6', icon: Clock },
};

function toDateStr(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function timeToISO(dateStr: string, timeStr: string): string | undefined {
  if (!timeStr) return undefined;
  return `${dateStr}T${timeStr}:00+05:30`;
}

function isoToTime(iso: string | undefined): string {
  if (!iso) return '';
  return new Date(iso).toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

export default function StudentAttendanceScreen() {
  const [records, setRecords] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [dateFilter, setDateFilter] = useState(toDateStr(new Date()));
  const [statusFilter, setStatusFilter] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [editRecord, setEditRecord] = useState<any | null>(null);
  const [form, setForm] = useState({
    status: 'present',
    checkIn: '',
    checkOut: '',
    notes: '',
  });

  // Calendar modal state
  const [showCalendar, setShowCalendar] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState({
    year: new Date().getFullYear(),
    month: new Date().getMonth(),
  });

  // Bulk modal state
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [bulkStatus, setBulkStatus] = useState('present');
  const [bulkSelected, setBulkSelected] = useState<string[]>([]);
  const [bulkSaving, setBulkSaving] = useState(false);
  const [markingByFaceId, setMarkingByFaceId] = useState<string | null>(null);

  const todayStr = toDateStr(new Date());

  const load = useCallback(
    async (showLoader = true) => {
      if (showLoader) {
        setLoading(true);
        setRecords([]);
      }
      try {
        const d = new Date(dateFilter + 'T00:00:00');
        const res: any = await studentAttendanceAPI.getAll({
          month: String(d.getMonth() + 1),
          year: String(d.getFullYear()),
          limit: '200',
        });
        const all: any[] = res.data || [];
        const forDate = all.filter(r =>
          r.date ? toDateStr(new Date(r.date)) === dateFilter : false,
        );
        setRecords(forDate);
      } catch (e: any) {
        Alert.alert('Error', e.message);
      } finally {
        setLoading(false);
      }
    },
    [dateFilter],
  );

  const loadStudents = useCallback(async () => {
    try {
      const res: any = await studentAPI.getAll({ status: 'active' });
      setStudents(res.data || []);
    } catch {}
  }, []);

  useEffect(() => {
    load();
  }, [load]);
  useEffect(() => {
    loadStudents();
  }, [loadStudents]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load(false);
    setRefreshing(false);
  };

  const openNew = () => {
    setEditRecord(null);
    setSelectedStudentId('');
    setForm({ status: 'present', checkIn: '', checkOut: '', notes: '' });
    setShowModal(true);
  };

  const openMarkForStudent = (studentId: string) => {
    setEditRecord(null);
    setSelectedStudentId(studentId);
    setForm({ status: 'present', checkIn: '', checkOut: '', notes: '' });
    setShowModal(true);
  };

  const markAbsent = (studentId: string) => {
    Alert.alert('Mark Absent', `Mark this student as absent for ${dateFilter}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Mark Absent',
        style: 'destructive',
        onPress: async () => {
          try {
            await studentAttendanceAPI.mark({
              student: studentId,
              date: dateFilter,
              status: 'absent',
            });
            await load();
          } catch (e: any) {
            Alert.alert('Error', e.message);
          }
        },
      },
    ]);
  };

  // Coach-scanned face check-in: verifies the live photo against the
  // student's enrolled face embedding server-side and marks them present.
  const markByFace = async (student: any) => {
    const ok = await requestSelfMarkPermissions();
    if (!ok) {
      Alert.alert('Permission Required', 'Camera access is required to scan a face.');
      return;
    }
    launchCamera(
      { mediaType: 'photo', quality: 0.8, cameraType: 'front', saveToPhotos: false },
      async result => {
        const asset = result.assets?.[0];
        if (!asset?.uri) return;
        setMarkingByFaceId(student._id);
        try {
          const selfie: RNFile = {
            uri: asset.uri,
            type: asset.type || 'image/jpeg',
            name: asset.fileName || `face_mark_${Date.now()}.jpg`,
          };
          await studentAttendanceAPI.markByFace(
            { student: student._id, date: dateFilter, batch: student.batch },
            selfie,
          );
          Alert.alert('Success', `${student.firstName} marked present.`);
          await load();
        } catch (e: any) {
          Alert.alert('Face Mismatch', e.message || 'Could not verify face');
        } finally {
          setMarkingByFaceId(null);
        }
      },
    );
  };

  const openEdit = (record: any) => {
    setEditRecord(record);
    const st = record.student;
    setSelectedStudentId(st?._id || '');
    setForm({
      status: record.status,
      checkIn: isoToTime(record.checkIn),
      checkOut: isoToTime(record.checkOut),
      notes: record.notes || '',
    });
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditRecord(null);
  };

  const mergedRows = (() => {
    const recordByStudentId = new Map(records.map(r => [r.student?._id, r]));
    return students.map(st => {
      const existing = recordByStudentId.get(st._id);
      if (existing) return existing;
      return {
        _id: `v_${st._id}`,
        student: st,
        date: dateFilter,
        status: 'not_marked',
      };
    });
  })();

  const filtered = mergedRows.filter(r => {
    const st = r.student;
    const name = st ? `${st.firstName || ''} ${st.lastName || ''}`.toLowerCase() : '';
    if (search && !name.includes(search.toLowerCase())) return false;
    if (statusFilter && r.status !== statusFilter) return false;
    return true;
  });

  const handleSave = async () => {
    if (!selectedStudentId) {
      Alert.alert('Validation', 'Please select a student');
      return;
    }
    setSaving(true);
    try {
      await studentAttendanceAPI.mark({
        student: selectedStudentId,
        date: dateFilter,
        status: form.status,
        checkIn: timeToISO(dateFilter, form.checkIn),
        checkOut: timeToISO(dateFilter, form.checkOut),
        notes: form.notes || undefined,
      });
      closeModal();
      await load();
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setSaving(false);
    }
  };

  const shiftDate = (n: number) => {
    const d = new Date(dateFilter + 'T00:00:00');
    d.setDate(d.getDate() + n);
    setDateFilter(toDateStr(d));
  };

  const summary: Record<string, number> = {};
  Object.keys(STATUS_CONFIG).forEach(s => {
    summary[s] = 0;
  });
  mergedRows.forEach(r => {
    if (r.status in summary) summary[r.status]++;
  });

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Clock size={20} color={colors.blue} strokeWidth={2.5} />
          <Text style={styles.headerTitle}>Student Attendance</Text>
        </View>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <TouchableOpacity
            style={styles.bulkBtn}
            onPress={() => {
              setBulkSelected([]);
              setBulkStatus('present');
              setShowBulkModal(true);
            }}
          >
            <CheckCircle2 size={14} color={colors.blue} strokeWidth={2.5} />
            <Text style={styles.bulkBtnText}>Bulk</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.addBtn} onPress={openNew}>
            <CheckCircle2 size={14} color={colors.white} strokeWidth={2.5} />
            <Text style={styles.addBtnText}>Mark</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.dateRow}>
        <TouchableOpacity onPress={() => shiftDate(-1)} style={styles.dateBtnArrow}>
          <Text style={styles.dateBtnArrowText}>‹</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.dateCurrent}
          onPress={() => {
            const d = new Date(dateFilter + 'T00:00:00');
            setCalendarMonth({ year: d.getFullYear(), month: d.getMonth() });
            setShowCalendar(true);
          }}
          activeOpacity={0.7}
        >
          <Calendar size={13} color={colors.blue} strokeWidth={2.5} />
          <Text style={styles.dateCurrentText}>
            {new Date(dateFilter + 'T00:00:00').toLocaleDateString('en-IN', {
              weekday: 'short',
              day: 'numeric',
              month: 'short',
              year: 'numeric',
            })}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => shiftDate(1)} style={styles.dateBtnArrow}>
          <Text style={styles.dateBtnArrowText}>›</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.summaryBar}
        contentContainerStyle={styles.summaryContent}
      >
        {Object.entries(summary).map(([status, count]) => {
          const active = statusFilter === status;
          const cfg = STATUS_CONFIG[status];
          return (
            <TouchableOpacity
              key={status}
              style={[
                styles.summaryPill,
                { backgroundColor: active ? cfg.color : cfg.bg, borderColor: cfg.color },
              ]}
              onPress={() => setStatusFilter(p => (p === status ? '' : status))}
              activeOpacity={0.8}
            >
              <Text style={[styles.summaryCount, { color: active ? colors.white : cfg.color }]}>
                {count}
              </Text>
              <Text style={[styles.summaryStatus, { color: active ? colors.white : cfg.color }]}>
                {status.replace('_', ' ')}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <View style={styles.searchWrap}>
        <Search size={15} color={colors.muted} />
        <TextInput
          style={styles.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder="Search by student…"
          placeholderTextColor={colors.muted}
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')}>
            <X size={14} color={colors.muted} />
          </TouchableOpacity>
        )}
      </View>

      {loading ? (
        <View style={styles.loader}>
          <ActivityIndicator size="large" color={colors.blue} />
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={item => item._id}
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 32 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.blue} />
          }
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Clock size={40} color="#D1D5DB" />
              <Text style={styles.emptyText}>No records for this date</Text>
            </View>
          }
          renderItem={({ item }) => {
            const st = item.student;
            const cfg = STATUS_CONFIG[item.status] || {
              color: colors.muted,
              bg: '#F3F4F6',
              icon: AlertCircle,
            };
            const Icon = cfg.icon;
            const ciTime = item.checkIn
              ? new Date(item.checkIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
              : null;
            const coTime = item.checkOut
              ? new Date(item.checkOut).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
              : null;
            const initials = st
              ? `${st.firstName?.[0] || ''}${st.lastName?.[0] || ''}`.toUpperCase()
              : '?';
            const ciDate = item.checkIn
              ? new Date(item.checkIn).toLocaleDateString('en-IN', {
                  day: '2-digit',
                  month: 'short',
                  year: 'numeric',
                })
              : null;
            const coDate = item.checkOut
              ? new Date(item.checkOut).toLocaleDateString('en-IN', {
                  day: '2-digit',
                  month: 'short',
                  year: 'numeric',
                })
              : null;
            const statusLabel = item.status.replace(/_/g, ' ').toUpperCase();
            return (
              <View style={[styles.card, { borderColor: colors.black }]}>
                <View style={styles.cardRow}>
                  <View style={styles.photoWrap}>
                    {st?.avatar ? (
                      <Image source={{ uri: st.avatar }} style={styles.stPhoto} />
                    ) : (
                      <View style={[styles.stPhoto, styles.stPhotoFallback, { backgroundColor: cfg.bg }]}>
                        <Text style={[styles.stPhotoInitials, { color: cfg.color }]}>{initials}</Text>
                      </View>
                    )}
                    <View
                      style={[
                        styles.statusBadgeOverlay,
                        { backgroundColor: colors.white, borderColor: cfg.color },
                      ]}
                    >
                      <Icon size={11} color={cfg.color} strokeWidth={2.5} />
                    </View>
                  </View>
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={styles.stName} numberOfLines={1}>
                      {st ? `${st.firstName} ${st.lastName}`.toUpperCase() : 'UNKNOWN'}
                    </Text>
                    <Text style={styles.stSub}>
                      {st?.studentId || ''}
                      {st?.batch ? ` · ${st.batch}` : ''}
                    </Text>
                    {!!st?.sport && (
                      <View style={styles.stSportRow}>
                        <Trophy size={11} color="#9CA3AF" />
                        <Text style={styles.stSportText}>{st.sport}</Text>
                      </View>
                    )}
                  </View>
                  <View style={styles.cardActions}>
                    <View style={[styles.statusTag, { backgroundColor: cfg.bg, borderColor: cfg.color }]}>
                      <Text style={[styles.statusTagText, { color: cfg.color }]}>{statusLabel}</Text>
                    </View>
                    {item._id.startsWith('v_') ? (
                      <View style={{ flexDirection: 'row', gap: 6 }}>
                        <TouchableOpacity
                          style={styles.absentBtn}
                          onPress={() => markAbsent(item.student?._id)}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                          <XCircle size={13} color={colors.white} strokeWidth={2.5} />
                        </TouchableOpacity>
                        {Array.isArray(st?.faceDescriptor) && st.faceDescriptor.length === 128 && (
                          <TouchableOpacity
                            style={styles.faceBtn}
                            onPress={() => markByFace(st)}
                            disabled={markingByFaceId === st._id}
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                          >
                            {markingByFaceId === st._id ? (
                              <ActivityIndicator size="small" color={colors.white} />
                            ) : (
                              <ScanFace size={13} color={colors.white} strokeWidth={2.5} />
                            )}
                          </TouchableOpacity>
                        )}
                        <TouchableOpacity
                          style={styles.markBtn}
                          onPress={() => openMarkForStudent(item.student?._id)}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                          <CheckCircle2 size={13} color={colors.white} strokeWidth={2.5} />
                        </TouchableOpacity>
                      </View>
                    ) : (
                      <TouchableOpacity
                        style={styles.editBtn}
                        onPress={() => openEdit(item)}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <Pencil size={14} color={colors.blue} strokeWidth={2.5} />
                      </TouchableOpacity>
                    )}
                  </View>
                </View>

                {(ciTime || coTime) && (
                  <>
                    <View style={styles.cardDivider} />
                    <View style={styles.statsRow}>
                      <View style={styles.statCol}>
                        <View style={styles.statLabelRow}>
                          <View style={[styles.statIconWrap, { backgroundColor: '#E7F9F1' }]}>
                            <LogIn size={12} color={colors.green} strokeWidth={2.5} />
                          </View>
                          <Text style={styles.statLabel}>Check In</Text>
                        </View>
                        <Text style={styles.statValue}>{ciTime || '--:--'}</Text>
                        {ciDate && <Text style={styles.statSub}>{ciDate}</Text>}
                      </View>
                      <View style={styles.statDivider} />
                      <View style={styles.statCol}>
                        <View style={styles.statLabelRow}>
                          <View style={[styles.statIconWrap, { backgroundColor: '#FDEBEB' }]}>
                            <LogOut size={12} color={colors.red} strokeWidth={2.5} />
                          </View>
                          <Text style={styles.statLabel}>Check Out</Text>
                        </View>
                        <Text style={styles.statValue}>{coTime || '--:--'}</Text>
                        {coDate && <Text style={styles.statSub}>{coDate}</Text>}
                      </View>
                    </View>
                  </>
                )}
                {item.notes && <Text style={styles.noteText}>{item.notes}</Text>}
              </View>
            );
          }}
        />
      )}

      {/* Calendar picker modal */}
      <Modal visible={showCalendar} transparent animationType="slide" onRequestClose={() => setShowCalendar(false)}>
        <TouchableOpacity style={styles.calOverlay} activeOpacity={1} onPress={() => setShowCalendar(false)}>
          <TouchableOpacity activeOpacity={1} style={styles.calSheet}>
            <View style={styles.calNavRow}>
              <TouchableOpacity
                style={styles.calNavBtn}
                onPress={() =>
                  setCalendarMonth(p => (p.month === 0 ? { year: p.year - 1, month: 11 } : { ...p, month: p.month - 1 }))
                }
              >
                <Text style={styles.calNavArrow}>‹</Text>
              </TouchableOpacity>
              <Text style={styles.calMonthLabel}>
                {new Date(calendarMonth.year, calendarMonth.month, 1).toLocaleDateString('en-IN', {
                  month: 'long',
                  year: 'numeric',
                })}
              </Text>
              <TouchableOpacity
                style={styles.calNavBtn}
                onPress={() =>
                  setCalendarMonth(p => (p.month === 11 ? { year: p.year + 1, month: 0 } : { ...p, month: p.month + 1 }))
                }
              >
                <Text style={styles.calNavArrow}>›</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.calDowRow}>
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
                <Text key={d} style={styles.calDowText}>
                  {d}
                </Text>
              ))}
            </View>

            {(() => {
              const { year, month } = calendarMonth;
              const firstDay = new Date(year, month, 1).getDay();
              const daysInMonth = new Date(year, month + 1, 0).getDate();
              const cells: number[] = [];
              for (let i = 0; i < firstDay; i++) cells.push(0);
              for (let d = 1; d <= daysInMonth; d++) cells.push(d);
              while (cells.length % 7 !== 0) cells.push(0);
              const rows: number[][] = [];
              for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));
              return rows.map((row, ri) => (
                <View key={ri} style={styles.calGridRow}>
                  {row.map((day, ci) => {
                    if (day === 0) return <View key={ci} style={styles.calCell} />;
                    const dayStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                    const isSelected = dayStr === dateFilter;
                    const isToday = dayStr === todayStr;
                    return (
                      <TouchableOpacity
                        key={ci}
                        style={[styles.calCell, isSelected && styles.calCellSelected, !isSelected && isToday && styles.calCellToday]}
                        onPress={() => {
                          setDateFilter(dayStr);
                          setShowCalendar(false);
                        }}
                        activeOpacity={0.7}
                      >
                        <Text
                          style={[
                            styles.calCellText,
                            isSelected && styles.calCellTextSelected,
                            !isSelected && isToday && { color: colors.blue },
                          ]}
                        >
                          {day}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              ));
            })()}
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* Bulk attendance modal */}
      <Modal visible={showBulkModal} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowBulkModal(false)}>
        <SafeAreaView style={styles.safe} edges={['top']}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Bulk Attendance</Text>
            <TouchableOpacity onPress={() => setShowBulkModal(false)}>
              <X size={22} color={colors.black} strokeWidth={2.5} />
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 32 }} showsVerticalScrollIndicator={false}>
            <View>
              <Text style={styles.fieldLabel}>Status *</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 6 }}>
                {Object.keys(STATUS_CONFIG)
                  .filter(s => s !== 'not_marked')
                  .map(s => (
                    <TouchableOpacity
                      key={s}
                      style={[styles.selChip, bulkStatus === s && styles.selChipActive]}
                      onPress={() => setBulkStatus(s)}
                    >
                      <Text style={[styles.selChipText, bulkStatus === s && { color: colors.white }]}>
                        {s.replace(/_/g, ' ').toUpperCase()}
                      </Text>
                    </TouchableOpacity>
                  ))}
              </View>
            </View>

            <TouchableOpacity
              style={styles.bulkSelectAllRow}
              onPress={() => {
                if (bulkSelected.length === students.length) {
                  setBulkSelected([]);
                } else {
                  setBulkSelected(students.map(s => s._id));
                }
              }}
            >
              <View style={styles.bulkCheckbox}>
                {bulkSelected.length === students.length && students.length > 0 && (
                  <View style={styles.bulkCheckboxInner} />
                )}
              </View>
              <Text style={styles.bulkSelectAllText}>Select All</Text>
            </TouchableOpacity>

            {students.map(st => {
              const checked = bulkSelected.includes(st._id);
              return (
                <TouchableOpacity
                  key={st._id}
                  style={styles.bulkStRow}
                  onPress={() => setBulkSelected(p => (checked ? p.filter(id => id !== st._id) : [...p, st._id]))}
                  activeOpacity={0.7}
                >
                  <View style={[styles.bulkCheckbox, checked && styles.bulkCheckboxChecked]}>
                    {checked && <View style={styles.bulkCheckboxInner} />}
                  </View>
                  <View style={{ flex: 1, marginLeft: 10 }}>
                    <Text style={styles.stOptionName}>
                      {st.firstName} {st.lastName}
                    </Text>
                    <Text style={styles.stOptionId}>{st.studentId}</Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <View style={{ padding: 16, backgroundColor: colors.white, borderTopWidth: 2, borderTopColor: colors.black }}>
            <TouchableOpacity
              style={[styles.submitBtn, bulkSelected.length === 0 && { opacity: 0.5 }]}
              disabled={bulkSelected.length === 0 || bulkSaving}
              onPress={async () => {
                if (bulkSelected.length === 0) return;
                setBulkSaving(true);
                try {
                  await studentAttendanceAPI.bulkMark({
                    date: dateFilter,
                    records: bulkSelected.map(id => ({ student: id, status: bulkStatus })),
                  });
                  setShowBulkModal(false);
                  await load();
                } catch (e: any) {
                  Alert.alert('Error', e.message);
                } finally {
                  setBulkSaving(false);
                }
              }}
            >
              {bulkSaving ? (
                <ActivityIndicator color={colors.white} />
              ) : (
                <Text style={styles.submitBtnText}>Mark Selected ({bulkSelected.length})</Text>
              )}
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </Modal>

      {/* Single mark/edit modal */}
      <Modal visible={showModal} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={styles.safe} edges={['top']}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{editRecord ? 'Edit Attendance' : 'Mark Attendance'}</Text>
            <TouchableOpacity onPress={closeModal}>
              <X size={22} color={colors.black} strokeWidth={2.5} />
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={{ padding: 20, gap: 16 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            {editRecord ? (
              <View style={styles.editInfoBox}>
                <Text style={styles.editInfoLabel}>Student</Text>
                <Text style={styles.editInfoValue}>
                  {editRecord.student?.firstName} {editRecord.student?.lastName}
                </Text>
              </View>
            ) : (
              <View>
                <Text style={styles.fieldLabel}>Student *</Text>
                <ScrollView style={{ maxHeight: 180 }} nestedScrollEnabled>
                  {students.map(s => (
                    <TouchableOpacity
                      key={s._id}
                      style={[styles.stOption, selectedStudentId === s._id && styles.stOptionActive]}
                      onPress={() => setSelectedStudentId(s._id)}
                    >
                      <Text style={[styles.stOptionName, selectedStudentId === s._id && { color: colors.white }]}>
                        {s.firstName} {s.lastName}
                      </Text>
                      <Text style={[styles.stOptionId, selectedStudentId === s._id && { color: '#93C5FD' }]}>{s.studentId}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}

            <View>
              <Text style={styles.fieldLabel}>Status *</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 6 }}>
                {Object.keys(STATUS_CONFIG)
                  .filter(s => s !== 'not_marked')
                  .map(s => (
                    <TouchableOpacity
                      key={s}
                      style={[styles.selChip, form.status === s && styles.selChipActive]}
                      onPress={() => setForm(p => ({ ...p, status: s }))}
                    >
                      <Text style={[styles.selChipText, form.status === s && { color: colors.white }]}>
                        {s.replace(/_/g, ' ').toUpperCase()}
                      </Text>
                    </TouchableOpacity>
                  ))}
              </View>
            </View>

            <View style={{ flexDirection: 'row', gap: 12 }}>
              <View style={{ flex: 1 }}>
                <DateTimeField label="Check In" mode="time" value={form.checkIn} onChangeText={v => setForm(p => ({ ...p, checkIn: v }))} />
              </View>
              <View style={{ flex: 1 }}>
                <DateTimeField label="Check Out" mode="time" value={form.checkOut} onChangeText={v => setForm(p => ({ ...p, checkOut: v }))} />
              </View>
            </View>

            <View>
              <Text style={styles.fieldLabel}>Notes</Text>
              <TextInput
                style={[styles.fieldInput, { minHeight: 80 }]}
                value={form.notes}
                onChangeText={v => setForm(p => ({ ...p, notes: v }))}
                placeholder="Optional…"
                placeholderTextColor={colors.muted}
                multiline
              />
            </View>

            <TouchableOpacity style={styles.submitBtn} onPress={handleSave} disabled={saving}>
              {saving ? (
                <ActivityIndicator color={colors.white} />
              ) : (
                <Text style={styles.submitBtnText}>{editRecord ? 'Update Attendance' : 'Save Attendance'}</Text>
              )}
            </TouchableOpacity>
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
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
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerTitle: { fontFamily: FONT.bold, fontWeight: '700', fontSize: 20, color: colors.black },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: colors.blue,
    borderWidth: 2,
    borderColor: colors.black,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  addBtnText: { color: colors.white, fontFamily: FONT.bold, fontSize: 12, fontWeight: '700', textTransform: 'uppercase' },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.white,
    borderBottomWidth: 2,
    borderBottomColor: colors.black,
    paddingVertical: 10,
  },
  dateBtnArrow: { width: 44, alignItems: 'center' },
  dateBtnArrowText: { fontSize: 24, fontFamily: FONT.bold, fontWeight: '700', color: colors.black },
  dateCurrent: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dateCurrentText: { fontFamily: FONT.bold, fontSize: 13, fontWeight: '700', color: colors.black },
  summaryBar: { flexShrink: 0, maxHeight: 96, backgroundColor: colors.white, borderBottomWidth: 2, borderBottomColor: colors.black },
  summaryContent: { paddingHorizontal: 12, paddingVertical: 10, flexDirection: 'row', gap: 8 },
  summaryPill: { paddingHorizontal: 14, paddingVertical: 10, borderWidth: 2, alignItems: 'center', justifyContent: 'center', minWidth: 76 },
  summaryCount: {
    fontFamily: FONT.bold,
    fontSize: 20,
    fontWeight: '800',
    lineHeight: Platform.OS === 'android' ? 28 : 24,
    includeFontPadding: false,
  } as any,
  summaryStatus: { fontFamily: FONT.bold, fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4 },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  searchInput: { flex: 1, fontFamily: FONT.medium, fontSize: 14, fontWeight: '500', color: colors.black },
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  empty: { alignItems: 'center', paddingTop: 60, gap: 12 },
  emptyText: { fontFamily: FONT.bold, fontSize: 14, fontWeight: '700', color: colors.muted },
  card: {
    backgroundColor: colors.white,
    borderWidth: 2,
    padding: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  cardRow: { flexDirection: 'row', alignItems: 'center' },
  cardActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  photoWrap: { position: 'relative', width: 48, height: 48 },
  stPhoto: { width: 48, height: 48, borderRadius: 24, borderWidth: 2, borderColor: colors.black },
  stPhotoFallback: { alignItems: 'center', justifyContent: 'center' },
  stPhotoInitials: { fontFamily: FONT.bold, fontSize: 16, fontWeight: '700' },
  statusBadgeOverlay: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stSportRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 },
  stSportText: { fontFamily: FONT.medium, fontSize: 11, color: '#9CA3AF', fontWeight: '500' },
  cardDivider: { height: 1, backgroundColor: '#F0F1F3', marginTop: 12, marginBottom: 10 },
  statsRow: { flexDirection: 'row', alignItems: 'flex-start' },
  statCol: { flex: 1, gap: 3 },
  statDivider: { width: 1, backgroundColor: '#F0F1F3', marginHorizontal: 10 },
  statLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  statIconWrap: { width: 22, height: 22, borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
  statLabel: { fontFamily: FONT.medium, fontSize: 10, color: '#9CA3AF', fontWeight: '600' },
  statValue: { fontFamily: FONT.bold, fontSize: 15, fontWeight: '700', color: colors.black },
  statSub: { fontFamily: FONT.medium, fontSize: 10, color: '#B0B4BA', fontWeight: '500' },
  stName: { fontFamily: FONT.bold, fontSize: 15, fontWeight: '800', color: colors.black, letterSpacing: 0.2 },
  stSub: { fontFamily: FONT.medium, fontSize: 11, color: '#9CA3AF', fontWeight: '600', marginTop: 2 },
  statusTag: { borderWidth: 1.5, paddingHorizontal: 10, paddingVertical: 5 },
  statusTagText: { fontFamily: FONT.bold, fontSize: 9, fontWeight: '700', letterSpacing: 0.3 },
  editBtn: { borderWidth: 1.5, borderColor: colors.blue, padding: 4, backgroundColor: colors.white },
  markBtn: { borderWidth: 1.5, borderColor: colors.blue, borderRadius: 8, padding: 7, backgroundColor: colors.blue },
  absentBtn: { borderWidth: 1.5, borderColor: colors.red, borderRadius: 8, padding: 7, backgroundColor: colors.red },
  faceBtn: { borderWidth: 1.5, borderColor: colors.green, borderRadius: 8, padding: 7, backgroundColor: colors.green, minWidth: 27, alignItems: 'center', justifyContent: 'center' },
  noteText: { fontFamily: FONT.medium, fontSize: 12, color: colors.muted, fontStyle: 'italic', marginTop: 8 },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    backgroundColor: colors.white,
    borderBottomWidth: 2,
    borderBottomColor: colors.black,
  },
  modalTitle: { fontFamily: FONT.bold, fontSize: 20, fontWeight: '700', color: colors.black },
  editInfoBox: { borderWidth: 2, borderColor: colors.blue, backgroundColor: '#EFF6FF', padding: 12 },
  editInfoLabel: { fontFamily: FONT.bold, fontSize: 12, fontWeight: '700', textTransform: 'uppercase', color: colors.blue, marginBottom: 4 },
  editInfoValue: { fontFamily: FONT.bold, fontSize: 15, fontWeight: '700', color: colors.black },
  fieldLabel: { fontFamily: FONT.bold, fontSize: 12, fontWeight: '700', textTransform: 'uppercase', color: colors.black, marginBottom: 5, letterSpacing: 0.5 },
  fieldInput: {
    borderWidth: 2,
    borderColor: colors.black,
    paddingHorizontal: 12,
    paddingVertical: 11,
    fontFamily: FONT.medium,
    fontSize: 14,
    fontWeight: '500',
    color: colors.black,
    backgroundColor: colors.white,
  },
  stOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 4,
    backgroundColor: colors.white,
  },
  stOptionActive: { backgroundColor: colors.blue, borderColor: colors.blue },
  stOptionName: { fontFamily: FONT.bold, fontSize: 13, fontWeight: '700', color: colors.black },
  stOptionId: { fontFamily: FONT.medium, fontSize: 11, color: colors.muted },
  selChip: { borderWidth: 2, borderColor: colors.black, paddingHorizontal: 12, paddingVertical: 6 },
  selChipActive: { backgroundColor: colors.blue },
  selChipText: { fontFamily: FONT.bold, fontSize: 11, fontWeight: '700', color: colors.black },
  submitBtn: { backgroundColor: colors.blue, borderWidth: 2, borderColor: colors.black, paddingVertical: 14, alignItems: 'center', marginTop: 8 },
  submitBtnText: { color: colors.white, fontFamily: FONT.bold, fontWeight: '700', fontSize: 14, textTransform: 'uppercase' },
  bulkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: colors.white,
    borderWidth: 2,
    borderColor: colors.blue,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  bulkBtnText: { color: colors.blue, fontFamily: FONT.bold, fontSize: 12, fontWeight: '700', textTransform: 'uppercase' },
  bulkSelectAllRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 2, borderBottomColor: colors.black, gap: 10 },
  bulkSelectAllText: { fontFamily: FONT.bold, fontSize: 13, fontWeight: '700', color: colors.black, textTransform: 'uppercase' },
  bulkStRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#E5E7EB' },
  bulkCheckbox: { width: 22, height: 22, borderWidth: 2, borderColor: colors.black, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center' },
  bulkCheckboxChecked: { borderColor: colors.blue, backgroundColor: colors.blue },
  bulkCheckboxInner: { width: 10, height: 10, backgroundColor: colors.white },
  calOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  calSheet: { backgroundColor: colors.white, borderTopWidth: 2, borderTopColor: colors.black, paddingHorizontal: 16, paddingTop: 16, paddingBottom: 32 },
  calNavRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  calNavBtn: { width: 36, alignItems: 'center' },
  calNavArrow: { fontFamily: FONT.bold, fontSize: 26, fontWeight: '700', color: colors.black },
  calMonthLabel: { fontFamily: FONT.bold, fontSize: 15, fontWeight: '700', color: colors.black },
  calDowRow: { flexDirection: 'row', marginBottom: 4 },
  calDowText: { flex: 1, textAlign: 'center', fontFamily: FONT.bold, fontSize: 11, fontWeight: '700', color: colors.muted, textTransform: 'uppercase' },
  calGridRow: { flexDirection: 'row', marginBottom: 2 },
  calCell: { flex: 1, height: 40, alignItems: 'center', justifyContent: 'center', margin: 1 },
  calCellSelected: { backgroundColor: colors.blue, borderWidth: 2, borderColor: colors.black },
  calCellToday: { borderWidth: 2, borderColor: colors.blue },
  calCellText: { fontFamily: FONT.medium, fontSize: 13, fontWeight: '600', color: colors.black },
  calCellTextSelected: { color: colors.white, fontFamily: FONT.bold, fontWeight: '700' },
});
