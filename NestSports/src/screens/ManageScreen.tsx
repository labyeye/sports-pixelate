import React, { useCallback, useEffect, useState } from "react";
import { ScrollView, Text, RefreshControl, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { designationAPI } from "../api/client";
import { Card, SectionTitle, Row, LoadingView } from "../components/ui";
import { colors } from "../theme/colors";

export default function ManageScreen({ navigation }: any) {
  const [designations, setDesignations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const res: any = await designationAPI.getAll();
    setDesignations(res.data || []);
  }, []);

  useEffect(() => {
    load()
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load().catch(() => {});
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
        <Text style={styles.title}>Manage</Text>
        <Text style={styles.subtitle}>Academy configuration and modules</Text>

        <Card>
          <SectionTitle title="Modules" />
          <Row title="Departments" subtitle="Manage teams and departments" onPress={() => navigation?.navigate?.("Departments")} />
          <Row title="Employees" subtitle="Manage staff and coaches" onPress={() => navigation?.navigate?.("Employees")} />
          <Row title="Facilities" subtitle="Sports facilities and rates" onPress={() => navigation?.navigate?.("Facilities")} />
          <Row title="Coaching Plans" subtitle="Sports plans and pricing" onPress={() => navigation?.navigate?.("Plans")} />
          <Row title="Payroll Settings" subtitle="Deduction rules" onPress={() => navigation?.navigate?.("PayrollSettings")} />
        </Card>

        <Card>
          <SectionTitle title="Designations" sub="Read-only list" />
          {designations.length > 0 ? (
            designations.map((d) => (
              <Row
                key={d._id}
                title={d.name}
                subtitle={`${d.department?.name || "—"} · Grade ${d.grade || "—"}`}
              />
            ))
          ) : (
            <Row title="No designations found" />
          )}
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  title: { fontSize: 24, fontWeight: "800", color: colors.black },
  subtitle: { color: colors.muted, marginTop: 2, marginBottom: 16 },
});
