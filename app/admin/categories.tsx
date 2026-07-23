import React, { useState, useEffect, useRef } from "react";
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
  Dimensions,
  Switch,
  Animated,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { storage } from "../../services/firebase";

import { Theme } from "../../constants/theme";
import AdminDrawer from "../../components/AdminDrawer";
import {
  addCategory,
  updateCategory,
  deleteCategory,
  AdminCategory,
  subscribeCategories,
  checkCategoryHasProducts,
} from "../../services/adminService";

const { width } = Dimensions.get("window");
const GRID_PADDING = 20;
const CARD_SIZE = 84;
const CARD_RADIUS = 22;

const ICON_OPTIONS = [
  "leaf-outline", "water-outline", "beer-outline", "pizza-outline",
  "ice-cream-outline", "restaurant-outline", "alarm-outline", "basket-outline",
  "sparkles-outline", "home-outline", "cart-outline", "cafe-outline",
  "nutrition-outline", "fish-outline", "egg-outline", "gift-outline",
  "flower-outline", "medical-outline", "paw-outline", "shirt-outline",
  "construct-outline", "brush-outline", "wine-outline", "pint-outline",
  "fast-food-outline", "flame-outline", "sunny-outline", "bulb-outline",
  "book-outline", "paper-plane-outline",
];

const COLOR_OPTIONS = [
  { color: "#16a34a", bg: "#dcfce7" },
  { color: "#2563eb", bg: "#dbeafe" },
  { color: "#ea580c", bg: "#ffedd5" },
  { color: "#b45309", bg: "#fef3c7" },
  { color: "#db2777", bg: "#fce7f3" },
  { color: "#854d0e", bg: "#fef9c3" },
  { color: "#7c3aed", bg: "#f3e8ff" },
  { color: "#0d9488", bg: "#ccfbf1" },
  { color: "#0891b2", bg: "#cffafe" },
  { color: "#4f46e5", bg: "#e0e7ff" },
  { color: "#e11d48", bg: "#ffe4e6" },
  { color: "#65a30d", bg: "#ecfccb" },
  { color: "#0284c7", bg: "#e0f2fe" },
  { color: "#c026d3", bg: "#fae8ff" },
  { color: "#059669", bg: "#d1fae5" },
  { color: "#475569", bg: "#f1f5f9" },
];

interface CategoryFormState {
  name: string;
  icon: string;
  color: string;
  backgroundColor: string;
  bg: string;
  displayOrder: string;
  isActive: boolean;
}

const EMPTY_FORM: CategoryFormState = {
  name: "",
  icon: "leaf-outline",
  color: "#16a34a",
  backgroundColor: "#dcfce7",
  bg: "#dcfce7",
  displayOrder: "1",
  isActive: true,
};

export default function AdminCategories() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [categories, setCategories] = useState<AdminCategory[]>([]);
  const [filtered, setFiltered] = useState<AdminCategory[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Modals & Sheets
  const [modalVisible, setModalVisible] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<CategoryFormState>(EMPTY_FORM);
  const [selectedImageUri, setSelectedImageUri] = useState<string | null>(null);
  const [uploadedImageUrl, setUploadedImageUrl] = useState<string | null>(null);
  const [formError, setFormError] = useState("");

  // Custom Snackbar Alert
  const [snackbar, setSnackbar] = useState<{ visible: boolean; message: string; type: "success" | "error" }>({
    visible: false,
    message: "",
    type: "success",
  });

  // Deletion Check Alert Modal
  const [deleteWarningVisible, setDeleteWarningVisible] = useState(false);
  const [deleteWarningMsg, setDeleteWarningMsg] = useState("");
  const [deleteConfirmVisible, setDeleteConfirmVisible] = useState(false);
  const [categoryToDelete, setCategoryToDelete] = useState<AdminCategory | null>(null);

  // Shimmer pulse animation
  const shimmerAnim = useRef(new Animated.Value(0.3)).current;

  const showSnackbar = (message: string, type: "success" | "error" = "success") => {
    setSnackbar({ visible: true, message, type });
    setTimeout(() => {
      setSnackbar((prev) => ({ ...prev, visible: false }));
    }, 3000);
  };

  useEffect(() => {
    setLoading(true);
    const unsubscribe = subscribeCategories((cats) => {
      // Sort categories by displayOrder ascending
      const sorted = [...cats].sort((a, b) => (a.displayOrder || 99) - (b.displayOrder || 99));
      setCategories(sorted);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (loading) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(shimmerAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
          Animated.timing(shimmerAnim, { toValue: 0.3, duration: 800, useNativeDriver: true }),
        ])
      ).start();
    } else {
      shimmerAnim.stopAnimation();
    }
  }, [loading]);

  useEffect(() => {
    if (!search.trim()) {
      setFiltered(categories);
    } else {
      setFiltered(
        categories.filter((c) =>
          c.name.toLowerCase().includes(search.toLowerCase())
        )
      );
    }
  }, [search, categories]);

  const pickImage = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permission Denied", "We need photo library permissions to upload custom icons.");
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        setSelectedImageUri(result.assets[0].uri);
        setUploadedImageUrl(null); // Clear previous URL if selecting new image
      }
    } catch (err) {
      console.error("Image pick error:", err);
      showSnackbar("Failed to pick image.", "error");
    }
  };

  const uploadImageToStorage = async (uri: string): Promise<string> => {
    console.log("[STEP 3] Uploading image... URI:", uri);

    // ── Read local URI into a Blob via XMLHttpRequest ──────────────────────────
    // IMPORTANT: React Native's fetch() cannot reliably read content:// or
    // file:// URIs returned by expo-image-picker — it either hangs forever or
    // returns an empty body. XMLHttpRequest with responseType="blob" is the only
    // reliable cross-platform method on React Native (iOS + Android).
    const readBlob = (): Promise<Blob> =>
      new Promise<Blob>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.responseType = "blob";
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve(xhr.response as Blob);
          } else {
            reject(new Error(`[STEP 3] XHR failed reading local image (status ${xhr.status}).`));
          }
        };
        xhr.onerror = () => reject(new Error("[STEP 3] XHR network error reading local image."));
        xhr.ontimeout = () => reject(new Error("[STEP 3] XHR timed out reading local image."));
        xhr.timeout = 10_000; // 10 s to read the local file
        xhr.open("GET", uri);
        xhr.send();
      });

    // ── Upload + getDownloadURL must complete within 30 s total ───────────────
    const UPLOAD_TIMEOUT_MS = 30_000;
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(
        () => reject(new Error("[STEP 3] Image upload timed out after 30 seconds. Check your network connection.")),
        UPLOAD_TIMEOUT_MS
      )
    );

    const uploadPromise = (async () => {
      let blob: Blob;
      try {
        blob = await readBlob();
        console.log("[STEP 3a] Blob ready. Size:", blob.size, "bytes, type:", blob.type);
        if (blob.size === 0) throw new Error("[STEP 3a] Image blob is empty — the URI may be invalid.");
      } catch (blobErr: any) {
        throw new Error(`[STEP 3a] Failed to read local image: ${blobErr.message}`);
      }

      const filename = `categories/cat_${Date.now()}.jpg`;
      const storageRef = ref(storage, filename);
      console.log("[STEP 3b] Uploading to Firebase Storage path:", filename);

      try {
        await uploadBytes(storageRef, blob, { contentType: "image/jpeg" });
        console.log("[STEP 3c] uploadBytes complete.");
      } catch (uploadErr: any) {
        throw new Error(`[STEP 3b] Firebase Storage uploadBytes failed: ${uploadErr.code ?? ""} — ${uploadErr.message}`);
      }

      let downloadUrl: string;
      try {
        downloadUrl = await getDownloadURL(storageRef);
        console.log("[STEP 4] Image upload successful. Download URL:", downloadUrl);
      } catch (urlErr: any) {
        throw new Error(`[STEP 4] getDownloadURL failed: ${urlErr.code ?? ""} — ${urlErr.message}`);
      }

      return downloadUrl;
    })();

    return Promise.race([uploadPromise, timeoutPromise]);
  };

  const openAdd = () => {
    setEditingId(null);
    setForm({
      ...EMPTY_FORM,
      displayOrder: (categories.length + 1).toString(),
    });
    setSelectedImageUri(null);
    setUploadedImageUrl(null);
    setFormError("");
    setModalVisible(true);
  };

  const openEdit = (cat: AdminCategory) => {
    setEditingId(cat.id);
    setForm({
      name: cat.name,
      icon: cat.icon || "leaf-outline",
      color: cat.color || "#16a34a",
      backgroundColor: cat.backgroundColor || cat.bg || "#dcfce7",
      bg: cat.bg || cat.backgroundColor || "#dcfce7",
      displayOrder: (cat.displayOrder || 99).toString(),
      isActive: cat.isActive !== false,
    });
    setSelectedImageUri(null);
    setUploadedImageUrl(cat.iconUrl || null);
    setFormError("");
    setModalVisible(true);
  };

  const handleSave = async () => {
    console.log("[STEP 1] Save button clicked. Mode:", editingId ? `Edit (${editingId})` : "Add");

    // ── Validation ────────────────────────────────────────────────────────────
    if (!form.name.trim()) {
      setFormError("Category Name is required.");
      return;
    }
    console.log("[STEP 2] Validation passed. Name:", form.name.trim());

    // Guard: ensure admin is authenticated before starting any async work
    const { auth: fbAuth } = await import("../../services/firebase");
    if (!fbAuth.currentUser) {
      setFormError("You are not authenticated. Please log out and log back in.");
      console.error("[STEP 2] ❌ No authenticated user — aborting save.");
      return;
    }
    console.log("[STEP 2] Auth check passed. UID:", fbAuth.currentUser.uid);

    setSaving(true);
    setFormError("");

    try {
      // ── Step 3: Upload image if a new one was selected ────────────────────
      let finalIconUrl: string | null = uploadedImageUrl;
      if (selectedImageUri) {
        console.log("[STEP 3] New image selected — starting upload...");
        finalIconUrl = await uploadImageToStorage(selectedImageUri);
        console.log("[STEP 5] Download URL generated:", finalIconUrl);
      } else {
        console.log("[STEP 3] No new image — reusing existing iconUrl:", finalIconUrl ?? "(none)");
      }

      // ── Step 6: Build the Firestore payload ───────────────────────────────
      const displayOrderNum = parseInt(form.displayOrder) || 99;
      const categoryData = {
        name: form.name.trim(),
        icon: form.icon,
        color: form.color,
        backgroundColor: form.backgroundColor,
        bg: form.backgroundColor,  // backwards-compatibility alias
        displayOrder: displayOrderNum,
        isActive: form.isActive,
        iconUrl: finalIconUrl ?? "",
      };
      console.log("[STEP 6] Writing category to Firestore. Payload:", JSON.stringify(categoryData));

      // ── Step 7: Write to Firestore ────────────────────────────────────────
      if (editingId) {
        // ── EDIT path: updateDoc via adminService ─────────────────────────
        console.log("[STEP 7] updateCategory — Document ID:", editingId);
        await updateCategory(editingId, categoryData);
        console.log("[STEP 7] Firestore update successful. Document ID:", editingId);
        showSnackbar("✅ Category Updated Successfully");

      } else {
        // ── ADD path: use addCategory() from adminService (uses addDoc +
        //    serverTimestamp) — avoids manual setDoc with a custom slug ID
        //    that can silently conflict if the doc already exists.
        console.log("[STEP 7] addCategory — Name:", categoryData.name);
        const newId = await addCategory({
          ...categoryData,
          // AdminCategory requires these fields; addCategory strips id/createdAt/updatedAt
          bg: categoryData.bg,
        } as any);
        console.log("[STEP 7] Firestore write successful. New Document ID:", newId);
        showSnackbar("✅ Category Added Successfully");
      }

      // ── Step 8/9: onSnapshot auto-refreshes the list; close modal ─────────
      console.log("[STEP 8] Refreshing category list — onSnapshot will fire automatically.");
      setModalVisible(false);
      console.log("[STEP 9] Categories will refresh via real-time listener.");

    } catch (e: any) {
      // Never swallow errors — surface the full Firebase error code + message
      const code: string = e?.code ?? "";
      const msg: string = e?.message ?? "Failed to save category.";
      const fullErr = code ? `[${code}] ${msg}` : msg;
      console.error("[STEP 7] ❌ Save FAILED:", fullErr, e);
      setFormError(fullErr);
    } finally {
      // ── Step 10: ALWAYS reset loading state — no exception path skips this
      setSaving(false);
      console.log("[STEP 10] Loading state finished. setSaving(false) executed.");
    }
  };

  const handleDeletePress = async () => {
    if (!editingId) return;

    setModalVisible(false);
    
    // Check if category has products
    const hasProducts = await checkCategoryHasProducts(editingId);
    if (hasProducts) {
      setDeleteWarningMsg(
        "This category contains products. Move products to another category or delete them first."
      );
      setDeleteWarningVisible(true);
      return;
    }

    // Find category info
    const cat = categories.find((c) => c.id === editingId);
    if (cat) {
      setCategoryToDelete(cat);
      setDeleteConfirmVisible(true);
    }
  };

  const confirmDelete = async () => {
    if (!categoryToDelete) return;

    setDeleteConfirmVisible(false);
    try {
      await deleteCategory(categoryToDelete.id);
      showSnackbar("✅ Category Deleted Successfully");
    } catch (e: any) {
      showSnackbar("Failed to delete category.", "error");
    } finally {
      setCategoryToDelete(null);
    }
  };

  const renderItem = ({ item }: { item: AdminCategory }) => {
    const isImage = !!item.iconUrl;

    return (
      <View style={styles.gridItem}>
        {/* Exact same card style as the user home screen */}
        <View style={[styles.categoryIconBg, { backgroundColor: item.backgroundColor || item.bg || "#f1f5f9" }]}>
          {isImage ? (
            <Image
              source={{ uri: item.iconUrl }}
              style={styles.categoryImage}
              contentFit="cover"
            />
          ) : (
            <Ionicons name={(item.icon || "leaf-outline") as any} size={20} color={item.color || "#334155"} />
          )}

          {/* Edit Badge top right */}
          <TouchableOpacity
            style={styles.editBadge}
            onPress={() => openEdit(item)}
            activeOpacity={0.8}
          >
            <Ionicons name="pencil" size={10} color="#22C55E" />
          </TouchableOpacity>
        </View>

        {/* Category Label below card */}
        <Text style={styles.categoryLabel} numberOfLines={2}>
          {item.name}
        </Text>
      </View>
    );
  };

  // Render Shimmer placeholders
  const renderShimmers = () => {
    const dummyArr = Array.from({ length: 8 });
    return (
      <Animated.View style={[styles.shimmerContainer, { opacity: shimmerAnim }]}>
        {dummyArr.map((_, i) => (
          <View key={i} style={styles.gridItem}>
            <View style={[styles.categoryIconBg, { backgroundColor: "#e2e8f0" }]} />
            <View style={styles.shimmerText} />
          </View>
        ))}
      </Animated.View>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />

      {/* Sticky Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.push("/admin/dashboard")} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={24} color="#1e293b" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Shop by Category</Text>
        <TouchableOpacity style={styles.menuBtn} onPress={() => setDrawerOpen(true)} activeOpacity={0.7}>
          <Ionicons name="menu" size={24} color="#1e293b" />
        </TouchableOpacity>
      </View>

      {/* Search Bar */}
      <View style={styles.searchBox}>
        <Ionicons name="search-outline" size={18} color="#94a3b8" />
        <TextInput
          style={[styles.searchInput, { outlineStyle: "none" } as any]}
          placeholder="Search categories..."
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

      {/* List of categories / loader */}
      {loading ? (
        renderShimmers()
      ) : filtered.length === 0 ? (
        <View style={styles.centered}>
          <Text style={styles.emptyIcon}>📂</Text>
          <Text style={styles.emptyTitle}>No Categories Yet</Text>
          <Text style={styles.emptySubtitle}>Tap + to create your first category.</Text>
        </View>
      ) : (
        <FlatList
          numColumns={4}
          data={filtered}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          columnWrapperStyle={styles.columnWrapper}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* Floating Action Button */}
      <TouchableOpacity
        style={[styles.fab, { bottom: insets.bottom + 20 }]}
        onPress={openAdd}
        activeOpacity={0.85}
      >
        <Ionicons name="add" size={28} color="#fff" />
      </TouchableOpacity>

      {/* Custom Snackbar Alerts */}
      {snackbar.visible && (
        <View style={[styles.snackbar, { bottom: insets.bottom + 90 }, snackbar.type === "error" && styles.snackbarError]}>
          <Ionicons name={snackbar.type === "success" ? "checkmark-circle" : "alert-circle"} size={20} color="#fff" />
          <Text style={styles.snackbarText}>{snackbar.message}</Text>
        </View>
      )}

      {/* Add / Edit Sheet Modal */}
      <Modal visible={modalVisible} transparent animationType="slide" onRequestClose={() => setModalVisible(false)}>
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{editingId ? "Edit Category" : "Add Category"}</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)} style={styles.closeBtn}>
                <Ionicons name="close" size={24} color="#64748b" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.modalScroll}>
              {formError ? (
                <View style={styles.formError}>
                  <Ionicons name="alert-circle" size={16} color="#ef4444" />
                  <Text style={styles.formErrorText}>{formError}</Text>
                </View>
              ) : null}

              {/* Input: Category Name */}
              <Text style={styles.fieldLabel}>Category Name *</Text>
              <TextInput
                style={styles.textInput}
                placeholder="e.g. Veggies & Fruits"
                placeholderTextColor="#94a3b8"
                value={form.name}
                onChangeText={(v) => { setForm((f) => ({ ...f, name: v })); setFormError(""); }}
              />

              {/* Upload Icon/Image section */}
              <Text style={styles.fieldLabel}>Category Icon / Image</Text>
              <View style={styles.imageSelectorContainer}>
                {selectedImageUri || uploadedImageUrl ? (
                  <View style={styles.uploadedPreviewContainer}>
                    <Image
                      source={{ uri: selectedImageUri || uploadedImageUrl! }}
                      style={styles.uploadedImagePreview}
                      contentFit="cover"
                    />
                    <TouchableOpacity
                      style={styles.removeImageBtn}
                      onPress={() => {
                        setSelectedImageUri(null);
                        setUploadedImageUrl(null);
                      }}
                    >
                      <Ionicons name="trash-outline" size={16} color="#fff" />
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity style={styles.uploadBox} onPress={pickImage} activeOpacity={0.7}>
                    <Ionicons name="cloud-upload-outline" size={28} color="#22C55E" />
                    <Text style={styles.uploadBoxText}>Upload Custom Icon/Image</Text>
                    <Text style={styles.uploadBoxSub}>Supports JPG, PNG</Text>
                  </TouchableOpacity>
                )}
              </View>

              {/* Fallback Built-in Vector Icon options */}
              {!selectedImageUri && !uploadedImageUrl && (
                <>
                  <Text style={styles.fieldSubLabel}>Or choose a standard vector icon:</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.iconScroll}>
                    {ICON_OPTIONS.map((icon) => (
                      <TouchableOpacity
                        key={icon}
                        style={[styles.iconOption, form.icon === icon && styles.iconOptionSelected]}
                        onPress={() => setForm((f) => ({ ...f, icon }))}
                      >
                        <Ionicons name={icon as any} size={20} color={form.icon === icon ? "#22C55E" : "#64748b"} />
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </>
              )}

              {/* Background Color Picker */}
              <Text style={styles.fieldLabel}>Background Color Picker</Text>
              <View style={styles.colorGrid}>
                {COLOR_OPTIONS.map((opt) => (
                  <TouchableOpacity
                    key={opt.color}
                    style={[
                      styles.colorOption,
                      { backgroundColor: opt.bg },
                      form.backgroundColor === opt.bg && styles.colorOptionSelected,
                    ]}
                    onPress={() => setForm((f) => ({ ...f, backgroundColor: opt.bg, color: opt.color }))}
                  >
                    {form.backgroundColor === opt.bg && <Ionicons name="checkmark" size={14} color={opt.color} />}
                  </TouchableOpacity>
                ))}
              </View>
              
              {/* Custom hex color input */}
              <View style={styles.customColorRow}>
                <Text style={styles.customColorLabel}>Custom Hex Code:</Text>
                <TextInput
                  style={styles.customColorInput}
                  placeholder="#DDF7E7"
                  placeholderTextColor="#94a3b8"
                  value={form.backgroundColor}
                  onChangeText={(v) => setForm((f) => ({ ...f, backgroundColor: v }))}
                />
              </View>

              {/* Display Order */}
              <View style={styles.rowField}>
                <View style={{ flex: 1, marginRight: 16 }}>
                  <Text style={styles.fieldLabel}>Display Order</Text>
                  <TextInput
                    style={styles.textInput}
                    placeholder="e.g. 2"
                    placeholderTextColor="#94a3b8"
                    keyboardType="numeric"
                    value={form.displayOrder}
                    onChangeText={(v) => setForm((f) => ({ ...f, displayOrder: v }))}
                  />
                </View>

                {/* Active / Inactive Toggle */}
                <View style={{ width: 120 }}>
                  <Text style={styles.fieldLabel}>Status (Active)</Text>
                  <View style={styles.toggleRow}>
                    <Text style={[styles.toggleText, { color: form.isActive ? "#22C55E" : "#94a3b8" }]}>
                      {form.isActive ? "Active" : "Inactive"}
                    </Text>
                    <Switch
                      trackColor={{ false: "#e2e8f0", true: "#dcfce7" }}
                      thumbColor={form.isActive ? "#22C55E" : "#cbd5e1"}
                      ios_backgroundColor="#e2e8f0"
                      value={form.isActive}
                      onValueChange={(val) => setForm((f) => ({ ...f, isActive: val }))}
                    />
                  </View>
                </View>
              </View>

              {/* Preview */}
              <Text style={styles.fieldLabel}>Preview</Text>
              <View style={styles.previewContainer}>
                <View style={[styles.previewCard, { backgroundColor: form.backgroundColor || "#f1f5f9" }]}>
                  {selectedImageUri || uploadedImageUrl ? (
                    <Image
                      source={{ uri: selectedImageUri || uploadedImageUrl! }}
                      style={styles.categoryImage}
                      contentFit="cover"
                    />
                  ) : (
                    <Ionicons name={form.icon as any} size={22} color={form.color} />
                  )}
                </View>
                <Text style={styles.previewName}>{form.name || "Category Title"}</Text>
              </View>
            </ScrollView>

            {/* Footer Buttons */}
            <View style={[styles.modalFooter, { paddingBottom: insets.bottom > 0 ? insets.bottom : 12 }]}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setModalVisible(false)}
                disabled={saving}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
                onPress={handleSave}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.saveBtnText}>{editingId ? "Save Changes" : "Save"}</Text>
                )}
              </TouchableOpacity>
            </View>

            {/* Delete button inside modal if editing */}
            {editingId && (
              <TouchableOpacity
                style={[styles.deleteModalBtn, { marginBottom: insets.bottom > 0 ? insets.bottom : 8 }]}
                onPress={handleDeletePress}
                disabled={saving}
              >
                <Ionicons name="trash-outline" size={18} color="#ef4444" />
                <Text style={styles.deleteModalBtnText}>Delete Category</Text>
              </TouchableOpacity>
            )}
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Delete WARNING Modal (Category has products) */}
      <Modal visible={deleteWarningVisible} transparent animationType="fade" onRequestClose={() => setDeleteWarningVisible(false)}>
        <View style={styles.alertOverlay}>
          <View style={styles.alertBox}>
            <View style={styles.alertHeaderIcon}>
              <Ionicons name="warning" size={32} color="#f59e0b" />
            </View>
            <Text style={styles.alertTitle}>Cannot Delete Category</Text>
            <Text style={styles.alertMessage}>{deleteWarningMsg}</Text>
            <TouchableOpacity style={styles.alertConfirmBtn} onPress={() => setDeleteWarningVisible(false)}>
              <Text style={styles.alertConfirmText}>Got it</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Delete CONFIRMATION Modal */}
      <Modal visible={deleteConfirmVisible} transparent animationType="fade" onRequestClose={() => setDeleteConfirmVisible(false)}>
        <View style={styles.alertOverlay}>
          <View style={styles.alertBox}>
            <View style={[styles.alertHeaderIcon, { backgroundColor: "#fef2f2" }]}>
              <Ionicons name="trash" size={32} color="#ef4444" />
            </View>
            <Text style={styles.alertTitle}>Delete Category?</Text>
            <Text style={styles.alertMessage}>
              This action cannot be undone. Are you sure you want to delete category “{categoryToDelete?.name}”?
            </Text>
            <View style={styles.alertBtnRow}>
              <TouchableOpacity style={styles.alertCancelBtn} onPress={() => setDeleteConfirmVisible(false)}>
                <Text style={styles.alertCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.alertDeleteBtn} onPress={confirmDelete}>
                <Text style={styles.alertDeleteText}>Delete</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <AdminDrawer visible={drawerOpen} onClose={() => setDrawerOpen(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8fafc" },
  header: {
    backgroundColor: "#fff",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingBottom: 14,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#f1f5f9",
    justifyContent: "center",
    alignItems: "center",
  },
  menuBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#f1f5f9",
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitle: { flex: 1, fontSize: 16, fontWeight: "800", color: "#1e293b", textAlign: "center" },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    marginHorizontal: 20,
    marginTop: 16,
    marginBottom: 16,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 10,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  searchInput: { flex: 1, fontSize: 14, color: Theme.colors.textDark },
  centered: { flex: 1, justifyContent: "center", alignItems: "center", paddingBottom: 60 },
  emptyIcon: { fontSize: 44, marginBottom: 12 },
  emptyTitle: { fontSize: 16, fontWeight: "700", color: Theme.colors.primaryDark },
  emptySubtitle: { fontSize: 13, color: "#64748b", marginTop: 4 },
  
  // Shimmer container & elements
  shimmerContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: 12,
    rowGap: 14,
  },
  shimmerText: {
    width: 54,
    height: 10,
    backgroundColor: "#e2e8f0",
    borderRadius: 4,
    marginTop: 6,
  },

  // Grid layout (User home screen matches)
  list: {
    paddingHorizontal: 12,
    paddingBottom: 100,
  },
  columnWrapper: {
    justifyContent: "flex-start",
    rowGap: 14,
    marginBottom: 18,
  },
  gridItem: {
    width: "25%",
    alignItems: "center",
    paddingHorizontal: 4,
  },
  categoryIconBg: {
    width: CARD_SIZE,
    height: CARD_SIZE,
    borderRadius: CARD_RADIUS,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 6,
    position: "relative",
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  categoryImage: {
    width: "100%",
    height: "100%",
    borderRadius: CARD_RADIUS,
  },
  categoryLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "#334155",
    textAlign: "center",
    lineHeight: 14,
  },

  editBadge: {
    position: "absolute",
    top: -4,
    right: -4,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "#fff",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 1.5,
    elevation: 3,
  },

  // FAB
  fab: {
    position: "absolute",
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#22C55E",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 6,
    zIndex: 99,
  },

  // Custom Snackbar
  snackbar: {
    position: "absolute",
    left: 20,
    right: 20,
    backgroundColor: "#22C55E",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 5,
    gap: 10,
    zIndex: 999,
  },
  snackbarError: {
    backgroundColor: "#ef4444",
  },
  snackbarText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "700",
  },

  // Modal
  modalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  modalSheet: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 24,
    maxHeight: "92%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  modalTitle: { fontSize: 18, fontWeight: "800", color: Theme.colors.primaryDark },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#f1f5f9",
    justifyContent: "center",
    alignItems: "center",
  },
  modalScroll: {
    paddingBottom: 24,
  },
  formError: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fef2f2",
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    gap: 8,
  },
  formErrorText: { color: "#ef4444", fontSize: 13, fontWeight: "700", flex: 1 },
  fieldLabel: { fontSize: 13, fontWeight: "800", color: "#475569", marginBottom: 8, marginTop: 14 },
  fieldSubLabel: { fontSize: 11, fontWeight: "600", color: "#64748b", marginBottom: 6 },
  textInput: {
    backgroundColor: "#f8fafc",
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 15,
    color: Theme.colors.textDark,
    borderWidth: 1.5,
    borderColor: "#e2e8f0",
  },

  // Image Selector
  imageSelectorContainer: {
    marginBottom: 8,
  },
  uploadBox: {
    borderWidth: 2,
    borderColor: "#cbd5e1",
    borderStyle: "dashed",
    borderRadius: 16,
    paddingVertical: 24,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f8fafc",
  },
  uploadBoxText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#22C55E",
    marginTop: 8,
  },
  uploadBoxSub: {
    fontSize: 10,
    color: "#94a3b8",
    marginTop: 2,
  },
  uploadedPreviewContainer: {
    width: "100%",
    height: 140,
    borderRadius: 16,
    backgroundColor: "#f1f5f9",
    justifyContent: "center",
    alignItems: "center",
    position: "relative",
    overflow: "hidden",
  },
  uploadedImagePreview: {
    width: 100,
    height: 100,
    borderRadius: CARD_RADIUS,
  },
  removeImageBtn: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(239, 68, 68, 0.9)",
    justifyContent: "center",
    alignItems: "center",
  },

  iconScroll: { paddingBottom: 8 },
  iconOption: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: "#f8fafc",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 8,
    borderWidth: 2,
    borderColor: "transparent",
  },
  iconOptionSelected: { borderColor: "#22C55E", backgroundColor: "#dcfce7" },
  
  colorGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 8 },
  colorOption: {
    width: 38,
    height: 38,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  colorOptionSelected: {
    borderWidth: 2,
    borderColor: "#fff",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 4,
  },
  customColorRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
    marginBottom: 8,
  },
  customColorLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: "#64748b",
    marginRight: 8,
  },
  customColorInput: {
    backgroundColor: "#f8fafc",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 6,
    fontSize: 13,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    width: 120,
    color: "#334155",
  },

  rowField: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 8,
  },
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#f8fafc",
    borderWidth: 1.5,
    borderColor: "#e2e8f0",
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    height: 48,
  },
  toggleText: {
    fontSize: 13,
    fontWeight: "700",
    marginRight: 4,
  },

  previewContainer: {
    alignItems: "center",
    paddingVertical: 16,
    backgroundColor: "#f8fafc",
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: "#e2e8f0",
    marginTop: 8,
  },
  previewCard: {
    width: CARD_SIZE,
    height: CARD_SIZE,
    borderRadius: CARD_RADIUS,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  previewName: { fontSize: 12, fontWeight: "700", color: "#334155" },

  modalFooter: {
    flexDirection: "row",
    gap: 12,
    marginTop: 20,
  },
  cancelBtn: {
    flex: 1,
    height: 48,
    borderRadius: 14,
    backgroundColor: "#f1f5f9",
    justifyContent: "center",
    alignItems: "center",
  },
  cancelBtnText: {
    color: "#64748b",
    fontSize: 15,
    fontWeight: "700",
  },
  saveBtn: {
    flex: 2,
    height: 48,
    borderRadius: 14,
    backgroundColor: "#22C55E",
    justifyContent: "center",
    alignItems: "center",
  },
  saveBtnDisabled: {
    opacity: 0.6,
  },
  saveBtnText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "700",
  },
  deleteModalBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fef2f2",
    borderRadius: 14,
    paddingVertical: 12,
    marginTop: 10,
    gap: 6,
  },
  deleteModalBtnText: {
    color: "#ef4444",
    fontSize: 15,
    fontWeight: "700",
  },

  // Alert Dialog Styles (Custom popup modals)
  alertOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  alertBox: {
    backgroundColor: "#fff",
    borderRadius: 24,
    padding: 24,
    width: "100%",
    maxWidth: 320,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
  },
  alertHeaderIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "#fffbeb",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  alertTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#1e293b",
    textAlign: "center",
    marginBottom: 8,
  },
  alertMessage: {
    fontSize: 14,
    color: "#64748b",
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 20,
  },
  alertConfirmBtn: {
    backgroundColor: "#1e293b",
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
    width: "100%",
    alignItems: "center",
  },
  alertConfirmText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 15,
  },
  alertBtnRow: {
    flexDirection: "row",
    gap: 12,
    width: "100%",
  },
  alertCancelBtn: {
    flex: 1,
    backgroundColor: "#f1f5f9",
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
  },
  alertCancelText: {
    color: "#64748b",
    fontWeight: "700",
    fontSize: 14,
  },
  alertDeleteBtn: {
    flex: 1,
    backgroundColor: "#ef4444",
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
  },
  alertDeleteText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 14,
  },
});
