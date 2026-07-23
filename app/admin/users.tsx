import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  StatusBar,
  Modal,
  ScrollView,
  Alert,
  Platform,
  Animated,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { Theme } from "../../constants/theme";
import AdminDrawer from "../../components/AdminDrawer";
import {
  subscribeAllUsers,
  getAllOrders,
  AdminUser,
  AdminOrder,
  updateAdminUser,
  uploadUserPhoto,
} from "../../services/adminService";

export default function AdminUsers() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Core Data States
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<AdminUser[]>([]);
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [loading, setLoading] = useState(true);

  // Search & Filter States
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<"All" | "Active" | "Blocked" | "New" | "Verified">("All");
  const [sortBy, setSortBy] = useState<"Joined" | "Orders" | "Spent">("Joined");

  // Interaction overlays
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);
  const [menuVisible, setMenuVisible] = useState(false);
  const [profileModalVisible, setProfileModalVisible] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);

  // Edit User form states
  const [editName, setEditName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editPhoto, setEditPhoto] = useState("");
  const [editBlocked, setEditBlocked] = useState(false);
  const [editSaving, setEditSaving] = useState(false);

  // Animation values
  const shimmerAnim = useRef(new Animated.Value(0.3)).current;
  const listOpacity = useRef(new Animated.Value(1)).current;

  // Hydrate users and orders in real-time
  useEffect(() => {
    setLoading(true);

    // Load orders once to map aggregate analytics
    getAllOrders()
      .then((ordersData) => {
        setOrders(ordersData);
      })
      .catch((err) => {
        console.error("Failed to prefetch orders:", err);
      });

    // Real-time listener for users
    const unsubscribe = subscribeAllUsers((usersData) => {
      // Filter out soft deleted users
      const activeList = usersData.filter((u) => u.isDeleted !== true);
      setUsers(activeList);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Shimmer looping animation
  useEffect(() => {
    if (loading) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(shimmerAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
          Animated.timing(shimmerAnim, { toValue: 0.3, duration: 800, useNativeDriver: true }),
        ])
      ).start();
    } else {
      shimmerAnim.stopAnimation();
    }
  }, [loading, shimmerAnim]);

  // Aggregate user statistics
  const userOrderStats = useCallback((uid: string) => {
    const userOrders = orders.filter((o) => o.uid === uid);
    const deliveredCount = userOrders.filter((o) => o.status === "Delivered").length;
    const cancelledCount = userOrders.filter((o) => o.status === "Cancelled").length;
    const pendingCount = userOrders.length - deliveredCount - cancelledCount;
    const totalSpent = userOrders
      .filter((o) => o.status !== "Cancelled")
      .reduce((sum, o) => sum + (o.totalAmount || 0), 0);

    return {
      total: userOrders.length,
      delivered: deliveredCount,
      cancelled: cancelledCount,
      pending: pendingCount,
      spent: totalSpent,
      recent: userOrders.slice(0, 5),
    };
  }, [orders]);

  // Filter & Sort Logic
  useEffect(() => {
    let result = [...users];

    // Search query validation
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (u) =>
          u.name?.toLowerCase().includes(q) ||
          u.email?.toLowerCase().includes(q) ||
          (u.mobile || u.phone || "").toLowerCase().includes(q)
      );
    }

    // Filter selector
    if (filterType === "Active") {
      result = result.filter((u) => u.isBlocked !== true);
    } else if (filterType === "Blocked") {
      result = result.filter((u) => u.isBlocked === true);
    } else if (filterType === "Verified") {
      result = result.filter((u) => u.isVerified === true);
    } else if (filterType === "New") {
      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
      result = result.filter((u) => {
        const joinDate = u.createdAt ? new Date(u.createdAt) : new Date();
        return joinDate.getTime() >= oneWeekAgo.getTime();
      });
    }

    // Sort selector
    result.sort((a, b) => {
      if (sortBy === "Spent") {
        const spentA = userOrderStats(a.uid).spent;
        const spentB = userOrderStats(b.uid).spent;
        return spentB - spentA;
      }
      if (sortBy === "Orders") {
        const countA = userOrderStats(a.uid).total;
        const countB = userOrderStats(b.uid).total;
        return countB - countA;
      }
      // Default: Joined Date
      const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return timeB - timeA;
    });

    setFilteredUsers(result);
  }, [search, filterType, sortBy, users, orders, userOrderStats]);

  // Handle filter changes with a smooth fade/slide animation
  const handleFilterChange = (type: "All" | "Active" | "Blocked" | "New" | "Verified") => {
    Animated.sequence([
      Animated.timing(listOpacity, {
        toValue: 0.1,
        duration: 120,
        useNativeDriver: true,
      }),
      Animated.timing(listOpacity, {
        toValue: 1,
        duration: 180,
        useNativeDriver: true,
      }),
    ]).start();
    setFilterType(type);
  };

  // Analytics helper calculations
  const totalUsersCount = users.length;
  const blockedUsersCount = users.filter((u) => u.isBlocked === true).length;
  const activeUsersCount = totalUsersCount - blockedUsersCount;
  const newUsersTodayCount = users.filter((u) => {
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    const joinDate = u.createdAt ? new Date(u.createdAt) : new Date();
    return joinDate.getTime() >= oneWeekAgo.getTime();
  }).length;

  // Actions menu triggers
  const handleOpenMenu = (user: AdminUser) => {
    setSelectedUser(user);
    setMenuVisible(true);
  };

  const handleViewProfile = () => {
    setMenuVisible(false);
    setTimeout(() => {
      setProfileModalVisible(true);
    }, 150);
  };

  const handleEditUser = () => {
    if (!selectedUser) return;
    setEditName(selectedUser.name || "");
    setEditPhone(selectedUser.mobile || selectedUser.phone || "");
    setEditPhoto(selectedUser.photoUrl || "");
    setEditBlocked(selectedUser.isBlocked === true);
    setMenuVisible(false);
    setTimeout(() => {
      setEditModalVisible(true);
    }, 150);
  };

  // Image Picker inside Edit modal
  const handlePickEditImage = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permission Denied", "QuickCart needs gallery access to upload user avatars.");
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        setEditPhoto(result.assets[0].uri);
      }
    } catch (e) {
      console.warn("Avatar selection failed:", e);
    }
  };

  const handleSaveUserEdit = async () => {
    if (!selectedUser) return;
    setEditSaving(true);
    try {
      let finalPhoto = editPhoto;
      if (editPhoto && !editPhoto.startsWith("http")) {
        finalPhoto = await uploadUserPhoto(editPhoto);
      }

      const blockPayload = editBlocked 
        ? { isBlocked: true, blockedAt: new Date(), blockedReason: "" }
        : { isBlocked: false };

      await updateAdminUser(selectedUser.uid, {
        name: editName,
        mobile: editPhone,
        phone: editPhone,
        photoUrl: finalPhoto,
        ...blockPayload,
      });

      setEditModalVisible(false);
      setSelectedUser(null);
      Alert.alert("Success", "User details updated successfully.");
    } catch (e: any) {
      Alert.alert("Error", e.message || "Failed to update user profile.");
    } finally {
      setEditSaving(false);
    }
  };

  // Block confirmation dialog
  const handleToggleBlock = () => {
    if (!selectedUser) return;
    const isCurrentlyBlocked = selectedUser.isBlocked === true;
    setMenuVisible(false);

    const triggerBlock = async () => {
      try {
        if (isCurrentlyBlocked) {
          await updateAdminUser(selectedUser.uid, {
            isBlocked: false,
          });
        } else {
          await updateAdminUser(selectedUser.uid, {
            isBlocked: true,
            blockedAt: new Date(),
            blockedReason: "",
          });
        }
        Alert.alert("Success", `User successfully ${isCurrentlyBlocked ? "unblocked" : "blocked"}.`);
      } catch (err: any) {
        Alert.alert("Action Failed", err.message || "Failed to alter account status.");
      }
    };

    if (Platform.OS === "web") {
      const msg = isCurrentlyBlocked
        ? "Unblock this user account? The user will be allowed to place orders again."
        : "Block User?\n\nThe user will not be able to place new orders until unblocked.";
      if (window.confirm(msg)) {
        triggerBlock();
      }
    } else {
      Alert.alert(
        isCurrentlyBlocked ? "Unblock User?" : "Block User?",
        isCurrentlyBlocked
          ? "The user will be allowed to place orders again."
          : "The user will not be able to place new orders until unblocked.",
        [
          { text: "Cancel", style: "cancel" },
          { text: isCurrentlyBlocked ? "Unblock" : "Block", style: "destructive", onPress: triggerBlock },
        ]
      );
    }
  };

  // Soft Delete confirmation dialog
  const handleDeleteUser = () => {
    if (!selectedUser) return;
    setMenuVisible(false);

    const triggerDelete = async () => {
      try {
        await updateAdminUser(selectedUser.uid, {
          isDeleted: true,
        });
        Alert.alert("Deleted", "The user record has been deleted.");
        setSelectedUser(null);
      } catch (err: any) {
        Alert.alert("Error", err.message || "Failed to delete user.");
      }
    };

    if (Platform.OS === "web") {
      if (window.confirm("Delete User?\n\nThis action cannot be undone. User records are soft-deleted from this screen but transaction logs are preserved.")) {
        triggerDelete();
      }
    } else {
      Alert.alert(
        "Delete User?",
        "This action cannot be undone. The user will be removed from this list, but purchase histories will remain.",
        [
          { text: "Cancel", style: "cancel" },
          { text: "Delete", style: "destructive", onPress: triggerDelete },
        ]
      );
    }
  };

  // Formatting helpers
  const getInitials = (name?: string) => {
    if (!name) return "U";
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const formatDate = (dateValue?: any) => {
    if (!dateValue) return "—";
    let d = new Date();
    if (dateValue.seconds) {
      d = new Date(dateValue.seconds * 1000);
    } else {
      d = new Date(dateValue);
    }
    return isNaN(d.getTime())
      ? "—"
      : d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
  };

  // Rendering shimmer placeholders
  const renderSkeletons = () => (
    <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
      {[1, 2, 3, 4].map((i) => (
        <Animated.View key={i} style={[styles.card, { opacity: shimmerAnim }]}>
          <View style={styles.shimmerAvatar} />
          <View style={{ flex: 1, gap: 6 }}>
            <View style={styles.shimmerTitle} />
            <View style={styles.shimmerSub} />
            <View style={styles.shimmerSub} />
          </View>
        </Animated.View>
      ))}
    </ScrollView>
  );

  // User card item inside flatlist
  const renderUserCard = ({ item }: { item: AdminUser }) => {
    const stats = userOrderStats(item.uid);
    const initials = getInitials(item.name);

    return (
      <Animated.View style={[styles.card, { opacity: listOpacity }]}>
        {/* Profile Avatar */}
        <View style={styles.avatarContainer}>
          {item.photoUrl ? (
            <Image source={{ uri: item.photoUrl }} style={styles.avatarImage} contentFit="cover" />
          ) : (
            <View style={[styles.avatarFallback, { backgroundColor: Theme.colors.primary + "15" }]}>
              <Text style={[styles.avatarText, { color: Theme.colors.primary }]}>{initials}</Text>
            </View>
          )}
        </View>

        {/* Info Column */}
        <View style={styles.cardInfo}>
          <View style={styles.cardHeaderRow}>
            <Text style={styles.cardName} numberOfLines={1}>
              {item.name || "Customer Account"}
            </Text>
            
            {/* Status Badges */}
            <View style={styles.badgeRow}>
              {item.isBlocked ? (
                <View style={[styles.statusBadge, styles.badgeBlocked]}>
                  <Text style={styles.badgeBlockedText}>Blocked</Text>
                </View>
              ) : item.isVerified ? (
                <View style={[styles.statusBadge, styles.badgeVerified]}>
                  <Text style={styles.badgeVerifiedText}>Verified</Text>
                </View>
              ) : (
                <View style={[styles.statusBadge, styles.badgeActive]}>
                  <Text style={styles.badgeActiveText}>Active</Text>
                </View>
              )}
            </View>
          </View>

          <Text style={styles.cardEmail} numberOfLines={1}>{item.email}</Text>
          <Text style={styles.cardPhone}>📞 {item.mobile || item.phone || "No phone added"}</Text>

          <View style={styles.dividerLine} />

          {/* Quick Metrics */}
          <View style={styles.cardMetaRow}>
            <View style={styles.cardMetaBox}>
              <Text style={styles.metaLabel}>Orders</Text>
              <Text style={styles.metaValue}>{stats.total}</Text>
            </View>
            <View style={styles.cardMetaBox}>
              <Text style={styles.metaLabel}>Spent</Text>
              <Text style={styles.metaValue}>Rs. {stats.spent}</Text>
            </View>
            <View style={styles.cardMetaBox}>
              <Text style={styles.metaLabel}>Joined</Text>
              <Text style={styles.metaValue}>{formatDate(item.createdAt || item.joinedAt)}</Text>
            </View>
          </View>
        </View>

        {/* Options Dots */}
        <TouchableOpacity style={styles.optionsBtn} onPress={() => handleOpenMenu(item)}>
          <Ionicons name="ellipsis-vertical" size={20} color="#64748b" />
        </TouchableOpacity>
      </Animated.View>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={Theme.colors.primary} />

      {/* Screen Header (App Bar) */}
      <View style={[styles.header, { height: 95 + insets.top, paddingTop: insets.top }]}>
        <TouchableOpacity style={styles.menuBtn} onPress={() => router.push("/admin/dashboard")} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Users</Text>
          <Text style={styles.headerSubtitle}>Manage registered customers</Text>
        </View>
        <TouchableOpacity style={styles.menuBtn} onPress={() => setDrawerOpen(true)} activeOpacity={0.7}>
          <Ionicons name="menu-outline" size={22} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Primary Vertical Layout scroll (FlatList) */}
      {loading ? (
        renderSkeletons()
      ) : (
        <FlatList
          data={filteredUsers}
          renderItem={renderUserCard}
          keyExtractor={(item) => item.uid}
          contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 40 }]}
          showsVerticalScrollIndicator={false}
          ItemSeparatorComponent={() => <View style={{ height: 16 }} />}
          ListHeaderComponentStyle={{ marginBottom: 20 }}
          ListHeaderComponent={
            <View style={styles.headerComponentContainer}>
              {/* 1. Analytics Cards */}
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.kpiContainer}
                contentContainerStyle={styles.kpiScroll}
              >
                <View style={styles.kpiCard}>
                  <Text style={styles.kpiValue}>{loading ? "..." : totalUsersCount}</Text>
                  <Text style={styles.kpiLabel}>Total Users</Text>
                </View>
                <View style={[styles.kpiCard, { borderLeftColor: "#10b981", borderLeftWidth: 4 }]}>
                  <Text style={styles.kpiValue}>{loading ? "..." : activeUsersCount}</Text>
                  <Text style={styles.kpiLabel}>Active Users</Text>
                </View>
                <View style={[styles.kpiCard, { borderLeftColor: "#3b82f6", borderLeftWidth: 4 }]}>
                  <Text style={styles.kpiValue}>{loading ? "..." : newUsersTodayCount}</Text>
                  <Text style={styles.kpiLabel}>New Users</Text>
                </View>
                <View style={[styles.kpiCard, { borderLeftColor: "#ef4444", borderLeftWidth: 4 }]}>
                  <Text style={styles.kpiValue}>{loading ? "..." : blockedUsersCount}</Text>
                  <Text style={styles.kpiLabel}>Blocked Users</Text>
                </View>
              </ScrollView>

              {/* 2. Search Bar */}
              <View style={styles.searchBar}>
                <Ionicons name="search" size={20} color="#94a3b8" style={{ marginRight: 8 }} />
                <TextInput
                  placeholder="Search by name, email, phone..."
                  placeholderTextColor="#94a3b8"
                  value={search}
                  onChangeText={setSearch}
                  style={styles.searchInput}
                />
                {search ? (
                  <TouchableOpacity onPress={() => setSearch("")}>
                    <Ionicons name="close-circle" size={18} color="#94a3b8" />
                  </TouchableOpacity>
                ) : null}
              </View>

              {/* 3. Filter Chips */}
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.filterPillsBar}
                contentContainerStyle={styles.filterPillsScroll}
              >
                {(["All", "Active", "Blocked", "New", "Verified"] as const).map((type) => {
                  const isSel = filterType === type;
                  return (
                    <TouchableOpacity
                      key={type}
                      style={[styles.filterPill, isSel && styles.filterPillActive]}
                      onPress={() => handleFilterChange(type)}
                      activeOpacity={0.8}
                    >
                      <Text style={[styles.filterPillText, isSel && styles.filterPillTextActive]}>{type}</Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              {/* 4. Sort Section */}
              <View style={styles.sortBar}>
                <Text style={styles.sortLabel}>Sort By:</Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.sortScrollContent}
                >
                  {(["Joined", "Orders", "Spent"] as const).map((sort) => {
                    const isSel = sortBy === sort;
                    return (
                      <TouchableOpacity key={sort} onPress={() => setSortBy(sort)} style={styles.sortToggleBtn} activeOpacity={0.7}>
                        <Text style={[styles.sortToggleText, isSel && styles.sortToggleTextActive]}>
                          {sort === "Joined" ? "Date Joined" : sort === "Orders" ? "Orders Count" : "Total Spent"}
                        </Text>
                        {isSel && <View style={styles.sortDot} />}
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>
            </View>
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyIcon}>👤</Text>
              <Text style={styles.emptyTitle}>not user found</Text>
              <Text style={styles.emptySub}>No users found in this category.</Text>
            </View>
          }
        />
      )}

      {/* ─── ACTION OPTIONS MENU MODAL ─────────────────────────────────────── */}
      <Modal visible={menuVisible} transparent animationType="slide" onRequestClose={() => setMenuVisible(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setMenuVisible(false)}>
          <View style={[styles.menuSheet, { paddingBottom: Math.max(insets.bottom, 20) }]}>
            <View style={styles.sheetHeaderBar} />
            <Text style={styles.menuSheetTitle}>
              {selectedUser?.name || "Customer Actions"}
            </Text>
            
            <TouchableOpacity style={styles.menuItem} onPress={handleViewProfile}>
              <Ionicons name="person-outline" size={20} color={Theme.colors.primaryDark} />
              <Text style={styles.menuItemText}>View Profile</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => {
                setMenuVisible(false);
                router.push(`/admin/orders?userId=${selectedUser?.uid}`);
              }}
            >
              <Ionicons name="receipt-outline" size={20} color={Theme.colors.primaryDark} />
              <Text style={styles.menuItemText}>View Orders</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.menuItem} onPress={handleEditUser}>
              <Ionicons name="create-outline" size={20} color={Theme.colors.primaryDark} />
              <Text style={styles.menuItemText}>Edit User Details</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.menuItem} onPress={handleToggleBlock}>
              <Ionicons
                name={selectedUser?.isBlocked ? "lock-open-outline" : "lock-closed-outline"}
                size={20}
                color={selectedUser?.isBlocked ? "#10b981" : "#ef4444"}
              />
              <Text style={[styles.menuItemText, selectedUser?.isBlocked ? { color: "#10b981" } : { color: "#ef4444" }]}>
                {selectedUser?.isBlocked ? "Unblock Account" : "Block User Account"}
              </Text>
            </TouchableOpacity>

            <View style={styles.dividerLine} />

            <TouchableOpacity style={styles.menuItem} onPress={handleDeleteUser}>
              <Ionicons name="trash-outline" size={20} color="#ef4444" />
              <Text style={[styles.menuItemText, { color: "#ef4444" }]}>Delete User</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* ─── USER PROFILE DETAILED MODAL ──────────────────────────────────── */}
      <Modal visible={profileModalVisible} animationType="slide" onRequestClose={() => setProfileModalVisible(false)}>
        {selectedUser && (
          <View style={{ flex: 1, backgroundColor: "#f8fafc" }}>
            {/* Header */}
            <View style={[styles.profileHeader, { paddingTop: insets.top + 8 }]}>
              <TouchableOpacity style={styles.profileCloseBtn} onPress={() => setProfileModalVisible(false)}>
                <Ionicons name="close" size={24} color="#334155" />
              </TouchableOpacity>
              <Text style={styles.profileHeaderTitle}>User Profile</Text>
              <View style={{ width: 40 }} />
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[styles.profileScroll, { paddingBottom: insets.bottom + 40 }]}>
              {/* Profile card summary */}
              <View style={styles.profileCard}>
                <View style={styles.profileAvatarRow}>
                  {selectedUser.photoUrl ? (
                    <Image source={{ uri: selectedUser.photoUrl }} style={styles.profileAvatarLarge} contentFit="cover" />
                  ) : (
                    <View style={styles.profileAvatarLargeFallback}>
                      <Text style={styles.profileAvatarLargeText}>{getInitials(selectedUser.name)}</Text>
                    </View>
                  )}
                  <View style={{ flex: 1 }}>
                    <Text style={styles.profileName}>{selectedUser.name || "Customer"}</Text>
                    <Text style={styles.profileEmail}>{selectedUser.email}</Text>
                    <Text style={styles.profilePhone}>📞 {selectedUser.mobile || selectedUser.phone || "No phone added"}</Text>
                  </View>
                </View>

                <View style={styles.dividerLine} />

                {/* Additional Info block */}
                <View style={{ gap: 8, paddingVertical: 8 }}>
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>User UID:</Text>
                    <Text style={styles.infoValue} numberOfLines={1}>{selectedUser.uid}</Text>
                  </View>
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Date Joined:</Text>
                    <Text style={styles.infoValue}>{formatDate(selectedUser.createdAt || selectedUser.joinedAt)}</Text>
                  </View>
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Last Login:</Text>
                    <Text style={styles.infoValue}>{formatDate(selectedUser.lastLogin)}</Text>
                  </View>
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Gender:</Text>
                    <Text style={styles.infoValue}>{(selectedUser as any).gender || "Not specified"}</Text>
                  </View>
                </View>
              </View>

              {/* Order Stats KPI block */}
              <Text style={styles.profileSecTitle}>Purchase Statistics</Text>
              <View style={styles.statsGrid}>
                <View style={styles.statCard}>
                  <Text style={styles.statVal}>{userOrderStats(selectedUser.uid).total}</Text>
                  <Text style={styles.statLbl}>Total Orders</Text>
                </View>
                <View style={styles.statCard}>
                  <Text style={styles.statVal}>{userOrderStats(selectedUser.uid).delivered}</Text>
                  <Text style={styles.statLbl}>Delivered</Text>
                </View>
                <View style={styles.statCard}>
                  <Text style={styles.statVal}>{userOrderStats(selectedUser.uid).cancelled}</Text>
                  <Text style={styles.statLbl}>Cancelled</Text>
                </View>
                <View style={styles.statCard}>
                  <Text style={styles.statVal}>Rs. {userOrderStats(selectedUser.uid).spent}</Text>
                  <Text style={styles.statLbl}>Total Spend</Text>
                </View>
              </View>

              {/* Saved Addresses list */}
              <Text style={styles.profileSecTitle}>Saved Addresses</Text>
              {selectedUser.addresses && selectedUser.addresses.length > 0 ? (
                selectedUser.addresses.map((addr, idx) => (
                  <View key={idx} style={styles.addressCard}>
                    <View style={styles.addressTitleRow}>
                      <Ionicons
                        name={addr.type === "Home" ? "home-outline" : addr.type === "Work" ? "briefcase-outline" : "location-outline"}
                        size={16}
                        color={Theme.colors.primary}
                      />
                      <Text style={styles.addressType}>{addr.type || "Other Address"}</Text>
                    </View>
                    <Text style={styles.addressValueText}>{addr.address}</Text>
                    <Text style={styles.addressSubText}>
                      {addr.city}, {addr.state} - {addr.pincode}
                    </Text>
                  </View>
                ))
              ) : (
                <View style={styles.emptySubBox}>
                  <Text style={styles.emptySubBoxText}>No saved delivery addresses found.</Text>
                </View>
              )}

              {/* Recent Orders List */}
              <Text style={styles.profileSecTitle}>Recent Orders</Text>
              {userOrderStats(selectedUser.uid).recent.length > 0 ? (
                userOrderStats(selectedUser.uid).recent.map((ord) => (
                  <View key={ord.orderId} style={styles.recentOrderCard}>
                    <View style={styles.recentOrderHeader}>
                      <Text style={styles.recentOrderId} numberOfLines={1}>#{ord.orderId.toUpperCase()}</Text>
                      <View style={[styles.statusBadge, ord.status === "Delivered" ? styles.badgeActive : ord.status === "Cancelled" ? styles.badgeBlocked : styles.badgeVerified]}>
                        <Text style={ord.status === "Delivered" ? styles.badgeActiveText : ord.status === "Cancelled" ? styles.badgeBlockedText : styles.badgeVerifiedText}>{ord.status}</Text>
                      </View>
                    </View>
                    <View style={styles.recentOrderDetails}>
                      <Text style={styles.recentOrderMeta}>{formatDate(ord.createdAt)} • Rs. {ord.totalAmount}</Text>
                      <TouchableOpacity
                        style={styles.viewDetailsBtn}
                        onPress={() => {
                          setProfileModalVisible(false);
                          router.push(`/admin/orders?orderId=${ord.orderId}`);
                        }}
                      >
                        <Text style={styles.viewDetailsBtnText}>Details</Text>
                        <Ionicons name="arrow-forward" size={10} color={Theme.colors.primary} />
                      </TouchableOpacity>
                    </View>
                  </View>
                ))
              ) : (
                <View style={styles.emptySubBox}>
                  <Text style={styles.emptySubBoxText}>No transaction records available.</Text>
                </View>
              )}
            </ScrollView>
          </View>
        )}
      </Modal>

      {/* ─── EDIT USER MODAL FORM ─────────────────────────────────────────── */}
      <Modal visible={editModalVisible} animationType="slide" onRequestClose={() => setEditModalVisible(false)}>
        <View style={{ flex: 1, backgroundColor: "#f8fafc" }}>
          {/* Header */}
          <View style={[styles.profileHeader, { paddingTop: insets.top + 8 }]}>
            <TouchableOpacity style={styles.profileCloseBtn} onPress={() => setEditModalVisible(false)}>
              <Ionicons name="close" size={24} color="#334155" />
            </TouchableOpacity>
            <Text style={styles.profileHeaderTitle}>Edit User Profile</Text>
            <View style={{ width: 40 }} />
          </View>

          <ScrollView contentContainerStyle={styles.formScroll} keyboardShouldPersistTaps="handled">
            <View style={styles.formCard}>
              {/* Photo selector */}
              <Text style={styles.inputLabel}>Profile Photo</Text>
              <View style={styles.photoPickerRow}>
                {editPhoto ? (
                  <Image source={{ uri: editPhoto }} style={styles.pickerAvatarImage} contentFit="cover" />
                ) : (
                  <View style={[styles.pickerAvatarFallback, { backgroundColor: Theme.colors.primary + "10" }]}>
                    <Ionicons name="person" size={32} color={Theme.colors.primary} />
                  </View>
                )}
                <TouchableOpacity style={styles.photoSelectBtn} onPress={handlePickEditImage}>
                  <Ionicons name="camera" size={16} color="#ffffff" style={{ marginRight: 4 }} />
                  <Text style={styles.photoSelectText}>Choose Photo</Text>
                </TouchableOpacity>
              </View>

              {/* Form Input fields */}
              <Text style={styles.inputLabel}>Full Name</Text>
              <TextInput
                value={editName}
                onChangeText={setEditName}
                placeholder="Enter customer name"
                placeholderTextColor="#94a3b8"
                style={styles.textInputField}
              />

              <Text style={styles.inputLabel}>Phone Number</Text>
              <TextInput
                value={editPhone}
                onChangeText={setEditPhone}
                placeholder="Enter mobile number"
                placeholderTextColor="#94a3b8"
                keyboardType="phone-pad"
                style={styles.textInputField}
              />

              {/* Read Only inputs */}
              <Text style={styles.inputLabel}>Email Address (Read-only)</Text>
              <View style={styles.readOnlyBox}>
                <Text style={styles.readOnlyText}>{selectedUser?.email}</Text>
              </View>

              <Text style={styles.inputLabel}>User UID (Read-only)</Text>
              <View style={styles.readOnlyBox}>
                <Text style={styles.readOnlyText}>{selectedUser?.uid}</Text>
              </View>

              {/* Account status toggle */}
              <Text style={styles.inputLabel}>Account Status</Text>
              <TouchableOpacity
                style={[styles.statusToggleBox, editBlocked && { borderColor: "#ef4444", backgroundColor: "#fef2f2" }]}
                onPress={() => setEditBlocked((prev) => !prev)}
                activeOpacity={0.8}
              >
                <Ionicons
                  name={editBlocked ? "lock-closed-outline" : "lock-open-outline"}
                  size={18}
                  color={editBlocked ? "#ef4444" : "#10b981"}
                />
                <Text style={[styles.statusToggleText, { color: editBlocked ? "#ef4444" : "#10b981" }]}>
                  {editBlocked ? "Account Blocked" : "Account Active"}
                </Text>
                <View style={{ flex: 1 }} />
                <Text style={{ fontSize: 11, fontWeight: "600", color: "#64748b" }}>Tap to toggle</Text>
              </TouchableOpacity>
            </View>

            {/* Save Buttons */}
            <TouchableOpacity style={styles.saveSubmitBtn} onPress={handleSaveUserEdit} disabled={editSaving}>
              {editSaving ? (
                <ActivityIndicator color="#ffffff" size="small" />
              ) : (
                <>
                  <Ionicons name="checkmark-circle-outline" size={20} color="#ffffff" style={{ marginRight: 6 }} />
                  <Text style={styles.saveSubmitText}>Save Changes</Text>
                </>
              )}
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>

      {/* Drawer */}
      <AdminDrawer visible={drawerOpen} onClose={() => setDrawerOpen(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
  header: {
    backgroundColor: Theme.colors.primary,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    justifyContent: "space-between",
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.1)",
  },
  menuBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "rgba(255, 255, 255, 0.15)",
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#ffffff",
    textAlign: "center",
  },
  headerSubtitle: {
    fontSize: 11,
    color: "#d1fae5",
    fontWeight: "500",
    marginTop: 1,
    textAlign: "center",
  },
  headerComponentContainer: {
    backgroundColor: "#f8fafc",
  },

  // KPI Analytics widget style
  kpiContainer: {
    height: 85,
    marginTop: 16,
    marginBottom: 20,
  },
  kpiScroll: {
    paddingHorizontal: 20,
    gap: 12,
  },
  kpiCard: {
    width: 130,
    height: 85,
    backgroundColor: "#ffffff",
    borderRadius: 18,
    padding: 12,
    borderLeftWidth: 4,
    borderLeftColor: Theme.colors.primary,
    justifyContent: "center",
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  kpiValue: {
    fontSize: 16,
    fontWeight: "900",
    color: "#1e293b",
  },
  kpiLabel: {
    fontSize: 10,
    fontWeight: "600",
    color: "#64748b",
    marginTop: 3,
  },

  // Search Bar style
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderRadius: 16,
    paddingHorizontal: 16,
    height: 54,
    marginHorizontal: 20,
    marginVertical: 16,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.02,
    shadowRadius: 4,
    elevation: 1,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: "#1e293b",
    fontWeight: "500",
    outlineStyle: "none",
  } as any,

  // Filter Chips style
  filterPillsBar: {
    height: 40,
    marginBottom: 16,
  },
  filterPillsScroll: {
    paddingHorizontal: 20,
    gap: 12,
  },
  filterPill: {
    height: 40,
    paddingHorizontal: 20,
    borderRadius: 20,
    backgroundColor: "#e2e8f0",
    justifyContent: "center",
    alignItems: "center",
  },
  filterPillActive: {
    backgroundColor: "#10b981", // Green theme active chip
  },
  filterPillText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#334155",
  },
  filterPillTextActive: {
    color: "#ffffff",
  },

  // Sort bar style
  sortBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    marginBottom: 20,
    gap: 10,
  },
  sortLabel: {
    fontSize: 12,
    fontWeight: "800",
    color: "#64748b",
    textTransform: "uppercase",
  },
  sortScrollContent: {
    gap: 12,
    alignItems: "center",
  },
  sortToggleBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 4,
  },
  sortToggleText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#94a3b8",
  },
  sortToggleTextActive: {
    color: Theme.colors.primary,
  },
  sortDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: Theme.colors.primary,
  },

  // List Cards style
  list: {
    paddingHorizontal: 20,
  },
  card: {
    flexDirection: "row",
    backgroundColor: "#ffffff",
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: "#f1f5f9",
    position: "relative",
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.03,
    shadowRadius: 8,
    elevation: 2,
  },
  avatarContainer: {
    width: 46,
    height: 46,
    borderRadius: 14,
    overflow: "hidden",
    marginRight: 12,
  },
  avatarImage: {
    width: "100%",
    height: "100%",
  },
  avatarFallback: {
    width: "100%",
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
  },
  avatarText: {
    fontSize: 16,
    fontWeight: "800",
  },
  cardInfo: {
    flex: 1,
    paddingRight: 16,
  },
  cardHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 6,
  },
  cardName: {
    fontSize: 14,
    fontWeight: "800",
    color: "#1e293b",
    flex: 1,
  },
  badgeRow: {
    flexDirection: "row",
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  badgeActive: {
    backgroundColor: "#dcfce7",
  },
  badgeActiveText: {
    fontSize: 9,
    fontWeight: "800",
    color: "#16a34a",
  },
  badgeBlocked: {
    backgroundColor: "#fef2f2",
  },
  badgeBlockedText: {
    fontSize: 9,
    fontWeight: "800",
    color: "#ef4444",
  },
  badgeVerified: {
    backgroundColor: "#dbeafe",
  },
  badgeVerifiedText: {
    fontSize: 9,
    fontWeight: "800",
    color: "#2563eb",
  },
  cardEmail: {
    fontSize: 11,
    color: "#64748b",
    marginTop: 2,
  },
  cardPhone: {
    fontSize: 11,
    color: "#64748b",
    marginTop: 2,
  },
  dividerLine: {
    height: 1,
    backgroundColor: "#f1f5f9",
    marginVertical: 10,
  },
  cardMetaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 4,
  },
  cardMetaBox: {
    flex: 1,
  },
  metaLabel: {
    fontSize: 9,
    fontWeight: "600",
    color: "#94a3b8",
    textTransform: "uppercase",
  },
  metaValue: {
    fontSize: 11,
    fontWeight: "800",
    color: "#475569",
    marginTop: 1,
  },
  optionsBtn: {
    position: "absolute",
    top: 14,
    right: 8,
    padding: 8,
  },

  // Skeletons
  shimmerAvatar: {
    width: 46,
    height: 46,
    borderRadius: 14,
    backgroundColor: "#e2e8f0",
    marginRight: 12,
  },
  shimmerTitle: {
    width: "60%",
    height: 14,
    borderRadius: 4,
    backgroundColor: "#e2e8f0",
  },
  shimmerSub: {
    width: "80%",
    height: 11,
    borderRadius: 4,
    backgroundColor: "#e2e8f0",
  },

  // Empty layout
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 40,
    gap: 8,
    marginTop: 30,
  },
  emptyIcon: {
    fontSize: 54,
    marginBottom: 6,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#1e293b",
  },
  emptySub: {
    fontSize: 12,
    color: "#64748b",
    textAlign: "center",
  },

  // Modal actions menu sheet
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.4)",
    justifyContent: "flex-end",
  },
  menuSheet: {
    backgroundColor: "#ffffff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  sheetHeaderBar: {
    width: 44,
    height: 5,
    borderRadius: 3,
    backgroundColor: "#cbd5e1",
    alignSelf: "center",
    marginBottom: 16,
  },
  menuSheetTitle: {
    fontSize: 15,
    fontWeight: "900",
    color: "#1e293b",
    textAlign: "center",
    marginBottom: 16,
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    gap: 12,
  },
  menuItemText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#334155",
  },

  // User Profile Screen Modal styles
  profileHeader: {
    backgroundColor: "#ffffff",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderColor: "#f1f5f9",
  },
  profileCloseBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#f1f5f9",
    justifyContent: "center",
    alignItems: "center",
  },
  profileHeaderTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#1e293b",
  },
  profileScroll: {
    padding: 20,
  },
  profileCard: {
    backgroundColor: "#ffffff",
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: "#f1f5f9",
  },
  profileAvatarRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  profileAvatarLarge: {
    width: 64,
    height: 64,
    borderRadius: 20,
  },
  profileAvatarLargeFallback: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: Theme.colors.primary + "15",
    justifyContent: "center",
    alignItems: "center",
  },
  profileAvatarLargeText: {
    fontSize: 22,
    fontWeight: "800",
    color: Theme.colors.primary,
  },
  profileName: {
    fontSize: 17,
    fontWeight: "900",
    color: "#1e293b",
  },
  profileEmail: {
    fontSize: 12,
    color: "#64748b",
    marginTop: 2,
  },
  profilePhone: {
    fontSize: 12,
    color: "#64748b",
    marginTop: 2,
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  infoLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "#94a3b8",
    textTransform: "uppercase",
  },
  infoValue: {
    fontSize: 12,
    fontWeight: "750",
    color: "#334155",
    maxWidth: "60%",
  },
  profileSecTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: "#64748b",
    textTransform: "uppercase",
    marginTop: 24,
    marginBottom: 10,
  },

  // Stats Grid Profile
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    rowGap: 12,
  },
  statCard: {
    width: "48%",
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: "#f1f5f9",
    alignItems: "center",
  },
  statVal: {
    fontSize: 16,
    fontWeight: "900",
    color: Theme.colors.primaryDark,
  },
  statLbl: {
    fontSize: 10,
    fontWeight: "600",
    color: "#94a3b8",
    marginTop: 2,
  },

  // Saved addresses Profile
  addressCard: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: "#f1f5f9",
    marginBottom: 8,
  },
  addressTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 6,
  },
  addressType: {
    fontSize: 12,
    fontWeight: "800",
    color: "#1e293b",
  },
  addressValueText: {
    fontSize: 12,
    color: "#475569",
    lineHeight: 16,
    fontWeight: "500",
  },
  addressSubText: {
    fontSize: 11,
    color: "#94a3b8",
    marginTop: 4,
    fontWeight: "600",
  },
  emptySubBox: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 16,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#f1f5f9",
  },
  emptySubBoxText: {
    fontSize: 11,
    color: "#94a3b8",
    fontWeight: "600",
  },

  // Recent orders list Profile
  recentOrderCard: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: "#f1f5f9",
    marginBottom: 8,
  },
  recentOrderHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  recentOrderId: {
    fontSize: 12,
    fontWeight: "850",
    color: "#1e293b",
  },
  recentOrderDetails: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 6,
  },
  recentOrderMeta: {
    fontSize: 11,
    color: "#64748b",
    fontWeight: "600",
  },
  viewDetailsBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  viewDetailsBtnText: {
    fontSize: 11,
    fontWeight: "800",
    color: Theme.colors.primary,
  },

  // Edit User Form styles
  formScroll: {
    padding: 20,
  },
  formCard: {
    backgroundColor: "#ffffff",
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: "#f1f5f9",
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: "800",
    color: "#64748b",
    textTransform: "uppercase",
    marginTop: 14,
    marginBottom: 6,
  },
  photoPickerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 8,
  },
  pickerAvatarImage: {
    width: 60,
    height: 60,
    borderRadius: 18,
  },
  pickerAvatarFallback: {
    width: 60,
    height: 60,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
  },
  photoSelectBtn: {
    backgroundColor: Theme.colors.primary,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
  },
  photoSelectText: {
    color: "#ffffff",
    fontSize: 11,
    fontWeight: "800",
  },
  textInputField: {
    height: 44,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    paddingHorizontal: 12,
    fontSize: 13,
    color: "#334155",
    fontWeight: "500",
    outlineStyle: "none",
  } as any,
  readOnlyBox: {
    height: 44,
    borderRadius: 10,
    backgroundColor: "#f1f5f9",
    justifyContent: "center",
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: "#cbd5e1",
  },
  readOnlyText: {
    fontSize: 13,
    color: "#64748b",
    fontWeight: "600",
  },
  statusToggleBox: {
    flexDirection: "row",
    alignItems: "center",
    height: 44,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: "#bbf7d0",
    backgroundColor: "#f0fdf4",
    paddingHorizontal: 12,
    gap: 8,
  },
  statusToggleText: {
    fontSize: 13,
    fontWeight: "800",
  },
  saveSubmitBtn: {
    backgroundColor: Theme.colors.primary,
    height: 50,
    borderRadius: 14,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 20,
    shadowColor: Theme.colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 3,
  },
  saveSubmitText: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "800",
  },
});
