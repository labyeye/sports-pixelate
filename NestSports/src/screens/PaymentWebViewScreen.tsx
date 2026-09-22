import React, { useRef, useState } from 'react';
import { View, StyleSheet, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView, WebViewNavigation } from 'react-native-webview';
import { subscriptionAPI } from '../api/client';
import { LoadingView } from '../components/ui';

// Hosts a redirect/hosted-checkout gateway (Cashfree, PhonePe, Paytm) in a
// WebView. Paytm needs a POST with a form body, which a plain WebView
// `source={{uri}}` can't do — so we always load a tiny local HTML page that
// auto-submits a form (GET or POST) to the gateway, same trick as the web
// app's redirectToGatewayCheckout(). Once the gateway redirects back to our
// /payment-return URL, we stop loading it and verify from here instead
// (avoids needing the web app's own return page inside the WebView).
function buildAutoSubmitHtml(
  url: string,
  fields: Record<string, string> | undefined,
) {
  if (!fields) {
    return `<!DOCTYPE html><html><body onload="window.location.href='${url}'"></body></html>`;
  }
  const inputs = Object.entries(fields)
    .map(
      ([k, v]) =>
        `<input type="hidden" name="${k}" value="${String(v).replace(/"/g, '&quot;')}" />`,
    )
    .join('');
  return `<!DOCTYPE html><html><body onload="document.forms[0].submit()">
    <form method="POST" action="${url}">${inputs}</form>
  </body></html>`;
}

export default function PaymentWebViewScreen({ route, navigation }: any) {
  const { order } = route.params as {
    order: {
      orderId: string;
      checkoutUrl?: string;
      redirectUrl?: string;
      redirectFields?: Record<string, string>;
    };
  };
  const [verifying, setVerifying] = useState(false);
  const done = useRef(false);

  const checkoutTarget = order.checkoutUrl || order.redirectUrl;
  const html = buildAutoSubmitHtml(checkoutTarget!, order.redirectFields);

  const onNavigationStateChange = async (nav: WebViewNavigation) => {
    if (done.current) return;
    if (!nav.url.includes('/payment-return')) return;
    done.current = true;
    setVerifying(true);
    try {
      await subscriptionAPI.verifyPayment({ orderId: order.orderId });
      Alert.alert('Payment successful', 'Your subscription is now active.', [
        { text: 'OK', onPress: () => navigation.popToTop() },
      ]);
    } catch (e: any) {
      Alert.alert(
        'Payment could not be verified',
        e?.message || 'Please check your subscription status in a moment.',
        [{ text: 'OK', onPress: () => navigation.goBack() }],
      );
    } finally {
      setVerifying(false);
    }
  };

  return (
    <SafeAreaView edges={['top']} style={styles.screen}>
      <View style={{ flex: 1 }}>
        <WebView
          source={{ html }}
          onNavigationStateChange={onNavigationStateChange}
          startInLoadingState
        />
        {verifying && <LoadingView />}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#fff' },
});
