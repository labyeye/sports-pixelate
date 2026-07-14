import React, { useCallback, useEffect, useState } from "react";
import { ScrollView, Text, RefreshControl, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { settingsAPI, companyAPI } from "../api/client";
import { useAuth } from "../contexts/AuthContext";
import { Card, SectionTitle, Row, LoadingView, EmptyState, Button } from "../components/ui";
import { colors } from "../theme/colors";

export default function SettingsScreen() {
  const { logout } = useAuth();
  const [settings, setSettings] = useState<any>(null);
  const [company, setCompany] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const [settingsRes, companyRes] = await Promise.all([
      settingsAPI.get().catch(() => null),
      companyAPI.getMe().catch(() => null),
    ]);
    if (settingsRes?.success) setSettings(settingsRes.data);
    if (companyRes?.success) setCompany(companyRes.data);
  }, []);

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  if (loading) return <LoadingView />;

  return (
    <SafeAreaView edges={["top"]} style={styles.screen}>
      <ScrollView
        style={styles.screen}
        contentContainerStyle={{ padding: 16 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <Text style={styles.title}>Settings</Text>
        <Text style={styles.subtitle}>Academy & app configuration</Text>

        <Card>
          <SectionTitle title="Company" />
          {company ? (
            <>
              <Row title="Name" subtitle={company.name} />
              <Row title="Email" subtitle={company.email || "—"} />
              <Row title="Phone" subtitle={company.phone || "—"} />
            </>
          ) : (
            <EmptyState title="No company details found" />
          )}
        </Card>

        <Card>
          <SectionTitle title="Preferences" />
          {settings ? (
            <>
              <Row title="Timezone" subtitle={settings.timezone || "—"} />
              <Row title="Currency" subtitle={settings.currency || "INR"} />
            </>
          ) : (
            <EmptyState title="No settings found" />
          )}
        </Card>

        <Button title="Sign Out" onPress={logout} color={colors.red} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  title: { fontSize: 24, fontWeight: "800", color: colors.black },
  subtitle: { color: colors.muted, marginTop: 2, marginBottom: 16 },
});
