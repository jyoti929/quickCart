import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  Platform,
} from "react-native";
import { Stack } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Theme } from "../../constants/theme";
import AdminDrawer from "../../components/AdminDrawer";

// Shared header used across all admin screens
export function AdminHeader({
  title,
  onMenuPress,
  onBack,
  rightElement,
}: {
  title: string;
  onMenuPress?: () => void;
  onBack?: () => void;
  rightElement?: React.ReactNode;
}) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
      <TouchableOpacity
        style={styles.headerBtn}
        onPress={onBack || onMenuPress}
        activeOpacity={0.7}
      >
        <Ionicons
          name={onBack ? "arrow-back" : "menu"}
          size={22}
          color="#fff"
        />
      </TouchableOpacity>
      <Text style={styles.headerTitle} numberOfLines={1}>
        {title}
      </Text>
      <View style={styles.headerRight}>
        {rightElement || <View style={{ width: 36 }} />}
      </View>
    </View>
  );
}

export default function AdminLayout() {
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <>
      <Stack
        screenOptions={{
          headerShown: false,
          animation: "slide_from_right",
        }}
      >
        <Stack.Screen name="dashboard" />
        <Stack.Screen name="categories" />
        <Stack.Screen name="products" />
        <Stack.Screen name="product-form" />
        <Stack.Screen name="cities" />
        <Stack.Screen name="orders" />
        <Stack.Screen name="order-detail" />
        <Stack.Screen name="users" />
        <Stack.Screen name="banners" />
      </Stack>

      <AdminDrawer
        visible={drawerOpen}
        onClose={() => setDrawerOpen(false)}
      />
    </>
  );
}

// Context for drawer toggle — screens use this via props drilling or a simple callback
export function useAdminDrawer() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  return { drawerOpen, openDrawer: () => setDrawerOpen(true), closeDrawer: () => setDrawerOpen(false) };
}

const styles = StyleSheet.create({
  header: {
    backgroundColor: Theme.colors.primary,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingBottom: 12,
    gap: 8,
  },
  headerBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.15)",
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitle: {
    flex: 1,
    fontSize: 17,
    fontWeight: "800",
    color: "#fff",
    textAlign: "center",
  },
  headerRight: {
    width: 36,
    alignItems: "flex-end",
  },
});
