import React, { useCallback, useEffect, useState } from "react";
import { ScrollView, View, Text, RefreshControl, StyleSheet, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { payrollAPI } from "../api/client";
import { Card, EmptyState, LoadingView, Badge, Button } from "../components/ui";
import { colors } from "../theme/colors";

function formatCurrency(n: number) {
  return `₹${Math.round(n || 0).toLocaleString("en-IN")}`;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export default function PayrollScreen() {
  const [payrolls, setPayrolls] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [markingId, setMarkingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res: any = await payrollAPI.getAll();
    setPayrolls(res.data || []);
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

  const handleMarkPaid = (id: string) => {
    Alert.alert("Mark as Paid", "Confirm this payroll has been paid?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Confirm",
        onPress: async () => {
          setMarkingId(id);
          try {
            await payrollAPI.markPaid(id);
            await load();
          } catch (e: any) {
            Alert.alert("Error", e.message || "Failed to mark as paid");
          } finally {
            setMarkingId(null);
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
        <Text style={styles.title}>Payroll</Text>
        <Text style={styles.subtitle}>Employee salary records</Text>

        {payrolls.length === 0 ? (
          <Card>
            <EmptyState title="No payroll records found" />
          </Card>
        ) : (
          payrolls.map((p) => (
            <Card key={p._id}>
              <View style={styles.headerRow}>
                <Text style={styles.name}>
                  {p.employee ? `${p.employee.firstName} ${p.employee.lastName}` : "—"}
                </Text>
                <Badge label={p.status} color={p.status === "paid" ? colors.green : colors.orange} />
              </View>
              <Text style={styles.sub}>
                {p.month ? `${MONTHS[p.month - 1]} ${p.year}` : "—"}
              </Text>
              <Text style={styles.amount}>{formatCurrency(p.netSalary)}</Text>
              {p.status !== "paid" && (
                <Button
                  title="Mark Paid"
                  onPress={() => handleMarkPaid(p._id)}
                  color={colors.green}
                  loading={markingId === p._id}
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
  sub: { color: colors.muted, fontSize: 12, marginTop: 4 },
  amount: { fontWeight: "800", color: colors.black, fontSize: 16, marginTop: 8, marginBottom: 12 },
});
