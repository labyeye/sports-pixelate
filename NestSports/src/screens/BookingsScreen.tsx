import React, { useCallback, useEffect, useState } from "react";
import { ScrollView, View, Text, RefreshControl, StyleSheet, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { bookingAPI } from "../api/client";
import { Card, EmptyState, LoadingView, Badge, Button } from "../components/ui";
import { colors } from "../theme/colors";

const STATUS_COLORS: Record<string, string> = {
  confirmed: colors.green,
  completed: colors.blue,
  cancelled: colors.red,
};

export default function BookingsScreen() {
  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res: any = await bookingAPI.getAll();
    setBookings(res.data || []);
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
    Alert.alert("Cancel Booking", "Are you sure you want to cancel this booking?", [
      { text: "No", style: "cancel" },
      {
        text: "Yes, Cancel",
        style: "destructive",
        onPress: async () => {
          setCancellingId(id);
          try {
            await bookingAPI.cancel(id);
            await load();
          } catch (e: any) {
            Alert.alert("Error", e.message || "Failed to cancel booking");
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
        <Text style={styles.title}>Bookings</Text>
        <Text style={styles.subtitle}>Facility bookings and schedules</Text>

        {bookings.length === 0 ? (
          <Card>
            <EmptyState title="No bookings found" />
          </Card>
        ) : (
          bookings.map((b) => (
            <Card key={b._id}>
              <View style={styles.headerRow}>
                <Text style={styles.name}>{b.facility?.name || "Facility"}</Text>
                <Badge label={b.status} color={STATUS_COLORS[b.status] || colors.muted} />
              </View>
              <Text style={styles.dateText}>
                {b.date ? new Date(b.date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—"} · {b.startTime}–{b.endTime}
              </Text>
              <Text style={styles.feeText}>{b.fee > 0 ? `₹${b.fee.toLocaleString("en-IN")}` : "Free"}</Text>
              {b.status === "confirmed" && (
                <Button
                  title="Cancel Booking"
                  onPress={() => handleCancel(b._id)}
                  color={colors.red}
                  variant="outline"
                  loading={cancellingId === b._id}
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
  dateText: { color: colors.muted, fontSize: 12, marginTop: 4 },
  feeText: { fontWeight: "800", color: colors.black, fontSize: 15, marginTop: 8, marginBottom: 12 },
});
