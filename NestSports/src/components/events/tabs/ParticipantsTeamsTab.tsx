import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { Plus, Trash2, UserPlus, UserMinus } from 'lucide-react-native';
import { Card, SectionTitle, useToast } from '../../ui';
import { colors, FONT } from '../../../theme/colors';
import { eventAPI, studentAPI } from '../../../api/client';
import { useAuth } from '../../../contexts/AuthContext';

// Parent-facing: register/unregister their own children. Only requires the
// child's `sport` match the event's activity when the event is a sports
// event — dance/workshop/other events don't gate on that field.
function RegistrationPanel({ event, onChanged }: { event: any; onChanged: () => void }) {
  const { toast } = useToast() as any;
  const [children, setChildren] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    studentAPI
      .getAll()
      .then((res: any) => setChildren(res.data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const registeredIds = useMemo(
    () => new Set((event.registrations || []).map((r: any) => r.student?._id)),
    [event.registrations],
  );

  const isSports = event.activityCategory === 'sports';
  const eligible = isSports ? children.filter(c => c.sport === event.activity) : children;

  const toggle = async (studentId: string, isRegistered: boolean) => {
    setBusyId(studentId);
    try {
      if (isRegistered) await eventAPI.unregister(event._id, studentId);
      else await eventAPI.register(event._id, studentId);
      onChanged();
    } catch (e: any) {
      toast.error(e?.message || 'Could not update registration');
    } finally {
      setBusyId(null);
    }
  };

  if (loading) return null;

  return (
    <Card>
      <SectionTitle title="Register" />
      {eligible.length === 0 ? (
        <Text style={styles.emptyHint}>
          {isSports
            ? `None of your children are enrolled in ${event.activity} to register for this event.`
            : 'No children available to register.'}
        </Text>
      ) : (
        eligible.map(c => {
          const isRegistered = registeredIds.has(c._id);
          const busy = busyId === c._id;
          return (
            <View key={c._id} style={styles.regRow}>
              <Text style={styles.regName}>
                {c.firstName} {c.lastName}
              </Text>
              <TouchableOpacity
                onPress={() => toggle(c._id, isRegistered)}
                disabled={busy || (!isRegistered && !event.registrationOpen)}
                style={[styles.regBtn, isRegistered ? styles.regBtnRemove : styles.regBtnAdd]}
              >
                {busy ? (
                  <ActivityIndicator color={isRegistered ? colors.red : colors.white} size="small" />
                ) : isRegistered ? (
                  <>
                    <UserMinus size={13} color={colors.red} strokeWidth={2.5} />
                    <Text style={styles.regBtnRemoveText}>Unregister</Text>
                  </>
                ) : (
                  <>
                    <UserPlus size={13} color={colors.white} strokeWidth={2.5} />
                    <Text style={styles.regBtnAddText}>Register</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          );
        })
      )}
      {!event.registrationOpen && <Text style={styles.emptyHint}>Registration is closed for this event.</Text>}
    </Card>
  );
}

// Staff-facing: manage the Teams roster (only meaningful when
// participation.type === 'team' — Individual/Group participation just shows
// the registration count, teams stay empty for those).
function TeamsPanel({ event, onChanged }: { event: any; onChanged: () => void }) {
  const { toast } = useToast() as any;
  const [newTeam, setNewTeam] = useState('');
  const [adding, setAdding] = useState(false);

  const addTeam = async () => {
    if (!newTeam.trim()) return;
    setAdding(true);
    try {
      await eventAPI.addTeam(event._id, newTeam.trim());
      setNewTeam('');
      onChanged();
    } catch (e: any) {
      toast.error(e?.message || 'Could not add team');
    } finally {
      setAdding(false);
    }
  };

  const removeTeam = async (teamId: string) => {
    try {
      await eventAPI.removeTeam(event._id, teamId);
      onChanged();
    } catch (e: any) {
      toast.error(e?.message || 'Could not remove team');
    }
  };

  return (
    <Card>
      <SectionTitle title={`Teams (${event.teams.length})`} />
      <View style={styles.teamChips}>
        {event.teams.map((t: any) => (
          <View key={t._id} style={styles.teamChip}>
            <Text style={styles.teamChipText}>{t.name}</Text>
            {!event.fixturesGenerated && (
              <TouchableOpacity onPress={() => removeTeam(t._id)} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
                <Trash2 size={12} color={colors.red} strokeWidth={2.5} />
              </TouchableOpacity>
            )}
          </View>
        ))}
        {event.teams.length === 0 && <Text style={styles.emptyHint}>No teams added yet</Text>}
      </View>
      {!event.fixturesGenerated && (
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <TextInput
            style={styles.teamInput}
            value={newTeam}
            onChangeText={setNewTeam}
            placeholder="Team name"
            onSubmitEditing={addTeam}
          />
          <TouchableOpacity onPress={addTeam} disabled={adding || !newTeam.trim()} style={styles.addTeamBtn}>
            {adding ? <ActivityIndicator color={colors.blue} size="small" /> : <Plus size={16} color={colors.blue} strokeWidth={2.5} />}
          </TouchableOpacity>
        </View>
      )}
    </Card>
  );
}

// Simple read-only registrant list (Individual/Group participation types).
function RegistrantsList({ event }: { event: any }) {
  return (
    <Card>
      <SectionTitle title={`Participants (${event.registrations.length})`} />
      {event.registrations.length === 0 ? (
        <Text style={styles.emptyHint}>No one has registered yet.</Text>
      ) : (
        event.registrations.map((r: any) => (
          <View key={r._id} style={styles.regRow}>
            <Text style={styles.regName}>
              {typeof r.student === 'object' ? `${r.student.firstName} ${r.student.lastName}` : 'Participant'}
            </Text>
            <Text style={styles.emptyHint}>{r.status}</Text>
          </View>
        ))
      )}
    </Card>
  );
}

export default function ParticipantsTeamsTab({ event, onChanged }: { event: any; onChanged: () => void }) {
  const { user } = useAuth();
  const isParent = user?.role === 'parent';
  const isTeam = (event.participation?.type || 'team') === 'team';

  if (isParent) return <RegistrationPanel event={event} onChanged={onChanged} />;
  if (isTeam) return <TeamsPanel event={event} onChanged={onChanged} />;
  return <RegistrantsList event={event} />;
}

const styles = StyleSheet.create({
  emptyHint: { fontFamily: FONT.medium, fontSize: 12, color: colors.muted },
  regRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 2,
    borderColor: '#0000001A',
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 8,
  },
  regName: { fontFamily: FONT.bold, fontWeight: '700', fontSize: 13, color: colors.black },
  regBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 2, paddingHorizontal: 10, paddingVertical: 7 },
  regBtnAdd: { backgroundColor: colors.blue, borderColor: colors.black },
  regBtnRemove: { backgroundColor: colors.white, borderColor: colors.red },
  regBtnAddText: { color: colors.white, fontFamily: FONT.bold, fontWeight: '700', fontSize: 12 },
  regBtnRemoveText: { color: colors.red, fontFamily: FONT.bold, fontWeight: '700', fontSize: 12 },
  teamChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10 },
  teamChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 2,
    borderColor: colors.black,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  teamChipText: { fontFamily: FONT.bold, fontWeight: '700', fontSize: 12, color: colors.black },
  teamInput: {
    flex: 1,
    borderWidth: 2,
    borderColor: colors.black,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 14,
    fontFamily: FONT.medium,
  },
  addTeamBtn: { width: 40, borderWidth: 2, borderColor: colors.black, alignItems: 'center', justifyContent: 'center' },
});
