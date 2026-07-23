import React, { useState, useCallback, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  StatusBar,
  ActivityIndicator,
  FlatList,
  Alert,
  Platform,
  Modal,
  TextInput,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter, useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Image } from "expo-image";
import { Theme } from "../../constants/theme";
import { authStore } from "../../services/authStore";
import ChatbotModal from "../../components/ChatbotModal";

export default function OrdersScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  // Primary state
  const [orders, setOrders] = useState<any[]>([]);
  const [filteredOrders, setFilteredOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState("All"); // All, On the way, Delivered, Returned
  const [selectedDuration, setSelectedDuration] = useState("Any Time"); // Any Time, Last 30 days, Last 6 months, Last Year

  // Address edit modal state
  const [addressModalVisible, setAddressModalVisible] = useState(false);
  const [selectedOrderForAddress, setSelectedOrderForAddress] = useState<any | null>(null);
  const [newAddress, setNewAddress] = useState("");

  // Price Details bottom sheet state
  const [priceDetailsVisible, setPriceDetailsVisible] = useState(false);
  const [selectedOrderForPrice, setSelectedOrderForPrice] = useState<any | null>(null);

  // Invoice generator state
  const [invoiceDownloading, setInvoiceDownloading] = useState(false);
  const [invoiceModalVisible, setInvoiceModalVisible] = useState(false);
  const [selectedOrderForInvoice, setSelectedOrderForInvoice] = useState<any | null>(null);
  const [invoiceChoiceVisible, setInvoiceChoiceVisible] = useState(false);
  const [invoiceSendingEmail, setInvoiceSendingEmail] = useState(false);

  // Support Chatbot state
  const [chatbotVisible, setChatbotVisible] = useState(false);
  const [chatbotOrderContext, setChatbotOrderContext] = useState<any | null>(null);

  // Ref to always have the latest raw orders for in-memory filtering without
  // needing to re-create the Firestore listener when search/filter state changes.
  const allOrdersRef = useRef<any[]>([]);

  // Keep latest filter values in refs so the empty-dep useFocusEffect callback
  // can always read current values without going stale.
  const searchQueryRef = useRef(searchQuery);
  const selectedStatusRef = useRef(selectedStatus);
  const selectedDurationRef = useRef(selectedDuration);
  searchQueryRef.current = searchQuery;
  selectedStatusRef.current = selectedStatus;
  selectedDurationRef.current = selectedDuration;

  // In-memory filter helper — pure function, no Firestore reads.
  const applyFiltersInMemory = useCallback((
    allOrders: any[],
    queryText: string,
    statusFilter: string,
    durationFilter: string
  ) => {
    let result = [...allOrders];

    // 1. Search Query filter
    if (queryText.trim()) {
      const q = queryText.toLowerCase().trim();
      result = result.filter(
        (o) =>
          o.orderId.toLowerCase().includes(q) ||
          o.items.some((item: any) => item.name.toLowerCase().includes(q))
      );
    }

    // 2. Status Filter
    if (statusFilter !== "All") {
      result = result.filter((o) => {
        const orderStatus = (o.status || "").toLowerCase();
        if (statusFilter === "On the way") {
          return (
            orderStatus === "placed" ||
            orderStatus === "preparing to pack" ||
            orderStatus === "package in transit" ||
            orderStatus === "out for delivery" ||
            orderStatus === "shipped" ||
            orderStatus === "transit" ||
            orderStatus === "processing"
          );
        } else if (statusFilter === "Delivered") {
          return orderStatus === "delivered";
        } else if (statusFilter === "Returned") {
          return orderStatus === "returned";
        }
        return true;
      });
    }

    // 3. Duration Filter
    if (durationFilter !== "Any Time") {
      const now = Date.now();
      let limitMs = 0;

      if (durationFilter === "Last 30 days") {
        limitMs = 30 * 24 * 60 * 60 * 1000;
      } else if (durationFilter === "Last 6 months") {
        limitMs = 180 * 24 * 60 * 60 * 1000;
      } else if (durationFilter === "Last Year") {
        limitMs = 365 * 24 * 60 * 60 * 1000;
      }

      const cutOffDate = now - limitMs;
      result = result.filter((o) => new Date(o.createdAt).getTime() >= cutOffDate);
    }

    setFilteredOrders(result);
  }, []);

  // Re-apply in-memory filters whenever search/filter state changes.
  // This does NOT touch Firestore — it only slices allOrdersRef.current.
  useEffect(() => {
    applyFiltersInMemory(allOrdersRef.current, searchQuery, selectedStatus, selectedDuration);
  }, [searchQuery, selectedStatus, selectedDuration, applyFiltersInMemory]);

  // FIX: The Firestore listener is created exactly ONCE per focus event.
  // Deps array is intentionally empty — search/filter state must NOT be deps
  // here because that would destroy and recreate the listener on every keystroke,
  // rapidly exhausting Firestore's open-listener quota.
  useFocusEffect(
    useCallback(() => {
      console.log("[LISTENER:CREATE] subscribeUserOrders");
      setLoading(true);
      const unsubscribe = authStore.subscribeUserOrders(
        (data) => {
          // Store raw orders in ref so the filter effect can always access the full dataset
          allOrdersRef.current = data;
          setOrders(data);
          // Apply current in-memory filters to the freshly-arrived snapshot
          // Read from refs (not closure) to always get the latest filter values
          applyFiltersInMemory(data, searchQueryRef.current, selectedStatusRef.current, selectedDurationRef.current);
          setLoading(false);
        },
        (error) => {
          console.error("[LISTENER:ERROR] subscribeUserOrders:", error);
          setLoading(false);
        }
      );
      return () => {
        console.log("[LISTENER:DESTROY] subscribeUserOrders");
        unsubscribe();
      };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])
  );

  const handleSearchChange = (text: string) => {
    setSearchQuery(text);
    // Filtering is now handled by the useEffect above — no Firestore calls here
  };

  const handleApplyFilters = () => {
    setFilterModalVisible(false);
    // Filtering is handled by the useEffect — just close the modal
  };

  const handleResetFilters = () => {
    setSelectedStatus("All");
    setSelectedDuration("Any Time");
    setFilterModalVisible(false);
    // useEffect will re-run automatically when state updates above settle
  };

  // Date Formatting Helper e.g., "3rd Jun, 2026"
  const formatDateLong = (isoString?: string) => {
    if (!isoString) return "";
    try {
      const date = new Date(isoString);
      const day = date.getDate();
      const month = date.toLocaleDateString("en-IN", { month: "short" });
      const year = date.getFullYear();

      const suffix = (dayNum: number) => {
        if (dayNum > 3 && dayNum < 21) return "th";
        switch (dayNum % 10) {
          case 1:
            return "st";
          case 2:
            return "nd";
          case 3:
            return "rd";
          default:
            return "th";
        }
      };

      return `${day}${suffix(day)} ${month}, ${year}`;
    } catch {
      return isoString || "";
    }
  };

  // Date limit helper for returns (14 days from delivery/creation)
  const getReturnLimitDate = (isoString?: string) => {
    if (!isoString) return "";
    try {
      const d = new Date(isoString);
      d.setDate(d.getDate() + 14);
      return formatDateLong(d.toISOString());
    } catch {
      return "";
    }
  };

  const handleCancelOrder = (orderId: string) => {
    if (Platform.OS === "web") {
      const confirmCancel = window.confirm("Are you sure you want to cancel this order?");
      if (confirmCancel) {
        performCancellation(orderId);
      }
    } else {
      Alert.alert("Cancel Order", "Are you sure you want to cancel this order?", [
        { text: "No, Keep Order", style: "cancel" },
        {
          text: "Yes, Cancel Order",
          style: "destructive",
          onPress: () => performCancellation(orderId),
        },
      ]);
    }
  };

  const performCancellation = async (orderId: string) => {
    try {
      await authStore.cancelOrder(orderId);
      if (Platform.OS === "web") {
        window.alert("Order cancelled successfully.");
      } else {
        Alert.alert("Success", "Order cancelled successfully.");
      }
    } catch (error: any) {
      Alert.alert("Error", error.message || "Failed to cancel order.");
    }
  };

  const handleChangeAddressClick = (order: any) => {
    setSelectedOrderForAddress(order);
    setNewAddress(order.address || "");
    setAddressModalVisible(true);
  };

  const handleSaveAddress = async () => {
    if (!selectedOrderForAddress) return;
    if (!newAddress.trim()) {
      Alert.alert("Error", "Please enter a valid address.");
      return;
    }

    setAddressModalVisible(false);
    try {
      await authStore.updateOrderAddress(selectedOrderForAddress.orderId, newAddress.trim());
      if (Platform.OS === "web") {
        window.alert("Delivery address updated successfully.");
      } else {
        Alert.alert("Success", "Delivery address updated successfully.");
      }
    } catch (error: any) {
      Alert.alert("Error", error.message || "Failed to update address.");
    }
  };

  const handleSimulateOutForDelivery = async (orderId: string) => {
    try {
      await authStore.updateOrderStatus(orderId, "Out for Delivery");
      if (Platform.OS === "web") {
        window.alert("Order status updated to Out for Delivery.");
      } else {
        Alert.alert("Success", "Order status updated to Out for Delivery.");
      }
    } catch (error: any) {
      Alert.alert("Error", error.message || "Failed to update status.");
    }
  };

  const handleOrderAgain = (items: any[]) => {
    try {
      items.forEach((item) => {
        authStore.updateCart(item.productId, item.quantity);
      });
      if (Platform.OS === "web") {
        window.alert("All items from this order have been added to your cart!");
      } else {
        Alert.alert("Order Loaded", "All items from this order have been added to your cart!");
      }
    } catch (error) {
      console.error("Order again failed:", error);
    }
  };

  const handleOpenPriceDetails = (order: any) => {
    setSelectedOrderForPrice(order);
    setPriceDetailsVisible(true);
  };

  const triggerInvoiceDownload = () => {
    if (!selectedOrderForInvoice) return;
    setInvoiceChoiceVisible(false);
    setInvoiceDownloading(true);
    setTimeout(() => {
      setInvoiceDownloading(false);
      setInvoiceModalVisible(true);
    }, 1500); // 1.5s simulation loader
  };

  const handleOpenInvoiceChoice = (order: any) => {
    setSelectedOrderForInvoice(order);
    setInvoiceChoiceVisible(true);
  };

  const handleEmailInvoice = async () => {
    if (!selectedOrderForInvoice) return;
    const userEmail = authStore.getCurrentUser()?.email || "";
    if (!userEmail) {
      Alert.alert("Error", "User email not found. Please log in again.");
      return;
    }

    setInvoiceChoiceVisible(false);
    setInvoiceSendingEmail(true);
    try {
      const API_URL = process.env.EXPO_PUBLIC_OTP_URL || (Platform.OS === "android" ? "http://10.0.2.2:3000" : "http://localhost:3000");
      const response = await fetch(`${API_URL}/send-invoice-email`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: userEmail,
          clientName: authStore.getCurrentUser()?.name || "Valued Customer",
          orderId: selectedOrderForInvoice.orderId,
          totalAmount: selectedOrderForInvoice.totalAmount,
          deliveryCharge: selectedOrderForInvoice.deliveryCharge ?? 40,
          items: selectedOrderForInvoice.items,
          address: selectedOrderForInvoice.address,
          paymentMethod: selectedOrderForInvoice.paymentMethod || "UPI",
          deliveryOption: selectedOrderForInvoice.deliveryOption || "Standard Delivery",
        }),
      });

      const data = await response.json();
      if (data.success) {
        if (Platform.OS === "web") {
          window.alert(`Success! Invoice has been sent to ${userEmail}`);
        } else {
          Alert.alert("Success", `Invoice has been sent to ${userEmail}`);
        }
      } else {
        throw new Error(data.message);
      }
    } catch (error: any) {
      console.error("Failed to email invoice:", error);
      Alert.alert("Error", "Failed to email invoice: " + (error.message || "Server offline"));
    } finally {
      setInvoiceSendingEmail(false);
    }
  };

  const handleSaveInvoice = () => {
    if (Platform.OS === "web") {
      window.alert("PDF invoice saved successfully to your downloads folder!");
    } else {
      Alert.alert("Success", "PDF invoice saved successfully to your downloads folder!");
    }
    setInvoiceModalVisible(false);
  };

  const handlePrintInvoice = () => {
    if (Platform.OS === "web") {
      window.print();
    } else {
      Alert.alert("Print Job", "Sending document to local Wi-Fi printer...");
    }
    setInvoiceModalVisible(false);
  };

  const handleOpenChatbot = (order?: any) => {
    setChatbotOrderContext(order || (orders.length > 0 ? orders[0] : null));
    setChatbotVisible(true);
  };

  const getStatusColor = (status: string) => {
    const s = (status || "Placed").toLowerCase();
    if (s === "delivered") return "#16a34a";
    if (s === "cancelled") return "#ef4444";
    if (s === "returned") return "#dc2626";
    return "#d97706"; // Pending / Transit / Packing
  };

  const renderOrderItem = ({ item }: { item: any }) => {
    const isCancelled = item.status === "Cancelled";
    const isDelivered = item.status === "Delivered";
    const isReturned = item.status === "Returned";
    const isCancellable =
      item.status === "Placed" || item.status === "Pending" || item.status === "Preparing to pack" || item.status === "Confirmed";

    const displayItems = item.items || [];
    const firstItem = displayItems[0] || {};
    const extraCount = Math.max(0, displayItems.length - 1);

    // Dynamic MRP display
    const mrpCost = firstItem.originalPrice ?? firstItem.price * 1.3;

    return (
      <View style={styles.orderCard}>
        {/* Card Header: Order Number and Navigate Arrow */}
        <TouchableOpacity
          style={styles.orderHeader}
          activeOpacity={0.7}
          onPress={() => router.push({ pathname: "/order-detail", params: { orderId: item.orderId } })}
        >
          <View>
            <Text style={styles.orderIdLabel}>ORDER NUMBER</Text>
            <Text style={styles.orderIdValue}>{item.orderId}</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
        </TouchableOpacity>

        {/* Status Line */}
        <View style={styles.statusRow}>
          <View style={[styles.statusDot, { backgroundColor: getStatusColor(item.status) }]} />
          <Text style={styles.statusText}>
            {item.status || "Placed"}{" "}
            {isDelivered && `on ${formatDateLong(item.createdAt)}`}
            {!isDelivered && !isCancelled && !isReturned && `on ${formatDateLong(item.createdAt)}`}
          </Text>
        </View>

        {/* First Item Main Row */}
        <TouchableOpacity
          style={styles.productRow}
          activeOpacity={0.8}
          onPress={() => {
            if (firstItem.productId && firstItem.productId !== 9999) {
              router.push({
                pathname: "/product" as any,
                params: { productId: firstItem.productId.toString() },
              });
            } else {
              Alert.alert("Demo Item", "This clothing item is a mock demo product.");
            }
          }}
        >
          <View style={styles.imageContainerBg}>
            {firstItem.imageUrl ? (
              <Image source={{ uri: firstItem.imageUrl }} style={styles.orderProductImage as any} contentFit="contain" />
            ) : (
              <Ionicons name="basket-outline" size={24} color="#94a3b8" />
            )}
          </View>
          <View style={styles.productDetailsCol}>
            <Text style={styles.itemNameText} numberOfLines={1}>
              {firstItem.name}
            </Text>
            <Text style={styles.productQtyText}>
              {firstItem.size ? `Size: ${firstItem.size}  |  ` : ""}Qty: {firstItem.quantity}
            </Text>
            <View style={styles.priceContainer}>
              <Text style={styles.mrpText}>MRP Rs. {mrpCost.toFixed(2)}</Text>
              <Text style={styles.productPriceText}>Rs. {firstItem.price.toFixed(2)}</Text>
            </View>
          </View>
        </TouchableOpacity>

        {/* Extra items indicator */}
        {extraCount > 0 && (
          <TouchableOpacity
            style={styles.extraItemsRow}
            activeOpacity={0.7}
            onPress={() => router.push({ pathname: "/order-detail", params: { orderId: item.orderId } })}
          >
            <Text style={styles.extraItemsText}>+ {extraCount} more item{extraCount > 1 ? "s" : ""} in this order</Text>
          </TouchableOpacity>
        )}

        {/* Exchange/Return Policy Banner */}
        {isDelivered && (
          <View style={styles.policyRow}>
            <View style={styles.policyDot} />
            <Text style={styles.policyText}>
              Exchange/Return available till {getReturnLimitDate(item.createdAt)}
            </Text>
          </View>
        )}

        <View style={styles.cardDivider} />

        {/* Card Main Actions Grid (Order Status, View Item, Price Details, Download Invoice) */}
        <View style={styles.cardOptionsGrid}>
          {/* Option: Order Status */}
          <TouchableOpacity
            style={styles.gridActionBtn}
            onPress={() => router.push({ pathname: "/order-detail", params: { orderId: item.orderId } })}
          >
            <Ionicons name="compass-outline" size={16} color={Theme.colors.primary} />
            <Text style={styles.gridActionText}>Order Status</Text>
          </TouchableOpacity>

          {/* Option: View Item */}
          <TouchableOpacity
            style={styles.gridActionBtn}
            onPress={() => {
              if (firstItem.productId && firstItem.productId !== 9999) {
                router.push({
                  pathname: "/product" as any,
                  params: { productId: firstItem.productId.toString() },
                });
              } else {
                router.push({ pathname: "/order-detail", params: { orderId: item.orderId } });
              }
            }}
          >
            <Ionicons name="eye-outline" size={16} color={Theme.colors.primary} />
            <Text style={styles.gridActionText}>View Item</Text>
          </TouchableOpacity>

          {/* Option: Price Details */}
          <TouchableOpacity style={styles.gridActionBtn} onPress={() => handleOpenPriceDetails(item)}>
            <Ionicons name="card-outline" size={16} color={Theme.colors.primary} />
            <Text style={styles.gridActionText}>Price Details</Text>
          </TouchableOpacity>

          {/* Option: Download Invoice */}
          <TouchableOpacity style={styles.gridActionBtn} onPress={() => handleOpenInvoiceChoice(item)}>
            <Ionicons name="document-text-outline" size={16} color={Theme.colors.primary} />
            <Text style={styles.gridActionText}>Invoice</Text>
          </TouchableOpacity>
        </View>

        {/* Card Operations Row (Cancel, Ship, Address, Again, Return) */}
        <View style={styles.operationsRow}>
          {isCancellable && (
            <TouchableOpacity style={styles.cancelBtn} onPress={() => handleCancelOrder(item.orderId)}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
          )}

          {isCancellable && (
            <TouchableOpacity style={styles.addressBtn} onPress={() => handleChangeAddressClick(item)}>
              <Text style={styles.addressBtnText}>Address</Text>
            </TouchableOpacity>
          )}

          {isCancellable && (
            <TouchableOpacity style={styles.shipBtn} onPress={() => handleSimulateOutForDelivery(item.orderId)}>
              <Text style={styles.shipBtnText}>Ship</Text>
            </TouchableOpacity>
          )}

          {isDelivered && (
            <>
              <TouchableOpacity style={styles.styleExchangeBtn} onPress={() => Alert.alert("Style Exchange", "Exchange request initiated for Logan Crochet series.")}>
                <Text style={styles.styleExchangeText}>Style Exchange</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.sizeExchangeBtn} onPress={() => Alert.alert("Size Exchange", "Please select your preferred replacement size.")}>
                <Text style={styles.sizeExchangeText}>Size Exchange</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.returnBtn} onPress={() => Alert.alert("Initiate Return", "Refund request registered. Our agent will collect items in 24 hours.")}>
                <Text style={styles.returnText}>Return</Text>
              </TouchableOpacity>
            </>
          )}

          {!isCancellable && !isDelivered && (
            <TouchableOpacity style={styles.orderAgainBtn} onPress={() => handleOrderAgain(item.items)}>
              <Ionicons name="refresh" size={13} color="#16a34a" style={{ marginRight: 4 }} />
              <Text style={styles.orderAgainBtnText}>Order Again</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />

      {/* Screen Header */}
      <View style={styles.mainHeader}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backArrowBtn}
          activeOpacity={0.7}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="arrow-back" size={22} color={Theme.colors.primaryDark} />
        </TouchableOpacity>
        <Text style={styles.mainHeaderTitle}>Orders</Text>
        {/* Spacer to keep title centred */}
        <View style={styles.headerSpacer} />
      </View>

      {/* Search and Filter Row */}
      <View style={styles.searchFilterRow}>
        <View style={styles.searchBarContainer}>
          <Ionicons name="search" size={18} color="#94a3b8" style={styles.searchIcon} />
          <TextInput
            placeholder="Search for orders"
            placeholderTextColor="#94a3b8"
            value={searchQuery}
            onChangeText={handleSearchChange}
            style={styles.searchInput}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => handleSearchChange("")}>
              <Ionicons name="close-circle" size={18} color="#94a3b8" />
            </TouchableOpacity>
          )}
        </View>
        <TouchableOpacity
          style={styles.filterBtn}
          activeOpacity={0.8}
          onPress={() => setFilterModalVisible(true)}
        >
          <Ionicons name="options-outline" size={16} color={Theme.colors.primaryDark} />
          <Text style={styles.filterBtnText}>FILTER</Text>
        </TouchableOpacity>
      </View>

      {/* Orders List Container */}
      {loading ? (
        <View style={styles.centeredContent}>
          <ActivityIndicator size="large" color={Theme.colors.primary} />
          <Text style={styles.loadingText}>Loading orders...</Text>
        </View>
      ) : filteredOrders.length > 0 ? (
        <FlatList
          data={filteredOrders}
          keyExtractor={(item) => item.orderId}
          renderItem={renderOrderItem}
          contentContainerStyle={styles.ordersList}
          showsVerticalScrollIndicator={false}
        />
      ) : (
        <View style={styles.emptyContainer}>
          <View style={styles.emptyIconBg}>
            <Ionicons name="document-text-outline" size={70} color="#cbd5e1" />
          </View>
          <Text style={styles.emptyTitle}>No matching orders found</Text>
          <Text style={styles.emptySubtitle}>
            Try adjusting your search criteria or removing active filters.
          </Text>
          <TouchableOpacity
            style={styles.resetSearchBtn}
            onPress={() => {
              setSearchQuery("");
              setSelectedStatus("All");
              setSelectedDuration("Any Time");
              // Resetting state triggers the filter useEffect automatically
              applyFiltersInMemory(allOrdersRef.current, "", "All", "Any Time");
            }}
          >
            <Text style={styles.resetSearchBtnText}>Reset Search & Filters</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Floating Action Chat Button */}
      <TouchableOpacity
        style={styles.floatingSupportFAB}
        activeOpacity={0.9}
        onPress={() => handleOpenChatbot()}
      >
        <Ionicons name="chatbubbles-outline" size={26} color="#ffffff" />
        <View style={styles.activeDot} />
      </TouchableOpacity>

      {/* Support Chatbot Modal */}
      <ChatbotModal
        visible={chatbotVisible}
        onClose={() => setChatbotVisible(false)}
        orderContext={chatbotOrderContext}
        onDownloadInvoice={(ord) => {
          setChatbotVisible(false);
          handleOpenInvoiceChoice(ord);
        }}
      />

      {/* Filter Orders Modal Sheet */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={filterModalVisible}
        onRequestClose={() => setFilterModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity style={styles.dismissArea} onPress={() => setFilterModalVisible(false)} />
          <View style={[styles.filterSheet, { paddingBottom: Math.max(insets.bottom, 20) }]}>
            <View style={styles.filterHeader}>
              <Text style={styles.filterSheetTitle}>Filter Orders</Text>
              <TouchableOpacity onPress={handleResetFilters}>
                <Text style={styles.resetFiltersText}>Reset Filters</Text>
              </TouchableOpacity>
            </View>

            {/* Filter Section: Status */}
            <View style={styles.filterSection}>
              <Text style={styles.filterSectionTitle}>Status</Text>
              {["All", "On the way", "Delivered", "Returned"].map((status) => {
                const active = selectedStatus === status;
                return (
                  <TouchableOpacity
                    key={status}
                    style={styles.filterOptionRow}
                    activeOpacity={0.7}
                    onPress={() => setSelectedStatus(status)}
                  >
                    <View style={[styles.radioCircle, active && styles.radioCircleActive]}>
                      {active && <View style={styles.radioDot} />}
                    </View>
                    <Text style={[styles.filterOptionText, active && styles.filterOptionTextActive]}>
                      {status}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Filter Section: Duration */}
            <View style={styles.filterSection}>
              <Text style={styles.filterSectionTitle}>Duration</Text>
              {["Any Time", "Last 30 days", "Last 6 months", "Last Year"].map((duration) => {
                const active = selectedDuration === duration;
                return (
                  <TouchableOpacity
                    key={duration}
                    style={styles.filterOptionRow}
                    activeOpacity={0.7}
                    onPress={() => setSelectedDuration(duration)}
                  >
                    <View style={[styles.radioCircle, active && styles.radioCircleActive]}>
                      {active && <View style={styles.radioDot} />}
                    </View>
                    <Text style={[styles.filterOptionText, active && styles.filterOptionTextActive]}>
                      {duration}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Apply Button */}
            <TouchableOpacity style={styles.applyFilterBtn} onPress={handleApplyFilters}>
              <Text style={styles.applyFilterBtnText}>Apply filter</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Address Edit Dialog Modal */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={addressModalVisible}
        onRequestClose={() => setAddressModalVisible(false)}
      >
        <View style={styles.dialogOverlay}>
          <TouchableOpacity style={styles.dismissArea} onPress={() => setAddressModalVisible(false)} />
          <View style={styles.addressDialog}>
            <Text style={styles.dialogTitle}>Change Shipping Address</Text>
            <Text style={styles.dialogSubtitle}>
              You can change the destination address before dispatch.
            </Text>
            <View style={styles.addressInputContainer}>
              <TextInput
                style={styles.addressInput}
                placeholder="Enter new shipping address"
                placeholderTextColor="#94a3b8"
                value={newAddress}
                onChangeText={setNewAddress}
                multiline={true}
                numberOfLines={3}
              />
            </View>
            <View style={styles.dialogActions}>
              <TouchableOpacity style={styles.dialogCancelBtn} onPress={() => setAddressModalVisible(false)}>
                <Text style={styles.dialogCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.dialogSaveBtn} onPress={handleSaveAddress}>
                <Text style={styles.dialogSaveText}>Save Changes</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Price Details Bottom Sheet Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={priceDetailsVisible}
        onRequestClose={() => setPriceDetailsVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity style={styles.dismissArea} onPress={() => setPriceDetailsVisible(false)} />
          {selectedOrderForPrice && (
            <View style={[styles.priceSheet, { paddingBottom: Math.max(insets.bottom, 20) }]}>
              <View style={styles.sheetHeader}>
                <View style={styles.sheetHeaderBar} />
                <View style={styles.sheetTitleRow}>
                  <Text style={styles.sheetTitle}>Price Details</Text>
                  <TouchableOpacity onPress={() => setPriceDetailsVisible(false)}>
                    <Ionicons name="close" size={22} color={Theme.colors.primaryDark} />
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.sheetBody}>
                <View style={styles.priceDetailRow}>
                  <Text style={styles.priceDetailLabel}>Subtotal</Text>
                  <Text style={styles.priceDetailVal}>
                    Rs. {(selectedOrderForPrice.totalAmount - (selectedOrderForPrice.deliveryCharge ?? 40) + (selectedOrderForPrice.totalAmount > 500 ? 50 : 0)).toFixed(2)}
                  </Text>
                </View>
                <View style={styles.priceDetailRow}>
                  <Text style={styles.priceDetailLabel}>Delivery Charge</Text>
                  <Text style={styles.priceDetailVal}>Rs. {(selectedOrderForPrice.deliveryCharge ?? 40).toFixed(2)}</Text>
                </View>
                {selectedOrderForPrice.totalAmount > 500 && (
                  <View style={styles.priceDetailRow}>
                    <Text style={[styles.priceDetailLabel, { color: "#10b981" }]}>Promotion Discount</Text>
                    <Text style={[styles.priceDetailVal, { color: "#10b981" }]}>-Rs. 50.00</Text>
                  </View>
                )}
                <View style={styles.sheetDivider} />
                <View style={styles.priceDetailRowTotal}>
                  <Text style={styles.priceTotalLabel}>Total Amount Paid</Text>
                  <Text style={styles.priceTotalVal}>Rs. {selectedOrderForPrice.totalAmount.toFixed(2)}</Text>
                </View>
              </View>

              <TouchableOpacity style={styles.sheetCloseBtn} onPress={() => setPriceDetailsVisible(false)}>
                <Text style={styles.sheetCloseBtnText}>Close</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </Modal>

      {/* Invoice Simulated Download Spinner */}
      <Modal animationType="fade" transparent={true} visible={invoiceDownloading}>
        <View style={styles.loaderOverlay}>
          <View style={styles.loaderCard}>
            <ActivityIndicator size="large" color={Theme.colors.primary} />
            <Text style={styles.loaderText}>Generating tax invoice...</Text>
          </View>
        </View>
      </Modal>

      {/* Simulated Invoice PDF Viewer Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={invoiceModalVisible}
        onRequestClose={() => setInvoiceModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity style={styles.dismissArea} onPress={() => setInvoiceModalVisible(false)} />
          {selectedOrderForInvoice && (
            <View style={styles.invoiceDocCard}>
              {/* Invoice Header */}
              <View style={styles.invoiceDocHeader}>
                <View>
                  <Text style={styles.businessName}>quickCart Inc.</Text>
                  <Text style={styles.businessAddr}>Sector 62, Noida, UP - 201301</Text>
                  <Text style={styles.businessGst}>GSTIN: 09AABCU8372M1Z5</Text>
                </View>
                <View style={styles.docBadge}>
                  <Text style={styles.docBadgeText}>TAX INVOICE</Text>
                </View>
              </View>

              <View style={styles.invoiceDivider} />

              {/* Bill To & Metadata */}
              <View style={styles.invoiceMetaRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.invoiceMetaTitle}>Billed To:</Text>
                  <Text style={styles.invoiceClientName}>
                    {authStore.getCurrentUser()?.name || "Kushal Kumar Singh"}
                  </Text>
                  <Text style={styles.invoiceClientAddr} numberOfLines={2}>
                    {selectedOrderForInvoice.address}
                  </Text>
                </View>
                <View style={{ alignItems: "flex-end" }}>
                  <Text style={styles.invoiceMetaText}>
                    <Text style={styles.bold}>Invoice No:</Text> QC-{selectedOrderForInvoice.orderId.slice(-6).toUpperCase()}
                  </Text>
                  <Text style={styles.invoiceMetaText}>
                    <Text style={styles.bold}>Date:</Text> {formatDateLong(selectedOrderForInvoice.createdAt)}
                  </Text>
                  <Text style={styles.invoiceMetaText}>
                    <Text style={styles.bold}>Method:</Text> {selectedOrderForInvoice.paymentMethod}
                  </Text>
                </View>
              </View>

              <View style={styles.invoiceDivider} />

              {/* Items Table List */}
              <View style={styles.invoiceItemsTable}>
                <View style={styles.tableHeader}>
                  <Text style={[styles.thText, { flex: 2 }]}>Item Description</Text>
                  <Text style={[styles.thText, { flex: 1, textAlign: "center" }]}>Qty</Text>
                  <Text style={[styles.thText, { flex: 1.2, textAlign: "right" }]}>Price</Text>
                </View>
                <ScrollView style={styles.tableScroll} showsVerticalScrollIndicator={false}>
                  {selectedOrderForInvoice.items &&
                    selectedOrderForInvoice.items.map((it: any, index: number) => (
                      <View key={index} style={styles.tableRow}>
                        <Text style={[styles.tdText, { flex: 2 }]} numberOfLines={1}>
                          {it.name} {it.size ? `(${it.size})` : ""}
                        </Text>
                        <Text style={[styles.tdText, { flex: 1, textAlign: "center" }]}>{it.quantity}</Text>
                        <Text style={[styles.tdText, { flex: 1.2, textAlign: "right" }]}>
                          Rs. {(it.price * it.quantity).toFixed(2)}
                        </Text>
                      </View>
                    ))}
                </ScrollView>
              </View>

              <View style={styles.invoiceDivider} />

              {/* Total summary */}
              <View style={styles.invoiceSummaryCol}>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Subtotal:</Text>
                  <Text style={styles.summaryValue}>
                    Rs. {(selectedOrderForInvoice.totalAmount - (selectedOrderForInvoice.deliveryCharge ?? 40) + (selectedOrderForInvoice.totalAmount > 500 ? 50 : 0)).toFixed(2)}
                  </Text>
                </View>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Delivery Charge:</Text>
                  <Text style={styles.summaryValue}>Rs. {(selectedOrderForInvoice.deliveryCharge ?? 40).toFixed(2)}</Text>
                </View>
                {selectedOrderForInvoice.totalAmount > 500 && (
                  <View style={styles.summaryRow}>
                    <Text style={[styles.summaryLabel, { color: "#10b981" }]}>Discount Applied:</Text>
                    <Text style={[styles.summaryValue, { color: "#10b981" }]}>-Rs. 50.00</Text>
                  </View>
                )}
                <View style={styles.summaryRowTotal}>
                  <Text style={styles.summaryLabelTotal}>Grand Total Paid:</Text>
                  <Text style={styles.summaryValueTotal}>Rs. {selectedOrderForInvoice.totalAmount.toFixed(2)}</Text>
                </View>
              </View>

              {/* Document Action Options */}
              <View style={styles.docActions}>
                <TouchableOpacity style={styles.printBtn} onPress={handlePrintInvoice}>
                  <Ionicons name="print" size={16} color="#475569" style={{ marginRight: 6 }} />
                  <Text style={styles.printBtnText}>Print</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.downloadBtn} onPress={handleSaveInvoice}>
                  <Ionicons name="download" size={16} color="#ffffff" style={{ marginRight: 6 }} />
                  <Text style={styles.downloadBtnText}>Save PDF</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>
      </Modal>

      {/* Invoice Options Choice Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={invoiceChoiceVisible}
        onRequestClose={() => setInvoiceChoiceVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity style={styles.dismissArea} onPress={() => setInvoiceChoiceVisible(false)} />
          {selectedOrderForInvoice && (
            <View style={[styles.priceSheet, { paddingBottom: Math.max(insets.bottom, 20) }]}>
              <View style={styles.sheetHeader}>
                <View style={styles.sheetHeaderBar} />
                <View style={styles.sheetTitleRow}>
                  <Text style={styles.sheetTitle}>Get Tax Invoice</Text>
                  <TouchableOpacity onPress={() => setInvoiceChoiceVisible(false)}>
                    <Ionicons name="close" size={22} color={Theme.colors.primaryDark} />
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.sheetBody}>
                <Text style={styles.choiceSubtitle}>Choose how you would like to receive your invoice:</Text>
                
                <TouchableOpacity
                  style={styles.choiceOptionBtn}
                  activeOpacity={0.8}
                  onPress={triggerInvoiceDownload}
                >
                  <View style={[styles.optionIconBg, { backgroundColor: "#e0f2fe" }]}>
                    <Ionicons name="phone-portrait-outline" size={22} color="#0284c7" />
                  </View>
                  <View style={styles.choiceTextCol}>
                    <Text style={styles.choiceOptionTitle}>Download PDF on Phone</Text>
                    <Text style={styles.choiceOptionSub}>Save receipt immediately to your device</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color="#94a3b8" />
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.choiceOptionBtn}
                  activeOpacity={0.8}
                  onPress={handleEmailInvoice}
                >
                  <View style={[styles.optionIconBg, { backgroundColor: "#fdf2f8" }]}>
                    <Ionicons name="mail-outline" size={22} color="#db2777" />
                  </View>
                  <View style={styles.choiceTextCol}>
                    <Text style={styles.choiceOptionTitle}>Send Invoice to Email</Text>
                    <Text style={styles.choiceOptionSub}>Receive formatted tax document on mail</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color="#94a3b8" />
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>
      </Modal>

      {/* Email sending simulation spinner */}
      <Modal animationType="fade" transparent={true} visible={invoiceSendingEmail}>
        <View style={styles.loaderOverlay}>
          <View style={styles.loaderCard}>
            <ActivityIndicator size="large" color={Theme.colors.primary} />
            <Text style={styles.loaderText}>Sending invoice to your email...</Text>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },
  mainHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#ffffff",
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
    gap: 10,
  },
  backArrowBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#f1f5f9",
    justifyContent: "center",
    alignItems: "center",
  },
  headerSpacer: {
    width: 36,
  },
  mainHeaderTitle: {
    flex: 1,
    fontSize: 22,
    fontWeight: "900",
    color: Theme.colors.primaryDark,
    textAlign: "center",
  },
  searchFilterRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: "#ffffff",
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  searchBarContainer: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F1F5F9",
    borderRadius: 12,
    height: 40,
    paddingHorizontal: 10,
  },
  searchIcon: {
    marginRight: 6,
  },
  searchInput: {
    flex: 1,
    color: "#1e293b",
    fontSize: 13,
    paddingVertical: 0,
  },
  filterBtn: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 12,
    height: 40,
    paddingHorizontal: 12,
    backgroundColor: "#ffffff",
    gap: 6,
  },
  filterBtnText: {
    fontSize: 11,
    fontWeight: "800",
    color: Theme.colors.primaryDark,
    letterSpacing: 0.5,
  },
  ordersList: {
    padding: 16,
    paddingBottom: 110,
  },
  centeredContent: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    color: "#64748b",
    fontWeight: "600",
  },
  orderCard: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.02,
    shadowRadius: 8,
    elevation: 2,
  },
  orderHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingBottom: 10,
  },
  orderIdLabel: {
    fontSize: 9,
    fontWeight: "800",
    color: "#94A3B8",
    letterSpacing: 0.5,
  },
  orderIdValue: {
    fontSize: 12,
    fontWeight: "800",
    color: Theme.colors.primaryDark,
    marginTop: 2,
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F8FAFC",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    marginBottom: 12,
    gap: 8,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 12,
    fontWeight: "800",
    color: "#475569",
  },
  productRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
  },
  imageContainerBg: {
    width: 64,
    height: 64,
    backgroundColor: "#F8FAFC",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#F1F5F9",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  orderProductImage: {
    width: "90%",
    height: "90%",
    borderRadius: 6,
  },
  productDetailsCol: {
    flex: 1,
  },
  itemNameText: {
    fontSize: 13,
    fontWeight: "800",
    color: "#1e293b",
    lineHeight: 16,
  },
  productQtyText: {
    fontSize: 11,
    color: "#64748b",
    fontWeight: "600",
    marginTop: 3,
  },
  priceContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
  },
  mrpText: {
    fontSize: 11,
    color: "#94a3b8",
    textDecorationLine: "line-through",
    marginRight: 6,
    fontWeight: "500",
  },
  productPriceText: {
    fontSize: 13,
    fontWeight: "800",
    color: Theme.colors.primaryDark,
  },
  extraItemsRow: {
    marginTop: 10,
    backgroundColor: "#FAFAFA",
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 10,
    alignSelf: "flex-start",
  },
  extraItemsText: {
    fontSize: 11,
    color: Theme.colors.primary,
    fontWeight: "700",
  },
  policyRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 12,
    gap: 6,
  },
  policyDot: {
    width: 5,
    height: 5,
    backgroundColor: "#10b981",
    borderRadius: 2.5,
  },
  policyText: {
    fontSize: 11,
    color: "#059669",
    fontWeight: "700",
  },
  cardDivider: {
    height: 1,
    backgroundColor: "#F1F5F9",
    marginVertical: 12,
  },
  cardOptionsGrid: {
    flexDirection: "row",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: 8,
  },
  gridActionBtn: {
    width: "48%",
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 10,
    gap: 6,
  },
  gridActionText: {
    fontSize: 11,
    color: Theme.colors.primaryDark,
    fontWeight: "700",
  },
  operationsRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginTop: 10,
    gap: 8,
    flexWrap: "wrap",
  },
  cancelBtn: {
    backgroundColor: "#FEF2F2",
    borderWidth: 1,
    borderColor: "#FEE2E2",
    borderRadius: 10,
    paddingVertical: 7,
    paddingHorizontal: 12,
  },
  cancelBtnText: {
    color: "#EF4444",
    fontSize: 11,
    fontWeight: "800",
  },
  addressBtn: {
    backgroundColor: "#F0FDF4",
    borderWidth: 1,
    borderColor: "#DCFCE7",
    borderRadius: 10,
    paddingVertical: 7,
    paddingHorizontal: 12,
  },
  addressBtnText: {
    color: Theme.colors.primary,
    fontSize: 11,
    fontWeight: "800",
  },
  shipBtn: {
    backgroundColor: "#FFFBEB",
    borderWidth: 1,
    borderColor: "#FEF3C7",
    borderRadius: 10,
    paddingVertical: 7,
    paddingHorizontal: 12,
  },
  shipBtnText: {
    color: "#D97706",
    fontSize: 11,
    fontWeight: "800",
  },
  styleExchangeBtn: {
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 8,
    paddingVertical: 7,
    paddingHorizontal: 10,
  },
  styleExchangeText: {
    color: "#475569",
    fontSize: 11,
    fontWeight: "700",
  },
  sizeExchangeBtn: {
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 8,
    paddingVertical: 7,
    paddingHorizontal: 10,
  },
  sizeExchangeText: {
    color: "#475569",
    fontSize: 11,
    fontWeight: "700",
  },
  returnBtn: {
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 8,
    paddingVertical: 7,
    paddingHorizontal: 10,
  },
  returnText: {
    color: "#475569",
    fontSize: 11,
    fontWeight: "700",
  },
  orderAgainBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f0fdf4",
    borderWidth: 1,
    borderColor: "#bbf7d0",
    borderRadius: 10,
    paddingVertical: 7,
    paddingHorizontal: 12,
  },
  orderAgainBtnText: {
    color: "#16a34a",
    fontSize: 11,
    fontWeight: "800",
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 32,
    paddingBottom: 64,
  },
  emptyIconBg: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: "#ffffff",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "#f1f5f9",
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: Theme.colors.primaryDark,
    marginBottom: 6,
  },
  emptySubtitle: {
    fontSize: 13,
    color: "#64748b",
    textAlign: "center",
    lineHeight: 18,
    marginBottom: 24,
  },
  resetSearchBtn: {
    backgroundColor: Theme.colors.primary,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
  },
  resetSearchBtnText: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "700",
  },
  floatingSupportFAB: {
    position: "absolute",
    bottom: 84, // higher than tab bar height
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Theme.colors.primary,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: Theme.colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.24,
    shadowRadius: 12,
    elevation: 6,
    zIndex: 99,
  },
  activeDot: {
    position: "absolute",
    top: 2,
    right: 2,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: "#22c55e",
    borderWidth: 2,
    borderColor: "#ffffff",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.4)",
    justifyContent: "flex-end",
  },
  dismissArea: {
    flex: 1,
  },
  filterSheet: {
    backgroundColor: "#ffffff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 16,
    paddingHorizontal: 20,
  },
  filterHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  filterSheetTitle: {
    fontSize: 16,
    fontWeight: "900",
    color: Theme.colors.primaryDark,
  },
  resetFiltersText: {
    fontSize: 12,
    color: "##16a34a", // pinkish/magenta color matching reset filter link
    fontWeight: "700",
  },
  filterSection: {
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  filterSectionTitle: {
    fontSize: 12,
    fontWeight: "800",
    color: "#64748B",
    textTransform: "uppercase",
    marginBottom: 10,
    letterSpacing: 0.5,
  },
  filterOptionRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
  },
  radioCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: "#cbd5e1",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 10,
  },
  radioCircleActive: {
    borderColor: "#16a34a", // matching filter select color
  },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#16a34a",
  },
  filterOptionText: {
    fontSize: 13,
    color: "#475569",
    fontWeight: "600",
  },
  filterOptionTextActive: {
    color: "#0f172a",
    fontWeight: "700",
  },
  applyFilterBtn: {
    backgroundColor: "#16a34a", // matching deep pink button
    borderRadius: 14,
    height: 50,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 16,
    marginBottom: 8,
  },
  applyFilterBtnText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "700",
  },
  dialogOverlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.4)",
    justifyContent: "center",
    alignItems: "center",
  },
  addressDialog: {
    backgroundColor: "#ffffff",
    borderRadius: 20,
    padding: 20,
    width: "90%",
    maxWidth: 380,
    gap: 12,
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 6,
  },
  dialogTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: Theme.colors.primaryDark,
  },
  dialogSubtitle: {
    fontSize: 12,
    color: "#64748b",
    lineHeight: 16,
  },
  addressInputContainer: {
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 12,
    padding: 10,
    minHeight: 80,
  },
  addressInput: {
    color: "#1e293b",
    fontSize: 13,
    textAlignVertical: "top",
    height: "100%",
  },
  dialogActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 12,
    marginTop: 8,
  },
  dialogCancelBtn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
    backgroundColor: "#f1f5f9",
  },
  dialogCancelText: {
    color: "#64748b",
    fontWeight: "700",
    fontSize: 12,
  },
  dialogSaveBtn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
    backgroundColor: Theme.colors.primary,
  },
  dialogSaveText: {
    color: "#ffffff",
    fontWeight: "700",
    fontSize: 12,
  },
  priceSheet: {
    backgroundColor: "#ffffff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 12,
  },
  sheetHeader: {
    alignItems: "center",
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  sheetHeaderBar: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#e2e8f0",
    marginBottom: 16,
  },
  sheetTitleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    width: "100%",
  },
  sheetTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: Theme.colors.primaryDark,
  },
  sheetBody: {
    padding: 20,
    gap: 14,
  },
  priceDetailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  priceDetailLabel: {
    fontSize: 13,
    color: "#64748b",
    fontWeight: "600",
  },
  priceDetailVal: {
    fontSize: 13,
    color: "#1e293b",
    fontWeight: "700",
  },
  sheetDivider: {
    height: 1,
    backgroundColor: "#F1F5F9",
    marginVertical: 4,
  },
  priceDetailRowTotal: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  priceTotalLabel: {
    fontSize: 15,
    fontWeight: "800",
    color: Theme.colors.primaryDark,
  },
  priceTotalVal: {
    fontSize: 18,
    fontWeight: "900",
    color: Theme.colors.primary,
  },
  sheetCloseBtn: {
    marginHorizontal: 20,
    marginBottom: 10,
    backgroundColor: Theme.colors.primary,
    borderRadius: 14,
    height: 50,
    justifyContent: "center",
    alignItems: "center",
  },
  sheetCloseBtnText: {
    color: "#ffffff",
    fontWeight: "700",
    fontSize: 15,
  },
  loaderOverlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.4)",
    justifyContent: "center",
    alignItems: "center",
  },
  loaderCard: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 24,
    alignItems: "center",
    gap: 12,
  },
  loaderText: {
    fontSize: 13,
    color: "#475569",
    fontWeight: "700",
  },
  invoiceDocCard: {
    backgroundColor: "#ffffff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    height: "85%",
  },
  invoiceDocHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  businessName: {
    fontSize: 16,
    fontWeight: "900",
    color: Theme.colors.primary,
  },
  businessAddr: {
    fontSize: 11,
    color: "#64748b",
    fontWeight: "500",
    marginTop: 2,
  },
  businessGst: {
    fontSize: 10,
    color: "#94a3b8",
    fontWeight: "600",
    marginTop: 2,
  },
  docBadge: {
    backgroundColor: "#E6F4EA",
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 6,
  },
  docBadgeText: {
    fontSize: 10,
    fontWeight: "800",
    color: "#137333",
  },
  invoiceDivider: {
    height: 1.5,
    borderStyle: "dashed",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    marginVertical: 14,
    borderRadius: 1,
  },
  invoiceMetaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  invoiceMetaTitle: {
    fontSize: 10,
    fontWeight: "800",
    color: "#94A3B8",
    marginBottom: 4,
  },
  invoiceClientName: {
    fontSize: 13,
    fontWeight: "800",
    color: Theme.colors.primaryDark,
  },
  invoiceClientAddr: {
    fontSize: 11,
    color: "#64748b",
    lineHeight: 15,
    marginTop: 2,
    width: 180,
  },
  invoiceMetaText: {
    fontSize: 11,
    color: "#475569",
    marginBottom: 4,
    fontWeight: "500",
  },
  printBtn: {
    flex: 1,
    flexDirection: "row",
    backgroundColor: "#F1F5F9",
    borderRadius: 12,
    height: 48,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#CBD5E1",
  },
  printBtnText: {
    color: "#475569",
    fontWeight: "700",
    fontSize: 14,
  },
  downloadBtn: {
    flex: 1.5,
    flexDirection: "row",
    backgroundColor: Theme.colors.primary,
    borderRadius: 12,
    height: 48,
    justifyContent: "center",
    alignItems: "center",
  },
  downloadBtnText: {
    color: "#ffffff",
    fontWeight: "700",
    fontSize: 14,
  },
  invoiceItemsTable: {
    flex: 1,
    marginTop: 4,
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#F8FAFC",
    padding: 8,
    borderRadius: 6,
  },
  thText: {
    fontSize: 11,
    fontWeight: "800",
    color: "#475569",
  },
  tableScroll: {
    flex: 1,
  },
  tableRow: {
    flexDirection: "row",
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
    alignItems: "center",
  },
  tdText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#334155",
  },
  invoiceSummaryCol: {
    alignItems: "flex-end",
    gap: 6,
    paddingTop: 4,
    marginBottom: 14,
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: "60%",
  },
  summaryLabel: {
    fontSize: 11,
    color: "#64748b",
    fontWeight: "500",
  },
  summaryValue: {
    fontSize: 11,
    color: "#1e293b",
    fontWeight: "700",
  },
  summaryRowTotal: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: "60%",
    borderTopWidth: 1,
    borderTopColor: "#E2E8F0",
    paddingTop: 8,
    marginTop: 4,
  },
  summaryLabelTotal: {
    fontSize: 13,
    fontWeight: "800",
    color: Theme.colors.primaryDark,
  },
  summaryValueTotal: {
    fontSize: 14,
    fontWeight: "900",
    color: Theme.colors.primary,
  },
  docActions: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
  },
  bold: {
    fontWeight: "700",
    color: "#1e293b",
  },
  optionIconBg: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  choiceSubtitle: {
    fontSize: 13,
    color: "#64748b",
    marginBottom: 16,
    fontWeight: "500",
    textAlign: "center",
  },
  choiceOptionBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 14,
    padding: 12,
    marginBottom: 12,
  },
  choiceTextCol: {
    flex: 1,
    marginLeft: 12,
    marginRight: 12,
  },
  choiceOptionTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: "#1e293b",
  },
  choiceOptionSub: {
    fontSize: 11,
    color: "#64748b",
    marginTop: 2,
    fontWeight: "500",
  },
});




