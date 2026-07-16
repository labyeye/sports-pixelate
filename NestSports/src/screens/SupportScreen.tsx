import React, { useCallback, useEffect, useState } from 'react';
import {
  ScrollView,
  View,
  Text,
  TextInput,
  RefreshControl,
  StyleSheet,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supportAPI } from '../api/client';
import {
  Card,
  SectionTitle,
  Row,
  LoadingView,
  EmptyState,
  Badge,
  Button,
} from '../components/ui';
import { colors } from '../theme/colors';

const PRIORITY_COLORS: Record<string, string> = {
  low: colors.green,
  medium: colors.yellow,
  high: colors.orange,
  critical: colors.red,
};

export default function SupportScreen() {
  const [tickets, setTickets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [subject, setSubject] = useState('');
  const [issueType, setIssueType] = useState('general');
  const [priority, setPriority] = useState('medium');
  const [description, setDescription] = useState('');

  const load = useCallback(
    () => supportAPI.getAll().then((res: any) => setTickets(res.data || [])),
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

  const onSubmit = async () => {
    if (!subject.trim() || !description.trim()) {
      Alert.alert('Missing fields', 'Please fill in subject and description');
      return;
    }
    setSubmitting(true);
    try {
      await supportAPI.create({
        subject: subject.trim(),
        issueType,
        priority,
        description: description.trim(),
      });
      setSubject('');
      setIssueType('general');
      setPriority('medium');
      setDescription('');
      await load();
    } catch (err: any) {
      Alert.alert('Failed to submit ticket', err.message || 'Please try again');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <LoadingView />;

  return (
    <SafeAreaView edges={['top']} style={styles.screen}>
      <ScrollView
        style={styles.screen}
        contentContainerStyle={{ padding: 16 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        <Text style={styles.title}>Support</Text>
        <Text style={styles.subtitle}>
          Report issues and track their resolution
        </Text>

        <Card>
          <SectionTitle title="New Ticket" />
          <View style={styles.field}>
            <Text style={styles.label}>Subject</Text>
            <TextInput
              style={styles.input}
              value={subject}
              onChangeText={setSubject}
              placeholder="Brief summary of the issue"
            />
          </View>
          <View style={styles.field}>
            <Text style={styles.label}>Issue Type</Text>
            <TextInput
              style={styles.input}
              value={issueType}
              onChangeText={setIssueType}
              placeholder="e.g., billing, attendance, payroll"
            />
          </View>
          <View style={styles.field}>
            <Text style={styles.label}>Priority</Text>
            <TextInput
              style={styles.input}
              value={priority}
              onChangeText={setPriority}
              placeholder="low / medium / high / critical"
            />
          </View>
          <View style={styles.field}>
            <Text style={styles.label}>Description</Text>
            <TextInput
              style={[styles.input, { height: 80, textAlignVertical: 'top' }]}
              value={description}
              onChangeText={setDescription}
              placeholder="Describe the issue in detail"
              multiline
            />
          </View>
          <Button
            title="Submit Ticket"
            onPress={onSubmit}
            loading={submitting}
          />
        </Card>

        <Card>
          <SectionTitle
            title={`${tickets.length} ticket${tickets.length === 1 ? '' : 's'}`}
          />
          {tickets.length > 0 ? (
            tickets.map(t => (
              <Row
                key={t._id}
                title={t.subject}
                subtitle={t.status}
                right={
                  <Badge
                    label={t.priority}
                    color={PRIORITY_COLORS[t.priority] || colors.blue}
                  />
                }
              />
            ))
          ) : (
            <EmptyState
              title="No support tickets yet"
              sub="Create a ticket to report an issue"
            />
          )}
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  title: { fontSize: 24, fontWeight: '800', color: colors.black },
  subtitle: { color: colors.muted, marginTop: 2, marginBottom: 16 },
  field: { marginBottom: 12 },
  label: {
    fontWeight: '700',
    marginBottom: 6,
    color: colors.black,
    fontSize: 12,
  },
  input: {
    borderWidth: 2,
    borderColor: colors.black,
    backgroundColor: colors.white,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
});
