import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import RNPrint from 'react-native-print';
import { Download } from 'lucide-react-native';
import { Button } from '../components/ui';
import { colors } from '../theme/colors';
import { useAuth } from '../contexts/AuthContext';
import { billingAPI } from '../api/client';
import { buildInvoiceHTML } from '../utils/buildInvoiceHTML';

export default function WelcomeScreen({ navigation }: any) {
  const { user } = useAuth();
  const companyName = user?.company?.name || 'your academy';
  const [latestInvoice, setLatestInvoice] = useState<any>(null);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    billingAPI
      .getInvoices()
      .then((res: any) => {
        const invoices = res?.data || [];
        if (invoices.length) setLatestInvoice(invoices[0]);
      })
      .catch(() => {});
  }, []);

  const downloadInvoice = async () => {
    if (!latestInvoice) return;
    setDownloading(true);
    try {
      await RNPrint.print({ html: buildInvoiceHTML(latestInvoice) });
    } catch (e: any) {
      if (e?.message !== 'cancelled') {
        Alert.alert('Error', 'Could not generate invoice PDF.');
      }
    } finally {
      setDownloading(false);
    }
  };

  return (
    <SafeAreaView edges={['top']} style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.logo}>
          Nest<Text style={{ color: colors.orange }}>Sports</Text>
        </Text>
        <Text style={styles.heading}>Welcome aboard!</Text>
        <Text style={styles.subtext}>
          {companyName} is ready to go. Everything you need to manage your team
          — students, attendance, payroll, performance — is right here.
        </Text>
        {latestInvoice && (
          <TouchableOpacity
            style={styles.invoiceBtn}
            onPress={downloadInvoice}
            disabled={downloading}
          >
            {downloading ? (
              <ActivityIndicator size={14} color={colors.blue} />
            ) : (
              <Download size={14} color={colors.blue} />
            )}
            <Text style={styles.invoiceBtnText}>
              {downloading ? 'Opening…' : 'Download Invoice'}
            </Text>
          </TouchableOpacity>
        )}
        <Button title="Continue" onPress={() => navigation.navigate('Main')} />
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
  logo: {
    fontSize: 28,
    fontWeight: '800',
    color: colors.blue,
    marginBottom: 16,
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
  invoiceBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 2,
    borderColor: colors.black,
    paddingVertical: 10,
    paddingHorizontal: 16,
    marginBottom: 12,
    alignSelf: 'stretch',
  },
  invoiceBtnText: {
    color: colors.blue,
    fontWeight: '700',
    fontSize: 13,
  },
});
