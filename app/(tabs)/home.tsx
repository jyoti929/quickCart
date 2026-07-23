import React, { useState, useEffect } from "react";
import {
  Text,
  View,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  StatusBar,
  Dimensions,
  Alert,
  Animated,
  ActivityIndicator,
  Platform,
  Modal,
  Pressable,
  TextInput,
  KeyboardAvoidingView,
} from "react-native";
import { useRouter, useNavigation } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "../../services/firebase";
import { authStore } from "../../services/authStore";
import { Theme } from "../../constants/theme";
import { subscribeProductsByState, Product, cleanProductName, formatPrice, getActualInrPrice, subscribeBanners, subscribeOffers, Banner, Offer, seedBannersAndOffersIfEmpty, seedProductsIfEmpty } from "../../services/productService";
import { subscribeCategories } from "../../services/adminService";

const { width } = Dimensions.get("window");

const searchPlaceholders = [
  "Search 'fresh milk'",
  "Search 'organic bananas'",
  "Search 'sour curd'",
  "Search 'multigrain bread'",
  "Search 'chocolate cookies'",
  "Search 'bell peppers'",
];

export default function Home() {
  const router = useRouter();
  const navigation = useNavigation() as any;
  const insets = useSafeAreaInsets();

  const currentUser = authStore.getCurrentUser();
  const userInitials = currentUser
    ? currentUser.name
        .split(" ")
        .map((n: string) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "G";

  const [products, setProducts] = useState<Product[]>([]);
  const [cartQuantities, setCartQuantities] = useState<{ [key: number]: number }>(authStore.getCart());
  const [selectedCategory, setSelectedCategory] = useState("All");
  const detectedState = authStore.getDetectedState() || "Default";
  const currentAddress = authStore.getCurrentAddress() || "Enable location for delivery ETA";
  const [isLoadingProducts, setIsLoadingProducts] = useState(false);
  const [placeholderIndex, setPlaceholderIndex] = useState(0);
  const [dbCategories, setDbCategories] = useState<any[]>([]);
  const [banners, setBanners] = useState<Banner[]>([]);
  const [offers, setOffers] = useState<Offer[]>([]);

  useEffect(() => {
    const interval = setInterval(() => {
      setPlaceholderIndex((prev) => (prev + 1) % searchPlaceholders.length);
    }, 2500);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const unsubscribe = authStore.subscribeCart(() => {
      setCartQuantities(authStore.getCart());
    });
    return () => unsubscribe();
  }, []);

  // One-shot startup seeding — runs once when the home screen first mounts.
  // These calls were previously embedded inside subscribeBanners() and
  // subscribeProductsByState(), meaning they ran on EVERY listener creation
  // (including leaked ones). Moved here so they run exactly once.
  useEffect(() => {
    seedBannersAndOffersIfEmpty().catch((e) =>
      console.error("[HomeScreen] Banner/offer seeding failed:", e)
    );
    seedProductsIfEmpty().catch((e) =>
      console.error("[HomeScreen] Product seeding failed:", e)
    );
  }, []);

  // Real-time listener for categories
  useEffect(() => {
    console.log("[LISTENER:CREATE] subscribeCategories (HomeScreen)");
    const unsubscribe = subscribeCategories(
      (cats) => {
        console.log(`[HomeScreen] Categories received. Count: ${cats.length}`);
        setDbCategories(cats);
      },
      (error) => {
        console.error("[HomeScreen] Categories subscription error:", error);
      }
    );
    return () => {
      console.log("[LISTENER:DESTROY] subscribeCategories (HomeScreen)");
      unsubscribe();
    };
  }, []);

  // Real-time listener for banners & offers
  useEffect(() => {
    console.log("[LISTENER:CREATE] subscribeBanners + subscribeOffers (HomeScreen)");
    const unsubBanners = subscribeBanners((data) => setBanners(data));
    const unsubOffers = subscribeOffers((data) => setOffers(data));
    return () => {
      console.log("[LISTENER:DESTROY] subscribeBanners + subscribeOffers (HomeScreen)");
      unsubBanners();
      unsubOffers();
    };
  }, []);

  // Real-time listener for products by state.
  // dep: [detectedState] — intentional: if the user's state changes we need
  // a new query pointing at the new state. The old listener is destroyed first.
  useEffect(() => {
    console.log(`[LISTENER:CREATE] subscribeProductsByState state="${detectedState}" (HomeScreen)`);
    setIsLoadingProducts(true);
    const unsubscribe = subscribeProductsByState(
      detectedState,
      (prods) => {
        console.log(`[HomeScreen] Products received for state "${detectedState}". Count: ${prods.length}`);
        setProducts(prods);
        setIsLoadingProducts(false);
      },
      (error) => {
        console.error(`[HomeScreen] Products subscription error for state "${detectedState}":`, error);
        setIsLoadingProducts(false);
      }
    );
    return () => {
      console.log(`[LISTENER:DESTROY] subscribeProductsByState state="${detectedState}" (HomeScreen)`);
      unsubscribe();
    };
  }, [detectedState]);

  // Log rendering decisions for categories and products
  useEffect(() => {
    console.log(`[HomeScreen] Render validation check - State: "${detectedState}", dbCategories count: ${dbCategories.length}, products count: ${products.length}`);
    if (dbCategories.length > 0) {
      dbCategories.forEach(cat => {
        const hasProducts = products.some((p) => p.category === cat.id || p.categoryId === cat.id);
        if (cat.isActive === false) {
          console.log(`[HomeScreen] Skip category rendering: "${cat.name}" (id: "${cat.id}") is set to INACTIVE.`);
        } else if (!hasProducts) {
          console.log(`[HomeScreen] Skip category rendering: "${cat.name}" (id: "${cat.id}") has NO matching products in state "${detectedState}".`);
        } else {
          console.log(`[HomeScreen] Rendering category: "${cat.name}" (id: "${cat.id}") with matching products.`);
        }
      });
    }
  }, [dbCategories, products, detectedState]);

  const handleOpenProfile = () => {
    navigation.navigate("profile" as any);
  };

  const updateQuantity = (productId: number, change: number) => {
    if (authStore.getIsBlocked()) {
      Alert.alert(
        "Account Blocked",
        "Your account has been temporarily blocked. You cannot place orders until your account is restored."
      );
      return;
    }
    authStore.updateCart(productId, change);
  };

  // Checkout Modal states
  const [cartModalVisible, setCartModalVisible] = useState(false);
  const [checkoutStage, setCheckoutStage] = useState<'cart' | 'checkout' | 'success'>('cart');
  const [deliveryOption, setDeliveryOption] = useState<'standard' | 'express'>('standard');
  const [paymentMethod, setPaymentMethod] = useState<'cod' | 'upi' | 'card'>('upi');
  const [isPlacingOrder, setIsPlacingOrder] = useState(false);
  const [placedOrderId, setPlacedOrderId] = useState<string>("");

  // Delivery address state (editable per order)
  const [deliveryAddress, setDeliveryAddress] = useState(currentAddress);
  const [changeAddressVisible, setChangeAddressVisible] = useState(false);
  const [addressDraft, setAddressDraft] = useState("");
  const [addressConfirmed, setAddressConfirmed] = useState(false);

  const isPlaceholderAddress = (value: string) => {
    const lowered = (value || "").trim().toLowerCase();
    return !lowered || lowered.includes("enable location") || lowered.includes("no address");
  };

  const isCompleteDeliveryAddress = (value: string) => {
    const cleaned = (value || "").trim();
    return cleaned.length >= 20 && /\d/.test(cleaned) && !isPlaceholderAddress(cleaned);
  };

  const openAddressEditor = () => {
    const baseAddress = isPlaceholderAddress(deliveryAddress) ? currentAddress : deliveryAddress;
    setAddressDraft(isPlaceholderAddress(baseAddress) ? "" : baseAddress);
    setChangeAddressVisible(true);
  };

  const saveExactAddress = () => {
    const cleaned = addressDraft.trim();
    if (!isCompleteDeliveryAddress(cleaned)) {
      Alert.alert(
        "Complete address required",
        "Please enter house/flat number, street/locality, city, and pincode before placing the order."
      );
      return;
    }
    setDeliveryAddress(cleaned);
    authStore.setCurrentAddress(cleaned);
    setAddressConfirmed(true);
    setChangeAddressVisible(false);
  };

  const getConfirmedDeliveryAddress = () => {
    const cleaned = deliveryAddress.trim();
    if (!addressConfirmed || !isCompleteDeliveryAddress(cleaned)) {
      Alert.alert(
        "Confirm delivery address",
        "We found your general place. Please add and save your exact delivery address before placing the order."
      );
      openAddressEditor();
      return null;
    }
    return cleaned;
  };

  const renderCartStage = () => {
    const subtotal = totalCartPrice;
    const deliveryFee = subtotal > 500 ? 0 : 40;
    const grandTotal = subtotal + deliveryFee;

    return (
      <View style={styles.stageContainer}>
        <ScrollView style={styles.sheetScroll} showsVerticalScrollIndicator={false}>
          <View style={styles.cartItemsList}>
            {Object.entries(cartQuantities).map(([idStr, qty]) => {
              const prodId = parseInt(idStr);
              const prod = products.find(p => p.id === prodId);
              if (!prod) return null;
              
              const itemPrice = getActualInrPrice(prod.price);
              
              return (
                <View key={prodId} style={styles.cartItemRow}>
                  <Image source={prod.imageUrl} style={styles.cartItemImage} contentFit="contain" />
                  <View style={styles.cartItemDetails}>
                    <Text style={styles.cartItemName} numberOfLines={1}>{prod.name}</Text>
                    <Text style={styles.cartItemPrice}>Rs. {itemPrice} - Rs. {itemPrice * qty}</Text>
                  </View>
                  <View style={styles.cartQtyContainer}>
                    <TouchableOpacity 
                      style={styles.cartQtyBtn}
                      onPress={() => updateQuantity(prodId, -1)}
                    >
                      <Ionicons name="remove" size={14} color="#ffffff" />
                    </TouchableOpacity>
                    <Text style={styles.cartQtyText}>{qty}</Text>
                    <TouchableOpacity 
                      style={styles.cartQtyBtn}
                      onPress={() => updateQuantity(prodId, 1)}
                    >
                      <Ionicons name="add" size={14} color="#ffffff" />
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })}
          </View>

          {/* Delivery Address Card in Cart */}
          <View style={styles.cartAddressCard}>
            <View style={styles.cartAddressLeft}>
              <View style={styles.cartAddressIconBg}>
                <Ionicons name="location" size={18} color={Theme.colors.primary} />
              </View>
              <View style={styles.cartAddressText}>
                <Text style={styles.cartAddressLabel}>Delivering to</Text>
                <Text style={styles.cartAddressValue} numberOfLines={2}>
                  {deliveryAddress || "No address set"}
                </Text>
              </View>
            </View>
            <TouchableOpacity
              style={styles.changeAddressBtn}
              onPress={() => {
                openAddressEditor();
              }}
              activeOpacity={0.8}
            >
              <Text style={styles.changeAddressBtnText}>Change</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.billDetailsContainer}>
            <Text style={styles.billTitle}>Bill Details</Text>
            <View style={styles.billRow}>
              <Text style={styles.billLabel}>Item Total</Text>
              <Text style={styles.billValue}>Rs. {subtotal}</Text>
            </View>
            <View style={styles.billRow}>
              <Text style={styles.billLabel}>Delivery Charge</Text>
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
        </ScrollView>

        <View style={styles.sheetFooter}>
          <TouchableOpacity 
            style={styles.proceedBtn}
            onPress={() => setCheckoutStage('checkout')}
          >
            <View>
              <Text style={styles.proceedPrice}>Rs. {grandTotal}</Text>
              <Text style={styles.proceedSubtext}>Total Amount</Text>
            </View>
            <View style={styles.proceedBtnRight}>
              <Text style={styles.proceedText}>Proceed to Checkout</Text>
              <Ionicons name="arrow-forward" size={16} color="#ffffff" />
            </View>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const renderCheckoutStage = () => {
    const subtotal = totalCartPrice;
    const deliveryFee = deliveryOption === 'express' ? 60 : (subtotal > 500 ? 0 : 40);
    const grandTotal = subtotal + deliveryFee;

    const handlePlaceOrder = async () => {
      if (authStore.getIsBlocked()) {
        Alert.alert(
          "Account Blocked",
          "Your account has been temporarily blocked. You cannot place orders until your account is restored."
        );
        return;
      }
      const confirmedAddress = getConfirmedDeliveryAddress();
      if (!confirmedAddress) return;

      setIsPlacingOrder(true);
      try {
        const items = Object.entries(cartQuantities).map(([idStr, qty]) => {
          const prodId = parseInt(idStr);
          const prod = products.find(p => p.id === prodId)!;
          return {
            productId: prodId,
            name: prod.name,
            price: getActualInrPrice(prod.price),
            quantity: qty,
            imageUrl: prod.imageUrl
          };
        });

        const orderId = await authStore.placeOrder({
          items,
          totalAmount: grandTotal,
          deliveryCharge: deliveryFee,
          address: confirmedAddress,
          paymentMethod: paymentMethod === 'cod' ? 'Cash on Delivery' : paymentMethod === 'upi' ? 'UPI (Google Pay/PhonePe)' : 'Credit/Debit Card',
          deliveryOption: deliveryOption === 'express' ? 'Express Delivery' : 'Standard Delivery'
        });

        setPlacedOrderId(orderId);
        setCheckoutStage('success');
      } catch (error: any) {
        Alert.alert("Checkout Error", error.message || "Failed to place order. Please try again.");
      } finally {
        setIsPlacingOrder(false);
      }
    };

    return (
      <View style={styles.stageContainer}>
        <ScrollView style={styles.sheetScroll} showsVerticalScrollIndicator={false}>
          <View style={styles.sectionContainer}>
            <Text style={styles.sheetSectionTitle}>Delivery Address</Text>
            <View style={styles.addressBox}>
              <Ionicons name="location" size={20} color={Theme.colors.primary} />
              <View style={styles.addressTextWrapper}>
                <Text style={styles.addressLabel}>{currentUser ? currentUser.name : "Guest"}</Text>
                <Text style={styles.addressValue} numberOfLines={2}>{deliveryAddress || currentAddress}</Text>
              </View>
              <TouchableOpacity
                style={styles.changeAddressBtn}
                onPress={() => {
                  openAddressEditor();
                }}
                activeOpacity={0.8}
              >
                <Text style={styles.changeAddressBtnText}>Change</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.sectionContainer}>
            <Text style={styles.sheetSectionTitle}>Delivery Option</Text>
            <View style={styles.optionsRow}>
              <TouchableOpacity 
                style={[styles.optionCard, deliveryOption === 'standard' && styles.optionCardSelected]}
                onPress={() => setDeliveryOption('standard')}
              >
                <Ionicons name="time-outline" size={22} color={deliveryOption === 'standard' ? Theme.colors.primary : "#64748b"} />
                <Text style={styles.optionName}>Standard</Text>
                <Text style={styles.optionSub}>30-40 mins - {subtotal > 500 ? "FREE" : "Rs. 40"}</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={[styles.optionCard, deliveryOption === 'express' && styles.optionCardSelected]}
                onPress={() => setDeliveryOption('express')}
              >
                <Ionicons name="flash-outline" size={22} color={deliveryOption === 'express' ? Theme.colors.primary : "#64748b"} />
                <Text style={styles.optionName}>Express</Text>
                <Text style={styles.optionSub}>15-20 mins - Rs. 60</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.sectionContainer}>
            <Text style={styles.sheetSectionTitle}>Payment Method</Text>
            <View style={styles.paymentMethodList}>
              <TouchableOpacity 
                style={[styles.paymentMethodRow, paymentMethod === 'upi' && styles.paymentMethodSelected]}
                onPress={() => setPaymentMethod('upi')}
              >
                <Ionicons name="logo-google" size={18} color="#22c55e" />
                <Text style={styles.paymentMethodLabel}>UPI (Google Pay / PhonePe)</Text>
                <View style={[styles.radioOuter, paymentMethod === 'upi' && styles.radioOuterSelected]}>
                  {paymentMethod === 'upi' && <View style={styles.radioInner} />}
                </View>
              </TouchableOpacity>

              <TouchableOpacity 
                style={[styles.paymentMethodRow, paymentMethod === 'cod' && styles.paymentMethodSelected]}
                onPress={() => setPaymentMethod('cod')}
              >
                <Ionicons name="cash-outline" size={18} color="#eab308" />
                <Text style={styles.paymentMethodLabel}>Cash on Delivery (COD)</Text>
                <View style={[styles.radioOuter, paymentMethod === 'cod' && styles.radioOuterSelected]}>
                  {paymentMethod === 'cod' && <View style={styles.radioInner} />}
                </View>
              </TouchableOpacity>

              <TouchableOpacity 
                style={[styles.paymentMethodRow, paymentMethod === 'card' && styles.paymentMethodSelected]}
                onPress={() => setPaymentMethod('card')}
              >
                <Ionicons name="card-outline" size={18} color="#3b82f6" />
                <Text style={styles.paymentMethodLabel}>Credit / Debit Card</Text>
                <View style={[styles.radioOuter, paymentMethod === 'card' && styles.radioOuterSelected]}>
                  {paymentMethod === 'card' && <View style={styles.radioInner} />}
                </View>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>

        <View style={styles.sheetFooter}>
          <TouchableOpacity 
            style={[styles.proceedBtn, isPlacingOrder && { opacity: 0.8 }]}
            onPress={handlePlaceOrder}
            disabled={isPlacingOrder}
          >
            {isPlacingOrder ? (
              <ActivityIndicator color="#ffffff" size="small" />
            ) : (
              <>
                <View>
                  <Text style={styles.proceedPrice}>Rs. {grandTotal}</Text>
                  <Text style={styles.proceedSubtext}>Total Amount</Text>
                </View>
                <View style={styles.proceedBtnRight}>
                  <Text style={styles.proceedText}>Place Order</Text>
                  <Ionicons name="checkmark-circle-outline" size={18} color="#ffffff" />
                </View>
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const renderSuccessStage = () => {
    return (
      <View style={styles.successContainer}>
        <View style={styles.successIconWrapper}>
          <Ionicons name="checkmark-circle" size={80} color="#22c55e" />
        </View>
        <Text style={styles.successTitle}>Order Placed!</Text>
        <Text style={styles.successDesc}>
          Your order has been placed successfully. Order ID: #{placedOrderId ? placedOrderId.slice(-6).toUpperCase() : ""}
        </Text>

        <View style={styles.successActions}>
          <TouchableOpacity 
            style={styles.successViewOrdersBtn}
            onPress={() => {
              setCartModalVisible(false);
              router.push("/orders" as any);
            }}
          >
            <Text style={styles.successViewOrdersText}>View Order History</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.successCloseBtn}
            onPress={() => setCartModalVisible(false)}
          >
            <Text style={styles.successCloseText}>Continue Shopping</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  // Dynamic Categories: Filter categories to only display those that contain products in the currently loaded state.
  const categories = [
    { id: "All", name: "All", icon: "grid-outline", color: Theme.colors.primaryDark, bg: "#f1f5f9", backgroundColor: "#f1f5f9" } as any,
    ...dbCategories
      .filter((cat) => cat.isActive !== false && products.some((p) => p.category === cat.id || p.categoryId === cat.id))
      .sort((a, b) => (a.displayOrder || 99) - (b.displayOrder || 99))
  ];

  // Category filters applied on dynamically loaded products
  const filteredProducts = products.filter((p) => {
    return selectedCategory === "All" || p.category === selectedCategory;
  });

  // Cart calculations
  const totalCartItems = Object.values(cartQuantities).reduce((a, b) => a + b, 0);
  const totalCartPrice = Object.entries(cartQuantities).reduce((acc, [id, qty]) => {
    const prod = products.find((p) => p.id === parseInt(id));
    return acc + (prod ? getActualInrPrice(prod.price) * qty : 0);
  }, 0);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />

      {/* 1. Header (Blinkit Style with Logo, Brand, Delivery time, and Location Address) */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.brandRow}>
            <Image
              source={require("../../assets/images/logo.png")}
              style={styles.headerLogo}
              contentFit="contain"
            />
            <View style={styles.brandTextRow}>
              <Text style={styles.brandQuick}>quick</Text>
              <Text style={styles.brandCart}>Cart</Text>
            </View>
            <View style={styles.deliveryBadge}>
              <Ionicons name="flash" size={10} color="#16a34a" />
              <Text style={styles.deliveryBadgeText}>9 MINS</Text>
            </View>
          </View>
          <TouchableOpacity 
            style={styles.locationRow} 
            activeOpacity={0.7}
            onPress={handleOpenProfile}
          >
            <Text style={styles.locationText} numberOfLines={1}>
              {currentAddress}
            </Text>
            <Ionicons name="chevron-down" size={12} color="#64748b" />
          </TouchableOpacity>
        </View>

        <View style={styles.headerRight}>
          <TouchableOpacity
            style={styles.avatar}
            activeOpacity={0.8}
            onPress={handleOpenProfile}
          >
            <Text style={styles.avatarText}>{userInitials}</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Main dashboard Scroll Area */}
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[styles.scrollContent, { paddingBottom: 150 + Math.max(insets.bottom, 12) }]}>
        
        {/* 2. Interactive Search Bar Link */}
        <TouchableOpacity
          style={styles.searchContainer}
          activeOpacity={0.9}
          onPress={() => {
            router.push("/explore?focus=true");
          }}
        >
          <View style={styles.searchBar}>
            <Ionicons name="search" size={20} color="#94a3b8" />
            <Text style={styles.fakeSearchInput}>
              {searchPlaceholders[placeholderIndex]}
            </Text>
          </View>
        </TouchableOpacity>

        {/* Special Offers Section */}
        {offers.length > 0 && (
          <View style={{ marginTop: 14, paddingHorizontal: 16 }}>
            <Text style={[styles.sectionTitle, { marginHorizontal: 0, marginTop: 0, marginBottom: 8 }]}>Special Offers for You</Text>
            {offers.map((o) => (
              <View key={o.id} style={[styles.offerCard, { backgroundColor: o.backgroundColor || "#fef3c7", marginTop: 0, marginBottom: 10 }]}>
                <View style={{ flex: 1 }}>
                  <View style={styles.offerTag}>
                    <Text style={styles.offerTagText}>{o.tag}</Text>
                  </View>
                  <Text style={styles.offerTitle}>{o.title}</Text>
                  <Text style={styles.offerSubtitle}>{o.subtitle}</Text>
                </View>
                <Ionicons name="gift" size={32} color="#d97706" style={{ opacity: 0.8 }} />
              </View>
            ))}
          </View>
        )}

        {/* 3. High Fidelity Banners (Horizontal Carousel) */}
        {banners.length > 0 && (
          <ScrollView 
            horizontal 
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            style={styles.bannerSlider}
            contentContainerStyle={styles.bannerSliderContent}
          >
            {banners.map((b) => (
              <View key={b.id} style={[styles.promoCard, { backgroundColor: b.backgroundColor || Theme.colors.primary }]}>
                <View style={styles.promoTextContent}>
                  <Text style={styles.promoTag}>{b.tag}</Text>
                  <Text style={styles.promoTitle}>{b.title}</Text>
                  {b.couponCode ? (
                    <View style={styles.couponBadge}>
                      <Text style={styles.couponText}>Code: {b.couponCode}</Text>
                    </View>
                  ) : null}
                </View>
                <View style={styles.promoGraphicsContainer}>
                  <Image
                    source={require("../../assets/images/icecream_banner.png")}
                    style={styles.promoImage}
                    contentFit="contain"
                  />
                </View>
              </View>
            ))}
          </ScrollView>
        )}

        {/* 4. Blinkit-Style Category Grid (2x4 items) */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Shop by Category</Text>
        </View>
        
        <View style={styles.categoryGrid}>
          {categories.map((cat) => {
            const isSelected = selectedCategory === cat.id;
            return (
              <TouchableOpacity
                key={cat.id}
                onPress={() => {
                  if (cat.id === "All") {
                    setSelectedCategory("All");
                  } else {
                    router.push({
                      pathname: "/category",
                      params: { categoryId: cat.id }
                    });
                  }
                }}
                style={[
                  styles.categoryCard,
                  isSelected && styles.categoryCardSelected,
                ]}
                activeOpacity={0.8}
              >
                <View style={[styles.categoryIconBg, { backgroundColor: cat.backgroundColor || cat.bg }]}>
                  {cat.iconUrl ? (
                    <Image
                      source={{ uri: cat.iconUrl }}
                      style={{ width: "100%", height: "100%", borderRadius: 22 }}
                      contentFit="cover"
                    />
                  ) : (
                    <Ionicons name={cat.icon as any} size={20} color={cat.color} />
                  )}
                </View>
                <Text style={styles.categoryLabel} numberOfLines={2}>
                  {cat.name}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* 5. Product Feed Section */}
        <View style={styles.sectionHeader}>
          <View style={styles.sectionTitleRow}>
            <Text style={styles.sectionTitle}>Popular Products</Text>
            {selectedCategory !== "All" && (
              <View style={styles.filterChip}>
                <Text style={styles.filterChipText}>{selectedCategory}</Text>
              </View>
            )}
          </View>
          <Text style={styles.resultsCount}>
            {filteredProducts.length} items
          </Text>
        </View>

        {/* Responsive Grid layout for Products (with loading check) */}
        {isLoadingProducts ? (
          <View style={styles.emptyProducts}>
            <ActivityIndicator size="large" color={Theme.colors.primary} />
            <Text style={[styles.emptyText, { marginTop: 10 }]}>Loading Firestore data...</Text>
          </View>
        ) : filteredProducts.length === 0 ? (
          <View style={styles.emptyProducts}>
            <Ionicons name="search-outline" size={48} color="#cbd5e1" />
            <Text style={styles.emptyText}>No products match your search</Text>
          </View>
        ) : (
          <View style={styles.productsGrid}>
            {filteredProducts.map((prod) => {
              const qty = cartQuantities[prod.id] || 0;
              const hasDiscount = prod.originalPrice > prod.price;
              const discountPercent = Math.round(((prod.originalPrice - prod.price) / prod.originalPrice) * 100);

              return (
                <View key={prod.id} style={styles.productCard}>
                  {/* Image container & rating/ETA */}
                  <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={() => {
                      router.push({
                        pathname: "/product",
                        params: { productId: String(prod.id ?? "") }
                      });
                    }}
                    style={{ width: "100%" }}
                  >
                    <View style={styles.productImageContainer}>
                      <Image
                        source={{ uri: prod.imageUrl }}
                        style={styles.productImage}
                        contentFit="cover"
                        transition={200}
                      />
                      
                      {hasDiscount && (
                        <View style={styles.discountBadge}>
                          <Text style={styles.discountBadgeText}>{discountPercent}% OFF</Text>
                        </View>
                      )}
                      
                      <View style={styles.etaBadge}>
                        <Ionicons name="flash" size={10} color="#16a34a" />
                        <Text style={styles.etaText}>{prod.eta}</Text>
                      </View>
                    </View>
                  </TouchableOpacity>

                  {/* Details */}
                  <View style={styles.productDetails}>
                    <TouchableOpacity
                      activeOpacity={0.8}
                      onPress={() => {
                        router.push({
                          pathname: "/product",
                          params: { productId: String(prod.id ?? "") }
                        });
                      }}
                    >
                      <Text style={styles.productName} numberOfLines={1}>
                        {cleanProductName(prod.name)}
                      </Text>
                      <Text style={styles.productWeight}>{prod.weight}</Text>
                    </TouchableOpacity>
                    
                    <View style={styles.priceRow}>
                      <View>
                        <Text style={styles.productPrice}>{formatPrice(prod.price)}</Text>
                        {hasDiscount && (
                          <Text style={styles.productOriginalPrice}>
                            {formatPrice(prod.originalPrice)}
                          </Text>
                        )}
                      </View>

                      {/* Blinkit Style ADD quantity buttons */}
                      {qty === 0 ? (
                        <TouchableOpacity
                          style={styles.addButton}
                          activeOpacity={0.8}
                          onPress={() => updateQuantity(prod.id, 1)}
                        >
                          <Text style={styles.addButtonText}>ADD</Text>
                          <Ionicons name="add" size={12} color={Theme.colors.primary} style={styles.addButtonIcon} />
                        </TouchableOpacity>
                      ) : (
                        <View style={styles.qtyContainer}>
                          <TouchableOpacity
                            style={styles.qtyBtn}
                            onPress={() => updateQuantity(prod.id, -1)}
                          >
                            <Ionicons name="remove" size={14} color="#ffffff" />
                          </TouchableOpacity>
                          <Text style={styles.qtyText}>{qty}</Text>
                          <TouchableOpacity
                            style={styles.qtyBtn}
                            onPress={() => updateQuantity(prod.id, 1)}
                          >
                            <Ionicons name="add" size={14} color="#ffffff" />
                          </TouchableOpacity>
                        </View>
                      )}
                    </View>
                  </View>
                </View>
              );
            })}
          </View>
        )}

      </ScrollView>

      {/* 6. Floating bottom checkout banner (Blinkit style overlay) */}
      {totalCartItems > 0 && (
        <Animated.View style={[styles.checkoutBanner, { bottom: 64 + Math.max(insets.bottom, 12) }]}>
          <View style={styles.checkoutLeft}>
            <View style={styles.checkoutCartIconBg}>
              <Ionicons name="basket" size={20} color="#ffffff" />
            </View>
            <View>
              <Text style={styles.checkoutItemsCount}>
                {totalCartItems} Item{totalCartItems > 1 ? "s" : ""} - Rs. {totalCartPrice}
              </Text>
              <Text style={styles.checkoutSubtext}>Extra charges may apply at checkout</Text>
            </View>
          </View>
          <TouchableOpacity 
            style={styles.checkoutBtn} 
            activeOpacity={0.8}
            onPress={() => router.push("/cart")}
          >
            <Text style={styles.checkoutBtnText}>View Cart</Text>
            <Ionicons name="chevron-forward" size={16} color="#ffffff" />
          </TouchableOpacity>
        </Animated.View>
      )}

      {/* Custom Bottom Sheet Modal for Cart & Checkout */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={cartModalVisible}
        onRequestClose={() => !isPlacingOrder && setCartModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <Pressable style={styles.modalDismissArea} onPress={() => !isPlacingOrder && setCartModalVisible(false)} />
          <View style={[styles.modalSheet, { paddingBottom: Math.max(insets.bottom, 20) }]}>
            <View style={styles.sheetHeader}>
              <View style={styles.sheetHeaderBar} />
              <View style={styles.sheetTitleRow}>
                {checkoutStage === 'checkout' && (
                  <TouchableOpacity onPress={() => setCheckoutStage('cart')} style={styles.backBtn} disabled={isPlacingOrder}>
                    <Ionicons name="arrow-back" size={22} color={Theme.colors.primaryDark} />
                  </TouchableOpacity>
                )}
                <Text style={styles.sheetTitle}>
                  {checkoutStage === 'cart' && "My Cart"}
                  {checkoutStage === 'checkout' && "Select Payment & Options"}
                  {checkoutStage === 'success' && "Order Successful!"}
                </Text>
                {checkoutStage !== 'success' && (
                  <TouchableOpacity onPress={() => setCartModalVisible(false)} style={styles.closeBtn} disabled={isPlacingOrder}>
                    <Ionicons name="close" size={22} color={Theme.colors.primaryDark} />
                  </TouchableOpacity>
                )}
              </View>
            </View>

            {checkoutStage === 'cart' && renderCartStage()}
            {checkoutStage === 'checkout' && renderCheckoutStage()}
            {checkoutStage === 'success' && renderSuccessStage()}
          </View>
        </View>
      </Modal>

      {/* Change Address Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={changeAddressVisible}
        onRequestClose={() => setChangeAddressVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1 }}
        >
          <Pressable
            style={styles.modalOverlay}
            onPress={() => setChangeAddressVisible(false)}
          >
            <Pressable style={[styles.changeAddressSheet, { paddingBottom: Math.max(insets.bottom, 20) }]}>
              {/* Handle bar */}
              <View style={styles.sheetHandleBar} />

              {/* Header */}
              <View style={styles.changeAddressHeader}>
                <Text style={styles.changeAddressTitle}>Change Delivery Address</Text>
                <TouchableOpacity
                  onPress={() => setChangeAddressVisible(false)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons name="close" size={22} color="#334155" />
                </TouchableOpacity>
              </View>

              {/* Current location hint */}
              <View style={styles.currentLocationRow}>
                <Ionicons name="navigate-circle" size={18} color={Theme.colors.primary} />
                <Text style={styles.currentLocationText} numberOfLines={1}>
                  {currentAddress}
                </Text>
                <TouchableOpacity
                  onPress={() => setAddressDraft(currentAddress)}
                  style={styles.useCurrentBtn}
                >
                  <Text style={styles.useCurrentBtnText}>Use</Text>
                </TouchableOpacity>
              </View>

              {/* Address text input */}
              <Text style={styles.addressInputLabel}>Enter exact delivery address</Text>
              <View style={styles.addressInputBox}>
                <Ionicons name="location-outline" size={18} color="#94a3b8" style={{ marginRight: 8 }} />
                <TextInput
                  value={addressDraft}
                  onChangeText={setAddressDraft}
                  placeholder="Flat/house no., building, street, city, pincode"
                  placeholderTextColor="#94a3b8"
                  style={styles.addressTextInputField}
                  multiline
                  autoFocus
                />
              </View>

              {/* Save button */}
              <TouchableOpacity
                style={[
                  styles.saveAddressBtn,
                  !addressDraft.trim() && { opacity: 0.5 },
                ]}
                disabled={!addressDraft.trim()}
                onPress={saveExactAddress}
                activeOpacity={0.85}
              >
                <Ionicons name="checkmark-circle-outline" size={18} color="#ffffff" style={{ marginRight: 6 }} />
                <Text style={styles.saveAddressBtnText}>Save & Deliver Here</Text>
              </TouchableOpacity>
            </Pressable>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>

    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#ffffff",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#ffffff",
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  headerLeft: {
    flex: 1,
    marginRight: 16,
  },
  brandRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
  },
  headerLogo: {
    width: 54,
    height: 54,
    marginRight: 6,
  },
  brandTextRow: {
    flexDirection: "row",
    alignItems: "center",
    marginRight: 8,
  },
  brandQuick: {
    fontSize: 18,
    fontWeight: "300",
    color: Theme.colors.primaryDark,
    letterSpacing: -0.5,
  },
  brandCart: {
    fontSize: 18,
    fontWeight: "800",
    color: Theme.colors.primary,
    letterSpacing: -0.5,
  },
  deliveryBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#dcfce7",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    gap: 2,
  },
  deliveryBadgeText: {
    fontSize: 9,
    fontWeight: "900",
    color: "#16a34a",
  },
  locationRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  locationText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#64748b",
    maxWidth: 220,
  },
  headerRight: {
    justifyContent: "center",
    alignItems: "center",
  },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: Theme.colors.primary,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: Theme.colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 3,
  },
  avatarText: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "700",
  },
  scrollContent: {
    paddingBottom: 150, // Space for floating checkout banner + tabs
  },
  searchContainer: {
    paddingHorizontal: 16,
    marginTop: 14,
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f8fafc",
    borderRadius: 16,
    paddingHorizontal: 16,
    height: 52,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  searchInput: {
    flex: 1,
    marginLeft: 10,
    fontSize: 14,
    color: "#0f172a",
    fontWeight: "500",
  },
  fakeSearchInput: {
    flex: 1,
    marginLeft: 10,
    fontSize: 14,
    color: "#94a3b8",
    fontWeight: "500",
  },
  bannerSlider: {
    marginTop: 18,
  },
  bannerSliderContent: {
    paddingHorizontal: 16,
    gap: 12,
  },
  promoCard: {
    width: width - 44, // Responsive fitting inside the simulator container
    maxWidth: 390,
    height: 125,
    borderRadius: 20,
    flexDirection: "row",
    overflow: "hidden",
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
  promoTextContent: {
    flex: 1.3,
    padding: 16,
    justifyContent: "center",
  },
  promoTag: {
    color: "#ffffff",
    fontSize: 9,
    fontWeight: "900",
    opacity: 0.85,
    letterSpacing: 0.8,
  },
  promoTitle: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "900",
    marginTop: 4,
    lineHeight: 20,
  },
  couponBadge: {
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginTop: 8,
  },
  couponText: {
    color: "#ffffff",
    fontSize: 9,
    fontWeight: "700",
  },
  promoGraphicsContainer: {
    flex: 0.7,
    justifyContent: "center",
    alignItems: "center",
    position: "relative",
  },
  bannerIcon: {
    transform: [{ rotate: "-15deg" }],
  },
  offerCard: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 16,
    padding: 16,
    marginTop: 10,
    gap: 12,
    borderWidth: 1,
    borderColor: "#fde68a",
  },
  offerTag: {
    backgroundColor: "#d97706",
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    marginBottom: 6,
  },
  offerTagText: {
    color: "#ffffff",
    fontSize: 9,
    fontWeight: "800",
  },
  offerTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: "#78350f",
  },
  offerSubtitle: {
    fontSize: 11,
    color: "#b45309",
    marginTop: 2,
    lineHeight: 15,
  },
  promoImage: {
    width: 120,
    height: 120,
    transform: [{ rotate: "-10deg" },
      { scale: 1.2},
    ],
  },
  welcomePromoImage: {
  width: 160,
  height: 160,
  transform: [
    { rotate: "-10deg" },
    { scale: 1.2 },
  ],
},
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    marginTop: 22,
    marginBottom: 12,
  },
  sectionTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#0f172a",
  },
  filterChip: {
    backgroundColor: "#e8f5e9",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  filterChipText: {
    fontSize: 9,
    fontWeight: "800",
    color: Theme.colors.primary,
  },
  resultsCount: {
    fontSize: 12,
    color: "#64748b",
    fontWeight: "600",
  },
  categoryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: 12,
    rowGap: 14,
  },
  categoryCard: {
    width: "25%",
    alignItems: "center",
    paddingHorizontal: 4,
  },
  categoryCardSelected: {
    transform: [{ scale: 1.05 }],
  },
  categoryIconBg: {
    width: 58,
    height: 58,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 6,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  categoryLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "#334155",
    textAlign: "center",
    lineHeight: 14,
  },
  emptyProducts: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 40,
    gap: 10,
    width: "100%",
  },
  emptyText: {
    fontSize: 14,
    color: "#94a3b8",
    fontWeight: "600",
  },
  productsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: 16,
    justifyContent: "space-between",
    rowGap: 16,
    width: "100%",
  },
  productCard: {
    width: "48%",
    backgroundColor: "#ffffff",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#f1f5f9",
    overflow: "hidden",
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 2,
  },
  productImageContainer: {
    height: 115,
    justifyContent: "center",
    alignItems: "center",
    position: "relative",
  },
  productImage: {
    width: "100%",
    height: "100%",
  },
  discountBadge: {
    position: "absolute",
    top: 10,
    left: 10,
    backgroundColor: Theme.colors.primary,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  discountBadgeText: {
    color: "#ffffff",
    fontSize: 8,
    fontWeight: "900",
  },
  etaBadge: {
    position: "absolute",
    bottom: 8,
    left: 8,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ffffff",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    gap: 2,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 1,
  },
  etaText: {
    fontSize: 9,
    fontWeight: "900",
    color: "#16a34a",
  },
  productDetails: {
    padding: 12,
  },
  productName: {
    fontSize: 13,
    fontWeight: "800",
    color: "#1e293b",
  },
  productWeight: {
    fontSize: 11,
    color: "#64748b",
    fontWeight: "600",
    marginTop: 2,
  },
  priceRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 10,
    minHeight: 32,
  },
  productPrice: {
    fontSize: 14,
    fontWeight: "800",
    color: "#0f172a",
  },
  productOriginalPrice: {
    fontSize: 11,
    color: "#94a3b8",
    textDecorationLine: "line-through",
    fontWeight: "500",
    marginTop: 1,
  },
  addButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#ffffff",
    borderWidth: 1.5,
    borderColor: Theme.colors.primary,
    borderRadius: 8,
    paddingVertical: 5,
    paddingHorizontal: 12,
    minWidth: 64,
  },
  addButtonText: {
    fontSize: 12,
    fontWeight: "900",
    color: Theme.colors.primary,
  },
  addButtonIcon: {
    marginLeft: 2,
  },
  qtyContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Theme.colors.primary,
    borderRadius: 8,
    overflow: "hidden",
    height: 28,
  },
  qtyBtn: {
    paddingHorizontal: 8,
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
  },
  qtyText: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "800",
    minWidth: 16,
    textAlign: "center",
  },
  devSandbox: {
    marginTop: 32,
    marginHorizontal: 16,
    padding: 16,
    backgroundColor: "#f8fafc",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  devSandboxTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: "#0f172a",
  },
  devSandboxDesc: {
    fontSize: 11,
    color: "#64748b",
    marginTop: 2,
    lineHeight: 15,
  },
  devSandboxButtons: {
    flexDirection: "row",
    gap: 10,
    marginTop: 12,
  },
  devButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
  },
  devButtonText: {
    color: "#ffffff",
    fontSize: 11,
    fontWeight: "700",
  },
  checkoutBanner: {
    position: "absolute",
    bottom: 64, // Directly above standard navigation tab bar
    left: 12,
    right: 12,
    height: 56,
    backgroundColor: "#1b4332",
    borderRadius: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 5,
    zIndex: 10,
  },
  checkoutLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  checkoutCartIconBg: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    justifyContent: "center",
    alignItems: "center",
  },
  checkoutItemsCount: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "800",
  },
  checkoutSubtext: {
    color: "rgba(255, 255, 255, 0.7)",
    fontSize: 9,
    fontWeight: "600",
    marginTop: 1,
  },
  checkoutBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(255, 255, 255, 0.15)",
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  checkoutBtnText: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "800",
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
  toastContainer: {
    position: "absolute",
    top: 40,
    left: 16,
    right: 16,
    zIndex: 9999,
  },
  toastContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
  },
  toastText: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "700",
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#000000",
    zIndex: 999,
  },
  popupSheet: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#ffffff",
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingTop: 10,
    paddingBottom: Platform.OS === "ios" ? 36 : 24,
    zIndex: 1000,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: -10 },
    shadowOpacity: 0.12,
    shadowRadius: 20,
    elevation: 10,
  },
  dragHandle: {
    width: 44,
    height: 5,
    borderRadius: 3,
    backgroundColor: "#cbd5e1",
    alignSelf: "center",
    marginBottom: 20,
  },
  popupContent: {
    alignItems: "center",
    paddingHorizontal: 28,
  },
  popupIconWrapper: {
    position: "relative",
    marginBottom: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  popupIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 2,
  },
  pulseRing: {
    position: "absolute",
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 1.5,
    borderColor: "#e8f5e9",
    zIndex: 1,
    opacity: 0.7,
  },
  popupTitle: {
    fontSize: 20,
    fontWeight: "900",
    color: "#0f172a",
    textAlign: "center",
    marginBottom: 10,
  },
  popupDesc: {
    fontSize: 13,
    color: "#475569",
    textAlign: "center",
    lineHeight: 18,
    marginBottom: 24,
    fontWeight: "500",
  },
  popupPrimaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
    height: 50,
    borderRadius: 25,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 2,
  },
  popupPrimaryBtnText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "800",
  },
  btnIcon: {
    marginRight: 6,
  },
  popupSecondaryBtn: {
    width: "100%",
    height: 48,
    borderRadius: 24,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: "#e2e8f0",
    marginTop: 10,
  },
  popupSecondaryBtnText: {
    color: "#475569",
    fontSize: 13,
    fontWeight: "800",
  },
  popupTextLink: {
    paddingVertical: 14,
    marginTop: 8,
  },
  popupTextLinkText: {
    color: "#64748b",
    fontSize: 13,
    fontWeight: "700",
  },
  popupBackBtn: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    marginBottom: 18,
    gap: 4,
  },
  popupBackBtnText: {
    fontSize: 14,
    fontWeight: "800",
    color: "#0f172a",
  },
  addressInputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f8fafc",
    borderWidth: 1.5,
    borderColor: "#cbd5e1",
    borderRadius: 16,
    height: 52,
    width: "100%",
    paddingHorizontal: 16,
    marginBottom: 20,
  },
  addressInput: {
    flex: 1,
    marginLeft: 10,
    fontSize: 14,
    color: "#0f172a",
    fontWeight: "600",
  },
  inputIcon: {
    marginRight: 10,
  },
  profilePopupHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 24,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  profilePopupTitle: {
    fontSize: 18,
    fontWeight: "900",
    color: "#0f172a",
  },
  profilePopupCloseBtn: {
    padding: 4,
  },
  profileUserCard: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 24,
    paddingVertical: 20,
    gap: 16,
  },
  profileAvatarLarge: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#e8f5e9",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#2a5d4c",
  },
  profileAvatarTextLarge: {
    fontSize: 22,
    fontWeight: "900",
    color: "#2a5d4c",
  },
  profileUserDetails: {
    flex: 1,
    gap: 4,
  },
  profileUserName: {
    fontSize: 18,
    fontWeight: "800",
    color: "#0f172a",
  },
  profileUserMeta: {
    fontSize: 12,
    color: "#64748b",
    fontWeight: "600",
  },
  profileDivider: {
    height: 6,
    backgroundColor: "#f1f5f9",
  },
  profileOptionsList: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  profileOptionItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  profileOptionLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  profileOptionText: {
    fontSize: 14,
    color: "#334155",
    fontWeight: "700",
  },
  profilePopupFooter: {
    paddingHorizontal: 24,
    paddingTop: 16,
  },
  logoutBtnIcon: {
    marginRight: 6,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.4)",
    justifyContent: "flex-end",
  },
  modalDismissArea: {
    flex: 1,
  },
  modalSheet: {
    backgroundColor: "#ffffff",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: "85%",
    minHeight: "45%",
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: -10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 20,
  },
  sheetHeader: {
    alignItems: "center",
    paddingTop: 10,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  sheetHeaderBar: {
    width: 40,
    height: 5,
    borderRadius: 3,
    backgroundColor: "#cbd5e1",
    marginBottom: 12,
  },
  sheetTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    width: "100%",
    paddingHorizontal: 20,
  },
  sheetTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: Theme.colors.primaryDark,
    flex: 1,
    textAlign: "center",
  },
  backBtn: {
    padding: 4,
    position: "absolute",
    left: 20,
    zIndex: 10,
  },
  closeBtn: {
    padding: 4,
    position: "absolute",
    right: 20,
    zIndex: 10,
  },
  stageContainer: {
    flex: 1,
  },
  sheetScroll: {
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  cartItemsList: {
    gap: 16,
    marginBottom: 24,
  },
  cartItemRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#f8fafc",
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  cartItemImage: {
    width: 48,
    height: 48,
    marginRight: 12,
  },
  cartItemDetails: {
    flex: 1,
    marginRight: 12,
  },
  cartItemName: {
    fontSize: 14,
    fontWeight: "700",
    color: "#1e293b",
    marginBottom: 4,
  },
  cartItemPrice: {
    fontSize: 12,
    fontWeight: "600",
    color: "#64748b",
  },
  cartQtyContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Theme.colors.primary,
    borderRadius: 8,
    padding: 4,
    gap: 10,
  },
  cartQtyBtn: {
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  cartQtyText: {
    color: "#ffffff",
    fontWeight: "700",
    fontSize: 13,
    minWidth: 14,
    textAlign: "center",
  },
  billDetailsContainer: {
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#f1f5f9",
    borderRadius: 16,
    padding: 16,
    marginBottom: 40,
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.02,
    shadowRadius: 8,
  },
  billTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: "#1e293b",
    marginBottom: 12,
  },
  billRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 6,
  },
  billLabel: {
    fontSize: 13,
    color: "#64748b",
    fontWeight: "500",
  },
  billValue: {
    fontSize: 13,
    color: "#334155",
    fontWeight: "700",
  },
  freeText: {
    color: "#10b981",
    fontWeight: "700",
  },
  billDivider: {
    height: 1,
    backgroundColor: "#f1f5f9",
    marginVertical: 8,
  },
  grandTotalLabel: {
    fontSize: 14,
    fontWeight: "800",
    color: "#1e293b",
  },
  grandTotalValue: {
    fontSize: 15,
    fontWeight: "800",
    color: Theme.colors.primary,
  },
  sheetFooter: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: "#f1f5f9",
    backgroundColor: "#ffffff",
  },
  proceedBtn: {
    backgroundColor: Theme.colors.primary,
    borderRadius: 16,
    height: 54,
    paddingHorizontal: 20,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    shadowColor: Theme.colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 3,
  },
  proceedPrice: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "800",
  },
  proceedSubtext: {
    color: "rgba(255, 255, 255, 0.7)",
    fontSize: 10,
    fontWeight: "600",
  },
  proceedBtnRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  proceedText: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "700",
  },
  sectionContainer: {
    marginBottom: 20,
  },
  sheetSectionTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: "#1e293b",
    marginBottom: 10,
  },
  addressBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f8fafc",
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  addressTextWrapper: {
    flex: 1,
    marginLeft: 12,
  },
  addressLabel: {
    fontSize: 14,
    fontWeight: "700",
    color: "#334155",
    marginBottom: 2,
  },
  addressValue: {
    fontSize: 12,
    color: "#64748b",
    fontWeight: "500",
    lineHeight: 16,
  },
  optionsRow: {
    flexDirection: "row",
    gap: 12,
  },
  optionCard: {
    flex: 1,
    backgroundColor: "#ffffff",
    borderWidth: 1.5,
    borderColor: "#e2e8f0",
    borderRadius: 16,
    padding: 14,
    alignItems: "center",
    gap: 4,
  },
  optionCardSelected: {
    borderColor: Theme.colors.primary,
    backgroundColor: "#f0fdf4",
  },
  optionName: {
    fontSize: 14,
    fontWeight: "700",
    color: "#334155",
  },
  optionSub: {
    fontSize: 10,
    color: "#64748b",
    fontWeight: "600",
    textAlign: "center",
  },
  paymentMethodList: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    overflow: "hidden",
  },
  paymentMethodRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
    gap: 12,
  },
  paymentMethodSelected: {
    backgroundColor: "#f8fafc",
  },
  paymentMethodLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: "#334155",
    flex: 1,
  },
  radioOuter: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1.5,
    borderColor: "#cbd5e1",
    justifyContent: "center",
    alignItems: "center",
  },
  radioOuterSelected: {
    borderColor: Theme.colors.primary,
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Theme.colors.primary,
  },
  successContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 40,
    paddingHorizontal: 24,
  },
  successIconWrapper: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: "#dcfce7",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
  },
  successTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: Theme.colors.primaryDark,
    marginBottom: 8,
  },
  successDesc: {
    fontSize: 13,
    color: "#64748b",
    textAlign: "center",
    lineHeight: 18,
    marginBottom: 32,
  },
  successActions: {
    width: "100%",
    gap: 12,
  },
  successViewOrdersBtn: {
    backgroundColor: Theme.colors.primary,
    borderRadius: 16,
    height: 52,
    justifyContent: "center",
    alignItems: "center",
  },
  successViewOrdersText: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "700",
  },
  successCloseBtn: {
    backgroundColor: "#ffffff",
    borderWidth: 1.5,
    borderColor: "#e2e8f0",
    borderRadius: 16,
    height: 52,
    justifyContent: "center",
    alignItems: "center",
  },
  successCloseText: {
    color: "#64748b",
    fontSize: 15,
    fontWeight: "700",
  },

  // â”€â”€â”€ Cart Address Card â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  cartAddressCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f0fdf4",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#bbf7d0",
    padding: 12,
    marginHorizontal: 0,
    marginBottom: 16,
    gap: 10,
  },
  cartAddressLeft: {
    flex: 1,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  cartAddressIconBg: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#dcfce7",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 2,
  },
  cartAddressText: {
    flex: 1,
  },
  cartAddressLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "#16a34a",
    textTransform: "uppercase",
    letterSpacing: 0.4,
    marginBottom: 2,
  },
  cartAddressValue: {
    fontSize: 13,
    fontWeight: "600",
    color: "#1e293b",
    lineHeight: 18,
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

  // â”€â”€â”€ Change Address Modal Sheet â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  changeAddressSheet: {
    backgroundColor: "#ffffff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 12,
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 16,
  },
  sheetHandleBar: {
    width: 40,
    height: 5,
    backgroundColor: "#cbd5e1",
    borderRadius: 3,
    alignSelf: "center",
    marginBottom: 16,
  },
  changeAddressHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  changeAddressTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#0f172a",
  },
  currentLocationRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f0fdf4",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#bbf7d0",
    padding: 12,
    marginBottom: 20,
    gap: 8,
  },
  currentLocationText: {
    flex: 1,
    fontSize: 13,
    color: "#334155",
    fontWeight: "600",
  },
  useCurrentBtn: {
    backgroundColor: Theme.colors.primary,
    borderRadius: 6,
    paddingVertical: 4,
    paddingHorizontal: 10,
  },
  useCurrentBtnText: {
    color: "#ffffff",
    fontSize: 11,
    fontWeight: "800",
  },
  addressInputLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: "#334155",
    marginBottom: 8,
  },
  addressInputBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "#f8fafc",
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: "#e2e8f0",
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 20,
    minHeight: 80,
  },
  addressTextInputField: {
    flex: 1,
    fontSize: 14,
    color: "#0f172a",
    fontWeight: "500",
    lineHeight: 20,
  },
  saveAddressBtn: {
    flexDirection: "row",
    backgroundColor: Theme.colors.primary,
    borderRadius: 16,
    height: 52,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: Theme.colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 4,
    marginBottom: 8,
  },
  saveAddressBtnText: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "800",
  },
});



