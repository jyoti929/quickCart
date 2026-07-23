import React, { useState, useEffect } from "react";
import { Tabs, useRouter } from "expo-router";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Theme } from "../../constants/theme";
import { authStore } from "../../services/authStore";
import { isCurrentUserAdmin } from "../../services/adminService";

export default function TabsLayout() {
  const router = useRouter();
  const [totalCartItems, setTotalCartItems] = useState(0);
  const [isAdmin, setIsAdmin] = useState(false);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    isCurrentUserAdmin().then(setIsAdmin).catch(() => setIsAdmin(false));
  }, []);

  useEffect(() => {
    const calculateCart = () => {
      const cart = authStore.getCart();
      const total = Object.values(cart).reduce((a, b) => a + b, 0);
      setTotalCartItems(total);
    };

    calculateCart();
    const unsubscribe = authStore.subscribeCart(calculateCart);
    return () => unsubscribe();
  }, []);

  return (
    <View style={{ flex: 1 }}>
      {isAdmin && (
        <View style={[styles.adminBanner, { paddingTop: insets.top }]}>
          <View style={styles.adminBannerLeft}>
            <Ionicons name="eye-outline" size={16} color="#FFFFFF" />
            <Text style={styles.adminBannerText}>Admin Preview Mode</Text>
          </View>
          <TouchableOpacity
            style={styles.adminBannerBtn}
            onPress={() => router.push("/admin/dashboard" as any)}
            activeOpacity={0.8}
          >
            <Text style={styles.adminBannerBtnText}>Go to Admin Panel</Text>
          </TouchableOpacity>
        </View>
      )}
      <Tabs
        backBehavior="history"
        screenOptions={{
          headerShown: false,
        }}
      tabBar={({ state, navigation }) => {
        const bottomPadding = Math.max(insets.bottom, 12);
        return (
          <View style={[
            styles.tabBar, 
            { 
              height: 64 + bottomPadding, 
              paddingBottom: bottomPadding 
            },
            totalCartItems > 0 && { borderTopWidth: 0 }
          ]}>
            {state.routes.map((route, index) => {
              const isFocused = state.index === index;

              const onPress = () => {
                const event = navigation.emit({
                  type: "tabPress",
                  target: route.key,
                  canPreventDefault: true,
                });

                if (!isFocused && !event.defaultPrevented) {
                  // Standard react navigation navigation method, not using router.push()
                  navigation.navigate(route.name);
                }
              };

              let iconName: any = "home-outline";
              let label = "Home";

              if (route.name === "home") {
                iconName = isFocused ? "home" : "home-outline";
                label = "Home";
              } else if (route.name === "explore") {
                iconName = isFocused ? "search" : "search-outline";
                label = "Explore";
              } else if (route.name === "orders") {
                iconName = isFocused ? "document-text" : "document-text-outline";
                label = "Orders";
              } else if (route.name === "profile") {
                iconName = isFocused ? "person" : "person-outline";
                label = "Profile";
              }

              return (
                <TouchableOpacity
                  key={route.key}
                  style={styles.tabItem}
                  activeOpacity={0.8}
                  onPress={onPress}
                >
                  <Ionicons
                    name={iconName}
                    size={22}
                    color={isFocused ? Theme.colors.primary : "#64748b"}
                  />
                  <Text style={[styles.tabLabel, isFocused && styles.tabLabelActive]}>
                    {label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        );
      }}
    >
      <Tabs.Screen name="home" />
      <Tabs.Screen name="explore" />
      <Tabs.Screen name="orders" />
      <Tabs.Screen name="profile" />
    </Tabs>
    </View>
  );
}

const styles = StyleSheet.create({
  adminBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: Theme.colors.primary,
    paddingHorizontal: 16,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
  },
  adminBannerLeft: {
    flexDirection: "row",
    alignItems: "center",
  },
  adminBannerText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#FFFFFF",
    marginLeft: 6,
  },
  adminBannerBtn: {
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  adminBannerBtnText: {
    fontSize: 11,
    fontWeight: "800",
    color: Theme.colors.primary,
  },
  tabBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 64,
    backgroundColor: "#ffffff",
    borderTopWidth: 1,
    borderTopColor: "#f1f5f9",
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    paddingBottom: 4,
    zIndex: 9,
  },
  tabItem: {
    alignItems: "center",
    justifyContent: "center",
    flex: 1,
    height: "100%",
  },
  tabLabel: {
    fontSize: 10,
    color: "#64748b",
    fontWeight: "700",
    marginTop: 3,
  },
  tabLabelActive: {
    color: Theme.colors.primary,
  },
});
