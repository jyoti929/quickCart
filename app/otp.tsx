import React, { useState, useRef, useEffect } from "react";
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
import { useRouter, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Theme } from "../constants/theme";
import { authStore } from "../services/authStore";

export default function Otp() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { name, email, password, mobile } = useLocalSearchParams<{ name?: string; email?: string; password?: string; mobile?: string }>();

  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [timer, setTimer] = useState(0);
  const [loading, setLoading] = useState(false);

  // Refs for each input box
  const inputRefs = useRef<Array<TextInput | null>>([]);
  const otpSentRef = useRef(false);

  // Auto-focus first field
  useEffect(() => {
    setTimeout(() => {
      inputRefs.current[0]?.focus();
    }, 100);
  }, []);

  // Timer countdown hook
  useEffect(() => {
    if (timer === 0) return;
    const interval = setInterval(() => {
      setTimer((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [timer]);

  const sendVerificationOtp = async (isResend = false) => {
    setError("");
    setSuccess("");
    if (!email) {
      setError("Email is missing. Please restart signup.");
      return;
    }

    setLoading(true);
    try {
      const API_URL = process.env.EXPO_PUBLIC_OTP_URL || (Platform.OS === "android" ? "http://10.0.2.2:3000" : "http://localhost:3000");
      const response = await fetch(`${API_URL}/send-otp`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email: email.trim() }),
      });

      const result = await response.json();
      if (result.success) {
        setSuccess(
          isResend
            ? "A new verification code has been sent to your email."
            : "Verification code sent to your email."
        );
        setTimer(30);
      } else {
        setError(result.message || (isResend ? "Failed to resend verification code." : "Failed to send verification code."));
      }
    } catch (err: any) {
      setError(
        isResend
          ? "Resend connection failed. Make sure the local server is running."
          : "Connection failed. Make sure the local server is running."
      );
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Send OTP automatically when email query param is resolved
  useEffect(() => {
    if (email && !otpSentRef.current) {
      otpSentRef.current = true;
      sendVerificationOtp(false);
    }
  }, [email]);

  const handleChangeText = (text: string, index: number) => {
    const cleanedText = text.replace(/[^0-9]/g, "");
    if (!cleanedText) {
      const newOtp = [...otp];
      newOtp[index] = "";
      setOtp(newOtp);
      return;
    }

    const newOtp = [...otp];
    const digit = cleanedText.charAt(cleanedText.length - 1);
    newOtp[index] = digit;
    setOtp(newOtp);

    // Auto focus next input
    if (index < 5 && digit !== "") {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyPress = (e: any, index: number) => {
    if (e.nativeEvent.key === "Backspace") {
      if (otp[index] === "" && index > 0) {
        const newOtp = [...otp];
        newOtp[index - 1] = "";
        setOtp(newOtp);
        inputRefs.current[index - 1]?.focus();
      } else {
        const newOtp = [...otp];
        newOtp[index] = "";
        setOtp(newOtp);
      }
    }
  };

  const handleVerify = async () => {
    setError("");
    setSuccess("");
    
    const enteredOtp = otp.join("");
    
    if (enteredOtp.length < 6) {
      setError("Please fill all 6 digits.");
      return;
    }

    if (!email) {
      setError("Email is missing. Please restart signup.");
      return;
    }

    setLoading(true);
    try {
      // Call local backend server to verify OTP
      const API_URL = process.env.EXPO_PUBLIC_OTP_URL || (Platform.OS === "android" ? "http://10.0.2.2:3000" : "http://localhost:3000");
      
      const response = await fetch(`${API_URL}/verify-otp`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email: email.trim(), otp: enteredOtp }),
      });
      
      const result = await response.json();
      if (result.success) {
        // Create the actual user in Firebase Auth and Firestore now
        const user = await authStore.signUp(name || "User", email, password || "", mobile);
        if (user) {
          setSuccess("Verification successful!");
          setOtp(["", "", "", "", "", ""]);
          
          setTimeout(() => {
            setLoading(false);
            router.replace("/permissions" as any);
          }, 1000);
        } else {
          setLoading(false);
          setError("Failed to create account. Try signing up again.");
        }
      } else {
        setLoading(false);
        setError(result.message || "Invalid or expired OTP.");
      }
    } catch (err: any) {
      setLoading(false);
      setError("Verification connection failed. Make sure the local server is running.");
      console.error(err);
    }
  };

  const handleResend = () => sendVerificationOtp(true);

  const formatMobileNumber = (num?: string) => {
    if (!num) return "";
    // If email was entered, just show it
    if (num.includes("@")) return num;
    if (num.length <= 4) return num;
    return `+91 ${num.slice(0, 5)} ${num.slice(5)}`;
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}
    >
      <StatusBar barStyle="dark-content" backgroundColor={Theme.colors.background} />
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        
        {/* Navigation Bar */}
        <View style={styles.navHeader}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.replace("/signup" as any)} activeOpacity={0.7} disabled={loading}>
            <Ionicons name="arrow-back" size={22} color={Theme.colors.primaryDark} />
          </TouchableOpacity>
        </View>

        {/* Brand Header */}
        <View style={styles.brandHeader}>
          <Ionicons name="shield-checkmark-outline" size={54} color={Theme.colors.primary} style={styles.shieldIcon} />
          <Text style={styles.title}>Verification Code</Text>
          <Text style={styles.subtitle}>
            Enter the code sent to {"\n"}
            <Text style={styles.boldText}>{email}</Text>
          </Text>
        </View>

        {/* Messages */}
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

        {/* OTP Input Fields */}
        <View style={styles.form}>
          <View style={styles.otpRow}>
            {otp.map((digit, idx) => (
              <TextInput
                key={idx}
                ref={(ref) => { inputRefs.current[idx] = ref; }}
                style={[
                  styles.otpInput,
                  digit !== "" && styles.otpInputFilled,
                  error !== "" && styles.otpInputError,
                ]}
                maxLength={1}
                keyboardType="number-pad"
                value={digit}
                onChangeText={(text) => handleChangeText(text, idx)}
                onKeyPress={(e) => handleKeyPress(e, idx)}
                selectTextOnFocus
                editable={!loading}
              />
            ))}
          </View>

          <Text style={styles.hintText}>Check your email inbox for the 6-digit code</Text>

          {/* Verify Button */}
          <TouchableOpacity 
            style={[styles.verifyButton, loading && styles.disabledButton]} 
            onPress={handleVerify} 
            activeOpacity={0.9}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <Text style={styles.verifyButtonText}>Verify OTP</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Timer countdown */}
        <View style={styles.resendContainer}>
          {timer > 0 ? (
            <Text style={styles.resendTimerText}>Resend code in <Text style={styles.boldTimer}>{timer}s</Text></Text>
          ) : (
            <View style={styles.resendActiveRow}>
              <Text style={styles.resendText}>{"Didn't receive the OTP? "}</Text>
              <TouchableOpacity onPress={handleResend} disabled={loading}>
                <Text style={styles.resendLinkText}>Resend Code</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

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
  },
  backButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: "center",
    alignItems: "center",
  },
  brandHeader: {
    alignItems: "center",
    marginTop: 10,
    marginBottom: 32,
  },
  shieldIcon: {
    marginBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: "800",
    color: Theme.colors.primaryDark,
    textAlign: "center",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    color: Theme.colors.textMedium,
    textAlign: "center",
    lineHeight: 22,
  },
  boldText: {
    fontWeight: "700",
    color: Theme.colors.primary,
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
    alignItems: "center",
  },
  otpRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: "100%",
    marginBottom: 16,
    paddingHorizontal: 4,
  },
  otpInput: {
    width: 44,
    height: 52,
    borderRadius: 12,
    backgroundColor: Theme.colors.inputBg,
    textAlign: "center",
    fontSize: 22,
    fontWeight: "700",
    color: Theme.colors.primaryDark,
    borderWidth: 1,
    borderColor: "transparent",
  },
  otpInputFilled: {
    borderColor: Theme.colors.primary,
    backgroundColor: "#FFFFFF",
  },
  otpInputError: {
    borderColor: Theme.colors.error,
  },
  hintText: {
    fontSize: 13,
    color: Theme.colors.textMedium,
    marginBottom: 24,
    fontStyle: "italic",
  },
  verifyButton: {
    backgroundColor: Theme.colors.primary,
    height: 52,
    width: "100%",
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: Theme.colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 3,
  },
  disabledButton: {
    opacity: 0.6,
  },
  verifyButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },
  resendContainer: {
    alignItems: "center",
    marginTop: 28,
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

