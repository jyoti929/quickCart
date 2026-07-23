import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  Modal,
  ActivityIndicator,
  Alert,
  Platform,
  StatusBar,
  KeyboardAvoidingView,
  ScrollView,
  Switch,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Theme } from "../../constants/theme";
import AdminDrawer from "../../components/AdminDrawer";
import {
  getStates,
  subscribeStates,
  addState,
  updateState,
  deleteState,
  AdminState,
  getCities,
  subscribeCities,
  addCity,
  updateCity,
  deleteCity,
  AdminCity,
} from "../../services/adminService";

export default function AdminStatesAndCities() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"All" | "Active" | "Inactive">("All");
  
  const [states, setStates] = useState<AdminState[]>([]);
  const [cities, setCities] = useState<AdminCity[]>([]);
  const [expandedStates, setExpandedStates] = useState<{ [stateId: string]: boolean }>({});
  
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Modals
  const [stateModalVisible, setStateModalVisible] = useState(false);
  const [cityModalVisible, setCityModalVisible] = useState(false);
  const [showStateDropdown, setShowStateDropdown] = useState(false);

  // Edit targets
  const [editingStateId, setEditingStateId] = useState<string | null>(null);
  const [editingCityId, setEditingCityId] = useState<string | null>(null);

  // Forms
  const [stateForm, setStateForm] = useState({ stateName: "", isActive: true });
  const [cityForm, setCityForm] = useState({ cityName: "", stateId: "", deliveryAvailable: true });
  const [formError, setFormError] = useState("");

  useEffect(() => {
    setLoading(true);
    const unsubStates = subscribeStates((statesData) => {
      setStates(statesData);
      setLoading(false);
    });
    const unsubCities = subscribeCities((citiesData) => {
      setCities(citiesData);
    });
    return () => {
      unsubStates();
      unsubCities();
    };
  }, []);

  // Auto-expand states that contain search matches
  useEffect(() => {
    if (search.trim()) {
      const q = search.toLowerCase();
      const newExpanded: { [stateId: string]: boolean } = {};
      states.forEach((s) => {
        const hasMatchingCity = cities.some(
          (c) => c.stateId === s.id && c.cityName.toLowerCase().includes(q)
        );
        if (hasMatchingCity) {
          newExpanded[s.id] = true;
        }
      });
      setExpandedStates((prev) => ({ ...prev, ...newExpanded }));
    }
  }, [search, states, cities]);

  const getFilteredStates = () => {
    let result = states;

    if (activeTab === "Active") {
      result = result.filter((s) => s.isActive);
    } else if (activeTab === "Inactive") {
      result = result.filter((s) => !s.isActive);
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter((s) => {
        const stateMatch = s.stateName.toLowerCase().includes(q);
        const cityMatch = cities.some(
          (c) => c.stateId === s.id && c.cityName.toLowerCase().includes(q)
        );
        return stateMatch || cityMatch;
      });
    }

    return result.sort((a, b) => a.stateName.localeCompare(b.stateName));
  };

  const openAddState = () => {
    setEditingStateId(null);
    setStateForm({ stateName: "", isActive: true });
    setFormError("");
    setStateModalVisible(true);
  };

  const openAddCityGlobal = () => {
    setEditingCityId(null);
    setCityForm({ cityName: "", stateId: states[0]?.id || "", deliveryAvailable: true });
    setFormError("");
    setCityModalVisible(true);
  };

  const handleSaveState = async () => {
    if (!stateForm.stateName.trim()) {
      setFormError("State name is required.");
      return;
    }
    setSaving(true);
    setFormError("");
    try {
      if (editingStateId) {
        await updateState(editingStateId, {
          stateName: stateForm.stateName.trim(),
          isActive: stateForm.isActive,
        });
        setSuccess("State updated.");
      } else {
        await addState({
          stateName: stateForm.stateName.trim(),
          isActive: stateForm.isActive,
        });
        setSuccess("State added.");
      }
      setStateModalVisible(false);
      setTimeout(() => setSuccess(""), 3000);
    } catch (e: any) {
      setFormError(e.message || "Failed to save state.");
    } finally {
      setSaving(false);
    }
  };

  const handleSaveCity = async () => {
    if (!cityForm.cityName.trim()) {
      setFormError("City name is required.");
      return;
    }
    if (!cityForm.stateId) {
      setFormError("State is required.");
      return;
    }
    setSaving(true);
    setFormError("");
    try {
      const parentState = states.find((s) => s.id === cityForm.stateId);
      const stateName = parentState ? parentState.stateName : "";

      if (editingCityId) {
        await updateCity(editingCityId, {
          cityName: cityForm.cityName.trim(),
          stateId: cityForm.stateId,
          state: stateName,
          deliveryAvailable: cityForm.deliveryAvailable,
        });
        setSuccess("City updated.");
      } else {
        await addCity({
          cityName: cityForm.cityName.trim(),
          stateId: cityForm.stateId,
          state: stateName,
          deliveryAvailable: cityForm.deliveryAvailable,
        });
        setSuccess("City added.");
      }
      setCityModalVisible(false);
      setTimeout(() => setSuccess(""), 3000);
    } catch (e: any) {
      setFormError(e.message || "Failed to save city.");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteState = (state: AdminState) => {
    const stateCities = cities.filter((c) => c.stateId === state.id);
    const hasCities = stateCities.length > 0;

    const doDelete = async () => {
      try {
        await deleteState(state.id);
        setSuccess("State deleted.");
        setTimeout(() => setSuccess(""), 3000);
      } catch (e: any) {
        setError(e.message || "Failed to delete.");
      }
    };

    const message = hasCities
      ? `State "${state.stateName}" contains ${stateCities.length} nested cities. Deleting this state will leave them orphaned. Delete anyway?`
      : `Delete state "${state.stateName}"?`;

    if (Platform.OS === "web") {
      if (window.confirm(message)) doDelete();
    } else {
      Alert.alert("Delete State", message, [
        { text: "Cancel", style: "cancel" },
        { text: "Delete", style: "destructive", onPress: doDelete },
      ]);
    }
  };

  const handleDeleteCity = (city: AdminCity) => {
    const doDelete = async () => {
      try {
        await deleteCity(city.id);
        setSuccess("City deleted.");
        setTimeout(() => setSuccess(""), 3000);
      } catch (e: any) {
        setError(e.message || "Failed to delete.");
      }
    };
    if (Platform.OS === "web") {
      if (window.confirm(`Delete "${city.cityName}"?`)) doDelete();
    } else {
      Alert.alert("Delete City", `Delete "${city.cityName}"?`, [
        { text: "Cancel", style: "cancel" },
        { text: "Delete", style: "destructive", onPress: doDelete },
      ]);
    }
  };

  const renderStateCard = ({ item: state }: { item: AdminState }) => {
    const isExpanded = !!expandedStates[state.id];
    const stateCities = cities.filter((c) => c.stateId === state.id);
    const activeCitiesCount = stateCities.filter((c) => c.deliveryAvailable).length;
    const q = search.toLowerCase();

    // Filter cities under state if searching
    const displayedCities = search.trim()
      ? stateCities.filter(
          (c) =>
            c.cityName.toLowerCase().includes(q) || state.stateName.toLowerCase().includes(q)
        )
      : stateCities;

    return (
      <View style={[styles.stateCard, !state.isActive && styles.inactiveCardBg]}>
        {/* Header containing clickable area and controls */}
        <View style={styles.stateCardHeader}>
          {/* Clickable Title Area to Expand/Collapse */}
          <TouchableOpacity
            style={styles.stateClickableArea}
            onPress={() => setExpandedStates((prev) => ({ ...prev, [state.id]: !isExpanded }))}
            activeOpacity={0.7}
          >
            <View style={styles.stateInfoCol}>
              <View style={styles.stateTitleRow}>
                <Text style={[styles.stateNameText, !state.isActive && styles.mutedText]}>
                  {state.stateName}
                </Text>
                {!state.isActive && (
                  <View style={styles.inactiveBadge}>
                    <Text style={styles.inactiveBadgeText}>Inactive</Text>
                  </View>
                )}
              </View>
              <Text style={styles.citiesCountText}>
                {stateCities.length} cities ({activeCitiesCount} active)
              </Text>
            </View>
          </TouchableOpacity>

          {/* Controls Area */}
          <View style={styles.stateControlsRow}>
            {/* Active Switch */}
            <View style={styles.switchCol}>
              <Switch
                value={state.isActive}
                onValueChange={async (newValue) => {
                  try {
                    await updateState(state.id, { isActive: newValue });
                  } catch (e: any) {
                    Alert.alert("Error", e.message || "Failed to update state status.");
                  }
                }}
                trackColor={{ false: "#cbd5e1", true: "#bbf7d0" }}
                thumbColor={state.isActive ? Theme.colors.primary : "#94a3b8"}
                style={Platform.OS === "ios" ? { transform: [{ scaleX: 0.75 }, { scaleY: 0.75 }] } : undefined}
              />
              <Text style={[styles.switchLabelText, { color: state.isActive ? "#10b981" : "#ef4444" }]}>
                {state.isActive ? "Active" : "Inactive"}
              </Text>
            </View>

            {/* Actions */}
            <TouchableOpacity
              style={[styles.actionBtn, styles.editBtn]}
              onPress={() => {
                setEditingStateId(state.id);
                setStateForm({ stateName: state.stateName, isActive: state.isActive });
                setFormError("");
                setStateModalVisible(true);
              }}
              activeOpacity={0.7}
            >
              <Ionicons name="pencil" size={13} color={Theme.colors.primary} />
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionBtn, styles.deleteBtn]}
              onPress={() => handleDeleteState(state)}
              activeOpacity={0.7}
            >
              <Ionicons name="trash" size={13} color="#ef4444" />
            </TouchableOpacity>

            {/* Expand arrow */}
            <TouchableOpacity
              onPress={() => setExpandedStates((prev) => ({ ...prev, [state.id]: !isExpanded }))}
              activeOpacity={0.7}
              style={{ padding: 4 }}
            >
              <Ionicons
                name={isExpanded ? "chevron-up" : "chevron-down"}
                size={18}
                color="#64748b"
              />
            </TouchableOpacity>
          </View>
        </View>

        {/* Nested Cities List */}
        {isExpanded && (
          <View style={styles.citiesSection}>
            {displayedCities.length === 0 ? (
              <View style={styles.emptyCitiesContainer}>
                <Ionicons name="location-outline" size={24} color="#94a3b8" />
                <Text style={styles.noCitiesText}>No cities added in this state.</Text>
              </View>
            ) : (
              displayedCities.map((city) => (
                <View key={city.id} style={[styles.cityRow, !city.deliveryAvailable && styles.inactiveCityBg]}>
                  <View style={styles.cityInfo}>
                    <Text style={[styles.cityNameText, !city.deliveryAvailable && styles.mutedText]}>
                      {city.cityName}
                    </Text>
                  </View>

                  <View style={styles.cityControls}>
                    {/* Active Switch */}
                    <View style={styles.switchCol}>
                      <Switch
                        value={city.deliveryAvailable}
                        onValueChange={async (newValue) => {
                          try {
                            await updateCity(city.id, { deliveryAvailable: newValue });
                          } catch (e: any) {
                            Alert.alert("Error", e.message || "Failed to update city status.");
                          }
                        }}
                        trackColor={{ false: "#cbd5e1", true: "#bbf7d0" }}
                        thumbColor={city.deliveryAvailable ? Theme.colors.primary : "#94a3b8"}
                        style={Platform.OS === "ios" ? { transform: [{ scaleX: 0.7 }, { scaleY: 0.7 }] } : undefined}
                      />
                      <Text style={[styles.switchLabelText, { color: city.deliveryAvailable ? "#10b981" : "#ef4444" }]}>
                        {city.deliveryAvailable ? "Active" : "Inactive"}
                      </Text>
                    </View>

                    {/* Actions */}
                    <TouchableOpacity
                      style={[styles.actionBtn, styles.editBtn, { width: 28, height: 28 }]}
                      onPress={() => {
                        setEditingCityId(city.id);
                        setCityForm({
                          cityName: city.cityName,
                          stateId: city.stateId,
                          deliveryAvailable: city.deliveryAvailable,
                        });
                        setFormError("");
                        setCityModalVisible(true);
                      }}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="pencil" size={11} color={Theme.colors.primary} />
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.actionBtn, styles.deleteBtn, { width: 28, height: 28 }]}
                      onPress={() => handleDeleteCity(city)}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="trash" size={11} color="#ef4444" />
                    </TouchableOpacity>
                  </View>
                </View>
              ))
            )}

            {/* Quick Add City inside State */}
            <TouchableOpacity
              style={styles.quickAddCityBtn}
              onPress={() => {
                setEditingCityId(null);
                setCityForm({ cityName: "", stateId: state.id, deliveryAvailable: true });
                setFormError("");
                setCityModalVisible(true);
              }}
              activeOpacity={0.7}
            >
              <Ionicons name="add-circle-outline" size={16} color={Theme.colors.primary} />
              <Text style={styles.quickAddCityBtnText}>Add City to {state.stateName}</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  const filteredStatesList = getFilteredStates();

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
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>State & City Management</Text>
        <View style={{ flexDirection: "row", gap: 6 }}>
          <TouchableOpacity style={styles.menuBtn} onPress={openAddState} activeOpacity={0.7}>
            <Ionicons name="map-outline" size={18} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.menuBtn} onPress={openAddCityGlobal} activeOpacity={0.7}>
            <Ionicons name="add" size={22} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Messages */}
      {error || success ? (
        <View style={[styles.msgBar, success ? styles.successBar : styles.errorBar]}>
          <Ionicons
            name={success ? "checkmark-circle" : "alert-circle"}
            size={16}
            color={success ? "#10b981" : "#ef4444"}
          />
          <Text style={[styles.msgText, { color: success ? "#10b981" : "#ef4444" }]}>
            {success || error}
          </Text>
        </View>
      ) : null}

      {/* Search Box */}
      <View style={styles.searchBox}>
        <Ionicons name="search-outline" size={18} color="#94a3b8" />
        <TextInput
          style={[styles.searchInput, { outlineStyle: "none" } as any]}
          placeholder="Search states or cities..."
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

      {/* Tabs */}
      <View style={styles.tabsContainer}>
        {(["All", "Active", "Inactive"] as const).map((tab) => {
          const isActive = activeTab === tab;
          let count = 0;
          if (tab === "All") count = states.length;
          else if (tab === "Active") count = states.filter((s) => s.isActive).length;
          else if (tab === "Inactive") count = states.filter((s) => !s.isActive).length;

          return (
            <TouchableOpacity
              key={tab}
              style={[styles.tabButton, isActive && styles.tabButtonActive]}
              onPress={() => setActiveTab(tab)}
              activeOpacity={0.75}
            >
              <Text style={[styles.tabButtonText, isActive && styles.tabButtonTextActive]}>
                {tab === "All" ? "All States" : tab === "Active" ? "Active States" : "Inactive"} ({count})
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* List */}
      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={Theme.colors.primary} />
        </View>
      ) : filteredStatesList.length === 0 ? (
        <View style={styles.centered}>
          <Ionicons name="map-outline" size={48} color="#cbd5e1" />
          <Text style={styles.emptyTitle}>No States Found</Text>
          <Text style={styles.emptySubtitle}>
            {search ? "Try a different search query." : "Tap the map icon to add a new State."}
          </Text>
          {!search && (
            <TouchableOpacity style={styles.addEmptyBtn} onPress={openAddState}>
              <Text style={styles.addEmptyText}>Add State</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <FlatList
          data={filteredStatesList}
          renderItem={renderStateCard}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* ─── State Modal ─── */}
      <Modal visible={stateModalVisible} transparent animationType="slide" onRequestClose={() => setStateModalVisible(false)}>
        <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{editingStateId ? "Edit State" : "Add State"}</Text>
              <TouchableOpacity onPress={() => setStateModalVisible(false)}>
                <Ionicons name="close" size={22} color={Theme.colors.primaryDark} />
              </TouchableOpacity>
            </View>

            {formError ? (
              <View style={styles.formError}>
                <Ionicons name="alert-circle" size={15} color="#ef4444" />
                <Text style={styles.formErrorText}>{formError}</Text>
              </View>
            ) : null}

            <Text style={styles.fieldLabel}>State Name *</Text>
            <TextInput
              style={styles.textInput}
              placeholder="e.g. Chhattisgarh"
              placeholderTextColor="#94a3b8"
              value={stateForm.stateName}
              onChangeText={(v) => {
                setStateForm((f) => ({ ...f, stateName: v }));
                setFormError("");
              }}
            />

            <View style={styles.toggleRow}>
              <Text style={styles.fieldLabel}>Active (Enable Services)</Text>
              <Switch
                value={stateForm.isActive}
                onValueChange={(v) => setStateForm((f) => ({ ...f, isActive: v }))}
                trackColor={{ false: "#e2e8f0", true: "#bbf7d0" }}
                thumbColor={stateForm.isActive ? Theme.colors.primary : "#94a3b8"}
              />
            </View>

            <TouchableOpacity
              style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
              onPress={handleSaveState}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.saveBtnText}>{editingStateId ? "Update State" : "Add State"}</Text>
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ─── City Modal ─── */}
      <Modal visible={cityModalVisible} transparent animationType="slide" onRequestClose={() => setCityModalVisible(false)}>
        <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{editingCityId ? "Edit City" : "Add City"}</Text>
              <TouchableOpacity onPress={() => setCityModalVisible(false)}>
                <Ionicons name="close" size={22} color={Theme.colors.primaryDark} />
              </TouchableOpacity>
            </View>

            {formError ? (
              <View style={styles.formError}>
                <Ionicons name="alert-circle" size={15} color="#ef4444" />
                <Text style={styles.formErrorText}>{formError}</Text>
              </View>
            ) : null}

            <Text style={styles.fieldLabel}>City Name *</Text>
            <TextInput
              style={styles.textInput}
              placeholder="e.g. Raipur"
              placeholderTextColor="#94a3b8"
              value={cityForm.cityName}
              onChangeText={(v) => {
                setCityForm((f) => ({ ...f, cityName: v }));
                setFormError("");
              }}
            />

            <Text style={styles.fieldLabel}>Parent State *</Text>
            <TouchableOpacity
              style={[styles.textInput, styles.stateSelect]}
              onPress={() => setShowStateDropdown(true)}
            >
              <Text style={{ color: cityForm.stateId ? Theme.colors.textDark : "#94a3b8", fontSize: 15 }}>
                {states.find((s) => s.id === cityForm.stateId)?.stateName || "Select state..."}
              </Text>
              <Ionicons name="chevron-down" size={16} color="#94a3b8" />
            </TouchableOpacity>

            <View style={styles.toggleRow}>
              <Text style={styles.fieldLabel}>Delivery Available (Active)</Text>
              <Switch
                value={cityForm.deliveryAvailable}
                onValueChange={(v) => setCityForm((f) => ({ ...f, deliveryAvailable: v }))}
                trackColor={{ false: "#e2e8f0", true: "#bbf7d0" }}
                thumbColor={cityForm.deliveryAvailable ? Theme.colors.primary : "#94a3b8"}
              />
            </View>

            <TouchableOpacity
              style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
              onPress={handleSaveCity}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.saveBtnText}>{editingCityId ? "Update City" : "Add City"}</Text>
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ─── State Dropdown Picker Modal ─── */}
      <Modal visible={showStateDropdown} transparent animationType="fade" onRequestClose={() => setShowStateDropdown(false)}>
        <TouchableOpacity
          style={styles.modalOverlay}
          onPress={() => setShowStateDropdown(false)}
          activeOpacity={1}
        >
          <View style={[styles.modalSheet, { maxHeight: "60%" }]}>
            <View style={[styles.modalHeader, { marginBottom: 12 }]}>
              <Text style={styles.modalTitle}>Select State</Text>
              <TouchableOpacity onPress={() => setShowStateDropdown(false)}>
                <Ionicons name="close" size={20} color="#64748b" />
              </TouchableOpacity>
            </View>
            <ScrollView>
              {states
                .sort((a, b) => a.stateName.localeCompare(b.stateName))
                .map((s) => (
                  <TouchableOpacity
                    key={s.id}
                    style={[styles.stateOption, cityForm.stateId === s.id && styles.stateOptionActive]}
                    onPress={() => {
                      setCityForm((f) => ({ ...f, stateId: s.id }));
                      setShowStateDropdown(false);
                      setFormError("");
                    }}
                  >
                    <Text
                      style={[
                        styles.stateOptionText,
                        cityForm.stateId === s.id && { color: Theme.colors.primary, fontWeight: "700" },
                      ]}
                    >
                      {s.stateName}
                    </Text>
                    {cityForm.stateId === s.id && (
                      <Ionicons name="checkmark" size={16} color={Theme.colors.primary} />
                    )}
                  </TouchableOpacity>
                ))}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8fafc" },
  header: {
    backgroundColor: Theme.colors.primary,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 14,
    gap: 10,
  },
  menuBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.15)",
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitle: { flex: 1, fontSize: 16, fontWeight: "800", color: "#fff", textAlign: "center" },
  msgBar: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 10, gap: 8 },
  successBar: { backgroundColor: "#ecfdf5" },
  errorBar: { backgroundColor: "#fef2f2" },
  msgText: { fontSize: 13, fontWeight: "600", flex: 1 },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 8,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 10,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  searchInput: { flex: 1, fontSize: 14, color: Theme.colors.textDark },
  centered: { flex: 1, justifyContent: "center", alignItems: "center", gap: 10 },
  emptyTitle: { fontSize: 16, fontWeight: "700", color: Theme.colors.primaryDark },
  emptySubtitle: { fontSize: 13, color: "#64748b", textAlign: "center" },
  addEmptyBtn: { marginTop: 8, backgroundColor: Theme.colors.primary, paddingHorizontal: 24, paddingVertical: 10, borderRadius: 10 },
  addEmptyText: { color: "#fff", fontWeight: "700" },
  list: { padding: 16, gap: 12, paddingBottom: 40 },
  
  // State Card Styles
  stateCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    overflow: "hidden",
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  inactiveCardBg: {
    backgroundColor: "#f8fafc",
    borderColor: "#cbd5e1",
  },
  stateCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    gap: 12,
  },
  stateClickableArea: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
  },
  stateInfoCol: { flex: 1 },
  stateTitleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  stateNameText: { fontSize: 15, fontWeight: "800", color: Theme.colors.primaryDark },
  citiesCountText: { fontSize: 12, color: "#64748b", marginTop: 3 },
  stateControlsRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  
  // Switch Col
  switchCol: { alignItems: "center", gap: 1 },
  switchLabelText: { fontSize: 8, fontWeight: "700", marginTop: -2 },
  
  // Action Buttons
  actionBtn: {
    width: 32,
    height: 32,
    borderRadius: 9,
    justifyContent: "center",
    alignItems: "center",
  },
  editBtn: { backgroundColor: "#f0fdf4" },
  deleteBtn: { backgroundColor: "#fef2f2" },
  
  // Cities section inside Card
  citiesSection: {
    backgroundColor: "#f8fafc",
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  cityRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },
  inactiveCityBg: {
    opacity: 0.65,
  },
  cityInfo: { flex: 1 },
  cityNameText: { fontSize: 14, fontWeight: "600", color: "#334155" },
  cityControls: { flexDirection: "row", alignItems: "center", gap: 10 },
  quickAddCityBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    marginTop: 8,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: Theme.colors.primary,
    borderRadius: 10,
    backgroundColor: "#fff",
  },
  quickAddCityBtnText: {
    fontSize: 13,
    fontWeight: "700",
    color: Theme.colors.primary,
  },
  emptyCitiesContainer: {
    alignItems: "center",
    paddingVertical: 16,
    gap: 4,
  },
  noCitiesText: { fontSize: 12, color: "#64748b" },
  
  // Badge
  inactiveBadge: {
    backgroundColor: "#fee2e2",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  inactiveBadgeText: { fontSize: 9, fontWeight: "700", color: "#ef4444" },
  mutedText: { color: "#94a3b8" },

  // Tabs
  tabsContainer: {
    flexDirection: "row",
    backgroundColor: "#e2e8f0",
    marginHorizontal: 16,
    marginBottom: 10,
    borderRadius: 12,
    padding: 3,
    gap: 4,
  },
  tabButton: { flex: 1, paddingVertical: 10, alignItems: "center", borderRadius: 9 },
  tabButtonActive: {
    backgroundColor: "#fff",
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 1,
  },
  tabButtonText: { fontSize: 12, fontWeight: "700", color: "#64748b" },
  tabButtonTextActive: { color: Theme.colors.primaryDark },

  // Modals Overlay and Sheets
  modalOverlay: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.4)" },
  modalSheet: { backgroundColor: "#fff", borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, maxHeight: "90%" },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 20 },
  modalTitle: { fontSize: 18, fontWeight: "800", color: Theme.colors.primaryDark },
  formError: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fef2f2",
    borderRadius: 10,
    padding: 10,
    marginBottom: 14,
    gap: 8,
  },
  formErrorText: { color: "#ef4444", fontSize: 13, fontWeight: "600", flex: 1 },
  fieldLabel: { fontSize: 12, fontWeight: "700", color: "#64748b", marginBottom: 8, marginTop: 12 },
  textInput: {
    backgroundColor: "#f8fafc",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: Theme.colors.textDark,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  stateSelect: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  toggleRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 16 },
  saveBtn: { backgroundColor: Theme.colors.primary, height: 50, borderRadius: 14, justifyContent: "center", alignItems: "center", marginTop: 24 },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText: { color: "#fff", fontSize: 15, fontWeight: "700" },
  stateOption: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 13,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  stateOptionActive: { backgroundColor: "#f0fdf4", borderRadius: 8 },
  stateOptionText: { fontSize: 14, color: Theme.colors.textDark },
});
