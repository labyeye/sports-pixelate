import React, { useState } from "react";
import { ScrollView, Text, StyleSheet, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { tournamentAPI } from "../api/client";
import { Card, TextField, ChipSelect, Button, SectionTitle } from "../components/ui";
import { colors, FONT } from "../theme/colors";

const FORMATS = ["knockout", "round_robin"] as const;
const FORMAT_LABELS: Record<(typeof FORMATS)[number], string> = {
  knockout: "Knockout",
  round_robin: "Round Robin",
};

export default function CreateTournamentScreen({ navigation }: any) {
  const [name, setName] = useState("");
  const [sport, setSport] = useState("");
  const [format, setFormat] = useState<(typeof FORMATS)[number]>("knockout");
  const [venue, setVenue] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!name.trim() || !sport.trim()) {
      Alert.alert("Missing fields", "Name and sport are required");
      return;
    }
    setSaving(true);
    try {
      const res: any = await tournamentAPI.create({
        name: name.trim(),
        sport: sport.trim(),
        format,
        venue: venue.trim() || undefined,
        startDate: startDate.trim() || undefined,
        endDate: endDate.trim() || undefined,
      });
      navigation.replace("TournamentDetail", { id: res.data._id });
    } catch (e: any) {
      Alert.alert("Error", e?.message || "Could not create tournament");
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView edges={["top"]} style={styles.screen}>
      <ScrollView style={styles.screen} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        <Card>
          <SectionTitle title="Tournament Details" />
          <TextField label="Tournament Name" value={name} onChangeText={setName} placeholder="e.g. Summer Football Cup" required />
          <TextField label="Sport" value={sport} onChangeText={setSport} placeholder="e.g. Football" required />
          <ChipSelect label="Format" options={FORMATS} value={format} onChange={setFormat} labels={FORMAT_LABELS} />
          <TextField label="Venue" value={venue} onChangeText={setVenue} placeholder="Optional" />
          <TextField label="Start Date" value={startDate} onChangeText={setStartDate} placeholder="YYYY-MM-DD" />
          <TextField label="End Date" value={endDate} onChangeText={setEndDate} placeholder="YYYY-MM-DD" />
        </Card>
        <Text style={styles.hint}>You can add teams and generate fixtures from the tournament page after creating it.</Text>
        <Button title={saving ? "Creating..." : "Create Tournament"} onPress={save} disabled={saving} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  hint: { fontFamily: FONT.medium, fontSize: 12, color: colors.muted, marginBottom: 14 },
});
