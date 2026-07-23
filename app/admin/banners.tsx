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
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { storage, db } from "../../services/firebase";
import { doc, setDoc, onSnapshot, collection } from "firebase/firestore";
import { Theme } from "../../constants/theme";
import AdminDrawer from "../../components/AdminDrawer";
import { Banner } from "../../services/productService";
import {
  addBanner,
  updateBanner,
  deleteBanner,
} from "../../services/adminService";

const { width } = Dimensions.get("window");

const BG_COLOR_OPTIONS = [
  "#0f766e", "#ea580c", "#2563eb", "#db2777", "#7c3aed", "#16a34a", "#4f46e5", "#b45309", "#0891b2"
];

interface BannerFormState {
  title: string;
  tag: string;
  couponCode: string;
  backgroundColor: string;
  isActive: boolean;
}

const EMPTY_FORM: BannerFormState = {
  title: "",
  tag: "",
  couponCode: "",
  backgroundColor: "#0f766e",
  isActive: true,
};

export default function AdminBanners() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [banners, setBanners] = useState<Banner[]>([]);
  const [filtered, setFiltered] = useState<Banner[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Modals & Sheets
  const [modalVisible, setModalVisible] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<BannerFormState>(EMPTY_FORM);
  const [selectedImageUri, setSelectedImageUri] = useState<string | null>(null);
  const [uploadedImageUrl, setUploadedImageUrl] = useState<string | null>(null);
  const [formError, setFormError] = useState("");

  // Custom Snackbar Alert
  const [snackbar, setSnackbar] = useState<{ visible: boolean; message: string; type: "success" | "error" }>({
    visible: false,
    message: "",
    type: "success",
  });

  const shimmerAnim = useRef(new Animated.Value(0.3)).current;

  const showSnackbar = (message: string, type: "success" | "error" = "success") => {
    setSnackbar({ visible: true, message, type });
    setTimeout(() => {
      setSnackbar((prev) => ({ ...prev, visible: false }));
    }, 3000);
  };

  // Real-time listener for banners
  useEffect(() => {
    setLoading(true);
    const q = collection(db, "banners");
    const unsubscribe = onSnapshot(q, (snap) => {
      const list = snap.docs.map((d) => ({
        ...d.data(),
        id: d.id,
        isActive: d.data().isActive !== false,
      } as Banner));
      setBanners(list);
      setLoading(false);
    }, (err) => {
      console.error("Banners query error:", err);
      setLoading(false);
      showSnackbar("Failed to fetch banners.", "error");
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
      setFiltered(banners);
    } else {
      const sLower = search.toLowerCase();
      setFiltered(
        banners.filter((b) =>
          b.title.toLowerCase().includes(sLower) ||
          b.tag.toLowerCase().includes(sLower) ||
          (b.couponCode && b.couponCode.toLowerCase().includes(sLower))
        )
      );
    }
  }, [search, banners]);

  const pickImage = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permission Denied", "We need photo library permissions to upload banner graphics.");
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [16, 9],
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        setSelectedImageUri(result.assets[0].uri);
        setUploadedImageUrl(null);
      }
    } catch (err) {
      console.error("Image pick error:", err);
      showSnackbar("Failed to pick image.", "error");
    }
  };

  const uploadImageToStorage = async (uri: string): Promise<string> => {
    const response = await fetch(uri);
    const blob = await response.blob();
    const filename = `banners/banner_${Date.now()}.jpg`;
    const storageRef = ref(storage, filename);
    await uploadBytes(storageRef, blob);
    return await getDownloadURL(storageRef);
  };

  const openAdd = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setSelectedImageUri(null);
    setUploadedImageUrl(null);
    setFormError("");
    setModalVisible(true);
  };

  const openEdit = (b: Banner) => {
    setEditingId(b.id);
    setForm({
      title: b.title || "",
      tag: b.tag || "",
      couponCode: b.couponCode || "",
      backgroundColor: b.backgroundColor || "#0f766e",
      isActive: b.isActive !== false,
    });
    setSelectedImageUri(null);
    setUploadedImageUrl(b.imageUrl || null);
    setFormError("");
    setModalVisible(true);
  };

  const handleSave = async () => {
    if (!form.title.trim()) {
      setFormError("Banner Title is required.");
      return;
    }
    if (!form.tag.trim()) {
      setFormError("Banner Subtitle/Tag is required.");
      return;
    }

    setSaving(true);
    setFormError("");

    try {
      let finalImageUrl = uploadedImageUrl;

      if (selectedImageUri) {
        finalImageUrl = await uploadImageToStorage(selectedImageUri);
      }

      const bannerData = {
        title: form.title.trim(),
        tag: form.tag.trim(),
        couponCode: form.couponCode.trim().toUpperCase(),
        backgroundColor: form.backgroundColor,
        isActive: form.isActive,
        imageUrl: finalImageUrl || "",
        updatedAt: new Date().toISOString(),
      };

      if (editingId) {
        await updateBanner(editingId, bannerData);
        showSnackbar("✅ Banner Updated Successfully");
      } else {
        await addBanner(bannerData);
        showSnackbar("✅ Banner Added Successfully");
      }

      setModalVisible(false);
    } catch (e: any) {
      console.error("Save banner error:", e);
      setFormError(e.message || "Failed to save banner.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    Alert.alert(
      "Confirm Delete",
      "Are you sure you want to delete this promotional banner?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteBanner(id);
              showSnackbar("✅ Banner Deleted Successfully");
            } catch (err: any) {
              console.error("Delete banner error:", err);
              showSnackbar("Failed to delete banner.", "error");
            }
          },
        },
      ]
    );
  };

  const handleToggleActive = async (b: Banner, currentVal: boolean) => {
    try {
      await updateBanner(b.id, { isActive: !currentVal });
      showSnackbar(`✅ Banner ${!currentVal ? "Activated" : "Deactivated"} Successfully`);
    } catch (err) {
      showSnackbar("Failed to toggle status.", "error");
    }
  };

  const renderItem = ({ item }: { item: Banner }) => {
    const hasImage = !!item.imageUrl;

    return (
      <View style={styles.card}>
        <View
          style={[
            styles.bannerBg,
            { backgroundColor: item.backgroundColor || "#0f766e" },
          ]}
        >
          {hasImage ? (
            <Image
              source={{ uri: item.imageUrl }}
              style={styles.bannerImage}
              contentFit="cover"
            />
          ) : null}

          <View style={styles.bannerContent}>
            <View style={styles.tagWrapper}>
              <Text style={styles.bannerTag} numberOfLines={1}>{item.tag}</Text>
            </View>
            <Text style={styles.bannerTitle} numberOfLines={2}>{item.title}</Text>
            
            {item.couponCode ? (
              <View style={styles.couponWrapper}>
                <Text style={styles.couponLabel}>USE CODE: </Text>
                <Text style={styles.couponCode}>{item.couponCode}</Text>
              </View>
            ) : null}
          </View>
        </View>

        <View style={styles.actionRow}>
          <View style={styles.toggleContainer}>
            <Switch
              value={item.isActive !== false}
              onValueChange={() => handleToggleActive(item, item.isActive !== false)}
              trackColor={{ false: "#cbd5e1", true: "#86efac" }}
              thumbColor={item.isActive !== false ? Theme.colors.primary : "#94a3b8"}
              ios_backgroundColor="#cbd5e1"
              style={{ transform: [{ scaleX: 0.8 }, { scaleY: 0.8 }] }}
            />
            <Text style={[styles.statusText, { color: item.isActive !== false ? "#16a34a" : "#ef4444" }]}>
              {item.isActive !== false ? "Active" : "Inactive"}
            </Text>
          </View>

          <View style={styles.btnGroup}>
            <TouchableOpacity
              style={styles.actionBtn}
              onPress={() => openEdit(item)}
              activeOpacity={0.7}
            >
              <Ionicons name="pencil" size={16} color={Theme.colors.primary} />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionBtn, styles.deleteBtn]}
              onPress={() => handleDelete(item.id)}
              activeOpacity={0.7}
            >
              <Ionicons name="trash-outline" size={16} color={Theme.colors.error} />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  };

  const renderShimmers = () => {
    return (
      <Animated.View style={{ opacity: shimmerAnim, padding: 16, gap: 16 }}>
        {[1, 2].map((i) => (
          <View key={i} style={[styles.card, { height: 180, backgroundColor: "#e2e8f0" }]} />
        ))}
      </Animated.View>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />

      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.push("/admin/dashboard")} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={24} color="#1e293b" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Promotional Banners</Text>
        <TouchableOpacity style={styles.menuBtn} onPress={() => setDrawerOpen(true)} activeOpacity={0.7}>
          <Ionicons name="menu" size={24} color="#1e293b" />
        </TouchableOpacity>
      </View>

      {/* Search box */}
      <View style={styles.searchBox}>
        <Ionicons name="search-outline" size={18} color="#94a3b8" />
        <TextInput
          style={[styles.searchInput, { outlineStyle: "none" } as any]}
          placeholder="Search banners by title or tag..."
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

      {/* Content list */}
      {loading ? (
        renderShimmers()
      ) : filtered.length === 0 ? (
        <View style={styles.centered}>
          <MaterialCommunityIcons name="image-off-outline" size={64} color="#94a3b8" />
          <Text style={styles.emptyTitle}>No Promo Banners</Text>
          <Text style={styles.emptySubtitle}>Add banners to advertise offers on the User App.</Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* FAB */}
      <TouchableOpacity
        style={[styles.fab, { bottom: insets.bottom + 20 }]}
        onPress={openAdd}
        activeOpacity={0.85}
      >
        <Ionicons name="add" size={28} color="#fff" />
      </TouchableOpacity>

      {/* Modal form */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.modalBg}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {editingId ? "Edit Promo Banner" : "Add Promo Banner"}
              </Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Ionicons name="close" size={24} color="#1e293b" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalScroll} showsVerticalScrollIndicator={false}>
              {formError ? <Text style={styles.errorText}>{formError}</Text> : null}

              {/* Graphic upload */}
              <TouchableOpacity
                style={styles.imageSelector}
                onPress={pickImage}
                activeOpacity={0.8}
              >
                {selectedImageUri ? (
                  <Image source={{ uri: selectedImageUri }} style={styles.imagePreview} contentFit="cover" />
                ) : uploadedImageUrl ? (
                  <Image source={{ uri: uploadedImageUrl }} style={styles.imagePreview} contentFit="cover" />
                ) : (
                  <View style={styles.imagePlaceholder}>
                    <Ionicons name="cloud-upload-outline" size={32} color={Theme.colors.primary} />
                    <Text style={styles.imagePlaceholderText}>Upload Banner Graphic (16:9)</Text>
                    <Text style={styles.imagePlaceholderSub}>Leaves background color if blank</Text>
                  </View>
                )}
              </TouchableOpacity>

              <Text style={styles.inputLabel}>Banner Title *</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. Up to 40% Off on Ice Cream & Juices"
                value={form.title}
                onChangeText={(v) => setForm((prev) => ({ ...prev, title: v }))}
              />

              <Text style={styles.inputLabel}>Subtitle/Tag *</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. SUMMER COOLERS FESTIVAL"
                value={form.tag}
                onChangeText={(v) => setForm((prev) => ({ ...prev, tag: v }))}
              />

              <Text style={styles.inputLabel}>Coupon Code (Optional)</Text>
              <TextInput
                style={[styles.input, { textTransform: "uppercase" }]}
                placeholder="e.g. COLD40"
                value={form.couponCode}
                onChangeText={(v) => setForm((prev) => ({ ...prev, couponCode: v }))}
              />

              <Text style={styles.inputLabel}>Fallback Background Color</Text>
              <View style={styles.colorPalette}>
                {BG_COLOR_OPTIONS.map((c) => {
                  const isSelected = form.backgroundColor === c;
                  return (
                    <TouchableOpacity
                      key={c}
                      style={[
                        styles.colorCircle,
                        { backgroundColor: c },
                        isSelected && styles.colorCircleSelected,
                      ]}
                      onPress={() => setForm((prev) => ({ ...prev, backgroundColor: c }))}
                    />
                  );
                })}
              </View>

              <View style={styles.switchRow}>
                <View>
                  <Text style={styles.switchTitle}>Active Status</Text>
                  <Text style={styles.switchSubtitle}>Display banner to customers immediately</Text>
                </View>
                <Switch
                  value={form.isActive}
                  onValueChange={(v) => setForm((prev) => ({ ...prev, isActive: v }))}
                  trackColor={{ false: "#cbd5e1", true: "#86efac" }}
                  thumbColor={form.isActive ? Theme.colors.primary : "#94a3b8"}
                />
              </View>
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setModalVisible(false)}
                disabled={saving}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.saveBtn}
                onPress={handleSave}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.saveBtnText}>Save Banner</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Snackbar Alert */}
      {snackbar.visible && (
        <View style={[styles.snackbar, { bottom: insets.bottom + 20 }, snackbar.type === "error" && styles.snackbarError]}>
          <Ionicons name={snackbar.type === "success" ? "checkmark-circle" : "alert-circle"} size={20} color="#fff" />
          <Text style={styles.snackbarText}>{snackbar.message}</Text>
        </View>
      )}

      {/* Drawer */}
      <AdminDrawer visible={drawerOpen} onClose={() => setDrawerOpen(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
  header: {
    backgroundColor: "#ffffff",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },
  backBtn: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#0f172a",
  },
  menuBtn: {
    padding: 4,
  },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ffffff",
    margin: 16,
    paddingHorizontal: 12,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: "#1e293b",
    paddingVertical: 8,
  },
  list: {
    padding: 16,
    paddingBottom: 100,
    gap: 16,
  },
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    elevation: 2,
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
  },
  bannerBg: {
    height: 150,
    position: "relative",
    justifyContent: "center",
  },
  bannerImage: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.9,
  },
  bannerContent: {
    padding: 16,
    zIndex: 1,
  },
  tagWrapper: {
    alignSelf: "flex-start",
    backgroundColor: "rgba(255,255,255,0.2)",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    marginBottom: 6,
  },
  bannerTag: {
    fontSize: 10,
    fontWeight: "800",
    color: "#ffffff",
    letterSpacing: 0.5,
  },
  bannerTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#ffffff",
    maxWidth: "80%",
    lineHeight: 22,
  },
  couponWrapper: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 8,
  },
  couponLabel: {
    fontSize: 10,
    color: "rgba(255,255,255,0.8)",
  },
  couponCode: {
    fontSize: 11,
    fontWeight: "800",
    color: "#ffffff",
    backgroundColor: "rgba(0,0,0,0.2)",
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 3,
    letterSpacing: 0.5,
  },
  actionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: "#f1f5f9",
  },
  toggleContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  statusText: {
    fontSize: 12,
    fontWeight: "600",
  },
  btnGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  actionBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: "#f1f5f9",
    alignItems: "center",
    justifyContent: "center",
  },
  deleteBtn: {
    backgroundColor: "#fee2e2",
  },
  fab: {
    position: "absolute",
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Theme.colors.primary,
    alignItems: "center",
    justifyContent: "center",
    elevation: 4,
    shadowColor: Theme.colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 5,
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#475569",
    marginTop: 16,
  },
  emptySubtitle: {
    fontSize: 14,
    color: "#94a3b8",
    textAlign: "center",
    marginTop: 8,
    lineHeight: 20,
  },
  modalBg: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "#ffffff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    height: "85%",
    padding: 20,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#0f172a",
  },
  modalScroll: {
    flex: 1,
    paddingTop: 16,
  },
  errorText: {
    color: Theme.colors.error,
    fontSize: 14,
    fontWeight: "600",
    backgroundColor: "#fee2e2",
    padding: 10,
    borderRadius: 8,
    marginBottom: 16,
  },
  imageSelector: {
    height: 150,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: "#cbd5e1",
    borderStyle: "dashed",
    overflow: "hidden",
    marginBottom: 16,
  },
  imagePreview: {
    width: "100%",
    height: "100%",
  },
  imagePlaceholder: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f8fafc",
  },
  imagePlaceholderText: {
    fontSize: 13,
    fontWeight: "600",
    color: Theme.colors.primary,
    marginTop: 8,
  },
  imagePlaceholderSub: {
    fontSize: 11,
    color: "#94a3b8",
    marginTop: 2,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#475569",
    marginBottom: 6,
  },
  input: {
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 8,
    paddingHorizontal: 12,
    height: 44,
    fontSize: 14,
    color: "#1e293b",
    marginBottom: 16,
  },
  colorPalette: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 16,
  },
  colorCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: "transparent",
  },
  colorCircleSelected: {
    borderColor: "#000000",
  },
  switchRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#f8fafc",
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    marginBottom: 24,
  },
  switchTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: "#1e293b",
  },
  switchSubtitle: {
    fontSize: 11,
    color: "#64748b",
  },
  modalFooter: {
    flexDirection: "row",
    gap: 12,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
  },
  cancelBtn: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    alignItems: "center",
    justifyContent: "center",
  },
  cancelBtnText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#475569",
  },
  saveBtn: {
    flex: 2,
    height: 48,
    borderRadius: 12,
    backgroundColor: Theme.colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  saveBtnText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#ffffff",
  },
  snackbar: {
    position: "absolute",
    left: 20,
    right: 20,
    backgroundColor: "#1e293b",
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: 8,
    gap: 8,
    zIndex: 9999,
  },
  snackbarError: {
    backgroundColor: Theme.colors.error,
  },
  snackbarText: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "500",
  },
});
