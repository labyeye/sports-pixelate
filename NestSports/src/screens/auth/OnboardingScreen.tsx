import React from 'react';
import { Text, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../contexts/AuthContext';
import { Button, Card } from '../../components/ui';
import { colors } from '../../theme/colors';

// On the web app, a company row is only created as a side effect of
// completing the billing/payment flow (see backend/controllers/billingController.js
// verifyPayment) — there's no standalone "create my academy" endpoint. Since
// the Razorpay checkout SDK isn't wired into this bare React Native app yet,
// mobile can't complete that step itself. Point the user at the web app
// instead of faking a form that has nothing real to submit to.
export default function OnboardingScreen() {
  const { logout, refreshUser } = useAuth();

  return (
    <SafeAreaView
      edges={['top']}
      style={{ flex: 1, backgroundColor: colors.background }}
    >
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.logo}>
          Nest<Text style={{ color: colors.orange }}>Sports</Text>
        </Text>
        <Card>
          <Text style={styles.heading}>Finish setting up your academy</Text>
          <Text style={styles.body}>
            Your account isn't linked to an academy yet. Academy setup (choosing
            a plan and completing payment) currently happens on the NestSports
            web dashboard — once that's done, come back here and your account
            will pick it up automatically.
          </Text>
          <Button
            title="I've finished on web — refresh"
            onPress={refreshUser}
          />
        </Card>
        <Button title="Sign out" variant="outline" onPress={logout} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
    gap: 16,
    backgroundColor: colors.background,
  },
  logo: {
    fontSize: 32,
    fontWeight: '800',
    color: colors.blue,
    textAlign: 'center',
    marginBottom: 8,
  },
  heading: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.black,
    marginBottom: 8,
  },
  body: { color: colors.muted, lineHeight: 20, marginBottom: 16 },
});
