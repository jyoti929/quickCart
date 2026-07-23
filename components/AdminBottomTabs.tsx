import React from "react";
import { View, Text, StyleSheet, TouchableOpacity, Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter, usePathname } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Theme } from "../constants/theme";

export default function AdminBottomTabs() {
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();

  const tabs = [
    { name: "Dashboard", route: "/admin/dashboard", icon: "grid-outline", iconActive: "grid" },
    { name: "Products", route: "/admin/products", icon: "cube-outline", iconActive: "cube" },
    { name: "Categories", route: "/admin/categories", icon: "list-outline", iconActive: "list" },
    { name: "Orders", route: "/admin/orders", icon: "receipt-outline", iconActive: "receipt" },
    { name: "Users", route: "/admin/users", icon: "people-outline", iconActive: "people" },
  ];

  const bottomPadding = Math.max(insets.bottom, 12);

  return (
    <View style={[styles.container, { height: 60 + bottomPadding, paddingBottom: bottomPadding }]}>
      {tabs.map((tab) => {
        const isActive = pathname === tab.route || pathname.startsWith(tab.route + "/");
        const activeColor = Theme.colors.primary || "#22C55E";
        return (
          <TouchableOpacity
            key={tab.route}
            style={styles.tab}
            onPress={() => router.push(tab.route as any)}
            activeOpacity={0.7}
          >
            <Ionicons
              name={(isActive ? tab.iconActive : tab.icon) as any}
              size={22}
              color={isActive ? activeColor : "#94a3b8"}
            />
            <Text style={[styles.label, { color: isActive ? activeColor : "#64748b" }]}>
              {tab.name}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    backgroundColor: "#ffffff",
    borderTopWidth: 1,
    borderTopColor: "#f1f5f9",
    paddingTop: 8,
    justifyContent: "space-around",
    alignItems: "center",
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 8,
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 99,
  },
  tab: {
    alignItems: "center",
    justifyContent: "center",
    flex: 1,
    height: "100%",
  },
  label: {
    fontSize: 10,
    fontWeight: "700",
    marginTop: 3,
  },
});
