import React, { useEffect, useState } from "react";
import {
  Text,
  View,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  StatusBar,
  Alert,
  ActivityIndicator,
  SafeAreaView,
  Platform,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { authStore, Address } from "../services/authStore";
import { Theme, shadowStyle } from "../constants/theme";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function SelectAddressScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(authStore.getSelectedAddressId());
  const [isLoading, setIsLoading] = useState(true);

  // Subscribe to real-time address updates from Firestore
  useEffect(() => {
    setIsLoading(true);
    const unsubscribe = authStore.subscribeAddresses(
      (list) => {
        setAddresses(list);
        setIsLoading(false);
        
        // Auto-select default address if none is currently selected
        if (!selectedId && list.length > 0) {
          const defaultAddress = list.find((addr) => addr.isDefault) || list[0];
          setSelectedId(defaultAddress.addressId);
          authStore.setSelectedAddressId(defaultAddress.addressId);
          authStore.setSelectedAddress(defaultAddress);
        }
      },
      (error) => {
        console.error("Failed to load addresses:", error);
        setIsLoading(false);
      }
    );
    return () => unsubscribe();
  }, []);

  const handleSelectAddress = (address: Address) => {
    setSelectedId(address.addressId);
    authStore.setSelectedAddressId(address.addressId);
    authStore.setSelectedAddress(address);
    // Auto return to cart/checkout upon selection
    router.back();
  };

  const handleEditAddress = (addressId: string) => {
    router.push({
      pathname: "/add-address",
      params: { addressId },
    } as any);
  };

  const handleDeleteAddress = (addressId: string) => {
    Alert.alert(
      "Delete Address",
      "Are you sure you want to permanently delete this delivery address?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await authStore.deleteAddress(addressId);
              // If deleted address was selected, clear store selection
              if (selectedId === addressId) {
                setSelectedId(null);
                authStore.setSelectedAddressId(null);
                authStore.setSelectedAddress(null);
              }
              if (Platform.OS === "web") {
                window.alert("Address deleted successfully.");
              }
            } catch (err: any) {
              Alert.alert("Error", err.message || "Failed to delete address.");
            }
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      
      {/* Header */}
      <View style={[styles.header, { paddingTop: Platform.OS === "ios" ? 10 : insets.top + 10 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={24} color={Theme.colors.textDark} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Select Delivery Address</Text>
        <View style={styles.headerSpacer} />
      </View>

      {/* Main content list */}
      {isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={Theme.colors.primary} />
          <Text style={styles.loadingText}>Fetching saved addresses...</Text>
        </View>
      ) : addresses.length === 0 ? (
        <ScrollView contentContainerStyle={styles.emptyContainer}>
          <View style={styles.emptyIconCircle}>
            <Ionicons name="location-outline" size={48} color={Theme.colors.primary} />
          </View>
          <Text style={styles.emptyTitle}>No Saved Addresses</Text>
          <Text style={styles.emptySubtitle}>
            Please add a delivery address to complete your checkout flow and receive orders.
          </Text>
          <TouchableOpacity
            style={styles.emptyAddButton}
            onPress={() => router.push("/add-address" as any)}
          >
            <Ionicons name="add" size={20} color="#FFFFFF" style={{ marginRight: 6 }} />
            <Text style={styles.emptyAddButtonText}>Add First Address</Text>
          </TouchableOpacity>
        </ScrollView>
      ) : (
        <ScrollView contentContainerStyle={styles.scrollList} showsVerticalScrollIndicator={false}>
          <Text style={styles.sectionHeader}>SAVED ADDRESSES</Text>
          {addresses.map((addr) => {
            const isSelected = selectedId === addr.addressId;
            return (
              <TouchableOpacity
                key={addr.addressId}
                activeOpacity={0.9}
                style={[
                  styles.card,
                  isSelected && styles.selectedCard,
                ]}
                onPress={() => handleSelectAddress(addr)}
              >
                {/* Radio and Address Type Badge */}
                <View style={styles.cardHeader}>
                  <View style={styles.radioContainer}>
                    <Ionicons
                      name={isSelected ? "radio-button-on" : "radio-button-off"}
                      size={22}
                      color={isSelected ? Theme.colors.primary : Theme.colors.textLight}
                    />
                    <Text style={[styles.addressName, isSelected && styles.selectedText]}>
                      {addr.fullName}
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.badge,
                      addr.addressType === "Home"
                        ? styles.homeBadge
                        : addr.addressType === "Work"
                        ? styles.workBadge
                        : styles.otherBadge,
                    ]}
                  >
                    <Text
                      style={[
                        styles.badgeText,
                        addr.addressType === "Home"
                          ? styles.homeBadgeText
                          : addr.addressType === "Work"
                          ? styles.workBadgeText
                          : styles.otherBadgeText,
                      ]}
                    >
                      {addr.addressType}
                    </Text>
                  </View>
                </View>

                {/* Full Address Details */}
                <View style={styles.cardBody}>
                  <Text style={styles.addressText} numberOfLines={3}>
                    {addr.houseNo}, {addr.building ? `${addr.building}, ` : ""}{addr.street}
                    {addr.landmark ? `\nLandmark: ${addr.landmark}` : ""}
                    {"\n"}{addr.city}, {addr.state} - {addr.pinCode}
                  </Text>
                  <Text style={styles.mobileText}>
                    <Ionicons name="call-outline" size={12} color={Theme.colors.textMedium} />
                    {" "}{addr.mobile}
                  </Text>
                </View>

                {/* Card Actions Footer */}
                <View style={styles.cardFooter}>
                  {addr.isDefault && (
                    <Text style={styles.defaultLabel}>
                      <Ionicons name="checkmark-circle-outline" size={13} color={Theme.colors.primary} />
                      {" "}Default Delivery
                    </Text>
                  )}
                  <View style={{ flex: 1 }} />
                  <TouchableOpacity
                    style={styles.actionBtn}
                    onPress={() => handleEditAddress(addr.addressId)}
                  >
                    <Ionicons name="create-outline" size={18} color={Theme.colors.textMedium} />
                    <Text style={styles.actionBtnText}>Edit</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.actionBtn, { marginLeft: 16 }]}
                    onPress={() => handleDeleteAddress(addr.addressId)}
                  >
                    <Ionicons name="trash-outline" size={18} color={Theme.colors.error} />
                    <Text style={[styles.actionBtnText, { color: Theme.colors.error }]}>Delete</Text>
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}

      {/* Fixed bottom floating action button */}
      {addresses.length > 0 && (
        <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, 16) }]}>
          <TouchableOpacity
            style={styles.addButton}
            activeOpacity={0.85}
            onPress={() => router.push("/add-address" as any)}
          >
            <Ionicons name="add" size={22} color="#FFFFFF" style={{ marginRight: 6 }} />
            <Text style={styles.addButtonText}>Add New Address</Text>
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 16,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderColor: "#E2E8F0",
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F1F5F9",
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: Theme.colors.textDark,
  },
  headerSpacer: {
    width: 36,
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: Theme.colors.textMedium,
  },
  emptyContainer: {
    flexGrow: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
    paddingBottom: 80,
  },
  emptyIconCircle: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: "#E6F4EA",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: Theme.colors.textDark,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: Theme.colors.textMedium,
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 24,
  },
  emptyAddButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Theme.colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 14,
    ...shadowStyle("#2a5d4c", 4, 0.2, 8, 3),
  },
  emptyAddButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
  },
  scrollList: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 100,
  },
  sectionHeader: {
    fontSize: 11,
    fontWeight: "800",
    color: Theme.colors.textLight,
    letterSpacing: 1,
    marginBottom: 12,
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1.5,
    borderColor: "#E2E8F0",
    ...shadowStyle("#0F172A", 2, 0.03, 6, 2),
  },
  selectedCard: {
    borderColor: Theme.colors.primary,
    backgroundColor: "#FAFDFB",
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  radioContainer: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  addressName: {
    fontSize: 15,
    fontWeight: "700",
    color: Theme.colors.textDark,
    marginLeft: 10,
  },
  selectedText: {
    color: Theme.colors.primary,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: "800",
  },
  homeBadge: {
    backgroundColor: "#E6F4EA",
  },
  homeBadgeText: {
    color: "#137333",
  },
  workBadge: {
    backgroundColor: "#E8F0FE",
  },
  workBadgeText: {
    color: "#1A73E8",
  },
  otherBadge: {
    backgroundColor: "#F1F5F9",
  },
  otherBadgeText: {
    color: "#475569",
  },
  cardBody: {
    paddingLeft: 32,
    marginBottom: 14,
  },
  addressText: {
    fontSize: 13,
    color: Theme.colors.textMedium,
    lineHeight: 18,
    marginBottom: 6,
  },
  mobileText: {
    fontSize: 13,
    fontWeight: "600",
    color: Theme.colors.textDark,
  },
  cardFooter: {
    flexDirection: "row",
    alignItems: "center",
    paddingTop: 12,
    borderTopWidth: 1,
    borderColor: "#F1F5F9",
    paddingLeft: 32,
  },
  defaultLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: Theme.colors.primary,
  },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 4,
  },
  actionBtnText: {
    fontSize: 12,
    fontWeight: "700",
    color: Theme.colors.textMedium,
    marginLeft: 4,
  },
  bottomBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "rgba(255, 255, 255, 0.95)",
    borderTopWidth: 1,
    borderColor: "#E2E8F0",
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  addButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Theme.colors.primary,
    height: 48,
    borderRadius: 14,
    ...shadowStyle("#2a5d4c", 4, 0.2, 8, 3),
  },
  addButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
  },
});
