import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { XCircle } from 'lucide-react-native';
import { Button } from '../components/ui';
import { colors } from '../theme/colors';

export default function PaymentFailedScreen({ navigation }: any) {
  return (
    <SafeAreaView edges={['top']} style={styles.container}>
      <View style={styles.card}>
        <XCircle
          size={64}
          color={colors.red}
          strokeWidth={1.5}
          style={styles.mark}
        />
        <Text style={styles.heading}>Payment Failed</Text>
        <Text style={styles.subtext}>
          Something went wrong while processing your payment. No amount has been
          deducted. Please try again.
        </Text>
        <Button
          title="Try Again"
          onPress={() => navigation.goBack()}
          color={colors.red}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    backgroundColor: colors.white,
    borderWidth: 2,
    borderColor: colors.black,
    padding: 24,
    alignItems: 'center',
  },
  mark: {
    marginBottom: 12,
  },
  heading: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.black,
    marginBottom: 10,
    textAlign: 'center',
  },
  subtext: {
    color: colors.muted,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
  },
});
