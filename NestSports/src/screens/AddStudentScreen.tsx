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
import { Plus, Trash2, ScanFace } from 'lucide-react-native';
import { studentAPI, employeeAPI, RNFile } from '../api/client';
import {
  Card,
  Avatar,
  TextField,
  ChipSelect,
  Button,
  SectionTitle,
} from '../components/ui';
import { colors, FONT } from '../theme/colors';

const GENDERS = ['male', 'female', 'other'] as const;
const RELATIONS = ['father', 'mother', 'guardian', 'other'] as const;

interface GuardianForm {
  _id?: string;
  relation: (typeof RELATIONS)[number];
  name: string;
  phone: string;
  photo?: RNFile;
  existingPhoto?: string;
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
      existingPhoto: g.photo,
    })),
  );
  const [saving, setSaving] = useState(false);
  const [coaches, setCoaches] = useState<any[]>([]);
  const [coachId, setCoachId] = useState<string>(
    editingStudent?.coach?._id || '',
  );

  useEffect(() => {
    employeeAPI
      .getAll({ role: 'coach' })
      .then((res: any) => setCoaches(res.data || []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    navigation.setOptions?.({ title: isEditing ? 'Edit Student' : 'Add Student' });
  }, [navigation, isEditing]);

  const coachOptions = useMemo(
    () => (sport.trim() ? coaches.filter(c => c.sport === sport.trim()) : coaches),
    [coaches, sport],
  );

  const addGuardian = () => {
    setGuardians(p => [...p, { relation: 'father', name: '', phone: '' }]);
  };

  const updateGuardian = (i: number, patch: Partial<GuardianForm>) => {
    setGuardians(p => p.map((g, idx) => (idx === i ? { ...g, ...patch } : g)));
  };

  const removeGuardian = (i: number) => {
    setGuardians(p => p.filter((_, idx) => idx !== i));
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
          photo: g.existingPhoto,
        })),
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

      Alert.alert('Success', isEditing ? 'Student updated successfully' : 'Student added successfully');
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
              {faceFile ? 'Face captured — tap to retake' : 'Enroll face for attendance'}
            </Text>
          </TouchableOpacity>
        </View>

        <Card>
          <SectionTitle title="Student Details" />
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
                    onPress={() =>
                      setCoachId(p => (p === c._id ? '' : c._id))
                    }
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
        </Card>

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
          title={saving ? 'Saving...' : isEditing ? 'Update Student' : 'Save Student'}
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
});
