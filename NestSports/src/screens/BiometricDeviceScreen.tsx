import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  TextInput,
  Modal,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Cpu,
  MapPin,
  Plus,
  Trash2,
  Edit2,
  X,
  Save,
  Wifi,
  WifiOff,
  Check,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Upload,
  UserCheck,
  Fingerprint,
  Scan,
  CreditCard,
  Hash,
  AlertTriangle,
  Terminal,
  CheckCircle2,
} from 'lucide-react-native';
import {
  biometricAPI,
  employeeAPI,
  studentAPI,
  PersonType,
} from '../api/client';
import { colors, FONT } from '../theme/colors';
import { Button, ChipSelect, LoadingView } from '../components/ui';

interface Location {
  _id: string;
  name: string;
  address?: string;
  description?: string;
  isActive: boolean;
}

interface Device {
  _id: string;
  name: string;
  location: { _id: string; name: string };
  activated: boolean;
  activationCode?: string;
  isActive: boolean;
  lastSeenAt?: string;
  serialNumber?: string;
}

interface Person {
  _id: string;
  firstName: string;
  lastName: string;
  employeeId?: string;
  studentId?: string;
  biometricUserId?: string;
  rfidCard?: string;
  status?: string;
}

interface Command {
  _id: string;
  cmdId: number;
  type: string;
  command: string;
  status: 'pending' | 'sent' | 'done' | 'failed';
  createdAt: string;
}

const EMPTY_LOC = { name: '', address: '', description: '' };
const EMPTY_DEV = { name: '', location: '' };

export default function BiometricDeviceScreen() {
  const [tab, setTab] = useState<'locations' | 'devices' | 'sync'>(
    'locations',
  );
  const [locations, setLocations] = useState<Location[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Location form
  const [locModal, setLocModal] = useState(false);
  const [locForm, setLocForm] = useState(EMPTY_LOC);
  const [editLocId, setEditLocId] = useState<string | null>(null);
  const [locSaving, setLocSaving] = useState(false);

  // Device form
  const [devModal, setDevModal] = useState(false);
  const [devForm, setDevForm] = useState(EMPTY_DEV);
  const [editDevId, setEditDevId] = useState<string | null>(null);
  const [devSaving, setDevSaving] = useState(false);

  const [expandedDev, setExpandedDev] = useState<string | null>(null);

  // Sync tab state
  const [syncDevice, setSyncDevice] = useState<Device | null>(null);
  const [syncSerial, setSyncSerial] = useState('');
  const [serialSaving, setSerialSaving] = useState(false);
  const [personType, setPersonType] = useState<PersonType>('employee');
  const [people, setPeople] = useState<Person[]>([]);
  const [peopleLoading, setPeopleLoading] = useState(false);
  const [syncingAll, setSyncingAll] = useState(false);
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [fpEnrollingId, setFpEnrollingId] = useState<string | null>(null);
  const [faceEnrollingId, setFaceEnrollingId] = useState<string | null>(null);
  const [commands, setCommands] = useState<Command[]>([]);
  const [cmdLoading, setCmdLoading] = useState(false);
  const [editBioIdPerson, setEditBioIdPerson] = useState<string | null>(null);
  const [editBioIdVal, setEditBioIdVal] = useState('');
  const [rfidModal, setRfidModal] = useState<Person | null>(null);
  const [rfidVal, setRfidVal] = useState('');
  const [rfidSaving, setRfidSaving] = useState(false);

  const fetchAll = useCallback(async () => {
    try {
      const [locRes, devRes] = await Promise.all([
        biometricAPI.getLocations(),
        biometricAPI.getDevices(),
      ]);
      setLocations((locRes as any)?.data || []);
      setDevices((devRes as any)?.data || []);
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const fetchPeople = useCallback(async (type: PersonType) => {
    setPeopleLoading(true);
    try {
      const res =
        type === 'employee'
          ? await employeeAPI.getAll()
          : await studentAPI.getAll();
      setPeople(
        ((res as any)?.data || []).filter(
          (p: Person) => p.status !== 'terminated' && p.status !== 'inactive',
        ),
      );
    } catch {}
    setPeopleLoading(false);
  }, []);

  const fetchCommands = useCallback(async (deviceId: string) => {
    setCmdLoading(true);
    try {
      const res = await biometricAPI.getDeviceCommands(deviceId);
      setCommands((res as any)?.data || []);
    } catch {}
    setCmdLoading(false);
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  useEffect(() => {
    if (tab === 'sync') {
      fetchAll();
      fetchPeople(personType);
    }
  }, [tab, fetchAll, fetchPeople, personType]);

  useEffect(() => {
    if (syncDevice) {
      setSyncSerial(syncDevice.serialNumber || '');
      fetchCommands(syncDevice._id);
    }
  }, [syncDevice, fetchCommands]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchAll();
    if (tab === 'sync') fetchPeople(personType);
  };

  // ── Sync handlers ────────────────────────────────────────────────────────
  const handleSaveSerial = async () => {
    if (!syncDevice || !syncSerial.trim() || serialSaving) return;
    setSerialSaving(true);
    try {
      const res = await biometricAPI.setDeviceSerial(
        syncDevice._id,
        syncSerial.trim().toUpperCase(),
      );
      setSyncDevice((res as any)?.data);
      Alert.alert('Saved', `Device linked to SN: ${syncSerial.toUpperCase()}`);
    } catch (e: any) {
      Alert.alert('Error', e.message);
    }
    setSerialSaving(false);
  };

  const handleSyncPerson = async (person: Person) => {
    if (!syncDevice?.serialNumber) {
      Alert.alert('No Serial', 'Register the device serial number first.');
      return;
    }
    setSyncingId(person._id);
    try {
      await biometricAPI.syncPersonToDevice(
        syncDevice._id,
        personType,
        person._id,
      );
      Alert.alert(
        'Queued',
        `${person.firstName} will sync on next device poll`,
      );
      fetchCommands(syncDevice._id);
    } catch (e: any) {
      Alert.alert('Error', e.message);
    }
    setSyncingId(null);
  };

  const handleSyncAll = async () => {
    if (!syncDevice?.serialNumber) {
      Alert.alert('No Serial', 'Register the device serial number first.');
      return;
    }
    if (syncingAll) return;
    setSyncingAll(true);
    try {
      await biometricAPI.syncAllToDevice(syncDevice._id);
      Alert.alert('Queued', 'All people queued for sync');
      fetchCommands(syncDevice._id);
    } catch (e: any) {
      Alert.alert('Error', e.message);
    }
    setSyncingAll(false);
  };

  const handleEnrollFp = async (person: Person) => {
    if (!syncDevice) return;
    setFpEnrollingId(person._id);
    try {
      await biometricAPI.enrollFingerprint(
        syncDevice._id,
        personType,
        person._id,
      );
      Alert.alert(
        'Queued',
        'Fingerprint enrollment queued — person should place finger on device',
      );
      fetchCommands(syncDevice._id);
    } catch (e: any) {
      Alert.alert('Error', e.message);
    }
    setFpEnrollingId(null);
  };

  const handleEnrollFace = async (person: Person) => {
    if (!syncDevice) return;
    setFaceEnrollingId(person._id);
    try {
      await biometricAPI.enrollFaceOnDevice(
        syncDevice._id,
        personType,
        person._id,
      );
      Alert.alert(
        'Queued',
        'Face enrollment queued — person should look at device',
      );
      fetchCommands(syncDevice._id);
    } catch (e: any) {
      Alert.alert('Error', e.message);
    }
    setFaceEnrollingId(null);
  };

  const handleSaveBioId = async (person: Person) => {
    if (!editBioIdVal.trim()) {
      setEditBioIdPerson(null);
      return;
    }
    try {
      await biometricAPI.assignBiometricUserId(
        personType,
        person._id,
        editBioIdVal.trim(),
      );
      setPeople(prev =>
        prev.map(p =>
          p._id === person._id
            ? { ...p, biometricUserId: editBioIdVal.trim() }
            : p,
        ),
      );
      setEditBioIdPerson(null);
    } catch (e: any) {
      Alert.alert('Error', e.message);
    }
  };

  const handleSaveRfid = async () => {
    if (!rfidModal || !rfidVal.trim() || rfidSaving) return;
    setRfidSaving(true);
    try {
      await biometricAPI.saveRfidCard(
        personType,
        rfidModal._id,
        rfidVal.trim(),
      );
      setPeople(prev =>
        prev.map(p =>
          p._id === rfidModal._id ? { ...p, rfidCard: rfidVal.trim() } : p,
        ),
      );
      setRfidModal(null);
      setRfidVal('');
    } catch (e: any) {
      Alert.alert('Error', e.message);
    }
    setRfidSaving(false);
  };

  // ── Locations ────────────────────────────────────────────────────────────
  const openLocCreate = () => {
    setEditLocId(null);
    setLocForm(EMPTY_LOC);
    setLocModal(true);
  };

  const openLocEdit = (loc: Location) => {
    setEditLocId(loc._id);
    setLocForm({
      name: loc.name,
      address: loc.address || '',
      description: loc.description || '',
    });
    setLocModal(true);
  };

  const saveLocation = async () => {
    if (!locForm.name.trim()) {
      Alert.alert('Validation', 'Location name is required');
      return;
    }
    setLocSaving(true);
    try {
      if (editLocId) {
        await biometricAPI.updateLocation(editLocId, locForm);
      } else {
        await biometricAPI.createLocation(locForm);
      }
      setLocModal(false);
      fetchAll();
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setLocSaving(false);
    }
  };

  const deleteLocation = (loc: Location) => {
    Alert.alert('Delete Location', `Delete "${loc.name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await biometricAPI.deleteLocation(loc._id);
            fetchAll();
          } catch (e: any) {
            Alert.alert('Error', e.message);
          }
        },
      },
    ]);
  };

  // ── Devices ──────────────────────────────────────────────────────────────
  const openDevCreate = () => {
    if (locations.length === 0) {
      Alert.alert(
        'No Locations',
        'Create a location first before adding a device.',
      );
      return;
    }
    setEditDevId(null);
    setDevForm({ name: '', location: locations[0]._id });
    setDevModal(true);
  };

  const saveDevice = async () => {
    if (!devForm.name.trim()) {
      Alert.alert('Validation', 'Device name is required');
      return;
    }
    if (!devForm.location) {
      Alert.alert('Validation', 'Please select a location');
      return;
    }
    setDevSaving(true);
    try {
      if (editDevId) {
        await biometricAPI.updateDevice(editDevId, devForm);
      } else {
        await biometricAPI.createDevice(devForm);
      }
      setDevModal(false);
      fetchAll();
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setDevSaving(false);
    }
  };

  const deleteDevice = (dev: Device) => {
    Alert.alert('Delete Device', `Delete "${dev.name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await biometricAPI.deleteDevice(dev._id);
            fetchAll();
          } catch (e: any) {
            Alert.alert('Error', e.message);
          }
        },
      },
    ]);
  };

  const handleSync = async (deviceId: string) => {
    Alert.alert('Sync Device', 'Sync all people to this device?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sync',
        onPress: async () => {
          try {
            await biometricAPI.syncAllToDevice(deviceId);
            Alert.alert('Success', 'People queued for sync successfully');
          } catch (e: any) {
            Alert.alert('Error', e.message);
          }
        },
      },
    ]);
  };

  if (loading) return <LoadingView />;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Tabs */}
      <View style={styles.tabs}>
        {(
          [
            { id: 'locations', label: `Locations (${locations.length})` },
            { id: 'devices', label: `Devices (${devices.length})` },
            { id: 'sync', label: 'Sync' },
          ] as const
        ).map(t => (
          <TouchableOpacity
            key={t.id}
            style={[styles.tab, tab === t.id && styles.tabActive]}
            onPress={() => setTab(t.id)}
          >
            <Text
              style={[styles.tabText, tab === t.id && styles.tabTextActive]}
            >
              {t.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {tab !== 'sync' && (
        <View style={styles.addBtnRow}>
          <TouchableOpacity
            style={styles.addBtn}
            onPress={tab === 'locations' ? openLocCreate : openDevCreate}
          >
            <Plus size={14} color={colors.white} />
            <Text style={styles.addBtnText}>
              {tab === 'locations' ? 'Add Location' : 'Add Device'}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {tab !== 'sync' && (
        <ScrollView
          contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.blue}
            />
          }
        >
          {tab === 'locations' ? (
            locations.length === 0 ? (
              <View style={styles.empty}>
                <MapPin size={32} color="#D1D5DB" />
                <Text style={styles.emptyText}>No locations yet</Text>
                <Text style={styles.emptySub}>
                  Tap "Add Location" to add your first location
                </Text>
              </View>
            ) : (
              <View style={styles.card}>
                {locations.map((loc, i) => (
                  <View
                    key={loc._id}
                    style={[styles.row, i > 0 && styles.rowBorder]}
                  >
                    <View style={styles.locIcon}>
                      <MapPin size={16} color={colors.blue} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.rowTitle}>{loc.name}</Text>
                      {loc.address ? (
                        <Text style={styles.rowSub}>{loc.address}</Text>
                      ) : null}
                    </View>
                    <View
                      style={[
                        styles.statusDot,
                        {
                          backgroundColor: loc.isActive
                            ? colors.green
                            : '#D1D5DB',
                        },
                      ]}
                    />
                    <TouchableOpacity
                      onPress={() => openLocEdit(loc)}
                      style={styles.iconBtn}
                    >
                      <Edit2 size={14} color={colors.blue} />
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => deleteLocation(loc)}
                      style={styles.iconBtn}
                    >
                      <Trash2 size={14} color={colors.red} />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )
          ) : devices.length === 0 ? (
            <View style={styles.empty}>
              <Cpu size={32} color="#D1D5DB" />
              <Text style={styles.emptyText}>No devices yet</Text>
              <Text style={styles.emptySub}>
                Add a biometric device to a location
              </Text>
            </View>
          ) : (
            <View style={styles.card}>
              {devices.map((dev, i) => (
                <View key={dev._id}>
                  <TouchableOpacity
                    style={[styles.row, i > 0 && styles.rowBorder]}
                    onPress={() =>
                      setExpandedDev(expandedDev === dev._id ? null : dev._id)
                    }
                    activeOpacity={0.8}
                  >
                    <View style={styles.locIcon}>
                      <Cpu size={16} color={colors.blue} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.rowTitle}>{dev.name}</Text>
                      <Text style={styles.rowSub}>
                        {dev.location?.name || '—'}
                      </Text>
                    </View>
                    {dev.activated ? (
                      <View style={styles.badge}>
                        <Wifi size={10} color={colors.green} />
                        <Text
                          style={[styles.badgeText, { color: colors.green }]}
                        >
                          Active
                        </Text>
                      </View>
                    ) : (
                      <View style={[styles.badge, { borderColor: '#D1D5DB' }]}>
                        <WifiOff size={10} color="#9CA3AF" />
                        <Text style={[styles.badgeText, { color: '#9CA3AF' }]}>
                          Pending
                        </Text>
                      </View>
                    )}
                    {expandedDev === dev._id ? (
                      <ChevronUp size={14} color="#9CA3AF" />
                    ) : (
                      <ChevronDown size={14} color="#9CA3AF" />
                    )}
                  </TouchableOpacity>

                  {expandedDev === dev._id && (
                    <View style={styles.devDetail}>
                      {dev.activationCode && !dev.activated && (
                        <View style={styles.codeBox}>
                          <Text style={styles.codeLabel}>
                            ACTIVATION CODE
                          </Text>
                          <Text style={styles.codeValue}>
                            {dev.activationCode}
                          </Text>
                          <Text style={styles.codeSub}>
                            Enter this code on the physical device to pair it
                          </Text>
                        </View>
                      )}
                      {dev.lastSeenAt && (
                        <Text style={styles.lastSeen}>
                          Last seen: {new Date(dev.lastSeenAt).toLocaleString()}
                        </Text>
                      )}
                      <View style={styles.devActions}>
                        <TouchableOpacity
                          style={styles.devActionBtn}
                          onPress={() => deleteDevice(dev)}
                        >
                          <Trash2 size={13} color={colors.red} />
                          <Text
                            style={[
                              styles.devActionText,
                              { color: colors.red },
                            ]}
                          >
                            Delete
                          </Text>
                        </TouchableOpacity>
                      </View>
                      <TouchableOpacity
                        style={styles.syncBtn}
                        onPress={() => handleSync(dev._id)}
                      >
                        <RefreshCw size={13} color={colors.white} />
                        <Text style={styles.syncBtnText}>
                          Sync All People
                        </Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              ))}
            </View>
          )}
        </ScrollView>
      )}

      {/* ── Sync tab ────────────────────────────────────────────────────── */}
      {tab === 'sync' && (
        <ScrollView
          contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.blue}
            />
          }
        >
          {/* Step 1 — Select Device */}
          <View style={sync.section}>
            <View style={sync.stepRow}>
              <View style={sync.stepBadge}>
                <Text style={sync.stepNum}>1</Text>
              </View>
              <Text style={sync.stepTitle}>Select Device</Text>
            </View>
            {devices.length === 0 ? (
              <Text style={sync.hint}>
                No devices — create one in the Devices tab first.
              </Text>
            ) : (
              devices.map(d => (
                <TouchableOpacity
                  key={d._id}
                  style={[
                    sync.deviceCard,
                    syncDevice?._id === d._id && sync.deviceCardActive,
                  ]}
                  onPress={() => setSyncDevice(d)}
                  activeOpacity={0.8}
                >
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 8,
                    }}
                  >
                    <Cpu
                      size={15}
                      color={
                        syncDevice?._id === d._id
                          ? colors.blue
                          : colors.black
                      }
                    />
                    <Text
                      style={[
                        sync.deviceName,
                        syncDevice?._id === d._id && { color: colors.blue },
                      ]}
                    >
                      {d.name}
                    </Text>
                    {d.serialNumber && (
                      <View style={sync.snBadge}>
                        <Text style={sync.snBadgeText}>
                          SN: {d.serialNumber}
                        </Text>
                      </View>
                    )}
                  </View>
                  <Text style={sync.deviceSub}>{d.location?.name}</Text>
                </TouchableOpacity>
              ))
            )}
          </View>

          {syncDevice && (
            <>
              {/* Step 2 — Register Serial */}
              <View style={sync.section}>
                <View style={sync.stepRow}>
                  <View style={sync.stepBadge}>
                    <Text style={sync.stepNum}>2</Text>
                  </View>
                  <Text style={sync.stepTitle}>
                    Register Device Serial Number
                  </Text>
                </View>
                <Text style={sync.hint}>
                  Find it on the device:{' '}
                  <Text style={{ fontWeight: '700' }}>
                    Menu → System Info → Device SN
                  </Text>
                </Text>
                <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
                  <TextInput
                    style={[
                      styles.fieldInput,
                      { flex: 1, fontFamily: 'monospace' },
                    ]}
                    value={syncSerial}
                    onChangeText={v => setSyncSerial(v.toUpperCase())}
                    placeholder="e.g. EUF7254500727"
                    placeholderTextColor={colors.muted}
                    autoCapitalize="characters"
                  />
                  <TouchableOpacity
                    style={[
                      sync.saveSerialBtn,
                      (!syncSerial.trim() || serialSaving) && {
                        opacity: 0.4,
                      },
                    ]}
                    onPress={handleSaveSerial}
                    disabled={!syncSerial.trim() || serialSaving}
                  >
                    {serialSaving ? (
                      <ActivityIndicator size="small" color={colors.white} />
                    ) : (
                      <>
                        <Check size={14} color={colors.white} />
                        <Text style={sync.saveSerialBtnText}>Save</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
                {syncDevice.serialNumber && (
                  <View style={sync.serialRegistered}>
                    <CheckCircle2 size={13} color={colors.green} />
                    <Text style={sync.serialRegisteredText}>
                      Currently registered: {syncDevice.serialNumber}
                    </Text>
                  </View>
                )}
              </View>

              {/* Step 3 — Staff / Student toggle + people */}
              <View
                style={[sync.section, { paddingHorizontal: 0, paddingTop: 0 }]}
              >
                <View style={{ paddingHorizontal: 16, paddingTop: 16 }}>
                  <ChipSelect
                    label="Person Type"
                    options={['employee', 'student'] as const}
                    value={personType}
                    onChange={setPersonType}
                    labels={{ employee: 'Staff', student: 'Students' }}
                  />
                </View>
                <View style={sync.peopleHeader}>
                  <View style={{ flex: 1 }}>
                    <View style={[sync.stepRow, { marginBottom: 2 }]}>
                      <View style={sync.stepBadge}>
                        <Text style={sync.stepNum}>3</Text>
                      </View>
                      <Text style={sync.stepTitle}>
                        Assign IDs & Sync
                      </Text>
                    </View>
                    <Text style={[sync.hint, { paddingHorizontal: 16 }]}>
                      Set Device User ID, assign RFID, then sync.
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={[
                      sync.syncAllBtn,
                      (syncingAll || !syncDevice.serialNumber) && {
                        opacity: 0.4,
                      },
                    ]}
                    onPress={handleSyncAll}
                    disabled={syncingAll || !syncDevice.serialNumber}
                  >
                    {syncingAll ? (
                      <ActivityIndicator size="small" color={colors.white} />
                    ) : (
                      <>
                        <Upload size={13} color={colors.white} />
                        <Text style={sync.syncAllBtnText}>Sync All</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>

                {peopleLoading ? (
                  <View style={{ padding: 32, alignItems: 'center' }}>
                    <ActivityIndicator size="large" color={colors.blue} />
                  </View>
                ) : people.length === 0 ? (
                  <Text style={[sync.hint, { padding: 16 }]}>
                    No {personType === 'employee' ? 'staff' : 'students'}{' '}
                    found.
                  </Text>
                ) : (
                  people.map((p, i) => (
                    <View
                      key={p._id}
                      style={[sync.personRow, i > 0 && sync.personRowBorder]}
                    >
                      {/* Name */}
                      <View style={{ minWidth: 110 }}>
                        <Text style={sync.personName}>
                          {p.firstName} {p.lastName}
                        </Text>
                        <Text style={sync.personId}>
                          {p.employeeId || p.studentId}
                        </Text>
                      </View>

                      {/* Bio ID */}
                      {editBioIdPerson === p._id ? (
                        <View style={sync.bioIdEdit}>
                          <TextInput
                            style={sync.bioIdInput}
                            value={editBioIdVal}
                            onChangeText={setEditBioIdVal}
                            keyboardType="number-pad"
                            autoFocus
                            onSubmitEditing={() => handleSaveBioId(p)}
                          />
                          <TouchableOpacity onPress={() => handleSaveBioId(p)}>
                            <Check size={14} color={colors.green} />
                          </TouchableOpacity>
                          <TouchableOpacity
                            onPress={() => setEditBioIdPerson(null)}
                          >
                            <X size={14} color="#9CA3AF" />
                          </TouchableOpacity>
                        </View>
                      ) : (
                        <TouchableOpacity
                          style={[
                            sync.idChip,
                            p.biometricUserId
                              ? sync.idChipSet
                              : sync.idChipUnset,
                          ]}
                          onPress={() => {
                            setEditBioIdPerson(p._id);
                            setEditBioIdVal(p.biometricUserId || '');
                          }}
                        >
                          <Hash
                            size={10}
                            color={p.biometricUserId ? colors.green : '#9CA3AF'}
                          />
                          <Text
                            style={[
                              sync.idChipText,
                              p.biometricUserId
                                ? { color: colors.green }
                                : { color: '#9CA3AF' },
                            ]}
                          >
                            {p.biometricUserId || 'Set ID'}
                          </Text>
                        </TouchableOpacity>
                      )}

                      {/* RFID */}
                      <TouchableOpacity
                        style={[
                          sync.idChip,
                          p.rfidCard ? sync.rfidChipSet : sync.idChipUnset,
                        ]}
                        onPress={() => {
                          setRfidModal(p);
                          setRfidVal(p.rfidCard || '');
                        }}
                      >
                        <CreditCard
                          size={10}
                          color={p.rfidCard ? colors.blue : '#9CA3AF'}
                        />
                        <Text
                          style={[
                            sync.idChipText,
                            p.rfidCard
                              ? { color: colors.blue }
                              : { color: '#9CA3AF' },
                          ]}
                        >
                          {p.rfidCard ? p.rfidCard.slice(0, 8) : 'RFID'}
                        </Text>
                      </TouchableOpacity>

                      {/* Actions */}
                      <View style={{ flexDirection: 'row', gap: 4 }}>
                        {p.biometricUserId ? (
                          <>
                            <TouchableOpacity
                              style={sync.actionBtn}
                              onPress={() => handleEnrollFp(p)}
                              disabled={fpEnrollingId === p._id}
                            >
                              {fpEnrollingId === p._id ? (
                                <ActivityIndicator
                                  size="small"
                                  color={colors.black}
                                />
                              ) : (
                                <>
                                  <Fingerprint size={11} color={colors.black} />
                                  <Text style={sync.actionBtnText}>FP</Text>
                                </>
                              )}
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={[
                                sync.actionBtn,
                                {
                                  borderColor: colors.green,
                                  backgroundColor: '#F0FDF4',
                                },
                              ]}
                              onPress={() => handleEnrollFace(p)}
                              disabled={faceEnrollingId === p._id}
                            >
                              {faceEnrollingId === p._id ? (
                                <ActivityIndicator
                                  size="small"
                                  color={colors.green}
                                />
                              ) : (
                                <>
                                  <Scan size={11} color={colors.green} />
                                  <Text
                                    style={[
                                      sync.actionBtnText,
                                      { color: colors.green },
                                    ]}
                                  >
                                    Face
                                  </Text>
                                </>
                              )}
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={[
                                sync.actionBtn,
                                {
                                  backgroundColor: colors.blue,
                                  borderColor: colors.black,
                                },
                              ]}
                              onPress={() => handleSyncPerson(p)}
                              disabled={
                                syncingId === p._id || !syncDevice.serialNumber
                              }
                            >
                              {syncingId === p._id ? (
                                <ActivityIndicator
                                  size="small"
                                  color={colors.white}
                                />
                              ) : (
                                <>
                                  <UserCheck size={11} color={colors.white} />
                                  <Text
                                    style={[
                                      sync.actionBtnText,
                                      { color: colors.white },
                                    ]}
                                  >
                                    Sync
                                  </Text>
                                </>
                              )}
                            </TouchableOpacity>
                          </>
                        ) : (
                          <View
                            style={{
                              flexDirection: 'row',
                              alignItems: 'center',
                              gap: 3,
                            }}
                          >
                            <AlertTriangle size={11} color="#9CA3AF" />
                            <Text style={{ fontSize: 12, color: '#9CA3AF' }}>
                              Set ID
                            </Text>
                          </View>
                        )}
                      </View>
                    </View>
                  ))
                )}
              </View>

              {/* Command Queue */}
              <View
                style={[sync.section, { paddingHorizontal: 0, paddingTop: 0 }]}
              >
                <View style={sync.cmdHeader}>
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 6,
                    }}
                  >
                    <Terminal size={14} color={colors.black} />
                    <Text style={sync.stepTitle}>Command Queue</Text>
                  </View>
                  <TouchableOpacity
                    style={sync.refreshBtn}
                    onPress={() => fetchCommands(syncDevice._id)}
                  >
                    <RefreshCw size={12} color={colors.black} />
                    <Text style={sync.refreshBtnText}>Refresh</Text>
                  </TouchableOpacity>
                </View>
                {cmdLoading ? (
                  <View style={{ padding: 24, alignItems: 'center' }}>
                    <ActivityIndicator color={colors.blue} />
                  </View>
                ) : commands.length === 0 ? (
                  <Text style={[sync.hint, { padding: 16 }]}>
                    No commands — sync a person to create one.
                  </Text>
                ) : (
                  commands.map(cmd => (
                    <View key={cmd._id} style={sync.cmdRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={sync.cmdType}>{cmd.type}</Text>
                        <Text style={sync.cmdTime}>
                          {new Date(cmd.createdAt).toLocaleString()}
                        </Text>
                      </View>
                      <View
                        style={[
                          sync.cmdStatus,
                          cmd.status === 'done' && sync.cmdDone,
                          cmd.status === 'pending' && sync.cmdPending,
                          cmd.status === 'sent' && sync.cmdSent,
                          cmd.status === 'failed' && sync.cmdFailed,
                        ]}
                      >
                        <Text
                          style={[
                            sync.cmdStatusText,
                            cmd.status === 'done' && { color: colors.green },
                            cmd.status === 'pending' && {
                              color: colors.orange,
                            },
                            cmd.status === 'sent' && { color: colors.blue },
                            cmd.status === 'failed' && { color: colors.red },
                          ]}
                        >
                          {cmd.status}
                        </Text>
                      </View>
                    </View>
                  ))
                )}
              </View>
            </>
          )}
        </ScrollView>
      )}

      {/* RFID Modal */}
      <Modal visible={!!rfidModal} transparent animationType="slide">
        <View style={styles.overlay}>
          <View style={styles.modal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Assign RFID Card</Text>
              <TouchableOpacity onPress={() => setRfidModal(null)}>
                <X size={20} color={colors.black} />
              </TouchableOpacity>
            </View>
            {rfidModal && (
              <View style={sync.rfidPersonBox}>
                <Text style={sync.rfidPersonName}>
                  {rfidModal.firstName} {rfidModal.lastName}
                </Text>
                <Text style={sync.rfidPersonId}>
                  {rfidModal.employeeId || rfidModal.studentId}
                </Text>
              </View>
            )}
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Card Number</Text>
              <TextInput
                style={styles.fieldInput}
                value={rfidVal}
                onChangeText={setRfidVal}
                placeholder="e.g. A3F2B1C0"
                placeholderTextColor={colors.muted}
                autoCapitalize="characters"
              />
            </View>
            <Button
              title="Save RFID Card"
              onPress={handleSaveRfid}
              loading={rfidSaving}
              disabled={!rfidVal.trim()}
            />
          </View>
        </View>
      </Modal>

      {/* Location Modal */}
      <Modal visible={locModal} transparent animationType="slide">
        <View style={styles.overlay}>
          <View style={styles.modal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {editLocId ? 'Edit Location' : 'Add Location'}
              </Text>
              <TouchableOpacity onPress={() => setLocModal(false)}>
                <X size={20} color={colors.black} />
              </TouchableOpacity>
            </View>
            {[
              { label: 'Name *', key: 'name', placeholder: 'Main Campus' },
              {
                label: 'Address',
                key: 'address',
                placeholder: '123 Main St, Mumbai',
              },
              {
                label: 'Description',
                key: 'description',
                placeholder: 'Optional description',
              },
            ].map(f => (
              <View key={f.key} style={styles.field}>
                <Text style={styles.fieldLabel}>{f.label}</Text>
                <TextInput
                  style={styles.fieldInput}
                  value={(locForm as any)[f.key]}
                  onChangeText={v => setLocForm(p => ({ ...p, [f.key]: v }))}
                  placeholder={f.placeholder}
                  placeholderTextColor={colors.muted}
                />
              </View>
            ))}
            <Button
              title="Save Location"
              onPress={saveLocation}
              loading={locSaving}
            />
          </View>
        </View>
      </Modal>

      {/* Device Modal */}
      <Modal visible={devModal} transparent animationType="slide">
        <View style={styles.overlay}>
          <View style={styles.modal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add Device</Text>
              <TouchableOpacity onPress={() => setDevModal(false)}>
                <X size={20} color={colors.black} />
              </TouchableOpacity>
            </View>
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Device Name *</Text>
              <TextInput
                style={styles.fieldInput}
                value={devForm.name}
                onChangeText={v => setDevForm(p => ({ ...p, name: v }))}
                placeholder="Main Gate Scanner"
                placeholderTextColor={colors.muted}
              />
            </View>
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Location *</Text>
              {locations.map(loc => (
                <TouchableOpacity
                  key={loc._id}
                  style={[
                    styles.locOption,
                    devForm.location === loc._id && styles.locOptionSelected,
                  ]}
                  onPress={() => setDevForm(p => ({ ...p, location: loc._id }))}
                >
                  {devForm.location === loc._id && (
                    <Check size={12} color={colors.blue} />
                  )}
                  <Text
                    style={[
                      styles.locOptionText,
                      devForm.location === loc._id && { color: colors.blue },
                    ]}
                  >
                    {loc.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <Button title="Save Device" onPress={saveDevice} loading={devSaving} />
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  tabs: {
    flexDirection: 'row',
    backgroundColor: colors.white,
    borderBottomWidth: 2,
    borderBottomColor: colors.black,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderBottomWidth: 3,
    borderBottomColor: 'transparent',
  },
  tabActive: { borderBottomColor: colors.blue },
  tabText: {
    fontFamily: FONT.bold,
    fontSize: 11,
    fontWeight: '700',
    color: '#9CA3AF',
    textTransform: 'uppercase',
  },
  tabTextActive: { color: colors.blue },
  addBtnRow: {
    paddingHorizontal: 16,
    paddingTop: 12,
    backgroundColor: colors.white,
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: colors.blue,
    borderWidth: 2,
    borderColor: colors.black,
    paddingVertical: 10,
  },
  addBtnText: {
    color: colors.white,
    fontFamily: FONT.bold,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  card: { backgroundColor: colors.white, borderWidth: 2, borderColor: colors.black },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 10,
  },
  rowBorder: { borderTopWidth: 1, borderTopColor: '#F3F4F6' },
  rowTitle: { fontFamily: FONT.bold, fontSize: 14, fontWeight: '700', color: colors.black },
  rowSub: { fontFamily: FONT.medium, fontSize: 11, color: colors.muted, marginTop: 2 },
  locIcon: {
    width: 36,
    height: 36,
    backgroundColor: '#EFF6FF',
    borderWidth: 2,
    borderColor: colors.black,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  iconBtn: { padding: 8 },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    borderWidth: 2,
    borderColor: colors.green,
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  badgeText: { fontFamily: FONT.bold, fontSize: 9, fontWeight: '700', textTransform: 'uppercase' },
  devDetail: {
    backgroundColor: colors.background,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    padding: 14,
  },
  codeBox: {
    backgroundColor: colors.white,
    borderWidth: 2,
    borderColor: colors.black,
    padding: 12,
    marginBottom: 10,
  },
  codeLabel: {
    fontFamily: FONT.bold,
    fontSize: 9,
    fontWeight: '700',
    textTransform: 'uppercase',
    color: colors.muted,
    letterSpacing: 0.5,
  },
  codeValue: {
    fontFamily: FONT.bold,
    fontSize: 24,
    fontWeight: '700',
    color: colors.blue,
    letterSpacing: 4,
    marginVertical: 4,
  },
  codeSub: { fontFamily: FONT.medium, fontSize: 11, color: colors.muted },
  lastSeen: { fontFamily: FONT.medium, fontSize: 11, color: colors.muted, marginBottom: 8 },
  devActions: { flexDirection: 'row', gap: 8 },
  devActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 2,
    borderColor: colors.red,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  devActionText: {
    fontFamily: FONT.bold,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  syncBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: colors.blue,
    borderWidth: 2,
    borderColor: colors.black,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginTop: 8,
  },
  syncBtnText: {
    color: colors.white,
    fontFamily: FONT.bold,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  empty: { alignItems: 'center', paddingVertical: 60, gap: 8 },
  emptyText: { fontFamily: FONT.bold, fontSize: 14, fontWeight: '700', color: colors.muted },
  emptySub: { fontFamily: FONT.medium, fontSize: 12, color: '#9CA3AF' },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modal: {
    backgroundColor: colors.white,
    borderTopWidth: 2,
    borderTopColor: colors.black,
    padding: 20,
    paddingBottom: 40,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: { fontFamily: FONT.bold, fontSize: 18, fontWeight: '700', color: colors.black },
  field: { marginBottom: 14 },
  fieldLabel: {
    fontFamily: FONT.bold,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    color: colors.muted,
    marginBottom: 6,
    letterSpacing: 0.5,
  },
  fieldInput: {
    fontFamily: FONT.medium,
    borderWidth: 2,
    borderColor: colors.black,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    fontWeight: '500',
    color: colors.black,
  },
  locOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    padding: 10,
    borderWidth: 2,
    borderColor: '#E5E7EB',
    marginBottom: 6,
  },
  locOptionSelected: { borderColor: colors.blue, backgroundColor: '#EFF6FF' },
  locOptionText: { fontFamily: FONT.medium, fontSize: 14, fontWeight: '600', color: colors.black },
});

const sync = StyleSheet.create({
  section: {
    backgroundColor: colors.white,
    borderWidth: 2,
    borderColor: colors.black,
    padding: 16,
    marginBottom: 12,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  stepBadge: {
    width: 22,
    height: 22,
    backgroundColor: colors.black,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNum: { color: colors.white, fontFamily: FONT.bold, fontSize: 11, fontWeight: '700' },
  stepTitle: {
    fontFamily: FONT.bold,
    fontSize: 13,
    fontWeight: '800',
    color: colors.black,
    textTransform: 'uppercase',
  },
  hint: { fontFamily: FONT.medium, fontSize: 11, color: colors.muted, lineHeight: 16 },
  deviceCard: {
    borderWidth: 2,
    borderColor: colors.black,
    padding: 12,
    marginBottom: 8,
    backgroundColor: '#FAFAFA',
  },
  deviceCardActive: { borderColor: colors.blue, backgroundColor: '#EFF6FF' },
  deviceName: { fontFamily: FONT.bold, fontSize: 13, fontWeight: '800', color: colors.black },
  deviceSub: { fontFamily: FONT.medium, fontSize: 11, color: colors.muted, marginTop: 2 },
  snBadge: {
    marginLeft: 'auto',
    borderWidth: 2,
    borderColor: colors.green,
    backgroundColor: '#F0FDF4',
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  snBadgeText: { fontFamily: FONT.bold, fontSize: 9, fontWeight: '700', color: colors.green },
  saveSerialBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: colors.blue,
    borderWidth: 2,
    borderColor: colors.black,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  saveSerialBtnText: {
    color: colors.white,
    fontFamily: FONT.bold,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  serialRegistered: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 8,
  },
  serialRegisteredText: {
    fontFamily: FONT.bold,
    fontSize: 11,
    color: colors.green,
    fontWeight: '700',
  },
  peopleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 2,
    borderTopColor: colors.black,
    borderBottomWidth: 2,
    borderBottomColor: colors.black,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginTop: 16,
  },
  syncAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: colors.blue,
    borderWidth: 2,
    borderColor: colors.black,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  syncAllBtnText: {
    color: colors.white,
    fontFamily: FONT.bold,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  personRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    flexWrap: 'wrap',
  },
  personRowBorder: { borderTopWidth: 1, borderTopColor: '#F3F4F6' },
  personName: { fontFamily: FONT.bold, fontSize: 12, fontWeight: '700', color: colors.black },
  personId: {
    fontSize: 12,
    color: colors.muted,
    fontFamily: 'monospace',
    marginTop: 1,
  },
  bioIdEdit: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  bioIdInput: {
    width: 60,
    borderWidth: 2,
    borderColor: colors.blue,
    paddingHorizontal: 6,
    paddingVertical: 4,
    fontSize: 12,
    fontFamily: 'monospace',
    color: colors.black,
  },
  idChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 2,
    paddingHorizontal: 7,
    paddingVertical: 4,
  },
  idChipSet: { borderColor: colors.green, backgroundColor: '#F0FDF4' },
  idChipUnset: { borderColor: '#D1D5DB', borderStyle: 'dashed' },
  rfidChipSet: { borderColor: colors.blue, backgroundColor: '#EFF6FF' },
  idChipText: { fontFamily: FONT.bold, fontSize: 12, fontWeight: '700' },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    borderWidth: 2,
    borderColor: colors.black,
    paddingHorizontal: 7,
    paddingVertical: 5,
    backgroundColor: colors.white,
  },
  actionBtnText: { fontFamily: FONT.bold, fontSize: 12, fontWeight: '700', color: colors.black },
  cmdHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 2,
    borderBottomColor: colors.black,
  },
  refreshBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 2,
    borderColor: colors.black,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  refreshBtnText: { fontFamily: FONT.bold, fontSize: 11, fontWeight: '700', color: colors.black },
  cmdRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  cmdType: {
    fontFamily: FONT.bold,
    fontSize: 11,
    fontWeight: '700',
    color: colors.black,
    textTransform: 'uppercase',
  },
  cmdTime: { fontFamily: FONT.medium, fontSize: 12, color: '#9CA3AF', marginTop: 2 },
  cmdStatus: {
    borderWidth: 2,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  cmdDone: { borderColor: colors.green, backgroundColor: '#F0FDF4' },
  cmdPending: { borderColor: colors.orange, backgroundColor: '#FFF7ED' },
  cmdSent: { borderColor: colors.blue, backgroundColor: '#EFF6FF' },
  cmdFailed: { borderColor: colors.red, backgroundColor: '#FEF2F2' },
  cmdStatusText: {
    fontFamily: FONT.bold,
    fontSize: 9,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  rfidPersonBox: {
    backgroundColor: '#EFF6FF',
    borderWidth: 2,
    borderColor: '#BFDBFE',
    padding: 12,
    marginBottom: 14,
  },
  rfidPersonName: { fontFamily: FONT.bold, fontSize: 14, fontWeight: '700', color: colors.black },
  rfidPersonId: { fontFamily: FONT.medium, fontSize: 11, color: colors.muted, marginTop: 2 },
});
