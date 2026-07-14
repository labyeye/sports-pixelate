import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "../../contexts/AuthContext";
import { Button } from "../../components/ui";
import { colors } from "../../theme/colors";

export default function RegisterScreen({ navigation }: any) {
  const { register } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const onSubmit = async () => {
    setError("");
    if (!name.trim() || !email.trim() || !password) {
      setError("Please fill in all fields");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    setLoading(true);
    const res = await register({ name: name.trim(), email: email.trim(), password });
    setLoading(false);
    if (!res.success) {
      setError(res.error || "Registration failed");
    }
    // On success, AuthContext flips isAuthenticated and RootNavigator swaps
    // to the main app / onboarding automatically.
  };

  return (
    <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: colors.background }}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView contentContainerStyle={styles.container}>
          <Text style={styles.logo}>
            Nest<Text style={{ color: colors.orange }}>Sports</Text>
          </Text>
          <Text style={styles.subtitle}>Create your academy account</Text>

          <View style={styles.field}>
            <Text style={styles.label}>Full Name</Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="Jane Doe"
            />
          </View>
          <View style={styles.field}>
            <Text style={styles.label}>Email</Text>
            <TextInput
              style={styles.input}
              autoCapitalize="none"
              keyboardType="email-address"
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
            />
          </View>
          <View style={styles.field}>
            <Text style={styles.label}>Password</Text>
            <TextInput
              style={styles.input}
              secureTextEntry
              value={password}
              onChangeText={setPassword}
              placeholder="••••••••"
            />
          </View>
          <View style={styles.field}>
            <Text style={styles.label}>Confirm Password</Text>
            <TextInput
              style={styles.input}
              secureTextEntry
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              placeholder="••••••••"
            />
          </View>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Button title="Create Account" onPress={onSubmit} loading={loading} />

          <Text style={styles.link} onPress={() => navigation.navigate("Login")}>
            Already have an account? Sign in
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    justifyContent: "center",
    padding: 24,
    backgroundColor: colors.background,
  },
  logo: {
    fontSize: 32,
    fontWeight: "800",
    color: colors.blue,
    textAlign: "center",
    marginBottom: 4,
  },
  subtitle: {
    textAlign: "center",
    color: colors.muted,
    marginBottom: 24,
  },
  field: { marginBottom: 14 },
  label: { fontWeight: "700", marginBottom: 6, color: colors.black },
  input: {
    borderWidth: 2,
    borderColor: colors.black,
    backgroundColor: colors.white,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
  },
  error: { color: colors.red, marginBottom: 12, fontWeight: "600" },
  link: {
    textAlign: "center",
    marginTop: 16,
    color: colors.blue,
    fontWeight: "700",
  },
});
