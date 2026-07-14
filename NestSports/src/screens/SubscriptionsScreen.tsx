import React, { useCallback, useEffect, useState } from "react";
import { ScrollView, View, Text, RefreshControl, StyleSheet, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { subscriptionAPI } from "../api/client";
import { Card, EmptyState, LoadingView, Badge, Button } from "../components/ui";
import { colors } from "../theme/colors";

function formatCurrency(n: number) {
  return `₹${Math.round(n || 0).toLocaleString("en-IN")}`;
}

const STATUS_COLORS: Record<string, string> = {
  active: colors.green,
  pending_renewal: colors.orange,
  inactive: colors.orange,
  cancelled: colors.red,
};

export default function SubscriptionsScreen() {
  const [subscriptions, setSubscriptions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res: any = await subscriptionAPI.getAll();
    setSubscriptions(res.data || []);
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

  const handleCancel = (id: string) => {
    Alert.alert("Cancel Subscription", "Are you sure you want to cancel this subscription?", [
      { text: "No", style: "cancel" },
      {
        text: "Yes, Cancel",
        style: "destructive",
        onPress: async () => {
          setCancellingId(id);
          try {
            await subscriptionAPI.cancel(id);
            await load();
          } catch (e: any) {
            Alert.alert("Error", e.message || "Failed to cancel subscription");
          } finally {
            setCancellingId(null);
          }
        },
      },
    ]);
  };

  if (loading) return <LoadingView />;

  return (
    <SafeAreaView edges={["top"]} style={styles.screen}>
      <ScrollView
        style={styles.screen}
        contentContainerStyle={{ padding: 16 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <Text style={styles.title}>Subscriptions</Text>
        <Text style={styles.subtitle}>Coaching plan subscriptions and renewals</Text>

        {subscriptions.length === 0 ? (
          <Card>
            <EmptyState title="No subscriptions found" />
          </Card>
        ) : (
          subscriptions.map((s) => (
            <Card key={s._id}>
              <View style={styles.headerRow}>
                <Text style={styles.name}>
                  {s.student?.firstName} {s.student?.lastName}
                </Text>
                <Badge label={s.status?.replace("_", " ")} color={STATUS_COLORS[s.status] || colors.muted} />
              </View>
              <Text style={styles.planName}>{s.planName}</Text>
              <View style={styles.statsRow}>
                <View style={styles.statBox}>
                  <Text style={styles.statLabel}>AMOUNT</Text>
                  <Text style={styles.statValue}>{formatCurrency(s.amount)}</Text>
                </View>
                <View style={styles.statBox}>
                  <Text style={styles.statLabel}>RENEWAL</Text>
                  <Text style={styles.statValue}>
                    {s.renewalDate
                      ? new Date(s.renewalDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
                      : "—"}
                  </Text>
                </View>
              </View>
              {s.status === "active" && (
                <Button
                  title="Cancel Subscription"
                  onPress={() => handleCancel(s._id)}
                  color={colors.red}
                  variant="outline"
                  loading={cancellingId === s._id}
                />
              )}
            </Card>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  title: { fontSize: 24, fontWeight: "800", color: colors.black },
  subtitle: { color: colors.muted, marginTop: 2, marginBottom: 16 },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  name: { fontSize: 16, fontWeight: "800", color: colors.black },
  planName: { color: colors.muted, fontSize: 12, marginTop: 2, marginBottom: 10 },
  statsRow: { flexDirection: "row", gap: 10, marginBottom: 12 },
  statBox: {
    flex: 1,
    borderWidth: 2,
    borderColor: colors.black,
    backgroundColor: colors.background,
    padding: 10,
  },
  statLabel: { fontSize: 10, fontWeight: "700", color: colors.muted, marginBottom: 4 },
  statValue: { fontSize: 15, fontWeight: "800", color: colors.black },
});
