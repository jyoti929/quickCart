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
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { Theme } from "../constants/theme";
import { auth } from "../services/firebase";
import { authStore } from "../services/authStore";
import {
  subscribeProductById,
  fetchProductsByState,
  Product,
  cleanProductName,
  formatPrice,
  getActualInrPrice,
} from "../services/productService";

interface Review {
  id: string;
  name: string;
  avatar: string;
  rating: number;
  comment: string;
  date: string;
}

// Helper to deterministically generate customer reviews based on product ID and category
const getProductReviews = (productId: number, category: string): Review[] => {
  const reviewerNames = [
    ["Rohan Sharma", "RS"],
    ["Priya Patel", "PP"],
    ["Amit Verma", "AV"],
    ["Sneha Iyer", "SI"],
    ["Vikram Malhotra", "VM"],
    ["Ananya Sen", "AS"]
  ];
  
  const commentsByCategory: Record<string, string[]> = {
    Veg: [
      "Extremely fresh and crisp! Sourced perfectly and delivered within 10 minutes.",
      "High quality veggies, exactly like picking them yourself at the local market.",
      "Very clean and hygienically packed. Satisfied with the freshness."
    ],
    Dairy: [
      "Always fresh, pure taste and excellent packing. Essential for my daily breakfast.",
      "Very good quality dairy product. The packaging keeps it perfectly cold.",
      "Tastes great, texture is perfect. Will definitely buy regularly."
    ],
    Drinks: [
      "Refreshing and delivered ice-cold! Absolute lifesaver in this heat.",
      "Very nice flavor, perfect sweetness. Tastes great when chilled.",
      "Super fast delivery and packaging was neat. Loved it."
    ],
    Snacks: [
      "Crispy, tasty and very fresh! Best teatime companion.",
      "Perfect blend of spices. My whole family loved this snack.",
      "Very fresh crunch, tastes premium. Great value for money."
    ],
    Sweets: [
      "Rich and authentic flavor. Absolutely delicious!",
      "Perfect texture, not overly sweet. Prepared very hygienically.",
      "Highly recommended for festive celebrations and quick cravings."
    ],
    Bakery: [
      "Super soft, smells fresh out of the oven. Truly delicious.",
      "Perfect fluffy texture. Goes wonderfully with butter or jam.",
      "Excellent quality bakery item, fresh and clean."
    ],
    Instant: [
      "Ready in minutes and tastes amazing! Extremely convenient.",
      "Very rich flavor, perfect portion for a quick meal.",
      "Ideal late-night snack, fast and easy to make."
    ],
    Atta: [
      "Makes extremely soft rotis, rich texture and very clean flour.",
      "Premium quality grains, highly nutritious and finely milled.",
      "Packed very cleanly and delivered fast. Essential kitchen staple."
    ],
    Personal: [
      "Gentle on skin, leaves a refreshing scent that lasts all day.",
      "High quality formula, very effective and highly nourishing.",
      "Clean packaging, feels premium and safe for daily care."
    ],
    Household: [
      "Very effective, cuts through tough grime and dirt in seconds.",
      "Neat packaging, works perfectly as advertised. Great utility.",
      "Clean smell, highly powerful active ingredients. Safe to use."
    ],
  };

  const reviewsList: Review[] = [];
  const count = 3; // Number of reviews per product

  for (let i = 0; i < count; i++) {
    const reviewerIndex = (productId + i) % reviewerNames.length;
    const [name, avatar] = reviewerNames[reviewerIndex];
    
    const categoryComments = commentsByCategory[category] || [
      "Excellent quality and value. Delivery was incredibly quick!",
      "Satisfied with this purchase. High standard packaging and freshness.",
      "Very good product, works exactly as described. Recommended!"
    ];
    const comment = categoryComments[(productId + i) % categoryComments.length];
    
    // Deterministic star rating based on product rating
    const rating = Math.min(5, Math.max(4, Math.round(4.0 + ((productId + i) % 3) * 0.5)));
    
    // Deterministic date
    const day = ((productId * 3 + i * 7) % 28) + 1;
    const month = ((productId + i) % 12) + 1;
    const dateStr = `${day < 10 ? '0' + day : day}/${month < 10 ? '0' + month : month}/2026`;

    reviewsList.push({
      id: `${productId}_rev_${i}`,
      name,
      avatar,
      rating,
      comment,
      date: dateStr
    });
  }

  return reviewsList;
};

// Helper function to generate rich category-specific product descriptions dynamically
const getProductDescription = (product: Product): string => {
  const name = cleanProductName(product.name);
  switch (product.category) {
    case "Veg":
      return `Fresh and organic ${name}. Sourced directly from certified local farms. Rich in dietary fiber, vitamins, and minerals. Freshly harvested and packed under strict hygiene controls to retain natural taste and texture. Best stored in a refrigerator.`;
    case "Dairy":
      return `Premium and pure ${name}. Packed under clean, high-grade dairy standards to ensure maximum nutritional value. Rich source of calcium and proteins. Perfect addition to your daily morning breakfast and cooking. Keep chilled.`;
    case "Drinks":
      return `Beat the summer heat with our chilled ${name}. Formulated to deliver instant refreshment and energy. Made from quality ingredients and packed securely to preserve its original aroma and freshness. Best served ice cold!`;
    case "Snacks":
      return `Crispy and delicious ${name}. Perfectly seasoned with spices to hit all the right snack cravings. Ideal for hosting parties, tea-time pairings, or office munching. 100% trans-fat free.`;
    case "Sweets":
      return `Delectable and authentic ${name} prepared using pure traditional recipes. Loaded with rich ingredients, nuts, and clean sweeteners. Perfect for celebrations, gifting, or treating yourself to a sweet snack.`;
    case "Bakery":
      return `Freshly baked daily ${name}. Soft, fluffy, and aromatic. Prepared with high-grade flour and clean butter. Perfect when toasted with butter or paired with your hot morning coffee/tea.`;
    case "Instant":
      return `Craving a quick meal? Prepare this delicious ${name} in under 5 minutes. Packed under protective packaging to ensure rich taste, shelf life, and ease of preparation. No artificial preservatives added.`;
    case "Atta":
      return `High-fiber, wholesome ${name} milled from select premium wheat grains. Perfect for making soft, fluffy, and nutritious rotis/flatbreads. Sifted and packed under complete hands-free hygienic conditions.`;
    case "Personal":
      return `Nourish your body with our gentle ${name}. Dermatologically tested and formulated with natural active ingredients to lock in hydration and freshness all day long. Suitable for all skin and hair types.`;
    case "Household":
      return `Make cleaning hassle-free with ${name}. Powerful active formula that fights grease, stains, and dirt effortlessly while remaining gentle on hands and home surfaces. Scented with natural extracts.`;
    default:
      return `Savor the authentic taste of ${name}. Packed and processed under high quality parameters. Sourced carefully to ensure complete customer satisfaction and standard freshness.`;
  }
};

export default function ProductDetailsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { productId } = useLocalSearchParams<{ productId?: string }>();

  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorState, setErrorState] = useState<"none" | "not_found" | "unauthorized" | "forbidden" | "server_error" | "offline">("none");
  const [similarProducts, setSimilarProducts] = useState<Product[]>([]);
  const [cartQuantities, setCartQuantities] = useState<{ [key: number]: number }>(authStore.getCart());

  // Subscribe to global cart updates
  useEffect(() => {
    const unsubscribe = authStore.subscribeCart(() => {
      setCartQuantities(authStore.getCart());
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!productId) {
      setErrorState("not_found");
      setLoading(false);
      return;
    }
    
    const prodIdNum = parseInt(productId);
    if (isNaN(prodIdNum)) {
      setErrorState("not_found");
      setLoading(false);
      return;
    }

    setLoading(true);
    setErrorState("none");

    // Track whether the effect has been cleaned up so async callbacks don't
    // update state after unmount.
    let cancelled = false;

    // 1. Session authorization check
    if (!auth.currentUser) {
      setErrorState("unauthorized");
      setLoading(false);
      return;
    }

    // 2. Subscribe to primary product details in real-time (single doc)
    console.log(`[LISTENER:CREATE] subscribeProductById id=${prodIdNum}`);
    const unsubscribeProduct = subscribeProductById(
      prodIdNum,
      (prod) => {
        if (cancelled) return;
        if (!prod) {
          setErrorState("not_found");
          setLoading(false);
          return;
        }

        // 3. Optional forbidden check
        const userState = authStore.getDetectedState();
        if (userState !== "Default" && prod.state !== userState) {
          setErrorState("forbidden");
          setLoading(false);
          return;
        }

        setProduct(prod);
        setLoading(false);

        // 4. FIX: Use a one-shot getDocs fetch for similar items — NOT a
        //    real-time listener. The similar-products row is presentational and
        //    does NOT need live updates. Using subscribeProductsByState here
        //    was adding a full state-scoped listener (potentially 100+ docs)
        //    every time a product page was opened, without any real benefit.
        fetchProductsByState(prod.state)
          .then((allProducts) => {
            if (cancelled) return;
            const similar = allProducts
              .filter((p) => p.category === prod.category && p.id !== prod.id)
              .slice(0, 6);
            setSimilarProducts(similar);
          })
          .catch((err) => {
            // Non-fatal: log and continue — main product content is still shown
            console.warn("Failed to fetch similar products:", err);
          });
      },
      (err: any) => {
        if (cancelled) return;
        console.error("Failed to subscribe product details:", err);
        if (err.message && (err.message.includes("network") || err.message.includes("offline") || err.message.includes("failed-precondition"))) {
          setErrorState("offline");
        } else {
          setErrorState("server_error");
        }
        setLoading(false);
      }
    );

    return () => {
      cancelled = true;
      console.log(`[LISTENER:DESTROY] subscribeProductById id=${prodIdNum}`);
      unsubscribeProduct();
    };
  }, [productId]);

  const handleGoBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/(tabs)/home");
    }
  };

  const handleAddToCart = () => {
    if (authStore.getIsBlocked()) {
      Alert.alert(
        "Account Blocked",
        "Your account has been temporarily blocked. You cannot place orders until your account is restored."
      );
      return;
    }
    if (product) {
      authStore.updateCart(product.id, 1);
    }
  };

  const handleBuyNow = () => {
    if (authStore.getIsBlocked()) {
      Alert.alert(
        "Account Blocked",
        "Your account has been temporarily blocked. You cannot place orders until your account is restored."
      );
      return;
    }
    if (product) {
      const currentQty = cartQuantities[product.id] || 0;
      if (currentQty === 0) {
        authStore.updateCart(product.id, 1);
      }
      router.push("/cart");
    }
  };

  const handleRemoveFromCart = () => {
    if (authStore.getIsBlocked()) {
      Alert.alert(
        "Account Blocked",
        "Your account has been temporarily blocked. You cannot place orders until your account is restored."
      );
      return;
    }
    if (product) {
      authStore.updateCart(product.id, -1);
    }
  };

  const handleAddSimilarToCart = (item: Product) => {
    if (authStore.getIsBlocked()) {
      Alert.alert(
        "Account Blocked",
        "Your account has been temporarily blocked. You cannot place orders until your account is restored."
      );
      return;
    }
    authStore.updateCart(item.id, 1);
  };

  const handleRemoveSimilarFromCart = (item: Product) => {
    if (authStore.getIsBlocked()) {
      Alert.alert(
        "Account Blocked",
        "Your account has been temporarily blocked. You cannot place orders until your account is restored."
      );
      return;
    }
    authStore.updateCart(item.id, -1);
  };

  // Rendering lifecycle states
  if (loading) {
    return (
      <View style={[styles.centered, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={Theme.colors.primary} />
        <Text style={styles.loadingText}>Loading item details...</Text>
      </View>
    );
  }

  if (errorState !== "none" || !product) {
    let errorTitle = "Error";
    let errorMessage = "An unexpected error occurred.";
    let iconName: any = "alert-circle-outline";
    let iconColor = "#ef4444";
    let actionButtonText = "Go Back";
    let onActionPress = handleGoBack;

    if (errorState === "not_found" || !product) {
      errorTitle = "Not Found";
      errorMessage = "Item not found. Please go back and choose another item.";
      iconName = "search-outline";
      iconColor = "#64748b";
    } else if (errorState === "unauthorized") {
      errorTitle = "Session Expired";
      errorMessage = "Your session has expired. Please login again.";
      iconName = "lock-closed-outline";
      iconColor = "#f59e0b";
      actionButtonText = "Login Now";
      onActionPress = () => router.replace("/login");
    } else if (errorState === "forbidden") {
      errorTitle = "Access Denied";
      errorMessage = "You do not have permission to view this item.";
      iconName = "ban-outline";
      iconColor = "#ef4444";
    } else if (errorState === "server_error") {
      errorTitle = "Server Error";
      errorMessage = "Something went wrong. Please try again later.";
      iconName = "server-outline";
      iconColor = "#ef4444";
      actionButtonText = "Retry Load";
      onActionPress = () => router.replace({ pathname: "/product", params: { productId } });
    } else if (errorState === "offline") {
      errorTitle = "No Connection";
      errorMessage = "No internet connection. Please check your network and try again.";
      iconName = "wifi-outline";
      iconColor = "#3b82f6";
      actionButtonText = "Retry Connect";
      onActionPress = () => router.replace({ pathname: "/product", params: { productId } });
    }

    return (
      <View style={[styles.centered, { paddingTop: insets.top }]}>
        <Ionicons name={iconName} size={80} color={iconColor} style={{ marginBottom: 16 }} />
        <Text style={styles.errorTitle}>{errorTitle}</Text>
        <Text style={styles.errorText}>{errorMessage}</Text>
        <TouchableOpacity style={styles.backButton} onPress={onActionPress}>
          <Text style={styles.backButtonText}>{actionButtonText}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const qty = cartQuantities[product.id] || 0;
  const discount = Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100);

  // Deterministic stock count based on product ID to simulate high fidelity inventory messaging
  const stockCount = ((product.id * 7) % 15) + 2;
  const isLowStock = stockCount <= 5;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleGoBack} style={styles.backIconBtn}>
          <Ionicons name="arrow-back" size={24} color={Theme.colors.primaryDark} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {cleanProductName(product.name)}
        </Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Product Image Card */}
        <View style={styles.imageContainer}>
          <Image source={product.imageUrl} style={styles.productImage as any} contentFit="contain" />
          {discount > 0 && (
            <View style={styles.discountBadge}>
              <Text style={styles.discountText}>{discount}% OFF</Text>
            </View>
          )}
        </View>

        {/* Info Area */}
        <View style={styles.infoSection}>
          <View style={styles.categoryRow}>
            <Text style={styles.categoryBadge}>{product.category}</Text>
            <View style={styles.etaContainer}>
              <Ionicons name="time-outline" size={14} color={Theme.colors.primary} />
              <Text style={styles.etaText}>{product.eta || "10 Mins"}</Text>
            </View>
          </View>

          <Text style={styles.productName}>{cleanProductName(product.name)}</Text>

          {/* Product Star Rating Row */}
          <View style={styles.ratingRow}>
            <View style={styles.starsContainer}>
              {[1, 2, 3, 4, 5].map((sIdx) => {
                const isFullStar = sIdx <= Math.floor(product.rating);
                const isHalfStar = !isFullStar && sIdx - 0.5 <= product.rating;
                return (
                  <Ionicons
                    key={sIdx}
                    name={isFullStar ? "star" : isHalfStar ? "star-half" : "star-outline"}
                    size={16}
                    color="#f59e0b"
                  />
                );
              })}
            </View>
            <Text style={styles.ratingValueText}>{product.rating.toFixed(1)}</Text>
            <Text style={styles.ratingCountText}>({12 + (product.id * 3) % 25} reviews)</Text>
          </View>

          {/* Stock Message Badge */}
          <View style={styles.stockRow}>
            {isLowStock ? (
              <View style={[styles.stockBadge, styles.lowStockBg]}>
                <Ionicons name="alert-circle" size={12} color="#ef4444" />
                <Text style={[styles.stockText, styles.lowStockText]}>
                  Only {stockCount} left in stock!
                </Text>
              </View>
            ) : (
              <View style={[styles.stockBadge, styles.inStockBg]}>
                <Ionicons name="checkmark-circle" size={12} color="#16a34a" />
                <Text style={[styles.stockText, styles.inStockText]}>
                  In Stock (State: {product.state})
                </Text>
              </View>
            )}
            <Text style={styles.deliverySub}>- Delivery in {product.eta || "10 Mins"}</Text>
          </View>

          {/* Pricing & Double-Sync Stepper row */}
          <View style={styles.priceStepperRow}>
            <View>
              <Text style={styles.productWeight}>{product.weight}</Text>
              <View style={styles.priceContainer}>
                <Text style={styles.price}>{formatPrice(product.price)}</Text>
                {product.originalPrice > product.price && (
                  <Text style={styles.originalPrice}>{formatPrice(product.originalPrice)}</Text>
                )}
              </View>
            </View>

            {/* Stepper controls inside detail screen */}
            {qty > 0 ? (
              <View style={styles.inlineQtyContainer}>
                <TouchableOpacity style={styles.inlineQtyBtn} onPress={handleRemoveFromCart}>
                  <Ionicons name="remove" size={16} color="#ffffff" />
                </TouchableOpacity>
                <Text style={styles.inlineQtyText}>{qty}</Text>
                <TouchableOpacity style={styles.inlineQtyBtn} onPress={handleAddToCart}>
                  <Ionicons name="add" size={16} color="#ffffff" />
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity style={styles.inlineAddBtn} onPress={handleAddToCart} activeOpacity={0.8}>
                <Text style={styles.inlineAddBtnText}>ADD</Text>
                <Ionicons name="add" size={14} color={Theme.colors.primary} />
              </TouchableOpacity>
            )}
          </View>

          <View style={styles.divider} />

          {/* Dynamic description section */}
          <View style={styles.descriptionSection}>
            <Text style={styles.detailTitle}>About the Product</Text>
            <Text style={styles.descriptionText}>{getProductDescription(product)}</Text>
          </View>

          <View style={styles.divider} />

          {/* Product description details */}
          <View style={styles.detailSection}>
            <Text style={styles.detailTitle}>Product Information</Text>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Dispatch Location</Text>
              <Text style={styles.detailValue}>{product.state} Hub</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Delivery Speed</Text>
              <Text style={styles.detailValue}>Standard / Express available</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Safety & Hygiene</Text>
              <Text style={styles.detailValue}>100% Hygienically Packed</Text>
            </View>
          </View>

          <View style={styles.divider} />

          {/* Customer Reviews List Section */}
          <View style={styles.reviewsSection}>
            <View style={styles.reviewsHeader}>
              <Text style={styles.detailTitle}>Customer Reviews</Text>
              <View style={styles.reviewsHeaderRating}>
                <Ionicons name="star" size={14} color="#f59e0b" />
                <Text style={styles.reviewsHeaderRatingVal}>{product.rating.toFixed(1)}</Text>
                <Text style={styles.reviewsHeaderCount}>({12 + (product.id * 3) % 25} reviews)</Text>
              </View>
            </View>

            <View style={styles.reviewsList}>
              {getProductReviews(product.id, product.category).map((review) => (
                <View key={review.id} style={styles.reviewCard}>
                  <View style={styles.reviewUserRow}>
                    <View style={styles.reviewAvatar}>
                      <Text style={styles.reviewAvatarText}>{review.avatar}</Text>
                    </View>
                    <View style={styles.reviewUserMeta}>
                      <Text style={styles.reviewUserName}>{review.name}</Text>
                      <Text style={styles.reviewDate}>{review.date}</Text>
                    </View>
                    <View style={styles.reviewStars}>
                      {[1, 2, 3, 4, 5].map((sIndex) => (
                        <Ionicons
                          key={sIndex}
                          name={sIndex <= review.rating ? "star" : "star-outline"}
                          size={12}
                          color="#f59e0b"
                        />
                      ))}
                    </View>
                  </View>
                  <Text style={styles.reviewComment}>{review.comment}</Text>
                </View>
              ))}
            </View>
          </View>

          {/* Similar Products Feed */}
          {similarProducts.length > 0 && (
            <View style={styles.similarSection}>
              <Text style={styles.similarTitle}>Similar Products</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.similarScrollContent}
              >
                {similarProducts.map((item) => {
                  const itemQty = cartQuantities[item.id] || 0;
                  const itemPrice = getActualInrPrice(item.price);
                  return (
                    <View key={item.id} style={styles.similarCard}>
                      <TouchableOpacity
                        activeOpacity={0.8}
                        onPress={() => {
                          // Push to load the product page again with similar product ID
                          router.push({
                            pathname: "/product",
                            params: { productId: String(item.id ?? "") },
                          });
                        }}
                      >
                        <Image source={item.imageUrl} style={styles.similarImage as any} contentFit="contain" />
                        <Text style={styles.similarName} numberOfLines={1}>
                          {cleanProductName(item.name)}
                        </Text>
                        <Text style={styles.similarWeight}>{item.weight}</Text>
                      </TouchableOpacity>

                      <View style={styles.similarCardFooter}>
                        <Text style={styles.similarPrice}>Rs. {itemPrice}</Text>

                        {itemQty > 0 ? (
                          <View style={styles.similarQtyRow}>
                            <TouchableOpacity
                              style={styles.similarQtyBtn}
                              onPress={() => handleRemoveSimilarFromCart(item)}
                            >
                              <Ionicons name="remove" size={12} color="#ffffff" />
                            </TouchableOpacity>
                            <Text style={styles.similarQtyText}>{itemQty}</Text>
                            <TouchableOpacity
                              style={styles.similarQtyBtn}
                              onPress={() => handleAddSimilarToCart(item)}
                            >
                              <Ionicons name="add" size={12} color="#ffffff" />
                            </TouchableOpacity>
                          </View>
                        ) : (
                          <TouchableOpacity
                            style={styles.similarAddBtn}
                            onPress={() => handleAddSimilarToCart(item)}
                          >
                            <Text style={styles.similarAddText}>ADD</Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    </View>
                  );
                })}
              </ScrollView>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Sticky Bottom Actions Section - Respects Android bottom safe area */}
      <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, 16) }]}>
        <TouchableOpacity style={styles.buyNowBtn} onPress={handleBuyNow}>
          <Text style={styles.buyNowBtnText}>Buy Now</Text>
          <Ionicons name="flash" size={20} color="#ffffff" style={{ marginLeft: 8 }} />
        </TouchableOpacity>

        {qty > 0 ? (
          <View style={styles.qtyContainer}>
            <TouchableOpacity style={styles.qtyBtn} onPress={handleRemoveFromCart}>
              <Ionicons name="remove" size={20} color="#ffffff" />
            </TouchableOpacity>
            <Text style={styles.qtyText}>{qty}</Text>
            <TouchableOpacity style={styles.qtyBtn} onPress={handleAddToCart}>
              <Ionicons name="add" size={20} color="#ffffff" />
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity style={styles.addBtn} onPress={handleAddToCart}>
            <Text style={styles.addBtnText}>Add to Cart</Text>
            <Ionicons name="cart-outline" size={20} color="#ffffff" style={{ marginLeft: 8 }} />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#ffffff",
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#ffffff",
    padding: 24,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: "#64748b",
    fontWeight: "600",
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: Theme.colors.primaryDark,
    marginBottom: 8,
  },
  errorText: {
    fontSize: 14,
    color: "#64748b",
    fontWeight: "500",
    textAlign: "center",
    marginBottom: 24,
    lineHeight: 20,
  },
  backButton: {
    backgroundColor: Theme.colors.primary,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
  },
  backButtonText: {
    color: "#ffffff",
    fontWeight: "700",
    fontSize: 14,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
    backgroundColor: "#ffffff",
  },
  backIconBtn: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: Theme.colors.primaryDark,
    flex: 1,
    textAlign: "center",
  },
  scrollContent: {
    paddingBottom: 120,
  },
  imageContainer: {
    width: "100%",
    height: 300,
    backgroundColor: "#f8fafc",
    justifyContent: "center",
    alignItems: "center",
    position: "relative",
  },
  productImage: {
    width: "80%",
    height: "80%",
  },
  discountBadge: {
    position: "absolute",
    top: 16,
    left: 16,
    backgroundColor: "#ef4444",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  discountText: {
    color: "#ffffff",
    fontSize: 11,
    fontWeight: "800",
  },
  infoSection: {
    padding: 20,
  },
  categoryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  categoryBadge: {
    backgroundColor: "#f1f5f9",
    color: "#475569",
    fontSize: 11,
    fontWeight: "700",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    textTransform: "uppercase",
  },
  etaContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f0fdf4",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 4,
  },
  etaText: {
    color: Theme.colors.primary,
    fontSize: 11,
    fontWeight: "700",
  },
  productName: {
    fontSize: 22,
    fontWeight: "800",
    color: Theme.colors.primaryDark,
    marginBottom: 4,
  },
  ratingRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  starsContainer: {
    flexDirection: "row",
    gap: 2,
    marginRight: 8,
  },
  ratingValueText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#1e293b",
    marginRight: 6,
  },
  ratingCountText: {
    fontSize: 12,
    color: "#64748b",
    fontWeight: "500",
  },
  stockRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  stockBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 4,
  },
  lowStockBg: {
    backgroundColor: "#fef2f2",
  },
  inStockBg: {
    backgroundColor: "#f0fdf4",
  },
  stockText: {
    fontSize: 11,
    fontWeight: "700",
  },
  lowStockText: {
    color: "#ef4444",
  },
  inStockText: {
    color: "#16a34a",
  },
  deliverySub: {
    fontSize: 11,
    color: "#64748b",
    fontWeight: "500",
    marginLeft: 6,
  },
  priceStepperRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  productWeight: {
    fontSize: 14,
    color: "#64748b",
    fontWeight: "600",
    marginBottom: 2,
  },
  priceContainer: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 8,
  },
  price: {
    fontSize: 24,
    fontWeight: "800",
    color: Theme.colors.primary,
  },
  originalPrice: {
    fontSize: 16,
    color: "#94a3b8",
    textDecorationLine: "line-through",
    fontWeight: "600",
  },
  inlineQtyContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: Theme.colors.primary,
    borderRadius: 10,
    height: 38,
    width: 100,
    paddingHorizontal: 12,
  },
  inlineQtyBtn: {
    padding: 4,
  },
  inlineQtyText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "800",
  },
  inlineAddBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#ffffff",
    borderWidth: 1.5,
    borderColor: Theme.colors.primary,
    borderRadius: 10,
    height: 38,
    width: 90,
    gap: 4,
  },
  inlineAddBtnText: {
    color: Theme.colors.primary,
    fontSize: 13,
    fontWeight: "800",
  },
  divider: {
    height: 1,
    backgroundColor: "#f1f5f9",
    marginVertical: 16,
  },
  descriptionSection: {
    gap: 8,
  },
  descriptionText: {
    fontSize: 14,
    color: "#475569",
    lineHeight: 20,
    fontWeight: "400",
  },
  detailSection: {
    gap: 12,
  },
  detailTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: Theme.colors.primaryDark,
    marginBottom: 4,
  },
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  detailLabel: {
    fontSize: 13,
    color: "#64748b",
    fontWeight: "500",
  },
  detailValue: {
    fontSize: 13,
    color: "#334155",
    fontWeight: "700",
  },
  reviewsSection: {
    marginTop: 8,
  },
  reviewsHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  reviewsHeaderRating: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  reviewsHeaderRatingVal: {
    fontSize: 13,
    fontWeight: "700",
    color: "#1e293b",
  },
  reviewsHeaderCount: {
    fontSize: 11,
    color: "#64748b",
    fontWeight: "500",
  },
  reviewsList: {
    gap: 12,
  },
  reviewCard: {
    backgroundColor: "#f8fafc",
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: "#f1f5f9",
    marginBottom: 4,
  },
  reviewUserRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  reviewAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#e2e8f0",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 10,
  },
  reviewAvatarText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#475569",
  },
  reviewUserMeta: {
    flex: 1,
  },
  reviewUserName: {
    fontSize: 12,
    fontWeight: "700",
    color: "#1e293b",
  },
  reviewDate: {
    fontSize: 10,
    color: "#94a3b8",
    fontWeight: "500",
    marginTop: 1,
  },
  reviewStars: {
    flexDirection: "row",
    gap: 1,
  },
  reviewComment: {
    fontSize: 13,
    color: "#475569",
    lineHeight: 18,
    fontWeight: "400",
  },
  similarSection: {
    marginTop: 24,
  },
  similarTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: Theme.colors.primaryDark,
    marginBottom: 16,
  },
  similarScrollContent: {
    gap: 12,
    paddingRight: 16,
  },
  similarCard: {
    width: 130,
    backgroundColor: "#ffffff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#f1f5f9",
    padding: 10,
  },
  similarImage: {
    width: "100%",
    height: 80,
    marginBottom: 8,
  },
  similarName: {
    fontSize: 12,
    fontWeight: "700",
    color: "#1e293b",
    marginBottom: 2,
  },
  similarWeight: {
    fontSize: 10,
    color: "#64748b",
    fontWeight: "500",
    marginBottom: 8,
  },
  similarCardFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 4,
  },
  similarPrice: {
    fontSize: 13,
    fontWeight: "800",
    color: "#0f172a",
  },
  similarAddBtn: {
    borderWidth: 1,
    borderColor: Theme.colors.primary,
    borderRadius: 6,
    paddingVertical: 4,
    paddingHorizontal: 8,
    backgroundColor: "#ffffff",
  },
  similarAddText: {
    color: Theme.colors.primary,
    fontSize: 10,
    fontWeight: "800",
  },
  similarQtyRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Theme.colors.primary,
    borderRadius: 6,
    paddingHorizontal: 4,
    height: 22,
  },
  similarQtyBtn: {
    padding: 2,
  },
  similarQtyText: {
    color: "#ffffff",
    fontSize: 11,
    fontWeight: "800",
    marginHorizontal: 4,
  },
  bottomBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#ffffff",
    borderTopWidth: 1,
    borderTopColor: "#f1f5f9",
    paddingHorizontal: 16,
    paddingTop: 12,
    flexDirection: "row",
    gap: 12,
    zIndex: 100,
  },
  addBtn: {
    flex: 1,
    backgroundColor: Theme.colors.primary,
    borderRadius: 14,
    height: 52,
    justifyContent: "center",
    alignItems: "center",
    flexDirection: "row",
    shadowColor: Theme.colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 3,
  },
  addBtnText: {
    color: "#ffffff",
    fontWeight: "700",
    fontSize: 15,
  },
  buyNowBtn: {
    flex: 1,
    backgroundColor: "#f97316", // Premium orange accent for immediate checkout
    borderRadius: 14,
    height: 52,
    justifyContent: "center",
    alignItems: "center",
    flexDirection: "row",
    shadowColor: "#f97316",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 3,
  },
  buyNowBtnText: {
    color: "#ffffff",
    fontWeight: "700",
    fontSize: 15,
  },
  qtyContainer: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: Theme.colors.primary,
    borderRadius: 14,
    height: 52,
    paddingHorizontal: 16,
  },
  qtyBtn: {
    padding: 8,
  },
  qtyText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "800",
  },
});



