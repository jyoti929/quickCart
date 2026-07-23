import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  FlatList,
  Image,
  Modal,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { AdminOrder, subscribeAllOrders } from "../../services/adminService";

const GREEN = "#22C55E";
const STATUS: Record<string, { color: string; label: string }> = {
  Placed: { color: "#F59E0B", label: "Pending" },
  Pending: { color: "#F59E0B", label: "Pending" },
  Confirmed: { color: "#3B82F6", label: "Confirmed" },
  "Preparing to pack": { color: "#6366F1", label: "Packed" },
  Packed: { color: "#6366F1", label: "Packed" },
  "Package in Transit": { color: "#A855F7", label: "Shipped" },
  Shipped: { color: "#A855F7", label: "Shipped" },
  "Out for Delivery": { color: "#06B6D4", label: "Out for delivery" },
  Delivered: { color: "#22C55E", label: "Delivered" },
  Cancelled: { color: "#EF4444", label: "Cancelled" },
  Returned: { color: "#92400E", label: "Returned" },
  Refunded: { color: "#64748B", label: "Refunded" },
};

const filterStatuses = ["All", "Pending", "Confirmed", "Packed", "Out for Delivery", "Delivered", "Cancelled"];
const money = (amount?: number) => `₹${Number(amount || 0).toLocaleString("en-IN")}`;

function displayStatus(status?: string) {
  return STATUS[status || ""] || { color: "#64748B", label: status || "Pending" };
}

function customerName(order: AdminOrder) {
  return (order as any).customerName || (order as any).name || "QuickCart customer";
}

export default function AdminOrders() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [sortBy, setSortBy] = useState("Newest");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const fade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // FIX: dep array is [] — `fade` is a stable useRef value and must NOT be
    // a dep. Including it was harmless here but incorrect in principle, and
    // any future refactor could turn it into a listener-recreation trigger.
    console.log("[LISTENER:CREATE] subscribeAllOrders");
    const unsubscribe = subscribeAllOrders((next) => {
      setOrders(next);
      setLoading(false);
      setRefreshing(false);
      Animated.timing(fade, { toValue: 1, duration: 280, useNativeDriver: true }).start();
    });
    return () => {
      console.log("[LISTENER:DESTROY] subscribeAllOrders");
      unsubscribe();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const summary = useMemo(() => {
    const today = new Date().toDateString();
    const count = (names: string[]) => orders.filter((o) => names.includes(o.status)).length;
    const todayOrders = orders.filter((o) => new Date(o.createdAt).toDateString() === today);
    return [
      ["receipt-text-outline", orders.length, "Total orders", "#0F766E"],
      ["time-outline", count(["Placed", "Pending"]), "Pending", "#F59E0B"],
      ["checkmark-circle-outline", count(["Confirmed"]), "Confirmed", "#3B82F6"],
      ["cube-outline", count(["Preparing to pack", "Packed"]), "Packed", "#6366F1"],
      ["bicycle-outline", count(["Out for Delivery", "Package in Transit", "Shipped"]), "On the way", "#06B6D4"],
      ["checkmark-done-outline", count(["Delivered"]), "Delivered", GREEN],
      ["close-circle-outline", count(["Cancelled"]), "Cancelled", "#EF4444"],
      ["wallet-outline", todayOrders.reduce((sum, o) => sum + (o.status !== "Cancelled" ? Number(o.totalAmount || 0) : 0), 0), "Today's revenue", "#7C3AED", true],
    ];
  }, [orders]);

  const filtered = useMemo(() => {
    const normalized = (status: string) => displayStatus(status).label;
    const result = orders.filter((order) => {
      const term = query.trim().toLowerCase();
      const matchesQuery = !term || [order.orderId, customerName(order), (order as any).phone, order.address]
        .filter(Boolean).some((value) => String(value).toLowerCase().includes(term));
      const matchesStatus = statusFilter === "All" || normalized(order.status) === statusFilter;
      return matchesQuery && matchesStatus;
    });
    return result.sort((a, b) => {
      if (sortBy === "Highest Amount") return Number(b.totalAmount || 0) - Number(a.totalAmount || 0);
      if (sortBy === "Lowest Amount") return Number(a.totalAmount || 0) - Number(b.totalAmount || 0);
      const comparison = new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      return sortBy === "Oldest" ? -comparison : comparison;
    });
  }, [orders, query, sortBy, statusFilter]);

  const onRefresh = () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 700);
  };

  return <ScrollView style={styles.screen} contentContainerStyle={{ paddingBottom: 36 }} showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={GREEN} colors={[GREEN]} />}>
    <StatusBar barStyle="dark-content" backgroundColor="#F8FAFC" />
    <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
      <TouchableOpacity onPress={() => router.back()} style={styles.iconButton}><Ionicons name="chevron-back" size={24} color="#0F172A" /></TouchableOpacity>
      <View style={{ flex: 1 }}><Text style={styles.title}>Orders</Text><Text style={styles.date}>{new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })}</Text></View>
      <TouchableOpacity onPress={() => setQuery("")} style={styles.iconButton}><Ionicons name="search-outline" size={22} color="#0F172A" /></TouchableOpacity>
      <TouchableOpacity onPress={() => setFilterOpen(true)} style={styles.iconButton}><Ionicons name="options-outline" size={22} color="#0F172A" /></TouchableOpacity>
      <TouchableOpacity onPress={onRefresh} style={styles.iconButton}><Ionicons name="refresh-outline" size={21} color="#0F172A" /></TouchableOpacity>
    </View>

    <View style={styles.searchWrap}><Ionicons name="search-outline" size={20} color="#94A3B8" /><TextInput value={query} onChangeText={setQuery} placeholder="Search Order ID, Customer, Phone..." placeholderTextColor="#94A3B8" style={[styles.searchInput, { outlineStyle: "none" } as any]} />{query ? <TouchableOpacity onPress={() => setQuery("")}><Ionicons name="close-circle" size={20} color="#94A3B8" /></TouchableOpacity> : null}<TouchableOpacity onPress={() => setFilterOpen(true)} style={styles.searchFilter}><Ionicons name="options-outline" size={19} color={GREEN} /></TouchableOpacity></View>

    <View style={styles.todayLine}><View style={styles.liveDot} /><Text style={styles.todayText}>{summary[0][1]} total orders · {money(summary[7][1] as number)} collected today</Text></View>

    <FlatList horizontal showsHorizontalScrollIndicator={false} data={summary} keyExtractor={(_, index) => String(index)} contentContainerStyle={styles.summaryRow}
      renderItem={({ item }) => <View style={styles.statCard}><View style={[styles.statIcon, { backgroundColor: `${item[3]}18` }]}><Ionicons name={item[0] as any} size={18} color={item[3] as string} /></View><Text style={styles.statValue}>{item[5] ? money(item[1] as number) : item[1]}</Text><View style={styles.statBottom}><Text style={styles.statLabel}>{item[2]}</Text><Text style={styles.trend}>↑</Text></View></View>} />

    <View style={styles.listHeading}><Text style={styles.resultTitle}>{filtered.length} {filtered.length === 1 ? "order" : "orders"}</Text><Text style={styles.resultSub}>{statusFilter === "All" ? "All statuses" : statusFilter}</Text></View>
    {loading ? <Skeletons /> : filtered.length === 0 ? <EmptyState onRefresh={onRefresh} /> : <Animated.View style={{ opacity: fade }}><View style={styles.list}>{filtered.map((item) => <OrderCard key={item.orderId} order={item} onPress={() => router.push({ pathname: "/admin/order-detail", params: { orderId: item.orderId } } as any)} />)}</View></Animated.View>}

    <FilterSheet visible={filterOpen} status={statusFilter} sortBy={sortBy} onClose={() => setFilterOpen(false)} onApply={(status, sort) => { setStatusFilter(status); setSortBy(sort); setFilterOpen(false); }} />
  </ScrollView>;
}

function OrderCard({ order, onPress }: { order: AdminOrder; onPress: () => void }) {
  const status = displayStatus(order.status); const items = order.items || []; const date = new Date(order.createdAt); const initials = customerName(order).split(" ").map((part: string) => part[0]).slice(0, 2).join("").toUpperCase();
  return <TouchableOpacity activeOpacity={0.88} onPress={onPress} style={styles.orderCard}>
    <View style={styles.cardTop}><View><Text style={styles.orderId}>#{order.orderId?.slice(-8) || "ORDER"}</Text><Text style={styles.orderDate}>{isNaN(date.getTime()) ? "Just now" : date.toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "numeric", minute: "2-digit" })}</Text></View><View style={[styles.badge, { backgroundColor: `${status.color}18` }]}><View style={[styles.badgeDot, { backgroundColor: status.color }]} /><Text style={[styles.badgeText, { color: status.color }]}>{status.label}</Text></View></View>
    <View style={styles.customerRow}><View style={styles.avatar}><Text style={styles.avatarText}>{initials || "QC"}</Text></View><View style={{ flex: 1 }}><Text style={styles.customerName}>{customerName(order)}</Text><Text style={styles.customerPhone}>{(order as any).phone || (order as any).mobile || "Phone not available"}</Text></View><Ionicons name="chevron-forward" size={18} color="#CBD5E1" /></View>
    <View style={styles.productRow}>{items.slice(0, 3).map((item, index) => item.imageUrl ? <Image key={`${item.productId}-${index}`} source={{ uri: item.imageUrl }} style={[styles.productImage, index > 0 && { marginLeft: -10 }]} /> : <View key={`${item.productId}-${index}`} style={[styles.productFallback, index > 0 && { marginLeft: -10 }]}><Ionicons name="bag-handle-outline" size={17} color="#64748B" /></View>)}{items.length > 3 && <View style={styles.moreProducts}><Text style={styles.moreProductsText}>+{items.length - 3}</Text></View>}<Text style={styles.productPreview} numberOfLines={1}>{items.length ? `${items[0].name}${items.length > 1 ? ` + ${items.length - 1} more` : ""}` : "No products"}</Text></View>
    <View style={styles.cardFooter}><View><Text style={styles.metaLabel}>{items.reduce((sum, item) => sum + Number(item.quantity || 0), 0)} items · {order.paymentMethod || "COD"}</Text><View style={styles.paymentBadge}><Text style={styles.paymentText}>{(order as any).paymentStatus || (order.paymentMethod === "COD" ? "Payment on delivery" : "Paid")}</Text></View></View><View style={{ alignItems: "flex-end" }}><Text style={styles.total}>{money(order.totalAmount)}</Text><Text style={styles.viewHint}>View order</Text></View></View>
    <View style={{ flexDirection: "row", gap: 8, marginTop: 14 }}><TouchableOpacity onPress={onPress} activeOpacity={0.8} style={{ flex: 1, height: 40, borderRadius: 11, backgroundColor: "#F0FDF4", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5 }}><Ionicons name="eye-outline" size={16} color="#15803D" /><Text style={{ color: "#15803D", fontSize: 11, fontWeight: "800" }}>View</Text></TouchableOpacity><TouchableOpacity onPress={onPress} activeOpacity={0.8} style={{ flex: 1.35, height: 40, borderRadius: 11, backgroundColor: GREEN, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5 }}><Ionicons name="swap-horizontal-outline" size={16} color="#fff" /><Text style={{ color: "#fff", fontSize: 11, fontWeight: "800" }}>Update status</Text></TouchableOpacity><TouchableOpacity onPress={onPress} activeOpacity={0.8} style={{ width: 42, height: 40, borderRadius: 11, backgroundColor: "#F1F5F9", alignItems: "center", justifyContent: "center" }}><Ionicons name="document-text-outline" size={17} color="#475569" /></TouchableOpacity></View>
  </TouchableOpacity>;
}

function Skeletons() { return <View style={styles.list}>{[1, 2, 3].map((n) => <View key={n} style={[styles.orderCard, { height: 230 }]}><View style={styles.skeletonWide} /><View style={styles.skeletonCustomer} /><View style={styles.skeletonWide} /></View>)}</View>; }
function EmptyState({ onRefresh }: { onRefresh: () => void }) { return <View style={styles.empty}><View style={styles.emptyIcon}><Ionicons name="receipt-outline" size={42} color={GREEN} /></View><Text style={styles.emptyTitle}>No Orders Yet</Text><Text style={styles.emptyText}>Orders will appear here once customers place them.</Text><TouchableOpacity onPress={onRefresh} style={styles.refreshButton}><Ionicons name="refresh" size={17} color="#fff" /><Text style={styles.refreshText}>Refresh</Text></TouchableOpacity></View>; }

function FilterSheet({ visible, status, sortBy, onClose, onApply }: { visible: boolean; status: string; sortBy: string; onClose: () => void; onApply: (status: string, sortBy: string) => void }) {
  const [nextStatus, setNextStatus] = useState(status); const [nextSort, setNextSort] = useState(sortBy);
  useEffect(() => { if (visible) { setNextStatus(status); setNextSort(sortBy); } }, [visible, status, sortBy]);
  return <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}><View style={styles.sheetOverlay}><TouchableOpacity style={{ flex: 1 }} onPress={onClose} activeOpacity={1} /><View style={styles.sheet}><View style={styles.sheetHandle} /><View style={styles.sheetTitleRow}><Text style={styles.sheetTitle}>Filter orders</Text><TouchableOpacity onPress={() => { setNextStatus("All"); setNextSort("Newest"); }}><Text style={styles.reset}>Reset</Text></TouchableOpacity></View><Text style={styles.sheetLabel}>Order status</Text><View style={styles.optionWrap}>{filterStatuses.map((item) => <TouchableOpacity key={item} onPress={() => setNextStatus(item)} style={[styles.optionPill, nextStatus === item && styles.optionPillActive]}><Text style={[styles.optionText, nextStatus === item && styles.optionTextActive]}>{item}</Text></TouchableOpacity>)}</View><Text style={styles.sheetLabel}>Payment status</Text><View style={styles.selector}><Text>All payments</Text><Ionicons name="chevron-down" size={18} color="#64748B" /></View><Text style={styles.sheetLabel}>Sort by</Text>{["Newest", "Oldest", "Highest Amount", "Lowest Amount"].map((item) => <TouchableOpacity key={item} onPress={() => setNextSort(item)} style={styles.radioRow}><View style={[styles.radio, nextSort === item && styles.radioActive]}>{nextSort === item && <View style={styles.radioDot} />}</View><Text style={styles.radioLabel}>{item}</Text></TouchableOpacity>)}<TouchableOpacity onPress={() => onApply(nextStatus, nextSort)} style={styles.applyButton}><Text style={styles.applyText}>Show orders</Text></TouchableOpacity></View></View></Modal>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#F8FAFC" }, topBar: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingBottom: 12, gap: 5 }, iconButton: { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center" }, title: { color: "#0F172A", fontSize: 25, fontWeight: "800", letterSpacing: -0.5 }, date: { fontSize: 12, color: "#64748B", marginTop: 2 }, todayLine: { flexDirection: "row", alignItems: "center", marginHorizontal: 20, marginBottom: 14, gap: 7 }, liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: GREEN }, todayText: { color: "#64748B", fontSize: 12, fontWeight: "600" }, summaryRow: { gap: 10, paddingHorizontal: 20, paddingBottom: 16 }, statCard: { width: 132, height: 100, backgroundColor: "#fff", padding: 12, borderRadius: 16, shadowColor: "#0F172A", shadowOpacity: 0.05, shadowRadius: 9, shadowOffset: { width: 0, height: 3 }, elevation: 2 }, statIcon: { width: 30, height: 30, borderRadius: 10, justifyContent: "center", alignItems: "center" }, statValue: { fontSize: 18, fontWeight: "800", color: "#0F172A", marginTop: 5 }, statBottom: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" }, statLabel: { fontSize: 10, color: "#64748B", fontWeight: "600" }, trend: { color: GREEN, fontWeight: "800" }, searchWrap: { height: 52, marginHorizontal: 20, marginBottom: 16, flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: "#fff", borderRadius: 16, paddingLeft: 15, shadowColor: "#0F172A", shadowOpacity: 0.05, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 2 }, searchInput: { flex: 1, fontSize: 13, color: "#0F172A" }, searchFilter: { width: 43, height: 36, borderLeftWidth: 1, borderLeftColor: "#E2E8F0", justifyContent: "center", alignItems: "center" }, listHeading: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", paddingHorizontal: 20, marginBottom: 10 }, resultTitle: { fontSize: 15, fontWeight: "800", color: "#0F172A" }, resultSub: { fontSize: 12, color: "#64748B" }, list: { paddingHorizontal: 20, paddingBottom: 35, gap: 16 }, orderCard: { backgroundColor: "#fff", borderRadius: 16, padding: 16, shadowColor: "#0F172A", shadowOpacity: 0.06, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 2 }, cardTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }, orderId: { fontSize: 14, fontWeight: "800", color: "#0F172A", letterSpacing: 0.2 }, orderDate: { color: "#94A3B8", fontSize: 11, marginTop: 3 }, badge: { flexDirection: "row", alignItems: "center", gap: 5, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 6 }, badgeDot: { width: 6, height: 6, borderRadius: 3 }, badgeText: { fontSize: 10, fontWeight: "800" }, customerRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: "#F1F5F9" }, avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: "#DCFCE7", justifyContent: "center", alignItems: "center" }, avatarText: { color: "#15803D", fontSize: 13, fontWeight: "800" }, customerName: { color: "#0F172A", fontSize: 14, fontWeight: "700" }, customerPhone: { color: "#64748B", fontSize: 11, marginTop: 3 }, productRow: { height: 68, flexDirection: "row", alignItems: "center" }, productImage: { width: 42, height: 42, borderRadius: 12, backgroundColor: "#F1F5F9", borderWidth: 2, borderColor: "#fff" }, productFallback: { width: 42, height: 42, borderRadius: 12, backgroundColor: "#F1F5F9", borderWidth: 2, borderColor: "#fff", justifyContent: "center", alignItems: "center" }, moreProducts: { width: 34, height: 34, borderRadius: 17, backgroundColor: "#F1F5F9", alignItems: "center", justifyContent: "center", marginLeft: -8, borderWidth: 2, borderColor: "#fff" }, moreProductsText: { color: "#475569", fontSize: 10, fontWeight: "800" }, productPreview: { flex: 1, marginLeft: 10, color: "#64748B", fontSize: 11 }, cardFooter: { borderTopWidth: 1, borderTopColor: "#F1F5F9", paddingTop: 12, flexDirection: "row", justifyContent: "space-between", alignItems: "center" }, metaLabel: { color: "#64748B", fontSize: 11, fontWeight: "600" }, paymentBadge: { backgroundColor: "#ECFDF5", borderRadius: 6, alignSelf: "flex-start", paddingHorizontal: 6, paddingVertical: 3, marginTop: 5 }, paymentText: { color: "#15803D", fontSize: 9, fontWeight: "700" }, total: { color: "#0F172A", fontSize: 17, fontWeight: "800" }, viewHint: { color: GREEN, fontSize: 10, fontWeight: "700", marginTop: 4 }, skeletonWide: { height: 20, width: "70%", borderRadius: 8, backgroundColor: "#F1F5F9" }, skeletonCustomer: { height: 46, width: "100%", borderRadius: 12, backgroundColor: "#F8FAFC", marginVertical: 24 }, empty: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 45, marginTop: -40 }, emptyIcon: { width: 82, height: 82, borderRadius: 41, backgroundColor: "#ECFDF5", alignItems: "center", justifyContent: "center", marginBottom: 16 }, emptyTitle: { color: "#0F172A", fontSize: 19, fontWeight: "800" }, emptyText: { color: "#64748B", fontSize: 13, textAlign: "center", lineHeight: 19, marginTop: 7 }, refreshButton: { flexDirection: "row", backgroundColor: GREEN, paddingHorizontal: 18, height: 44, borderRadius: 12, alignItems: "center", gap: 8, marginTop: 20 }, refreshText: { color: "#fff", fontWeight: "800", fontSize: 13 }, sheetOverlay: { flex: 1, backgroundColor: "rgba(15,23,42,0.34)" }, sheet: { backgroundColor: "#fff", borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 20, paddingBottom: 28 }, sheetHandle: { width: 36, height: 4, borderRadius: 2, backgroundColor: "#CBD5E1", alignSelf: "center", marginBottom: 18 }, sheetTitleRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }, sheetTitle: { color: "#0F172A", fontSize: 19, fontWeight: "800" }, reset: { color: GREEN, fontSize: 13, fontWeight: "800" }, sheetLabel: { color: "#475569", fontSize: 12, fontWeight: "800", marginBottom: 9, marginTop: 12 }, optionWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 }, optionPill: { borderWidth: 1, borderColor: "#E2E8F0", borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 }, optionPillActive: { borderColor: GREEN, backgroundColor: "#ECFDF5" }, optionText: { color: "#64748B", fontSize: 12, fontWeight: "700" }, optionTextActive: { color: "#15803D" }, selector: { borderWidth: 1, borderColor: "#E2E8F0", borderRadius: 12, paddingHorizontal: 13, height: 46, flexDirection: "row", alignItems: "center", justifyContent: "space-between", color: "#0F172A", fontSize: 13 }, radioRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 7 }, radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 1.5, borderColor: "#CBD5E1", alignItems: "center", justifyContent: "center" }, radioActive: { borderColor: GREEN }, radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: GREEN }, radioLabel: { color: "#334155", fontSize: 13, fontWeight: "600" }, applyButton: { height: 48, backgroundColor: GREEN, borderRadius: 14, alignItems: "center", justifyContent: "center", marginTop: 16 }, applyText: { color: "#fff", fontSize: 14, fontWeight: "800" },
});
