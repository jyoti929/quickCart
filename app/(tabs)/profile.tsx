import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, StatusBar, Alert, Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Theme } from "../../constants/theme";
import { authStore } from "../../services/authStore";
import { isCurrentUserAdmin } from "../../services/adminService";

export default function ProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    isCurrentUserAdmin().then(setIsAdmin).catch(() => setIsAdmin(false));
  }, []);

  const currentUser = authStore.getCurrentUser();
  const currentAddress = authStore.getCurrentAddress() || "No address provided";
  const detectedState = authStore.getDetectedState() || "Not set";

  const welcomeName = currentUser ? currentUser.name : "Guest User";
  const userInitials = welcomeName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase();

  const performLogout = async () => {
    try {
      await authStore.logout();
      router.replace("/login");
    } catch (e: any) {
      if (Platform.OS === "web") {
        window.alert(e.message || "An error occurred during logout.");
      } else {
        Alert.alert("Logout Error", e.message || "An error occurred during logout.");
      }
    }
  };

  const handleLogout = () => {
    if (Platform.OS === "web") {
      const confirmLogout = window.confirm("Are you sure you want to log out from quickCart?");
      if (confirmLogout) {
        performLogout();
      }
    } else {
      Alert.alert("Log Out", "Are you sure you want to log out from quickCart?", [
        { text: "Cancel", style: "cancel" },
        {
          text: "Log Out",
          style: "destructive",
          onPress: performLogout,
        },
      ]);
    }
  };

  const handleChangeLocation = () => {
    authStore.setCompletedPermissionFlow(false);
    authStore.setDetectedState("");
    router.replace("/permissions");
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
      
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>My Account</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* User Card */}
        <View style={styles.userCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{userInitials}</Text>
          </View>
          <View style={styles.userDetails}>
            <Text style={styles.userName}>{welcomeName}</Text>
            {currentUser?.email ? (
              <Text style={styles.userMeta}>✉️ {currentUser.email}</Text>
            ) : (
              <Text style={styles.userMeta}>✉️ No email registered</Text>
            )}
            <Text style={styles.userMeta} numberOfLines={1}>📍 {currentAddress}</Text>
            <Text style={styles.userMeta}>🗺️ Region: {detectedState}</Text>
          </View>
        </View>

        {/* Options List */}
        <View style={styles.optionsList}>
          {isAdmin && (
            <TouchableOpacity
              style={[styles.optionItem, styles.adminOptionItem]}
              activeOpacity={0.7}
              onPress={() => router.push("/admin/dashboard" as any)}
            >
              <View style={styles.optionLeft}>
                <View style={styles.adminIconWrap}>
                  <Ionicons name="shield-checkmark" size={18} color="#fff" />
                </View>
                <Text style={[styles.optionText, { color: Theme.colors.primary }]}>Admin Panel</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={Theme.colors.primary} />
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={styles.optionItem}
            activeOpacity={0.7}
            onPress={() => Alert.alert("My Orders", "No past orders found.")}
          >
            <View style={styles.optionLeft}>
              <Ionicons name="receipt-outline" size={20} color={Theme.colors.primary} />
              <Text style={styles.optionText}>Order History & Receipts</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color="#cbd5e1" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.optionItem}
            activeOpacity={0.7}
            onPress={handleChangeLocation}
          >
            <View style={styles.optionLeft}>
              <Ionicons name="location-outline" size={20} color={Theme.colors.primary} />
              <Text style={styles.optionText}>Change Location / Region</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color="#cbd5e1" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.optionItem}
            activeOpacity={0.7}
            onPress={() => Alert.alert("Support", "Connecting to helper agents...")}
          >
            <View style={styles.optionLeft}>
              <Ionicons name="help-circle-outline" size={20} color={Theme.colors.primary} />
              <Text style={styles.optionText}>Help & Customer Support</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color="#cbd5e1" />
          </TouchableOpacity>
        </View>

        {/* Footer Logout Button */}
        <TouchableOpacity
          style={styles.logoutBtn}
          activeOpacity={0.8}
          onPress={handleLogout}
        >
          <Ionicons name="log-out-outline" size={20} color="#ef4444" />
          <Text style={styles.logoutBtnText}>Log Out from quickCart</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#ffffff",
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: Theme.colors.primaryDark,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 100,
  },
  userCard: {
    flexDirection: "row",
    backgroundColor: "#ffffff",
    borderRadius: 20,
    padding: 20,
    alignItems: "center",
    marginBottom: 20,
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 2,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Theme.colors.primaryLight,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 16,
  },
  avatarText: {
    fontSize: 28,
    fontWeight: "800",
    color: Theme.colors.primary,
  },
  userDetails: {
    flex: 1,
    gap: 4,
  },
  userName: {
    fontSize: 20,
    fontWeight: "800",
    color: Theme.colors.primaryDark,
    marginBottom: 4,
  },
  userMeta: {
    fontSize: 12,
    fontWeight: "600",
    color: "#64748b",
  },
  optionsList: {
    backgroundColor: "#ffffff",
    borderRadius: 20,
    paddingVertical: 8,
    marginBottom: 24,
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 2,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  optionItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  optionLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  optionText: {
    fontSize: 14,
    fontWeight: "700",
    color: Theme.colors.primaryDark,
  },
  adminOptionItem: {
    backgroundColor: "#f0fdf4",
    borderRadius: 14,
    marginHorizontal: 8,
    marginBottom: 4,
  },
  adminIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: Theme.colors.primary,
    justifyContent: "center",
    alignItems: "center",
  },
  logoutBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#fef2f2",
    borderWidth: 1,
    borderColor: "#fecaca",
    borderRadius: 16,
    paddingVertical: 16,
  },
  logoutBtnText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#ef4444",
  },
});
