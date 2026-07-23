import React, { useState, useEffect } from "react";
import { Platform, ViewStyle } from "react-native";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  StatusBar,
  TextInput,
} from "react-native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { authStore } from "../services/authStore";
import { fetchProductsByState } from "../services/productService";
import * as Location from "expo-location";
import { subscribeStates, subscribeCities, checkServiceAvailability, AdminState, AdminCity } from "../services/adminService";
import { Theme } from "../constants/theme";

export default function PermissionsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  // Onboarding Stage: 'notifications' | 'location' | 'manual_select' | 'manual_select_city' | 'empty_state' | 'error_state' | 'loading'
  const [stage, setStage] = useState<"notifications" | "location" | "manual_select" | "manual_select_city" | "empty_state" | "error_state" | "loading">("notifications");
  const [loadingMsg, setLoadingMsg] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [selectedState, setSelectedState] = useState<AdminState | null>(null);

  const [states, setStates] = useState<AdminState[]>([]);
  const [cities, setCities] = useState<AdminCity[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  useEffect(() => {
    const unsubStates = subscribeStates((statesData) => {
      setStates(statesData.filter(s => s.isActive));
    });
    const unsubCities = subscribeCities((citiesData) => {
      setCities(citiesData.filter(c => c.deliveryAvailable));
      setLoadingData(false);
    });
    return () => {
      unsubStates();
      unsubCities();
    };
  }, []);

  // Request notifications permission
  const handleRequestNotifications = async () => {
    setLoadingMsg("Enabling alerts...");
    setStage("loading");
    try {
      if (Platform.OS !== "web") {
        const Notifications = await import("expo-notifications");
        if (Platform.OS === "android" && Notifications.setNotificationChannelAsync) {
          const maxImportance = Notifications.AndroidImportance?.MAX ?? 5;
          await Notifications.setNotificationChannelAsync("default", {
            name: "default",
            importance: maxImportance,
            vibrationPattern: [0, 250, 250, 250],
            lightColor: Theme.colors.primary,
          });
        }

        const { status } = await Notifications.requestPermissionsAsync();
        const allowed = status === "granted";
        authStore.setNotificationsAllowed(allowed);
        console.log("Notification permission response:", status);
      } else {
        // Web: push notifications not supported - silently skip
        authStore.setNotificationsAllowed(false);
      }
    } catch (err) {
      console.warn("Notifications permission error:", err);
      authStore.setNotificationsAllowed(false);
    } finally {
      // Move to location stage
      setStage("location");
    }
  };

  const handleSkipNotifications = () => {
    authStore.setNotificationsAllowed(false);
    setStage("location");
  };

  // Request location permission
  const handleRequestLocation = async () => {
    setLoadingMsg("Detecting your location...");
    setStage("loading");
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        authStore.setLocationAllowed(false);
        setStage("manual_select");
        return;
      }

      authStore.setLocationAllowed(true);

      const locationResult = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      const { latitude, longitude } = locationResult.coords;
      console.log(`[Location] GPS coordinates captured: lat=${latitude}, lon=${longitude}`);

      let detectedState = "";
      let detectedCity = "";
      let fallbackStates: string[] = [];
      let fallbackCities: string[] = [];
      let resolvedAddress = "";
      let osmResponseRaw: any = null;
      let nativeGeocodeRaw: any = null;

      // 1. Try Nominatim Geocoding
      try {
        const response = await fetch(
          `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&accept-language=en`,
          { headers: { "User-Agent": "quickCart-App" } }
        );
        const data = await response.json();
        osmResponseRaw = data;
        if (data && data.address) {
          detectedState = data.address.state || data.address.region || data.address.state_district || "";
          
          // Order-based fallback: city -> district -> subregion -> region
          const cityVal = data.address.city || data.address.town || data.address.village || data.address.suburb || "";
          const districtVal = data.address.city_district || data.address.district || data.address.county || "";
          const subregionVal = data.address.subregion || data.address.neighbourhood || "";
          const regionVal = data.address.state_district || data.address.region || "";

          detectedCity = cityVal || districtVal || subregionVal || regionVal || "";

          fallbackStates = [data.address.region, data.address.state_district, data.address.county].filter(Boolean) as string[];
          fallbackCities = [data.address.city_district, data.address.district, data.address.subregion, data.address.county, data.address.municipality, data.address.neighbourhood].filter(Boolean) as string[];

          if (detectedState) {
            resolvedAddress = `${detectedCity ? detectedCity + ", " : ""}${detectedState}`;
          }
          console.log(`[Location] OSM Geocoding result - State: "${detectedState}", City: "${detectedCity}"`);
        }
      } catch (osmErr) {
        console.log("[Location] OSM Nominatim failed, trying native reverse geocode:", osmErr);
      }

      // 2. Try native reverseGeocodeAsync if Osm failed or incomplete
      if (!detectedState) {
        try {
          const nativeGeocode = await Location.reverseGeocodeAsync({ latitude, longitude });
          nativeGeocodeRaw = nativeGeocode;
          if (nativeGeocode && nativeGeocode.length > 0) {
            const addr = nativeGeocode[0];
            detectedState = addr.region || addr.subregion || "";
            
            // Order-based fallback: city -> district -> subregion -> region
            const cityVal = addr.city || "";
            const districtVal = addr.district || "";
            const subregionVal = addr.subregion || "";
            const regionVal = addr.region || "";

            detectedCity = cityVal || districtVal || subregionVal || regionVal || "";

            fallbackStates = [addr.subregion].filter(Boolean) as string[];
            fallbackCities = [addr.street, addr.name, addr.district, addr.subregion, addr.postalCode].filter(Boolean) as string[];

            if (detectedState) {
              resolvedAddress = `${detectedCity ? detectedCity + ", " : ""}${detectedState}`;
            }
            console.log(`[Location] Native Geocoding result - State: "${detectedState}", City: "${detectedCity}"`);
          }
        } catch (nativeErr) {
          console.error("[Location] Native geocode failed:", nativeErr);
        }
      }

      if (!detectedState) {
        console.log("[Location] No state detected. Switching to manual select.");
        setStage("manual_select");
        return;
      }

      // 3. Verify service availability using fuzzy matching
      setLoadingMsg("Checking service availability...");
      
      const rawCoords = { latitude, longitude };
      const rawResponse = osmResponseRaw || (nativeGeocodeRaw && nativeGeocodeRaw[0]) || null;

      const checkResult = await checkServiceAvailability(
        detectedState, 
        detectedCity, 
        fallbackStates, 
        fallbackCities, 
        rawCoords, 
        rawResponse
      );

      if (checkResult.available && checkResult.matchedState && checkResult.matchedCity) {
        console.log(`[Location] Service Available! State: "${checkResult.matchedState.stateName}", City: "${checkResult.matchedCity.cityName}"`);
        authStore.setCurrentAddress(resolvedAddress || `${checkResult.matchedCity.cityName}, ${checkResult.matchedState.stateName}`);
        authStore.setDetectedState(checkResult.matchedState.stateName);
        authStore.setCompletedPermissionFlow(true);
        router.replace("/home" as any);
      } else {
        console.log(`[Location] Service Unavailable: ${checkResult.reason}`);
        authStore.setDetectedState(detectedState);
        authStore.setCurrentAddress(resolvedAddress || `${detectedCity ? detectedCity + ", " : ""}${detectedState}`);
        setStage("empty_state");
      }

    } catch (err) {
      console.error("[Location] Geolocator flow exception:", err);
      setStage("manual_select");
    }
  };

  const handleManualStateSelect = (state: AdminState) => {
    setSelectedState(state);
    setSearchQuery("");
    setStage("manual_select_city");
  };

  const handleManualCitySelect = async (city: AdminCity, state: AdminState) => {
    setLoadingMsg(`Loading products for ${city.cityName}, ${state.stateName}...`);
    setStage("loading");
    try {
      authStore.setCurrentAddress(`${city.cityName}, ${state.stateName}`);
      authStore.setDetectedState(state.stateName);
      authStore.setCompletedPermissionFlow(true);
      router.replace("/home" as any);
    } catch (err: any) {
      console.error("[Location] Manual selection error:", err);
      setErrorMessage("Unable to connect to database. Please check your connection.");
      setStage("error_state");
    }
  };

  // Legacy loadProductsForState fallback stub
  const loadProductsForState = async (stateName: string) => {
    setLoadingMsg(`Loading fresh products for ${stateName}...`);
    setStage("loading");
    try {
      const data = await fetchProductsByState(stateName);
      if (data && data.length > 0) {
        authStore.setDetectedState(data[0].state);
        authStore.setCompletedPermissionFlow(true);
        router.replace("/home" as any);
      } else {
        authStore.setDetectedState(stateName);
        setStage("empty_state");
      }
    } catch (err: any) {
      console.error("Firestore fetch error:", err);
      setErrorMessage("Unable to connect to database. Please check your connection.");
      setStage("error_state");
    }
  };

  const filteredStates = states.filter((st) =>
    st.stateName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getFilteredCities = () => {
    if (!selectedState) return [];
    const stateCities = cities.filter((c) => c.stateId === selectedState.id);
    return stateCities.filter((c) =>
      c.cityName.toLowerCase().includes(searchQuery.toLowerCase())
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <StatusBar barStyle="dark-content" backgroundColor={Theme.colors.background} />

      {stage === "loading" && (
        <View style={styles.fullscreenContent}>
          <ActivityIndicator size="large" color={Theme.colors.primary} />
          <Text style={styles.loadingText}>{loadingMsg}</Text>
        </View>
      )}

      {stage === "notifications" && (
        <View style={styles.cardContainer}>
          <View style={styles.iconCircleWrapper}>
            <View style={[styles.iconCircle, { backgroundColor: "#FFFBEB" }]}>
              <Ionicons name="notifications" size={54} color="#EA580C" />
            </View>
          </View>
          <Text style={styles.title}>Enable Push Alerts</Text>
          <Text style={styles.desc}>
            Allow notifications to receive instant updates on your deliveries, hot discounts, and fresh grocery arrivals.
          </Text>
          <TouchableOpacity style={styles.primaryBtn} onPress={handleRequestNotifications} activeOpacity={0.9}>
            <Ionicons name="notifications-outline" size={20} color="#FFFFFF" style={styles.btnIcon} />
            <Text style={styles.primaryBtnText}>Enable Notifications</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.secondaryBtn} onPress={handleSkipNotifications} activeOpacity={0.8}>
            <Text style={styles.secondaryBtnText}>Later</Text>
          </TouchableOpacity>
        </View>
      )}

      {stage === "location" && (
        <View style={styles.cardContainer}>
          <View style={styles.iconCircleWrapper}>
            <View style={[styles.iconCircle, { backgroundColor: "#E8F5E9" }]}>
              <Ionicons name="location" size={54} color={Theme.colors.primary} />
            </View>
          </View>
          <Text style={styles.title}>Enable Location Access</Text>
          <Text style={styles.desc}>
            Share your location to find nearby stores, see delivery ETAs, and unlock local regional items.
          </Text>
          <TouchableOpacity style={styles.primaryBtn} onPress={handleRequestLocation} activeOpacity={0.9}>
            <Ionicons name="navigate" size={20} color="#FFFFFF" style={styles.btnIcon} />
            <Text style={styles.primaryBtnText}>Share Current Location</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.secondaryBtn} onPress={() => setStage("manual_select")} activeOpacity={0.8}>
            <Text style={styles.secondaryBtnText}>Select State Manually</Text>
          </TouchableOpacity>
        </View>
      )}

      {stage === "manual_select" && (
        <View style={styles.manualContainer}>
          <View style={styles.header}>
            <Text style={styles.manualTitle}>Select Delivery State</Text>
            <Text style={styles.manualDesc}>
              Location detection was unavailable. Please select your Indian state/region below to view local stock.
            </Text>
          </View>

          <View style={styles.searchBar}>
            <Ionicons name="search" size={18} color={Theme.colors.textLight} style={styles.searchIcon} />
            <TextInput
              placeholder="Search your state..."
              placeholderTextColor={Theme.colors.textLight}
              value={searchQuery}
              onChangeText={setSearchQuery}
              style={styles.searchInput}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery("")}>
                <Ionicons name="close-circle" size={18} color={Theme.colors.textLight} />
              </TouchableOpacity>
            )}
          </View>

          <ScrollView style={styles.stateList} showsVerticalScrollIndicator={false}>
            {filteredStates.length === 0 ? (
              <View style={styles.emptyList}>
                <Text style={styles.emptyListText}>No active states found matching &quot;{searchQuery}&quot;</Text>
              </View>
            ) : (
              filteredStates.map((st) => (
                <TouchableOpacity
                  key={st.id}
                  style={styles.stateRow}
                  onPress={() => handleManualStateSelect(st)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.stateRowText}>{st.stateName}</Text>
                  <Ionicons name="chevron-forward" size={18} color={Theme.colors.textLight} />
                </TouchableOpacity>
              ))
            )}
          </ScrollView>
        </View>
      )}

      {stage === "manual_select_city" && selectedState && (
        <View style={styles.manualContainer}>
          <View style={styles.header}>
            <TouchableOpacity onPress={() => { setStage("manual_select"); setSearchQuery(""); }} style={{ flexDirection: "row", alignItems: "center", marginBottom: 12 }}>
              <Ionicons name="arrow-back" size={18} color={Theme.colors.primary} style={{ marginRight: 4 }} />
              <Text style={{ color: Theme.colors.primary, fontWeight: "700" }}>Back to States</Text>
            </TouchableOpacity>
            <Text style={styles.manualTitle}>Select Delivery City</Text>
            <Text style={styles.manualDesc}>
              Select your city in {selectedState.stateName} to view local stock.
            </Text>
          </View>

          <View style={styles.searchBar}>
            <Ionicons name="search" size={18} color={Theme.colors.textLight} style={styles.searchIcon} />
            <TextInput
              placeholder="Search your city..."
              placeholderTextColor={Theme.colors.textLight}
              value={searchQuery}
              onChangeText={setSearchQuery}
              style={styles.searchInput}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery("")}>
                <Ionicons name="close-circle" size={18} color={Theme.colors.textLight} />
              </TouchableOpacity>
            )}
          </View>

          <ScrollView style={styles.stateList} showsVerticalScrollIndicator={false}>
            {getFilteredCities().length === 0 ? (
              <View style={styles.emptyList}>
                <Text style={styles.emptyListText}>No active cities found matching &quot;{searchQuery}&quot;</Text>
              </View>
            ) : (
              getFilteredCities().map((ct) => (
                <TouchableOpacity
                  key={ct.id}
                  style={styles.stateRow}
                  onPress={() => handleManualCitySelect(ct, selectedState)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.stateRowText}>{ct.cityName}</Text>
                  <Ionicons name="chevron-forward" size={18} color={Theme.colors.textLight} />
                </TouchableOpacity>
              ))
            )}
          </ScrollView>
        </View>
      )}

      {stage === "empty_state" && (
        <View style={styles.cardContainer}>
          <View style={styles.iconCircleWrapper}>
            <View style={[styles.iconCircle, { backgroundColor: "#FEE2E2" }]}>
              <MaterialCommunityIcons name="store-alert-outline" size={54} color={Theme.colors.error} />
            </View>
          </View>
          <Text style={styles.title}>Not Active Here Yet</Text>
          <Text style={styles.desc}>
            We haven&apos;t launched our delivery services in <Text style={styles.bold}>{authStore.getDetectedState()}</Text> yet. Try selecting one of our active states like {
              states.length > 0
                ? states.slice(0, 5).map(s => s.stateName).join(", ") + (states.length > 5 ? ", etc." : "")
                : "Delhi, Karnataka, Maharashtra, Uttar Pradesh"
            }.
          </Text>
          <TouchableOpacity style={styles.primaryBtn} onPress={() => setStage("manual_select")} activeOpacity={0.9}>
            <Text style={styles.primaryBtnText}>Select Supported State</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.secondaryBtn}
            onPress={handleRequestLocation}
            activeOpacity={0.8}
          >
            <Ionicons name="refresh" size={16} color={Theme.colors.textMedium} style={styles.btnIcon} />
            <Text style={styles.secondaryBtnText}>Retry Fetch</Text>
          </TouchableOpacity>
        </View>
      )}

      {stage === "error_state" && (
        <View style={styles.cardContainer}>
          <View style={styles.iconCircleWrapper}>
            <View style={[styles.iconCircle, { backgroundColor: "#FEE2E2" }]}>
              <Ionicons name="cloud-offline" size={54} color={Theme.colors.error} />
            </View>
          </View>
          <Text style={styles.title}>Connection Error</Text>
          <Text style={styles.desc}>{errorMessage}</Text>
          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={() => loadProductsForState(selectedState ? selectedState.stateName : "Default")}
            activeOpacity={0.9}
          >
            <Text style={styles.primaryBtnText}>Retry Connection</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.secondaryBtn} onPress={() => setStage("manual_select")} activeOpacity={0.8}>
            <Text style={styles.secondaryBtnText}>Back to State Selection</Text>
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
  fullscreenContent: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 30,
    gap: 16,
  },
  loadingText: {
    fontSize: 16,
    fontWeight: "700",
    color: Theme.colors.primaryDark,
    textAlign: "center",
  },
  cardContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 36,
  },
  iconCircleWrapper: {
    marginBottom: 32,
  },
  iconCircle: {
    width: 140,
    height: 140,
    borderRadius: 70,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: "#E2E8F0",
    ...Platform.select({
      web: { boxShadow: "0 4px 10px rgba(0,0,0,0.05)" } as ViewStyle,
      default: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.05,
        shadowRadius: 10,
        elevation: 2,
      },
    }),
  },
  title: {
    fontSize: 24,
    fontWeight: "900",
    color: Theme.colors.primaryDark,
    textAlign: "center",
    marginBottom: 12,
  },
  desc: {
    fontSize: 15,
    lineHeight: 22,
    color: Theme.colors.textMedium,
    textAlign: "center",
    marginBottom: 36,
  },
  bold: {
    fontWeight: "900",
    color: Theme.colors.primaryDark,
  },
  primaryBtn: {
    backgroundColor: Theme.colors.primary,
    flexDirection: "row",
    height: 52,
    width: "100%",
    borderRadius: 26,
    justifyContent: "center",
    alignItems: "center",
    ...Platform.select({
      web: { boxShadow: `0 6px 12px rgba(0,128,96,0.18)` } as ViewStyle,
      default: {
        shadowColor: Theme.colors.primary,
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.18,
        shadowRadius: 12,
        elevation: 3,
      },
    }),
    marginBottom: 12,
  },
  btnIcon: {
    marginRight: 8,
  },
  primaryBtnText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },
  secondaryBtn: {
    height: 52,
    width: "100%",
    borderRadius: 26,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: "#E2E8F0",
    backgroundColor: "#FFFFFF",
  },
  secondaryBtnText: {
    color: Theme.colors.textMedium,
    fontSize: 15,
    fontWeight: "700",
  },
  manualContainer: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 16,
  },
  header: {
    marginBottom: 20,
  },
  manualTitle: {
    fontSize: 22,
    fontWeight: "900",
    color: Theme.colors.primaryDark,
    marginBottom: 6,
  },
  manualDesc: {
    fontSize: 14,
    lineHeight: 20,
    color: Theme.colors.textMedium,
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Theme.colors.inputBg,
    borderRadius: 16,
    height: 50,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    marginBottom: 20,
  },
  searchIcon: {
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: Theme.colors.primaryDark,
  },
  stateList: {
    flex: 1,
  },
  stateRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  stateRowText: {
    fontSize: 16,
    fontWeight: "700",
    color: Theme.colors.primaryDark,
  },
  emptyList: {
    alignItems: "center",
    paddingVertical: 40,
  },
  emptyListText: {
    fontSize: 14,
    color: Theme.colors.textLight,
  },
});
