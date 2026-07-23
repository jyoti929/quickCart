import React, { useEffect, useState } from "react";
import { Image } from "expo-image";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StatusBar,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Theme } from "../constants/theme";
import { authStore } from "../services/authStore";

const API_URL =
  process.env.EXPO_PUBLIC_OTP_URL ||
  (Platform.OS === "android" ? "http://10.0.2.2:3000" : "http://localhost:3000");

export default function ForgotPassword() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [otpCooldown, setOtpCooldown] = useState(0);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const [activeField, setActiveField] = useState<string | null>(null);

  useEffect(() => {
    if (otpCooldown === 0) return;
    const interval = setInterval(() => {
      setOtpCooldown((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [otpCooldown]);

  const validateEmail = (text: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text);

  const handleEmailChange = (text: string) => {
    setEmail(text);
    if (error) setError("");
    if (success) setSuccess("");
  };

  const handleOtpChange = (text: string) => {
    setOtp(text);
    if (error) setError("");
  };

  const handleSendOtp = async () => {
    const targetEmail = email.trim().toLowerCase();
    setError("");
    setSuccess("");

    if (!targetEmail) {
      setError("Please enter your registered email address.");
      return;
    }

    if (!validateEmail(targetEmail)) {
      setError("Please enter a valid email address.");
      return;
    }

    setLoading(true);
    try {
      const exists = await authStore.hasUser(targetEmail);
      if (!exists) {
        setError("This email address is not registered.");
        return;
      }

      const response = await fetch(`${API_URL}/send-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: targetEmail }),
      });

      const result = await response.json();
      if (!response.ok || !result.success) {
        setError(result.message || "Failed to send verification code.");
        return;
      }

      setOtp("");
      setOtpSent(true);
      setOtpCooldown(30);
      setSuccess("Verification code sent to your email.");
    } catch (err) {
      setError("Failed to connect to the OTP server. Please try again.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async () => {
    const targetEmail = email.trim().toLowerCase();
    setError("");
    setSuccess("");

    if (!otp.trim()) {
      setError("Verification code is required.");
      return;
    }

    setLoading(true);
    try {
      const verifyResponse = await fetch(`${API_URL}/verify-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: targetEmail, otp: otp.trim() }),
      });

      const verifyResult = await verifyResponse.json();
      if (!verifyResponse.ok || !verifyResult.success) {
        setError(verifyResult.message || "Invalid or expired OTP.");
        return;
      }

      await authStore.sendPasswordReset(targetEmail);
      setSuccess("OTP verified. Password reset link sent to your email.");
      setOtp("");
      setOtpSent(false);

      setTimeout(() => {
        router.replace("/login" as any);
      }, 1800);
    } catch (err: any) {
      setError(err?.message || "An error occurred during verification. Try again.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const isSendDisabled = loading || !email.trim() || !validateEmail(email.trim());
  const isResetDisabled = loading || !otp.trim();

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}
    >
      <StatusBar barStyle="dark-content" backgroundColor={Theme.colors.background} />
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <View style={styles.navHeader}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => {
              if (otpSent) {
                setOtpSent(false);
                setError("");
                setSuccess("");
              } else {
                router.replace("/login" as any);
              }
            }}
            activeOpacity={0.7}
            disabled={loading}
          >
            <Ionicons name="chevron-back" size={24} color={Theme.colors.primaryDark} />
          </TouchableOpacity>
        </View>

        <View style={styles.brandHeader}>
          <Text style={styles.title}>{otpSent ? "Verify OTP" : "Forgot Password"}</Text>
          <Text style={styles.subtitle}>
            {otpSent
              ? "Enter the code sent to your email. We will send a secure reset link after verification."
              : "Enter your email address and we will send you a verification code."}
          </Text>
        </View>

        {error ? (
          <View style={styles.messageContainer}>
            <Ionicons name="alert-circle" size={18} color={Theme.colors.error} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        {success ? (
          <View style={[styles.messageContainer, styles.successContainer]}>
            <Ionicons name="checkmark-circle" size={18} color={Theme.colors.success} />
            <Text style={styles.successText}>{success}</Text>
          </View>
        ) : null}

        <View style={styles.form}>
          <View style={{ marginBottom: 14 }}>
            <Text style={styles.inputLabel}>Email</Text>
            <View style={[styles.inputContainer, activeField === "email" && styles.inputActive]}>
              <TextInput
                style={styles.input}
                placeholder="Enter your email"
                placeholderTextColor={Theme.colors.textLight}
                value={email}
                onChangeText={handleEmailChange}
                autoCapitalize="none"
                keyboardType="email-address"
                onFocus={() => setActiveField("email")}
                onBlur={() => setActiveField(null)}
                editable={!loading && !otpSent}
              />
            </View>
          </View>

          {otpSent ? (
            <View style={{ marginBottom: 20 }}>
              <Text style={styles.inputLabel}>Verification Code (OTP)</Text>
              <View style={[styles.inputContainer, activeField === "otp" && styles.inputActive]}>
                <TextInput
                  style={styles.input}
                  placeholder="Enter 6-digit code"
                  placeholderTextColor={Theme.colors.textLight}
                  value={otp}
                  onChangeText={handleOtpChange}
                  keyboardType="number-pad"
                  maxLength={6}
                  onFocus={() => setActiveField("otp")}
                  onBlur={() => setActiveField(null)}
                  editable={!loading}
                />
              </View>
            </View>
          ) : null}

          {!otpSent ? (
            <TouchableOpacity
              style={[styles.actionButton, isSendDisabled && styles.disabledButton]}
              onPress={handleSendOtp}
              activeOpacity={0.9}
              disabled={isSendDisabled}
            >
              {loading ? <ActivityIndicator color="#FFFFFF" size="small" /> : <Text style={styles.actionButtonText}>Send OTP</Text>}
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.actionButton, isResetDisabled && styles.disabledButton]}
              onPress={handleResetPassword}
              activeOpacity={0.9}
              disabled={isResetDisabled}
            >
              {loading ? <ActivityIndicator color="#FFFFFF" size="small" /> : <Text style={styles.actionButtonText}>Verify & Send Reset Link</Text>}
            </TouchableOpacity>
          )}
        </View>

        {otpSent ? (
          <View style={styles.resendContainer}>
            {otpCooldown > 0 ? (
              <Text style={styles.resendTimerText}>Resend code in <Text style={styles.boldTimer}>{otpCooldown}s</Text></Text>
            ) : (
              <View style={styles.resendActiveRow}>
                <Text style={styles.resendText}>{"Didn't receive the code? "}</Text>
                <TouchableOpacity onPress={handleSendOtp} disabled={loading}>
                  <Text style={styles.resendLinkText}>Resend Code</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        ) : null}

        {!otpSent ? (
          <View style={styles.illustrationContainer}>
            <Image
              source={require("../assets/images/forgot_password_illustration.png")}
              style={styles.illustrationImage}
              contentFit="contain"
            />
          </View>
        ) : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Theme.colors.background,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingBottom: 40,
  },
  navHeader: {
    height: 50,
    justifyContent: "center",
    marginTop: 8,
    marginLeft: -8,
  },
  backButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: "center",
    alignItems: "center",
  },
  brandHeader: {
    alignItems: "flex-start",
    marginTop: 10,
    marginBottom: 28,
  },
  title: {
    fontSize: 26,
    fontWeight: "800",
    color: Theme.colors.primaryDark,
    textAlign: "left",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: Theme.colors.textMedium,
    textAlign: "left",
    lineHeight: 20,
  },
  messageContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FEE2E2",
    borderRadius: 12,
    padding: 12,
    marginBottom: 20,
    gap: 8,
    width: "100%",
  },
  successContainer: {
    backgroundColor: "#ECFDF5",
  },
  errorText: {
    color: Theme.colors.error,
    fontSize: 13,
    fontWeight: "500",
    flex: 1,
  },
  successText: {
    color: Theme.colors.success,
    fontSize: 13,
    fontWeight: "500",
    flex: 1,
  },
  form: {
    width: "100%",
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: "700",
    color: Theme.colors.primaryDark,
    marginBottom: 8,
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 12,
    height: 52,
    paddingHorizontal: 16,
    backgroundColor: Theme.colors.inputBg,
    borderWidth: 1,
    borderColor: "transparent",
  },
  inputActive: {
    borderColor: Theme.colors.primary,
    backgroundColor: "#FFFFFF",
  },
  input: {
    flex: 1,
    height: "100%",
    color: Theme.colors.textDark,
    fontSize: 15,
  },
  actionButton: {
    backgroundColor: Theme.colors.primary,
    height: 52,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 8,
    shadowColor: Theme.colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 3,
  },
  disabledButton: {
    opacity: 0.6,
  },
  actionButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },
  illustrationContainer: {
    alignItems: "center",
    justifyContent: "center",
    marginTop: 40,
    alignSelf: "center",
    width: "100%",
  },
  illustrationImage: {
    width: 220,
    height: 220,
  },
  resendContainer: {
    alignItems: "center",
    marginTop: 20,
  },
  resendTimerText: {
    color: Theme.colors.textMedium,
    fontSize: 13,
    fontWeight: "500",
  },
  boldTimer: {
    color: Theme.colors.primary,
    fontWeight: "700",
  },
  resendActiveRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  resendText: {
    color: Theme.colors.textMedium,
    fontSize: 13,
  },
  resendLinkText: {
    color: Theme.colors.primary,
    fontSize: 13,
    fontWeight: "700",
  },
});
