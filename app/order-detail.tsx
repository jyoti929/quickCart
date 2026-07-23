import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  StatusBar,
  ActivityIndicator,
  Modal,
  Alert,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Image } from "expo-image";
import { Theme } from "../constants/theme";
import { authStore } from "../services/authStore";
import ChatbotModal from "../components/ChatbotModal";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "../services/firebase";

export default function OrderDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const insets = useSafeAreaInsets();
  const orderId = params.orderId as string;

  const [order, setOrder] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  // UI state variables
  const [timelineExpanded, setTimelineExpanded] = useState(true);
  const [userRating, setUserRating] = useState(0);

  // Modals state
  const [chatbotVisible, setChatbotVisible] = useState(false);
  const [invoiceModalVisible, setInvoiceModalVisible] = useState(false);
  const [invoiceDownloading, setInvoiceDownloading] = useState(false);
  const [priceDetailsVisible, setPriceDetailsVisible] = useState(false);
  const [invoiceChoiceVisible, setInvoiceChoiceVisible] = useState(false);
  const [invoiceSendingEmail, setInvoiceSendingEmail] = useState(false);

  // Fetch specific order details
  const fetchOrderDetails = useCallback(async () => {
    if (!orderId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      // Fetch directly from firestore orders collection
      const orderDoc = await getDoc(doc(db, "orders", orderId));
      if (orderDoc.exists()) {
        const data = orderDoc.data();
        if (data.uid && auth.currentUser && data.uid !== auth.currentUser.uid) {
          Alert.alert("Error", "This order does not belong to the current user.");
          router.back();
          return;
        }
        setOrder({ orderId: orderDoc.id, ...data });
      } else {
        // Fallback: search in all user orders
        const allOrders = await authStore.fetchUserOrders();
        const found = allOrders.find((o) => o.orderId === orderId);
        if (found) {
          setOrder(found);
        } else {
          Alert.alert("Error", "Order not found in history.");
          router.back();
        }
      }
    } catch (error) {
      console.error("Failed to load order details:", error);
      Alert.alert("Error", "Failed to fetch order details. Please check connection.");
    } finally {
      setLoading(false);
    }
  }, [orderId, router]);

  useEffect(() => {
    fetchOrderDetails();
  }, [fetchOrderDetails]);

  // Utility to format date to long string e.g., 24th May, 2024
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

  // Estimate delivery (2 days from order placement)
  const getEstDeliveryDate = (isoString?: string) => {
    if (!isoString) return "";
    try {
      const d = new Date(isoString);
      d.setDate(d.getDate() + 2);
      return formatDateLong(d.toISOString());
    } catch {
      return "";
    }
  };

  // Helper to parse tracker status variables
  const getStatusStep = (status: string) => {
    const s = (status || "Placed").toLowerCase();
    if (s === "cancelled") return -1;
    if (s === "delivered") return 3;
    if (s === "shipped" || s === "out for delivery" || s === "out_for_delivery" || s === "transit") return 2;
    if (s === "confirmed" || s === "preparing to pack" || s === "processing") return 1;
    return 0; // Placed / Pending
  };

  const handleRateProduct = (starIndex: number) => {
    setUserRating(starIndex);
    if (Platform.OS === "web") {
      window.alert(`Thank you! Your ${starIndex}-star rating has been recorded.`);
    } else {
      Alert.alert("Rating Submitted", `Thank you! Your ${starIndex}-star rating has been recorded.`);
    }
  };

  const triggerInvoiceDownload = () => {
    setInvoiceDownloading(true);
    setTimeout(() => {
      setInvoiceDownloading(false);
      setInvoiceModalVisible(true);
    }, 1500); // 1.5s simulation loader
  };

  const handleEmailInvoice = async () => {
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
          orderId: order.orderId,
          totalAmount: order.totalAmount,
          deliveryCharge: order.deliveryCharge ?? 40,
          items: order.items,
          address: order.address,
          paymentMethod: order.paymentMethod || "UPI",
          deliveryOption: order.deliveryOption || "Standard Delivery",
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

  if (loading) {
    return (
      <View style={[styles.loadingContainer, { paddingTop: insets.top }]}>
        <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
        <ActivityIndicator size="large" color={Theme.colors.primary} />
        <Text style={styles.loadingText}>Fetching order details...</Text>
      </View>
    );
  }

  if (!order) {
    return (
      <View style={[styles.errorContainer, { paddingTop: insets.top }]}>
        <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
        <Ionicons name="alert-circle-outline" size={64} color={Theme.colors.error} />
        <Text style={styles.errorText}>No order details found.</Text>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backBtnText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const isDelivered = order.status === "Delivered";
  const statusStep = getStatusStep(order.status);
  const currentStatusDesc = order.status || "Placed";

  // Financial Breakdown calculations
  const deliveryCharge = order.deliveryCharge ?? 40;
  const grandTotal = order.totalAmount ?? 0;
  // Subtotal is grandTotal minus delivery charge (simulate tax deductions)
  const promoDiscount = grandTotal > 1500 ? 100 : grandTotal > 500 ? 50 : 0;
  const subtotal = Math.max(0, grandTotal - deliveryCharge + promoDiscount);
  const calculatedTax = Math.round(subtotal * 0.05); // 5% GST

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />

      {/* Screen Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerBackIcon} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={24} color={Theme.colors.primaryDark} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Order Summary</Text>
        <View style={styles.headerPlaceholder} />
      </View>

      <ScrollView style={styles.scrollArea} showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* Order Details Header */}
        <View style={styles.orderHeaderCard}>
          <View style={styles.metaRow}>
            <View>
              <Text style={styles.metaLabel}>ORDER NUMBER</Text>
              <Text style={styles.metaValue}>{order.orderId}</Text>
            </View>
            <View style={styles.totalWrapper}>
              <Text style={styles.totalLabel}>TOTAL</Text>
              <Text style={styles.totalValue}>Rs. {grandTotal.toFixed(2)}</Text>
            </View>
          </View>
          <View style={styles.metaDivider} />
          <View style={styles.placedRow}>
            <View>
              <Text style={styles.metaLabel}>PLACED</Text>
              <Text style={styles.placedValue}>{formatDateLong(order.createdAt)}</Text>
            </View>
          </View>
        </View>

        {/* Status Timeline Accordion */}
        <View style={styles.accordionContainer}>
          <TouchableOpacity
            style={styles.accordionHeader}
            activeOpacity={0.8}
            onPress={() => setTimelineExpanded(!timelineExpanded)}
          >
            <View style={styles.accordionTitleCol}>
              <Text style={styles.accordionTitle}>{currentStatusDesc}</Text>
              {statusStep !== -1 && statusStep < 3 && (
                <Text style={styles.accordionSub}>
                  Estimated Delivery Date : {getEstDeliveryDate(order.createdAt)}
                </Text>
              )}
              {statusStep === 3 && (
                <Text style={styles.accordionSub}>
                  Successfully delivered on {formatDateLong(order.createdAt)}
                </Text>
              )}
            </View>
            <Ionicons
              name={timelineExpanded ? "chevron-up" : "chevron-down"}
              size={20}
              color={Theme.colors.primaryDark}
            />
          </TouchableOpacity>

          {timelineExpanded && statusStep !== -1 && (
            <View style={styles.timelineBody}>
              {/* Step 1: Confirmed */}
              <View style={styles.timelineRow}>
                <View style={styles.timelineIconCol}>
                  <View style={[styles.timelineNode, statusStep >= 1 && styles.nodeActive]}>
                    {statusStep >= 1 ? (
                      <Ionicons name="checkmark" size={14} color="#ffffff" />
                    ) : (
                      <View style={styles.nodeDot} />
                    )}
                  </View>
                  <View style={[styles.timelineLine, statusStep >= 2 && styles.lineActive]} />
                </View>
                <View style={styles.timelineTextCol}>
                  <Text style={[styles.timelineLabel, statusStep >= 1 && styles.labelActive]}>
                    Order Confirmed
                  </Text>
                  <Text style={styles.timelineSubText}>
                    {statusStep >= 1 ? formatDateLong(order.createdAt) : "Not Yet"}
                  </Text>
                </View>
              </View>

              {/* Step 2: Shipped */}
              <View style={styles.timelineRow}>
                <View style={styles.timelineIconCol}>
                  <View style={[styles.timelineNode, statusStep >= 2 && styles.nodeActive]}>
                    {statusStep >= 2 ? (
                      <Ionicons name="checkmark" size={14} color="#ffffff" />
                    ) : (
                      <View style={styles.nodeDot} />
                    )}
                  </View>
                  <View style={[styles.timelineLine, statusStep >= 3 && styles.lineActive]} />
                </View>
                <View style={styles.timelineTextCol}>
                  <Text style={[styles.timelineLabel, statusStep >= 2 && styles.labelActive]}>
                    Shipped
                  </Text>
                  <Text style={styles.timelineSubText}>
                    {statusStep >= 2 ? "In Transit to Hub" : "Not Yet"}
                  </Text>
                </View>
              </View>

              {/* Step 3: Delivered */}
              <View style={styles.timelineRow}>
                <View style={[styles.timelineIconCol, { paddingBottom: 0 }]}>
                  <View style={[styles.timelineNode, statusStep >= 3 && styles.nodeActive]}>
                    {statusStep >= 3 ? (
                      <Ionicons name="checkmark" size={14} color="#ffffff" />
                    ) : (
                      <View style={styles.nodeDot} />
                    )}
                  </View>
                </View>
                <View style={styles.timelineTextCol}>
                  <Text style={[styles.timelineLabel, statusStep >= 3 && styles.labelActive]}>
                    Delivered
                  </Text>
                  <Text style={styles.timelineSubText}>
                    {statusStep >= 3 ? "Package Handed Over" : "Not Yet"}
                  </Text>
                </View>
              </View>
            </View>
          )}
        </View>

        {/* Items Section */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>Ordered Items</Text>
        </View>

        {order.items &&
          order.items.map((item: any, index: number) => {
            const hasSize = !!item.size;
            return (
              <View key={index} style={styles.itemCard}>
                <TouchableOpacity
                  style={styles.itemRow}
                  activeOpacity={0.8}
                  onPress={() => {
                    if (item.productId && item.productId !== 9999) {
                      router.push({
                        pathname: "/product" as any,
                        params: { productId: item.productId.toString() },
                      });
                    } else {
                      Alert.alert("Demo Item", "This clothing item is a mock demo product.");
                    }
                  }}
                >
                  <View style={styles.itemImageBg}>
                    {item.imageUrl ? (
                      <Image source={{ uri: item.imageUrl }} style={styles.itemImage as any} contentFit="contain" />
                    ) : (
                      <Ionicons name="basket-outline" size={24} color="#94a3b8" />
                    )}
                  </View>
                  <View style={styles.itemInfo}>
                    <Text style={styles.itemName} numberOfLines={2}>
                      {item.name}
                    </Text>
                    <Text style={styles.itemDetails}>
                      {hasSize ? `Size: ${item.size}  |  ` : ""}Qty: {item.quantity}
                    </Text>
                    <View style={styles.priceRow}>
                      {item.originalPrice ? (
                        <Text style={styles.mrpText}>Rs. {item.originalPrice.toFixed(2)}</Text>
                      ) : null}
                      <Text style={styles.priceText}>Rs. {item.price.toFixed(2)}</Text>
                    </View>
                  </View>
                </TouchableOpacity>

                {isDelivered && (
                  <View style={styles.ratingSection}>
                    <Text style={styles.ratingLabel}>Rate this product</Text>
                    <View style={styles.starRow}>
                      {[1, 2, 3, 4, 5].map((star) => (
                        <TouchableOpacity
                          key={star}
                          activeOpacity={0.7}
                          onPress={() => handleRateProduct(star)}
                        >
                          <Ionicons
                            name={userRating >= star ? "star" : "star-outline"}
                            size={26}
                            color={userRating >= star ? "#FBBF24" : "#D1D5DB"}
                            style={{ marginRight: 6 }}
                          />
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                )}
              </View>
            );
          })}

        {/* Shipping Address Container */}
        <View style={styles.addressCard}>
          <Text style={styles.addressCardTitle}>SHIPPING ADDRESS</Text>
          {order.deliveryAddress ? (
            <>
              <Text style={styles.addressName}>
                {order.deliveryAddress.fullName} ({order.deliveryAddress.addressType || "Delivery"})
              </Text>
              <Text style={styles.addressText}>
                {order.deliveryAddress.houseNo}, {order.deliveryAddress.building ? `${order.deliveryAddress.building}, ` : ""}
                {order.deliveryAddress.street}
                {order.deliveryAddress.landmark ? `\nLandmark: ${order.deliveryAddress.landmark}` : ""}
                {"\n"}{order.deliveryAddress.city}, {order.deliveryAddress.state} - {order.deliveryAddress.pinCode}
                {"\n"}Mobile: {order.deliveryAddress.mobile}
              </Text>
            </>
          ) : (
            <>
              <Text style={styles.addressName}>{authStore.getCurrentUser()?.name || "Customer"}</Text>
              <Text style={styles.addressText}>{order.address || "Address details unavailable"}</Text>
            </>
          )}
        </View>

        {/* Quick Options Buttons Container */}
        <View style={styles.optionsHeaderRow}>
          <Text style={styles.sectionTitle}>Options</Text>
        </View>

        <View style={styles.optionsGrid}>
          {/* Option: Download Invoice */}
          <TouchableOpacity style={styles.optionBtn} activeOpacity={0.8} onPress={() => setInvoiceChoiceVisible(true)}>
            <View style={[styles.optionIconBg, { backgroundColor: "#ecfdf5" }]}>
              <Ionicons name="document-text" size={24} color="#059669" />
            </View>
            <Text style={styles.optionText}>Download Invoice</Text>
          </TouchableOpacity>

          {/* Option: Price Details */}
          <TouchableOpacity style={styles.optionBtn} activeOpacity={0.8} onPress={() => setPriceDetailsVisible(true)}>
            <View style={[styles.optionIconBg, { backgroundColor: "#eff6ff" }]}>
              <Ionicons name="card" size={24} color="#2563eb" />
            </View>
            <Text style={styles.optionText}>Price Details</Text>
          </TouchableOpacity>

          {/* Option: Order Status */}
          <TouchableOpacity
            style={styles.optionBtn}
            activeOpacity={0.8}
            onPress={() => {
              setTimelineExpanded(true);
              Alert.alert("Order Tracking", `Your order is currently ${order.status}. Estimated Delivery Date is ${getEstDeliveryDate(order.createdAt)}.`);
            }}
          >
            <View style={[styles.optionIconBg, { backgroundColor: "#fef3c7" }]}>
              <Ionicons name="compass" size={24} color="#d97706" />
            </View>
            <Text style={styles.optionText}>Order Status</Text>
          </TouchableOpacity>

          {/* Option: Customer Support */}
          <TouchableOpacity style={styles.optionBtn} activeOpacity={0.8} onPress={() => setChatbotVisible(true)}>
            <View style={[styles.optionIconBg, { backgroundColor: "#fdf2f8" }]}>
              <Ionicons name="chatbubbles" size={24} color="#db2777" />
            </View>
            <Text style={styles.optionText}>Chatbot Help</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Floating Action Chat Button */}
      <TouchableOpacity
        style={styles.floatingChatBtn}
        activeOpacity={0.9}
        onPress={() => setChatbotVisible(true)}
      >
        <Ionicons name="chatbubbles-outline" size={26} color="#ffffff" />
        <View style={styles.activeDot} />
      </TouchableOpacity>

      {/* Support Chatbot Modal */}
      <ChatbotModal
        visible={chatbotVisible}
        onClose={() => setChatbotVisible(false)}
        orderContext={order}
        onDownloadInvoice={(ord) => {
          setChatbotVisible(false);
          triggerInvoiceDownload();
        }}
      />

      {/* Price Details Bottom Sheet Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={priceDetailsVisible}
        onRequestClose={() => setPriceDetailsVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity style={styles.dismissArea} onPress={() => setPriceDetailsVisible(false)} />
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
                <Text style={styles.priceDetailVal}>Rs. {subtotal.toFixed(2)}</Text>
              </View>
              <View style={styles.priceDetailRow}>
                <Text style={styles.priceDetailLabel}>Delivery Charge</Text>
                <Text style={styles.priceDetailVal}>Rs. {deliveryCharge.toFixed(2)}</Text>
              </View>
              <View style={styles.priceDetailRow}>
                <Text style={styles.priceDetailLabel}>GST (Included 5%)</Text>
                <Text style={styles.priceDetailVal}>Rs. {calculatedTax.toFixed(2)}</Text>
              </View>
              {promoDiscount > 0 && (
                <View style={styles.priceDetailRow}>
                  <Text style={[styles.priceDetailLabel, { color: "#10b981" }]}>Promotion Discount</Text>
                  <Text style={[styles.priceDetailVal, { color: "#10b981" }]}>-Rs. {promoDiscount.toFixed(2)}</Text>
                </View>
              )}
              <View style={styles.sheetDivider} />
              <View style={styles.priceDetailRowTotal}>
                <Text style={styles.priceTotalLabel}>Total Amount</Text>
                <Text style={styles.priceTotalVal}>Rs. {grandTotal.toFixed(2)}</Text>
              </View>
            </View>

            <TouchableOpacity style={styles.sheetCloseBtn} onPress={() => setPriceDetailsVisible(false)}>
              <Text style={styles.sheetCloseBtnText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Invoice Generator simulated downloading spinner */}
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
                  {order.address}
                </Text>
              </View>
              <View style={{ alignItems: "flex-end" }}>
                <Text style={styles.invoiceMetaText}>
                  <Text style={styles.bold}>Invoice No:</Text> QC-{order.orderId.slice(-6).toUpperCase()}
                </Text>
                <Text style={styles.invoiceMetaText}>
                  <Text style={styles.bold}>Date:</Text> {formatDateLong(order.createdAt)}
                </Text>
                <Text style={styles.invoiceMetaText}>
                  <Text style={styles.bold}>Method:</Text> {order.paymentMethod}
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
                {order.items &&
                  order.items.map((item: any, index: number) => (
                    <View key={index} style={styles.tableRow}>
                      <Text style={[styles.tdText, { flex: 2 }]} numberOfLines={1}>
                        {item.name} {item.size ? `(${item.size})` : ""}
                      </Text>
                      <Text style={[styles.tdText, { flex: 1, textAlign: "center" }]}>{item.quantity}</Text>
                      <Text style={[styles.tdText, { flex: 1.2, textAlign: "right" }]}>
                        Rs. {(item.price * item.quantity).toFixed(2)}
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
                <Text style={styles.summaryValue}>Rs. {subtotal.toFixed(2)}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Delivery Charge:</Text>
                <Text style={styles.summaryValue}>Rs. {deliveryCharge.toFixed(2)}</Text>
              </View>
              {promoDiscount > 0 && (
                <View style={styles.summaryRow}>
                  <Text style={[styles.summaryLabel, { color: "#10b981" }]}>Discount Applied:</Text>
                  <Text style={[styles.summaryValue, { color: "#10b981" }]}>-Rs. {promoDiscount.toFixed(2)}</Text>
                </View>
              )}
              <View style={styles.summaryRowTotal}>
                <Text style={styles.summaryLabelTotal}>Grand Total Paid:</Text>
                <Text style={styles.summaryValueTotal}>Rs. {grandTotal.toFixed(2)}</Text>
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
                onPress={() => {
                  setInvoiceChoiceVisible(false);
                  triggerInvoiceDownload();
                }}
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
  loadingContainer: {
    flex: 1,
    backgroundColor: "#ffffff",
    justifyContent: "center",
    alignItems: "center",
    gap: 16,
  },
  loadingText: {
    fontSize: 14,
    color: "#64748b",
    fontWeight: "600",
  },
  errorContainer: {
    flex: 1,
    backgroundColor: "#ffffff",
    justifyContent: "center",
    alignItems: "center",
    padding: 30,
    gap: 16,
  },
  errorText: {
    fontSize: 16,
    color: "#475569",
    fontWeight: "700",
    textAlign: "center",
  },
  backBtn: {
    backgroundColor: Theme.colors.primary,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 20,
  },
  backBtnText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "700",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#ffffff",
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  headerBackIcon: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: Theme.colors.primaryDark,
  },
  headerPlaceholder: {
    width: 32,
  },
  scrollArea: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 90,
  },
  orderHeaderCard: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.02,
    shadowRadius: 6,
    elevation: 1,
    marginBottom: 16,
  },
  metaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  metaLabel: {
    fontSize: 10,
    fontWeight: "800",
    color: "#94A3B8",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  metaValue: {
    fontSize: 13,
    fontWeight: "800",
    color: Theme.colors.primaryDark,
    marginTop: 4,
  },
  totalWrapper: {
    alignItems: "flex-end",
  },
  totalLabel: {
    fontSize: 10,
    fontWeight: "800",
    color: "#94A3B8",
    letterSpacing: 0.8,
  },
  totalValue: {
    fontSize: 15,
    fontWeight: "900",
    color: Theme.colors.primary,
    marginTop: 4,
  },
  metaDivider: {
    height: 1,
    backgroundColor: "#F1F5F9",
    marginVertical: 12,
  },
  placedRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  placedValue: {
    fontSize: 13,
    fontWeight: "700",
    color: "#334155",
    marginTop: 4,
  },
  accordionContainer: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    marginBottom: 20,
    overflow: "hidden",
  },
  accordionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    backgroundColor: "#FAFAFA",
  },
  accordionTitleCol: {
    flex: 1,
    marginRight: 16,
  },
  accordionTitle: {
    fontSize: 15,
    fontWeight: "900",
    color: Theme.colors.primaryDark,
  },
  accordionSub: {
    fontSize: 11,
    color: "#64748b",
    fontWeight: "600",
    marginTop: 4,
  },
  timelineBody: {
    padding: 16,
    backgroundColor: "#ffffff",
    borderTopWidth: 1,
    borderTopColor: "#F1F5F9",
  },
  timelineRow: {
    flexDirection: "row",
    width: "100%",
  },
  timelineIconCol: {
    alignItems: "center",
    width: 24,
    paddingBottom: 24, // spacing between steps
  },
  timelineNode: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "#FFFFFF",
    borderWidth: 2,
    borderColor: "#CBD5E1",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 1,
  },
  nodeActive: {
    backgroundColor: "#10b981",
    borderColor: "#10b981",
  },
  nodeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#CBD5E1",
  },
  timelineLine: {
    position: "absolute",
    top: 20,
    bottom: 0,
    width: 2.5,
    backgroundColor: "#E2E8F0",
  },
  lineActive: {
    backgroundColor: "#10b981",
  },
  timelineTextCol: {
    flex: 1,
    paddingLeft: 12,
    justifyContent: "flex-start",
  },
  timelineLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: "#64748B",
  },
  labelActive: {
    color: Theme.colors.primaryDark,
  },
  timelineSubText: {
    fontSize: 11,
    color: "#94A3B8",
    fontWeight: "500",
    marginTop: 2,
  },
  sectionHeaderRow: {
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: "#64748B",
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  itemCard: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    marginBottom: 16,
  },
  itemRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  itemImageBg: {
    width: 70,
    height: 70,
    backgroundColor: "#F8FAFC",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#F1F5F9",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 14,
  },
  itemImage: {
    width: "90%",
    height: "90%",
    borderRadius: 8,
  },
  itemInfo: {
    flex: 1,
  },
  itemName: {
    fontSize: 14,
    fontWeight: "800",
    color: "#1e293b",
    lineHeight: 18,
  },
  itemDetails: {
    fontSize: 12,
    color: "#64748b",
    fontWeight: "600",
    marginTop: 4,
  },
  priceRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 6,
  },
  mrpText: {
    fontSize: 12,
    color: "#94a3b8",
    textDecorationLine: "line-through",
    marginRight: 8,
    fontWeight: "500",
  },
  priceText: {
    fontSize: 14,
    fontWeight: "800",
    color: Theme.colors.primaryDark,
  },
  ratingSection: {
    borderTopWidth: 1,
    borderTopColor: "#F1F5F9",
    marginTop: 14,
    paddingTop: 12,
  },
  ratingLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: "#475569",
    marginBottom: 8,
  },
  starRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  addressCard: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    marginBottom: 20,
  },
  addressCardTitle: {
    fontSize: 10,
    fontWeight: "800",
    color: "#94A3B8",
    letterSpacing: 0.8,
    marginBottom: 10,
  },
  addressName: {
    fontSize: 14,
    fontWeight: "800",
    color: Theme.colors.primaryDark,
  },
  addressText: {
    fontSize: 12,
    color: "#475569",
    lineHeight: 18,
    fontWeight: "500",
    marginTop: 4,
  },
  optionsHeaderRow: {
    marginBottom: 12,
  },
  optionsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: 12,
  },
  optionBtn: {
    width: "48%",
    backgroundColor: "#ffffff",
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    alignItems: "center",
    gap: 8,
  },
  optionIconBg: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
  },
  optionText: {
    fontSize: 12,
    fontWeight: "700",
    color: Theme.colors.primaryDark,
    textAlign: "center",
  },
  floatingChatBtn: {
    position: "absolute",
    bottom: 24,
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
  bold: {
    fontWeight: "800",
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





