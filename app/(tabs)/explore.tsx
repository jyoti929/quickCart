import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  ActivityIndicator,
  Keyboard,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Image } from "expo-image";
import { Theme } from "../../constants/theme";
import { authStore } from "../../services/authStore";
import {
  subscribeProductsByState,
  Product,
  cleanProductName,
  formatPrice,
} from "../../services/productService";
import { subscribeCategories } from "../../services/adminService";

const POPULAR_SEARCHES = [
  "milk", "bread", "eggs", "rice", "atta", "chips",
  "banana", "butter", "coffee", "noodles", "biscuits", "sugar",
];

export default function ExploreScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ focus?: string }>();
  const insets = useSafeAreaInsets();
  const inputRef = useRef<TextInput>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [isFocused, setIsFocused] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [cartQuantities, setCartQuantities] = useState<{ [key: number]: number }>(authStore.getCart());
  const [loading, setLoading] = useState(false);
  const [categories, setCategories] = useState<any[]>([]);
  const [sortBy, setSortBy] = useState<"Newest" | "Price Low-High" | "Price High-Low" | "Best Selling">("Newest");

  const shouldFocus = params.focus === "true";

  // Auto-focus when navigated from home search bar
  useEffect(() => {
    if (shouldFocus) {
      const timer = setTimeout(() => {
        inputRef.current?.focus();
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [shouldFocus]);

  // Load categories
  useEffect(() => {
    const unsubscribe = subscribeCategories((cats) => {
      setCategories(cats);
    });
    return () => unsubscribe();
  }, []);

  // Load products
  useEffect(() => {
    setLoading(true);
    const state = authStore.getDetectedState() || "Delhi";
    const unsubscribe = subscribeProductsByState(
      state,
      (allProducts) => {
        setProducts(allProducts);
        setLoading(false);
      },
      (error) => {
        console.error("Failed to subscribe products in explore screen:", error);
        setLoading(false);
      }
    );
    return () => unsubscribe();
  }, []);

  // Sync cart
  useEffect(() => {
    const unsubscribe = authStore.subscribeCart(() => {
      setCartQuantities(authStore.getCart());
    });
    return () => unsubscribe();
  }, []);

  const updateQuantity = (productId: number, change: number) => {
    authStore.updateCart(productId, change);
  };

  // ─── Search Logic ──────────────────────────────────────────────────────
  const isSearchActive = searchQuery.trim().length > 0;
  const showSuggestions = isFocused && !isSearchActive;
  const showSuggestionDropdown = isFocused && isSearchActive;

  // Products that match the query
  const filteredProducts = isSearchActive
    ? products.filter(
        (p) =>
          cleanProductName(p.name).toLowerCase().includes(searchQuery.toLowerCase()) ||
          p.category.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : [];

  const sortedProducts = [...filteredProducts].sort((a, b) => {
    if (sortBy === "Newest") return b.id - a.id;
    if (sortBy === "Price Low-High") return a.price - b.price;
    if (sortBy === "Price High-Low") return b.price - a.price;
    if (sortBy === "Best Selling") return (b.rating || 0) - (a.rating || 0);
    return 0;
  });

  // Suggestion words derived from product names + popular list
  const suggestions: string[] = useCallback(() => {
    if (!isSearchActive) return [];
    const q = searchQuery.toLowerCase();
    const fromProducts = products
      .map((p) => cleanProductName(p.name))
      .filter((name) => name.toLowerCase().includes(q) && name.toLowerCase() !== q);
    const fromPopular = POPULAR_SEARCHES.filter(
      (s) => s.includes(q) && s !== q
    ).map((s) => s.charAt(0).toUpperCase() + s.slice(1));
    // Dedupe and limit to 7
    const combined = [...new Set([...fromProducts, ...fromPopular])];
    return combined.slice(0, 7);
  }, [searchQuery, products, isSearchActive])();



  // Highlight the matching part of a suggestion string
  const renderHighlightedSuggestion = (text: string, query: string) => {
    const lowerText = text.toLowerCase();
    const lowerQuery = query.toLowerCase();
    const idx = lowerText.indexOf(lowerQuery);
    if (idx === -1) return <Text style={styles.suggestionText}>{text}</Text>;
    return (
      <Text style={styles.suggestionText}>
        {text.slice(0, idx)}
        <Text style={styles.suggestionHighlight}>{text.slice(idx, idx + query.length)}</Text>
        {text.slice(idx + query.length)}
      </Text>
    );
  };

  const handleSelectSuggestion = (word: string) => {
    setSearchQuery(word);
    Keyboard.dismiss();
    setIsFocused(false);
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />

      {/* ── Header ── */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>
          {isSearchActive ? "Search Results" : "Explore Categories"}
        </Text>
      </View>

      {/* ── Search Bar ── */}
      <View style={styles.searchWrapper}>
        <View style={[styles.searchBar, isFocused && styles.searchBarFocused]}>
          <Ionicons name="search" size={20} color={isFocused ? Theme.colors.primary : "#94a3b8"} style={styles.searchIcon} />
          <TextInput
            ref={inputRef}
            placeholder="Search milk, bread, bananas..."
            placeholderTextColor="#94a3b8"
            value={searchQuery}
            onChangeText={setSearchQuery}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setTimeout(() => setIsFocused(false), 150)}
            style={styles.searchInput}
            returnKeyType="search"
            onSubmitEditing={() => {
              Keyboard.dismiss();
              setIsFocused(false);
            }}
          />
          {isSearchActive && (
            <TouchableOpacity
              onPress={() => {
                setSearchQuery("");
                inputRef.current?.focus();
              }}
              style={styles.clearBtn}
            >
              <Ionicons name="close-circle" size={18} color="#94a3b8" />
            </TouchableOpacity>
          )}
        </View>

        {/* ── Live Suggestions Dropdown ── */}
        {showSuggestionDropdown && suggestions.length > 0 && (
          <View style={styles.suggestionsDropdown}>
            {suggestions.map((suggestion, idx) => (
              <TouchableOpacity
                key={`sug-${idx}`}
                style={[
                  styles.suggestionRow,
                  idx === suggestions.length - 1 && { borderBottomWidth: 0 },
                ]}
                onPress={() => handleSelectSuggestion(suggestion)}
                activeOpacity={0.7}
              >
                <Ionicons name="search-outline" size={14} color="#94a3b8" style={styles.sugIcon} />
                {renderHighlightedSuggestion(suggestion, searchQuery)}
                <Ionicons name="arrow-up-outline" size={14} color="#cbd5e1" style={styles.sugArrow} />
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* ── Popular Searches (shown when focused but no query yet) ── */}
        {showSuggestions && (
          <View style={styles.popularContainer}>
            <Text style={styles.popularTitle}>🔥 Popular Searches</Text>
            <View style={styles.popularChips}>
              {POPULAR_SEARCHES.map((term) => (
                <TouchableOpacity
                  key={term}
                  style={styles.popularChip}
                  onPress={() => handleSelectSuggestion(
                    term.charAt(0).toUpperCase() + term.slice(1)
                  )}
                  activeOpacity={0.75}
                >
                  <Text style={styles.popularChipText}>{term}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}
      </View>

      {/* ── Sort Options (Visible when search results are showing) ── */}
      {isSearchActive && !showSuggestionDropdown && !showSuggestions && filteredProducts.length > 0 && (
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

      {/* ── Main Content ── */}
      {loading && isSearchActive ? (
        <View style={styles.centeredContent}>
          <ActivityIndicator size="large" color={Theme.colors.primary} />
          <Text style={styles.loadingText}>Searching products...</Text>
        </View>
      ) : isSearchActive ? (
        filteredProducts.length > 0 ? (
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* Results count label */}
            <Text style={styles.resultsLabel}>
              {filteredProducts.length} result{filteredProducts.length !== 1 ? "s" : ""} for{" "}
              <Text style={styles.resultsQuery}>&ldquo;{searchQuery}&rdquo;</Text>
            </Text>

            <View style={styles.productsGrid}>
              {sortedProducts.map((prod) => {
                const qty = cartQuantities[prod.id] || 0;
                const hasDiscount = prod.originalPrice > prod.price;
                const discountPercent = Math.round(
                  ((prod.originalPrice - prod.price) / prod.originalPrice) * 100
                );

                return (
                  <View key={prod.id} style={styles.productCard}>
                    <TouchableOpacity
                      activeOpacity={0.8}
                      onPress={() =>
                        router.push({
                          pathname: "/product",
                          params: { productId: String(prod.id ?? "") },
                        })
                      }
                      style={{ width: "100%" }}
                    >
                      <View style={styles.imageWrapper}>
                        <Image
                          source={{ uri: prod.imageUrl }}
                          style={styles.productImage}
                          contentFit="contain"
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

                    <View style={styles.detailsContainer}>
                      <TouchableOpacity
                        activeOpacity={0.8}
                        onPress={() =>
                          router.push({
                            pathname: "/product",
                            params: { productId: String(prod.id ?? "") },
                          })
                        }
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
                          <View style={styles.qtyRow}>
                            <TouchableOpacity style={styles.qtyBtn} onPress={() => updateQuantity(prod.id, -1)}>
                              <Ionicons name="remove" size={12} color="#ffffff" />
                            </TouchableOpacity>
                            <Text style={styles.qtyText}>{qty}</Text>
                            <TouchableOpacity style={styles.qtyBtn} onPress={() => updateQuantity(prod.id, 1)}>
                              <Ionicons name="add" size={12} color="#ffffff" />
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
        ) : (
          <View style={styles.centeredContent}>
            <Ionicons name="search-outline" size={54} color="#CBD5E1" />
            <Text style={styles.emptyText}>No results found</Text>
            <Text style={styles.emptySubtext}>
              {"Try searching for 'milk', 'bread', 'banana', 'chips', or 'atta'."}
            </Text>
            {/* Suggest popular instead */}
            <View style={styles.popularChips} >
              {POPULAR_SEARCHES.slice(0, 6).map((term) => (
                <TouchableOpacity
                  key={term}
                  style={styles.popularChip}
                  onPress={() => handleSelectSuggestion(
                    term.charAt(0).toUpperCase() + term.slice(1)
                  )}
                >
                  <Text style={styles.popularChipText}>{term}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )
      ) : (
        /* ── Default Category Grid ── */
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.categoryGrid}>
            {categories.map((cat) => (
              <TouchableOpacity
                key={cat.id}
                onPress={() =>
                  router.push({
                    pathname: "/category",
                    params: { categoryId: cat.id },
                  })
                }
                style={styles.categoryCard}
                activeOpacity={0.8}
              >
                <View style={[styles.categoryIconBg, { backgroundColor: cat.bg }]}>
                  <Ionicons name={cat.icon as any} size={28} color={cat.color} />
                </View>
                <Text style={styles.categoryLabel}>{cat.name}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#ffffff",
  },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: Theme.colors.primaryDark,
  },

  // ─── Search Bar ───────────────────────────────────────
  searchWrapper: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 4,
    backgroundColor: "#ffffff",
    zIndex: 100,
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f1f5f9",
    borderRadius: 14,
    paddingHorizontal: 12,
    height: 48,
    borderWidth: 1.5,
    borderColor: "transparent",
  },
  searchBarFocused: {
    borderColor: Theme.colors.primary,
    backgroundColor: "#ffffff",
    shadowColor: Theme.colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: Theme.colors.primaryDark,
    fontWeight: "500",
  },
  clearBtn: {
    padding: 4,
  },

  // ─── Suggestions Dropdown ─────────────────────────────
  suggestionsDropdown: {
    backgroundColor: "#ffffff",
    borderRadius: 14,
    marginTop: 6,
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 8,
    borderWidth: 1,
    borderColor: "#f1f5f9",
    overflow: "hidden",
  },
  suggestionRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 13,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#f8fafc",
  },
  sugIcon: {
    marginRight: 10,
  },
  sugArrow: {
    marginLeft: "auto",
  },
  suggestionText: {
    flex: 1,
    fontSize: 14,
    color: "#334155",
    fontWeight: "500",
  },
  suggestionHighlight: {
    color: Theme.colors.primary,
    fontWeight: "800",
  },

  // ─── Popular Searches ─────────────────────────────────
  popularContainer: {
    backgroundColor: "#ffffff",
    borderRadius: 14,
    marginTop: 8,
    paddingVertical: 14,
    paddingHorizontal: 4,
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 4,
    borderWidth: 1,
    borderColor: "#f1f5f9",
  },
  popularTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: "#334155",
    paddingHorizontal: 12,
    marginBottom: 10,
  },
  popularChips: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: 8,
    gap: 8,
    marginTop: 6,
  },
  popularChip: {
    backgroundColor: "#f1f5f9",
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  popularChipText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#334155",
  },

  // ─── Results label ─────────────────────────────────────
  resultsLabel: {
    fontSize: 13,
    color: "#64748b",
    fontWeight: "600",
    marginBottom: 14,
  },
  resultsQuery: {
    color: Theme.colors.primary,
    fontWeight: "800",
  },

  // ─── Grid & Cards ─────────────────────────────────────
  scrollContent: {
    padding: 16,
    paddingBottom: 110,
  },
  categoryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: 12,
  },
  categoryCard: {
    width: "48%",
    backgroundColor: "#f8fafc",
    borderRadius: 16,
    padding: 16,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  categoryIconBg: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
  },
  categoryLabel: {
    fontSize: 14,
    fontWeight: "700",
    color: Theme.colors.primaryDark,
    textAlign: "center",
  },
  productsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: 12,
  },
  productCard: {
    width: "48%",
    backgroundColor: "#ffffff",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#F1F5F9",
    padding: 12,
    alignItems: "center",
    marginBottom: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 1,
  },
  imageWrapper: {
    width: "100%",
    height: 120,
    backgroundColor: "#f8fafc",
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    position: "relative",
    overflow: "hidden",
  },
  productImage: {
    width: "85%",
    height: "85%",
  },
  discountBadge: {
    position: "absolute",
    top: 6,
    left: 6,
    backgroundColor: "#ef4444",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  discountBadgeText: {
    color: "#ffffff",
    fontSize: 8,
    fontWeight: "900",
  },
  etaBadge: {
    position: "absolute",
    bottom: 6,
    right: 6,
    backgroundColor: "#ffffff",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  etaText: {
    fontSize: 8,
    fontWeight: "800",
    color: "#16A34A",
  },
  detailsContainer: {
    width: "100%",
    marginTop: 8,
  },
  productName: {
    fontSize: 13,
    fontWeight: "700",
    color: Theme.colors.primaryDark,
    height: 36,
  },
  productWeight: {
    fontSize: 11,
    color: "#64748b",
    fontWeight: "500",
    marginTop: 2,
  },
  priceRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 6,
    width: "100%",
  },
  productPrice: {
    fontSize: 14,
    fontWeight: "800",
    color: "#0f172a",
  },
  productOriginalPrice: {
    fontSize: 10,
    color: "#94a3b8",
    textDecorationLine: "line-through",
    fontWeight: "500",
  },
  addButton: {
    borderWidth: 1,
    borderColor: Theme.colors.primary,
    borderRadius: 8,
    paddingVertical: 4,
    paddingHorizontal: 12,
    backgroundColor: "#ffffff",
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  addButtonText: {
    color: Theme.colors.primary,
    fontSize: 11,
    fontWeight: "800",
  },
  qtyRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Theme.colors.primary,
    borderRadius: 8,
    paddingHorizontal: 4,
    height: 24,
  },
  qtyBtn: {
    padding: 2,
  },
  qtyText: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "800",
    marginHorizontal: 6,
  },

  // ─── States ───────────────────────────────────────────
  centeredContent: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 32,
    gap: 8,
  },
  loadingText: {
    fontSize: 14,
    color: "#64748b",
    fontWeight: "600",
  },
  emptyText: {
    fontSize: 16,
    fontWeight: "800",
    color: Theme.colors.primaryDark,
    marginTop: 12,
  },
  emptySubtext: {
    fontSize: 13,
    color: "#64748b",
    textAlign: "center",
    fontWeight: "500",
    maxWidth: 240,
    lineHeight: 18,
    marginBottom: 16,
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
