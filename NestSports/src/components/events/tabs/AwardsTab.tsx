import React from 'react';
import { TouchableOpacity, Text, StyleSheet } from 'react-native';
import { Card, SectionTitle, Row } from '../../ui';
import { colors, FONT } from '../../../theme/colors';

function fmt(v?: string | number | boolean) {
  if (v === undefined || v === null || v === '') return '—';
  if (typeof v === 'boolean') return v ? 'Yes' : 'No';
  return String(v);
}

// Read-only summary — full editing happens via the Settings tab's shared
// EventFormScreen, avoiding a second copy of the awards form here.
export default function AwardsTab({ event, onGoToSettings }: { event: any; onGoToSettings: () => void }) {
  const awards = event.awards || {};
  return (
    <Card>
      <SectionTitle title="Awards" />
      <Row title="Winner Prize" subtitle={fmt(awards.winnerPrize)} noBorder />
      <Row title="Runner-up Prize" subtitle={fmt(awards.runnerUpPrize)} noBorder />
      <Row title="Cash Prize" subtitle={awards.cashPrize ? `₹${awards.cashPrize}` : '—'} noBorder />
      <Row title="Medals" subtitle={fmt(awards.medals)} noBorder />
      <Row title="Trophies" subtitle={fmt(awards.trophies)} noBorder />
      <Row title="Participation Certificate" subtitle={fmt(awards.participationCertificate)} noBorder />
      <Row title="Special Awards" subtitle={(awards.specialAwards || []).join(', ') || '—'} noBorder />
      {awards.description ? <Row title="Description" subtitle={awards.description} noBorder /> : null}
      <TouchableOpacity onPress={onGoToSettings} style={styles.link}>
        <Text style={styles.linkText}>Edit in Settings</Text>
      </TouchableOpacity>
    </Card>
  );
}

const styles = StyleSheet.create({
  link: { marginTop: 10 },
  linkText: { fontFamily: FONT.bold, fontWeight: '700', fontSize: 12, color: colors.blue },
});
