import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Switch,
  StatusBar,
  KeyboardAvoidingView,
  Platform,
  Modal,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { Theme } from "../../constants/theme";
import {
  addAdminProduct,
  updateAdminProduct,
  deleteAdminProduct,
  getCategories,
  getCities,
  AdminCategory,
  AdminCity,
  AdminProduct,
  uploadProductImage,
} from "../../services/adminService";
import { db } from "../../services/firebase";
import { doc, getDoc, collection, query, where, getDocs, limit } from "firebase/firestore";
import { cleanProductName } from "../../services/productService";

interface FormState {
  name: string;
  categoryId: string;
  description: string;
  imageUrl: string;
  price: string;
  originalPrice: string;
  stock: string;
  availability: boolean;
  serviceCity: string;
  state: string;
  weight: string;
  isActive: boolean;
  inStock: boolean;
  isFeatured: boolean;
}

const EMPTY: FormState = {
  name: "",
  categoryId: "",
  description: "",
  imageUrl: "",
  price: "",
  originalPrice: "",
  stock: "50",
  availability: true,
  serviceCity: "",
  state: "",
  weight: "",
  isActive: true,
  inStock: true,
  isFeatured: false,
};

export default function ProductForm() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const isEdit = !!id;

  const [form, setForm] = useState<FormState>(EMPTY);
  const [categories, setCategories] = useState<AdminCategory[]>([]);
  const [cities, setCities] = useState<AdminCity[]>([]);
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Partial<FormState>>({});
  const [success, setSuccess] = useState("");
  const [globalError, setGlobalError] = useState("");
  
  // Dropdown states
  const [stateDropdownOpen, setStateDropdownOpen] = useState(false);
  const [categoryDropdownOpen, setCategoryDropdownOpen] = useState(false);
  const [previewVisible, setPreviewVisible] = useState(false);

  useEffect(() => {
    const init = async () => {
      try {
        const [cats, cts] = await Promise.all([getCategories(), getCities()]);
        setCategories(cats);
        setCities(cts);

        if (isEdit && id) {
          const snap = await getDoc(doc(db, "products", id));
          if (snap.exists()) {
            const d = snap.data() as AdminProduct;
            setForm({
              name: d.name || "",
              categoryId: d.categoryId || d.category || "",
              description: d.description || "",
              imageUrl: d.imageUrl || "",
              price: d.price != null ? String(d.price) : "",
              originalPrice: d.originalPrice != null ? String(d.originalPrice) : "",
              stock: d.stock != null ? String(d.stock) : "",
              availability: d.availability !== false,
              serviceCity: d.serviceCity || "",
              state: d.state || "",
              weight: d.weight || "",
              isActive: d.isActive !== false,
              inStock: d.inStock !== false,
              isFeatured: !!d.isFeatured,
            });
          }
        } else {
          if (cats.length > 0) setForm((f) => ({ ...f, categoryId: cats[0].id }));
          const activeCities = cts.filter((c) => c.deliveryAvailable);
          const allCitiesStr = activeCities.map((c) => c.cityName).join(", ");
          setForm((f) => ({ ...f, state: "All States", serviceCity: allCitiesStr }));
        }
      } catch (e: any) {
        setGlobalError(e.message || "Failed to load shop categories/cities.");
      } finally {
        setLoading(false);
      }
    };
    init();
  }, [isEdit, id]);

  const set = (key: keyof FormState) => (val: string | boolean) => {
    setForm((f) => ({ ...f, [key]: val }));
    setErrors((e) => ({ ...e, [key]: "" }));
  };

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission Denied", "We need camera roll permissions to select images.");
      return;
    }

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        set("imageUrl")(result.assets[0].uri);
      }
    } catch (e) {
      console.error("Error picking image:", e);
      Alert.alert("Error", "Failed to select image from photo library.");
    }
  };

  // State selection multi-toggle
  const toggleState = (stateName: string) => {
    const availableStates = Array.from(new Set(cities.map((c) => c.state).filter(Boolean)));

    if (stateName === "All States") {
      const isAllChecked = form.state === "All States" || (form.state ? form.state.split(", ").filter(Boolean).length === availableStates.length : false);
      if (isAllChecked) {
        setForm((f) => ({ ...f, state: "", serviceCity: "" }));
      } else {
        const allCitiesStr = cities.filter((c) => c.deliveryAvailable).map((c) => c.cityName).join(", ");
        setForm((f) => ({ ...f, state: "All States", serviceCity: allCitiesStr }));
      }
      return;
    }

    let nextStates: string[];
    const current = form.state ? form.state.split(", ").filter(Boolean) : [];
    if (form.state === "All States") {
      nextStates = availableStates.filter((s) => s !== stateName);
    } else {
      if (current.includes(stateName)) {
        nextStates = current.filter((s) => s !== stateName);
      } else {
        nextStates = [...current, stateName];
      }
    }

    let stateStr = "";
    if (nextStates.length === availableStates.length && availableStates.length > 0) {
      stateStr = "All States";
    } else {
      stateStr = nextStates.join(", ");
    }

    const currentCities = form.serviceCity ? form.serviceCity.split(", ").filter(Boolean) : [];
    const nextCities = currentCities.filter((cName) => {
      const cityObj = cities.find((c) => c.cityName === cName);
      if (!cityObj) return false;
      if (stateStr === "All States") return true;
      return nextStates.includes(cityObj.state);
    });

    setForm((f) => ({
      ...f,
      state: stateStr,
      serviceCity: nextCities.join(", "),
    }));
  };

  // City selection multi-toggle
  const toggleCity = (cityName: string) => {
    const current = form.serviceCity ? form.serviceCity.split(", ").filter(Boolean) : [];
    let nextCities: string[];
    if (current.includes(cityName)) {
      nextCities = current.filter((c) => c !== cityName);
    } else {
      nextCities = [...current, cityName];
    }
    setForm((f) => ({ ...f, serviceCity: nextCities.join(", ") }));
    setErrors((e) => ({ ...e, serviceCity: "" }));
  };

  const getFilteredCities = () => {
    if (!form.state) return [];
    const activeCities = cities.filter((c) => c.deliveryAvailable);
    if (form.state === "All States") return activeCities;
    const selectedStates = form.state.split(", ").filter(Boolean);
    return activeCities.filter((c) => selectedStates.includes(c.state));
  };

  // Helper adjustment buttons
  const adjustNumber = (key: "stock" | "price" | "originalPrice", amount: number) => {
    const current = Number(form[key]) || 0;
    const nextValue = Math.max(0, current + amount);
    set(key)(String(nextValue));
  };

  const validate = (): boolean => {
    const errs: Partial<FormState> = {};
    if (!form.name.trim()) errs.name = "Please write a name for the product.";
    if (!form.categoryId) errs.categoryId = "Please select a category." as any;
    if (!form.price.trim() || isNaN(Number(form.price)) || Number(form.price) <= 0)
      errs.price = "Enter a valid sale price (greater than 0)." as any;
    if (form.stock.trim() && (isNaN(Number(form.stock)) || Number(form.stock) < 0))
      errs.stock = "Stock quantity cannot be negative." as any;
    if (!form.state) errs.state = "Please select at least one state." as any;
    if (!form.serviceCity) errs.serviceCity = "Please select at least one service city." as any;
    
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);
    setGlobalError("");
    setSuccess("");
    try {
      // 1. Check for product duplication before creation
      if (!isEdit) {
        const productsCol = collection(db, "products");
        const q = query(
          productsCol,
          where("name", "==", form.name.trim()),
          where("categoryId", "==", form.categoryId.trim()),
          limit(1)
        );
        const duplicateSnap = await getDocs(q);
        if (!duplicateSnap.empty) {
          const existingDoc = duplicateSnap.docs[0];
          const existingId = existingDoc.id;
          
          setSaving(false);
          
          const doEditExisting = () => {
            router.replace({ pathname: "/admin/product-form", params: { id: existingId } } as any);
          };

          if (Platform.OS === "web") {
            if (window.confirm("Product Already Exists\n\nThis product already exists in this category. Do you want to edit the existing product instead?")) {
              doEditExisting();
            }
          } else {
            Alert.alert(
              "Product Already Exists",
              "This product already exists in this category. Do you want to edit the existing product instead?",
              [
                { text: "Cancel", style: "cancel" },
                { text: "Edit Existing", onPress: doEditExisting }
              ]
            );
          }
          return;
        }
      }

      let finalImageUrl = form.imageUrl.trim();
      if (finalImageUrl && !finalImageUrl.startsWith("http://") && !finalImageUrl.startsWith("https://")) {
        setSuccess("Uploading image to Firebase...");
        finalImageUrl = await uploadProductImage(finalImageUrl);
      }

      const payload: Omit<AdminProduct, "id" | "createdAt" | "updatedAt"> = {
        name: form.name.trim(),
        categoryId: form.categoryId.trim(),
        category: form.categoryId.trim(),
        description: form.description.trim(),
        imageUrl: finalImageUrl,
        price: Number(form.price),
        originalPrice: form.originalPrice ? Number(form.originalPrice) : undefined,
        stock: form.stock ? Number(form.stock) : 0,
        availability: form.isActive, // Keep availability synchronized
        isActive: form.isActive,
        inStock: form.inStock,
        isFeatured: form.isFeatured,
        serviceCity: form.serviceCity.trim(),
        state: form.state.trim(),
        weight: form.weight.trim(),
      };

      if (isEdit && id) {
        await updateAdminProduct(id, payload);
        setSuccess("Product updated successfully!");
      } else {
        await addAdminProduct(payload);
        setSuccess("Product published successfully!");
        setForm(EMPTY);
      }
      setTimeout(() => {
        router.back();
      }, 1500);
    } catch (e: any) {
      setGlobalError(e.message || "Failed to save product. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteProduct = () => {
    const doDelete = async () => {
      setSaving(true);
      setGlobalError("");
      try {
        await deleteAdminProduct(id!);
        setSuccess("Product deleted successfully!");
        setTimeout(() => {
          router.back();
        }, 1500);
      } catch (e: any) {
        setGlobalError(e.message || "Failed to delete product.");
      } finally {
        setSaving(false);
      }
    };

    if (Platform.OS === "web") {
      if (window.confirm("Delete Product?\n\nThis action cannot be undone.")) {
        doDelete();
      }
    } else {
      Alert.alert(
        "Delete Product?",
        "This action cannot be undone.",
        [
          { text: "Cancel", style: "cancel" },
          { text: "Delete", style: "destructive", onPress: doDelete },
        ]
      );
    }
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={Theme.colors.primary} />
        <Text style={styles.loadingText}>Loading product details...</Text>
      </View>
    );
  }

  const hasDiscount = Number(form.originalPrice) > Number(form.price);
  const discountPercent = hasDiscount
    ? Math.round(((Number(form.originalPrice) - Number(form.price)) / Number(form.originalPrice)) * 100)
    : 0;

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <StatusBar barStyle="light-content" backgroundColor={Theme.colors.primary} />

      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{isEdit ? "Edit Product Details" : "Publish New Product"}</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView contentContainerStyle={styles.form} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        {globalError ? (
          <View style={styles.alertBox}>
            <Ionicons name="alert-circle" size={16} color="#ef4444" />
            <Text style={styles.alertText}>{globalError}</Text>
          </View>
        ) : null}

        {success ? (
          <View style={[styles.alertBox, styles.successAlert]}>
            <Ionicons name="checkmark-circle" size={16} color="#10b981" />
            <Text style={[styles.alertText, { color: "#10b981" }]}>{success}</Text>
          </View>
        ) : null}

        {/* Product Image Section */}
        <Text style={styles.sectionHeading}>Product Visuals</Text>
        <View style={styles.imagePreviewContainer}>
          {form.imageUrl ? (
            <View style={styles.previewImageWrapper}>
              <Image source={{ uri: form.imageUrl }} style={styles.previewImage} contentFit="cover" />
              <TouchableOpacity style={styles.removeImageBtn} onPress={() => set("imageUrl")("")}>
                <Ionicons name="trash-outline" size={16} color="#fff" />
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity style={styles.noImagePreview} onPress={pickImage} activeOpacity={0.8}>
              <Ionicons name="cloud-upload-outline" size={32} color="#64748b" />
              <Text style={styles.noImageText}>Tap to choose image from device gallery</Text>
            </TouchableOpacity>
          )}
          
          <View style={styles.imageActions}>
            <TextInput
              style={[styles.input, { flex: 1 }]}
              placeholder="Or paste remote image link (URL)..."
              placeholderTextColor="#94a3b8"
              value={form.imageUrl}
              onChangeText={set("imageUrl")}
              autoCapitalize="none"
              keyboardType="url"
            />
            <TouchableOpacity 
              style={styles.uploadIconButton} 
              onPress={pickImage}
              activeOpacity={0.7}
            >
              <Ionicons name="image" size={20} color={Theme.colors.primary} />
            </TouchableOpacity>
          </View>
        </View>

        <Text style={styles.sectionHeading}>Basic Information</Text>

        <Field label="Product Name *" error={errors.name as any} help="Display title visible to customers">
          <TextInput
            style={[styles.input, errors.name && styles.inputError]}
            placeholder="e.g. Organic Bananas"
            placeholderTextColor="#94a3b8"
            value={form.name}
            onChangeText={set("name")}
          />
        </Field>

        {/* Category Dropdown */}
        <Field label="Category *" error={errors.categoryId as any} help="Organize under a specific store category">
          <TouchableOpacity
            style={styles.dropdownBtn}
            onPress={() => setCategoryDropdownOpen(!categoryDropdownOpen)}
            activeOpacity={0.8}
          >
            <Text style={[styles.dropdownBtnText, !form.categoryId && { color: "#94a3b8" }]}>
              {categories.find((c) => c.id === form.categoryId)?.name || "Select Product Category"}
            </Text>
            <Ionicons name={categoryDropdownOpen ? "chevron-up" : "chevron-down"} size={18} color="#64748b" />
          </TouchableOpacity>

          {categoryDropdownOpen && (
            <View style={styles.dropdownListContainer}>
              {categories.map((cat) => (
                <TouchableOpacity
                  key={cat.id}
                  style={styles.checkListItem}
                  onPress={() => {
                    set("categoryId")(cat.id);
                    setCategoryDropdownOpen(false);
                  }}
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name={form.categoryId === cat.id ? "radio-button-on" : "radio-button-off"}
                    size={18}
                    color={form.categoryId === cat.id ? Theme.colors.primary : "#94a3b8"}
                  />
                  <Text style={[styles.checkListItemText, form.categoryId === cat.id && styles.checkListItemTextActive]}>
                    {cat.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </Field>

        <Field label="Product Description" help="Brief explanation of product size, quality, etc.">
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="Describe quality details, storage guidelines, origin..."
            placeholderTextColor="#94a3b8"
            value={form.description}
            onChangeText={set("description")}
            multiline
            numberOfLines={3}
            textAlignVertical="top"
          />
        </Field>

        <Text style={styles.sectionHeading}>Pricing & Units</Text>

        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <Field label="Original Price (₹)" help="Crossed-out slash price">
              <View style={styles.numberInputContainer}>
                <TouchableOpacity style={styles.adjustBtn} onPress={() => adjustNumber("originalPrice", -10)}>
                  <Text style={styles.adjustBtnText}>-10</Text>
                </TouchableOpacity>
                <TextInput
                  style={styles.numberInput}
                  placeholder="e.g. 100"
                  placeholderTextColor="#94a3b8"
                  value={form.originalPrice}
                  onChangeText={set("originalPrice")}
                  keyboardType="numeric"
                />
                <TouchableOpacity style={styles.adjustBtn} onPress={() => adjustNumber("originalPrice", 10)}>
                  <Text style={styles.adjustBtnText}>+10</Text>
                </TouchableOpacity>
              </View>
            </Field>
          </View>

          <View style={{ flex: 1 }}>
            <Field label="Selling Price (₹) *" error={errors.price as any} help="Final discounted price">
              <View style={styles.numberInputContainer}>
                <TouchableOpacity style={styles.adjustBtn} onPress={() => adjustNumber("price", -10)}>
                  <Text style={styles.adjustBtnText}>-10</Text>
                </TouchableOpacity>
                <TextInput
                  style={[styles.numberInput, errors.price && styles.inputError]}
                  placeholder="e.g. 80"
                  placeholderTextColor="#94a3b8"
                  value={form.price}
                  onChangeText={set("price")}
                  keyboardType="numeric"
                />
                <TouchableOpacity style={styles.adjustBtn} onPress={() => adjustNumber("price", 10)}>
                  <Text style={styles.adjustBtnText}>+10</Text>
                </TouchableOpacity>
              </View>
            </Field>
          </View>
        </View>

        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <Field label="Unit / Weight" help="e.g. 500g, 1 kg, 6 pcs">
              <TextInput
                style={styles.input}
                placeholder="e.g. 500g"
                placeholderTextColor="#94a3b8"
                value={form.weight}
                onChangeText={set("weight")}
              />
            </Field>
          </View>

          <View style={{ flex: 1 }}>
            <Field label="Stock Quantity" error={errors.stock as any} help="Available inventory size">
              <View style={styles.numberInputContainer}>
                <TouchableOpacity style={styles.adjustBtn} onPress={() => adjustNumber("stock", -5)}>
                  <Text style={styles.adjustBtnText}>-5</Text>
                </TouchableOpacity>
                <TextInput
                  style={[styles.numberInput, errors.stock && styles.inputError]}
                  placeholder="e.g. 50"
                  placeholderTextColor="#94a3b8"
                  value={form.stock}
                  onChangeText={set("stock")}
                  keyboardType="numeric"
                />
                <TouchableOpacity style={styles.adjustBtn} onPress={() => adjustNumber("stock", 5)}>
                  <Text style={styles.adjustBtnText}>+5</Text>
                </TouchableOpacity>
              </View>
            </Field>
          </View>
        </View>

        {/* Calculated Discount Display */}
        {hasDiscount && (
          <View style={styles.discountHelpContainer}>
            <Ionicons name="sparkles" size={14} color="#16a34a" />
            <Text style={styles.discountHelpText}>
              Calculated discount percentage: <Text style={{ fontWeight: "800" }}>{discountPercent}% OFF</Text>
            </Text>
          </View>
        )}

        <Text style={styles.sectionHeading}>Delivery Area</Text>

        <Field label="State Name *" error={errors.state as any} help="Filter cities by deliverable states">
          <TouchableOpacity
            style={styles.dropdownBtn}
            onPress={() => setStateDropdownOpen(!stateDropdownOpen)}
            activeOpacity={0.8}
          >
            <Text style={[styles.dropdownBtnText, !form.state && { color: "#94a3b8" }]}>
              {form.state || "Select Deliverable States"}
            </Text>
            <Ionicons name={stateDropdownOpen ? "chevron-up" : "chevron-down"} size={18} color="#64748b" />
          </TouchableOpacity>

          {stateDropdownOpen && (
            <View style={styles.dropdownListContainer}>
              <TouchableOpacity
                style={styles.checkListItem}
                onPress={() => toggleState("All States")}
                activeOpacity={0.7}
              >
                <Ionicons
                  name={form.state === "All States" ? "checkbox" : "square-outline"}
                  size={18}
                  color={form.state === "All States" ? Theme.colors.primary : "#94a3b8"}
                />
                <Text style={[styles.checkListItemText, form.state === "All States" && styles.checkListItemTextActive]}>
                  All States
                </Text>
              </TouchableOpacity>

              {Array.from(new Set(cities.map((c) => c.state).filter(Boolean))).map((stateName) => {
                const isChecked = form.state === "All States" || (form.state ? form.state.split(", ").includes(stateName) : false);
                return (
                  <TouchableOpacity
                    key={stateName}
                    style={styles.checkListItem}
                    onPress={() => toggleState(stateName)}
                    activeOpacity={0.7}
                  >
                    <Ionicons
                      name={isChecked ? "checkbox" : "square-outline"}
                      size={18}
                      color={isChecked ? Theme.colors.primary : "#94a3b8"}
                    />
                    <Text style={[styles.checkListItemText, isChecked && styles.checkListItemTextActive]}>
                      {stateName}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </Field>

        <Field label="Deliverable Cities *" error={errors.serviceCity as any} help="Choose cities for local delivery routing">
          {getFilteredCities().length === 0 ? (
            <View style={styles.noCitiesBox}>
              <Text style={styles.noCitiesText}>Please select a deliverable state first.</Text>
            </View>
          ) : (
            <View style={styles.categoryGrid}>
              {getFilteredCities().map((city) => {
                const isSelected = form.serviceCity ? form.serviceCity.split(", ").includes(city.cityName) : false;
                return (
                  <TouchableOpacity
                    key={city.id}
                    style={[styles.gridPill, isSelected && styles.gridPillActive]}
                    onPress={() => toggleCity(city.cityName)}
                  >
                    <Text style={[styles.gridPillText, isSelected && styles.gridPillTextActive]}>
                      {city.cityName}
                    </Text>
                    {isSelected && (
                      <Ionicons name="checkmark-circle" size={14} color="#fff" style={{ marginLeft: 4 }} />
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </Field>

        <Text style={styles.sectionHeading}>Product Visibility & Tags</Text>

        {/* Active Toggle */}
        <View style={styles.toggleRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.toggleLabel}>Active (Show to Customers)</Text>
            <Text style={styles.toggleSub}>Publish this item on customer explore search and category lists</Text>
          </View>
          <Switch
            value={form.isActive}
            onValueChange={(v) => set("isActive")(v)}
            trackColor={{ false: "#cbd5e1", true: "#bbf7d0" }}
            thumbColor={form.isActive ? Theme.colors.primary : "#94a3b8"}
          />
        </View>

        {/* In Stock Toggle */}
        <View style={styles.toggleRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.toggleLabel}>In Stock Status</Text>
            <Text style={styles.toggleSub}>Mark whether this item is currently available for purchase</Text>
          </View>
          <Switch
            value={form.inStock}
            onValueChange={(v) => set("inStock")(v)}
            trackColor={{ false: "#cbd5e1", true: "#bbf7d0" }}
            thumbColor={form.inStock ? Theme.colors.primary : "#94a3b8"}
          />
        </View>

        {/* Featured Toggle */}
        <View style={styles.toggleRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.toggleLabel}>Featured Toggle</Text>
            <Text style={styles.toggleSub}>Highlight in promotional banners and home screen recommendations</Text>
          </View>
          <Switch
            value={form.isFeatured}
            onValueChange={(v) => set("isFeatured")(v)}
            trackColor={{ false: "#cbd5e1", true: "#bbf7d0" }}
            thumbColor={form.isFeatured ? Theme.colors.primary : "#94a3b8"}
          />
        </View>

        {/* Action Buttons */}
        <View style={styles.actionRowContainer}>
          <TouchableOpacity style={styles.cancelBtn} onPress={() => router.back()} disabled={saving}>
            <Text style={styles.cancelBtnText}>Cancel</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.previewBtn} onPress={() => setPreviewVisible(true)} disabled={saving}>
            <Ionicons name="eye-outline" size={16} color={Theme.colors.primary} />
            <Text style={styles.previewBtnText}>Preview</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.submitBtn, saving && styles.submitBtnDisabled]}
            onPress={handleSave}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.submitBtnText}>{isEdit ? "Save Changes" : "Save Product"}</Text>
            )}
          </TouchableOpacity>
        </View>

        {isEdit && (
          <TouchableOpacity style={styles.deleteBtn} onPress={handleDeleteProduct} disabled={saving}>
            <Ionicons name="trash-outline" size={18} color="#ef4444" style={{ marginRight: 6 }} />
            <Text style={styles.deleteBtnText}>Delete Product</Text>
          </TouchableOpacity>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Read-Only High-Fidelity Product Card Preview Modal */}
      <Modal
        visible={previewVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setPreviewVisible(false)}
      >
        <View style={styles.previewModalOverlay}>
          <View style={styles.previewModalSheet}>
            <View style={styles.previewModalHeader}>
              <Text style={styles.previewModalTitle}>Live Customer App Preview</Text>
              <TouchableOpacity onPress={() => setPreviewVisible(false)}>
                <Ionicons name="close-circle" size={24} color="#94a3b8" />
              </TouchableOpacity>
            </View>

            <View style={styles.previewModalContent}>
              <Text style={styles.previewModalSub}>
                This is exactly how this product card will look in the customer app:
              </Text>
              
              <View style={styles.previewCardContainer}>
                {/* Custom Product Card matching customer UI perfectly */}
                <View style={styles.customerProductCard}>
                  <View style={styles.customerProductImageContainer}>
                    {form.imageUrl ? (
                      <Image source={{ uri: form.imageUrl }} style={styles.customerProductImage} contentFit="cover" />
                    ) : (
                      <View style={styles.customerImagePlaceholder}>
                        <Ionicons name="image-outline" size={28} color="#94a3b8" />
                      </View>
                    )}
                    {hasDiscount && (
                      <View style={styles.customerDiscountBadge}>
                        <Text style={styles.customerDiscountBadgeText}>{discountPercent}% OFF</Text>
                      </View>
                    )}
                    <View style={styles.customerEtaBadge}>
                      <Ionicons name="flash" size={10} color="#16a34a" />
                      <Text style={styles.customerEtaText}>10 Mins</Text>
                    </View>
                  </View>

                  <View style={styles.customerProductDetails}>
                    <Text style={styles.customerProductCategory}>
                      {categories.find((c) => c.id === form.categoryId)?.name || "General"}
                    </Text>
                    <Text style={styles.customerProductName} numberOfLines={1}>
                      {cleanProductName(form.name) || "Banana Pack"}
                    </Text>
                    <Text style={styles.customerProductWeight}>{form.weight || "1 unit"}</Text>
                    
                    <View style={styles.customerPriceRow}>
                      <View>
                        <Text style={styles.customerProductPrice}>Rs. {form.price || "0"}</Text>
                        {hasDiscount && (
                          <Text style={styles.customerProductOriginalPrice}>Rs. {form.originalPrice}</Text>
                        )}
                      </View>

                      {/* Read-Only ADD Button matching home.tsx */}
                      <View style={styles.customerAddButton}>
                        <Text style={styles.customerAddButtonText}>ADD</Text>
                        <Ionicons name="add" size={12} color={Theme.colors.primary} />
                      </View>
                    </View>
                  </View>
                </View>
              </View>
            </View>

            <TouchableOpacity style={styles.previewCloseBtn} onPress={() => setPreviewVisible(false)}>
              <Text style={styles.previewCloseBtnText}>Close Preview</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

function Field({
  label,
  children,
  error,
  help,
}: {
  label: string;
  children: React.ReactNode;
  error?: string;
  help?: string;
}) {
  return (
    <View style={{ marginBottom: 16 }}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {help ? <Text style={styles.fieldHelp}>{help}</Text> : null}
      {children}
      {error ? <Text style={styles.fieldError}>{error}</Text> : null}
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
    gap: 10,
  },
  loadingText: {
    color: "#64748b",
    fontSize: 14,
  },
  header: {
    backgroundColor: Theme.colors.primary,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 14,
    gap: 10,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.15)",
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitle: {
    flex: 1,
    fontSize: 17,
    fontWeight: "800",
    color: "#fff",
    textAlign: "center",
  },
  form: {
    padding: 16,
  },
  alertBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fef2f2",
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    gap: 8,
  },
  successAlert: {
    backgroundColor: "#ecfdf5",
  },
  alertText: {
    color: "#ef4444",
    fontSize: 13,
    fontWeight: "600",
    flex: 1,
  },
  sectionHeading: {
    fontSize: 13,
    fontWeight: "800",
    color: Theme.colors.primaryDark,
    marginTop: 14,
    marginBottom: 12,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  
  // Image Preview Style
  imagePreviewContainer: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 12,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  previewImageWrapper: {
    width: "100%",
    height: 160,
    borderRadius: 12,
    overflow: "hidden",
    position: "relative",
    backgroundColor: "#f1f5f9",
  },
  previewImage: {
    width: "100%",
    height: "100%",
  },
  removeImageBtn: {
    position: "absolute",
    top: 8,
    right: 8,
    backgroundColor: "rgba(239, 68, 68, 0.85)",
    padding: 8,
    borderRadius: 8,
  },
  noImagePreview: {
    width: "100%",
    height: 120,
    borderRadius: 12,
    backgroundColor: "#f8fafc",
    justifyContent: "center",
    alignItems: "center",
    borderStyle: "dashed",
    borderWidth: 1.5,
    borderColor: "#cbd5e1",
    gap: 6,
    padding: 16,
  },
  noImageText: {
    fontSize: 12,
    color: "#64748b",
    fontWeight: "600",
    textAlign: "center",
  },
  imageActions: {
    flexDirection: "row",
    marginTop: 10,
    gap: 8,
    alignItems: "center",
  },
  uploadIconButton: {
    width: 46,
    height: 46,
    borderRadius: 12,
    backgroundColor: "#f0fdf4",
    borderWidth: 1.5,
    borderColor: "#bbf7d0",
    justifyContent: "center",
    alignItems: "center",
  },

  fieldLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: "#1e293b",
    marginBottom: 3,
  },
  fieldHelp: {
    fontSize: 10,
    color: "#64748b",
    marginBottom: 6,
    lineHeight: 14,
  },
  fieldError: {
    fontSize: 11,
    color: "#ef4444",
    fontWeight: "600",
    marginTop: 4,
  },
  input: {
    backgroundColor: "#ffffff",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: Theme.colors.textDark,
    borderWidth: 1,
    borderColor: "#cbd5e1",
  },
  inputError: {
    borderColor: "#ef4444",
    backgroundColor: "#fef2f2",
  },
  textArea: {
    height: 80,
    paddingTop: 12,
  },

  // Dropdown Design
  dropdownBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  dropdownBtnText: {
    fontSize: 14,
    color: Theme.colors.textDark,
    fontWeight: "600",
  },
  dropdownListContainer: {
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 12,
    padding: 8,
    marginTop: 6,
    gap: 4,
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  checkListItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: 8,
    gap: 10,
  },
  checkListItemText: {
    fontSize: 13,
    color: "#64748b",
    fontWeight: "600",
  },
  checkListItemTextActive: {
    color: Theme.colors.primaryDark,
    fontWeight: "700",
  },

  categoryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  gridPill: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#cbd5e1",
    gap: 6,
  },
  gridPillActive: {
    backgroundColor: Theme.colors.primary,
    borderColor: Theme.colors.primary,
  },
  gridPillText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#475569",
  },
  gridPillTextActive: {
    color: "#ffffff",
    fontWeight: "700",
  },

  row: {
    flexDirection: "row",
    gap: 12,
  },
  numberInputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 12,
    overflow: "hidden",
  },
  numberInput: {
    flex: 1,
    textAlign: "center",
    fontSize: 15,
    fontWeight: "700",
    color: Theme.colors.textDark,
    paddingVertical: 10,
  },
  adjustBtn: {
    backgroundColor: "#f1f5f9",
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  adjustBtnText: {
    fontSize: 11,
    fontWeight: "800",
    color: "#475569",
  },
  discountHelpContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f0fdf4",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#bbf7d0",
    marginTop: -4,
    marginBottom: 16,
    gap: 6,
  },
  discountHelpText: {
    fontSize: 11,
    color: "#16a34a",
    fontWeight: "600",
  },
  noCitiesBox: {
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 12,
    padding: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  noCitiesText: {
    fontSize: 12,
    color: "#64748b",
    fontWeight: "600",
  },

  // Toggle Design
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  toggleLabel: {
    fontSize: 14,
    fontWeight: "700",
    color: Theme.colors.primaryDark,
  },
  toggleSub: {
    fontSize: 11,
    color: "#64748b",
    marginTop: 2,
    lineHeight: 15,
    paddingRight: 10,
  },

  // Action Buttons
  actionRowContainer: {
    flexDirection: "row",
    gap: 10,
    marginTop: 20,
    marginBottom: 12,
  },
  cancelBtn: {
    flex: 1,
    height: 52,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: "#cbd5e1",
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#ffffff",
  },
  cancelBtnText: {
    color: "#475569",
    fontSize: 14,
    fontWeight: "700",
  },
  previewBtn: {
    flex: 1,
    height: 52,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: Theme.colors.primary,
    backgroundColor: "#ffffff",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  previewBtnText: {
    color: Theme.colors.primary,
    fontSize: 14,
    fontWeight: "700",
  },
  submitBtn: {
    flex: 1.5,
    height: 52,
    borderRadius: 14,
    backgroundColor: Theme.colors.primary,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: Theme.colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 3,
  },
  submitBtnDisabled: {
    opacity: 0.6,
  },
  submitBtnText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "800",
  },
  deleteBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    height: 48,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: "#fca5a5",
    backgroundColor: "#fef2f2",
    marginTop: 10,
  },
  deleteBtnText: {
    color: "#ef4444",
    fontSize: 14,
    fontWeight: "700",
  },

  // Preview Modal Layout
  previewModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.6)",
    justifyContent: "flex-end",
  },
  previewModalSheet: {
    backgroundColor: "#ffffff",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 24,
    maxHeight: "85%",
  },
  previewModalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  previewModalTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: Theme.colors.primaryDark,
  },
  previewModalContent: {
    paddingVertical: 20,
    alignItems: "center",
  },
  previewModalSub: {
    fontSize: 12,
    color: "#64748b",
    fontWeight: "500",
    marginBottom: 16,
    textAlign: "center",
  },
  previewCardContainer: {
    padding: 16,
    backgroundColor: "#f8fafc",
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  previewCloseBtn: {
    backgroundColor: "#ffffff",
    borderWidth: 1.5,
    borderColor: "#cbd5e1",
    borderRadius: 14,
    height: 48,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 12,
  },
  previewCloseBtnText: {
    color: "#64748b",
    fontSize: 14,
    fontWeight: "700",
  },

  // Customer Card Styles (matching home.tsx pixel-for-pixel)
  customerProductCard: {
    width: 175,
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
  },
  customerProductImageContainer: {
    height: 115,
    justifyContent: "center",
    alignItems: "center",
    position: "relative",
    backgroundColor: "#f8fafc",
  },
  customerProductImage: {
    width: "100%",
    height: "100%",
  },
  customerImagePlaceholder: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  customerDiscountBadge: {
    position: "absolute",
    top: 10,
    left: 10,
    backgroundColor: Theme.colors.primary,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  customerDiscountBadgeText: {
    color: "#ffffff",
    fontSize: 8,
    fontWeight: "900",
  },
  customerEtaBadge: {
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
  customerEtaText: {
    fontSize: 9,
    fontWeight: "900",
    color: "#16a34a",
  },
  customerProductDetails: {
    padding: 12,
  },
  customerProductCategory: {
    fontSize: 9,
    fontWeight: "700",
    color: "#94a3b8",
    textTransform: "uppercase",
    marginBottom: 2,
  },
  customerProductName: {
    fontSize: 13,
    fontWeight: "800",
    color: "#1e293b",
  },
  customerProductWeight: {
    fontSize: 11,
    color: "#64748b",
    fontWeight: "600",
    marginTop: 2,
  },
  customerPriceRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 10,
    minHeight: 32,
  },
  customerProductPrice: {
    fontSize: 14,
    fontWeight: "800",
    color: "#0f172a",
  },
  customerProductOriginalPrice: {
    fontSize: 11,
    color: "#94a3b8",
    textDecorationLine: "line-through",
    fontWeight: "500",
    marginTop: 1,
  },
  customerAddButton: {
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
  customerAddButtonText: {
    fontSize: 12,
    fontWeight: "900",
    color: Theme.colors.primary,
  },
});
