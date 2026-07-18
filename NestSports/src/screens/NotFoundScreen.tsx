import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '../components/ui';
import { colors } from '../theme/colors';

export default function NotFoundScreen({ navigation }: any) {
  return (
    <SafeAreaView edges={['top']} style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.code}>404</Text>
        <Text style={styles.heading}>Screen not found</Text>
        <Text style={styles.subtext}>
          The screen you're looking for doesn't exist or has moved.
        </Text>
        <Button
          title="Back to Home"
          onPress={() => navigation.navigate('Main')}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.white,
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
  code: {
    fontSize: 48,
    fontWeight: '800',
    color: colors.blue,
    marginBottom: 12,
  },
  heading: {
    fontSize: 20,
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
