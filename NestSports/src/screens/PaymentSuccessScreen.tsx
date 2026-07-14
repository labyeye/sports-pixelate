import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { CheckCircle2 } from "lucide-react-native";
import { Button } from "../components/ui";
import { colors } from "../theme/colors";

export default function PaymentSuccessScreen({ navigation }: any) {
  return (
    <SafeAreaView edges={["top"]} style={styles.container}>
      <View style={styles.card}>
        <CheckCircle2 size={64} color={colors.green} strokeWidth={1.5} style={styles.mark} />
        <Text style={styles.heading}>Payment Successful</Text>
        <Text style={styles.subtext}>
          Your payment has been processed successfully. Your subscription is
          now active.
        </Text>
        <Button title="Back to Home" onPress={() => navigation.navigate("Main")} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: "center",
    padding: 24,
  },
  card: {
    backgroundColor: colors.white,
    borderWidth: 2,
    borderColor: colors.black,
    padding: 24,
    alignItems: "center",
  },
  mark: {
    marginBottom: 12,
  },
  heading: {
    fontSize: 22,
    fontWeight: "800",
    color: colors.black,
    marginBottom: 10,
    textAlign: "center",
  },
  subtext: {
    color: colors.muted,
    textAlign: "center",
    marginBottom: 24,
    lineHeight: 20,
  },
});
