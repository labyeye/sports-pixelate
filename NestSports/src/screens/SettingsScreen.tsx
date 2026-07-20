import React, { useCallback, useEffect, useState } from 'react';
import {
  ScrollView,
  View,
  Text,
  Switch,
  TouchableOpacity,
  Image,
  RefreshControl,
  StyleSheet,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  launchCamera,
  launchImageLibrary,
  Asset,
} from 'react-native-image-picker';
import {
  Building2,
  Landmark,
  MessageCircle,
  CheckCircle2,
  AlertCircle,
  Users,
  SlidersHorizontal,
  Sliders,
  LucideIcon,
  Mail,
  Phone,
  Globe,
  MapPin,
  UserCircle,
  CreditCard,
  Hash,
  IndianRupee,
  Calendar,
  Fingerprint,
  Clock,
  LayoutDashboard,
} from 'lucide-react-native';
import { settingsAPI, RNFile } from '../api/client';
import { useAuth } from '../contexts/AuthContext';
import {
  Card,
  SectionTitle,
  TextField,
  ChipSelect,
  Button,
  LoadingView,
} from '../components/ui';
import { colors, FONT } from '../theme/colors';

type TabKey =
  | 'general'
  | 'bank'
  | 'whatsapp'
  | 'salary_mode'
  | 'punch'
  | 'ess'
  | 'system'
  | 'preferences';

const TABS: { key: TabKey; label: string; icon: LucideIcon }[] = [
  { key: 'general', label: 'General Info', icon: Building2 },
  { key: 'bank', label: 'Bank Details', icon: Landmark },
  { key: 'whatsapp', label: 'WhatsApp', icon: MessageCircle },
  { key: 'salary_mode', label: 'Salary Mode', icon: CheckCircle2 },
  { key: 'punch', label: 'Punch Settings', icon: AlertCircle },
  { key: 'ess', label: 'Employee App', icon: Users },
  { key: 'system', label: 'System', icon: SlidersHorizontal },
  { key: 'preferences', label: 'Preferences', icon: Sliders },
];

const SALARY_MODES = ['monthly', '15day', 'weekly'] as const;
const SINGLE_PUNCH_ACTIONS = ['half_day', 'present', 'absent'] as const;
const DASHBOARD_TYPES = ['Normal', 'Advanced', 'Compact'] as const;
const TIME_FORMATS = ['12', '24'] as const;
const CURRENCIES = ['INR', 'USD', 'EUR', 'GBP', 'AED'] as const;

const GST_REGEX = /^\d{2}[A-Z]{5}\d{4}[A-Z]{1}[A-Z\d]{1}Z[A-Z\d]{1}$/;
const IFSC_REGEX = /^[A-Z]{4}0[A-Z0-9]{6}$/;
const ACCOUNT_NUMBER_REGEX = /^\d{9,18}$/;

function pickImage(onPicked: (file: RNFile) => void) {
  Alert.alert('Choose Image', 'Select a source', [
    {
      text: 'Camera',
      onPress: () =>
        launchCamera({ mediaType: 'photo', quality: 0.8 }, r => {
          const a: Asset | undefined = r.assets?.[0];
          if (a?.uri)
            onPicked({
              uri: a.uri,
              name: a.fileName || `img_${Date.now()}.jpg`,
              type: a.type || 'image/jpeg',
            });
        }),
    },
    {
      text: 'Gallery',
      onPress: () =>
        launchImageLibrary({ mediaType: 'photo', quality: 0.8 }, r => {
          const a: Asset | undefined = r.assets?.[0];
          if (a?.uri)
            onPicked({
              uri: a.uri,
              name: a.fileName || `img_${Date.now()}.jpg`,
              type: a.type || 'image/jpeg',
            });
        }),
    },
    { text: 'Cancel', style: 'cancel' },
  ]);
}

function ToggleRow({
  label,
  sub,
  value,
  onChange,
}: {
  label: string;
  sub?: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <View style={styles.toggleRow}>
      <View style={{ flex: 1, paddingRight: 12 }}>
        <Text style={styles.toggleLabel}>{label}</Text>
        {sub ? <Text style={styles.toggleSub}>{sub}</Text> : null}
      </View>
      <Switch
        value={!!value}
        onValueChange={onChange}
        trackColor={{ false: '#D1D5DB', true: colors.blue }}
        thumbColor={colors.white}
      />
    </View>
  );
}

export default function SettingsScreen() {
  const { logout } = useAuth();
  const [settings, setSettings] = useState<any>(null);
  const [tab, setTab] = useState<TabKey>('general');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingQr, setUploadingQr] = useState(false);

  const load = useCallback(async () => {
    const res: any = await settingsAPI.get().catch(() => null);
    if (res?.data) setSettings(res.data);
  }, []);

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const set = (patch: object) =>
    setSettings((prev: any) => ({ ...(prev || {}), ...patch }));

  const handleLogoPick = () => {
    pickImage(async file => {
      setUploadingLogo(true);
      try {
        const res: any = await settingsAPI.uploadLogo(file);
        if (res?.data?.logoUrl) set({ logoUrl: res.data.logoUrl });
      } catch (e: any) {
        Alert.alert('Upload failed', e?.message || 'Could not upload logo');
      } finally {
        setUploadingLogo(false);
      }
    });
  };

  const handleQrPick = () => {
    pickImage(async file => {
      setUploadingQr(true);
      try {
        const res: any = await settingsAPI.uploadPaymentQr(file);
        if (res?.data?.paymentQrUrl)
          set({ paymentQrUrl: res.data.paymentQrUrl });
      } catch (e: any) {
        Alert.alert(
          'Upload failed',
          e?.message || 'Could not upload payment QR',
        );
      } finally {
        setUploadingQr(false);
      }
    });
  };

  const validate = (): string | null => {
    if (tab === 'general') {
      if (!settings?.companyName?.trim())
        return 'Please fill in: SportsClub Name';
      if (!settings?.companyAddress?.trim())
        return 'Please fill in: SportsClub Address';
      if (settings?.companyPhone && !/^\d{10}$/.test(settings.companyPhone))
        return 'Phone number must be 10 digits';
      if (settings?.companyGST && !GST_REGEX.test(settings.companyGST))
        return 'GST format looks invalid (e.g. 22AAAAA0000A1Z5)';
    }
    if (tab === 'bank') {
      if (!settings?.bankName?.trim()) return 'Please fill in: Bank Name';
      if (!settings?.bankAccountName?.trim())
        return 'Please fill in: Account Holder Name';
      if (!settings?.bankAccountNumber?.trim())
        return 'Please fill in: Account Number';
      if (
        settings?.bankAccountNumber &&
        !ACCOUNT_NUMBER_REGEX.test(settings.bankAccountNumber)
      )
        return 'Account number must be 9-18 digits';
      if (!settings?.bankIFSC?.trim()) return 'Please fill in: IFSC Code';
      if (settings?.bankIFSC && !IFSC_REGEX.test(settings.bankIFSC))
        return 'IFSC format looks invalid (e.g. SBIN0001234)';
    }
    return null;
  };

  const handleSave = async () => {
    const err = validate();
    if (err) {
      Alert.alert('Required Field Missing', err);
      return;
    }
    setSaving(true);
    try {
      await settingsAPI.update(settings);
      Alert.alert('Saved', 'Settings updated successfully');
    } catch (e: any) {
      Alert.alert('Save failed', e?.message || 'Could not save settings');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <LoadingView />;

  return (
    <SafeAreaView edges={['top']} style={styles.screen}>
      <View style={{ paddingHorizontal: 16, paddingTop: 12 }}>
        <Text style={styles.title}>Settings</Text>
        <Text style={styles.subtitle}>SportsClub & app configuration</Text>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.tabBar}
      >
        {TABS.map(t => {
          const active = tab === t.key;
          const Icon = t.icon;
          return (
            <TouchableOpacity
              key={t.key}
              onPress={() => setTab(t.key)}
              style={[styles.tabChip, active && styles.tabChipActive]}
            >
              <Icon
                size={14}
                color={active ? colors.white : colors.black}
                strokeWidth={2.5}
              />
              <Text
                style={[styles.tabChipText, active && { color: colors.white }]}
              >
                {t.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <ScrollView
        style={styles.screen}
        contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {tab === 'general' && (
          <Card>
            <SectionTitle title="SportsClub / General Info" />
            <View style={styles.logoRow}>
              <TouchableOpacity onPress={handleLogoPick} style={styles.logoBox}>
                {settings?.logoUrl ? (
                  <Image
                    source={{ uri: settings.logoUrl }}
                    style={styles.logoImg}
                    resizeMode="contain"
                  />
                ) : (
                  <Text style={styles.logoPlaceholder}>Logo</Text>
                )}
              </TouchableOpacity>
              <Button
                title={uploadingLogo ? 'Uploading…' : 'Upload Logo'}
                onPress={handleLogoPick}
                variant="outline"
                loading={uploadingLogo}
              />
            </View>
            <TextField
              label="SportsClub Name"
              icon={Building2}
              required
              value={settings?.companyName || ''}
              onChangeText={v => set({ companyName: v })}
            />
            <TextField
              label="Email"
              icon={Mail}
              value={settings?.companyEmail || ''}
              onChangeText={v => set({ companyEmail: v })}
              keyboardType="email-address"
            />
            <TextField
              label="Phone"
              icon={Phone}
              value={settings?.companyPhone || ''}
              onChangeText={v => set({ companyPhone: v })}
              keyboardType="phone-pad"
            />
            <TextField
              label="GST Number"
              icon={Hash}
              value={settings?.companyGST || ''}
              onChangeText={v => set({ companyGST: v.toUpperCase() })}
              placeholder="22AAAAA0000A1Z5"
            />
            <TextField
              label="Club PAN"
              icon={CreditCard}
              value={settings?.companyPAN || ''}
              onChangeText={v => set({ companyPAN: v.toUpperCase() })}
              placeholder="AAAAA0000A"
            />
            <TextField
              label="Website"
              icon={Globe}
              value={settings?.companyWebsite || ''}
              onChangeText={v => set({ companyWebsite: v })}
            />
            <TextField
              label="SportsClub Address"
              icon={MapPin}
              required
              multiline
              value={settings?.companyAddress || ''}
              onChangeText={v => set({ companyAddress: v })}
            />

            <SectionTitle title="Payment QR (shown to parents for renewal)" />
            <View style={styles.logoRow}>
              <TouchableOpacity onPress={handleQrPick} style={styles.logoBox}>
                {settings?.paymentQrUrl ? (
                  <Image
                    source={{ uri: settings.paymentQrUrl }}
                    style={styles.logoImg}
                    resizeMode="contain"
                  />
                ) : (
                  <Text style={styles.logoPlaceholder}>QR</Text>
                )}
              </TouchableOpacity>
              <Button
                title={uploadingQr ? 'Uploading…' : 'Upload QR'}
                onPress={handleQrPick}
                variant="outline"
                loading={uploadingQr}
              />
            </View>
          </Card>
        )}

        {tab === 'bank' && (
          <Card>
            <SectionTitle title="Bank Details" />
            <TextField
              label="Bank Name"
              icon={Landmark}
              required
              value={settings?.bankName || ''}
              onChangeText={v => set({ bankName: v })}
            />
            <TextField
              label="Bank Branch"
              icon={MapPin}
              value={settings?.bankBranch || ''}
              onChangeText={v => set({ bankBranch: v })}
            />
            <TextField
              label="Account Holder Name"
              icon={UserCircle}
              required
              value={settings?.bankAccountName || ''}
              onChangeText={v => set({ bankAccountName: v })}
            />
            <TextField
              label="Account Number"
              icon={CreditCard}
              required
              value={settings?.bankAccountNumber || ''}
              onChangeText={v => set({ bankAccountNumber: v })}
              keyboardType="number-pad"
            />
            <TextField
              label="IFSC Code"
              icon={Hash}
              required
              value={settings?.bankIFSC || ''}
              onChangeText={v => set({ bankIFSC: v.toUpperCase() })}
              placeholder="SBIN0001234"
            />
          </Card>
        )}

        {tab === 'whatsapp' && (
          <Card>
            <SectionTitle
              title="WhatsApp Integration"
              sub="No API key setup required"
            />
            <ToggleRow
              label="Enable WhatsApp Notifications"
              value={settings?.whatsappEnabled}
              onChange={v => set({ whatsappEnabled: v })}
            />
            <ToggleRow
              label="Notify on Leave"
              value={settings?.whatsappNotifyLeave ?? true}
              onChange={v => set({ whatsappNotifyLeave: v })}
            />
            <ToggleRow
              label="Notify on Payroll"
              value={settings?.whatsappNotifyPayroll ?? true}
              onChange={v => set({ whatsappNotifyPayroll: v })}
            />
            <ToggleRow
              label="Notify on Subscription Payment"
              value={settings?.whatsappNotifySubscription ?? true}
              onChange={v => set({ whatsappNotifySubscription: v })}
            />
            <ToggleRow
              label="Notify on Check-In"
              value={settings?.whatsappNotifyCheckIn ?? true}
              onChange={v => set({ whatsappNotifyCheckIn: v })}
            />
          </Card>
        )}

        {tab === 'salary_mode' && (
          <Card>
            <SectionTitle title="Salary Mode" />
            <ChipSelect
              label="Payout Frequency"
              icon={IndianRupee}
              options={SALARY_MODES}
              value={settings?.salaryMode || 'monthly'}
              onChange={v => set({ salaryMode: v })}
            />
            <TextField
              label="Salary Pay Day"
              icon={Calendar}
              value={settings?.salaryPayDay || ''}
              onChangeText={v => set({ salaryPayDay: v })}
              placeholder="e.g. 1st, Last day"
            />
            <ToggleRow
              label="Overtime (OT) Enabled"
              value={settings?.otEnabled}
              onChange={v => set({ otEnabled: v })}
            />
          </Card>
        )}

        {tab === 'punch' && (
          <Card>
            <SectionTitle title="Punch Settings" />
            <ChipSelect
              label="Single Punch Action"
              icon={Fingerprint}
              options={SINGLE_PUNCH_ACTIONS}
              value={settings?.singlePunchAction || 'half_day'}
              onChange={v => set({ singlePunchAction: v })}
              labels={{
                half_day: 'Half Day',
                present: 'Present',
                absent: 'Absent',
              }}
            />
            <TextField
              label="Double Punch Interval (minutes)"
              icon={Clock}
              value={String(settings?.doublePunchInterval ?? '')}
              onChangeText={v =>
                set({ doublePunchInterval: Number(v.replace(/\D/g, '')) || 0 })
              }
              keyboardType="number-pad"
            />
          </Card>
        )}

        {tab === 'ess' && (
          <Card>
            <SectionTitle title="Employee App (ESS)" />
            <ToggleRow
              label="Enable Employee App"
              value={settings?.essEnabled}
              onChange={v => set({ essEnabled: v })}
            />
            <ToggleRow
              label="Allow Punch In/Out"
              value={settings?.essAllowPunch}
              onChange={v => set({ essAllowPunch: v })}
            />
            <ToggleRow
              label="Allow Salary Slip"
              value={settings?.essAllowSalarySlip}
              onChange={v => set({ essAllowSalarySlip: v })}
            />
            <ToggleRow
              label="Allow Attendance View"
              value={settings?.essAllowAttendance}
              onChange={v => set({ essAllowAttendance: v })}
            />
            <ToggleRow
              label="Allow Pay History"
              value={settings?.essAllowPayHistory}
              onChange={v => set({ essAllowPayHistory: v })}
            />
            <ToggleRow
              label="Allow Leave Requests"
              value={settings?.essAllowLeave}
              onChange={v => set({ essAllowLeave: v })}
            />
            <ToggleRow
              label="Allow Holiday View"
              value={settings?.essAllowHoliday}
              onChange={v => set({ essAllowHoliday: v })}
            />
            <ToggleRow
              label="Allow Missed Punch Request"
              value={settings?.essAllowMissPunch}
              onChange={v => set({ essAllowMissPunch: v })}
            />
            <ToggleRow
              label="Allow Work Report"
              value={settings?.essAllowWorkReport}
              onChange={v => set({ essAllowWorkReport: v })}
            />
            <ToggleRow
              label="Allow Advance/Loan Request"
              value={settings?.essAllowAdvance}
              onChange={v => set({ essAllowAdvance: v })}
            />
          </Card>
        )}

        {tab === 'system' && (
          <Card>
            <SectionTitle title="System" />
            <ToggleRow
              label="Auto Salary Processing"
              value={settings?.autoSalary}
              onChange={v => set({ autoSalary: v })}
            />
            <ToggleRow
              label="Biometric Sync"
              value={settings?.bioSync}
              onChange={v => set({ bioSync: v })}
            />
            <ToggleRow
              label="SMS Notifications"
              value={settings?.smsEnabled}
              onChange={v => set({ smsEnabled: v })}
            />
            <ToggleRow
              label="Email Notifications"
              value={settings?.emailNotif}
              onChange={v => set({ emailNotif: v })}
            />
          </Card>
        )}

        {tab === 'preferences' && (
          <Card>
            <SectionTitle title="Preferences" />
            <ChipSelect
              label="Dashboard Type"
              icon={LayoutDashboard}
              options={DASHBOARD_TYPES}
              value={settings?.dashboardType || 'Normal'}
              onChange={v => set({ dashboardType: v })}
            />
            <ChipSelect
              label="Time Format"
              icon={Clock}
              options={TIME_FORMATS}
              value={settings?.timeFormat || '12'}
              onChange={v => set({ timeFormat: v })}
              labels={{ '12': '12-hour', '24': '24-hour' }}
            />
            <ChipSelect
              label="Currency"
              icon={IndianRupee}
              options={CURRENCIES}
              value={settings?.currency || 'INR'}
              onChange={v => set({ currency: v })}
            />
            <TextField
              label="State (for PT slab)"
              icon={MapPin}
              value={settings?.state || ''}
              onChangeText={v => set({ state: v })}
            />
            <TextField
              label="Employee Code Prefix"
              icon={Hash}
              value={settings?.empCodePrefix || ''}
              onChangeText={v => set({ empCodePrefix: v })}
            />
            <TextField
              label="Employee Code Suffix"
              icon={Hash}
              value={settings?.empCodeSuffix || ''}
              onChangeText={v => set({ empCodeSuffix: v })}
            />
            <ToggleRow
              label="Show CTC to Employees"
              value={settings?.showCTC}
              onChange={v => set({ showCTC: v })}
            />
            <ToggleRow
              label="Branch-wise Data"
              value={settings?.branchwise}
              onChange={v => set({ branchwise: v })}
            />
          </Card>
        )}

        <Button title="Save Changes" onPress={handleSave} loading={saving} />
        <View style={{ height: 12 }} />
        <Button
          title="Sign Out"
          onPress={logout}
          color={colors.red}
          variant="outline"
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.white },
  title: { fontSize: 24, fontWeight: '800', color: colors.black },
  subtitle: { color: colors.muted, marginTop: 2, marginBottom: 12 },
  tabBar: { paddingHorizontal: 16, paddingBottom: 12, gap: 8 },
  tabChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 2,
    borderColor: colors.black,
    backgroundColor: colors.white,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginRight: 8,
  },
  tabChipActive: { backgroundColor: colors.blue },
  tabChipText: {
    fontFamily: FONT.bold,
    fontWeight: '700',
    fontSize: 12,
    color: colors.black,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#0000001A',
  },
  toggleLabel: {
    fontFamily: FONT.bold,
    fontWeight: '700',
    fontSize: 13,
    color: colors.black,
  },
  toggleSub: {
    fontFamily: FONT.medium,
    color: colors.muted,
    fontSize: 11,
    marginTop: 2,
  },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 14,
  },
  logoBox: {
    width: 64,
    height: 64,
    borderWidth: 2,
    borderColor: colors.black,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.white,
  },
  logoImg: { width: '100%', height: '100%' },
  logoPlaceholder: { fontFamily: FONT.bold, color: colors.muted, fontSize: 11 },
});
