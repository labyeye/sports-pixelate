import React, { useEffect, useMemo, useState } from 'react';
import {
  ScrollView,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  launchCamera,
  launchImageLibrary,
  Asset,
} from 'react-native-image-picker';
import {
  Plus,
  Trash2,
  ScanFace,
  CircleCheck,
  Circle,
} from 'lucide-react-native';
import {
  studentAPI,
  employeeAPI,
  sportsPlanAPI,
  subscriptionAPI,
  RNFile,
} from '../api/client';
import {
  Card,
  Avatar,
  TextField,
  ChipSelect,
  PickerField,
  Button,
  SectionTitle,
  CollapsibleSection,
} from '../components/ui';
import { colors, FONT } from '../theme/colors';
import {
  INDIA_STATES,
  INDIA_STATES_AND_CITIES,
} from '../data/indiaStatesAndCities';

const GENDERS = ['male', 'female', 'other'] as const;
const RELATIONS = ['father', 'mother', 'guardian', 'other'] as const;
const BLOOD_GROUPS = [
  'A+',
  'A-',
  'B+',
  'B-',
  'AB+',
  'AB-',
  'O+',
  'O-',
] as const;
const EXPERIENCE_LEVELS = ['Beginner', 'Intermediate', 'Advanced'] as const;
const PLAYING_LEVELS = ['School', 'District', 'State', 'National'] as const;

interface GuardianForm {
  _id?: string;
  relation: (typeof RELATIONS)[number];
  name: string;
  phone: string;
  email?: string;
  password?: string;
  photo?: RNFile;
  existingPhoto?: string;
  receivesWhatsapp?: boolean;
}

function assetToRNFile(asset: Asset): RNFile | undefined {
  if (!asset.uri) return undefined;
  return {
    uri: asset.uri,
    name: asset.fileName || `photo_${Date.now()}.jpg`,
    type: asset.type || 'image/jpeg',
  };
}

function pickPhoto(onPicked: (file: RNFile) => void) {
  Alert.alert('Add Photo', 'Choose source', [
    {
      text: 'Camera',
      onPress: () =>
        launchCamera({ mediaType: 'photo', quality: 0.7 }, r => {
          const file = r.assets?.[0] && assetToRNFile(r.assets[0]);
          if (file) onPicked(file);
        }),
    },
    {
      text: 'Gallery',
      onPress: () =>
        launchImageLibrary({ mediaType: 'photo', quality: 0.7 }, r => {
          const file = r.assets?.[0] && assetToRNFile(r.assets[0]);
          if (file) onPicked(file);
        }),
    },
    { text: 'Cancel', style: 'cancel' },
  ]);
}

// Face enrollment must be a live capture (never a gallery photo) so it's
// taken under the same conditions as the coach's check-in verification photos.
function captureFacePhoto(onPicked: (file: RNFile) => void) {
  launchCamera({ mediaType: 'photo', quality: 0.7, cameraType: 'front' }, r => {
    const file = r.assets?.[0] && assetToRNFile(r.assets[0]);
    if (file) onPicked(file);
  });
}

export default function AddStudentScreen({ navigation, route }: any) {
  const editingStudent = route?.params?.student;
  const isEditing = !!editingStudent;

  const [firstName, setFirstName] = useState(editingStudent?.firstName || '');
  const [lastName, setLastName] = useState(editingStudent?.lastName || '');
  const [sport, setSport] = useState(editingStudent?.sport || '');
  const [batch, setBatch] = useState(editingStudent?.batch || '');
  const [gender, setGender] = useState<(typeof GENDERS)[number]>(
    editingStudent?.gender || 'male',
  );
  const [avatarFile, setAvatarFile] = useState<RNFile | undefined>();
  const [faceFile, setFaceFile] = useState<RNFile | undefined>();
  const [guardians, setGuardians] = useState<GuardianForm[]>(
    (editingStudent?.guardians || []).map((g: any) => ({
      _id: g._id,
      relation: g.relation,
      name: g.name || '',
      phone: g.phone || '',
      email: g.email || '',
      existingPhoto: g.photo,
      receivesWhatsapp: !!g.receivesWhatsapp,
    })),
  );
  const [saving, setSaving] = useState(false);
  const [coaches, setCoaches] = useState<any[]>([]);
  const [coachId, setCoachId] = useState<string>(
    editingStudent?.coach?._id || '',
  );
  const [bloodGroup, setBloodGroup] = useState<
    (typeof BLOOD_GROUPS)[number] | ''
  >(editingStudent?.bloodGroup || '');
  const [ecName, setEcName] = useState(
    editingStudent?.emergencyContactPerson?.name || '',
  );
  const [ecRelation, setEcRelation] = useState(
    editingStudent?.emergencyContactPerson?.relation || '',
  );
  const [ecPhone, setEcPhone] = useState(
    editingStudent?.emergencyContactPerson?.phone || '',
  );
  const [addressLine1, setAddressLine1] = useState(
    editingStudent?.address?.line1 || '',
  );
  const [addressCity, setAddressCity] = useState(
    editingStudent?.address?.city || '',
  );
  const [addressState, setAddressState] = useState(
    editingStudent?.address?.state || '',
  );
  const [addressPincode, setAddressPincode] = useState(
    editingStudent?.address?.pincode || '',
  );
  const [addressCountry, setAddressCountry] = useState(
    editingStudent?.address?.country || '',
  );
  const [cityIsOther, setCityIsOther] = useState(() => {
    const c = editingStudent?.address?.city || '';
    const s = editingStudent?.address?.state || '';
    return !!c && !(INDIA_STATES_AND_CITIES[s] || []).includes(c);
  });
  const cityOptions = addressState
    ? INDIA_STATES_AND_CITIES[addressState] || []
    : [];
  const [experienceLevel, setExperienceLevel] = useState<
    (typeof EXPERIENCE_LEVELS)[number] | ''
  >(editingStudent?.sportsProfile?.experienceLevel || '');
  const [previousAcademy, setPreviousAcademy] = useState(
    editingStudent?.sportsProfile?.previousAcademy || '',
  );
  const [yearsOfExperience, setYearsOfExperience] = useState(
    editingStudent?.sportsProfile?.yearsOfExperience != null
      ? String(editingStudent.sportsProfile.yearsOfExperience)
      : '',
  );
  const [playingLevel, setPlayingLevel] = useState<
    (typeof PLAYING_LEVELS)[number] | ''
  >(editingStudent?.sportsProfile?.playingLevel || '');
  const [plans, setPlans] = useState<any[]>([]);
  const [planId, setPlanId] = useState('');
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>(
    'monthly',
  );

  useEffect(() => {
    employeeAPI
      .getAll({ role: 'coach' })
      .then((res: any) => setCoaches(res.data || []))
      .catch(() => {});
    sportsPlanAPI
      .getAll()
      .then((res: any) => setPlans(res.data || []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!isEditing) return;
    subscriptionAPI
      .getAll({ studentId: editingStudent._id })
      .then((res: any) => {
        const active = (res.data || []).find(
          (s: any) => s.status === 'active' || s.status === 'pending_renewal',
        );
        if (active) {
          setPlanId(active.plan?._id || active.plan);
          setBillingCycle(active.billingCycle || 'monthly');
        }
      })
      .catch(() => {});
  }, [isEditing, editingStudent?._id]);

  useEffect(() => {
    navigation.setOptions?.({
      title: isEditing ? 'Edit Student' : 'Add Student',
    });
  }, [navigation, isEditing]);

  const coachOptions = useMemo(
    () =>
      sport.trim() ? coaches.filter(c => c.sport === sport.trim()) : coaches,
    [coaches, sport],
  );

  const addGuardian = () => {
    setGuardians(p => [
      ...p,
      { relation: 'father', name: '', phone: '', email: '', password: '' },
    ]);
  };

  const updateGuardian = (i: number, patch: Partial<GuardianForm>) => {
    setGuardians(p => p.map((g, idx) => (idx === i ? { ...g, ...patch } : g)));
  };

  const removeGuardian = (i: number) => {
    setGuardians(p => p.filter((_, idx) => idx !== i));
  };

  // Only one guardian may receive WhatsApp notifications — selecting one
  // clears the flag on every other guardian, so it behaves like a radio.
  const setWhatsappGuardian = (i: number) => {
    setGuardians(p =>
      p.map((g, idx) => ({ ...g, receivesWhatsapp: idx === i })),
    );
  };

  const save = async () => {
    if (!firstName.trim() || !lastName.trim() || !sport.trim()) {
      Alert.alert(
        'Missing fields',
        'First name, last name and sport are required',
      );
      return;
    }
    if (guardians.some(g => !g.name.trim())) {
      Alert.alert('Missing fields', 'Every guardian needs a name');
      return;
    }
    if (guardians.some(g => g.password && g.password.length < 6)) {
      Alert.alert(
        'Weak password',
        'Guardian login password must be at least 6 characters',
      );
      return;
    }

    setSaving(true);
    try {
      const payload = {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        sport: sport.trim(),
        batch: batch.trim(),
        gender,
        coach: coachId || undefined,
        guardians: guardians.map(g => ({
          relation: g.relation,
          name: g.name.trim(),
          phone: g.phone.trim() || undefined,
          email: g.email?.trim() || undefined,
          password: g.password || undefined,
          photo: g.existingPhoto,
          receivesWhatsapp: !!g.receivesWhatsapp,
        })),
        bloodGroup: bloodGroup || undefined,
        emergencyContactPerson:
          ecName.trim() || ecRelation.trim() || ecPhone.trim()
            ? {
                name: ecName.trim() || undefined,
                relation: ecRelation.trim() || undefined,
                phone: ecPhone.trim() || undefined,
              }
            : undefined,
        address:
          addressLine1.trim() ||
          addressCity.trim() ||
          addressState.trim() ||
          addressPincode.trim() ||
          addressCountry.trim()
            ? {
                line1: addressLine1.trim() || undefined,
                city: addressCity.trim() || undefined,
                state: addressState.trim() || undefined,
                pincode: addressPincode.trim() || undefined,
                country: addressCountry.trim() || undefined,
              }
            : undefined,
        sportsProfile:
          experienceLevel ||
          previousAcademy.trim() ||
          yearsOfExperience.trim() ||
          playingLevel
            ? {
                experienceLevel: experienceLevel || undefined,
                previousAcademy: previousAcademy.trim() || undefined,
                yearsOfExperience: yearsOfExperience.trim()
                  ? Number(yearsOfExperience.trim())
                  : undefined,
                playingLevel: playingLevel || undefined,
              }
            : undefined,
      };

      const res: any = isEditing
        ? await studentAPI.update(editingStudent._id, payload)
        : await studentAPI.create(payload);
      const student = res.data;

      if (avatarFile) {
        await studentAPI.uploadAvatar(student._id, avatarFile).catch(() => {});
      }
      if (faceFile) {
        await studentAPI.enrollFace(student._id, faceFile).catch(() => {});
      }
      for (let i = 0; i < guardians.length; i++) {
        const file = guardians[i].photo;
        const guardianId = student.guardians?.[i]?._id;
        if (file && guardianId) {
          await studentAPI
            .uploadGuardianPhoto(student._id, guardianId, file)
            .catch(() => {});
        }
      }

      if (planId) {
        await subscriptionAPI
          .assign({ studentId: student._id, planId, billingCycle })
          .catch(() => {});
      }

      Alert.alert(
        'Success',
        isEditing
          ? 'Student updated successfully'
          : 'Student added successfully',
      );
      navigation.goBack();
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Could not save student');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView edges={['top']} style={styles.screen}>
      <ScrollView
        style={styles.screen}
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
      >
        <View style={styles.avatarRow}>
          <Avatar
            uri={avatarFile?.uri || editingStudent?.avatar}
            name={firstName}
            size={84}
            onPress={() => pickPhoto(setAvatarFile)}
          />
          <Text style={styles.avatarHint}>Tap to add student photo</Text>
          <TouchableOpacity
            style={styles.faceEnrollBtn}
            onPress={() => captureFacePhoto(setFaceFile)}
          >
            <ScanFace
              size={14}
              color={faceFile ? colors.green : colors.blue}
              strokeWidth={2.5}
            />
            <Text
              style={[
                styles.faceEnrollText,
                faceFile && { color: colors.green },
              ]}
            >
              {faceFile
                ? 'Face captured — tap to retake'
                : 'Enroll face for attendance'}
            </Text>
          </TouchableOpacity>
        </View>

        <Card>
          <SectionTitle title="Student Details" />
          <View
            style={{
              flexDirection: 'row',
              gap: 10,
              marginBottom: 12,
              flex: 1,
              justifyContent: 'center',
            }}
          >
            <TextField
              label="First Name"
              value={firstName}
              onChangeText={setFirstName}
              required
            />
            <TextField
              label="Last Name"
              value={lastName}
              onChangeText={setLastName}
              required
            />
          </View>
          <View
            style={{
              flexDirection: 'row',
              gap: 10,
              marginBottom: 12,
              flex: 1,
              justifyContent: 'center',
            }}
          >
            <TextField
              label="Sport"
              value={sport}
              onChangeText={setSport}
              placeholder="e.g. Football"
              required
            />
            <TextField
              label="Batch"
              value={batch}
              onChangeText={setBatch}
              placeholder="e.g. Morning U-12"
            />
          </View>
          <ChipSelect
            label="Gender"
            options={GENDERS}
            value={gender}
            onChange={setGender}
          />
          {coachOptions.length > 0 && (
            <View style={{ marginTop: 4 }}>
              <Text style={styles.coachLabel}>Coach</Text>
              <View style={styles.coachChipRow}>
                {coachOptions.map(c => (
                  <TouchableOpacity
                    key={c._id}
                    onPress={() => setCoachId(p => (p === c._id ? '' : c._id))}
                    style={[
                      styles.coachChip,
                      coachId === c._id && styles.coachChipActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.coachChipText,
                        coachId === c._id && styles.coachChipTextActive,
                      ]}
                    >
                      {c.firstName} {c.lastName}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}
          <ChipSelect
            label="Blood Group"
            options={BLOOD_GROUPS}
            value={bloodGroup as any}
            onChange={setBloodGroup}
          />
        </Card>

        <CollapsibleSection title="Emergency Contact">
          <TextField label="Name" value={ecName} onChangeText={setEcName} />
          <TextField
            label="Relation"
            value={ecRelation}
            onChangeText={setEcRelation}
            placeholder="e.g. Father, Mother"
          />
          <TextField
            label="Phone Number"
            value={ecPhone}
            onChangeText={setEcPhone}
            keyboardType="phone-pad"
          />
        </CollapsibleSection>

        <CollapsibleSection title="Address">
          <TextField
            label="Line 1"
            value={addressLine1}
            onChangeText={setAddressLine1}
          />
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <PickerField
              label="State"
              value={addressState}
              options={INDIA_STATES}
              onChange={v => {
                setAddressState(v);
                setAddressCity('');
                setCityIsOther(false);
              }}
              placeholder="Select state"
            />
            {cityIsOther ? (
              <TextField
                label="City"
                value={addressCity}
                onChangeText={setAddressCity}
                placeholder="Enter city name"
              />
            ) : (
              <PickerField
                label="City"
                value={addressCity}
                options={[...cityOptions, 'Other']}
                onChange={v => {
                  if (v === 'Other') {
                    setCityIsOther(true);
                    setAddressCity('');
                  } else {
                    setAddressCity(v);
                  }
                }}
                placeholder="Select city"
                disabled={!addressState}
                disabledHint="Select a state first"
              />
            )}
          </View>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <TextField
              label="Pincode"
              value={addressPincode}
              onChangeText={setAddressPincode}
              keyboardType="number-pad"
            />
            <TextField
              label="Country"
              value={addressCountry}
              onChangeText={setAddressCountry}
            />
          </View>
        </CollapsibleSection>

        <CollapsibleSection title="Sports Profile">
          <ChipSelect
            label="Experience Level"
            options={EXPERIENCE_LEVELS}
            value={experienceLevel as any}
            onChange={setExperienceLevel}
          />
          <TextField
            label="Previous Academy"
            value={previousAcademy}
            onChangeText={setPreviousAcademy}
          />
          <TextField
            label="Years of Experience"
            value={yearsOfExperience}
            onChangeText={setYearsOfExperience}
            keyboardType="number-pad"
          />
          <ChipSelect
            label="Playing Level"
            options={PLAYING_LEVELS}
            value={playingLevel as any}
            onChange={setPlayingLevel}
          />
        </CollapsibleSection>

        <CollapsibleSection title="Subscription Plan">
          <Text style={styles.planHint}>
            Assign a coaching plan so the parent sees it as due for payment.
            Leave unset to skip billing for now.
          </Text>
          <View style={styles.coachChipRow}>
            <TouchableOpacity
              onPress={() => setPlanId('')}
              style={[
                styles.coachChip,
                planId === '' && styles.coachChipActive,
              ]}
            >
              <Text
                style={[
                  styles.coachChipText,
                  planId === '' && styles.coachChipTextActive,
                ]}
              >
                No plan
              </Text>
            </TouchableOpacity>
            {plans.map(p => (
              <TouchableOpacity
                key={p._id}
                onPress={() => setPlanId(p._id)}
                style={[
                  styles.coachChip,
                  planId === p._id && styles.coachChipActive,
                ]}
              >
                <Text
                  style={[
                    styles.coachChipText,
                    planId === p._id && styles.coachChipTextActive,
                  ]}
                >
                  {p.name} ({p.sport})
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          {!!planId && (
            <>
              <ChipSelect
                label="Billing Cycle"
                options={['monthly', 'yearly'] as const}
                value={billingCycle}
                onChange={setBillingCycle}
              />
              {(() => {
                const selected = plans.find(p => p._id === planId);
                if (!selected) return null;
                const amount =
                  billingCycle === 'yearly'
                    ? selected.yearlyPrice
                    : selected.monthlyPrice;
                return (
                  <View style={styles.planAmountBox}>
                    <Text style={styles.planAmountLabel}>
                      Amount Due ({billingCycle})
                    </Text>
                    <Text style={styles.planAmountValue}>
                      ₹{Number(amount).toLocaleString('en-IN')}
                    </Text>
                  </View>
                );
              })()}
            </>
          )}
        </CollapsibleSection>

        <Card>
          <View style={styles.guardianHeader}>
            <SectionTitle
              title="Guardians / Parents"
              sub="Add their contact details and photo"
            />
          </View>

          {guardians.map((g, i) => (
            <View key={i} style={styles.guardianBlock}>
              <View style={styles.guardianTop}>
                <Avatar
                  uri={g.photo?.uri || g.existingPhoto}
                  name={g.name}
                  size={56}
                  onPress={() =>
                    pickPhoto(file => updateGuardian(i, { photo: file }))
                  }
                />
                <View style={{ flex: 1 }}>
                  <ChipSelect
                    label="Relation"
                    options={RELATIONS}
                    value={g.relation}
                    onChange={v => updateGuardian(i, { relation: v })}
                  />
                </View>
              </View>
              <TextField
                label="Name"
                value={g.name}
                onChangeText={v => updateGuardian(i, { name: v })}
                required
              />
              <TextField
                label="Phone"
                value={g.phone}
                onChangeText={v => updateGuardian(i, { phone: v })}
                keyboardType="phone-pad"
              />
              <TextField
                label="Email (Parent Login)"
                value={g.email || ''}
                onChangeText={v => updateGuardian(i, { email: v })}
                keyboardType="email-address"
              />
              <TextField
                label="Password (Parent Login)"
                value={g.password || ''}
                onChangeText={v => updateGuardian(i, { password: v })}
                secureTextEntry
              />
              <TouchableOpacity
                onPress={() => setWhatsappGuardian(i)}
                style={styles.whatsappBtn}
              >
                {g.receivesWhatsapp ? (
                  <CircleCheck
                    size={16}
                    color={colors.green}
                    strokeWidth={2.5}
                  />
                ) : (
                  <Circle size={16} color={colors.muted} strokeWidth={2.5} />
                )}
                <Text
                  style={[
                    styles.whatsappBtnText,
                    g.receivesWhatsapp && { color: colors.green },
                  ]}
                >
                  Sends WhatsApp updates
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => removeGuardian(i)}
                style={styles.removeBtn}
              >
                <Trash2 size={14} color={colors.red} strokeWidth={2.5} />
                <Text style={styles.removeBtnText}>Remove guardian</Text>
              </TouchableOpacity>
            </View>
          ))}

          <TouchableOpacity onPress={addGuardian} style={styles.addGuardianBtn}>
            <Plus size={16} color={colors.blue} strokeWidth={2.5} />
            <Text style={styles.addGuardianText}>Add Guardian</Text>
          </TouchableOpacity>
        </Card>

        <Button
          title={
            saving ? 'Saving...' : isEditing ? 'Update Student' : 'Save Student'
          }
          onPress={save}
          disabled={saving}
        />
        {saving && (
          <ActivityIndicator style={{ marginTop: 12 }} color={colors.blue} />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.white },
  avatarRow: { alignItems: 'center', marginBottom: 16 },
  avatarHint: {
    fontFamily: FONT.medium,
    color: colors.muted,
    fontSize: 12,
    marginTop: 8,
  },
  faceEnrollBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 10,
  },
  faceEnrollText: {
    fontFamily: FONT.bold,
    fontWeight: '700',
    fontSize: 12,
    color: colors.blue,
  },
  coachLabel: {
    fontFamily: FONT.bold,
    fontWeight: '700',
    fontSize: 12,
    color: colors.black,
    marginBottom: 6,
  },
  coachChipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  coachChip: {
    borderWidth: 2,
    borderColor: colors.black,
    backgroundColor: colors.white,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  coachChipActive: { backgroundColor: colors.blue },
  coachChipText: {
    fontFamily: FONT.bold,
    fontWeight: '700',
    fontSize: 11,
    color: colors.black,
  },
  coachChipTextActive: { color: colors.white },
  guardianHeader: { marginBottom: 4 },
  guardianBlock: {
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    padding: 12,
    marginBottom: 12,
  },
  guardianTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 4,
  },
  whatsappBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    marginBottom: 8,
  },
  whatsappBtnText: {
    fontFamily: FONT.bold,
    fontWeight: '700',
    fontSize: 12,
    color: colors.muted,
  },
  removeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
  },
  removeBtnText: {
    fontFamily: FONT.bold,
    fontWeight: '700',
    fontSize: 12,
    color: colors.red,
  },
  addGuardianBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 2,
    borderColor: colors.blue,
    borderStyle: 'dashed',
    paddingVertical: 12,
  },
  addGuardianText: {
    fontFamily: FONT.bold,
    fontWeight: '700',
    fontSize: 13,
    color: colors.blue,
  },
  planHint: {
    fontFamily: FONT.medium,
    color: colors.muted,
    fontSize: 12,
    marginBottom: 10,
  },
  planAmountBox: {
    borderWidth: 2,
    borderColor: colors.black,
    backgroundColor: '#024BAB0D',
    padding: 12,
    marginTop: 4,
  },
  planAmountLabel: {
    fontFamily: FONT.bold,
    fontWeight: '700',
    fontSize: 11,
    color: colors.muted,
    textTransform: 'uppercase',
  },
  planAmountValue: {
    fontFamily: FONT.bold,
    fontWeight: '700',
    fontSize: 20,
    color: colors.black,
    marginTop: 2,
  },
});
