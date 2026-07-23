import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  StatusBar,
  Dimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Image } from "expo-image";
import { Theme } from "../../constants/theme";
import {
  subscribeAdminProducts,
  subscribeCategories,
  AdminProduct,
  AdminCategory,
} from "../../services/adminService";
import {
  subscribeBanners,
  subscribeOffers,
  Banner,
  Offer,
  cleanProductName,
  getActualInrPrice,
} from "../../services/productService";

const { width } = Dimensions.get("window");

const searchPlaceholders = [
  "Search 'fresh milk'",
  "Search 'organic bananas'",
  "Search 'sour curd'",
  "Search 'multigrain bread'",
  "Search 'chocolate cookies'",
  "Search 'bell peppers'",
];

type ScreenType = "home" | "category" | "product" | "cart" | "explore";

export default function AdminPreview() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  // Navigation state inside preview
  const [currentScreen, setCurrentScreen] = useState<ScreenType>("home");
  const [history, setHistory] = useState<ScreenType[]>([]);
  const [selectedCatId, setSelectedCatId] = useState("All");
  const [selectedProductId, setSelectedProductId] = useState<number | null>(null);
  
  // App data states (real-time from Firestore)
  const [products, setProducts] = useState<AdminProduct[]>([]);
  const [categories, setCategories] = useState<AdminCategory[]>([]);
  const [banners, setBanners] = useState<Banner[]>([]);
  const [offers, setOffers] = useState<Offer[]>([]);

  // Search & Cart states (local simulation for preview)
  const [searchQuery, setSearchQuery] = useState("");
  const [simulatedCart, setSimulatedCart] = useState<{ [key: number]: number }>({});
  const [placeholderIndex, setPlaceholderIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<"Newest" | "Price Low-High" | "Price High-Low" | "Best Selling">("Newest");

  // Rotating placeholder interval
  useEffect(() => {
    const interval = setInterval(() => {
      setPlaceholderIndex((prev) => (prev + 1) % searchPlaceholders.length);
    }, 2500);
    return () => clearInterval(interval);
  }, []);

  // Hydrate all collections in real-time
  useEffect(() => {
    setLoading(true);
    const unsubProducts = subscribeAdminProducts((data) => {
      // Filter out duplicates for the UI
      const uniqueMap = new Map<string, AdminProduct>();
      const sorted = [...data].sort((a, b) => {
        const idA = typeof a.id === "number" ? a.id : Number(a.id) || 999999;
        const idB = typeof b.id === "number" ? b.id : Number(b.id) || 999999;
        return idA - idB;
      });
      sorted.forEach((p) => {
        const key = `${p.name.trim().toLowerCase()}_${(p.categoryId || p.category || "").trim().toLowerCase()}`;
        if (!uniqueMap.has(key)) {
          uniqueMap.set(key, p);
        }
      });
      setProducts(Array.from(uniqueMap.values()));
      setLoading(false);
    });

    const unsubCategories = subscribeCategories((data) => {
      setCategories(data.filter((c) => c.isActive !== false));
    });

    const unsubBanners = subscribeBanners((data) => {
      setBanners(data);
    });

    const unsubOffers = subscribeOffers((data) => {
      setOffers(data);
    });

    return () => {
      unsubProducts();
      unsubCategories();
      unsubBanners();
      unsubOffers();
    };
  }, []);

  // Custom Navigation stack push/pop helpers
  const navigateTo = (screen: ScreenType) => {
    setHistory((prev) => [...prev, currentScreen]);
    setCurrentScreen(screen);
  };

  const goBack = () => {
    if (history.length > 0) {
      const prev = history[history.length - 1];
      setHistory((prevStack) => prevStack.slice(0, -1));
      setCurrentScreen(prev);
    } else {
      setCurrentScreen("home");
    }
  };

  // Cart quantity adjusters
  const updateQty = (prodId: number, change: number) => {
    setSimulatedCart((prev) => {
      const current = prev[prodId] || 0;
      const next = Math.max(0, current + change);
      const nextCart = { ...prev };
      if (next === 0) {
        delete nextCart[prodId];
      } else {
        nextCart[prodId] = next;
      }
      return nextCart;
    });
  };

  // Derived quantities
  const totalCartItems = Object.values(simulatedCart).reduce((a, b) => a + b, 0);
  const totalCartPrice = Object.entries(simulatedCart).reduce((acc, [idStr, qty]) => {
    const prod = products.find((p) => p.id === parseInt(idStr));
    return acc + (prod ? getActualInrPrice(prod.price) * qty : 0);
  }, 0);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Theme.colors.primary} />
        <Text style={styles.loadingText}>Connecting to Live Firestore Mirror...</Text>
      </View>
    );
  }

  // ─── RENDER SUB-SCREENS ──────────────────────────────────────────────────

  // 1. Customer Home Tab
  const renderHomeScreen = () => {
    const displayCategories = [
      { id: "All", name: "All", icon: "grid-outline", color: Theme.colors.primaryDark, bg: "#f1f5f9", backgroundColor: "#f1f5f9" } as any,
      ...categories
        .filter((cat) => cat.isActive !== false && products.some((p) => p.category === cat.id || p.categoryId === cat.id))
        .sort((a, b) => (a.displayOrder || 99) - (b.displayOrder || 99))
    ];

    const popularProducts = products.filter(
      (p) => selectedCatId === "All" || p.category === selectedCatId || p.categoryId === selectedCatId
    );

    return (
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* Header location display */}
        <View style={styles.homeHeader}>
          <View style={{ flex: 1 }}>
            <View style={styles.brandRow}>
              <Text style={styles.brandQuick}>quick</Text>
              <Text style={styles.brandCart}>Cart</Text>
              <View style={styles.deliveryBadge}>
                <Ionicons name="flash" size={10} color="#16a34a" />
                <Text style={styles.deliveryBadgeText}>10 MINS</Text>
              </View>
            </View>
            <View style={styles.locationRow}>
              <Ionicons name="location" size={12} color={Theme.colors.primary} />
              <Text style={styles.locationText} numberOfLines={1}>
                Admin Preview Mode • Live Firestore Data
              </Text>
            </View>
          </View>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>AD</Text>
          </View>
        </View>

        {/* Fake Search bar */}
        <TouchableOpacity style={styles.searchContainer} onPress={() => navigateTo("explore")} activeOpacity={0.9}>
          <View style={styles.searchBar}>
            <Ionicons name="search" size={18} color="#94a3b8" />
            <Text style={styles.fakeSearchInput}>{searchPlaceholders[placeholderIndex]}</Text>
          </View>
        </TouchableOpacity>

        {/* Special Offers Section */}
        {offers.length > 0 && (
          <View style={{ marginTop: 14, paddingHorizontal: 16 }}>
            <Text style={[styles.sectionTitle, { marginHorizontal: 0, marginTop: 0, marginBottom: 8 }]}>Special Offers for You</Text>
            {offers.map((o) => (
              <View key={o.id} style={[styles.offerCard, { backgroundColor: o.backgroundColor || "#fef3c7", marginHorizontal: 0, marginTop: 0, marginBottom: 10 }]}>
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

        {/* Banners carousel */}
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
                  {b.couponCode && (
                    <View style={styles.couponBadge}>
                      <Text style={styles.couponText}>Code: {b.couponCode}</Text>
                    </View>
                  )}
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

        {/* Categories Section */}
        <Text style={styles.sectionTitle}>Shop by Category</Text>
        <View style={styles.categoryGrid}>
          {displayCategories.map((cat) => {
            const isSelected = selectedCatId === cat.id;
            return (
              <TouchableOpacity
                key={cat.id}
                onPress={() => {
                  if (cat.id === "All") {
                    setSelectedCatId("All");
                  } else {
                    setSelectedCatId(cat.id);
                    navigateTo("category");
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
                      style={{ width: "100%", height: "100%", borderRadius: 18 }}
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

        {/* Products Section */}
        <Text style={styles.sectionTitle}>Popular Products</Text>
        {popularProducts.length === 0 ? (
          <View style={styles.emptyProductsBox}>
            <Ionicons name="cube-outline" size={32} color="#94a3b8" />
            <Text style={styles.emptyProductsText}>No popular products seeded yet.</Text>
          </View>
        ) : (
          <View style={styles.productsGrid}>
            {popularProducts.slice(0, 10).map((prod) => {
              const qty = simulatedCart[prod.id] || 0;
              const hasDiscount = prod.originalPrice && prod.originalPrice > prod.price;
              const discountPercent = hasDiscount
                ? Math.round(((prod.originalPrice! - prod.price) / prod.originalPrice!) * 100)
                : 0;

              return (
                <View key={prod.id} style={styles.productCard}>
                  <TouchableOpacity
                    onPress={() => {
                      setSelectedProductId(prod.id);
                      navigateTo("product");
                    }}
                    activeOpacity={0.8}
                  >
                    <View style={styles.productImageContainer}>
                      {prod.imageUrl ? (
                        <Image source={{ uri: prod.imageUrl }} style={styles.productImage} contentFit="cover" />
                      ) : (
                        <Ionicons name="image-outline" size={24} color="#94a3b8" />
                      )}
                      {hasDiscount && (
                        <View style={styles.discountBadge}>
                          <Text style={styles.discountBadgeText}>{discountPercent}% OFF</Text>
                        </View>
                      )}
                      <View style={styles.etaBadge}>
                        <Ionicons name="flash" size={10} color="#16a34a" />
                        <Text style={styles.etaText}>10 Mins</Text>
                      </View>
                    </View>
                  </TouchableOpacity>

                  <View style={styles.productDetails}>
                    <TouchableOpacity
                      onPress={() => {
                        setSelectedProductId(prod.id);
                        navigateTo("product");
                      }}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.productCardCategory}>
                        {categories.find((c) => c.id === prod.categoryId || c.id === prod.category)?.name || "General"}
                      </Text>
                      <Text style={styles.productName} numberOfLines={1}>
                        {cleanProductName(prod.name)}
                      </Text>
                      <Text style={styles.productWeight}>{prod.weight || "1 unit"}</Text>
                    </TouchableOpacity>

                    <View style={styles.priceRow}>
                      <View>
                        <Text style={styles.productPrice}>Rs. {prod.price}</Text>
                        {hasDiscount && (
                          <Text style={styles.productOriginalPrice}>Rs. {prod.originalPrice}</Text>
                        )}
                      </View>

                      {qty === 0 ? (
                        <TouchableOpacity style={styles.addButton} onPress={() => updateQty(prod.id, 1)}>
                          <Text style={styles.addButtonText}>ADD</Text>
                          <Ionicons name="add" size={12} color={Theme.colors.primary} />
                        </TouchableOpacity>
                      ) : (
                        <View style={styles.qtyContainer}>
                          <TouchableOpacity style={styles.qtyBtn} onPress={() => updateQty(prod.id, -1)}>
                            <Ionicons name="remove" size={12} color="#ffffff" />
                          </TouchableOpacity>
                          <Text style={styles.qtyText}>{qty}</Text>
                          <TouchableOpacity style={styles.qtyBtn} onPress={() => updateQty(prod.id, 1)}>
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
        )}
      </ScrollView>
    );
  };

  // 2. Customer Search / Explore screen
  const renderExploreScreen = () => {
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

    return (
      <View style={{ flex: 1 }}>
        <View style={styles.searchHeader}>
          <TouchableOpacity onPress={goBack} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={Theme.colors.primaryDark} />
          </TouchableOpacity>
          <View style={styles.searchInputWrapper}>
            <Ionicons name="search" size={18} color="#94a3b8" />
            <TextInput
              placeholder="Search grocery item name..."
              placeholderTextColor="#94a3b8"
              value={searchQuery}
              onChangeText={setSearchQuery}
              style={styles.searchInputField}
              autoFocus
            />
            {searchQuery ? (
              <TouchableOpacity onPress={() => setSearchQuery("")}>
                <Ionicons name="close-circle" size={18} color="#94a3b8" />
              </TouchableOpacity>
            ) : null}
          </View>
        </View>

        {/* Sorting options bar */}
        {filteredProducts.length > 0 && (
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

        <ScrollView contentContainerStyle={styles.scrollContent}>
          {searchQuery ? (
            filteredProducts.length === 0 ? (
              <View style={styles.emptyProductsBox}>
                <Ionicons name="search" size={48} color="#cbd5e1" />
                <Text style={styles.emptyProductsText}>{"No results match \"" + searchQuery + "\""}</Text>
              </View>
            ) : (
              <View style={styles.productsGrid}>
                {sortedProducts.map((prod) => {
                  const qty = simulatedCart[prod.id] || 0;
                  const hasDiscount = prod.originalPrice && prod.originalPrice > prod.price;
                  const discountPercent = hasDiscount
                    ? Math.round(((prod.originalPrice! - prod.price) / prod.originalPrice!) * 100)
                    : 0;

                  return (
                    <View key={prod.id} style={styles.productCard}>
                      <TouchableOpacity
                        onPress={() => {
                          setSelectedProductId(prod.id);
                          navigateTo("product");
                        }}
                        activeOpacity={0.8}
                      >
                        <View style={styles.productImageContainer}>
                          <Image source={{ uri: prod.imageUrl }} style={styles.productImage} contentFit="cover" />
                          {hasDiscount && (
                            <View style={styles.discountBadge}>
                              <Text style={styles.discountBadgeText}>{discountPercent}% OFF</Text>
                            </View>
                          )}
                          <View style={styles.etaBadge}>
                            <Ionicons name="flash" size={10} color="#16a34a" />
                            <Text style={styles.etaText}>10 Mins</Text>
                          </View>
                        </View>
                      </TouchableOpacity>

                      <View style={styles.productDetails}>
                        <TouchableOpacity
                          onPress={() => {
                            setSelectedProductId(prod.id);
                            navigateTo("product");
                          }}
                          activeOpacity={0.8}
                        >
                          <Text style={styles.productCardCategory}>
                            {categories.find((c) => c.id === prod.categoryId || c.id === prod.category)?.name || "General"}
                          </Text>
                          <Text style={styles.productName} numberOfLines={1}>
                            {cleanProductName(prod.name)}
                          </Text>
                          <Text style={styles.productWeight}>{prod.weight || "1 unit"}</Text>
                        </TouchableOpacity>

                        <View style={styles.priceRow}>
                          <View>
                            <Text style={styles.productPrice}>Rs. {prod.price}</Text>
                            {hasDiscount && (
                              <Text style={styles.productOriginalPrice}>Rs. {prod.originalPrice}</Text>
                            )}
                          </View>

                          {qty === 0 ? (
                            <TouchableOpacity style={styles.addButton} onPress={() => updateQty(prod.id, 1)}>
                              <Text style={styles.addButtonText}>ADD</Text>
                              <Ionicons name="add" size={12} color={Theme.colors.primary} />
                            </TouchableOpacity>
                          ) : (
                            <View style={styles.qtyContainer}>
                              <TouchableOpacity style={styles.qtyBtn} onPress={() => updateQty(prod.id, -1)}>
                                <Ionicons name="remove" size={12} color="#ffffff" />
                              </TouchableOpacity>
                              <Text style={styles.qtyText}>{qty}</Text>
                              <TouchableOpacity style={styles.qtyBtn} onPress={() => updateQty(prod.id, 1)}>
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
            )
          ) : (
            <View style={{ padding: 16 }}>
              <Text style={{ fontSize: 14, fontWeight: "800", color: "#475569", marginBottom: 12 }}>🔥 Popular Search Suggestions</Text>
              {["Fresh Tomatoes", "Amul Milk", "Curd Pack", "Aata", "Buns"].map((term) => (
                <TouchableOpacity
                  key={term}
                  style={styles.suggestionRow}
                  onPress={() => setSearchQuery(term)}
                >
                  <Ionicons name="trending-up" size={16} color="#64748b" />
                  <Text style={styles.suggestionText}>{term}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </ScrollView>
      </View>
    );
  };

  // 3. Category Products Page
  const renderCategoryScreen = () => {
    const currentCat = categories.find((c) => c.id === selectedCatId) || { name: "Category Items" };
    const categoryProducts = products.filter(
      (p) => p.categoryId === selectedCatId || p.category === selectedCatId
    );

    const sortedProducts = [...categoryProducts].sort((a, b) => {
      if (sortBy === "Newest") return b.id - a.id;
      if (sortBy === "Price Low-High") return a.price - b.price;
      if (sortBy === "Price High-Low") return b.price - a.price;
      if (sortBy === "Best Selling") return (b.rating || 0) - (a.rating || 0);
      return 0;
    });

    return (
      <View style={{ flex: 1 }}>
        <View style={styles.homeHeader}>
          <TouchableOpacity onPress={goBack} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={Theme.colors.primaryDark} />
          </TouchableOpacity>
          <Text style={styles.categoryTitleText}>{currentCat.name}</Text>
          <View style={{ width: 28 }} />
        </View>

        {/* Sorting options bar */}
        {categoryProducts.length > 0 && (
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

        <ScrollView contentContainerStyle={styles.scrollContent}>
          {categoryProducts.length === 0 ? (
            <View style={styles.emptyProductsBox}>
              <Ionicons name="cube-outline" size={48} color="#cbd5e1" />
              <Text style={styles.emptyProductsText}>No items available in this category.</Text>
            </View>
          ) : (
            <View style={styles.productsGrid}>
              {sortedProducts.map((prod) => {
                const qty = simulatedCart[prod.id] || 0;
                const hasDiscount = prod.originalPrice && prod.originalPrice > prod.price;
                const discountPercent = hasDiscount
                  ? Math.round(((prod.originalPrice! - prod.price) / prod.originalPrice!) * 100)
                  : 0;

                return (
                  <View key={prod.id} style={styles.productCard}>
                    <TouchableOpacity
                      onPress={() => {
                        setSelectedProductId(prod.id);
                        navigateTo("product");
                      }}
                      activeOpacity={0.8}
                    >
                      <View style={styles.productImageContainer}>
                        <Image source={{ uri: prod.imageUrl }} style={styles.productImage} contentFit="cover" />
                        {hasDiscount && (
                          <View style={styles.discountBadge}>
                            <Text style={styles.discountBadgeText}>{discountPercent}% OFF</Text>
                          </View>
                        )}
                        <View style={styles.etaBadge}>
                          <Ionicons name="flash" size={10} color="#16a34a" />
                          <Text style={styles.etaText}>10 Mins</Text>
                        </View>
                      </View>
                    </TouchableOpacity>

                    <View style={styles.productDetails}>
                      <TouchableOpacity
                        onPress={() => {
                          setSelectedProductId(prod.id);
                          navigateTo("product");
                        }}
                        activeOpacity={0.8}
                      >
                        <Text style={styles.productCardCategory}>{currentCat.name}</Text>
                        <Text style={styles.productName} numberOfLines={1}>
                          {cleanProductName(prod.name)}
                        </Text>
                        <Text style={styles.productWeight}>{prod.weight || "1 unit"}</Text>
                      </TouchableOpacity>

                      <View style={styles.priceRow}>
                        <View>
                          <Text style={styles.productPrice}>Rs. {prod.price}</Text>
                          {hasDiscount && (
                            <Text style={styles.productOriginalPrice}>Rs. {prod.originalPrice}</Text>
                          )}
                        </View>

                        {qty === 0 ? (
                          <TouchableOpacity style={styles.addButton} onPress={() => updateQty(prod.id, 1)}>
                            <Text style={styles.addButtonText}>ADD</Text>
                            <Ionicons name="add" size={12} color={Theme.colors.primary} />
                          </TouchableOpacity>
                        ) : (
                          <View style={styles.qtyContainer}>
                            <TouchableOpacity style={styles.qtyBtn} onPress={() => updateQty(prod.id, -1)}>
                              <Ionicons name="remove" size={12} color="#ffffff" />
                            </TouchableOpacity>
                            <Text style={styles.qtyText}>{qty}</Text>
                            <TouchableOpacity style={styles.qtyBtn} onPress={() => updateQty(prod.id, 1)}>
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
          )}
        </ScrollView>
      </View>
    );
  };

  // 4. Customer Product Details Screen
  const renderProductDetailsScreen = () => {
    const prod = products.find((p) => p.id === selectedProductId);
    if (!prod) return null;

    const qty = simulatedCart[prod.id] || 0;
    const hasDiscount = prod.originalPrice && prod.originalPrice > prod.price;
    const discountPercent = hasDiscount
      ? Math.round(((prod.originalPrice! - prod.price) / prod.originalPrice!) * 100)
      : 0;

    return (
      <View style={{ flex: 1 }}>
        <View style={styles.homeHeader}>
          <TouchableOpacity onPress={goBack} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={Theme.colors.primaryDark} />
          </TouchableOpacity>
          <Text style={styles.categoryTitleText} numberOfLines={1}>{cleanProductName(prod.name)}</Text>
          <View style={{ width: 28 }} />
        </View>

        <ScrollView contentContainerStyle={[styles.scrollContent, { paddingBottom: 120 }]} showsVerticalScrollIndicator={false}>
          <View style={styles.detailsImageCard}>
            <Image source={{ uri: prod.imageUrl }} style={styles.detailsLargeImage} contentFit="contain" />
            {hasDiscount && (
              <View style={styles.detailsDiscountBadge}>
                <Text style={styles.detailsDiscountText}>{discountPercent}% OFF</Text>
              </View>
            )}
          </View>

          <View style={styles.detailsMainInfo}>
            <Text style={styles.detailsCategory}>
              {categories.find((c) => c.id === prod.categoryId || c.id === prod.category)?.name || "General"}
            </Text>
            <Text style={styles.detailsTitle}>{cleanProductName(prod.name)}</Text>
            <Text style={styles.detailsWeight}>{prod.weight || "1 unit"}</Text>

            <View style={styles.detailsDeliveryEtaRow}>
              <Ionicons name="time" size={16} color="#16a34a" />
              <Text style={styles.detailsDeliveryText}>Delivering in 10 mins • Standard Local Dispatch</Text>
            </View>

            <View style={styles.divider} />

            <View style={styles.detailsPricingRow}>
              <View>
                <Text style={styles.detailsPrice}>Rs. {prod.price}</Text>
                {hasDiscount && (
                  <Text style={styles.detailsOriginalPrice}>Rs. {prod.originalPrice}</Text>
                )}
              </View>

              {qty === 0 ? (
                <TouchableOpacity style={styles.detailsAddBtn} onPress={() => updateQty(prod.id, 1)}>
                  <Text style={styles.detailsAddText}>ADD TO CART</Text>
                </TouchableOpacity>
              ) : (
                <View style={styles.detailsQtyContainer}>
                  <TouchableOpacity style={styles.detailsQtyBtn} onPress={() => updateQty(prod.id, -1)}>
                    <Ionicons name="remove" size={16} color="#ffffff" />
                  </TouchableOpacity>
                  <Text style={styles.detailsQtyText}>{qty}</Text>
                  <TouchableOpacity style={styles.detailsQtyBtn} onPress={() => updateQty(prod.id, 1)}>
                    <Ionicons name="add" size={16} color="#ffffff" />
                  </TouchableOpacity>
                </View>
              )}
            </View>

            <View style={styles.divider} />

            <Text style={styles.detailsSecTitle}>Product Description</Text>
            <Text style={styles.detailsDesc}>
              {prod.description || `${cleanProductName(prod.name)} sourced directly under hygienic guidelines. Highly fresh stock and ready to cook or consume immediately.`}
            </Text>

            <View style={styles.divider} />

            <Text style={styles.detailsSecTitle}>Customer Reviews</Text>
            {[
              { name: "Rohan S.", comment: "Very good quality product, extremely fresh and cleanly packed.", rating: 5, date: "12/07/2026" },
              { name: "Sneha V.", comment: "Super fast 10 mins delivery! Satisfied with the order.", rating: 4, date: "09/07/2026" }
            ].map((rev, index) => (
              <View key={index} style={styles.reviewBox}>
                <View style={styles.reviewHeader}>
                  <Text style={styles.reviewerName}>{rev.name}</Text>
                  <View style={{ flexDirection: "row", gap: 2 }}>
                    {Array.from({ length: rev.rating }).map((_, i) => (
                      <Ionicons key={i} name="star" size={10} color="#f59e0b" />
                    ))}
                  </View>
                </View>
                <Text style={styles.reviewText}>{rev.comment}</Text>
                <Text style={styles.reviewDate}>{rev.date}</Text>
              </View>
            ))}
          </View>
        </ScrollView>
      </View>
    );
  };

  // 5. Customer Cart View Page
  const renderCartScreen = () => {
    const items = Object.entries(simulatedCart).map(([idStr, qty]) => {
      const prod = products.find((p) => p.id === parseInt(idStr))!;
      return { prod, qty };
    });

    const deliveryFee = totalCartPrice > 500 ? 0 : 40;
    const grandTotal = totalCartPrice + deliveryFee;

    return (
      <View style={{ flex: 1 }}>
        <View style={styles.homeHeader}>
          <TouchableOpacity onPress={goBack} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={Theme.colors.primaryDark} />
          </TouchableOpacity>
          <Text style={styles.categoryTitleText}>My Simulated Cart</Text>
          <View style={{ width: 28 }} />
        </View>

        <ScrollView contentContainerStyle={[styles.scrollContent, { paddingBottom: 140 }]} showsVerticalScrollIndicator={false}>
          {items.length === 0 ? (
            <View style={styles.emptyProductsBox}>
              <Ionicons name="cart-outline" size={64} color="#cbd5e1" style={{ marginBottom: 12 }} />
              <Text style={styles.emptyProductsText}>Your cart is empty.</Text>
              <TouchableOpacity style={styles.exploreBtn} onPress={() => setCurrentScreen("home")}>
                <Text style={styles.exploreBtnText}>Browse Shop Products</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={{ padding: 16 }}>
              <Text style={{ fontSize: 13, fontWeight: "800", color: "#64748b", textTransform: "uppercase", marginBottom: 12 }}>Items added</Text>
              {items.map(({ prod, qty }) => (
                <View key={prod.id} style={styles.cartItemRow}>
                  <Image source={{ uri: prod.imageUrl }} style={styles.cartItemImage} contentFit="cover" />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cartItemName} numberOfLines={1}>{cleanProductName(prod.name)}</Text>
                    <Text style={styles.cartItemWeight}>{prod.weight}</Text>
                    <Text style={styles.cartItemPrice}>Rs. {prod.price}</Text>
                  </View>

                  <View style={styles.cartItemQtyContainer}>
                    <TouchableOpacity style={styles.cartItemQtyBtn} onPress={() => updateQty(prod.id, -1)}>
                      <Ionicons name="remove" size={12} color="#ffffff" />
                    </TouchableOpacity>
                    <Text style={styles.cartItemQtyText}>{qty}</Text>
                    <TouchableOpacity style={styles.cartItemQtyBtn} onPress={() => updateQty(prod.id, 1)}>
                      <Ionicons name="add" size={12} color="#ffffff" />
                    </TouchableOpacity>
                  </View>
                </View>
              ))}

              <View style={styles.divider} />

              <Text style={{ fontSize: 13, fontWeight: "800", color: "#64748b", textTransform: "uppercase", marginBottom: 12 }}>Payment Method</Text>
              <View style={styles.paymentMethodCard}>
                <Ionicons name="cash-outline" size={20} color="#16a34a" />
                <Text style={{ fontSize: 13, fontWeight: "700", color: "#334155", flex: 1, marginLeft: 8 }}>Cash on Delivery (Simulated)</Text>
                <Ionicons name="checkmark-circle" size={18} color="#16a34a" />
              </View>

              <View style={styles.divider} />

              <Text style={{ fontSize: 13, fontWeight: "800", color: "#64748b", textTransform: "uppercase", marginBottom: 12 }}>Bill Details</Text>
              <View style={styles.billBox}>
                <View style={styles.billRow}>
                  <Text style={styles.billLabel}>Item Subtotal</Text>
                  <Text style={styles.billValue}>Rs. {totalCartPrice}</Text>
                </View>
                <View style={styles.billRow}>
                  <Text style={styles.billLabel}>Delivery Charges</Text>
                  <Text style={styles.billValue}>{deliveryFee === 0 ? "FREE" : `Rs. ${deliveryFee}`}</Text>
                </View>
                <View style={styles.billDivider} />
                <View style={styles.billRow}>
                  <Text style={styles.grandTotalLabel}>Grand Total</Text>
                  <Text style={styles.grandTotalValue}>Rs. {grandTotal}</Text>
                </View>
              </View>

              <View style={styles.checkoutDisclaimer}>
                <Ionicons name="information-circle" size={16} color="#0284c7" />
                <Text style={styles.disclaimerText}>
                  This is a read-only simulated preview. Order placements are disabled in preview mode.
                </Text>
              </View>
            </View>
          )}
        </ScrollView>

        {items.length > 0 && (
          <View style={styles.cartFooter}>
            <TouchableOpacity style={styles.placeOrderBtnDisabled} disabled>
              <Text style={styles.placeOrderBtnText}>Place Order (Read-Only)</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0f172a" />

      {/* Persistent Read-Only Admin Preview Banner */}
      <View style={[styles.previewModeBanner, { paddingTop: insets.top + 6 }]}>
        <Ionicons name="eye" size={15} color="#fbbf24" />
        <Text style={styles.previewModeText}>Admin App Preview (Read-Only Mirror)</Text>
        <TouchableOpacity style={styles.closePreviewBtn} onPress={() => router.replace("/admin/dashboard")}>
          <Text style={styles.closePreviewText}>Exit Preview</Text>
        </TouchableOpacity>
      </View>

      {/* Host sub-screen rendering */}
      <View style={{ flex: 1 }}>
        {currentScreen === "home" && renderHomeScreen()}
        {currentScreen === "explore" && renderExploreScreen()}
        {currentScreen === "category" && renderCategoryScreen()}
        {currentScreen === "product" && renderProductDetailsScreen()}
        {currentScreen === "cart" && renderCartScreen()}
      </View>

      {/* Floating Bottom Cart Bar (renders in home, category, explore if items added) */}
      {currentScreen !== "cart" && totalCartItems > 0 && (
        <TouchableOpacity 
          style={[styles.floatingCartBanner, { bottom: 16 + Math.max(insets.bottom, 0) }]}
          onPress={() => navigateTo("cart")}
          activeOpacity={0.9}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <Ionicons name="cart" size={20} color="#ffffff" />
            <View>
              <Text style={styles.floatCartItems}>{totalCartItems} Items</Text>
              <Text style={styles.floatCartPrice}>Rs. {totalCartPrice}</Text>
            </View>
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
            <Text style={styles.floatViewCartText}>View Cart</Text>
            <Ionicons name="arrow-forward" size={14} color="#ffffff" />
          </View>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#ffffff",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 12,
  },
  loadingText: {
    fontSize: 13,
    color: "#64748b",
    fontWeight: "600",
  },
  
  // Persistent Banner
  previewModeBanner: {
    backgroundColor: "#1e293b",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 10,
    gap: 8,
    borderBottomWidth: 1,
    borderColor: "#334155",
  },
  previewModeText: {
    color: "#fbbf24",
    fontSize: 12,
    fontWeight: "800",
    flex: 1,
  },
  closePreviewBtn: {
    backgroundColor: "#ef4444",
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 8,
  },
  closePreviewText: {
    color: "#ffffff",
    fontSize: 11,
    fontWeight: "800",
  },

  // Home Screen Layout
  homeHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: "#ffffff",
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  brandRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
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
    marginLeft: 6,
  },
  deliveryBadgeText: {
    fontSize: 9,
    fontWeight: "900",
    color: "#16a34a",
  },
  locationRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 4,
  },
  locationText: {
    fontSize: 11,
    color: "#64748b",
    fontWeight: "600",
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Theme.colors.primary,
    justifyContent: "center",
    alignItems: "center",
  },
  avatarText: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "800",
  },
  searchContainer: {
    paddingHorizontal: 16,
    marginTop: 12,
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f8fafc",
    borderRadius: 14,
    paddingHorizontal: 14,
    height: 48,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  fakeSearchInput: {
    fontSize: 13,
    color: "#94a3b8",
    marginLeft: 8,
    fontWeight: "500",
  },
  scrollContent: {
    paddingBottom: 150,
  },

  // Banners
  bannerSlider: {
    marginTop: 14,
  },
  bannerSliderContent: {
    paddingHorizontal: 16,
    gap: 12,
  },
  promoCard: {
    width: width - 44,
    maxWidth: 390,
    height: 120,
    borderRadius: 20,
    flexDirection: "row",
    overflow: "hidden",
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
    letterSpacing: 0.8,
    opacity: 0.85,
  },
  promoTitle: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "900",
    marginTop: 4,
    lineHeight: 18,
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
  },
  promoImage: {
    width: "90%",
    height: "90%",
  },

  // Categories Grid
  sectionTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: "#1e293b",
    marginHorizontal: 16,
    marginTop: 20,
    marginBottom: 10,
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
  categoryIcon: {
    width: "100%",
    height: "100%",
    borderRadius: 18,
  },
  categoryLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "#334155",
    textAlign: "center",
    lineHeight: 14,
  },

  // Products Grid
  productsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: 16,
    justifyContent: "space-between",
    rowGap: 16,
  },
  productCard: {
    width: "48%",
    backgroundColor: "#ffffff",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#f1f5f9",
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 2,
  },
  productImageContainer: {
    height: 115,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f8fafc",
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
    shadowColor: "#000",
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
  productCardCategory: {
    fontSize: 9,
    fontWeight: "700",
    color: "#94a3b8",
    textTransform: "uppercase",
    marginBottom: 2,
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
    fontSize: 11,
    fontWeight: "900",
    color: Theme.colors.primary,
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
    paddingVertical: 6,
  },
  qtyText: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "900",
    paddingHorizontal: 4,
  },

  // Offers
  offerCard: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#fde68a",
    gap: 12,
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
  emptyProductsBox: {
    justifyContent: "center",
    alignItems: "center",
    padding: 30,
    backgroundColor: "#f8fafc",
    borderRadius: 16,
    marginHorizontal: 16,
    gap: 6,
  },
  emptyProductsText: {
    fontSize: 12,
    color: "#64748b",
    fontWeight: "600",
  },

  // Search Explore Screen
  searchHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderColor: "#f1f5f9",
    gap: 10,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#f1f5f9",
    justifyContent: "center",
    alignItems: "center",
  },
  searchInputWrapper: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f1f5f9",
    borderRadius: 14,
    paddingHorizontal: 12,
    height: 44,
  },
  searchInputField: {
    flex: 1,
    marginLeft: 8,
    fontSize: 14,
    color: "#1e293b",
    fontWeight: "500",
  },
  suggestionRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderColor: "#f8fafc",
    gap: 10,
  },
  suggestionText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#334155",
  },
  categoryTitleText: {
    fontSize: 16,
    fontWeight: "800",
    color: Theme.colors.primaryDark,
    flex: 1,
    textAlign: "center",
  },

  // Sort
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

  // Product Details Screen Styles
  detailsImageCard: {
    height: 250,
    backgroundColor: "#f8fafc",
    justifyContent: "center",
    alignItems: "center",
    borderBottomWidth: 1,
    borderColor: "#f1f5f9",
    position: "relative",
  },
  detailsLargeImage: {
    width: "80%",
    height: "80%",
  },
  detailsDiscountBadge: {
    position: "absolute",
    top: 16,
    left: 16,
    backgroundColor: Theme.colors.primary,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  detailsDiscountText: {
    color: "#ffffff",
    fontSize: 9,
    fontWeight: "900",
  },
  detailsMainInfo: {
    padding: 16,
  },
  detailsCategory: {
    fontSize: 10,
    fontWeight: "800",
    color: "#94a3b8",
    textTransform: "uppercase",
  },
  detailsTitle: {
    fontSize: 20,
    fontWeight: "900",
    color: "#1e293b",
    marginTop: 4,
  },
  detailsWeight: {
    fontSize: 13,
    color: "#64748b",
    fontWeight: "600",
    marginTop: 2,
  },
  detailsDeliveryEtaRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 12,
    gap: 6,
  },
  detailsDeliveryText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#16a34a",
  },
  divider: {
    height: 1,
    backgroundColor: "#f1f5f9",
    marginVertical: 16,
  },
  detailsPricingRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  detailsPrice: {
    fontSize: 20,
    fontWeight: "950",
    color: "#0f172a",
  },
  detailsOriginalPrice: {
    fontSize: 13,
    color: "#94a3b8",
    textDecorationLine: "line-through",
    fontWeight: "600",
    marginTop: 2,
  },
  detailsAddBtn: {
    backgroundColor: Theme.colors.primary,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  detailsAddText: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "900",
  },
  detailsQtyContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Theme.colors.primary,
    borderRadius: 10,
    overflow: "hidden",
  },
  detailsQtyBtn: {
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  detailsQtyText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "900",
    paddingHorizontal: 6,
  },
  detailsSecTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: "#475569",
    textTransform: "uppercase",
    marginBottom: 8,
  },
  detailsDesc: {
    fontSize: 13,
    color: "#475569",
    lineHeight: 18,
    fontWeight: "500",
  },
  reviewBox: {
    backgroundColor: "#f8fafc",
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  reviewHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  reviewerName: {
    fontSize: 12,
    fontWeight: "700",
    color: "#334155",
  },
  reviewText: {
    fontSize: 12,
    color: "#475569",
    marginTop: 4,
    lineHeight: 16,
  },
  reviewDate: {
    fontSize: 9,
    color: "#94a3b8",
    textAlign: "right",
    marginTop: 4,
  },

  // Cart Screen
  cartItemRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#f1f5f9",
    gap: 12,
  },
  cartItemImage: {
    width: 50,
    height: 50,
    borderRadius: 10,
  },
  cartItemName: {
    fontSize: 13,
    fontWeight: "800",
    color: "#334155",
  },
  cartItemWeight: {
    fontSize: 11,
    color: "#64748b",
    marginTop: 1,
  },
  cartItemPrice: {
    fontSize: 12,
    fontWeight: "800",
    color: "#0f172a",
    marginTop: 2,
  },
  cartItemQtyContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Theme.colors.primary,
    borderRadius: 8,
    overflow: "hidden",
  },
  cartItemQtyBtn: {
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  cartItemQtyText: {
    color: "#ffffff",
    fontSize: 11,
    fontWeight: "900",
    paddingHorizontal: 4,
  },
  exploreBtn: {
    marginTop: 12,
    backgroundColor: Theme.colors.primary,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  exploreBtnText: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "800",
  },
  paymentMethodCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f0fdf4",
    borderWidth: 1.5,
    borderColor: "#bbf7d0",
    borderRadius: 14,
    padding: 14,
  },
  billBox: {
    backgroundColor: "#f8fafc",
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  billRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 4,
  },
  billLabel: {
    fontSize: 12,
    color: "#64748b",
    fontWeight: "600",
  },
  billValue: {
    fontSize: 12,
    color: "#334155",
    fontWeight: "700",
  },
  billDivider: {
    height: 1,
    backgroundColor: "#e2e8f0",
    marginVertical: 8,
  },
  grandTotalLabel: {
    fontSize: 13,
    fontWeight: "800",
    color: "#1e293b",
  },
  grandTotalValue: {
    fontSize: 14,
    fontWeight: "900",
    color: "#0f172a",
  },
  checkoutDisclaimer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f0f9ff",
    borderWidth: 1,
    borderColor: "#bae6fd",
    borderRadius: 12,
    padding: 12,
    marginTop: 16,
    gap: 8,
  },
  disclaimerText: {
    fontSize: 11,
    color: "#0284c7",
    fontWeight: "600",
    flex: 1,
    lineHeight: 14,
  },
  cartFooter: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#ffffff",
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 24,
    borderTopWidth: 1,
    borderColor: "#f1f5f9",
  },
  placeOrderBtnDisabled: {
    backgroundColor: "#cbd5e1",
    height: 52,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
  },
  placeOrderBtnText: {
    color: "#94a3b8",
    fontSize: 14,
    fontWeight: "800",
  },

  // Floating Cart Banner
  floatingCartBanner: {
    position: "absolute",
    left: 16,
    right: 16,
    backgroundColor: "#1e293b",
    borderRadius: 16,
    paddingVertical: 10,
    paddingHorizontal: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 6,
    zIndex: 200,
  },
  floatCartItems: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "800",
  },
  floatCartPrice: {
    color: "#a7f3d0",
    fontSize: 10,
    fontWeight: "700",
    marginTop: 1,
  },
  floatViewCartText: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "800",
  },
});
