import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button } from "../components/ui";
import { colors } from "../theme/colors";
import { useAuth } from "../contexts/AuthContext";

export default function WelcomeScreen({ navigation }: any) {
  const { user } = useAuth();
  const companyName = user?.company?.name || "your academy";

  return (
    <SafeAreaView edges={["top"]} style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.logo}>
          Nest<Text style={{ color: colors.orange }}>Sports</Text>
        </Text>
        <Text style={styles.heading}>Welcome aboard!</Text>
        <Text style={styles.subtext}>
          {companyName} is ready to go. Everything you need to manage your
          team — students, attendance, payroll, performance — is right here.
        </Text>
        <Button title="Continue" onPress={() => navigation.navigate("Main")} />
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
  logo: {
    fontSize: 28,
    fontWeight: "800",
    color: colors.blue,
    marginBottom: 16,
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
