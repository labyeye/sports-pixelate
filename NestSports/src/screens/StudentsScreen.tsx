import React, { useCallback, useEffect, useState } from "react";
import { ScrollView, TouchableOpacity, RefreshControl, StyleSheet, View, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Plus } from "lucide-react-native";
import { studentAPI } from "../api/client";
import { Card, Row, Badge, Avatar, EmptyState, LoadingView } from "../components/ui";
import { colors, FONT } from "../theme/colors";

export default function StudentsScreen({ navigation }: any) {
  const [students, setStudents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(
    () => studentAPI.getAll().then((res: any) => res.success && setStudents(res.data || [])),
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
        <View style={styles.headerRow}>
          <Text style={styles.headerTitle}>Students</Text>
          <TouchableOpacity onPress={() => navigation.navigate("AddStudent")} style={styles.addBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Plus size={20} color={colors.blue} strokeWidth={2.5} />
          </TouchableOpacity>
        </View>
        <Card>
          {students.length === 0 ? (
            <EmptyState title="No students found" />
          ) : (
            students.map((s: any) => (
              <Row
                key={s._id}
                title={`${s.firstName} ${s.lastName}`}
                subtitle={`${s.studentId || ""} · ${s.batch || ""}`}
                left={<Avatar uri={s.avatar} name={s.firstName} size={36} />}
                right={<Badge label={s.sport || "-"} color={colors.blue} />}
              />
            ))
          )}
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  headerTitle: { fontSize: 20, fontWeight: "800", color: colors.black, fontFamily: FONT.bold },
  addBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.white,
    borderWidth: 2,
    borderColor: colors.black,
  },
});
