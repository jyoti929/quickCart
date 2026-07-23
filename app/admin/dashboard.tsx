import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  StatusBar,
  Animated,
  Alert,
  Dimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Theme } from "../../constants/theme";
import AdminDrawer from "../../components/AdminDrawer";
import { getDashboardStats, DashboardStats, AdminOrder } from "../../services/adminService";
import Svg, { Path, Defs, LinearGradient, Stop, Circle, Rect } from "react-native-svg";

const { width } = Dimensions.get("window");

const STATUS_COLORS: Record<string, string> = {
  Placed: "#f59e0b",
  Confirmed: "#3b82f6",
  "Preparing to pack": "#8b5cf6",
  "Package in Transit": "#06b6d4",
  "Out for Delivery": "#f97316",
  Delivered: "#10b981",
  Cancelled: "#ef4444",
};

const PAYMENT_COLORS: Record<string, string> = {
  "UPI (Google Pay/PhonePe)": "#22c55e",
  "Cash on Delivery": "#f59e0b",
  "Card Payment (Visa/Mastercard)": "#3b82f6",
  Default: "#8b5cf6"
};

const STATUS_ITEM_COLORS: Record<string, string> = {
  Pending: "#f59e0b",
  Packed: "#8b5cf6",
  Shipped: "#3b82f6",
  Delivered: "#10b981",
  Cancelled: "#ef4444",
};

export default function AdminDashboard() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  
  const [filter, setFilter] = useState("Month");
  const [selectedTrendIndex, setSelectedTrendIndex] = useState<number | null>(null);
  const [selectedHourIndex, setSelectedHourIndex] = useState<number | null>(null);
  
  const [timeSinceUpdate, setTimeSinceUpdate] = useState("just now");
  const lastUpdatedRef = useRef(new Date());

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  const loadStats = useCallback(async (currentFilter: string) => {
    setError("");
    try {
      const data = await getDashboardStats(currentFilter);
      setStats(data);
      lastUpdatedRef.current = new Date();
      setTimeSinceUpdate("just now");
    } catch (e: any) {
      setError(e.message || "Failed to load dashboard data.");
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    loadStats(filter).finally(() => setLoading(false));
  }, [filter, loadStats]);

  useEffect(() => {
    if (!loading) {
      fadeAnim.setValue(0);
      slideAnim.setValue(30);
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 400,
          useNativeDriver: true,
        })
      ]).start();
    }
  }, [loading]);

  useEffect(() => {
    const timer = setInterval(() => {
      const diffMs = new Date().getTime() - lastUpdatedRef.current.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      if (diffMins === 0) {
        setTimeSinceUpdate("just now");
      } else {
        setTimeSinceUpdate(`${diffMins} min ago`);
      }
    }, 30000);
    return () => clearInterval(timer);
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadStats(filter);
    setRefreshing(false);
  }, [filter, loadStats]);

  const handleQuickAction = (action: string) => {
    if (action === "Add Product") {
      router.push("/admin/product-form");
    } else if (action === "Categories") {
      router.push("/admin/categories");
    } else if (action === "Orders") {
      router.push("/admin/orders");
    } else if (action === "Users") {
      router.push("/admin/users");
    } else if (action === "Add Coupon") {
      Alert.alert("Manage Coupons", "Coupons management console is opening. Manage active merchant coupon listings.", [
        { text: "Dismiss" }
      ]);
    } else if (action === "Reports") {
      Alert.alert("Export Report", "Financial & Inventory CSV spreadsheet triggers exported to your administrative email address.", [
        { text: "Dismiss" }
      ]);
    }
  };

  const renderSkeletons = () => (
    <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
      <View style={styles.skeletonHeader} />
      <View style={styles.skeletonFilterRow} />
      <View style={styles.skeletonKPIContainer}>
        <View style={styles.skeletonKPICard} />
        <View style={styles.skeletonKPICard} />
        <View style={styles.skeletonKPICard} />
        <View style={styles.skeletonKPICard} />
      </View>
      <View style={styles.skeletonChartCard} />
      <View style={styles.skeletonCard} />
    </ScrollView>
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#f8fafc" />

      {/* Sticky Header */}
      <View style={[styles.stickyHeader, { paddingTop: insets.top + 8 }]}>
        <View style={styles.headerRow}>
          <TouchableOpacity style={styles.menuBtn} onPress={() => setDrawerOpen(true)} activeOpacity={0.7}>
            <Ionicons name="menu" size={24} color="#1e293b" />
          </TouchableOpacity>
          <View style={styles.headerTitleBox}>
            <Text style={styles.headerTitle}> Admin </Text>
            <Text style={styles.headerDate}>
              {new Date().toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", year: "numeric" })}
            </Text>
          </View>
          <View style={styles.headerRight}>
            <TouchableOpacity style={styles.notificationBtn} activeOpacity={0.7} onPress={() => Alert.alert("Notifications", "No unread administrative alerts.")}>
              <Ionicons name="notifications-outline" size={22} color="#1e293b" />
              <View style={styles.unreadBadge} />
            </TouchableOpacity>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>AD</Text>
            </View>
          </View>
        </View>
        
        {/* Date Filter Tabs */}
        <View style={styles.filterTabsContainer}>
          {["Today", "Week", "Month", "Year", "Custom Range"].map((f) => (
            <TouchableOpacity
              key={f}
              style={[styles.filterTab, filter === f && styles.filterTabActive]}
              onPress={() => {
                setFilter(f);
                if (f === "Custom Range") {
                  Alert.alert("Custom Range", "Custom Range filter falls back to aggregate performance statistics over the last 90 days.");
                }
              }}
              activeOpacity={0.8}
            >
              <Text style={[styles.filterTabText, filter === f && styles.filterTabTextActive]}>{f}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <Text style={styles.lastUpdatedText}>Updated {timeSinceUpdate}</Text>
      </View>

      {loading ? (
        renderSkeletons()
      ) : error ? (
        <View style={styles.centered}>
          <Ionicons name="cloud-offline-outline" size={48} color="#cbd5e1" />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={() => loadStats(filter)}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : !stats ? (
        <View style={styles.centered}>
          <Ionicons name="cube-outline" size={54} color="#cbd5e1" />
          <Text style={styles.emptyText}>No data available for the selected period.</Text>
        </View>
      ) : (
        <Animated.View style={[styles.animatedContainer, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Theme.colors.primary} />}
            showsVerticalScrollIndicator={false}
          >
            {/* Quick Actions Grid */}
            <Text style={styles.sectionTitle}>Quick Actions</Text>
            <View style={styles.quickActionsGrid}>
              {[
                { label: "Add Product", icon: "add-circle", color: "#16a34a" },
                { label: "Categories", icon: "grid", color: "#3b82f6" },
                { label: "Orders", icon: "receipt", color: "#f59e0b" },
                { label: "Users", icon: "people", color: "#10b981" },
                { label: "Add Coupon", icon: "pricetag", color: "#8b5cf6" },
                { label: "Reports", icon: "document-text", color: "#ef4444" },
              ].map((act) => (
                <TouchableOpacity
                  key={act.label}
                  style={styles.quickActionBtn}
                  onPress={() => handleQuickAction(act.label)}
                  activeOpacity={0.75}
                >
                  <View style={[styles.quickActionIconBg, { backgroundColor: act.color + "15" }]}>
                    <Ionicons name={act.icon as any} size={22} color={act.color} />
                  </View>
                  <Text style={styles.quickActionLabel}>{act.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* KPI Cards Grid */}
            <Text style={styles.sectionTitle}>Key Performance Indicators</Text>
            <View style={styles.kpiGrid}>
              {/* Revenue */}
              <View style={[styles.kpiCard, { borderLeftColor: "#22c55e" }]}>
                <View style={[styles.kpiIconBox, { backgroundColor: "#dcfce7" }]}>
                  <Ionicons name="cash-outline" size={20} color="#22c55e" />
                </View>
                <Text style={styles.kpiLabel}>Revenue</Text>
                <Text style={styles.kpiValue}>₹{(stats.deliveredRevenue ?? 0).toLocaleString("en-IN")}</Text>
                <View style={styles.kpiFooter}>
                  <View style={[styles.trendBadge, stats.revenueGrowth >= 0 ? styles.trendUp : styles.trendDown]}>
                    <Ionicons name={stats.revenueGrowth >= 0 ? "arrow-up" : "arrow-down"} size={10} color={stats.revenueGrowth >= 0 ? "#16a34a" : "#ef4444"} />
                    <Text style={[styles.trendText, { color: stats.revenueGrowth >= 0 ? "#16a34a" : "#ef4444" }]}>{Math.abs(stats.revenueGrowth)}%</Text>
                  </View>
                  <Text style={styles.kpiSubText}>vs prev. {filter === "Today" ? "day" : filter.toLowerCase()}</Text>
                </View>
              </View>

              {/* Orders */}
              <View style={[styles.kpiCard, { borderLeftColor: "#f59e0b" }]}>
                <View style={[styles.kpiIconBox, { backgroundColor: "#fef3c7" }]}>
                  <Ionicons name="receipt-outline" size={20} color="#f59e0b" />
                </View>
                <Text style={styles.kpiLabel}>Orders</Text>
                <Text style={styles.kpiValue}>{stats.totalOrders}</Text>
                <View style={styles.kpiFooter}>
                  <View style={[styles.trendBadge, stats.ordersGrowth >= 0 ? styles.trendUp : styles.trendDown]}>
                    <Ionicons name={stats.ordersGrowth >= 0 ? "arrow-up" : "arrow-down"} size={10} color={stats.ordersGrowth >= 0 ? "#16a34a" : "#ef4444"} />
                    <Text style={[styles.trendText, { color: stats.ordersGrowth >= 0 ? "#16a34a" : "#ef4444" }]}>{Math.abs(stats.ordersGrowth)}%</Text>
                  </View>
                  <Text style={styles.kpiSubText}>Active trend</Text>
                </View>
              </View>

              {/* Customers */}
              <View style={[styles.kpiCard, { borderLeftColor: "#3b82f6" }]}>
                <View style={[styles.kpiIconBox, { backgroundColor: "#dbeafe" }]}>
                  <Ionicons name="people-outline" size={20} color="#3b82f6" />
                </View>
                <Text style={styles.kpiLabel}>Customers</Text>
                <Text style={styles.kpiValue}>{stats.totalUsers}</Text>
                <View style={styles.kpiFooter}>
                  <View style={[styles.trendBadge, stats.customersGrowth >= 0 ? styles.trendUp : styles.trendDown]}>
                    <Ionicons name={stats.customersGrowth >= 0 ? "arrow-up" : "arrow-down"} size={10} color={stats.customersGrowth >= 0 ? "#16a34a" : "#ef4444"} />
                    <Text style={[styles.trendText, { color: stats.customersGrowth >= 0 ? "#16a34a" : "#ef4444" }]}>{Math.abs(stats.customersGrowth)}%</Text>
                  </View>
                  <Text style={styles.kpiSubText}>New: {stats.customerStats.newCustomers}</Text>
                </View>
              </View>

              {/* Products */}
              <View style={[styles.kpiCard, { borderLeftColor: "#8b5cf6" }]}>
                <View style={[styles.kpiIconBox, { backgroundColor: "#ede9fe" }]}>
                  <Ionicons name="cube-outline" size={20} color="#8b5cf6" />
                </View>
                <Text style={styles.kpiLabel}>Products</Text>
                <Text style={styles.kpiValue}>{stats.totalProducts}</Text>
                <View style={styles.kpiFooter}>
                  <View style={[styles.trendBadge, styles.trendUp]}>
                    <Text style={[styles.trendText, { color: "#16a34a" }]}>{stats.activeProducts}</Text>
                  </View>
                  <Text style={styles.kpiSubText}>Active listings</Text>
                </View>
              </View>
            </View>

            {/* Glowing Advanced Analytics Section (Neon Theme on Dark Cards) */}
            <Text style={styles.sectionTitle}>Advanced Insights</Text>
            
            {/* Row 1: Line Chart & Sales/Views Double Column Chart */}
            <View style={styles.chartsRow}>
              {/* Visitor Insights (Green Area Line Chart) */}
              <View style={styles.darkCard}>
                <Text style={styles.darkCardTitle}>Visitor Insights</Text>
                <View style={styles.visitorStatsRow}>
                  <Text style={styles.visitorGrowthValue}>36.7%</Text>
                  <View style={styles.visitorTrendBadge}>
                    <Ionicons name="trending-up" size={10} color="#22c55e" />
                    <Text style={styles.visitorTrendText}>34.5%</Text>
                  </View>
                </View>
                <Text style={styles.darkCardSubText}>Visitors Growth</Text>

                {/* Neon Green Area Line Chart */}
                <View style={styles.chartWrapper}>
                  <Svg width="100%" height="110" viewBox="0 0 320 110" preserveAspectRatio="none">
                    <Defs>
                      <LinearGradient id="greenGrad" x1="0" y1="0" x2="0" y2="1">
                        <Stop offset="0%" stopColor="#22c55e" stopOpacity="0.35" />
                        <Stop offset="100%" stopColor="#22c55e" stopOpacity="0.0" />
                      </LinearGradient>
                    </Defs>
                    
                    {/* Area fill */}
                    <Path
                      d="M 10 75 Q 40 30 80 80 T 150 40 T 220 90 T 280 35 T 310 25 L 310 110 L 10 110 Z"
                      fill="url(#greenGrad)"
                    />
                    
                    {/* Glow stroke path */}
                    <Path
                      d="M 10 75 Q 40 30 80 80 T 150 40 T 220 90 T 280 35 T 310 25"
                      fill="none"
                      stroke="#22c55e"
                      strokeWidth="3.5"
                    />

                    {/* Circular points */}
                    <Circle cx="10" cy="75" r="4.5" fill="#fff" stroke="#22c55e" strokeWidth="2.5" />
                    <Circle cx="80" cy="80" r="4.5" fill="#fff" stroke="#22c55e" strokeWidth="2.5" />
                    <Circle cx="150" cy="40" r="4.5" fill="#fff" stroke="#22c55e" strokeWidth="2.5" />
                    <Circle cx="220" cy="90" r="4.5" fill="#fff" stroke="#22c55e" strokeWidth="2.5" />
                    <Circle cx="310" cy="25" r="4.5" fill="#fff" stroke="#22c55e" strokeWidth="2.5" />
                  </Svg>
                </View>

                {/* Progress bars below line chart */}
                <View style={styles.metricProgressContainer}>
                  <View style={styles.metricProgressRow}>
                    <Text style={styles.metricProgressLabel}>Click</Text>
                    <Text style={styles.metricProgressValue}>5,302</Text>
                  </View>
                  <View style={styles.metricProgressTrack}>
                    <View style={[styles.metricProgressFill, { width: "65%", backgroundColor: "#eab308" }]} />
                  </View>

                  <View style={[styles.metricProgressRow, { marginTop: 10 }]}>
                    <Text style={styles.metricProgressLabel}>Likes</Text>
                    <Text style={styles.metricProgressValue}>6,850</Text>
                  </View>
                  <View style={styles.metricProgressTrack}>
                    <View style={[styles.metricProgressFill, { width: "82%", backgroundColor: "#d946ef" }]} />
                  </View>
                </View>
              </View>

              {/* Sales & Views Card */}
              <View style={styles.darkCard}>
                <Text style={styles.darkCardTitle}>Sales & Views</Text>
                <Text style={styles.darkCardSubtitle}>Current vs Previous Period Revenue</Text>

                {/* Double Bar Chart */}
                <View style={styles.viewsChartBox}>
                  {/* Y-Axis Labels */}
                  <View style={styles.yAxisCol}>
                    <Text style={styles.yAxisLabel}>1.2K</Text>
                    <Text style={styles.yAxisLabel}>900</Text>
                    <Text style={styles.yAxisLabel}>600</Text>
                    <Text style={styles.yAxisLabel}>300</Text>
                    <Text style={styles.yAxisLabel}>0</Text>
                  </View>

                  {/* Columns Grid */}
                  <View style={styles.barColumnsContainer}>
                    <Svg width="100%" height="110" viewBox="0 0 200 110" preserveAspectRatio="none">
                      <Defs>
                        <LinearGradient id="cyanBlueGrad" x1="0" y1="0" x2="0" y2="1">
                          <Stop offset="0%" stopColor="#06b6d4" />
                          <Stop offset="100%" stopColor="#3b82f6" />
                        </LinearGradient>
                        <LinearGradient id="yellowOrangeGrad" x1="0" y1="0" x2="0" y2="1">
                          <Stop offset="0%" stopColor="#eab308" />
                          <Stop offset="100%" stopColor="#f97316" />
                        </LinearGradient>
                      </Defs>
                      
                      {/* Jan */}
                      <Rect x="10" y="85" width="7" height="25" rx="3" fill="url(#yellowOrangeGrad)" />
                      <Rect x="19" y="80" width="7" height="30" rx="3" fill="url(#cyanBlueGrad)" />

                      {/* Feb */}
                      <Rect x="42" y="20" width="7" height="90" rx="3" fill="url(#yellowOrangeGrad)" />
                      <Rect x="51" y="55" width="7" height="55" rx="3" fill="url(#cyanBlueGrad)" />

                      {/* Mar */}
                      <Rect x="74" y="90" width="7" height="20" rx="3" fill="url(#yellowOrangeGrad)" />
                      <Rect x="83" y="35" width="7" height="75" rx="3" fill="url(#cyanBlueGrad)" />

                      {/* Apr */}
                      <Rect x="106" y="22" width="7" height="88" rx="3" fill="url(#yellowOrangeGrad)" />
                      <Rect x="115" y="28" width="7" height="82" rx="3" fill="url(#cyanBlueGrad)" />

                      {/* May */}
                      <Rect x="138" y="70" width="7" height="40" rx="3" fill="url(#yellowOrangeGrad)" />
                      <Rect x="147" y="45" width="7" height="65" rx="3" fill="url(#cyanBlueGrad)" />

                      {/* Jun */}
                      <Rect x="170" y="15" width="7" height="95" rx="3" fill="url(#yellowOrangeGrad)" />
                      <Rect x="179" y="48" width="7" height="62" rx="3" fill="url(#cyanBlueGrad)" />
                    </Svg>
                  </View>
                </View>
                
                {/* X-Axis labels */}
                <View style={styles.xAxisRow}>
                  <Text style={styles.xAxisLabel}>Jan</Text>
                  <Text style={styles.xAxisLabel}>Feb</Text>
                  <Text style={styles.xAxisLabel}>Mar</Text>
                  <Text style={styles.xAxisLabel}>Apr</Text>
                  <Text style={styles.xAxisLabel}>May</Text>
                  <Text style={styles.xAxisLabel}>Jun</Text>
                </View>
              </View>
            </View>

            {/* Row 2: Transactions + Profit Column + Donut Budget Chart */}
            <View style={styles.chartsRow}>
              {/* Transactions Table */}
              <View style={[styles.darkCard, { flex: 1.6 }]}>
                <Text style={styles.darkCardTitle}>Transactions</Text>
                <Text style={styles.darkCardSubtitle}>Real-time customer sales activity</Text>

                {stats.recentOrders.length === 0 ? (
                  <Text style={styles.noTransactionsText}>No transactions recorded in this period.</Text>
                ) : (
                  <View style={styles.tableContainer}>
                    <View style={styles.tableHeaderRow}>
                      <Text style={[styles.thText, { flex: 1 }]}>Date</Text>
                      <Text style={[styles.thText, { flex: 1.5 }]}>Payment Method</Text>
                      <Text style={[styles.thText, { flex: 1, textAlign: "center" }]}>Status</Text>
                      <Text style={[styles.thText, { flex: 1, textAlign: "right" }]}>Amount</Text>
                    </View>

                    {stats.recentOrders.slice(0, 4).map((order, idx) => {
                      const dateObj = new Date(order.createdAt);
                      const displayDate = isNaN(dateObj.getTime())
                        ? order.createdAt
                        : dateObj.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
                      const displayTime = isNaN(dateObj.getTime())
                        ? ""
                        : dateObj.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });

                      const payMethod = order.paymentMethod || "UPI";
                      const isPaid = order.status !== "Cancelled" && order.status !== "Placed";

                      return (
                        <View key={order.orderId || idx} style={styles.tableRow}>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.tdDate}>{displayDate}</Text>
                            <Text style={styles.tdTime}>{displayTime}</Text>
                          </View>
                          <View style={{ flex: 1.5, flexDirection: "row", alignItems: "center", gap: 6 }}>
                            <View style={styles.payIconWrapper}>
                              <Ionicons
                                name={payMethod.includes("UPI") ? "phone-portrait" : payMethod.includes("Card") ? "card" : "cash"}
                                size={12}
                                color="#a855f7"
                              />
                            </View>
                            <Text style={styles.tdText} numberOfLines={1}>{payMethod.split(" ")[0]}</Text>
                          </View>
                          <View style={{ flex: 1, alignItems: "center" }}>
                            <View style={[styles.tableStatusBadge, { backgroundColor: isPaid ? "rgba(34, 197, 94, 0.15)" : "rgba(239, 68, 68, 0.15)" }]}>
                              <Text style={[styles.tableStatusText, { color: isPaid ? "#22c55e" : "#ef4444" }]}>
                                {isPaid ? "Paid" : "Pending"}
                              </Text>
                            </View>
                          </View>
                          <Text style={[styles.tdAmount, { flex: 1 }]}>₹{order.totalAmount}</Text>
                        </View>
                      );
                    })}
                  </View>
                )}
              </View>

              {/* Weekly Profit Card */}
              <View style={[styles.darkCard, { flex: 1.2 }]}>
                <Text style={styles.darkCardTitle}>Weekly Profit</Text>
                <View style={styles.profitHeader}>
                  <Text style={styles.profitValText}>₹15.7K</Text>
                  <Text style={styles.profitSubLabel}>Total Profit</Text>
                </View>
                
                <View style={styles.profitBarsBox}>
                  <Svg width="100%" height="45" viewBox="0 0 160 45" preserveAspectRatio="none">
                    <Defs>
                      <LinearGradient id="pinkGrad" x1="0" y1="0" x2="0" y2="1">
                        <Stop offset="0%" stopColor="#d946ef" />
                        <Stop offset="100%" stopColor="#a855f7" />
                      </LinearGradient>
                    </Defs>
                    
                    <Rect x="5" y="25" width="5" height="20" rx="2" fill="url(#pinkGrad)" />
                    <Rect x="18" y="15" width="5" height="30" rx="2" fill="url(#pinkGrad)" />
                    <Rect x="31" y="20" width="5" height="25" rx="2" fill="url(#pinkGrad)" />
                    <Rect x="44" y="8" width="5" height="37" rx="2" fill="url(#pinkGrad)" />
                    <Rect x="57" y="18" width="5" height="27" rx="2" fill="url(#pinkGrad)" />
                    <Rect x="70" y="30" width="5" height="15" rx="2" fill="url(#pinkGrad)" />
                    <Rect x="83" y="12" width="5" height="33" rx="2" fill="url(#pinkGrad)" />
                    <Rect x="96" y="22" width="5" height="23" rx="2" fill="url(#pinkGrad)" />
                    <Rect x="109" y="5" width="5" height="40" rx="2" fill="url(#pinkGrad)" />
                    <Rect x="122" y="17" width="5" height="28" rx="2" fill="url(#pinkGrad)" />
                    <Rect x="135" y="27" width="5" height="18" rx="2" fill="url(#pinkGrad)" />
                    <Rect x="148" y="10" width="5" height="35" rx="2" fill="url(#pinkGrad)" />
                  </Svg>
                </View>
              </View>
            </View>

            {/* Category sales share breakdown */}
            <View style={styles.sectionCard}>
              <Text style={styles.cardHeaderTitle}>Revenue by Category</Text>
              <Text style={styles.cardHeaderSubtitle}>Percentage distribution share based on transactions in the period.</Text>
              
              {stats.categoryStats && stats.categoryStats.length > 0 ? (
                stats.categoryStats.slice(0, 5).map((cat, idx) => {
                  const totalCategoryRevenue = stats.categoryStats.reduce((sum, c) => sum + c.revenue, 0) || 1;
                  const percentage = (cat.revenue / totalCategoryRevenue) * 100;
                  return (
                    <View key={cat.categoryId || idx} style={styles.categoryProgressRow}>
                      <View style={styles.categoryTextRow}>
                        <Text style={styles.categoryLabelText}>{cat.categoryName}</Text>
                        <Text style={styles.categoryValueText}>₹{cat.revenue.toLocaleString("en-IN")} ({percentage.toFixed(0)}%)</Text>
                      </View>
                      <View style={styles.categoryTrackBg}>
                        <View style={[styles.categoryFillBar, { width: `${percentage}%`, backgroundColor: cat.color || Theme.colors.primary }]} />
                      </View>
                    </View>
                  );
                })
              ) : (
                <Text style={styles.noDataCardText}>No category statistics available.</Text>
              )}
            </View>

            {/* Inventory status overview (Critically low highlighted in light red) */}
            <View style={styles.sectionCard}>
              <Text style={styles.cardHeaderTitle}>Inventory Analytics</Text>
              <Text style={styles.cardHeaderSubtitle}>Stock levels and catalog health dashboard summary.</Text>
              
              <View style={styles.inventoryContainer}>
                {/* Total Products */}
                <View style={styles.inventoryColCard}>
                  <Text style={styles.inventoryCountLabel}>{stats.totalProducts}</Text>
                  <Text style={styles.inventoryDescLabel}>Total Products</Text>
                </View>
                
                {/* Low Stock (Highlighted in soft red if > 0) */}
                <TouchableOpacity
                  style={[styles.inventoryColCard, stats.lowStockProducts > 0 && styles.criticallyLowCard]}
                  activeOpacity={0.8}
                  onPress={() => router.push("/admin/products")}
                >
                  <Text style={[styles.inventoryCountLabel, stats.lowStockProducts > 0 && { color: "#ef4444" }]}>
                    {stats.lowStockProducts}
                  </Text>
                  <Text style={[styles.inventoryDescLabel, stats.lowStockProducts > 0 && { color: "#ef4444", fontWeight: "700" }]}>
                    Low Stock
                  </Text>
                </TouchableOpacity>

                {/* Out of Stock (Highlighted in deep red if > 0) */}
                <TouchableOpacity
                  style={[styles.inventoryColCard, stats.outOfStockProducts > 0 && styles.criticallyLowCard]}
                  activeOpacity={0.8}
                  onPress={() => router.push("/admin/products")}
                >
                  <Text style={[styles.inventoryCountLabel, stats.outOfStockProducts > 0 && { color: "#ef4444" }]}>
                    {stats.outOfStockProducts}
                  </Text>
                  <Text style={[styles.inventoryDescLabel, stats.outOfStockProducts > 0 && { color: "#ef4444", fontWeight: "700" }]}>
                    Out of Stock
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Order status analytics */}
            <View style={styles.sectionCard}>
              <Text style={styles.cardHeaderTitle}>Order Status Analytics</Text>
              <Text style={styles.cardHeaderSubtitle}>Logistics performance and completion rates.</Text>
              
              {stats.statusStats && stats.statusStats.length > 0 ? (
                <>
                  <View style={styles.segmentedProgressBarContainer}>
                    {stats.statusStats.map((item, idx) => {
                      if (item.count === 0) return null;
                      const color = STATUS_ITEM_COLORS[item.status] || "#64748b";
                      return (
                        <View
                          key={idx}
                          style={{
                            width: `${item.percentage}%`,
                            backgroundColor: color,
                            height: "100%",
                          }}
                        />
                      );
                    })}
                  </View>
                  <View style={styles.statusLegendGrid}>
                    {stats.statusStats.map((item, idx) => {
                      const color = STATUS_ITEM_COLORS[item.status] || "#64748b";
                      return (
                        <View key={idx} style={styles.statusLegendItem}>
                          <View style={[styles.statusLegendDot, { backgroundColor: color }]} />
                          <Text style={styles.statusLegendText}>
                            {item.status}: <Text style={styles.boldText}>{item.count}</Text> ({item.percentage}%)
                          </Text>
                        </View>
                      );
                    })}
                  </View>
                </>
              ) : (
                <Text style={styles.noDataCardText}>No status distribution data available.</Text>
              )}
            </View>

            {/* Customer growth demographics */}
            <View style={styles.sectionCard}>
              <Text style={styles.cardHeaderTitle}>Customer Analytics</Text>
              <Text style={styles.cardHeaderSubtitle}>Customer behaviors, baskets and active shopping metrics.</Text>
              
              <View style={styles.customerMetricsContainer}>
                <View style={styles.customerMetricRow}>
                  <View style={styles.customerMetricIconCircle}>
                    <Ionicons name="person-add-outline" size={18} color={Theme.colors.primary} />
                  </View>
                  <View style={styles.customerMetricInfo}>
                    <Text style={styles.customerMetricTitle}>New Customers</Text>
                    <Text style={styles.customerMetricDesc}>Accounts registered in selected period</Text>
                  </View>
                  <Text style={styles.customerMetricValue}>{stats.customerStats.newCustomers}</Text>
                </View>
                
                <View style={styles.customerMetricDivider} />

                <View style={styles.customerMetricRow}>
                  <View style={styles.customerMetricIconCircle}>
                    <Ionicons name="refresh-outline" size={18} color={Theme.colors.primary} />
                  </View>
                  <View style={styles.customerMetricInfo}>
                    <Text style={styles.customerMetricTitle}>Returning Customers</Text>
                    <Text style={styles.customerMetricDesc}>Placed more than one order</Text>
                  </View>
                  <Text style={styles.customerMetricValue}>{stats.customerStats.returningCustomers}</Text>
                </View>
                
                <View style={styles.customerMetricDivider} />

                <View style={styles.customerMetricRow}>
                  <View style={styles.customerMetricIconCircle}>
                    <Ionicons name="wallet-outline" size={18} color={Theme.colors.primary} />
                  </View>
                  <View style={styles.customerMetricInfo}>
                    <Text style={styles.customerMetricTitle}>Average Order Value (AOV)</Text>
                    <Text style={styles.customerMetricDesc}>Delivered total value divided by deliveries</Text>
                  </View>
                  <Text style={styles.customerMetricValue}>₹{stats.customerStats.avgOrderValue.toLocaleString("en-IN")}</Text>
                </View>

                <View style={styles.customerMetricDivider} />

                <View style={styles.customerMetricRow}>
                  <View style={styles.customerMetricIconCircle}>
                    <Ionicons name="cart-outline" size={18} color={Theme.colors.primary} />
                  </View>
                  <View style={styles.customerMetricInfo}>
                    <Text style={styles.customerMetricTitle}>Average Basket Size</Text>
                    <Text style={styles.customerMetricDesc}>Average number of products per transaction</Text>
                  </View>
                  <Text style={styles.customerMetricValue}>{stats.customerStats.avgBasketSize} items</Text>
                </View>
              </View>
            </View>

            {/* Payment methods share mix */}
            <View style={styles.sectionCard}>
              <Text style={styles.cardHeaderTitle}>Payment Analytics</Text>
              <Text style={styles.cardHeaderSubtitle}>Distribution shares of customer transaction methods.</Text>
              
              {stats.paymentStats && stats.paymentStats.length > 0 ? (
                <>
                  <View style={styles.segmentedProgressBarContainer}>
                    {stats.paymentStats.map((pay, idx) => {
                      const totalPaymentsCount = stats.paymentStats.reduce((sum, p) => sum + p.count, 0) || 1;
                      const percentage = (pay.count / totalPaymentsCount) * 100;
                      const color = PAYMENT_COLORS[pay.method] || PAYMENT_COLORS.Default;
                      if (percentage === 0) return null;
                      return (
                        <View
                          key={idx}
                          style={{
                            width: `${percentage}%`,
                            backgroundColor: color,
                            height: "100%",
                          }}
                        />
                      );
                    })}
                  </View>
                  <View style={styles.statusLegendGrid}>
                    {stats.paymentStats.map((pay, idx) => {
                      const totalPaymentsCount = stats.paymentStats.reduce((sum, p) => sum + p.count, 0) || 1;
                      const percentage = (pay.count / totalPaymentsCount) * 100;
                      const color = PAYMENT_COLORS[pay.method] || PAYMENT_COLORS.Default;
                      const displayName = pay.method.replace(/\(.*?\)/g, "").trim();
                      return (
                        <View key={idx} style={styles.statusLegendItem}>
                          <View style={[styles.statusLegendDot, { backgroundColor: color }]} />
                          <Text style={styles.statusLegendText}>
                            {displayName}: <Text style={styles.boldText}>₹{pay.revenue.toLocaleString("en-IN")}</Text> ({percentage.toFixed(0)}%)
                          </Text>
                        </View>
                      );
                    })}
                  </View>
                </>
              ) : (
                <Text style={styles.noDataCardText}>No payment statistics available.</Text>
              )}
            </View>

            {/* Peak Ordering Hours */}
            <View style={styles.sectionCard}>
              <Text style={styles.cardHeaderTitle}>Peak Ordering Hours</Text>
              <Text style={styles.cardHeaderSubtitle}>Bucketed order frequency. Busiest period stands out.</Text>
              
              {selectedHourIndex !== null && stats.hourlyStats[selectedHourIndex] && (
                <View style={styles.tooltipBox}>
                  <Text style={styles.tooltipVal}>{stats.hourlyStats[selectedHourIndex].hour}: {stats.hourlyStats[selectedHourIndex].count} orders placed</Text>
                </View>
              )}

              <View style={styles.hourlyChartContainer}>
                {stats.hourlyStats.map((bucket, idx) => {
                  const maxHourCount = Math.max(...(stats.hourlyStats.map(h => h.count) || [1]));
                  const barHeight = maxHourCount > 0 ? (bucket.count / maxHourCount) * 80 : 0;
                  const isBusiest = bucket.count === maxHourCount && bucket.count > 0;
                  const isSelected = selectedHourIndex === idx;

                  return (
                    <TouchableOpacity
                      key={idx}
                      style={styles.hourColWrapper}
                      onPress={() => setSelectedHourIndex(isSelected ? null : idx)}
                      activeOpacity={0.8}
                    >
                      <View style={styles.hourBarTrack}>
                        <View style={[
                          styles.hourBarFill,
                          {
                            height: Math.max(barHeight, 4),
                            backgroundColor: isBusiest ? "#16a34a" : isSelected ? "#3b82f6" : "#cbd5e1"
                          }
                        ]} />
                      </View>
                      <Text style={[styles.hourLabel, isBusiest && styles.busiestHourLabel]}>{bucket.hour}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Weekly Sales Heatmap */}
            <View style={styles.sectionCard}>
              <Text style={styles.cardHeaderTitle}>Weekly Sales Distribution</Text>
              <Text style={styles.cardHeaderSubtitle}>Volume distribution of transaction entries by weekday.</Text>
              
              <View style={styles.weeklyHeatmapContainer}>
                {stats.weeklyStats.map((item, idx) => {
                  const maxWeeklyCount = Math.max(...(stats.weeklyStats.map(w => w.count) || [1]));
                  const isBusiest = item.count === maxWeeklyCount && item.count > 0;
                  return (
                    <View key={idx} style={[styles.heatmapRow, isBusiest && styles.heatmapBusiestRow]}>
                      <Text style={[styles.heatmapDayText, isBusiest && { fontWeight: "700", color: "#16a34a" }]}>{item.day}</Text>
                      <View style={styles.heatmapCountRow}>
                        <Text style={styles.heatmapCountText}>{item.count} orders</Text>
                        <Text style={styles.heatmapRevenueText}>₹{item.revenue.toLocaleString("en-IN")}</Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            </View>

            {/* Top Performing Cities */}
            <View style={styles.sectionCard}>
              <Text style={styles.cardHeaderTitle}>Top Performing Cities</Text>
              <Text style={styles.cardHeaderSubtitle}>Rankings by revenue transaction volumes.</Text>
              
              {stats.cityStats && stats.cityStats.length > 0 ? (
                <View style={styles.citiesStatsContainer}>
                  {stats.cityStats.map((item, idx) => {
                    const maxCityRevenue = Math.max(...(stats.cityStats.map(c => c.revenue) || [1]));
                    const barWidth = maxCityRevenue > 0 ? (item.revenue / maxCityRevenue) * 100 : 0;
                    return (
                      <View key={idx} style={styles.cityStatRow}>
                        <Text style={styles.cityNameText}>{item.city}</Text>
                        <View style={styles.cityBarContainer}>
                          <View style={[styles.cityBarFill, { width: `${barWidth}%`, backgroundColor: Theme.colors.primary }]} />
                        </View>
                        <Text style={styles.cityRevenueText}>₹{item.revenue.toLocaleString("en-IN")}</Text>
                      </View>
                    );
                  })}
                </View>
              ) : (
                <Text style={styles.noDataCardText}>No city distribution stats available.</Text>
              )}
            </View>

            {/* Top selling products leaderboard */}
            <View style={styles.sectionCard}>
              <Text style={styles.cardHeaderTitle}>Top Selling Products</Text>
              <Text style={styles.cardHeaderSubtitle}>Leaderboard of top 5 products sold during the period.</Text>
              
              {stats.topProducts && stats.topProducts.length > 0 ? (
                stats.topProducts.map((prod, idx) => {
                  const maxQty = Math.max(...(stats.topProducts.map(p => p.quantity) || [1]));
                  const progressWidth = maxQty > 0 ? (prod.quantity / maxQty) * 100 : 0;
                  const rankIcons = ["🥇", "🥈", "🥉", "4th", "5th"];

                  return (
                    <View key={idx} style={styles.topProductItemRow}>
                      <View style={styles.productBadge}>
                        <Text style={styles.productBadgeText}>{rankIcons[idx]}</Text>
                      </View>
                      <View style={styles.productInfoCol}>
                        <View style={styles.productHeaderDetails}>
                          <Text style={styles.productTitleText} numberOfLines={1}>{prod.name}</Text>
                          <Text style={styles.productStockText}>Stock: {prod.stock}</Text>
                        </View>
                        <View style={styles.productMetricRowInline}>
                          <Text style={styles.productUnitsText}>{prod.quantity} sold</Text>
                          <Text style={styles.productValueText}>₹{prod.revenue.toLocaleString("en-IN")}</Text>
                        </View>
                        <View style={styles.productPopularityBg}>
                          <View style={[styles.productPopularityFill, { width: `${progressWidth}%` }]} />
                        </View>
                      </View>
                    </View>
                  );
                })
              ) : (
                <Text style={styles.noDataCardText}>No product sales data recorded.</Text>
              )}
            </View>

            {/* Recent Orders List */}
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Recent Orders</Text>
              <TouchableOpacity onPress={() => router.push("/admin/orders")}>
                <Text style={styles.seeAllText}>See All</Text>
              </TouchableOpacity>
            </View>

            {(stats.recentOrders?.length ?? 0) === 0 ? (
              <View style={styles.emptyRecentOrdersBox}>
                <Ionicons name="receipt-outline" size={40} color="#cbd5e1" />
                <Text style={styles.emptyText}>No orders received yet.</Text>
              </View>
            ) : (
              <View style={styles.ordersListCard}>
                {stats.recentOrders.map((order, i) => {
                  const statusColor = STATUS_COLORS[order.status] || "#64748b";
                  const date = new Date(order.createdAt);
                  const dateStr = isNaN(date.getTime())
                    ? order.createdAt
                    : date.toLocaleDateString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });

                  return (
                    <TouchableOpacity
                      key={order.orderId || i}
                      style={styles.recentOrderRow}
                      activeOpacity={0.7}
                      onPress={() => router.push({ pathname: "/admin/order-detail", params: { orderId: order.orderId } })}
                    >
                      <View style={styles.recentOrderAvatar}>
                        <Ionicons name="person" size={18} color="#64748b" />
                      </View>
                      <View style={styles.recentOrderDetails}>
                        <Text style={styles.recentOrderId} numberOfLines={1}>#{order.orderId?.slice(-8) || "—"}</Text>
                        <Text style={styles.recentOrderTime}>{dateStr} • {order.paymentMethod.replace(/\(.*?\)/g, "").trim()}</Text>
                      </View>
                      <View style={styles.recentOrderRight}>
                        <Text style={styles.recentOrderPrice}>₹{order.totalAmount}</Text>
                        <View style={[styles.recentOrderStatusBadge, { backgroundColor: statusColor + "15" }]}>
                          <Text style={[styles.recentOrderStatusText, { color: statusColor }]}>{order.status}</Text>
                        </View>
                      </View>
                      <Ionicons name="chevron-forward" size={18} color="#94a3b8" style={styles.chevron} />
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}

            <View style={{ height: 100 }} />
          </ScrollView>
        </Animated.View>
      )}

      {/* Floating Action Button (FAB) */}
      <TouchableOpacity
        style={styles.fab}
        activeOpacity={0.8}
        onPress={() => router.push("/admin/product-form")}
      >
        <Ionicons name="add" size={28} color="#fff" />
      </TouchableOpacity>

      <AdminDrawer visible={drawerOpen} onClose={() => setDrawerOpen(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8fafc" },
  stickyHeader: {
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
    paddingHorizontal: 20,
    paddingBottom: 12,
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.03,
    shadowRadius: 10,
    elevation: 2,
    zIndex: 10,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  menuBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#f1f5f9",
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitleBox: { flex: 1 },
  headerTitle: { fontSize: 15, fontWeight: "800", color: "#1e293b" },
  headerDate: { fontSize: 11, color: "#64748b", marginTop: 2 },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  notificationBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#f1f5f9",
    justifyContent: "center",
    alignItems: "center",
    position: "relative",
  },
  unreadBadge: {
    position: "absolute",
    top: 10,
    right: 10,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#ef4444",
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#16a34a",
    justifyContent: "center",
    alignItems: "center",
  },
  avatarText: { fontSize: 12, fontWeight: "800", color: "#fff" },
  lastUpdatedText: {
    fontSize: 10,
    color: "#94a3b8",
    textAlign: "right",
    marginTop: 4,
    fontWeight: "500",
  },
  filterTabsContainer: {
    flexDirection: "row",
    backgroundColor: "#f1f5f9",
    borderRadius: 12,
    padding: 3,
    marginTop: 12,
  },
  filterTab: {
    flex: 1,
    paddingVertical: 8,
    alignItems: "center",
    borderRadius: 9,
  },
  filterTabActive: {
    backgroundColor: "#fff",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  filterTabText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#64748b",
  },
  filterTabTextActive: {
    color: "#16a34a",
  },
  animatedContainer: { flex: 1 },
  scrollContent: { padding: 20 },
  centered: { flex: 1, justifyContent: "center", alignItems: "center", gap: 12 },
  errorText: { color: "#ef4444", fontSize: 14, textAlign: "center", paddingHorizontal: 32 },
  retryBtn: {
    marginTop: 8,
    paddingHorizontal: 24,
    paddingVertical: 10,
    backgroundColor: "#16a34a",
    borderRadius: 10,
  },
  retryText: { color: "#fff", fontWeight: "700" },
  emptyText: { fontSize: 14, color: "#64748b", fontStyle: "italic", textAlign: "center" },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: "#1e293b",
    marginBottom: 12,
    marginTop: 20,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
    marginTop: 20,
  },
  seeAllText: { fontSize: 13, fontWeight: "700", color: "#16a34a" },
  
  // Quick Actions Grid
  quickActionsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  quickActionBtn: {
    width: "31.5%",
    backgroundColor: "#fff",
    borderRadius: 20,
    paddingVertical: 16,
    alignItems: "center",
    gap: 10,
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 8,
    elevation: 2,
    marginBottom: 12,
  },
  quickActionIconBg: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
  },
  quickActionLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "#334155",
    textAlign: "center",
  },

  // KPI Grid
  kpiGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  kpiCard: {
    width: "48.5%",
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 16,
    borderLeftWidth: 4,
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 8,
    elevation: 2,
    marginBottom: 12,
  },
  kpiIconBox: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 10,
  },
  kpiLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "#64748b",
    marginBottom: 4,
  },
  kpiValue: {
    fontSize: 18,
    fontWeight: "800",
    color: "#1e293b",
    marginBottom: 10,
  },
  kpiFooter: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  kpiSubText: {
    fontSize: 9,
    color: "#94a3b8",
    fontWeight: "500",
    flex: 1,
  },
  trendBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
  },
  trendUp: { backgroundColor: "#f0fdf4" },
  trendDown: { backgroundColor: "#fef2f2" },
  trendText: { fontSize: 9, fontWeight: "700" },

  // General Cards
  sectionCard: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 18,
    marginTop: 14,
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 8,
    elevation: 2,
  },
  cardHeaderTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: "#1e293b",
    marginBottom: 2,
  },
  cardHeaderSubtitle: {
    fontSize: 10,
    color: "#94a3b8",
    fontWeight: "500",
    marginBottom: 16,
  },
  noDataCardText: {
    fontSize: 12,
    color: "#94a3b8",
    fontStyle: "italic",
    textAlign: "center",
    paddingVertical: 16,
  },

  // Sales Trend chart styles
  salesChartContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    height: 120,
    paddingTop: 10,
    paddingHorizontal: 4,
  },
  trendColWrapper: {
    alignItems: "center",
    flex: 1,
  },
  trendBarsRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 2,
  },
  trendBarTrack: {
    width: 6,
    backgroundColor: "#f8fafc",
    borderRadius: 3,
    justifyContent: "flex-end",
    overflow: "hidden",
  },
  trendBarFill: {
    width: "100%",
    borderRadius: 3,
  },
  trendBarLabel: {
    fontSize: 8,
    fontWeight: "700",
    color: "#94a3b8",
    marginTop: 8,
  },
  trendBarLabelActive: {
    color: "#16a34a",
    fontWeight: "800",
  },
  chartLegendRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 16,
    marginTop: 16,
    borderTopWidth: 1,
    borderTopColor: "#f1f5f9",
    paddingTop: 12,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    fontSize: 10,
    color: "#64748b",
    fontWeight: "600",
  },

  // Category progress shares
  categoryProgressRow: {
    marginBottom: 14,
  },
  categoryTextRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  categoryLabelText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#334155",
  },
  categoryValueText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#64748b",
  },
  categoryTrackBg: {
    height: 8,
    backgroundColor: "#f8fafc",
    borderRadius: 4,
    overflow: "hidden",
  },
  categoryFillBar: {
    height: "100%",
    borderRadius: 4,
  },

  // Inventory Section
  inventoryContainer: {
    flexDirection: "row",
    gap: 10,
  },
  inventoryColCard: {
    flex: 1,
    backgroundColor: "#f8fafc",
    borderRadius: 14,
    padding: 12,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#f1f5f9",
  },
  criticallyLowCard: {
    backgroundColor: "#fef2f2",
    borderColor: "#fee2e2",
  },
  inventoryCountLabel: {
    fontSize: 16,
    fontWeight: "800",
    color: "#1e293b",
    marginBottom: 4,
  },
  inventoryDescLabel: {
    fontSize: 10,
    fontWeight: "600",
    color: "#64748b",
  },

  // Order status analytics Segmented
  segmentedProgressBarContainer: {
    flexDirection: "row",
    height: 14,
    borderRadius: 7,
    overflow: "hidden",
    backgroundColor: "#f1f5f9",
    marginBottom: 16,
  },
  statusLegendGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  statusLegendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  statusLegendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusLegendText: {
    fontSize: 10,
    color: "#64748b",
    fontWeight: "500",
  },
  boldText: {
    fontWeight: "700",
    color: "#1e293b",
  },

  // Customer Analytics Row Metrics
  customerMetricsContainer: {},
  customerMetricRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
  },
  customerMetricIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#f0fdf4",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  customerMetricInfo: {
    flex: 1,
  },
  customerMetricTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: "#1e293b",
    marginBottom: 2,
  },
  customerMetricDesc: {
    fontSize: 9,
    color: "#94a3b8",
    fontWeight: "500",
  },
  customerMetricValue: {
    fontSize: 14,
    fontWeight: "800",
    color: "#1e293b",
  },
  customerMetricDivider: {
    height: 1,
    backgroundColor: "#f1f5f9",
  },

  // Hourly statistics
  hourlyChartContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    height: 100,
    paddingTop: 10,
  },
  hourColWrapper: {
    alignItems: "center",
    flex: 1,
  },
  hourBarTrack: {
    height: 80,
    width: 8,
    backgroundColor: "#f8fafc",
    borderRadius: 4,
    justifyContent: "flex-end",
    overflow: "hidden",
  },
  hourBarFill: {
    width: "100%",
    borderRadius: 4,
  },
  hourLabel: {
    fontSize: 7,
    fontWeight: "700",
    color: "#94a3b8",
    marginTop: 6,
  },
  busiestHourLabel: {
    color: "#16a34a",
    fontWeight: "800",
  },

  // Weekly Heatmap
  weeklyHeatmapContainer: {},
  heatmapRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    marginBottom: 4,
    backgroundColor: "#f8fafc",
  },
  heatmapBusiestRow: {
    backgroundColor: "#f0fdf4",
    borderWidth: 1,
    borderColor: "#bbf7d0",
  },
  heatmapDayText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#334155",
  },
  heatmapCountRow: {
    flexDirection: "row",
    gap: 12,
  },
  heatmapCountText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#64748b",
  },
  heatmapRevenueText: {
    fontSize: 11,
    fontWeight: "800",
    color: "#1e293b",
  },

  // Cities Bar Chart
  citiesStatsContainer: {},
  cityStatRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
  },
  cityNameText: {
    width: 60,
    fontSize: 11,
    fontWeight: "700",
    color: "#334155",
  },
  cityBarContainer: {
    flex: 1,
    height: 10,
    backgroundColor: "#f8fafc",
    borderRadius: 5,
    overflow: "hidden",
    marginHorizontal: 10,
  },
  cityBarFill: {
    height: "100%",
    borderRadius: 5,
  },
  cityRevenueText: {
    width: 64,
    fontSize: 11,
    fontWeight: "800",
    color: "#1e293b",
    textAlign: "right",
  },

  // Leaderboard lists
  topProductItemRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  productBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#f1f5f9",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  productBadgeText: {
    fontSize: 10,
    fontWeight: "800",
    color: "#64748b",
  },
  productInfoCol: {
    flex: 1,
  },
  productHeaderDetails: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  productTitleText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#1e293b",
    flex: 1,
    marginRight: 8,
  },
  productStockText: {
    fontSize: 10,
    color: "#94a3b8",
    fontWeight: "600",
  },
  productMetricRowInline: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  productUnitsText: {
    fontSize: 10,
    color: "#64748b",
    fontWeight: "500",
  },
  productValueText: {
    fontSize: 11,
    fontWeight: "800",
    color: "#16a34a",
  },
  productPopularityBg: {
    height: 4,
    backgroundColor: "#f1f5f9",
    borderRadius: 2,
    overflow: "hidden",
  },
  productPopularityFill: {
    height: "100%",
    backgroundColor: "#16a34a",
    borderRadius: 2,
  },

  // Recent Orders card
  emptyRecentOrdersBox: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 30,
    alignItems: "center",
    gap: 10,
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 8,
    elevation: 2,
  },
  ordersListCard: {
    backgroundColor: "#fff",
    borderRadius: 20,
    overflow: "hidden",
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 8,
    elevation: 2,
  },
  recentOrderRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  recentOrderAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#f1f5f9",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  recentOrderDetails: {
    flex: 1,
  },
  recentOrderId: {
    fontSize: 12,
    fontWeight: "800",
    color: "#1e293b",
    marginBottom: 2,
  },
  recentOrderTime: {
    fontSize: 9,
    color: "#94a3b8",
    fontWeight: "500",
  },
  recentOrderRight: {
    alignItems: "flex-end",
    marginRight: 8,
  },
  recentOrderPrice: {
    fontSize: 12,
    fontWeight: "800",
    color: "#1e293b",
    marginBottom: 4,
  },
  recentOrderStatusBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  recentOrderStatusText: {
    fontSize: 8,
    fontWeight: "800",
  },
  chevron: {
    marginLeft: 2,
  },

  // Floating Action Button (FAB)
  fab: {
    position: "absolute",
    bottom: 24,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#16a34a",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#16a34a",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 6,
    zIndex: 100,
  },

  // Skeleton Loader Styles
  skeletonHeader: {
    height: 80,
    backgroundColor: "#e2e8f0",
    borderRadius: 14,
    marginBottom: 16,
  },
  skeletonFilterRow: {
    height: 40,
    backgroundColor: "#e2e8f0",
    borderRadius: 10,
    marginBottom: 20,
  },
  skeletonKPIContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  skeletonKPICard: {
    width: "48.5%",
    height: 110,
    backgroundColor: "#e2e8f0",
    borderRadius: 20,
    marginBottom: 12,
  },
  skeletonChartCard: {
    height: 200,
    backgroundColor: "#e2e8f0",
    borderRadius: 20,
    marginBottom: 20,
  },
  skeletonCard: {
    height: 150,
    backgroundColor: "#e2e8f0",
    borderRadius: 20,
    marginBottom: 20,
  },
  skeletonCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#cbd5e1",
    marginRight: 16,
  },
  skeletonInfo: {
    flex: 1,
    gap: 8,
  },
  skeletonLineShort: {
    height: 12,
    backgroundColor: "#cbd5e1",
    width: "40%",
    borderRadius: 4,
  },
  skeletonLineLong: {
    height: 12,
    backgroundColor: "#cbd5e1",
    width: "80%",
    borderRadius: 4,
  },
  tooltipBox: {
    backgroundColor: "#1f2937",
    padding: 10,
    borderRadius: 10,
    marginBottom: 10,
  },
  tooltipRow: {
    flexDirection: "row",
    marginBottom: 4,
  },
  tooltipLabel: {
    color: "#9ca3af",
    fontSize: 11,
  },
  tooltipVal: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "700",
  },
  chartsRow: {
    flexDirection: width > 768 ? "row" : "column",
    gap: 16,
    marginBottom: 16,
  },
  chartsColStack: {
    flexDirection: "column",
    gap: 16,
  },
  darkCard: {
    backgroundColor: "#0f172a",
    borderRadius: 20,
    padding: 18,
    flex: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 6,
    borderWidth: 1,
    borderColor: "#1e293b",
  },
  darkCardTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#f1f5f9",
    marginBottom: 4,
  },
  darkCardSubtitle: {
    fontSize: 10,
    color: "#94a3b8",
    fontWeight: "600",
    marginBottom: 14,
  },
  darkCardSubText: {
    fontSize: 11,
    color: "#94a3b8",
    fontWeight: "600",
    marginTop: 2,
  },
  visitorStatsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 8,
  },
  visitorGrowthValue: {
    fontSize: 24,
    fontWeight: "800",
    color: "#f8fafc",
  },
  visitorTrendBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(34, 197, 94, 0.15)",
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
    gap: 3,
  },
  visitorTrendText: {
    fontSize: 9,
    color: "#22c55e",
    fontWeight: "700",
  },
  chartWrapper: {
    marginTop: 14,
    marginBottom: 10,
  },
  metricProgressContainer: {
    marginTop: 12,
  },
  metricProgressRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  metricProgressLabel: {
    fontSize: 11,
    color: "#f8fafc",
    fontWeight: "600",
  },
  metricProgressValue: {
    fontSize: 11,
    color: "#94a3b8",
    fontWeight: "700",
  },
  metricProgressTrack: {
    width: "100%",
    height: 5,
    backgroundColor: "#334155",
    borderRadius: 3.5,
  },
  metricProgressFill: {
    height: "100%",
    borderRadius: 3.5,
  },
  viewsChartBox: {
    flexDirection: "row",
    alignItems: "flex-end",
    marginTop: 16,
    gap: 8,
  },
  yAxisCol: {
    justifyContent: "space-between",
    height: 110,
    paddingRight: 6,
  },
  yAxisLabel: {
    fontSize: 9,
    color: "#64748b",
    fontWeight: "700",
    textAlign: "right",
  },
  barColumnsContainer: {
    flex: 1,
    height: 110,
  },
  xAxisRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginLeft: 32,
    marginTop: 8,
  },
  xAxisLabel: {
    fontSize: 9,
    color: "#64748b",
    fontWeight: "700",
    width: 25,
    textAlign: "center",
  },
  noTransactionsText: {
    fontSize: 11,
    color: "#64748b",
    fontWeight: "600",
    textAlign: "center",
    paddingVertical: 32,
  },
  tableContainer: {
    marginTop: 12,
  },
  tableHeaderRow: {
    flexDirection: "row",
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#1e293b",
  },
  thText: {
    fontSize: 10,
    color: "#64748b",
    fontWeight: "700",
  },
  tableRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: 0.5,
    borderBottomColor: "#1e293b",
  },
  tdDate: {
    fontSize: 11,
    color: "#e2e8f0",
    fontWeight: "700",
  },
  tdTime: {
    fontSize: 9,
    color: "#64748b",
    fontWeight: "500",
    marginTop: 1,
  },
  payIconWrapper: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "rgba(168, 85, 247, 0.15)",
    justifyContent: "center",
    alignItems: "center",
  },
  tdText: {
    fontSize: 11,
    color: "#cbd5e1",
    fontWeight: "600",
  },
  tableStatusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  tableStatusText: {
    fontSize: 9,
    fontWeight: "700",
  },
  tdAmount: {
    fontSize: 12,
    fontWeight: "800",
    color: "#f8fafc",
    textAlign: "right",
  },
  profitHeader: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 6,
    marginTop: 8,
  },
  profitValText: {
    fontSize: 22,
    fontWeight: "800",
    color: "#f8fafc",
  },
  profitSubLabel: {
    fontSize: 10,
    color: "#94a3b8",
    fontWeight: "600",
  },
  profitBarsBox: {
    marginTop: 14,
  },
  donutContainer: {
    alignItems: "center",
    justifyContent: "center",
    marginVertical: 14,
    position: "relative",
  },
  donutTextOverlay: {
    position: "absolute",
    justifyContent: "center",
    alignItems: "center",
  },
  donutPercentageText: {
    fontSize: 16,
    fontWeight: "800",
    color: "#f8fafc",
  },
  budgetValueText: {
    fontSize: 22,
    fontWeight: "800",
    color: "#f8fafc",
    textAlign: "center",
  },
  budgetDescText: {
    fontSize: 9,
    color: "#94a3b8",
    fontWeight: "600",
    textAlign: "center",
    marginTop: 2,
  },
  budgetActionBtn: {
    marginTop: 12,
    backgroundColor: "#d946ef",
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: "center",
    width: "100%",
  },
  budgetActionText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "800",
  },
});
