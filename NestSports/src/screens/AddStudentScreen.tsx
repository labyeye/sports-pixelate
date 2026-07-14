import React, { useState } from "react";
import { ScrollView, View, Text, TouchableOpacity, StyleSheet, Alert, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { launchCamera, launchImageLibrary, Asset } from "react-native-image-picker";
import { Plus, Trash2 } from "lucide-react-native";
import { studentAPI, RNFile } from "../api/client";
import { Card, Avatar, TextField, ChipSelect, Button, SectionTitle } from "../components/ui";
import { colors, FONT } from "../theme/colors";

const GENDERS = ["male", "female", "other"] as const;
const RELATIONS = ["father", "mother", "guardian", "other"] as const;

interface GuardianForm {
  relation: (typeof RELATIONS)[number];
  name: string;
  phone: string;
  photo?: RNFile;
}

function assetToRNFile(asset: Asset): RNFile | undefined {
  if (!asset.uri) return undefined;
  return {
    uri: asset.uri,
    name: asset.fileName || `photo_${Date.now()}.jpg`,
    type: asset.type || "image/jpeg",
  };
}

function pickPhoto(onPicked: (file: RNFile) => void) {
  Alert.alert("Add Photo", "Choose source", [
    {
      text: "Camera",
      onPress: () =>
        launchCamera({ mediaType: "photo", quality: 0.7 }, (r) => {
          const file = r.assets?.[0] && assetToRNFile(r.assets[0]);
          if (file) onPicked(file);
        }),
    },
    {
      text: "Gallery",
      onPress: () =>
        launchImageLibrary({ mediaType: "photo", quality: 0.7 }, (r) => {
          const file = r.assets?.[0] && assetToRNFile(r.assets[0]);
          if (file) onPicked(file);
        }),
    },
    { text: "Cancel", style: "cancel" },
  ]);
}

export default function AddStudentScreen({ navigation }: any) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [sport, setSport] = useState("");
  const [batch, setBatch] = useState("");
  const [gender, setGender] = useState<(typeof GENDERS)[number]>("male");
  const [avatarFile, setAvatarFile] = useState<RNFile | undefined>();
  const [guardians, setGuardians] = useState<GuardianForm[]>([]);
  const [saving, setSaving] = useState(false);

  const addGuardian = () => {
    setGuardians((p) => [...p, { relation: "father", name: "", phone: "" }]);
  };

  const updateGuardian = (i: number, patch: Partial<GuardianForm>) => {
    setGuardians((p) => p.map((g, idx) => (idx === i ? { ...g, ...patch } : g)));
  };

  const removeGuardian = (i: number) => {
    setGuardians((p) => p.filter((_, idx) => idx !== i));
  };

  const save = async () => {
    if (!firstName.trim() || !lastName.trim() || !sport.trim()) {
      Alert.alert("Missing fields", "First name, last name and sport are required");
      return;
    }
    if (guardians.some((g) => !g.name.trim())) {
      Alert.alert("Missing fields", "Every guardian needs a name");
      return;
    }

    setSaving(true);
    try {
      const res: any = await studentAPI.create({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        sport: sport.trim(),
        batch: batch.trim(),
        gender,
        guardians: guardians.map((g) => ({ relation: g.relation, name: g.name.trim(), phone: g.phone.trim() || undefined })),
      });
      const student = res.data;

      if (avatarFile) {
        await studentAPI.uploadAvatar(student._id, avatarFile).catch(() => {});
      }
      for (let i = 0; i < guardians.length; i++) {
        const file = guardians[i].photo;
        const guardianId = student.guardians?.[i]?._id;
        if (file && guardianId) {
          await studentAPI.uploadGuardianPhoto(student._id, guardianId, file).catch(() => {});
        }
      }

      Alert.alert("Success", "Student added successfully");
      navigation.goBack();
    } catch (e: any) {
      Alert.alert("Error", e?.message || "Could not add student");
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView edges={["top"]} style={styles.screen}>
      <ScrollView style={styles.screen} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        <View style={styles.avatarRow}>
          <Avatar uri={avatarFile?.uri} name={firstName} size={84} onPress={() => pickPhoto(setAvatarFile)} />
          <Text style={styles.avatarHint}>Tap to add student photo</Text>
        </View>

        <Card>
          <SectionTitle title="Student Details" />
          <TextField label="First Name" value={firstName} onChangeText={setFirstName} required />
          <TextField label="Last Name" value={lastName} onChangeText={setLastName} required />
          <TextField label="Sport" value={sport} onChangeText={setSport} placeholder="e.g. Football" required />
          <TextField label="Batch" value={batch} onChangeText={setBatch} placeholder="e.g. Morning U-12" />
          <ChipSelect label="Gender" options={GENDERS} value={gender} onChange={setGender} />
        </Card>

        <Card>
          <View style={styles.guardianHeader}>
            <SectionTitle title="Guardians / Parents" sub="Add their contact details and photo" />
          </View>

          {guardians.map((g, i) => (
            <View key={i} style={styles.guardianBlock}>
              <View style={styles.guardianTop}>
                <Avatar uri={g.photo?.uri} name={g.name} size={56} onPress={() => pickPhoto((file) => updateGuardian(i, { photo: file }))} />
                <View style={{ flex: 1 }}>
                  <ChipSelect label="Relation" options={RELATIONS} value={g.relation} onChange={(v) => updateGuardian(i, { relation: v })} />
                </View>
              </View>
              <TextField label="Name" value={g.name} onChangeText={(v) => updateGuardian(i, { name: v })} required />
              <TextField label="Phone" value={g.phone} onChangeText={(v) => updateGuardian(i, { phone: v })} keyboardType="phone-pad" />
              <TouchableOpacity onPress={() => removeGuardian(i)} style={styles.removeBtn}>
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

        <Button title={saving ? "Saving..." : "Save Student"} onPress={save} disabled={saving} />
        {saving && <ActivityIndicator style={{ marginTop: 12 }} color={colors.blue} />}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  avatarRow: { alignItems: "center", marginBottom: 16 },
  avatarHint: { fontFamily: FONT.medium, color: colors.muted, fontSize: 12, marginTop: 8 },
  guardianHeader: { marginBottom: 4 },
  guardianBlock: {
    borderWidth: 1.5,
    borderColor: "#E5E7EB",
    padding: 12,
    marginBottom: 12,
  },
  guardianTop: { flexDirection: "row", alignItems: "flex-start", gap: 12, marginBottom: 4 },
  removeBtn: { flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start" },
  removeBtnText: { fontFamily: FONT.bold, fontWeight: "700", fontSize: 12, color: colors.red },
  addGuardianBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderWidth: 2,
    borderColor: colors.blue,
    borderStyle: "dashed",
    paddingVertical: 12,
  },
  addGuardianText: { fontFamily: FONT.bold, fontWeight: "700", fontSize: 13, color: colors.blue },
});
