import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  Platform,
  StatusBar,
  Animated,
  LayoutAnimation,
  UIManager,
  ScrollView,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Image } from "expo-image";
import { Theme } from "../../constants/theme";
import {
  AdminProduct,
  AdminCategory,
  subscribeAdminProducts,
  subscribeCategories,
  deleteAdminProductsBatch,
} from "../../services/adminService";
import { cleanProductName, formatPrice } from "../../services/productService";



// Enable LayoutAnimation for Android
if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const getCreatedAtMs = (p: AdminProduct): number => {
  if (!p.createdAt) return 0;
  // Handle Firestore Timestamp objects (has .toMillis() or .seconds)
  if (typeof p.createdAt === "object") {
    if (typeof p.createdAt.toMillis === "function") return p.createdAt.toMillis();
    if (typeof p.createdAt.seconds === "number") return p.createdAt.seconds * 1000;
  }
  // Handle ISO string
  const ts = new Date(p.createdAt).getTime();
  return isNaN(ts) ? 0 : ts;
};

const deduplicateProducts = (prods: AdminProduct[]): AdminProduct[] => {
  const uniqueMap = new Map<string, AdminProduct>();

  // Sort products by createdAt ascending so the oldest comes first (keep oldest duplicate)
  const sorted = [...prods].sort((a, b) => getCreatedAtMs(a) - getCreatedAtMs(b));

  sorted.forEach((p) => {
    const key = `${p.name.trim().toLowerCase()}_${(p.categoryId || p.category || "").trim().toLowerCase()}`;
    if (!uniqueMap.has(key)) {
      uniqueMap.set(key, p);
    }
  });

  return Array.from(uniqueMap.values());
};

const detectDuplicates = (rawProds: AdminProduct[]): AdminProduct[] => {
  const uniqueKeys = new Set<string>();
  const duplicates: AdminProduct[] = [];

  // Sort rawProds by createdAt ascending (oldest first — keep the first occurrence)
  const sorted = [...rawProds].sort((a, b) => getCreatedAtMs(a) - getCreatedAtMs(b));

  sorted.forEach((p) => {
    const key = `${p.name.trim().toLowerCase()}_${(p.categoryId || p.category || "").trim().toLowerCase()}`;
    if (uniqueKeys.has(key)) {
      duplicates.push(p);
    } else {
      uniqueKeys.add(key);
    }
  });

  return duplicates;
};


const getStockStatus = (stock: number) => {
  if (stock <= 0) return { label: "Out of Stock", color: "#ef4444", bg: "#fef2f2" };
  if (stock < 10) return { label: `Low Stock (${stock})`, color: "#f59e0b", bg: "#fef3c7" };
  return { label: `In Stock (${stock})`, color: "#16a34a", bg: "#f0fdf4" };
};

// Shimmer Placeholder Card
function ProductCardSkeleton() {
  const animatedValue = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(animatedValue, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(animatedValue, {
          toValue: 0.3,
          duration: 800,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, [animatedValue]);

  return (
    <Animated.View style={[styles.productCard, { opacity: animatedValue }]}>
      <View style={styles.imagePlaceholder} />
      <View style={styles.productDetails}>
        <View style={styles.skeletonLineShort} />
        <View style={styles.skeletonLineLong} />
        <View style={styles.skeletonLineMedium} />
        <View style={styles.skeletonRow}>
          <View style={styles.skeletonPrice} />
          <View style={styles.skeletonButton} />
        </View>
      </View>
    </Animated.View>
  );
}

export default function AdminProducts() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  
  const [products, setProducts] = useState<AdminProduct[]>([]);
  const [filtered, setFiltered] = useState<AdminProduct[]>([]);
  const [categories, setCategories] = useState<AdminCategory[]>([]);
  const [search, setSearch] = useState("");
  const [selectedCat, setSelectedCat] = useState<string>("All");
  const [loading, setLoading] = useState(true);
  const [duplicatesCount, setDuplicatesCount] = useState(0);
  const [duplicatesList, setDuplicatesList] = useState<AdminProduct[]>([]);
  const [cleaning, setCleaning] = useState(false);
  const [cleanProgress, setCleanProgress] = useState("");
  const [errorText, setErrorText] = useState("");
  const [successText, setSuccessText] = useState("");
  const cancelCleaningRef = useRef(false);

  // Real-time synchronization
  useEffect(() => {
    setLoading(true);
    
    const unsubProducts = subscribeAdminProducts((prods) => {
      const dupes = detectDuplicates(prods);
      setDuplicatesList(dupes);
      setDuplicatesCount(dupes.length);

      const uniqueProds = deduplicateProducts(prods);
      setProducts(uniqueProds);
      setLoading(false);
    });

    const unsubCategories = subscribeCategories((cats) => {
      setCategories(cats);
    });

    return () => {
      unsubProducts();
      unsubCategories();
    };
  }, []);

  // Instant filtering on state change
  useEffect(() => {
    let result = products;
    if (search.trim()) {
      result = result.filter((p) =>
        p.name?.toLowerCase().includes(search.toLowerCase()) ||
        p.serviceCity?.toLowerCase().includes(search.toLowerCase())
      );
    }
    if (selectedCat !== "All") {
      result = result.filter(
        (p) => p.categoryId === selectedCat || p.category === selectedCat
      );
    }
    setFiltered(result);
  }, [search, selectedCat, products]);

  const changeCategory = (catId: string) => {
    if (Platform.OS !== "web") {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    }
    setSelectedCat(catId);
  };

  const handleCleanDuplicates = () => {
    const doClean = async () => {
      setCleaning(true);
      cancelCleaningRef.current = false;
      setErrorText("");
      setSuccessText("");
      setCleanProgress(`0 / ${duplicatesList.length}`);
      try {
        const ids = duplicatesList.map((p) => p.id);
        const count = await deleteAdminProductsBatch(
          ids,
          (prog) => setCleanProgress(`${prog} / ${ids.length}`),
          cancelCleaningRef
        );
        if (cancelCleaningRef.current) {
          setSuccessText(`Process stopped. Resolved ${count} duplicate documents.`);
        } else {
          setSuccessText(`Successfully resolved database duplicates. Removed ${count} documents.`);
        }
        setTimeout(() => setSuccessText(""), 4000);
      } catch (e: any) {
        setErrorText(e.message || "Failed to resolve duplicate items.");
      } finally {
        setCleaning(false);
        setCleanProgress("");
      }
    };

    if (Platform.OS === "web") {
      if (window.confirm("Delete Duplicate Products?\n\nThis will permanently delete all duplicate copies from Firestore, keeping the oldest document for each unique product (by Name + Category). This cannot be undone.")) {
        doClean();
      }
    } else {
      Alert.alert(
        "Delete Duplicate Products?",
        "This will permanently delete all duplicate copies from Firestore, keeping the oldest document for each unique product (by Name + Category). This cannot be undone.",
        [
          { text: "Cancel", style: "cancel" },
          { text: "Delete", style: "destructive", onPress: doClean }
        ]
      );
    }
  };

  const cancelCleaning = () => {
    cancelCleaningRef.current = true;
    setCleanProgress("Stopping...");
  };



  const renderProductItem = ({ item }: { item: AdminProduct }) => {
    const hasDiscount = item.originalPrice && item.originalPrice > item.price;
    const discountPercent = hasDiscount
      ? Math.round(((item.originalPrice! - item.price) / item.originalPrice!) * 100)
      : 0;
    const stockInfo = getStockStatus(item.stock || 0);

    return (
      <View style={[styles.productCard, !item.isActive && styles.productCardInactive]}>
        {/* Image Container */}
        <View style={styles.productImageContainer}>
          <Image
            source={{ uri: item.imageUrl }}
            style={styles.productImage}
            contentFit="cover"
            transition={200}
          />

          {hasDiscount && (
            <View style={styles.discountBadge}>
              <Text style={styles.discountBadgeText}>{discountPercent}% OFF</Text>
            </View>
          )}

          {/* ETA Badge matching customer home screen */}
          <View style={styles.etaBadge}>
            <Ionicons name="flash" size={10} color="#16a34a" />
            <Text style={styles.etaText}>{item.eta || "10 Mins"}</Text>
          </View>

          {/* Edit (Pencil) icon in the top-right corner */}
          <TouchableOpacity
            style={styles.editButtonOverlay}
            activeOpacity={0.8}
            onPress={() => router.push({ pathname: "/admin/product-form", params: { id: item.id } } as any)}
          >
            <Ionicons name="pencil" size={12} color={Theme.colors.primary} />
          </TouchableOpacity>
        </View>

        {/* Details matching customer UI */}
        <View style={styles.productDetails}>
          {/* Category Label */}
          <Text style={styles.productCardCategory}>
            {categories.find(c => c.id === item.categoryId)?.name || item.category || "General"}
          </Text>
          
          <Text style={styles.productName} numberOfLines={1}>
            {cleanProductName(item.name)}
          </Text>
          
          <View style={styles.metaRow}>
            <Text style={styles.productWeight}>{item.weight || "1 unit"}</Text>
            {/* Availability Badge */}
            <View style={[styles.availabilityBadge, item.isActive ? styles.activeBadge : styles.inactiveBadge]}>
              <Text style={[styles.availabilityText, { color: item.isActive ? "#16a34a" : "#64748b" }]}>
                {item.isActive ? "Active" : "Hidden"}
              </Text>
            </View>
          </View>

          {/* Prices & Stock Status Badge */}
          <View style={styles.priceRow}>
            <View style={styles.priceCol}>
              <Text style={styles.productPrice}>{formatPrice(item.price)}</Text>
              {hasDiscount && (
                <Text style={styles.productOriginalPrice}>
                  {formatPrice(item.originalPrice!)}
                </Text>
              )}
            </View>

            {/* Stock Status Badge */}
            <View style={[styles.stockBadge, { backgroundColor: stockInfo.bg }]}>
              <Text style={[styles.stockText, { color: stockInfo.color }]}>
                {stockInfo.label}
              </Text>
            </View>
          </View>
        </View>
      </View>
    );
  };

  const getCategoriesList = () => {
    return [
      { id: "All", name: "All", icon: "grid-outline", color: Theme.colors.primaryDark, bg: "#f1f5f9" } as any,
      ...categories.sort((a, b) => (a.displayOrder || 99) - (b.displayOrder || 99))
    ];
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={Theme.colors.primary} />

      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity
          style={styles.menuBtn}
          onPress={() => router.push("/admin/dashboard")}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Products Inventory</Text>
          <Text style={styles.headerSubtitle}>View and manage shop items</Text>
        </View>
        <View style={{ width: 38 }} />
      </View>

      {/* Success/Error Alerts for cleaning duplicates */}
      {successText ? (
        <View style={[styles.msgBar, styles.successBar]}>
          <Ionicons name="checkmark-circle" size={16} color="#10b981" />
          <Text style={[styles.msgText, { color: "#10b981" }]}>{successText}</Text>
        </View>
      ) : null}

      {errorText ? (
        <View style={[styles.msgBar, styles.errorBar]}>
          <Ionicons name="alert-circle" size={16} color="#ef4444" />
          <Text style={[styles.msgText, { color: "#ef4444" }]}>{errorText}</Text>
        </View>
      ) : null}

      {/* Duplicate Notice & Action Bar */}
      {duplicatesCount > 0 && (
        <View style={styles.duplicateBanner}>
          <Ionicons name="warning" size={18} color="#b45309" />
          <Text style={styles.duplicateText} numberOfLines={1} ellipsizeMode="tail">
            {cleaning 
              ? `Resolving duplicates (${cleanProgress})...` 
              : `Found ${duplicatesCount} duplicate documents.`}
          </Text>
          {cleaning ? (
            <TouchableOpacity 
              style={[styles.cleanBtn, { backgroundColor: "#ef4444" }]} 
              onPress={cancelCleaning}
            >
              <Text style={styles.cleanBtnText}>Stop Process</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity 
              style={styles.cleanBtn} 
              onPress={handleCleanDuplicates}
            >
              <Text style={styles.cleanBtnText}>Resolve</Text>
            </TouchableOpacity>
          )}
        </View>
      )}



      {/* Search Bar */}
      <View style={styles.searchBox}>
        <Ionicons name="search-outline" size={18} color="#64748b" />
        <TextInput
          style={styles.searchInput}
          placeholder="Search by product name..."
          placeholderTextColor="#94a3b8"
          value={search}
          onChangeText={setSearch}
        />
        {search ? (
          <TouchableOpacity onPress={() => setSearch("")}>
            <Ionicons name="close-circle" size={18} color="#94a3b8" />
          </TouchableOpacity>
        ) : null}
      </View>

      {/* Horizontal Category Selector matching customer home screen */}
      <View style={styles.categoriesContainer}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoryScroll}
        >
          {getCategoriesList().map((cat) => {
            const isSelected = selectedCat === cat.id;
            return (
              <TouchableOpacity
                key={cat.id}
                onPress={() => changeCategory(cat.id)}
                style={[
                  styles.categoryCard,
                  isSelected && styles.categoryCardSelected,
                ]}
                activeOpacity={0.8}
              >
                <View style={[
                  styles.categoryIconBg,
                  { backgroundColor: cat.backgroundColor || cat.bg || "#f1f5f9" },
                  isSelected && styles.categoryIconBgSelected
                ]}>
                  {cat.iconUrl ? (
                    <Image
                      source={{ uri: cat.iconUrl }}
                      style={{ width: "100%", height: "100%", borderRadius: 18 }}
                      contentFit="cover"
                    />
                  ) : (
                    <Ionicons name={cat.icon as any} size={20} color={isSelected ? Theme.colors.primary : cat.color} />
                  )}
                </View>
                <Text style={[styles.categoryLabel, isSelected && styles.categoryLabelSelected]} numberOfLines={1}>
                  {cat.name}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Main product area */}
      {loading ? (
        <FlatList
          numColumns={2}
          data={[1, 2, 3, 4, 5, 6]}
          renderItem={() => <ProductCardSkeleton />}
          keyExtractor={(item) => `sk-${item}`}
          contentContainerStyle={styles.gridList}
          columnWrapperStyle={styles.gridColumnWrapper}
          showsVerticalScrollIndicator={false}
        />
      ) : filtered.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyIcon}>📦</Text>
          <Text style={styles.emptyTitle}>No Products Found</Text>
          <Text style={styles.emptySubtitle}>Add your first product using the + button.</Text>
        </View>
      ) : (
        <FlatList
          numColumns={2}
          data={filtered}
          renderItem={renderProductItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.gridList}
          columnWrapperStyle={styles.gridColumnWrapper}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* Floating Action Button (FAB) */}
      <TouchableOpacity
        style={styles.fab}
        activeOpacity={0.85}
        onPress={() => router.push("/admin/product-form" as any)}
      >
        <Ionicons name="add" size={28} color="#fff" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#ffffff",
  },
  header: {
    backgroundColor: Theme.colors.primary,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 14,
    gap: 10,
  },
  menuBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "rgba(255,255,255,0.15)",
    justifyContent: "center",
    alignItems: "center",
  },
  headerCenter: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#fff",
  },
  headerSubtitle: {
    fontSize: 11,
    color: "rgba(255,255,255,0.75)",
  },
  msgBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
  },
  successBar: {
    backgroundColor: "#ecfdf5",
  },
  errorBar: {
    backgroundColor: "#fef2f2",
  },
  msgText: {
    fontSize: 13,
    fontWeight: "600",
    flex: 1,
  },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f8fafc",
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 6,
    borderRadius: 14,
    paddingHorizontal: 14,
    height: 48,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: Theme.colors.textDark,
    marginLeft: 8,
  },
  
  // Category Selector
  categoriesContainer: {
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  categoryScroll: {
    paddingHorizontal: 16,
    gap: 12,
  },
  categoryCard: {
    width: 76,
    alignItems: "center",
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
    borderWidth: 1.5,
    borderColor: "transparent",
  },
  categoryIconBgSelected: {
    borderColor: Theme.colors.primary,
    borderWidth: 2,
  },
  categoryLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "#64748b",
    textAlign: "center",
  },
  categoryLabelSelected: {
    color: Theme.colors.primaryDark,
    fontWeight: "800",
  },

  // Grid list of products
  gridList: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 90,
  },
  gridColumnWrapper: {
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
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 2,
    marginBottom: 16,
  },
  productCardInactive: {
    opacity: 0.7,
    borderColor: "#cbd5e1",
    backgroundColor: "#f8fafc",
  },
  productImageContainer: {
    height: 115,
    justifyContent: "center",
    alignItems: "center",
    position: "relative",
    backgroundColor: "#f8fafc",
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
  editButtonOverlay: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "#ffffff",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 3,
    zIndex: 10,
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
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 2,
  },
  productWeight: {
    fontSize: 11,
    color: "#64748b",
    fontWeight: "600",
  },
  availabilityBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
  },
  activeBadge: {
    backgroundColor: "#e8f5e9",
  },
  inactiveBadge: {
    backgroundColor: "#f1f5f9",
  },
  availabilityText: {
    fontSize: 8,
    fontWeight: "800",
  },
  priceRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 10,
    minHeight: 32,
  },
  priceCol: {
    flexDirection: "column",
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
  stockBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    justifyContent: "center",
    alignItems: "center",
  },
  stockText: {
    fontSize: 9,
    fontWeight: "800",
  },

  // Skeleton Styles
  imagePlaceholder: {
    height: 115,
    backgroundColor: "#f1f5f9",
  },
  skeletonLineShort: {
    height: 10,
    backgroundColor: "#f1f5f9",
    width: "40%",
    borderRadius: 4,
    marginBottom: 6,
  },
  skeletonLineLong: {
    height: 14,
    backgroundColor: "#f1f5f9",
    width: "90%",
    borderRadius: 4,
    marginBottom: 6,
  },
  skeletonLineMedium: {
    height: 11,
    backgroundColor: "#f1f5f9",
    width: "60%",
    borderRadius: 4,
    marginBottom: 10,
  },
  skeletonRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 4,
  },
  skeletonPrice: {
    height: 16,
    backgroundColor: "#f1f5f9",
    width: "35%",
    borderRadius: 4,
  },
  skeletonButton: {
    height: 24,
    backgroundColor: "#f1f5f9",
    width: "40%",
    borderRadius: 6,
  },

  // Empty state styles
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 32,
    marginTop: 60,
  },
  emptyIcon: {
    fontSize: 54,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: Theme.colors.primaryDark,
    marginBottom: 6,
  },
  emptySubtitle: {
    fontSize: 13,
    color: "#64748b",
    textAlign: "center",
    fontWeight: "500",
  },

  // FAB button
  fab: {
    position: "absolute",
    bottom: 24,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Theme.colors.primary,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: Theme.colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 6,
    zIndex: 100,
  },
  duplicateBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fef3c7",
    borderWidth: 1,
    borderColor: "#fde68a",
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginHorizontal: 16,
    marginTop: 10,
    gap: 8,
  },
  duplicateText: {
    fontSize: 12,
    color: "#b45309",
    fontWeight: "700",
    flex: 1,
  },
  cleanBtn: {
    backgroundColor: "#d97706",
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  cleanBtnText: {
    color: "#ffffff",
    fontSize: 11,
    fontWeight: "800",
  },
});
