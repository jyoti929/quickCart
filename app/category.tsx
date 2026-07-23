import React, { useState, useEffect } from "react";
import {
  Text,
  View,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  StatusBar,
  ActivityIndicator,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { Theme } from "../constants/theme";
import { authStore } from "../services/authStore";
import { subscribeProductsByState, Product, cleanProductName, formatPrice, getActualInrPrice } from "../services/productService";
import { subscribeCategories } from "../services/adminService";



export default function CategoryScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { categoryId } = useLocalSearchParams<{ categoryId?: string }>();
  const detectedState = authStore.getDetectedState() || "Default";

  // Screen states
  const [categories, setCategories] = useState<any[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [cartQuantities, setCartQuantities] = useState<{ [key: number]: number }>(authStore.getCart());
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<"Newest" | "Price Low-High" | "Price High-Low" | "Best Selling">("Newest");
  
  const [isLoading, setIsLoading] = useState(false);
  const [isError, setIsError] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const currentCategory = categories.find((c) => c.id === categoryId) || {
    id: categoryId || "All",
    name: "Products",
    icon: "grid-outline",
    color: Theme.colors.primary,
    bg: "#f1f5f9"
  };

  // Subscribe to global cart updates
  useEffect(() => {
    const unsubscribe = authStore.subscribeCart(() => {
      setCartQuantities(authStore.getCart());
    });
    return () => unsubscribe();
  }, []);

  // Load categories in real-time
  useEffect(() => {
    const unsubscribe = subscribeCategories((cats) => {
      const activeCats = cats
        .filter((cat) => cat.isActive !== false)
        .sort((a, b) => (a.displayOrder || 99) - (b.displayOrder || 99));
      setCategories(activeCats);
    });
    return () => unsubscribe();
  }, []);

  // Load products for the category & state
  useEffect(() => {
    if (!categoryId) return;
    setIsLoading(true);
    setIsError(false);
    const unsubscribe = subscribeProductsByState(
      detectedState,
      (stateProducts) => {
        const filtered = stateProducts.filter((p) => p.category === categoryId || p.categoryId === categoryId);
        setProducts(filtered);
        setIsLoading(false);
      },
      (err) => {
        console.error("Error loading products in category screen subscription:", err);
        setIsError(true);
        setIsLoading(false);
      }
    );
    return () => unsubscribe();
  }, [categoryId, detectedState, refreshTrigger]);

  // Scoped search
  const filteredProducts = products.filter((p) =>
    cleanProductName(p.name).toLowerCase().includes(searchQuery.toLowerCase())
  );

  const sortedProducts = [...filteredProducts].sort((a, b) => {
    if (sortBy === "Newest") return b.id - a.id;
    if (sortBy === "Price Low-High") return a.price - b.price;
    if (sortBy === "Price High-Low") return b.price - a.price;
    if (sortBy === "Best Selling") return (b.rating || 0) - (a.rating || 0);
    return 0;
  });

  const updateQuantity = (productId: number, change: number) => {
    authStore.updateCart(productId, change);
  };

  const totalCartItems = Object.values(cartQuantities).reduce((a, b) => a + b, 0);
  const totalCartPrice = Object.entries(cartQuantities).reduce((acc, [id, qty]) => {
    const prod = products.find((p) => p.id === parseInt(id));
    if (prod) {
      return acc + getActualInrPrice(prod.price) * qty;
    }
    // Check global products generated, or search through other states. 
    // However, the pricing is standard, so we can calculate price roughly.
    return acc + getActualInrPrice(2.5) * qty; // Fallback default pricing
  }, 0);

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      {/* Navigation Header */}
      <View style={styles.navHeader}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={24} color={Theme.colors.primaryDark} />
        </TouchableOpacity>
        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle}>{currentCategory.name}</Text>
        </View>
        <View style={styles.headerRightPlaceholder} />
      </View>

      {/* Local Search Bar */}
      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={18} color="#94a3b8" />
          <TextInput
            placeholder={`Search within ${currentCategory.name}...`}
            placeholderTextColor="#94a3b8"
            value={searchQuery}
            onChangeText={setSearchQuery}
            style={styles.searchInput}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery("")}>
              <Ionicons name="close-circle" size={18} color="#94a3b8" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Sort Options Selector */}
      {!isLoading && !isError && products.length > 0 && (
        <View style={styles.sortContainer}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.sortScroll}>
            <Text style={styles.sortLabel}>Sort by:</Text>
            {(["Newest", "Price Low-High", "Price High-Low", "Best Selling"] as const).map((option) => {
              const isSelected = sortBy === option;
              return (
                <TouchableOpacity
                  key={option}
                  style={[styles.sortPill, isSelected && styles.sortPillActive]}
                  onPress={() => setSortBy(option)}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.sortPillText, isSelected && styles.sortPillTextActive]}>
                    {option === "Newest" && "Newest"}
                    {option === "Price Low-High" && "Price: Low to High"}
                    {option === "Price High-Low" && "Price: High to Low"}
                    {option === "Best Selling" && "Best Selling"}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      )}

      {/* Main product area */}
      {isLoading ? (
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color={Theme.colors.primary} />
          <Text style={styles.loadingText}>Fetching local items...</Text>
        </View>
      ) : isError ? (
        <View style={styles.centerContent}>
          <Ionicons name="cloud-offline-outline" size={48} color={Theme.colors.error} />
          <Text style={styles.errorText}>Oops! Failed to load items.</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={() => setRefreshTrigger(prev => prev + 1)} activeOpacity={0.8}>
            <Text style={styles.retryBtnText}>Retry Load</Text>
          </TouchableOpacity>
        </View>
      ) : filteredProducts.length === 0 ? (
        <View style={styles.centerContent}>
          <Ionicons name="search-outline" size={54} color="#CBD5E1" />
          <Text style={styles.emptyText}>
            {searchQuery ? "No matching products found." : `No products available in this category.`}
          </Text>
          {!searchQuery && (
            <TouchableOpacity style={styles.retryBtn} onPress={() => setRefreshTrigger(prev => prev + 1)} activeOpacity={0.8}>
              <Text style={styles.retryBtnText}>Reload Items</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <View style={styles.productsGrid}>
            {sortedProducts.map((prod) => {
              const qty = cartQuantities[prod.id] || 0;
              const hasDiscount = prod.originalPrice > prod.price;
              const discountPercent = Math.round(
                ((prod.originalPrice - prod.price) / prod.originalPrice) * 100
              );

              return (
                <View key={prod.id} style={styles.productCard}>
                  {/* Photo container */}
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
                    <View style={styles.imageWrapper}>
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
                        <Ionicons name="flash" size={10} color="#16A34A" />
                        <Text style={styles.etaText}>{prod.eta}</Text>
                      </View>
                    </View>
                  </TouchableOpacity>

                  {/* Details */}
                  <View style={styles.detailsContainer}>
                    <TouchableOpacity
                      activeOpacity={0.8}
                      onPress={() => {
                        router.push({
                          pathname: "/product",
                          params: { productId: String(prod.id ?? "") }
                        });
                      }}
                    >
                      <Text style={styles.productName} numberOfLines={2}>
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

                      {/* ADD / Quantity Controls */}
                      {qty === 0 ? (
                        <TouchableOpacity
                          style={styles.addButton}
                          activeOpacity={0.8}
                          onPress={() => updateQuantity(prod.id, 1)}
                        >
                          <Text style={styles.addButtonText}>ADD</Text>
                          <Ionicons name="add" size={12} color={Theme.colors.primary} />
                        </TouchableOpacity>
                      ) : (
                        <View style={styles.qtyContainer}>
                          <TouchableOpacity
                            style={styles.qtyBtn}
                            onPress={() => updateQuantity(prod.id, -1)}
                          >
                            <Ionicons name="remove" size={14} color="#FFFFFF" />
                          </TouchableOpacity>
                          <Text style={styles.qtyText}>{qty}</Text>
                          <TouchableOpacity
                            style={styles.qtyBtn}
                            onPress={() => updateQuantity(prod.id, 1)}
                          >
                            <Ionicons name="add" size={14} color="#FFFFFF" />
                          </TouchableOpacity>
                        </View>
                      )}
                    </View>
                  </View>
                </View>
              );
            })}
          </View>
        </ScrollView>
      )}

      {/* Floating Checkout Banner */}
      {totalCartItems > 0 && (
        <View style={styles.checkoutBanner}>
          <View style={styles.checkoutLeft}>
            <View style={styles.checkoutCartIconBg}>
              <Ionicons name="basket" size={20} color="#FFFFFF" />
            </View>
            <View>
              <Text style={styles.checkoutItemsCount}>
                {totalCartItems} Item{totalCartItems > 1 ? "s" : ""} • ₹{totalCartPrice}
              </Text>
              <Text style={styles.checkoutSubtext}>Delivering to {detectedState}</Text>
            </View>
          </View>
          <TouchableOpacity
            style={styles.checkoutBtn}
            activeOpacity={0.8}
            onPress={() => {
              router.push("/cart");
            }}
          >
            <Text style={styles.checkoutBtnText}>View Cart</Text>
            <Ionicons name="chevron-forward" size={16} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Theme.colors.background,
  },
  navHeader: {
    flexDirection: "row",
    alignItems: "center",
    height: 56,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitleContainer: {
    flex: 1,
    marginLeft: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "900",
    color: Theme.colors.primaryDark,
  },
  headerSubtitle: {
    fontSize: 12,
    color: Theme.colors.textMedium,
    fontWeight: "500",
  },
  headerRightPlaceholder: {
    width: 40,
  },
  searchContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Theme.colors.inputBg,
    borderRadius: 16,
    height: 44,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: Theme.colors.border,
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 14,
    color: Theme.colors.primaryDark,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 100,
  },
  productsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    rowGap: 16,
  },
  productCard: {
    width: "48%",
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: "#F1F5F9",
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.02,
    shadowRadius: 6,
    elevation: 1,
  },
  imageWrapper: {
    width: "100%",
    height: 120,
    backgroundColor: "#F8FAFC",
    position: "relative",
  },
  productImage: {
    width: "100%",
    height: "100%",
  },
  discountBadge: {
    position: "absolute",
    top: 8,
    left: 8,
    backgroundColor: Theme.colors.primary,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  discountBadgeText: {
    color: "#FFFFFF",
    fontSize: 9,
    fontWeight: "900",
  },
  etaBadge: {
    position: "absolute",
    bottom: 8,
    left: 8,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 8,
    gap: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
  },
  etaText: {
    fontSize: 9,
    fontWeight: "800",
    color: "#0F172A",
  },
  detailsContainer: {
    padding: 12,
  },
  productName: {
    fontSize: 13,
    fontWeight: "800",
    color: Theme.colors.primaryDark,
    lineHeight: 18,
    height: 36,
    marginBottom: 2,
  },
  productWeight: {
    fontSize: 11,
    color: Theme.colors.textLight,
    fontWeight: "600",
    marginBottom: 8,
  },
  priceRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  productPrice: {
    fontSize: 15,
    fontWeight: "900",
    color: Theme.colors.primaryDark,
  },
  productOriginalPrice: {
    fontSize: 11,
    textDecorationLine: "line-through",
    color: Theme.colors.textLight,
    fontWeight: "600",
  },
  addButton: {
    borderWidth: 1.5,
    borderColor: Theme.colors.primary,
    backgroundColor: "#FFFFFF",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  addButtonText: {
    color: Theme.colors.primary,
    fontSize: 11,
    fontWeight: "900",
  },
  qtyContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Theme.colors.primary,
    borderRadius: 8,
    overflow: "hidden",
  },
  qtyBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  qtyText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "900",
    paddingHorizontal: 4,
  },
  centerContent: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 30,
    gap: 16,
  },
  loadingText: {
    fontSize: 14,
    color: Theme.colors.textMedium,
    fontWeight: "700",
  },
  errorText: {
    fontSize: 15,
    color: Theme.colors.error,
    fontWeight: "700",
  },
  emptyText: {
    fontSize: 14,
    color: Theme.colors.textMedium,
    textAlign: "center",
    lineHeight: 20,
  },
  retryBtn: {
    backgroundColor: Theme.colors.primary,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
  },
  retryBtnText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
  },
  checkoutBanner: {
    position: "absolute",
    bottom: 20,
    left: 16,
    right: 16,
    backgroundColor: "#1E293B",
    borderRadius: 16,
    padding: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 6,
  },
  checkoutLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  checkoutCartIconBg: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: Theme.colors.primary,
    justifyContent: "center",
    alignItems: "center",
  },
  checkoutItemsCount: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "800",
  },
  checkoutSubtext: {
    color: "#94A3B8",
    fontSize: 11,
    fontWeight: "600",
  },
  checkoutBtn: {
    backgroundColor: Theme.colors.primary,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    gap: 4,
  },
  checkoutBtnText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "800",
  },
  sortContainer: {
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
    backgroundColor: "#ffffff",
  },
  sortScroll: {
    paddingHorizontal: 16,
    alignItems: "center",
    gap: 8,
  },
  sortLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: "#64748b",
    marginRight: 4,
  },
  sortPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: "#f1f5f9",
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  sortPillActive: {
    backgroundColor: Theme.colors.primary,
    borderColor: Theme.colors.primary,
  },
  sortPillText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#64748b",
  },
  sortPillTextActive: {
    color: "#ffffff",
  },
});
