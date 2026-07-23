import React, { useRef, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Dimensions,
  Platform,
  StatusBar,
  TouchableWithoutFeedback,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter, usePathname } from "expo-router";
import { Theme } from "../constants/theme";
import { authStore } from "../services/authStore";

const { width } = Dimensions.get("window");
const DRAWER_WIDTH = Math.min(width * 0.78, 300);

interface AdminDrawerProps {
  visible: boolean;
  onClose: () => void;
}

interface NavItem {
  label: string;
  icon: string;
  route: string;
}

const navItems: NavItem[] = [
  { label: "Dashboard", icon: "grid-outline", route: "/admin/dashboard" },
  { label: "Categories", icon: "list-outline", route: "/admin/categories" },
  { label: "Products", icon: "cube-outline", route: "/admin/products" },
  { label: "Cities", icon: "location-outline", route: "/admin/cities" },
  { label: "Orders", icon: "receipt-outline", route: "/admin/orders" },
  { label: "Users", icon: "people-outline", route: "/admin/users" },
  { label: "Banners", icon: "image-outline", route: "/admin/banners" },
  { label: "Preview App", icon: "eye-outline", route: "/admin/preview" },
];

export default function AdminDrawer({ visible, onClose }: AdminDrawerProps) {
  const router = useRouter();
  const pathname = usePathname();
  const slideAnim = useRef(new Animated.Value(-DRAWER_WIDTH)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(slideAnim, {
          toValue: 0,
          useNativeDriver: true,
          tension: 65,
          friction: 11,
        }),
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: -DRAWER_WIDTH,
          duration: 220,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible]);

  const handleNavigate = (route: string) => {
    onClose();
    setTimeout(() => {
      router.push(route as any);
    }, 200);
  };

  const handleLogout = async () => {
    onClose();
    setTimeout(async () => {
      await authStore.logout();
      router.replace("/login");
    }, 200);
  };

  const user = authStore.getCurrentUser();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    if (visible && !mounted) setMounted(true);
  }, [visible]);

  if (!mounted) return null;

  return (
    <View style={StyleSheet.absoluteFillObject} pointerEvents={visible ? "auto" : "none"}>
      {/* Backdrop */}
      <TouchableWithoutFeedback onPress={onClose}>
        <Animated.View style={[styles.backdrop, { opacity: fadeAnim }]} />
      </TouchableWithoutFeedback>

      {/* Drawer panel */}
      <Animated.View
        style={[
          styles.drawer,
          { transform: [{ translateX: slideAnim }] },
        ]}
      >
        {/* Header */}
        <View style={styles.drawerHeader}>
          <View style={styles.adminBadge}>
            <Ionicons name="shield-checkmark" size={22} color="#fff" />
          </View>
          <View style={styles.headerInfo}>
            <Text style={styles.adminLabel}>Admin Panel</Text>
            <Text style={styles.adminEmail} numberOfLines={1}>
              {user?.email || "admin"}
            </Text>
          </View>
          <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
            <Ionicons name="close" size={20} color="#fff" />
          </TouchableOpacity>
        </View>

        {/* Nav items */}
        <View style={styles.navList}>
          {navItems.map((item) => {
            const isActive = pathname === item.route || pathname.startsWith(item.route + "/");
            return (
              <TouchableOpacity
                key={item.route}
                style={[styles.navItem, isActive && styles.navItemActive]}
                activeOpacity={0.7}
                onPress={() => handleNavigate(item.route)}
              >
                <Ionicons
                  name={isActive ? (item.icon.replace("-outline", "") as any) : (item.icon as any)}
                  size={20}
                  color={isActive ? Theme.colors.primary : "#64748b"}
                />
                <Text style={[styles.navLabel, isActive && styles.navLabelActive]}>
                  {item.label}
                </Text>
                {isActive && <View style={styles.activeIndicator} />}
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Logout */}
        <View style={styles.drawerFooter}>
          <TouchableOpacity style={styles.logoutItem} onPress={handleLogout} activeOpacity={0.7}>
            <Ionicons name="log-out-outline" size={20} color="#ef4444" />
            <Text style={styles.logoutLabel}>Logout</Text>
          </TouchableOpacity>
          <Text style={styles.versionText}>quickCart Admin v1.0</Text>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  drawer: {
    position: "absolute",
    top: 0,
    left: 0,
    bottom: 0,
    width: DRAWER_WIDTH,
    backgroundColor: "#fff",
    shadowColor: "#000",
    shadowOffset: { width: 4, height: 0 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 16,
  },
  drawerHeader: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Theme.colors.primary,
    paddingTop: Platform.OS === "android" ? (StatusBar.currentHeight || 24) + 12 : 52,
    paddingBottom: 20,
    paddingHorizontal: 16,
    gap: 12,
  },
  adminBadge: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "rgba(255,255,255,0.2)",
    justifyContent: "center",
    alignItems: "center",
  },
  headerInfo: {
    flex: 1,
  },
  adminLabel: {
    fontSize: 15,
    fontWeight: "800",
    color: "#fff",
  },
  adminEmail: {
    fontSize: 11,
    color: "rgba(255,255,255,0.75)",
    marginTop: 2,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.15)",
    justifyContent: "center",
    alignItems: "center",
  },
  navList: {
    flex: 1,
    paddingTop: 12,
    paddingHorizontal: 12,
  },
  navItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 13,
    borderRadius: 12,
    marginBottom: 4,
    gap: 12,
    position: "relative",
  },
  navItemActive: {
    backgroundColor: "#f0fdf4",
  },
  navLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#64748b",
    flex: 1,
  },
  navLabelActive: {
    color: Theme.colors.primary,
  },
  activeIndicator: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Theme.colors.primary,
  },
  drawerFooter: {
    paddingHorizontal: 12,
    paddingBottom: 32,
    borderTopWidth: 1,
    borderTopColor: "#f1f5f9",
    paddingTop: 12,
  },
  logoutItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 13,
    borderRadius: 12,
    gap: 12,
    backgroundColor: "#fef2f2",
    marginBottom: 12,
  },
  logoutLabel: {
    fontSize: 14,
    fontWeight: "700",
    color: "#ef4444",
  },
  versionText: {
    fontSize: 10,
    color: "#cbd5e1",
    textAlign: "center",
  },
});
