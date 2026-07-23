import React, { useEffect, useState } from "react";
import {
  Text,
  View,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  StatusBar,
  Alert,
  ActivityIndicator,
  SafeAreaView,
  TextInput,
  Switch,
  Platform,
  KeyboardAvoidingView,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Location from "expo-location";
import { authStore, Address } from "../services/authStore";
import { Theme, shadowStyle } from "../constants/theme";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// Safely load MapView to prevent Web crashes if react-native-maps isn't installed
let MapView: any = null;
let Marker: any = null;
try {
  const maps = require("react-native-maps");
  MapView = maps.default || maps.MapView;
  Marker = maps.Marker;
} catch (e) {
  console.warn("react-native-maps is not available.");
}

interface CustomInputProps {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  icon: keyof typeof Ionicons.glyphMap;
  placeholder?: string;
  keyboardType?: "default" | "numeric";
  maxLength?: number;
}

function CustomInput({
  label,
  value,
  onChangeText,
  icon,
  placeholder,
  keyboardType = "default",
  maxLength,
}: CustomInputProps) {
  return (
    <View style={styles.inputBox}>
      <Ionicons name={icon} size={20} color="#94A3B8" style={styles.inputIcon} />
      <View style={styles.inputContent}>
        <Text style={styles.inputLabel}>{label}</Text>
        <TextInput
          value={value || ""}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor="#94A3B8"
          keyboardType={keyboardType}
          maxLength={maxLength}
          style={styles.textInput}
        />
      </View>
    </View>
  );
}

export default function AddAddressScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { addressId } = useLocalSearchParams<{ addressId?: string }>();
  const isEdit = !!addressId;

  // Form Fields State (Defensively initialized to empty string)
  const [fullName, setFullName] = useState("");
  const [mobile, setMobile] = useState("");
  const [houseNo, setHouseNo] = useState("");
  const [building, setBuilding] = useState("");
  const [street, setStreet] = useState("");
  const [landmark, setLandmark] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [pinCode, setPinCode] = useState("");
  const [addressType, setAddressType] = useState<"Home" | "Work" | "Other">("Home");
  const [isDefault, setIsDefault] = useState(false);

  // Map / Location Coordinates State
  const [coords, setCoords] = useState<{ latitude: number; longitude: number } | null>(null);

  // UI Status State
  const [isLoading, setIsLoading] = useState(false);
  const [isDetecting, setIsDetecting] = useState(false);

  // Load existing address data in EDIT mode
  useEffect(() => {
    if (isEdit && addressId) {
      setIsLoading(true);
      const user = authStore.getCurrentUser();
      if (!user) {
        setIsLoading(false);
        return;
      }
      
      const loadAddressData = async () => {
        try {
          const unsubscribe = authStore.subscribeAddresses((list) => {
            const addr = list.find((a) => a.addressId === addressId);
            if (addr) {
              setFullName(addr.fullName || "");
              setMobile(addr.mobile || "");
              setHouseNo(addr.houseNo || "");
              setBuilding(addr.building || "");
              setStreet(addr.street || "");
              setLandmark(addr.landmark || "");
              setCity(addr.city || "");
              setState(addr.state || "");
              setPinCode(addr.pinCode || "");
              setAddressType(addr.addressType || "Home");
              setIsDefault(addr.isDefault || false);
              if (addr.latitude !== null && addr.latitude !== undefined && addr.longitude !== null && addr.longitude !== undefined) {
                setCoords({ 
                  latitude: Number(addr.latitude), 
                  longitude: Number(addr.longitude) 
                });
              }
            }
            setIsLoading(false);
            unsubscribe();
          });
        } catch (error) {
          console.error("Failed to load address for editing:", error);
          setIsLoading(false);
        }
      };
      loadAddressData();
    } else {
      // Default coordinates (e.g. Durg/Bhilai region in Chhattisgarh from user context)
      setCoords({ latitude: 21.1938, longitude: 81.3509 });
    }
  }, [addressId, isEdit]);

  // Trigger PIN code lookup when 6 digits are typed
  useEffect(() => {
    if ((pinCode || "").length === 6 && /^\d+$/.test(pinCode)) {
      const lookupPin = async () => {
        try {
          const response = await fetch(`https://api.postalpincode.in/pincode/${pinCode}`);
          const data = await response.json();
          if (data && data[0] && data[0].Status === "Success") {
            const postOffices = data[0].PostOffice;
            if (postOffices && postOffices.length > 0) {
              const detectedCity = postOffices[0].District || postOffices[0].Block || "";
              const detectedState = postOffices[0].State || "";
              if (detectedCity) setCity(detectedCity);
              if (detectedState) setState(detectedState);
            }
          }
        } catch (err) {
          console.warn("PIN Code lookup failed:", err);
        }
      };
      lookupPin();
    }
  }, [pinCode]);

  // Get current GPS location and Reverse-Geocode it
  const handleDetectLocation = async () => {
    setIsDetecting(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(
          "Permission Denied",
          "Please grant location permissions in your device settings to auto-detect your location."
        );
        setIsDetecting(false);
        return;
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      const { latitude, longitude } = location.coords;
      setCoords({ latitude, longitude });

      const geocoded = await Location.reverseGeocodeAsync({ latitude, longitude });
      if (geocoded && geocoded.length > 0) {
        const place = geocoded[0];
        
        // Populate form fields defensively
        if (place.name || place.district) {
          setStreet(place.name || place.district || "");
        }
        if (place.city || place.subregion) {
          setCity(place.city || place.subregion || "");
        }
        if (place.region) {
          setState(place.region);
        }
        if (place.postalCode) {
          setPinCode(place.postalCode);
        }
      }
      if (Platform.OS === "web") {
        window.alert("Location detected successfully!");
      }
    } catch (err: any) {
      Alert.alert("Location Error", "Could not capture your current location. Please fill form manually.");
      console.error(err);
    } finally {
      setIsDetecting(false);
    }
  };

  // Safe formatting helper to prevent `toFixed` crashes
  const getFormattedCoord = (val: any) => {
    if (val === null || val === undefined || isNaN(Number(val))) return "—";
    return Number(val).toFixed(4);
  };

  // Form Validation (Defensively coded against undefined variables)
  const isValid =
    (fullName || "").trim().length > 0 &&
    (mobile || "").trim().length === 10 &&
    /^\d+$/.test(mobile || "") &&
    (houseNo || "").trim().length > 0 &&
    (street || "").trim().length > 0 &&
    (city || "").trim().length > 0 &&
    (state || "").trim().length > 0 &&
    (pinCode || "").trim().length === 6 &&
    /^\d+$/.test(pinCode || "");

  // Submit Handler
  const handleSave = async () => {
    if (!isValid) return;

    setIsLoading(true);
    const addressPayload = {
      fullName: (fullName || "").trim(),
      mobile: (mobile || "").trim(),
      houseNo: (houseNo || "").trim(),
      building: (building || "").trim() || undefined,
      street: (street || "").trim(),
      landmark: (landmark || "").trim() || undefined,
      city: (city || "").trim(),
      state: (state || "").trim(),
      pinCode: (pinCode || "").trim(),
      addressType,
      latitude: coords ? coords.latitude : null,
      longitude: coords ? coords.longitude : null,
      isDefault,
    };

    try {
      if (isEdit && addressId) {
        await authStore.updateAddress(addressId, addressPayload);
        // Sync active address in store if editing current
        if (authStore.getSelectedAddressId() === addressId) {
          authStore.setSelectedAddress({ addressId, ...addressPayload } as Address);
        }
        if (Platform.OS === "web") {
          window.alert("Address updated successfully.");
        }
      } else {
        const newId = await authStore.addAddress(addressPayload);
        // Auto-select the newly added address
        authStore.setSelectedAddressId(newId);
        authStore.setSelectedAddress({ addressId: newId, ...addressPayload } as Address);
        if (Platform.OS === "web") {
          window.alert("Address saved successfully.");
        }
      }
      router.back();
    } catch (err: any) {
      Alert.alert("Error", err.message || "Failed to save address details.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      
      {/* Header */}
      <View style={[styles.header, { paddingTop: Platform.OS === "ios" ? 10 : insets.top + 10 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={24} color={Theme.colors.textDark} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{isEdit ? "Edit Address" : "Add Delivery Address"}</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Map selection area */}
        <View style={styles.mapContainer}>
          {MapView && Platform.OS !== "web" && coords ? (
            <MapView
              style={styles.map}
              initialRegion={{
                latitude: coords.latitude,
                longitude: coords.longitude,
                latitudeDelta: 0.005,
                longitudeDelta: 0.005,
              }}
              region={{
                latitude: coords.latitude,
                longitude: coords.longitude,
                latitudeDelta: 0.005,
                longitudeDelta: 0.005,
              }}
              onPress={(e: any) => {
                if (e.nativeEvent && e.nativeEvent.coordinate) {
                  setCoords(e.nativeEvent.coordinate);
                }
              }}
            >
              <Marker
                coordinate={coords}
                draggable
                onDragEnd={(e: any) => {
                  if (e.nativeEvent && e.nativeEvent.coordinate) {
                    setCoords(e.nativeEvent.coordinate);
                  }
                }}
              />
            </MapView>
          ) : (
            // Visual Map Placeholder
            <View style={styles.mockMap}>
              <View style={styles.mockMapOverlay}>
                <Ionicons name="location" size={42} color={Theme.colors.primary} style={styles.pulsePin} />
                <Text style={styles.mockMapCoords}>
                  Lat: {getFormattedCoord(coords?.latitude)}, Lng: {getFormattedCoord(coords?.longitude)}
                </Text>
              </View>
            </View>
          )}

          {/* Detect current location floating overlay button */}
          <TouchableOpacity
            style={styles.detectBtn}
            onPress={handleDetectLocation}
            disabled={isDetecting}
          >
            {isDetecting ? (
              <ActivityIndicator size="small" color={Theme.colors.primary} style={{ marginRight: 6 }} />
            ) : (
              <Ionicons name="navigate-outline" size={16} color={Theme.colors.primary} style={{ marginRight: 6 }} />
            )}
            <Text style={styles.detectBtnText}>
              {isDetecting ? "Locating..." : "Use current location"}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Address Form Container (Custom Draggable Bottom Sheet visual style) */}
        <View style={styles.formContainer}>
          <View style={styles.dragHandle} />
          <Text style={styles.formTitle}>Enter Address Details</Text>

          {/* Full Name */}
          <CustomInput
            label="Full Name (Required)"
            value={fullName}
            onChangeText={setFullName}
            icon="person-outline"
            placeholder="Receiver name"
          />

          {/* Mobile Number */}
          <CustomInput
            label="Mobile Number (Required)"
            value={mobile}
            onChangeText={setMobile}
            icon="call-outline"
            placeholder="10-digit mobile number"
            keyboardType="numeric"
            maxLength={10}
          />

          {/* House / Flat No. */}
          <CustomInput
            label="House / Flat No. (Required)"
            value={houseNo}
            onChangeText={setHouseNo}
            icon="home-outline"
            placeholder="Flat/house/apartment number"
          />

          {/* Building / Apartment */}
          <CustomInput
            label="Building / Apartment (Optional)"
            value={building}
            onChangeText={setBuilding}
            icon="business-outline"
            placeholder="Building/apartment/society name"
          />

          {/* Street / Road */}
          <CustomInput
            label="Street / Road (Required)"
            value={street}
            onChangeText={setStreet}
            icon="compass-outline"
            placeholder="Street address, road or locality"
          />

          {/* Landmark */}
          <CustomInput
            label="Landmark (Optional)"
            value={landmark}
            onChangeText={setLandmark}
            icon="flag-outline"
            placeholder="E.g. Near main market, school etc."
          />

          {/* City & State Row */}
          <View style={styles.row}>
            <View style={styles.flexField}>
              <CustomInput
                label="City (Required)"
                value={city}
                onChangeText={setCity}
                icon="business-outline"
                placeholder="City"
              />
            </View>
            <View style={[styles.flexField, { marginLeft: 12 }]}>
              <CustomInput
                label="State (Required)"
                value={state}
                onChangeText={setState}
                icon="map-outline"
                placeholder="State"
              />
            </View>
          </View>

          {/* PIN Code */}
          <CustomInput
            label="PIN Code (Required)"
            value={pinCode}
            onChangeText={setPinCode}
            icon="location-outline"
            placeholder="6-digit postal code"
            keyboardType="numeric"
            maxLength={6}
          />

          {/* Address Type Selector */}
          <Text style={styles.sectionLabel}>Save Address As</Text>
          <View style={styles.typeSelector}>
            {(["Home", "Work", "Other"] as const).map((type) => {
              const isSelected = addressType === type;
              return (
                <TouchableOpacity
                  key={type}
                  style={[
                    styles.typeBtn,
                    isSelected && styles.selectedTypeBtn,
                  ]}
                  onPress={() => setAddressType(type)}
                >
                  <Ionicons
                    name={
                      type === "Home"
                        ? "home-outline"
                        : type === "Work"
                        ? "briefcase-outline"
                        : "location-outline"
                    }
                    size={16}
                    color={isSelected ? "#FFFFFF" : Theme.colors.textMedium}
                  />
                  <Text style={[styles.typeBtnText, isSelected && styles.selectedTypeBtnText]}>
                    {type}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Default Address Toggle */}
          <View style={styles.defaultToggle}>
            <View style={{ flex: 1 }}>
              <Text style={styles.toggleTitle}>Set as Default Delivery Address</Text>
              <Text style={styles.toggleDesc}>
                Always select this address automatically during checkout.
              </Text>
            </View>
            <Switch
              value={isDefault}
              onValueChange={setIsDefault}
              trackColor={{ false: "#E2E8F0", true: `${Theme.colors.primary}50` }}
              thumbColor={isDefault ? Theme.colors.primary : "#94A3B8"}
            />
          </View>

          {/* Save Button */}
          {isLoading ? (
            <ActivityIndicator size="large" color={Theme.colors.primary} style={{ marginTop: 20 }} />
          ) : (
            <TouchableOpacity
              style={[styles.saveBtn, !isValid && styles.disabledSaveBtn]}
              disabled={!isValid}
              onPress={handleSave}
            >
              <Text style={styles.saveBtnText}>{isEdit ? "Update Address" : "Save Address"}</Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 16,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderColor: "#E2E8F0",
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F1F5F9",
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: Theme.colors.textDark,
  },
  headerSpacer: {
    width: 36,
  },
  scrollContent: {
    flexGrow: 1,
  },
  mapContainer: {
    height: 200,
    width: "100%",
    backgroundColor: "#E2E8F0",
    position: "relative",
  },
  map: {
    ...StyleSheet.absoluteFillObject,
  },
  mockMap: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
    borderBottomWidth: 1,
    borderColor: "#E2E8F0",
  },
  mockMapOverlay: {
    alignItems: "center",
    justifyContent: "center",
  },
  pulsePin: {
    marginBottom: 8,
  },
  mockMapCoords: {
    fontSize: 11,
    fontWeight: "600",
    color: Theme.colors.textLight,
  },
  detectBtn: {
    position: "absolute",
    bottom: 12,
    right: 12,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    ...shadowStyle("#0F172A", 4, 0.08, 6, 2),
  },
  detectBtnText: {
    fontSize: 12,
    fontWeight: "700",
    color: Theme.colors.primary,
  },
  formContainer: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 40,
    marginTop: -16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    ...shadowStyle("#0F172A", 12, 0.05, 12, 3),
  },
  dragHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#CBD5E1",
    alignSelf: "center",
    marginBottom: 16,
  },
  formTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: Theme.colors.textDark,
    marginBottom: 18,
  },
  row: {
    flexDirection: "row",
  },
  flexField: {
    flex: 1,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: "800",
    color: Theme.colors.textDark,
    marginBottom: 12,
    marginTop: 8,
  },
  inputBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F8FAFC",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginBottom: 14,
  },
  inputIcon: {
    marginRight: 12,
  },
  inputContent: {
    flex: 1,
  },
  inputLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: "#94A3B8",
    marginBottom: 2,
  },
  textInput: {
    fontSize: 14,
    fontWeight: "600",
    color: "#0F172A",
    padding: 0,
    margin: 0,
  },
  typeSelector: {
    flexDirection: "row",
    marginBottom: 20,
    gap: 12,
  },
  typeBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    height: 40,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    backgroundColor: "#FFFFFF",
  },
  selectedTypeBtn: {
    backgroundColor: Theme.colors.primary,
    borderColor: Theme.colors.primary,
  },
  typeBtnText: {
    fontSize: 12,
    fontWeight: "700",
    color: Theme.colors.textMedium,
    marginLeft: 6,
  },
  selectedTypeBtnText: {
    color: "#FFFFFF",
  },
  defaultToggle: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F8FAFC",
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    marginBottom: 24,
  },
  toggleTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: Theme.colors.textDark,
  },
  toggleDesc: {
    fontSize: 11,
    color: Theme.colors.textMedium,
    marginTop: 2,
  },
  saveBtn: {
    backgroundColor: Theme.colors.primary,
    height: 48,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    ...shadowStyle("#2a5d4c", 4, 0.2, 8, 3),
  },
  disabledSaveBtn: {
    backgroundColor: "#CBD5E1",
    shadowColor: "transparent",
    elevation: 0,
  },
  saveBtnText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
  },
});
