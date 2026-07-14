import React, { useCallback, useEffect, useState } from "react";
import { ScrollView, RefreshControl, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { documentAPI } from "../api/client";
import { Card, Row, Badge, EmptyState, LoadingView } from "../components/ui";
import { colors } from "../theme/colors";

export default function DocumentsScreen() {
  const [documents, setDocuments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(
    () => documentAPI.getAll().then((res: any) => res.success && setDocuments(res.data || [])),
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
        <Card>
          {documents.length === 0 ? (
            <EmptyState title="No documents found" />
          ) : (
            documents.map((doc: any) => (
              <Row
                key={doc._id}
                title={doc.name}
                subtitle={
                  doc.createdAt
                    ? new Date(doc.createdAt).toLocaleDateString("en-IN", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      })
                    : ""
                }
                right={<Badge label={(doc.docType || "-").replace(/_/g, " ")} color={colors.blue} />}
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
});
