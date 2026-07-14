import React, { useCallback, useEffect, useState } from "react";
import { ScrollView, Text, RefreshControl, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { auditAPI } from "../api/client";
import { Card, SectionTitle, Row, LoadingView, EmptyState } from "../components/ui";
import { colors } from "../theme/colors";

function actionLabel(action: string) {
  return action.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function fmt(d: string) {
  return new Date(d).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function AuditLogScreen() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(
    () => auditAPI.getLogs().then((res: any) => setLogs(res.data || [])),
    [],
  );

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
        <Text style={styles.title}>Audit Log</Text>
        <Text style={styles.subtitle}>Track who changed what and when</Text>

        <Card>
          <SectionTitle title={`${logs.length} recent activities`} />
          {logs.length > 0 ? (
            logs.map((log) => (
              <Row
                key={log._id}
                title={actionLabel(log.action)}
                subtitle={`${log.user?.name || log.userName || "System"} · ${fmt(log.createdAt)}`}
              />
            ))
          ) : (
            <EmptyState title="No audit logs found" />
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
