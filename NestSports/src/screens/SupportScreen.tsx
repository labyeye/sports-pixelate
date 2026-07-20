import React, { useCallback, useEffect, useState } from 'react';
import {
  ScrollView,
  View,
  Text,
  TouchableOpacity,
  RefreshControl,
  StyleSheet,
  Alert,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { X, Type, Tag, Flag, FileText, MessageSquare } from 'lucide-react-native';
import { supportAPI } from '../api/client';
import {
  Card,
  SectionTitle,
  Row,
  LoadingView,
  EmptyState,
  Badge,
  Button,
  TextField,
  ChipSelect,
} from '../components/ui';
import { colors, FONT } from '../theme/colors';

const PRIORITY_COLORS: Record<string, string> = {
  low: colors.green,
  medium: colors.yellow,
  high: colors.orange,
  critical: colors.red,
};

const ISSUE_TYPES = [
  'general',
  'billing',
  'attendance',
  'payroll',
  'technical',
] as const;
const PRIORITIES = ['low', 'medium', 'high', 'critical'] as const;

function fmt(d: string) {
  return new Date(d).toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function SupportScreen() {
  const [tickets, setTickets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [subject, setSubject] = useState('');
  const [issueType, setIssueType] =
    useState<(typeof ISSUE_TYPES)[number]>('general');
  const [priority, setPriority] =
    useState<(typeof PRIORITIES)[number]>('medium');
  const [description, setDescription] = useState('');

  const [selectedTicket, setSelectedTicket] = useState<any>(null);
  const [ticketLoading, setTicketLoading] = useState(false);
  const [replyMessage, setReplyMessage] = useState('');
  const [replying, setReplying] = useState(false);
  const [closing, setClosing] = useState(false);

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

  const openTicket = async (t: any) => {
    setSelectedTicket(t);
    setReplyMessage('');
    setTicketLoading(true);
    try {
      const res: any = await supportAPI.getOne(t._id);
      setSelectedTicket(res.data || t);
    } catch {
      // keep the list-row version if detail fetch fails
    } finally {
      setTicketLoading(false);
    }
  };

  const sendReply = async () => {
    if (!replyMessage.trim() || !selectedTicket) return;
    setReplying(true);
    try {
      await supportAPI.reply(selectedTicket._id, replyMessage.trim());
      const res: any = await supportAPI.getOne(selectedTicket._id);
      setSelectedTicket(res.data || selectedTicket);
      setReplyMessage('');
      await load();
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Could not send reply');
    } finally {
      setReplying(false);
    }
  };

  const closeTicket = () => {
    Alert.alert('Close Ticket', 'Mark this ticket as closed?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Close Ticket',
        style: 'destructive',
        onPress: async () => {
          setClosing(true);
          try {
            await supportAPI.close(selectedTicket._id);
            const res: any = await supportAPI.getOne(selectedTicket._id);
            setSelectedTicket(res.data || selectedTicket);
            await load();
          } catch (e: any) {
            Alert.alert('Error', e?.message || 'Could not close ticket');
          } finally {
            setClosing(false);
          }
        },
      },
    ]);
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
          <TextField
            label="Subject"
            icon={Type}
            value={subject}
            onChangeText={setSubject}
            placeholder="Brief summary of the issue"
          />
          <ChipSelect
            label="Issue Type"
            icon={Tag}
            options={ISSUE_TYPES}
            value={issueType}
            onChange={setIssueType}
          />
          <ChipSelect
            label="Priority"
            icon={Flag}
            options={PRIORITIES}
            value={priority}
            onChange={setPriority}
          />
          <TextField
            label="Description"
            icon={FileText}
            value={description}
            onChangeText={setDescription}
            placeholder="Describe the issue in detail"
            multiline
          />
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
                onPress={() => openTicket(t)}
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

      <Modal
        visible={!!selectedTicket}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setSelectedTicket(null)}
      >
        <SafeAreaView edges={['top']} style={styles.screen}>
          <View style={styles.formHeader}>
            <Text style={styles.formTitle} numberOfLines={1}>
              {selectedTicket?.subject}
            </Text>
            <TouchableOpacity
              onPress={() => setSelectedTicket(null)}
              hitSlop={8}
            >
              <X size={22} color={colors.black} />
            </TouchableOpacity>
          </View>
          {ticketLoading ? (
            <LoadingView />
          ) : (
            <ScrollView
              contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
            >
              <Card>
                <View style={styles.ticketMetaRow}>
                  <Badge
                    label={selectedTicket?.status}
                    color={
                      selectedTicket?.status === 'closed'
                        ? colors.muted
                        : colors.blue
                    }
                  />
                  <Badge
                    label={selectedTicket?.priority}
                    color={
                      PRIORITY_COLORS[selectedTicket?.priority] || colors.blue
                    }
                  />
                </View>
                <Text style={styles.threadLabel}>Conversation</Text>
                <View style={styles.thread}>
                  <View style={styles.threadItem}>
                    <Text style={styles.threadAuthor}>
                      {selectedTicket?.submittedBy?.name || 'Employee'}{' '}
                      (Original Request)
                    </Text>
                    <Text style={styles.threadMessage}>
                      {selectedTicket?.description}
                    </Text>
                    <Text style={styles.threadTime}>
                      {selectedTicket?.createdAt
                        ? fmt(selectedTicket.createdAt)
                        : ''}
                    </Text>
                  </View>
                  {(selectedTicket?.replies || []).map(
                    (r: any, idx: number) => (
                      <View key={idx} style={styles.threadItem}>
                        <Text style={styles.threadAuthor}>
                          {r.user?.name || 'System'}
                          {r.user?.role ? ` (${r.user.role})` : ''}
                        </Text>
                        <Text style={styles.threadMessage}>{r.message}</Text>
                        <Text style={styles.threadTime}>
                          {r.createdAt ? fmt(r.createdAt) : ''}
                        </Text>
                      </View>
                    ),
                  )}
                  {(!selectedTicket?.replies ||
                    selectedTicket.replies.length === 0) && (
                    <Text style={styles.noReplies}>No replies yet.</Text>
                  )}
                </View>

                {selectedTicket?.status !== 'closed' ? (
                  <>
                    <TextField
                      label="Reply"
                      icon={MessageSquare}
                      value={replyMessage}
                      onChangeText={setReplyMessage}
                      placeholder="Type your message..."
                      multiline
                    />
                    <View style={{ flexDirection: 'row', gap: 10 }}>
                      <View style={{ flex: 1 }}>
                        <Button
                          title="Send Reply"
                          onPress={sendReply}
                          loading={replying}
                        />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Button
                          title="Close Ticket"
                          color={colors.red}
                          variant="outline"
                          onPress={closeTicket}
                          loading={closing}
                        />
                      </View>
                    </View>
                  </>
                ) : (
                  <Text style={styles.closedNote}>
                    This ticket is closed. No further replies allowed.
                  </Text>
                )}
              </Card>
            </ScrollView>
          )}
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.white },
  title: { fontSize: 24, fontWeight: '800', color: colors.black },
  subtitle: { color: colors.muted, marginTop: 2, marginBottom: 16 },
  formHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 2,
    borderBottomColor: colors.black,
    backgroundColor: colors.white,
  },
  formTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: colors.black,
    fontFamily: FONT.bold,
    flex: 1,
    marginRight: 12,
  },
  ticketMetaRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  threadLabel: {
    fontFamily: FONT.bold,
    fontWeight: '700',
    fontSize: 11,
    color: colors.black,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
    marginBottom: 8,
  },
  thread: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 10,
    marginBottom: 14,
    gap: 10,
  },
  threadItem: {
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    paddingBottom: 8,
  },
  threadAuthor: {
    fontFamily: FONT.bold,
    fontWeight: '700',
    fontSize: 12,
    color: colors.black,
  },
  threadMessage: {
    fontFamily: FONT.medium,
    color: colors.muted,
    fontSize: 12,
    marginTop: 2,
  },
  threadTime: { fontSize: 10, color: '#9CA3AF', marginTop: 4 },
  noReplies: {
    fontFamily: FONT.medium,
    color: colors.muted,
    fontSize: 12,
    fontStyle: 'italic',
  },
  closedNote: { color: colors.red, fontWeight: '700', fontSize: 12 },
});
