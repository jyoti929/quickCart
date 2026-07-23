import { Stack, useRouter, useSegments } from "expo-router";
import { View, StyleSheet, Platform, ViewStyle, Text, TouchableOpacity, Alert, StatusBar } from "react-native";
import { useState, useEffect } from "react";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { auth, db } from "../services/firebase";
import { doc, onSnapshot } from "firebase/firestore";
import { authStore } from "../services/authStore";
import { Theme } from "../constants/theme";
import * as SplashScreen from "expo-splash-screen";
import { Ionicons } from "@expo/vector-icons";

// Persist admin role in memory to avoid repeated Firestore reads per navigation
let cachedIsAdmin: boolean | null = null;
export function setAdminCache(val: boolean) { cachedIsAdmin = val; }
export function getAdminCache(): boolean | null { return cachedIsAdmin; }

// Prevent the native splash screen from auto-hiding before app initialization is complete.
SplashScreen.preventAutoHideAsync().catch(() => {
  /* Ignore errors, especially in web environment */
});

function AppContent() {
  const segments = useSegments();
  const router = useRouter();
  const [initializing, setInitializing] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [isBlocked, setIsBlocked] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    let unsubscribeDoc: (() => void) | null = null;
    // Use a local flag instead of reading from state inside the listener,
    // so we never need initializing in the dep array (which would cause the
    // auth listener to re-register on every initializing→false transition,
    // creating a brief window where auth.currentUser appears null to Firestore).
    let isFirstCall = true;

    const unsubscribeAuth = onAuthStateChanged(auth, async (usr) => {
      if (usr) {
        setUser(usr);

        // Listen to user document in real-time
        unsubscribeDoc = onSnapshot(doc(db, "users", usr.uid), (docSnap) => {
          if (docSnap.exists()) {
            const data = docSnap.data();
            const blocked = data.isBlocked === true;
            setIsBlocked(blocked);
            authStore.setIsBlocked(blocked);
            const admin = data.role === "admin";
            setIsAdmin(admin);
            setAdminCache(admin);

            // Hydrate other authStore info on sync
            authStore.setCurrentUser({
              name: data.name || "User",
              email: data.email || usr.email || "",
            });
            if (data.currentAddress) authStore.setCurrentAddress(data.currentAddress);
            if (data.detectedState) authStore.setDetectedState(data.detectedState);
            if (data.completedPermissionFlow !== undefined) {
              authStore.setCompletedPermissionFlow(data.completedPermissionFlow);
            }
          } else {
            setIsBlocked(false);
            authStore.setIsBlocked(false);
            setIsAdmin(false);
            setAdminCache(false);
          }
        }, (error) => {
          console.error("User doc snapshot error:", error);
        });

      } else {
        setUser(null);
        setIsBlocked(false);
        authStore.setIsBlocked(false);
        setIsAdmin(false);
        setAdminCache(false);
        authStore.setCurrentUser(null);
        if (unsubscribeDoc) {
          unsubscribeDoc();
          unsubscribeDoc = null;
        }
      }

      // Only flip initializing once — on the very first auth state callback
      if (isFirstCall) {
        isFirstCall = false;
        setInitializing(false);
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeDoc) {
        unsubscribeDoc();
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (initializing) return;

    const inAuthGroup =
      segments[0] === "onboarding" ||
      segments[0] === "signup" ||
      segments[0] === "login" ||
      segments[0] === "otp" ||
      segments[0] === "forgot-password";

    const isIndex = (segments.length as number) === 0 || (segments[0] as string) === "index";
    const inAdminGroup = (segments[0] as string) === "admin";

    if (!user) {
      // Unauthenticated state: enforce login
      if (!inAuthGroup) {
        router.replace("/login");
      }
    } else {
      // Block non-admins from admin screens
      if (inAdminGroup && cachedIsAdmin === false) {
        router.replace("/(tabs)/home");
        return;
      }
      // Authenticated state: block auth pages
      if (inAuthGroup || isIndex) {
        if (cachedIsAdmin === true) {
          router.replace("/admin/dashboard");
        } else if (authStore.hasCompletedPermissionFlow()) {
          router.replace("/(tabs)/home");
        } else {
          router.replace("/permissions");
        }
      }
    }

    // Hide native splash screen once the initial navigation is determined
    SplashScreen.hideAsync().catch(() => {
      /* Ignore errors */
    });
  }, [user, initializing, segments, router]);

  const handleContactSupport = () => {
    Alert.alert(
      "Contact Support",
      "For support assistance, please email support@quickcart.com or call our helpline at +91 1800-QUICKCART.",
      [{ text: "OK" }]
    );
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      router.replace("/login");
    } catch (e: any) {
      Alert.alert("Logout Error", e.message || "Failed to log out.");
    }
  };

  if (user && isBlocked && !isAdmin) {
    return (
      <View style={styles.blockedOverlay}>
        <StatusBar barStyle="dark-content" backgroundColor="#fef2f2" />
        <View style={styles.blockedContent}>
          <View style={styles.blockedIconBg}>
            <Ionicons name="lock-closed" size={64} color="#ef4444" />
          </View>
          <Text style={styles.blockedTitle}>Account Blocked</Text>
          <Text style={styles.blockedDesc}>
            Your account has been temporarily blocked by the administrator. Please contact customer support for assistance.
          </Text>
          
          <TouchableOpacity style={styles.supportBtn} onPress={handleContactSupport} activeOpacity={0.8}>
            <Ionicons name="chatbubbles" size={20} color="#ffffff" style={{ marginRight: 8 }} />
            <Text style={styles.supportBtnText}>Contact Support</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout} activeOpacity={0.8}>
            <Ionicons name="log-out-outline" size={20} color="#ef4444" style={{ marginRight: 8 }} />
            <Text style={styles.logoutBtnText}>Logout</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="onboarding" />
      <Stack.Screen name="signup" />
      <Stack.Screen name="otp" />
      <Stack.Screen name="login" />
      <Stack.Screen name="forgot-password" />
      <Stack.Screen name="permissions" />
      <Stack.Screen name="category" />
      <Stack.Screen name="product" />
      <Stack.Screen name="cart" />
      <Stack.Screen name="select-address" />
      <Stack.Screen name="add-address" />
      <Stack.Screen name="order-detail" />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="admin" />
    </Stack>
  );
}

export default function RootLayout() {
  const content = <AppContent />;

  if (Platform.OS === "web") {
    return (
      <View style={styles.webOuterContainer}>
        <View style={styles.webAppContainer}>
          {content}
        </View>
      </View>
    );
  }

  return content;
}

const styles = StyleSheet.create({
  webOuterContainer: {
    flex: 1,
    backgroundColor: "#E2EAF4", // Soft light gray-blue background for the desktop web view
    justifyContent: "center",
    alignItems: "center",
  },
  webAppContainer: {
    width: "100%",
    maxWidth: 450,
    height: "100%",
    backgroundColor: Theme.colors.background,
    // Use boxShadow on web (shadow* props are deprecated for RN Web)
    // On native, elevation + shadow* props are used instead.
    ...Platform.select({
      web: {
        boxShadow: "0 12px 48px rgba(26, 58, 48, 0.18)",
      } as ViewStyle,
      default: {
        shadowColor: "#1a3a30",
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 0.18,
        shadowRadius: 24,
        elevation: 10,
      },
    }),
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: "#E5E7EB",
  },
  blockedOverlay: {
    flex: 1,
    backgroundColor: "#fef2f2",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  blockedContent: {
    backgroundColor: "#ffffff",
    borderRadius: 24,
    padding: 24,
    alignItems: "center",
    width: "100%",
    maxWidth: 380,
    borderWidth: 1,
    borderColor: "#fee2e2",
    ...Platform.select({
      web: {
        boxShadow: "0 8px 32px rgba(239, 68, 68, 0.08)",
      } as ViewStyle,
      default: {
        shadowColor: "#ef4444",
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.08,
        shadowRadius: 16,
        elevation: 4,
      },
    }),
  },
  blockedIconBg: {
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: "#fee2e2",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
  },
  blockedTitle: {
    fontSize: 20,
    fontWeight: "900",
    color: "#991b1b",
    marginBottom: 10,
  },
  blockedDesc: {
    fontSize: 13,
    color: "#7f1d1d",
    textAlign: "center",
    lineHeight: 18,
    fontWeight: "600",
    marginBottom: 28,
  },
  supportBtn: {
    backgroundColor: "#ef4444",
    height: 48,
    borderRadius: 12,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    width: "100%",
    marginBottom: 12,
    ...Platform.select({
      web: {
        boxShadow: "0 4px 12px rgba(239, 68, 68, 0.2)",
      } as ViewStyle,
      default: {
        shadowColor: "#ef4444",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 8,
        elevation: 2,
      },
    }),
  },
  supportBtnText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "800",
  },
  logoutBtn: {
    backgroundColor: "#ffffff",
    height: 48,
    borderRadius: 12,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    width: "100%",
    borderWidth: 1.5,
    borderColor: "#fee2e2",
  },
  logoutBtnText: {
    color: "#ef4444",
    fontSize: 14,
    fontWeight: "800",
  },
});
