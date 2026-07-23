import React, { useState, useEffect } from "react";
import {
  Text,
  View,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  StatusBar,
  ActivityIndicator,
  Alert,
  Platform,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { Theme, shadowStyle } from "../constants/theme";
import { authStore, Address } from "../services/authStore";
import {
  subscribeProductsByState,
  Product,
  cleanProductName,
  formatPrice,
  getActualInrPrice,
} from "../services/productService";

export default function CartScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  // Cart quantities state subscribed to authStore
  const [cartQuantities, setCartQuantities] = useState<{ [key: number]: number }>(authStore.getCart());
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [isBlocked, setIsBlocked] = useState(authStore.getIsBlocked());

  // Checkout and placement options
  const [deliveryOption, setDeliveryOption] = useState<"standard" | "express">("standard");
  const [paymentMethod, setPaymentMethod] = useState<"cod" | "upi" | "card">("upi");
  const [isPlacingOrder, setIsPlacingOrder] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState(false);
  const [placedOrderId, setPlacedOrderId] = useState("");

  const detectedState = authStore.getDetectedState() || "Delhi";
  const currentUser = authStore.getCurrentUser();

  // Address selection state
  const [selectedAddress, setSelectedAddress] = useState<Address | null>(authStore.getSelectedAddress());

  // Subscribe to user addresses in real-time
  useEffect(() => {
    const unsubscribe = authStore.subscribeAddresses(
      (list) => {
        const storeSelectedId = authStore.getSelectedAddressId();
        if (storeSelectedId) {
          const found = list.find((a) => a.addressId === storeSelectedId);
          if (found) {
            setSelectedAddress(found);
            authStore.setSelectedAddress(found);
          } else if (list.length > 0) {
            const def = list.find((a) => a.isDefault) || list[0];
            setSelectedAddress(def);
            authStore.setSelectedAddressId(def.addressId);
            authStore.setSelectedAddress(def);
          } else {
            setSelectedAddress(null);
          }
        } else if (list.length > 0) {
          const def = list.find((a) => a.isDefault) || list[0];
          setSelectedAddress(def);
          authStore.setSelectedAddressId(def.addressId);
          authStore.setSelectedAddress(def);
        } else {
          setSelectedAddress(null);
        }
      },
      (error) => {
        console.error("Cart screen address loading error:", error);
      }
    );
    return () => unsubscribe();
  }, []);

  // Subscribe to global cart updates
  useEffect(() => {
    const unsubscribe = authStore.subscribeCart(() => {
      setCartQuantities(authStore.getCart());
      setIsBlocked(authStore.getIsBlocked());
    });
    return () => unsubscribe();
  }, []);

  // Fetch product catalog for resolving item metadata
  useEffect(() => {
    setLoading(true);
    const unsubscribe = subscribeProductsByState(
      detectedState,
      (data) => {
        setProducts(data);
        setLoading(false);
      },
      (error) => {
        console.error("Failed to load products for cart:", error);
        setLoading(false);
      }
    );
    return () => unsubscribe();
  }, [detectedState]);

  // Derived list of cart items
  const cartItems = Object.entries(cartQuantities)
    .map(([idStr, qty]) => {
      const prodId = parseInt(idStr);
      const prod = products.find((p) => p.id === prodId);
      return { prod, qty };
    })
    .filter((item): item is { prod: Product; qty: number } => item.prod !== undefined && item.qty > 0);

  // Cart calculations
  const totalCartItems = cartItems.reduce((acc, item) => acc + item.qty, 0);
  const totalCartPrice = cartItems.reduce((acc, item) => {
    const price = getActualInrPrice(item.prod.price);
    return acc + price * item.qty;
  }, 0);

  const deliveryFee = deliveryOption === "express" ? 60 : totalCartPrice > 500 ? 0 : 40;
  const grandTotal = totalCartPrice > 0 ? totalCartPrice + deliveryFee : 0;

  const handleUpdateQuantity = (productId: number, change: number) => {
    if (isBlocked) {
      Alert.alert(
        "Account Blocked",
        "Your account has been temporarily blocked. You cannot place orders until your account is restored."
      );
      return;
    }
    authStore.updateCart(productId, change);
  };

  const handleClearCart = () => {
    if (isBlocked) {
      Alert.alert(
        "Account Blocked",
        "Your account has been temporarily blocked. You cannot place orders until your account is restored."
      );
      return;
    }
    Alert.alert("Clear Cart", "Are you sure you want to remove all items from your cart?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Clear Cart",
        style: "destructive",
        onPress: () => authStore.clearCart(),
      },
    ]);
  };

  const handlePlaceOrder = async () => {
    if (isBlocked) {
      Alert.alert(
        "Account Blocked",
        "Your account has been temporarily blocked. You cannot place orders until your account is restored."
      );
      return;
    }
    if (cartItems.length === 0) return;
    if (!selectedAddress) {
      Alert.alert(
        "Delivery address required",
        "Please select or add a delivery address before placing your order."
      );
      router.push("/select-address" as any);
      return;
    }

    setIsPlacingOrder(true);
    try {
      const items = cartItems.map((item) => ({
        productId: item.prod.id,
        name: item.prod.name,
        price: getActualInrPrice(item.prod.price),
        quantity: item.qty,
        imageUrl: item.prod.imageUrl,
      }));

      const formattedAddress = `${selectedAddress.houseNo}, ${selectedAddress.building ? `${selectedAddress.building}, ` : ""}${selectedAddress.street}, ${selectedAddress.landmark ? `Landmark: ${selectedAddress.landmark}, ` : ""}${selectedAddress.city}, ${selectedAddress.state} - ${selectedAddress.pinCode}`;

      const orderId = await authStore.placeOrder({
        items,
        totalAmount: grandTotal,
        deliveryCharge: deliveryFee,
        address: formattedAddress,
        deliveryAddress: {
          fullName: selectedAddress.fullName,
          mobile: selectedAddress.mobile,
          houseNo: selectedAddress.houseNo,
          building: selectedAddress.building || "",
          street: selectedAddress.street,
          landmark: selectedAddress.landmark || "",
          city: selectedAddress.city,
          state: selectedAddress.state,
          pinCode: selectedAddress.pinCode,
          addressType: selectedAddress.addressType,
          latitude: selectedAddress.latitude || null,
          longitude: selectedAddress.longitude || null
        },
        paymentMethod:
          paymentMethod === "cod"
            ? "Cash on Delivery"
            : paymentMethod === "upi"
            ? "UPI (Google Pay/PhonePe)"
            : "Credit/Debit Card",
        deliveryOption:
          deliveryOption === "express" ? "Express Delivery" : "Standard Delivery",
      });

      setPlacedOrderId(orderId);
      setOrderSuccess(true);

      // Trigger confirmation email in the background asynchronously
      const API_URL = process.env.EXPO_PUBLIC_OTP_URL || (Platform.OS === "android" ? "http://10.0.2.2:3000" : "http://localhost:3000");
      const userEmail = currentUser?.email || "";
      if (userEmail) {
        fetch(`${API_URL}/send-order-confirmation`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            email: userEmail,
            orderId,
            totalAmount: grandTotal,
            deliveryCharge: deliveryFee,
            items,
            address: formattedAddress,
            paymentMethod:
              paymentMethod === "cod"
                ? "Cash on Delivery"
                : paymentMethod === "upi"
                ? "UPI (Google Pay/PhonePe)"
                : "Credit/Debit Card",
            deliveryOption:
              deliveryOption === "express" ? "Express Delivery" : "Standard Delivery",
          }),
        })
          .then((res) => res.json())
          .then((data) => {
            console.log("[Confirmation Email] Sent status:", data);
          })
          .catch((err) => {
            console.warn("[Confirmation Email] Failed to send email:", err);
          });
      }
    } catch (error: any) {
      Alert.alert("Checkout Error", error.message || "Failed to place order. Please try again.");
    } finally {
      setIsPlacingOrder(false);
    }
  };

  const handleGoBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/(tabs)/home");
    }
  };

  if (loading) {
    return (
      <View style={[styles.centered, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={Theme.colors.primary} />
        <Text style={styles.loadingText}>Syncing your cart...</Text>
      </View>
    );
  }

  if (orderSuccess) {
    return (
      <View style={[styles.successContainer, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
        <View style={styles.successContent}>
          <View style={styles.successIconWrapper}>
            <Ionicons name="checkmark-circle" size={100} color="#22c55e" />
          </View>
          <Text style={styles.successTitle}>Order Placed!</Text>
          <Text style={styles.successDesc}>
            Your order has been placed successfully.{"\n"}
            Order ID: <Text style={styles.boldText}>#{placedOrderId.slice(-6).toUpperCase()}</Text>
          </Text>
          <Text style={styles.successSubDesc}>
            It will be delivered shortly.
          </Text>
        </View>

        <View style={styles.successFooter}>
          <TouchableOpacity
            style={styles.viewOrdersBtn}
            activeOpacity={0.8}
            onPress={() => router.replace("/(tabs)/orders")}
          >
            <Text style={styles.viewOrdersBtnText}>View My Orders</Text>
            <Ionicons name="arrow-forward" size={18} color="#ffffff" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.backHomeBtn}
            activeOpacity={0.8}
            onPress={() => router.replace("/(tabs)/home")}
          >
            <Text style={styles.backHomeBtnText}>Go to Home</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleGoBack} style={styles.headerIconBtn}>
          <Ionicons name="arrow-back" size={24} color={Theme.colors.primaryDark} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Cart</Text>
        {cartItems.length > 0 ? (
          <TouchableOpacity onPress={handleClearCart} style={styles.headerIconBtn}>
            <Ionicons name="trash-outline" size={22} color="#ef4444" />
          </TouchableOpacity>
        ) : (
          <View style={{ width: 40 }} />
        )}
      </View>

      {cartItems.length > 0 ? (
        <>
          <ScrollView
            style={styles.scrollContainer}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {/* Blocked Account Banner */}
            {isBlocked && (
              <View style={styles.blockedBanner}>
                <Ionicons name="alert-circle" size={18} color="#ffffff" style={{ marginRight: 8 }} />
                <Text style={styles.blockedBannerText}>
                  Your account is currently blocked. Ordering has been disabled.
                </Text>
              </View>
            )}

            {/* Delivery Location Section */}
            <View style={styles.card}>
              <View style={styles.addressRow}>
                <View style={styles.addressIconBg}>
                  <Ionicons name="location" size={20} color={Theme.colors.primary} />
                </View>
                <View style={styles.addressDetails}>
                  <Text style={styles.addressTitle}>
                    {selectedAddress
                      ? `Delivering to ${selectedAddress.fullName} (${selectedAddress.addressType})`
                      : "No Delivery Address Selected"}
                  </Text>
                  <Text style={styles.addressText} numberOfLines={2}>
                    {selectedAddress
                      ? `${selectedAddress.houseNo}, ${selectedAddress.building ? `${selectedAddress.building}, ` : ""}${selectedAddress.street}, ${selectedAddress.city} - ${selectedAddress.pinCode}`
                      : "Please add or select a delivery address to place your order."}
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.changeAddressBtn}
                  onPress={() => router.push("/select-address" as any)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.changeAddressBtnText}>
                    {selectedAddress ? "Change" : "Add Address"}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Cart Items List */}
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Items in Cart</Text>
              <View style={styles.itemsList}>
                {cartItems.map(({ prod, qty }) => {
                  const itemPrice = getActualInrPrice(prod.price);
                  return (
                    <View key={prod.id} style={styles.cartItemRow}>
                      <View style={styles.imageWrapper}>
                        <Image source={prod.imageUrl} style={styles.itemImage} contentFit="contain" />
                      </View>
                      <View style={styles.itemDetails}>
                        <Text style={styles.itemName} numberOfLines={1}>
                          {cleanProductName(prod.name)}
                        </Text>
                        <Text style={styles.itemWeight}>{prod.weight}</Text>
                        <Text style={styles.itemPriceText}>
                          {formatPrice(prod.price)} x {qty}
                        </Text>
                      </View>
                      <View style={styles.actionCol}>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                          <TouchableOpacity
                            onPress={() => handleUpdateQuantity(prod.id, -qty)}
                            activeOpacity={0.7}
                            style={{ padding: 4 }}
                          >
                            <Ionicons name="trash-outline" size={16} color="#ef4444" />
                          </TouchableOpacity>
                          <Text style={styles.rowTotalPrice}>
                            Rs. {itemPrice * qty}
                          </Text>
                        </View>
                        <View style={styles.qtyContainer}>
                          <TouchableOpacity
                            style={styles.qtyBtn}
                            onPress={() => handleUpdateQuantity(prod.id, -1)}
                          >
                            <Ionicons name="remove" size={14} color="#ffffff" />
                          </TouchableOpacity>
                          <Text style={styles.qtyText}>{qty}</Text>
                          <TouchableOpacity
                            style={styles.qtyBtn}
                            onPress={() => handleUpdateQuantity(prod.id, 1)}
                          >
                            <Ionicons name="add" size={14} color="#ffffff" />
                          </TouchableOpacity>
                        </View>
                      </View>
                    </View>
                  );
                })}
              </View>
            </View>

            {/* Delivery Option Selector */}
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Delivery Speed</Text>
              <View style={styles.optionsRow}>
                <TouchableOpacity
                  style={[
                    styles.optionCard,
                    deliveryOption === "standard" && styles.optionCardSelected,
                  ]}
                  onPress={() => setDeliveryOption("standard")}
                >
                  <Ionicons
                    name="time-outline"
                    size={22}
                    color={
                      deliveryOption === "standard" ? Theme.colors.primary : "#64748b"
                    }
                  />
                  <Text style={styles.optionName}>Standard</Text>
                  <Text style={styles.optionSub}>
                    30-40 mins - {totalCartPrice > 500 ? "FREE" : "Rs. 40"}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.optionCard,
                    deliveryOption === "express" && styles.optionCardSelected,
                  ]}
                  onPress={() => setDeliveryOption("express")}
                >
                  <Ionicons
                    name="flash-outline"
                    size={22}
                    color={
                      deliveryOption === "express" ? Theme.colors.primary : "#64748b"
                    }
                  />
                  <Text style={styles.optionName}>Express</Text>
                  <Text style={styles.optionSub}>10-15 mins - Rs. 60</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Payment Method Selector */}
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Payment Method</Text>
              <View style={styles.paymentContainer}>
                <TouchableOpacity
                  style={[
                    styles.paymentCard,
                    paymentMethod === "upi" && styles.paymentCardSelected,
                  ]}
                  onPress={() => setPaymentMethod("upi")}
                >
                  <Ionicons
                    name="phone-portrait-outline"
                    size={20}
                    color={paymentMethod === "upi" ? Theme.colors.primary : "#64748b"}
                  />
                  <Text style={styles.paymentText}>UPI (Paytm/GPay/PhonePe)</Text>
                  <Ionicons
                    name={
                      paymentMethod === "upi"
                        ? "checkmark-circle"
                        : "ellipse-outline"
                    }
                    size={20}
                    color={paymentMethod === "upi" ? Theme.colors.primary : "#cbd5e1"}
                    style={{ marginLeft: "auto" }}
                  />
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.paymentCard,
                    paymentMethod === "card" && styles.paymentCardSelected,
                  ]}
                  onPress={() => setPaymentMethod("card")}
                >
                  <Ionicons
                    name="card-outline"
                    size={20}
                    color={paymentMethod === "card" ? Theme.colors.primary : "#64748b"}
                  />
                  <Text style={styles.paymentText}>Credit / Debit Card</Text>
                  <Ionicons
                    name={
                      paymentMethod === "card"
                        ? "checkmark-circle"
                        : "ellipse-outline"
                    }
                    size={20}
                    color={paymentMethod === "card" ? Theme.colors.primary : "#cbd5e1"}
                    style={{ marginLeft: "auto" }}
                  />
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.paymentCard,
                    paymentMethod === "cod" && styles.paymentCardSelected,
                  ]}
                  onPress={() => setPaymentMethod("cod")}
                >
                  <Ionicons
                    name="cash-outline"
                    size={20}
                    color={paymentMethod === "cod" ? Theme.colors.primary : "#64748b"}
                  />
                  <Text style={styles.paymentText}>Cash on Delivery (COD)</Text>
                  <Ionicons
                    name={
                      paymentMethod === "cod"
                        ? "checkmark-circle"
                        : "ellipse-outline"
                    }
                    size={20}
                    color={paymentMethod === "cod" ? Theme.colors.primary : "#cbd5e1"}
                    style={{ marginLeft: "auto" }}
                  />
                </TouchableOpacity>
              </View>
            </View>

            {/* Bill Details */}
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Bill Details</Text>
              <View style={styles.billDetailsContainer}>
                <View style={styles.billRow}>
                  <Text style={styles.billLabel}>Item Total</Text>
                  <Text style={styles.billValue}>Rs. {totalCartPrice}</Text>
                </View>
                <View style={styles.billRow}>
                  <Text style={styles.billLabel}>Delivery Charges</Text>
                  <Text style={styles.billValue}>
                    {deliveryFee === 0 ? (
                      <Text style={styles.freeText}>FREE</Text>
                    ) : (
                      `Rs. ${deliveryFee}`
                    )}
                  </Text>
                </View>
                <View style={styles.billDivider} />
                <View style={styles.billRow}>
                  <Text style={styles.grandTotalLabel}>Grand Total</Text>
                  <Text style={styles.grandTotalValue}>Rs. {grandTotal}</Text>
                </View>
              </View>
            </View>
          </ScrollView>

          {/* Sticky Bottom Place Order bar */}
          <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, 16) }]}>
            <View style={styles.bottomBarLeft}>
              <Text style={styles.totalPrice}>Rs. {grandTotal}</Text>
              <Text style={styles.totalPriceSub}>
                {totalCartItems} Item{totalCartItems > 1 ? "s" : ""}
              </Text>
            </View>
            <TouchableOpacity
              style={[
                styles.placeOrderBtn,
                (isPlacingOrder || isBlocked) && { opacity: 0.5, backgroundColor: "#94a3b8" }
              ]}
              activeOpacity={0.8}
              onPress={handlePlaceOrder}
              disabled={isPlacingOrder || isBlocked}
            >
              {isPlacingOrder ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <>
                  <Text style={styles.placeOrderText}>Place Order</Text>
                  <Ionicons name="chevron-forward" size={16} color="#ffffff" />
                </>
              )}
            </TouchableOpacity>
          </View>
        </>
      ) : (
        /* Empty State */
        <View style={styles.emptyContainer}>
          <View style={styles.emptyIconBg}>
            <Ionicons name="basket-outline" size={70} color="#94a3b8" />
          </View>
          <Text style={styles.emptyTitle}>Your Cart is Empty</Text>
          <Text style={styles.emptySub}>
            Looks like you haven&apos;t added anything to your cart yet. Let&apos;s find some delicious items!
          </Text>
          <TouchableOpacity
            style={styles.startBtn}
            activeOpacity={0.8}
            onPress={() => router.replace("/(tabs)/home")}
          >
            <Text style={styles.startBtnText}>Start Shopping</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#ffffff",
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: "#475569",
    fontWeight: "600",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#ffffff",
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },
  headerIconBtn: {
    padding: 6,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "900",
    color: Theme.colors.primaryDark,
  },
  scrollContainer: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    gap: 16,
    paddingBottom: 100,
  },
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.02,
    shadowRadius: 4,
    elevation: 1,
  },
  addressRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  addressIconBg: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#f0fdf4",
    justifyContent: "center",
    alignItems: "center",
  },
  changeAddressBtn: {
    backgroundColor: Theme.colors.primary,
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  changeAddressBtnText: {
    fontSize: 12,
    fontWeight: "800",
    color: "#ffffff",
  },
  addressDetails: {
    flex: 1,
    gap: 2,
  },
  addressTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: Theme.colors.primaryDark,
  },
  addressText: {
    fontSize: 12,
    color: "#64748b",
    fontWeight: "500",
    lineHeight: 16,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: Theme.colors.primaryDark,
    marginBottom: 12,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  itemsList: {
    gap: 16,
  },
  cartItemRow: {
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
    paddingBottom: 16,
  },
  imageWrapper: {
    width: 60,
    height: 60,
    backgroundColor: "#f8fafc",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#f1f5f9",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  itemImage: {
    width: "80%",
    height: "80%",
  },
  itemDetails: {
    flex: 1,
    marginRight: 12,
  },
  itemName: {
    fontSize: 13,
    fontWeight: "800",
    color: "#1e293b",
  },
  itemWeight: {
    fontSize: 11,
    color: "#64748b",
    fontWeight: "600",
    marginTop: 2,
  },
  itemPriceText: {
    fontSize: 11,
    color: Theme.colors.primary,
    fontWeight: "700",
    marginTop: 4,
  },
  actionCol: {
    alignItems: "flex-end",
    gap: 8,
  },
  rowTotalPrice: {
    fontSize: 13,
    fontWeight: "900",
    color: Theme.colors.primaryDark,
  },
  qtyContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Theme.colors.primary,
    borderRadius: 8,
    overflow: "hidden",
  },
  qtyBtn: {
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  qtyText: {
    color: "#ffffff",
    fontSize: 11,
    fontWeight: "900",
    paddingHorizontal: 6,
  },
  optionsRow: {
    flexDirection: "row",
    gap: 12,
  },
  optionCard: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: "#e2e8f0",
    borderRadius: 14,
    padding: 12,
    alignItems: "center",
    backgroundColor: "#ffffff",
    gap: 4,
  },
  optionCardSelected: {
    borderColor: Theme.colors.primary,
    backgroundColor: "#f0fdf4",
  },
  optionName: {
    fontSize: 13,
    fontWeight: "800",
    color: Theme.colors.primaryDark,
  },
  optionSub: {
    fontSize: 10,
    color: "#64748b",
    fontWeight: "600",
  },
  paymentContainer: {
    gap: 10,
  },
  paymentCard: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: "#e2e8f0",
    borderRadius: 14,
    padding: 12,
    backgroundColor: "#ffffff",
    gap: 10,
  },
  paymentCardSelected: {
    borderColor: Theme.colors.primary,
    backgroundColor: "#f0fdf4",
  },
  paymentText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#1e293b",
  },
  billDetailsContainer: {
    gap: 10,
  },
  billRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  billLabel: {
    fontSize: 12,
    color: "#475569",
    fontWeight: "600",
  },
  billValue: {
    fontSize: 13,
    fontWeight: "800",
    color: Theme.colors.primaryDark,
  },
  freeText: {
    color: "#22c55e",
    fontWeight: "800",
  },
  billDivider: {
    height: 1,
    backgroundColor: "#f1f5f9",
    marginVertical: 4,
  },
  grandTotalLabel: {
    fontSize: 14,
    fontWeight: "800",
    color: Theme.colors.primaryDark,
  },
  grandTotalValue: {
    fontSize: 16,
    fontWeight: "900",
    color: Theme.colors.primary,
  },
  bottomBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#ffffff",
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  bottomBarLeft: {
    gap: 2,
  },
  totalPrice: {
    fontSize: 18,
    fontWeight: "900",
    color: Theme.colors.primary,
  },
  totalPriceSub: {
    fontSize: 11,
    color: "#64748b",
    fontWeight: "600",
  },
  placeOrderBtn: {
    backgroundColor: Theme.colors.primary,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    gap: 6,
    shadowColor: Theme.colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 2,
  },
  placeOrderText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "800",
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
    gap: 16,
  },
  emptyIconBg: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: "#f1f5f9",
    alignItems: "center",
    justifyContent: "center",
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "900",
    color: Theme.colors.primaryDark,
  },
  emptySub: {
    fontSize: 13,
    color: "#64748b",
    textAlign: "center",
    lineHeight: 20,
    paddingHorizontal: 24,
  },
  startBtn: {
    backgroundColor: Theme.colors.primary,
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 14,
    marginTop: 8,
    ...shadowStyle("#2a5d4c", 4, 0.15, 8, 3),
  },
  startBtnText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "800",
  },
  successContainer: {
    flex: 1,
    backgroundColor: "#ffffff",
    padding: 24,
  },
  successContent: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 16,
  },
  successIconWrapper: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: "#f0fdf4",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  successTitle: {
    fontSize: 24,
    fontWeight: "900",
    color: Theme.colors.primaryDark,
  },
  successDesc: {
    fontSize: 14,
    color: "#475569",
    textAlign: "center",
    lineHeight: 22,
  },
  successSubDesc: {
    fontSize: 12,
    color: "#94a3b8",
    fontWeight: "600",
  },
  boldText: {
    fontWeight: "800",
    color: Theme.colors.primary,
  },
  successFooter: {
    gap: 12,
    width: "100%",
  },
  viewOrdersBtn: {
    backgroundColor: Theme.colors.primary,
    flexDirection: "row",
    height: 48,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 14,
    gap: 8,
    ...shadowStyle("#2a5d4c", 4, 0.2, 8, 3),
  },
  viewOrdersBtnText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "800",
  },
  backHomeBtn: {
    height: 48,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: "#e2e8f0",
  },
  backHomeBtnText: {
    color: "#475569",
    fontSize: 14,
    fontWeight: "800",
  },
  blockedBanner: {
    backgroundColor: "#ef4444",
    padding: 12,
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  blockedBannerText: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "700",
    flex: 1,
  },
});
