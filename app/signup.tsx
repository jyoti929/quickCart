import React, { useState, useEffect } from "react";
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

export default function Signup() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  // Form states
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [mobile, setMobile] = useState("");
  const [agreeToTerms, setAgreeToTerms] = useState(false);

  // Visibilities
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Errors, loading, and focus states
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [activeField, setActiveField] = useState<string | null>(null);

  const validateEmail = (text: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(text);
  };

  const validateMobile = (text: string) => {
    if (!text.trim()) return true;
    const mobileRegex = /^\d{10}$/;
    return mobileRegex.test(text.trim());
  };

  const handleNameChange = (val: string) => {
    setName(val);
    if (error) setError("");
  };

  const handleEmailChange = (val: string) => {
    setEmail(val);
    if (error) setError("");
  };

  const handlePasswordChange = (val: string) => {
    setPassword(val);
    if (error) setError("");
  };

  const handleConfirmPasswordChange = (val: string) => {
    setConfirmPassword(val);
    if (error) setError("");
  };

  const handleMobileChange = (val: string) => {
    setMobile(val);
    if (error) setError("");
  };

  // Real-time password criteria
  const isMinLength = password.length >= 6;
  const hasUppercase = /[A-Z]/.test(password);
  const hasLowercase = /[a-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSpecialChar = /[@#\$%&!]/.test(password);
  const isPasswordValid = isMinLength && hasUppercase && hasLowercase && hasNumber && hasSpecialChar;
  const isMobileValid = validateMobile(mobile);
  const isSignupDisabled = loading || !name.trim() || !email.trim() || !agreeToTerms || !isPasswordValid || password !== confirmPassword || (mobile.trim() !== "" && !isMobileValid);

  const handleSignup = async () => {
    setError("");

    // Form Validations
    if (!name.trim()) {
      setError("Full name is required.");
      return;
    }

    if (!email.trim()) {
      setError("Email address is required.");
      return;
    }

    if (!validateEmail(email.trim())) {
      setError("Please enter a valid email address.");
      return;
    }

    if (!password) {
      setError("Password is required.");
      return;
    }

    if (!isPasswordValid) {
      setError("Password does not meet all safety requirements.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    if (mobile.trim() !== "" && !isMobileValid) {
      setError("Please enter a valid 10-digit mobile number.");
      return;
    }

    if (!agreeToTerms) {
      setError("You must agree to the Terms & Conditions.");
      return;
    }

    setLoading(true);
    try {
      // Check if user already exists in Firestore users collection
      const exists = await authStore.hasUser(email.trim());
      if (exists) {
        setError("This email address is already registered.");
        setLoading(false);
        return;
      }

      setLoading(false);
      // Navigate to OTP verification page, passing the registration details
      router.push({
        pathname: "/otp" as any,
        params: { name: name.trim(), email: email.trim().toLowerCase(), password, mobile: mobile.trim() },
      });
    } catch (err: any) {
      setLoading(false);
      setError(err.message || "An unexpected error occurred. Please try again.");
      console.error(err);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}
    >
      <StatusBar barStyle="dark-content" backgroundColor={Theme.colors.background} />
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        
        {/* Navigation Bar */}
        <View style={styles.navHeader}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.replace("/onboarding" as any)} activeOpacity={0.7}>
            <Ionicons name="arrow-back" size={22} color={Theme.colors.primaryDark} />
          </TouchableOpacity>
        </View>

        {/* Header Title */}
        <View style={styles.brandHeader}>
          <Text style={styles.title}>Create Account</Text>
          <Text style={styles.subtitle}>Sign up to get started</Text>
        </View>

        {/* Error message */}
        {error ? (
          <View style={styles.errorContainer}>
            <Ionicons name="alert-circle" size={18} color={Theme.colors.error} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        {/* Form Fields */}
        <View style={styles.form}>
          
          {/* Name Field */}
          <View
            style={[
              styles.inputContainer,
              activeField === "name" && styles.inputActive,
            ]}
          >
            <Ionicons name="person-outline" size={18} color={Theme.colors.textMedium} style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Full Name"
              placeholderTextColor={Theme.colors.textLight}
              value={name}
              onChangeText={handleNameChange}
              onFocus={() => setActiveField("name")}
              onBlur={() => setActiveField(null)}
              editable={!loading}
            />
          </View>

          {/* Email ID Field */}
          <View
            style={[
              styles.inputContainer,
              activeField === "email" && styles.inputActive,
            ]}
          >
            <Ionicons name="mail-outline" size={18} color={Theme.colors.textMedium} style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Email ID"
              placeholderTextColor={Theme.colors.textLight}
              value={email}
              onChangeText={handleEmailChange}
              autoCapitalize="none"
              keyboardType="email-address"
              onFocus={() => setActiveField("email")}
              onBlur={() => setActiveField(null)}
              editable={!loading}
            />
          </View>

          {/* Password Field */}
          <View
            style={[
              styles.inputContainer,
              activeField === "password" && styles.inputActive,
            ]}
          >
            <Ionicons name="lock-closed-outline" size={18} color={Theme.colors.textMedium} style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Password"
              placeholderTextColor={Theme.colors.textLight}
              value={password}
              onChangeText={handlePasswordChange}
              secureTextEntry={!showPassword}
              onFocus={() => setActiveField("password")}
              onBlur={() => setActiveField(null)}
              editable={!loading}
            />
            <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeIcon} disabled={loading}>
              <Ionicons name={showPassword ? "eye-off-outline" : "eye-outline"} size={18} color={Theme.colors.textMedium} />
            </TouchableOpacity>
          </View>

          {/* Password Criteria List */}
          {password.length > 0 && (
            <View style={styles.criteriaContainer}>
              <View style={styles.criteriaItem}>
                <Ionicons 
                  name={isMinLength ? "checkmark-circle" : "close-circle"} 
                  size={15} 
                  color={isMinLength ? "#22c55e" : "#ef4444"} 
                />
                <Text style={[styles.criteriaText, isMinLength ? styles.criteriaValid : styles.criteriaInvalid]}>
                  At least 6 characters
                </Text>
              </View>
              <View style={styles.criteriaItem}>
                <Ionicons 
                  name={hasUppercase ? "checkmark-circle" : "close-circle"} 
                  size={15} 
                  color={hasUppercase ? "#22c55e" : "#ef4444"} 
                />
                <Text style={[styles.criteriaText, hasUppercase ? styles.criteriaValid : styles.criteriaInvalid]}>
                  One uppercase letter (A-Z)
                </Text>
              </View>
              <View style={styles.criteriaItem}>
                <Ionicons 
                  name={hasLowercase ? "checkmark-circle" : "close-circle"} 
                  size={15} 
                  color={hasLowercase ? "#22c55e" : "#ef4444"} 
                />
                <Text style={[styles.criteriaText, hasLowercase ? styles.criteriaValid : styles.criteriaInvalid]}>
                  One lowercase letter (a-z)
                </Text>
              </View>
              <View style={styles.criteriaItem}>
                <Ionicons 
                  name={hasNumber ? "checkmark-circle" : "close-circle"} 
                  size={15} 
                  color={hasNumber ? "#22c55e" : "#ef4444"} 
                />
                <Text style={[styles.criteriaText, hasNumber ? styles.criteriaValid : styles.criteriaInvalid]}>
                  One number (0-9)
                </Text>
              </View>
              <View style={styles.criteriaItem}>
                <Ionicons 
                  name={hasSpecialChar ? "checkmark-circle" : "close-circle"} 
                  size={15} 
                  color={hasSpecialChar ? "#22c55e" : "#ef4444"} 
                />
                <Text style={[styles.criteriaText, hasSpecialChar ? styles.criteriaValid : styles.criteriaInvalid]}>
                  One special character (@, #, $, %, &, or !)
                </Text>
              </View>
            </View>
          )}

          {/* Confirm Password Field */}
          <View
            style={[
              styles.inputContainer,
              activeField === "confirmPassword" && styles.inputActive,
            ]}
          >
            <Ionicons name="lock-closed-outline" size={18} color={Theme.colors.textMedium} style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Confirm Password"
              placeholderTextColor={Theme.colors.textLight}
              value={confirmPassword}
              onChangeText={handleConfirmPasswordChange}
              secureTextEntry={!showConfirmPassword}
              onFocus={() => setActiveField("confirmPassword")}
              onBlur={() => setActiveField(null)}
              editable={!loading}
            />
            <TouchableOpacity onPress={() => setShowConfirmPassword(!showConfirmPassword)} style={styles.eyeIcon} disabled={loading}>
              <Ionicons name={showConfirmPassword ? "eye-off-outline" : "eye-outline"} size={18} color={Theme.colors.textMedium} />
            </TouchableOpacity>
          </View>

          {/* Mobile Number Field (Optional) */}
          <View
            style={[
              styles.inputContainer,
              activeField === "mobile" && styles.inputActive,
            ]}
          >
            <Ionicons name="call-outline" size={18} color={Theme.colors.textMedium} style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Mobile Number (Optional)"
              placeholderTextColor={Theme.colors.textLight}
              value={mobile}
              onChangeText={handleMobileChange}
              keyboardType="phone-pad"
              onFocus={() => setActiveField("mobile")}
              onBlur={() => setActiveField(null)}
              editable={!loading}
            />
          </View>

          {/* Terms Checkbox */}
          <TouchableOpacity 
            style={styles.checkboxContainer} 
            onPress={() => setAgreeToTerms(!agreeToTerms)} 
            activeOpacity={0.8}
            disabled={loading}
          >
            <Ionicons 
              name={agreeToTerms ? "checkbox" : "square-outline"} 
              size={20} 
              color={agreeToTerms ? Theme.colors.primary : Theme.colors.textMedium} 
            />
            <Text style={styles.checkboxText}>
              I agree to the <Text style={styles.termsLink}>Terms & Conditions</Text>
            </Text>
          </TouchableOpacity>

          {/* Sign Up Button */}
          <TouchableOpacity 
            style={[styles.signupButton, isSignupDisabled && styles.disabledButton]} 
            onPress={handleSignup} 
            activeOpacity={0.9}
            disabled={isSignupDisabled}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <Text style={styles.signupButtonText}>Sign Up</Text>
            )}
          </TouchableOpacity>

          {/* Divider */}
          <View style={styles.dividerContainer}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>or continue with</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* Social Icons */}
          <View style={styles.socialContainer}>
            <TouchableOpacity style={styles.socialIconBtn} activeOpacity={0.7} disabled={loading}>
              <Ionicons name="logo-google" size={22} color={Theme.colors.primaryDark} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.socialIconBtn} activeOpacity={0.7} disabled={loading}>
              <Ionicons name="logo-facebook" size={22} color={Theme.colors.primaryDark} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.socialIconBtn} activeOpacity={0.7} disabled={loading}>
              <Ionicons name="logo-apple" size={22} color={Theme.colors.primaryDark} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Sign In Link */}
        <View style={styles.footerLinkContainer}>
          <Text style={styles.footerText}>Already have an account? </Text>
          <TouchableOpacity onPress={() => router.replace("/login" as any)} disabled={loading}>
            <Text style={styles.loginLinkText}>Login</Text>
          </TouchableOpacity>
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
    alignItems: "flex-start",
    marginTop: 10,
    marginBottom: 32,
  },
  title: {
    fontSize: 28,
    fontWeight: "800",
    color: Theme.colors.primaryDark,
    textAlign: "left",
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 15,
    fontWeight: "500",
    color: Theme.colors.textMedium,
    textAlign: "left",
  },
  errorContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FEE2E2",
    borderRadius: 12,
    padding: 12,
    marginBottom: 20,
    gap: 8,
  },
  errorText: {
    color: Theme.colors.error,
    fontSize: 13,
    fontWeight: "500",
    flex: 1,
  },
  form: {
    width: "100%",
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 12,
    height: 52,
    paddingHorizontal: 16,
    backgroundColor: Theme.colors.inputBg,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "transparent",
  },
  inputActive: {
    borderColor: Theme.colors.primary,
    backgroundColor: "#FFFFFF",
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    height: "100%",
    color: Theme.colors.textDark,
    fontSize: 15,
  },
  eyeIcon: {
    padding: 4,
  },
  checkboxContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 24,
    marginTop: 4,
    gap: 10,
  },
  checkboxText: {
    fontSize: 14,
    color: Theme.colors.textMedium,
  },
  termsLink: {
    color: Theme.colors.primary,
    fontWeight: "600",
  },
  signupButton: {
    backgroundColor: Theme.colors.primary,
    height: 52,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 4,
    shadowColor: Theme.colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 3,
  },
  criteriaContainer: {
    paddingHorizontal: 12,
    marginBottom: 14,
    marginTop: 2,
    gap: 6,
  },
  criteriaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  criteriaText: {
    fontSize: 12,
    fontWeight: "600",
  },
  criteriaValid: {
    color: "#22c55e",
  },
  criteriaInvalid: {
    color: "#ef4444",
  },
  disabledButton: {
    opacity: 0.6,
  },
  signupButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },
  dividerContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 24,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: Theme.colors.border,
  },
  dividerText: {
    color: Theme.colors.textMedium,
    fontSize: 13,
    paddingHorizontal: 16,
  },
  socialContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 20,
    marginBottom: 12,
  },
  socialIconBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
  },
  footerLinkContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 28,
  },
  footerText: {
    color: Theme.colors.textMedium,
    fontSize: 14,
  },
  loginLinkText: {
    color: Theme.colors.primary,
    fontSize: 14,
    fontWeight: "700",
  },
  sendOtpBtn: {
    backgroundColor: Theme.colors.primaryLight,
    height: 44,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 8,
  },
  disabledSendBtn: {
    opacity: 0.5,
  },
  sendOtpBtnText: {
    color: Theme.colors.primary,
    fontWeight: "700",
    fontSize: 14,
  },
});

