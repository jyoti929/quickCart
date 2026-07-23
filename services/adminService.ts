import {
  collection,
  doc,
  getDocs,
  getDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
  getCountFromServer,
  Unsubscribe,
  QuerySnapshot,
  DocumentData,
  writeBatch,
  setDoc,
} from "firebase/firestore";
import { db, auth, storage } from "./firebase";
import { ref as sRef, uploadBytes, getDownloadURL } from "firebase/storage";
import { Banner } from "./productService";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AdminCategory {
  id: string;
  name: string;
  icon: string;
  color: string;
  bg: string;
  iconUrl?: string;
  backgroundColor?: string;
  displayOrder?: number;
  isActive?: boolean;
  createdAt: any;
  updatedAt: any;
}

export interface AdminProduct {
  id: string;
  name: string;
  categoryId: string;
  description: string;
  imageUrl: string;
  price: number;
  originalPrice?: number;
  stock: number;
  availability: boolean;
  serviceCity: string;
  state: string;
  weight?: string;
  rating?: number;
  eta?: string;
  icon?: string;
  iconColor?: string;
  bg?: string;
  category?: string;
  isActive?: boolean;
  inStock?: boolean;
  isFeatured?: boolean;
  createdAt: any;
  updatedAt: any;
}

export interface AdminState {
  id: string;
  stateName: string;
  isActive: boolean;
  createdAt: any;
  updatedAt: any;
}

export interface AdminCity {
  id: string;
  cityName: string;
  stateId: string;
  state: string; // state name for compatibility
  deliveryAvailable: boolean;
  createdAt: any;
  updatedAt: any;
}

export interface AdminOrder {
  orderId: string;
  uid: string;
  items: Array<{
    productId: number | string;
    name: string;
    price: number;
    quantity: number;
    imageUrl?: string;
  }>;
  totalAmount: number;
  deliveryCharge: number;
  address: string;
  paymentMethod: string;
  deliveryOption: string;
  createdAt: string;
  status: string;
  cancelledAt?: string;
  updatedAt?: string;
}

export interface AdminUser {
  uid: string;
  name: string;
  email: string;
  mobile?: string;
  role?: string;
  createdAt: string;
  completedPermissionFlow?: boolean;
  orderCount?: number;
}

export interface TrendPoint {
  label: string;
  value: number;
  prevValue: number;
}

export interface DailyStat {
  date: string;
  revenue: number;
  ordersCount: number;
}

export interface CategoryStat {
  categoryId: string;
  categoryName: string;
  revenue: number;
  quantity: number;
  color: string;
}

export interface ProductStat {
  name: string;
  quantity: number;
  revenue: number;
  imageUrl?: string;
  stock: number;
}

export interface PaymentMethodStat {
  method: string;
  count: number;
  revenue: number;
}

export interface OrderStatusStat {
  status: string;
  count: number;
  percentage: number;
}

export interface CustomerStats {
  newCustomers: number;
  returningCustomers: number;
  avgOrderValue: number;
  avgBasketSize: number;
}

export interface HourlyStat {
  hour: string;
  count: number;
}

export interface WeeklyStat {
  day: string;
  count: number;
  revenue: number;
}

export interface CityStat {
  city: string;
  revenue: number;
}

export interface DashboardStats {
  totalUsers: number;
  totalOrders: number;
  deliveredOrders: number;
  deliveredRevenue: number;
  totalProducts: number;
  lowStockProducts: number;
  outOfStockProducts: number;
  recentOrders: AdminOrder[];

  revenueGrowth: number;
  ordersGrowth: number;
  customersGrowth: number;
  activeProducts: number;

  dailyStats: DailyStat[];
  topProducts: ProductStat[];
  categoryStats: CategoryStat[];
  paymentStats: PaymentMethodStat[];
  statusStats: OrderStatusStat[];
  customerStats: CustomerStats;
  hourlyStats: HourlyStat[];
  weeklyStats: WeeklyStat[];
  cityStats: CityStat[];
  revenueTrend: TrendPoint[];
}

// ─── Helper ───────────────────────────────────────────────────────────────────

const isAdminUser = (): boolean => !!auth.currentUser;

// ─── Categories ───────────────────────────────────────────────────────────────

export async function seedDefaultCategories(): Promise<void> {
  const batch = writeBatch(db);
  const DEFAULT_CATEGORIES = [
    { id: "Veg", name: "Veggies & Fruits", icon: "leaf-outline", color: "#16a34a", bg: "#dcfce7" },
    { id: "Dairy", name: "Dairy & Bread", icon: "water-outline", color: "#2563eb", bg: "#dbeafe" },
    { id: "Drinks", name: "Cold Drinks", icon: "beer-outline", color: "#ea580c", bg: "#ffedd5" },
    { id: "Snacks", name: "Munchies", icon: "pizza-outline", color: "#b45309", bg: "#fef3c7" },
    { id: "Sweets", name: "Sweet Tooth", icon: "ice-cream-outline", color: "#db2777", bg: "#fce7f3" },
    { id: "Bakery", name: "Bakery", icon: "restaurant-outline", color: "#854d0e", bg: "#fef9c3" },
    { id: "Instant", name: "Instant Foods", icon: "alarm-outline", color: "#7c3aed", bg: "#f3e8ff" },
    { id: "Atta", name: "Atta & Dal", icon: "basket-outline", color: "#0d9488", bg: "#ccfbf1" },
    { id: "Personal", name: "Personal Care", icon: "sparkles-outline", color: "#0891b2", bg: "#cffafe" },
    { id: "Household", name: "Household Items", icon: "home-outline", color: "#4f46e5", bg: "#e0e7ff" }
  ];
  DEFAULT_CATEGORIES.forEach((cat, index) => {
    const docRef = doc(db, "categories", cat.id);
    batch.set(docRef, {
      name: cat.name,
      icon: cat.icon,
      color: cat.color,
      bg: cat.bg,
      backgroundColor: cat.bg,
      isActive: true,
      displayOrder: index + 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  });
  await batch.commit();
}

const mapDocToCategory = (d: DocumentData): AdminCategory => {
  const data = d.data();
  return {
    ...data,
    id: d.id,
    isActive: data.isActive !== undefined ? data.isActive : true,
    displayOrder: data.displayOrder !== undefined ? data.displayOrder : 99,
    backgroundColor: data.backgroundColor || data.bg || "#f1f5f9",
    bg: data.bg || data.backgroundColor || "#f1f5f9",
  } as AdminCategory;
};

export async function getCategories(): Promise<AdminCategory[]> {
  const snap = await getDocs(collection(db, "categories"));
  if (snap.empty) {
    await seedDefaultCategories();
    const newSnap = await getDocs(collection(db, "categories"));
    return newSnap.docs.map(mapDocToCategory);
  }
  return snap.docs.map(mapDocToCategory);
}

export function subscribeCategories(
  cb: (cats: AdminCategory[]) => void,
  onError?: (err: any) => void
): Unsubscribe {
  console.log("[LISTENER:CREATE] subscribeCategories");
  const unsub = onSnapshot(
    collection(db, "categories"),
    (snap) => {
      cb(snap.docs.map(mapDocToCategory));
    },
    (err) => {
      console.error("Error in subscribeCategories listener:", err);
      if (onError) onError(err);
    }
  );
  return () => {
    console.log("[LISTENER:DESTROY] subscribeCategories");
    unsub();
  };
}

export async function addCategory(
  data: Omit<AdminCategory, "id" | "createdAt" | "updatedAt">
): Promise<string> {
  console.log("[Admin] Creating category...", { name: data.name });
  const ref = await addDoc(collection(db, "categories"), {
    ...data,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  console.log("[Admin] Firestore write successful. Document ID:", ref.id);
  return ref.id;
}

export async function updateCategory(
  id: string,
  data: Partial<Omit<AdminCategory, "id" | "createdAt">>
): Promise<void> {
  console.log("[Admin] Updating category...", { id, payload: data });
  await updateDoc(doc(db, "categories", id), {
    ...data,
    updatedAt: serverTimestamp(),
  });
  console.log("[Admin] Firestore update successful. Document ID:", id);
}

export async function deleteCategory(id: string): Promise<void> {
  console.log("[Admin] Deleting category...", { id });
  await deleteDoc(doc(db, "categories", id));
  console.log("[Admin] Firestore delete successful. Document ID:", id);
}

export async function checkCategoryHasProducts(categoryId: string): Promise<boolean> {
  const q = query(
    collection(db, "products"),
    where("categoryId", "==", categoryId),
    limit(1)
  );
  const snap = await getDocs(q);
  if (!snap.empty) return true;

  // Also check legacy "category" string field
  const q2 = query(
    collection(db, "products"),
    where("category", "==", categoryId),
    limit(1)
  );
  const snap2 = await getDocs(q2);
  return !snap2.empty;
}

// ─── Products ────────────────────────────────────────────────────────────────

export async function getAdminProducts(filters?: {
  categoryId?: string;
  serviceCity?: string;
  availability?: boolean;
}): Promise<AdminProduct[]> {
  const q = query(collection(db, "products"), orderBy("name"));
  const snap = await getDocs(q);
  let products = snap.docs.map(
    (d) => ({ ...d.data(), id: d.id } as AdminProduct)
  );

  // Client-side filter (avoids needing extra composite indexes on initial deploy)
  if (filters?.categoryId) {
    products = products.filter((p) => p.categoryId === filters.categoryId);
  }
  if (filters?.serviceCity) {
    products = products.filter((p) =>
      p.serviceCity
        ?.toLowerCase()
        .includes(filters.serviceCity!.toLowerCase())
    );
  }
  if (filters?.availability !== undefined) {
    products = products.filter((p) => p.availability === filters.availability);
  }

  return products;
}

export async function getLowStockProducts(threshold = 10): Promise<AdminProduct[]> {
  const snap = await getDocs(collection(db, "products"));
  return snap.docs
    .map((d) => ({ ...d.data(), id: d.id } as AdminProduct))
    .filter((p) => typeof p.stock === "number" && p.stock < threshold);
}

export async function addAdminProduct(
  data: Omit<AdminProduct, "id" | "createdAt" | "updatedAt">
): Promise<string> {
  try {
    console.log("[Admin] Creating product...", { name: data.name, collection: "products" });
    const productsCol = collection(db, "products");

    const imageUrl = data.imageUrl?.trim() || "";
    const serviceCity = data.serviceCity?.trim() || "";

    const newProductData = {
      ...data,
      images: imageUrl ? [imageUrl] : [],
      discountPrice: data.originalPrice ? Number(data.originalPrice) : Number(data.price),
      cityAvailability: serviceCity.split(",").map(c => c.trim()).filter(Boolean),
      isActive: data.isActive !== undefined ? data.isActive : true,
      inStock: data.inStock !== undefined ? data.inStock : true,
      isFeatured: data.isFeatured !== undefined ? data.isFeatured : false,
      availability: data.isActive !== undefined ? data.isActive : true,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    const docRef = await addDoc(productsCol, newProductData);
    console.log("[Admin] Firestore write successful. Document ID:", docRef.id);
    return docRef.id;
  } catch (error) {
    console.error("[Admin] Firestore write FAILED for product:", error);
    throw error;
  }
}

export async function updateAdminProduct(
  id: string,
  data: Partial<Omit<AdminProduct, "id" | "createdAt">>
): Promise<void> {
  try {
    console.log("[Admin] Updating product...", { id, collection: "products", payload: Object.keys(data) });
    const updateData: any = {
      ...data,
      updatedAt: serverTimestamp(),
    };
    if (data.isActive !== undefined) {
      updateData.availability = data.isActive; // compatibility fallback
    }
    if (data.imageUrl !== undefined) {
      updateData.images = data.imageUrl ? [data.imageUrl] : [];
    }
    if (data.serviceCity !== undefined) {
      updateData.cityAvailability = data.serviceCity.split(",").map(c => c.trim()).filter(Boolean);
    }
    if (data.originalPrice !== undefined || data.price !== undefined) {
      updateData.discountPrice = data.originalPrice ? Number(data.originalPrice) : (data.price ? Number(data.price) : 0);
    }

    await updateDoc(doc(db, "products", id), updateData);
    console.log("[Admin] Firestore update successful. Document ID:", id);
  } catch (error) {
    console.error("[Admin] Firestore update FAILED for product:", error);
    throw error;
  }
}

export async function deleteAdminProduct(id: string): Promise<void> {
  try {
    console.log("[Admin] Deleting product...", { id, collection: "products" });
    await deleteDoc(doc(db, "products", id));
    console.log("[Admin] Firestore delete successful. Document ID:", id);
  } catch (error) {
    console.error("[Admin] Firestore delete FAILED for product:", error);
    throw error;
  }
}

export async function deleteAdminProductsBatch(
  ids: string[],
  onProgress?: (count: number) => void,
  shouldCancel?: { current: boolean }
): Promise<number> {
  try {
    const batchSize = 500;
    const total = ids.length;
    let count = 0;

    for (let i = 0; i < total; i += batchSize) {
      if (shouldCancel && shouldCancel.current) {
        break;
      }

      const chunk = ids.slice(i, i + batchSize);
      const batch = writeBatch(db);

      chunk.forEach((id) => {
        batch.delete(doc(db, "products", id));
      });

      await batch.commit();
      count += chunk.length;
      if (onProgress) onProgress(count);
    }

    return count;
  } catch (error) {
    console.error("Error in deleteAdminProductsBatch:", error);
    throw error;
  }
}

export async function uploadProductImage(uri: string): Promise<string> {
  if (!uri) return "";
  if (uri.startsWith("http://") || uri.startsWith("https://")) {
    return uri; // Already a remote image URL
  }
  try {
    const response = await fetch(uri);
    const blob = await response.blob();
    const filename = uri.split("/").pop() || `${Date.now()}_product.jpg`;
    const imageRef = sRef(storage, `products/${Date.now()}_${filename}`);
    await uploadBytes(imageRef, blob);
    return await getDownloadURL(imageRef);
  } catch (error) {
    console.error("Error uploading image to Firebase Storage:", error);
    throw error;
  }
}

export function subscribeAdminProducts(cb: (products: AdminProduct[]) => void): Unsubscribe {
  const q = query(collection(db, "products"), orderBy("name"));
  console.log("[LISTENER:CREATE] subscribeAdminProducts");
  const unsub = onSnapshot(q, (snap) => {
    cb(snap.docs.map((d) => ({ ...d.data(), id: d.id } as AdminProduct)));
  });
  return () => {
    console.log("[LISTENER:DESTROY] subscribeAdminProducts");
    unsub();
  };
}

// ─── Document Parsers ────────────────────────────────────────────────────────

export function parseStateDoc(d: any): AdminState {
  const data = d.data();
  return {
    ...data,
    id: d.id,
    stateName: data.stateName || data.name || data.readableName || "",
    isActive: data.isActive !== undefined ? !!data.isActive : (data.enabled !== undefined ? !!data.enabled : false),
    createdAt: data.createdAt || data.updatedAt || "",
    updatedAt: data.updatedAt || "",
  };
}

export function parseCityDoc(d: any): AdminCity {
  const data = d.data();

  let stateIdVal = data.stateId || "";
  if (!stateIdVal && data.state) {
    stateIdVal = data.state.toLowerCase().trim().replace(/\s+/g, "_");
  }

  return {
    ...data,
    id: d.id,
    cityName: data.cityName || data.city || data.name || "",
    stateId: stateIdVal,
    state: data.stateName || data.state || "",
    deliveryAvailable: data.deliveryAvailable !== undefined ? !!data.deliveryAvailable : (data.enabled !== undefined ? !!data.enabled : false),
    createdAt: data.createdAt || data.updatedAt || "",
    updatedAt: data.updatedAt || "",
  };
}

// ─── States ──────────────────────────────────────────────────────────────────

export async function getStates(): Promise<AdminState[]> {
  const snap = await getDocs(collection(db, "states"));
  // Auto-seed only when collection is completely empty (first launch)
  if (snap.empty) {
    await seedStatesAndCities().catch(e => console.warn("[Seed] Failed to seed states:", e));
    const seededSnap = await getDocs(collection(db, "states"));
    return seededSnap.docs.map(parseStateDoc);
  }
  return snap.docs.map(parseStateDoc);
}

export function subscribeStates(cb: (states: AdminState[]) => void): Unsubscribe {
  // NOTE: Do NOT call seedStatesAndCities() here — it fires on every component
  // mount and causes unnecessary Firestore reads/writes on every navigation.
  console.log("[LISTENER:CREATE] subscribeStates");
  const unsub = onSnapshot(collection(db, "states"), (snap) => {
    if (snap.empty) {
      // Lazy-seed only when truly empty — fire-and-forget
      seedStatesAndCities().catch(e => console.warn("[Seed] Background seed failed:", e));
    }
    cb(snap.docs.map(parseStateDoc));
  });
  return () => {
    console.log("[LISTENER:DESTROY] subscribeStates");
    unsub();
  };
}

export async function addState(
  data: Omit<AdminState, "id" | "createdAt" | "updatedAt">
): Promise<string> {
  console.log("[Admin] Creating state...", { stateName: data.stateName, collection: "states" });
  const ref = await addDoc(collection(db, "states"), {
    ...data,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  console.log("[Admin] Firestore write successful. Document ID:", ref.id);
  return ref.id;
}

export async function updateState(
  id: string,
  data: Partial<Omit<AdminState, "id" | "createdAt">>
): Promise<void> {
  console.log("[Admin] Updating state...", { id, collection: "states", payload: data });
  await updateDoc(doc(db, "states", id), {
    ...data,
    updatedAt: serverTimestamp(),
  });
  console.log("[Admin] Firestore update successful. Document ID:", id);
}

export async function deleteState(id: string): Promise<void> {
  console.log("[Admin] Deleting state...", { id, collection: "states" });
  await deleteDoc(doc(db, "states", id));
  console.log("[Admin] Firestore delete successful. Document ID:", id);
}

// ─── Cities ──────────────────────────────────────────────────────────────────

export async function getCities(): Promise<AdminCity[]> {
  const snap = await getDocs(collection(db, "cities"));
  return snap.docs.map(parseCityDoc);
}

export function subscribeCities(cb: (cities: AdminCity[]) => void): Unsubscribe {
  // NOTE: Seeding is handled by subscribeStates only — do not seed here
  console.log("[LISTENER:CREATE] subscribeCities");
  const unsub = onSnapshot(collection(db, "cities"), (snap) => {
    cb(snap.docs.map(parseCityDoc));
  });
  return () => {
    console.log("[LISTENER:DESTROY] subscribeCities");
    unsub();
  };
}

export async function addCity(
  data: Omit<AdminCity, "id" | "createdAt" | "updatedAt">
): Promise<string> {
  console.log("[Admin] Creating city...", { cityName: data.cityName, stateId: data.stateId, collection: "cities" });
  const ref = await addDoc(collection(db, "cities"), {
    ...data,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  console.log("[Admin] Firestore write successful. Document ID:", ref.id);
  return ref.id;
}

export async function updateCity(
  id: string,
  data: Partial<Omit<AdminCity, "id" | "createdAt">>
): Promise<void> {
  console.log("[Admin] Updating city...", { id, collection: "cities", payload: data });
  await updateDoc(doc(db, "cities", id), {
    ...data,
    updatedAt: serverTimestamp(),
  });
  console.log("[Admin] Firestore update successful. Document ID:", id);
}

export async function deleteCity(id: string): Promise<void> {
  console.log("[Admin] Deleting city...", { id, collection: "cities" });
  await deleteDoc(doc(db, "cities", id));
  console.log("[Admin] Firestore delete successful. Document ID:", id);
}

// ─── Seed & Migration ─────────────────────────────────────────────────────────

export async function seedStatesAndCities(): Promise<void> {
  try {
    const statesCol = collection(db, "states");
    const statesSnap = await getDocs(statesCol);

    const DEFAULT_STATES = [
      "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh",
      "Goa", "Gujarat", "Haryana", "Himachal Pradesh", "Jharkhand",
      "Karnataka", "Kerala", "Madhya Pradesh", "Maharashtra", "Manipur",
      "Meghalaya", "Mizoram", "Nagaland", "Odisha", "Punjab", "Rajasthan",
      "Sikkim", "Tamil Nadu", "Telangana", "Tripura", "Uttar Pradesh",
      "Uttarakhand", "West Bengal", "Delhi"
    ];

    if (statesSnap.empty) {
      console.log("[Seeding] States collection is empty. Seeding default Indian states...");
      const batch = writeBatch(db);
      const stateMap = new Map<string, string>(); // name -> docId

      for (const stateName of DEFAULT_STATES) {
        const docRef = doc(statesCol);
        batch.set(docRef, {
          stateName,
          isActive: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
        stateMap.set(stateName, docRef.id);
      }
      await batch.commit();
      console.log("[Seeding] States seeded successfully!");

      const citiesCol = collection(db, "cities");
      const citiesSnap = await getDocs(citiesCol);
      if (citiesSnap.empty) {
        console.log("[Seeding] Cities collection is empty. Seeding default cities...");
        const defaultCities = [
          { cityName: "Noida", state: "Uttar Pradesh", deliveryAvailable: true },
          { cityName: "Raipur", state: "Chhattisgarh", deliveryAvailable: true },
          { cityName: "Bengaluru", state: "Karnataka", deliveryAvailable: true },
          { cityName: "Mumbai", state: "Maharashtra", deliveryAvailable: true },
          { cityName: "Delhi", state: "Delhi", deliveryAvailable: true }
        ];

        const cityBatch = writeBatch(db);
        for (const c of defaultCities) {
          const stateId = stateMap.get(c.state) || "";
          if (stateId) {
            const cityDocRef = doc(citiesCol);
            cityBatch.set(cityDocRef, {
              cityName: c.cityName,
              stateId,
              state: c.state,
              deliveryAvailable: c.deliveryAvailable,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString()
            });
          }
        }
        await cityBatch.commit();
        console.log("[Seeding] Default cities seeded successfully!");
      }
    } else {
      // States exist — check if any cities are missing a stateId and migrate them
      const citiesCol = collection(db, "cities");
      const citiesSnap = await getDocs(citiesCol);
      const statesList = statesSnap.docs.map(d => ({ id: d.id, ...d.data() } as any));

      const cityBatch = writeBatch(db);
      let needsMigration = false;

      citiesSnap.forEach(cityDoc => {
        const cityData = cityDoc.data();
        if (!cityData.stateId && cityData.state) {
          const matchingState = statesList.find((s: any) => s.stateName.toLowerCase() === cityData.state.toLowerCase());
          if (matchingState) {
            cityBatch.update(cityDoc.ref, { stateId: matchingState.id });
            needsMigration = true;
          }
        }
      });

      if (needsMigration) {
        await cityBatch.commit();
        console.log("[Migration] Migrated existing cities with matching stateId successfully!");
      }
    }
  } catch (error) {
    console.error("[Seeding/Migration] Error seeding/migrating states and cities:", error);
  }
}

// ─── Fuzzy Match & Availability Check ─────────────────────────────────────────

function normalizeFuzzy(str: string): string {
  if (!str) return "";
  let normalized = str.toLowerCase().trim().replace(/\s+/g, " ");
  // Remove common suffixes anywhere
  const wordsToRemove = ["municipal corporation", "municipality", "district", "city", "nagar"];
  for (const word of wordsToRemove) {
    const regex = new RegExp(`\\b${word}\\b`, "gi");
    normalized = normalized.replace(regex, "");
  }
  return normalized.replace(/\s+/g, " ").trim();
}

function getLevenshteinDistance(a: string, b: string): number {
  const tmp: number[][] = [];
  let i, j, val;
  for (i = 0; i <= a.length; i++) {
    tmp[i] = [i];
  }
  for (j = 1; j <= b.length; j++) {
    tmp[0][j] = j;
  }
  for (i = 1; i <= a.length; i++) {
    for (j = 1; j <= b.length; j++) {
      val = (a[i - 1] === b[j - 1]) ? 0 : 1;
      tmp[i][j] = Math.min(
        tmp[i - 1][j] + 1,
        tmp[i][j - 1] + 1,
        tmp[i - 1][j - 1] + val
      );
    }
  }
  return tmp[a.length][b.length];
}

function getStringSimilarity(s1: string, s2: string): number {
  const longer = s1.length > s2.length ? s1 : s2;
  const shorter = s1.length > s2.length ? s2 : s1;
  if (longer.length === 0) return 1.0;
  return (longer.length - getLevenshteinDistance(longer, shorter)) / longer.length;
}

export function isFuzzyMatch(val1: string, val2: string): { matches: boolean; score: number; norm1: string; norm2: string } {
  const norm1 = normalizeFuzzy(val1);
  const norm2 = normalizeFuzzy(val2);

  if (norm1 === norm2) {
    return { matches: true, score: 1.0, norm1, norm2 };
  }

  // Delhi / New Delhi special case
  const isDelhi1 = norm1 === "delhi" || norm1 === "new delhi";
  const isDelhi2 = norm2 === "delhi" || norm2 === "new delhi";
  if (isDelhi1 && isDelhi2) {
    return { matches: true, score: 1.0, norm1, norm2 };
  }

  // Word containment checks with word boundary
  if (norm1.includes(norm2) || norm2.includes(norm1)) {
    const shorter = norm1.length < norm2.length ? norm1 : norm2;
    const longer = norm1.length < norm2.length ? norm2 : norm1;
    const regex = new RegExp(`\\b${shorter}\\b`);
    if (regex.test(longer)) {
      return { matches: true, score: 1.0, norm1, norm2 };
    }
  }

  const similarity = getStringSimilarity(norm1, norm2);
  if (similarity >= 0.9) {
    return { matches: true, score: similarity, norm1, norm2 };
  }

  return { matches: false, score: similarity, norm1, norm2 };
}

export interface ServiceAvailabilityResult {
  available: boolean;
  reason?: string;
  matchedState?: AdminState;
  matchedCity?: AdminCity;
  debugSummary?: string;
}

export async function checkServiceAvailability(
  detectedStateName: string,
  detectedCityName: string,
  fallbackStates: string[] = [],
  fallbackCities: string[] = [],
  rawCoords?: { latitude: number; longitude: number },
  rawGeocodeResponse?: any
): Promise<ServiceAvailabilityResult> {
  console.log("=== SERVICE AREA VALIDATION FLOW ===");
  console.log(`Raw GPS Coordinates: ${JSON.stringify(rawCoords || "N/A")}`);
  console.log(`Reverse Geocode Response: ${JSON.stringify(rawGeocodeResponse || "N/A")}`);
  console.log(`Detected State: "${detectedStateName}"`);
  console.log(`Detected City: "${detectedCityName}"`);
  console.log(`Detected District: "${rawGeocodeResponse?.address?.district || rawGeocodeResponse?.district || "N/A"}"`);
  console.log(`Detected Subregion: "${rawGeocodeResponse?.address?.subregion || rawGeocodeResponse?.subregion || "N/A"}"`);

  try {
    const statesCol = collection(db, "states");
    const citiesCol = collection(db, "cities");

    const [statesSnap, citiesSnap] = await Promise.all([
      getDocs(statesCol),
      getDocs(citiesCol)
    ]);

    const allStates = statesSnap.docs.map(parseStateDoc);
    const allCities = citiesSnap.docs.map(parseCityDoc);

    const activeStates = allStates.filter(s => s.isActive);
    const activeCities = allCities.filter(c => c.deliveryAvailable);

    const normalizedDetectedState = normalizeFuzzy(detectedStateName);
    const normalizedDetectedCity = normalizeFuzzy(detectedCityName);

    console.log(`Normalized State: "${normalizedDetectedState}"`);
    console.log(`Normalized City: "${normalizedDetectedCity}"`);
    console.log(`Firestore States Loaded: ${allStates.length} (${activeStates.length} active)`);
    console.log(`Firestore Cities Loaded: ${allCities.length} (${activeCities.length} active)`);

    const stateTerms = [detectedStateName, ...fallbackStates].filter(Boolean);
    const cityTerms = [detectedCityName, ...fallbackCities].filter(Boolean);

    console.log(`All state terms to check: ${JSON.stringify(stateTerms)}`);
    console.log(`All city terms to check: ${JSON.stringify(cityTerms)}`);

    let foundStateInDb: AdminState | undefined = undefined;
    for (const term of stateTerms) {
      for (const st of allStates) {
        if (isFuzzyMatch(term, st.stateName).matches) {
          foundStateInDb = st;
          break;
        }
      }
      if (foundStateInDb) break;
    }

    let matchedState: AdminState | undefined = undefined;
    if (foundStateInDb && foundStateInDb.isActive) {
      matchedState = foundStateInDb;
    }

    const stateFoundStr = foundStateInDb ? "YES" : "NO";
    const stateActiveStr = foundStateInDb ? (foundStateInDb.isActive ? "YES" : "NO") : "N/A";

    let foundCityInDb: AdminCity | undefined = undefined;
    if (foundStateInDb) {
      const allCitiesInState = allCities.filter(c => c.stateId === foundStateInDb!.id);
      for (const term of cityTerms) {
        for (const ct of allCitiesInState) {
          if (isFuzzyMatch(term, ct.cityName).matches) {
            foundCityInDb = ct;
            break;
          }
        }
        if (foundCityInDb) break;
      }
    }

    let matchedCity: AdminCity | undefined = undefined;
    if (matchedState && foundCityInDb && foundCityInDb.deliveryAvailable) {
      matchedCity = foundCityInDb;
    }

    const cityFoundStr = foundStateInDb ? (foundCityInDb ? "YES" : "NO") : "N/A";
    const cityActiveStr = foundCityInDb ? (foundCityInDb.deliveryAvailable ? "YES" : "NO") : "N/A";

    const isAvailable = !!(matchedState && matchedCity);
    const resultIcon = isAvailable ? "✅" : "❌";
    const resultStatus = isAvailable ? "Service Available" : "Service Unavailable";

    let failureReason = "";
    if (statesSnap.empty) {
      failureReason = "Firestore states collection is empty.";
    } else if (citiesSnap.empty) {
      failureReason = "Firestore cities collection is empty.";
    } else if (!foundStateInDb) {
      failureReason = `No matching state document found in Firestore for terms: ${JSON.stringify(stateTerms)}.`;
    } else if (!foundStateInDb.isActive) {
      failureReason = `State "${foundStateInDb.stateName}" exists in Firestore but is INACTIVE.`;
    } else if (!foundCityInDb) {
      failureReason = `No matching city document found in Firestore for terms: ${JSON.stringify(cityTerms)} under state "${foundStateInDb.stateName}".`;
    } else if (!foundCityInDb.deliveryAvailable) {
      failureReason = `City "${foundCityInDb.cityName}" exists under state "${foundStateInDb.stateName}" but is INACTIVE.`;
    }

    const debugSummary = `
Detected Location:
State: ${detectedStateName}
City: ${detectedCityName}

Firestore:
State Found: ${stateFoundStr}
State Active: ${stateActiveStr}
City Found: ${cityFoundStr}
City Active: ${cityActiveStr}

Final Result:
${resultIcon} ${resultStatus}
${!isAvailable && failureReason ? `\nReason:\n${failureReason}\n` : ""}
`;

    console.log("=== FINAL SERVICE DECISION ===");
    console.log(debugSummary);
    console.log("===============================");

    return {
      available: isAvailable,
      reason: failureReason || undefined,
      matchedState,
      matchedCity,
      debugSummary
    };
  } catch (error: any) {
    const reason = `Firestore query failed: ${error.message || error}`;
    console.error("[ServiceAvailability] Error checking availability:", error);
    return { available: false, reason };
  }
}

// ─── Orders ──────────────────────────────────────────────────────────────────

export async function getAllOrders(): Promise<AdminOrder[]> {
  const snap = await getDocs(
    query(collection(db, "orders"), orderBy("createdAt", "desc"))
  );
  return snap.docs.map((d) => ({ ...d.data() } as AdminOrder));
}

export function subscribeAllOrders(
  cb: (orders: AdminOrder[]) => void
): Unsubscribe {
  console.log("[LISTENER:CREATE] subscribeAllOrders (adminService)");
  const unsub = onSnapshot(
    query(collection(db, "orders"), orderBy("createdAt", "desc")),
    (snap) => {
      cb(snap.docs.map((d) => ({ ...d.data() } as AdminOrder)));
    }
  );
  return () => {
    console.log("[LISTENER:DESTROY] subscribeAllOrders (adminService)");
    unsub();
  };
}

export async function updateOrderStatus(
  orderId: string,
  status: string
): Promise<void> {
  console.log("[Admin] Updating order status...", { orderId, status });
  await updateDoc(doc(db, "orders", orderId), {
    status,
    updatedAt: serverTimestamp(),
  });
  console.log("[Admin] Firestore update successful. Order ID:", orderId);
}

// ─── Users ───────────────────────────────────────────────────────────────────

export async function getAllUsers(): Promise<AdminUser[]> {
  const snap = await getDocs(collection(db, "users"));
  return snap.docs.map((d) => ({ ...d.data(), uid: d.id } as AdminUser));
}

export function subscribeAllUsers(
  cb: (users: AdminUser[]) => void
): Unsubscribe {
  console.log("[LISTENER:CREATE] subscribeAllUsers");
  const unsub = onSnapshot(collection(db, "users"), (snap) => {
    cb(snap.docs.map((d) => ({ ...d.data(), uid: d.id } as AdminUser)));
  });
  return () => {
    console.log("[LISTENER:DESTROY] subscribeAllUsers");
    unsub();
  };
}

export async function updateAdminUser(
  uid: string,
  data: Partial<AdminUser>
): Promise<void> {
  await updateDoc(doc(db, "users", uid), {
    ...data,
    updatedAt: serverTimestamp(),
  });
}

export async function uploadUserPhoto(uri: string): Promise<string> {
  if (!uri) return "";
  if (uri.startsWith("http://") || uri.startsWith("https://")) {
    return uri;
  }
  try {
    const response = await fetch(uri);
    const blob = await response.blob();
    const filename = uri.split("/").pop() || `${Date.now()}_user.jpg`;
    const imageRef = sRef(storage, `users/${Date.now()}_${filename}`);
    await uploadBytes(imageRef, blob);
    return await getDownloadURL(imageRef);
  } catch (error) {
    console.error("Error uploading user image to Firebase Storage:", error);
    throw error;
  }
}

// ─── Dashboard ───────────────────────────────────────────────────────────────

export async function getDashboardStats(
  filter = "Month",
  customStartDate?: string,
  customEndDate?: string
): Promise<DashboardStats> {
  const [usersCount, ordersCount, productsCount] = await Promise.all([
    getCountFromServer(collection(db, "users")),
    getCountFromServer(collection(db, "orders")),
    getCountFromServer(collection(db, "products")),
  ]);

  const ordersSnap = await getDocs(
    query(collection(db, "orders"), orderBy("createdAt", "desc"))
  );
  const allOrders = ordersSnap.docs.map((d) => d.data() as AdminOrder);

  const [productsSnap, categoriesSnap] = await Promise.all([
    getDocs(collection(db, "products")),
    getDocs(collection(db, "categories"))
  ]);

  const productsList = productsSnap.docs.map(d => ({ id: d.id, ...d.data() } as AdminProduct));
  const categoriesList = categoriesSnap.docs.map(d => ({ id: d.id, ...d.data() } as AdminCategory));

  const productCategoryMap = new Map<string, string>();
  const productImgMap = new Map<string, string>();
  const productStockMap = new Map<string, number>();

  productsList.forEach(p => {
    productCategoryMap.set(p.name, p.categoryId);
    productCategoryMap.set(p.id, p.categoryId);
    productStockMap.set(p.name, p.stock || 0);
    productStockMap.set(p.id, p.stock || 0);
    if (p.imageUrl) {
      productImgMap.set(p.name, p.imageUrl);
    }
  });

  const categoryDetailsMap = new Map<string, { name: string, color: string }>();
  categoriesList.forEach(c => {
    categoryDetailsMap.set(c.id, { name: c.name, color: c.color });
  });

  const getProductCategory = (pId: string | number, name: string) => {
    const fromId = productCategoryMap.get(String(pId));
    if (fromId) return fromId;
    const fromName = productCategoryMap.get(name);
    return fromName || "Unknown";
  };

  const now = new Date();
  let currentStart = new Date();
  let prevStart = new Date();
  let prevEnd = new Date();

  if (filter === "Today") {
    currentStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    prevStart = new Date(currentStart);
    prevStart.setDate(prevStart.getDate() - 1);
    prevEnd = new Date(currentStart);
  } else if (filter === "Week") {
    currentStart = new Date(now);
    currentStart.setDate(currentStart.getDate() - 7);
    prevStart = new Date(currentStart);
    prevStart.setDate(prevStart.getDate() - 7);
    prevEnd = new Date(currentStart);
  } else if (filter === "Month") {
    currentStart = new Date(now);
    currentStart.setDate(currentStart.getDate() - 30);
    prevStart = new Date(currentStart);
    prevStart.setDate(prevStart.getDate() - 30);
    prevEnd = new Date(currentStart);
  } else if (filter === "Year") {
    currentStart = new Date(now);
    currentStart.setDate(currentStart.getDate() - 365);
    prevStart = new Date(currentStart);
    prevStart.setDate(prevStart.getDate() - 365);
    prevEnd = new Date(currentStart);
  } else {
    if (customStartDate && customEndDate) {
      currentStart = new Date(customStartDate);
      const end = new Date(customEndDate);
      const diffTime = Math.abs(end.getTime() - currentStart.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      prevStart = new Date(currentStart);
      prevStart.setDate(prevStart.getDate() - diffDays);
      prevEnd = new Date(currentStart);
    } else {
      currentStart = new Date(now);
      currentStart.setDate(currentStart.getDate() - 90);
      prevStart = new Date(currentStart);
      prevStart.setDate(prevStart.getDate() - 90);
      prevEnd = new Date(currentStart);
    }
  }

  const currentOrders = allOrders.filter(o => {
    if (!o.createdAt) return false;
    const time = new Date(o.createdAt).getTime();
    return time >= currentStart.getTime() && time <= now.getTime();
  });

  const prevOrders = allOrders.filter(o => {
    if (!o.createdAt) return false;
    const time = new Date(o.createdAt).getTime();
    return time >= prevStart.getTime() && time < prevEnd.getTime();
  });

  const totalRevenue = currentOrders
    .filter(o => o.status !== "Cancelled")
    .reduce((sum, o) => sum + (o.totalAmount || 0), 0);

  const prevRevenue = prevOrders
    .filter(o => o.status !== "Cancelled")
    .reduce((sum, o) => sum + (o.totalAmount || 0), 0);

  const totalOrders = currentOrders.length;
  const prevOrdersCount = prevOrders.length;

  const currentUids = new Set(currentOrders.map(o => o.uid));
  const prevUids = new Set(prevOrders.map(o => o.uid));
  const newCustomersCount = currentUids.size;
  const prevCustomersCount = prevUids.size;

  const calculateGrowth = (curr: number, prev: number): number => {
    if (prev <= 0) return curr > 0 ? 100 : 0;
    return parseFloat((((curr - prev) / prev) * 100).toFixed(1));
  };

  const revenueGrowth = calculateGrowth(totalRevenue, prevRevenue);
  const ordersGrowth = calculateGrowth(totalOrders, prevOrdersCount);
  const customersGrowth = calculateGrowth(newCustomersCount, prevCustomersCount);

  const delivered = currentOrders.filter((o) => o.status === "Delivered");
  const deliveredRevenue = delivered.reduce((sum, o) => sum + (o.totalAmount || 0), 0);

  const recentOrders = allOrders.slice(0, 5);

  const activeProducts = productsList.filter(p => p.availability === true).length;
  const lowStockProducts = productsList.filter(p => typeof p.stock === "number" && p.stock < 10 && p.stock > 0).length;
  const outOfStockProducts = productsList.filter(p => typeof p.stock === "number" && p.stock === 0).length;

  const dailyStats: DailyStat[] = [];
  const dateKeys: string[] = [];
  const dateLabels: string[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    dateKeys.push(key);
    const label = d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
    dateLabels.push(label);
    dailyStats.push({ date: label, revenue: 0, ordersCount: 0 });
  }

  currentOrders.forEach(order => {
    if (!order.createdAt) return;
    const oDate = new Date(order.createdAt);
    const key = `${oDate.getFullYear()}-${String(oDate.getMonth() + 1).padStart(2, '0')}-${String(oDate.getDate()).padStart(2, '0')}`;
    const idx = dateKeys.indexOf(key);
    if (idx !== -1) {
      dailyStats[idx].ordersCount += 1;
      if (order.status !== "Cancelled") {
        dailyStats[idx].revenue += (order.totalAmount || 0);
      }
    }
  });

  const revenueTrend: TrendPoint[] = [];
  if (filter === "Today") {
    const hours = [8, 10, 12, 14, 16, 18, 20];
    const hourLabels = ["8 AM", "10 AM", "12 PM", "2 PM", "4 PM", "6 PM", "8 PM"];
    hours.forEach((h, idx) => {
      const val = currentOrders
        .filter(o => o.status !== "Cancelled" && new Date(o.createdAt).getHours() === h)
        .reduce((sum, o) => sum + (o.totalAmount || 0), 0);
      const pVal = prevOrders
        .filter(o => o.status !== "Cancelled" && new Date(o.createdAt).getHours() === h)
        .reduce((sum, o) => sum + (o.totalAmount || 0), 0);
      revenueTrend.push({ label: hourLabels[idx], value: val, prevValue: pVal });
    });
  } else if (filter === "Week") {
    const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const dayName = days[(d.getDay() + 6) % 7];
      const dayDate = d.getDate();
      const val = currentOrders
        .filter(o => o.status !== "Cancelled" && new Date(o.createdAt).getDate() === dayDate)
        .reduce((sum, o) => sum + (o.totalAmount || 0), 0);
      const pD = new Date(prevStart);
      pD.setDate(pD.getDate() + (6 - i));
      const pVal = prevOrders
        .filter(o => o.status !== "Cancelled" && new Date(o.createdAt).getDate() === pD.getDate())
        .reduce((sum, o) => sum + (o.totalAmount || 0), 0);
      revenueTrend.push({ label: dayName, value: val, prevValue: pVal });
    }
  } else if (filter === "Month") {
    for (let i = 4; i >= 0; i--) {
      const label = `Wk ${5 - i}`;
      const dStart = new Date(currentStart);
      dStart.setDate(dStart.getDate() + (i * 6));
      const dEnd = new Date(currentStart);
      dEnd.setDate(dEnd.getDate() + ((i + 1) * 6));

      const val = currentOrders
        .filter(o => {
          if (o.status === "Cancelled") return false;
          const time = new Date(o.createdAt).getTime();
          return time >= dStart.getTime() && time < dEnd.getTime();
        })
        .reduce((sum, o) => sum + (o.totalAmount || 0), 0);

      const pdStart = new Date(prevStart);
      pdStart.setDate(pdStart.getDate() + (i * 6));
      const pdEnd = new Date(prevStart);
      pdEnd.setDate(pdEnd.getDate() + ((i + 1) * 6));

      const pVal = prevOrders
        .filter(o => {
          if (o.status === "Cancelled") return false;
          const time = new Date(o.createdAt).getTime();
          return time >= pdStart.getTime() && time < pdEnd.getTime();
        })
        .reduce((sum, o) => sum + (o.totalAmount || 0), 0);

      revenueTrend.push({ label, value: val, prevValue: pVal });
    }
  } else {
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const mIdx = d.getMonth();
      const val = currentOrders
        .filter(o => o.status !== "Cancelled" && new Date(o.createdAt).getMonth() === mIdx)
        .reduce((sum, o) => sum + (o.totalAmount || 0), 0);
      const pVal = prevOrders
        .filter(o => o.status !== "Cancelled" && new Date(o.createdAt).getMonth() === mIdx)
        .reduce((sum, o) => sum + (o.totalAmount || 0), 0);
      revenueTrend.push({ label: monthNames[mIdx], value: val, prevValue: pVal });
    }
  }

  const productAggregations = new Map<string, { quantity: number, revenue: number, imageUrl?: string }>();
  currentOrders.forEach(order => {
    if (order.status === "Cancelled") return;
    if (!order.items) return;
    order.items.forEach(item => {
      const name = item.name || "Unknown Product";
      const qty = item.quantity || 0;
      const rev = (item.price || 0) * qty;
      const existing = productAggregations.get(name);
      if (existing) {
        existing.quantity += qty;
        existing.revenue += rev;
      } else {
        productAggregations.set(name, {
          quantity: qty,
          revenue: rev,
          imageUrl: item.imageUrl || productImgMap.get(name)
        });
      }
    });
  });

  const topProducts: ProductStat[] = Array.from(productAggregations.entries()).map(([name, agg]) => {
    const stock = productStockMap.get(name) !== undefined ? productStockMap.get(name)! : 0;
    return {
      name,
      quantity: agg.quantity,
      revenue: agg.revenue,
      imageUrl: agg.imageUrl,
      stock
    };
  })
  .sort((a, b) => b.quantity - a.quantity)
  .slice(0, 5);

  const categoryAggregations = new Map<string, { revenue: number, quantity: number }>();
  currentOrders.forEach(order => {
    if (order.status === "Cancelled") return;
    if (!order.items) return;
    order.items.forEach(item => {
      const catId = getProductCategory(item.productId, item.name);
      const qty = item.quantity || 0;
      const rev = (item.price || 0) * qty;
      const existing = categoryAggregations.get(catId);
      if (existing) {
        existing.quantity += qty;
        existing.revenue += rev;
      } else {
        categoryAggregations.set(catId, { quantity: qty, revenue: rev });
      }
    });
  });

  const categoryStats: CategoryStat[] = Array.from(categoryAggregations.entries()).map(([catId, agg]) => {
    const catDetails = categoryDetailsMap.get(catId) || { name: catId, color: "#64748b" };
    return {
      categoryId: catId,
      categoryName: catDetails.name,
      revenue: agg.revenue,
      quantity: agg.quantity,
      color: catDetails.color
    };
  })
  .sort((a, b) => b.revenue - a.revenue);

  const paymentAggregations = new Map<string, { count: number, revenue: number }>();
  currentOrders.forEach(order => {
    const method = order.paymentMethod || "COD";
    const rev = order.status !== "Cancelled" ? (order.totalAmount || 0) : 0;
    const existing = paymentAggregations.get(method);
    if (existing) {
      existing.count += 1;
      existing.revenue += rev;
    } else {
      paymentAggregations.set(method, { count: 1, revenue: rev });
    }
  });

  const paymentStats: PaymentMethodStat[] = Array.from(paymentAggregations.entries()).map(([method, agg]) => ({
    method,
    count: agg.count,
    revenue: agg.revenue
  }))
  .sort((a, b) => b.count - a.count);

  const statusCounts: Record<string, number> = {
    Pending: 0,
    Packed: 0,
    Shipped: 0,
    Delivered: 0,
    Cancelled: 0,
  };
  currentOrders.forEach(o => {
    const status = o.status;
    if (status === "Placed") statusCounts.Pending += 1;
    else if (status === "Confirmed" || status === "Preparing to pack") statusCounts.Packed += 1;
    else if (status === "Package in Transit" || status === "Out for Delivery") statusCounts.Shipped += 1;
    else if (status === "Delivered") statusCounts.Delivered += 1;
    else if (status === "Cancelled") statusCounts.Cancelled += 1;
  });

  const statusStats: OrderStatusStat[] = Object.entries(statusCounts).map(([status, count]) => ({
    status,
    count,
    percentage: totalOrders > 0 ? parseFloat(((count / totalOrders) * 100).toFixed(0)) : 0
  }));

  const totalCustomerOrders = currentOrders.reduce((acc, o) => {
    acc[o.uid] = (acc[o.uid] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const uniqueCustomersCount = Object.keys(totalCustomerOrders).length;
  const returningCustomers = Object.values(totalCustomerOrders).filter(c => c > 1).length;
  const newCustomers = uniqueCustomersCount - returningCustomers;

  const totalDeliveredOrdersCount = currentOrders.filter(o => o.status === "Delivered").length;
  const avgOrderValue = totalDeliveredOrdersCount > 0 ? parseFloat((deliveredRevenue / totalDeliveredOrdersCount).toFixed(0)) : 0;

  const totalItemsSold = currentOrders.reduce((sum, o) => sum + (o.items?.reduce((s, i) => s + (i.quantity || 0), 0) || 0), 0);
  const avgBasketSize = totalOrders > 0 ? parseFloat((totalItemsSold / totalOrders).toFixed(1)) : 0;

  const customerStats: CustomerStats = {
    newCustomers,
    returningCustomers,
    avgOrderValue,
    avgBasketSize
  };

  const hourBuckets = [8, 10, 12, 14, 16, 18, 20];
  const hourLabels = ["8 AM", "10 AM", "12 PM", "2 PM", "4 PM", "6 PM", "8 PM"];
  const hourlyStats: HourlyStat[] = hourLabels.map((hl, i) => {
    const targetHour = hourBuckets[i];
    const count = currentOrders.filter(o => {
      const h = new Date(o.createdAt).getHours();
      return h >= targetHour - 1 && h < targetHour + 1;
    }).length;
    return { hour: hl, count };
  });

  const weekdays = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
  const weeklyStats: WeeklyStat[] = weekdays.map((day, i) => {
    const jsDay = (i + 1) % 7;
    const dayOrders = currentOrders.filter(o => new Date(o.createdAt).getDay() === jsDay);
    const count = dayOrders.length;
    const rev = dayOrders.filter(o => o.status !== "Cancelled").reduce((sum, o) => sum + (o.totalAmount || 0), 0);
    return { day, count, revenue: rev };
  });

  const cities = ["Raipur", "Bilaspur", "Durg", "Korba", "Bhilai"];
  const cityStats: CityStat[] = cities.map(city => {
    const rev = currentOrders
      .filter(o => o.status !== "Cancelled" && (o.address || "").toLowerCase().includes(city.toLowerCase()))
      .reduce((sum, o) => sum + (o.totalAmount || 0), 0);
    return { city, revenue: rev };
  }).sort((a, b) => b.revenue - a.revenue);

  return {
    totalUsers: usersCount.data().count,
    totalOrders: ordersCount.data().count,
    deliveredOrders: delivered.length,
    deliveredRevenue: totalRevenue,
    totalProducts: productsCount.data().count,
    lowStockProducts,
    outOfStockProducts,
    recentOrders,
    revenueGrowth,
    ordersGrowth,
    customersGrowth,
    activeProducts,
    dailyStats,
    topProducts,
    categoryStats,
    paymentStats,
    statusStats,
    customerStats,
    hourlyStats,
    weeklyStats,
    cityStats,
    revenueTrend
  };
}

// ─── Role check ──────────────────────────────────────────────────────────────

export async function isCurrentUserAdmin(): Promise<boolean> {
  const user = auth.currentUser;
  if (!user) return false;
  try {
    const snap = await getDoc(doc(db, "users", user.uid));
    return snap.exists() && snap.data()?.role === "admin";
  } catch {
    return false;
  }
}

export async function disableUserAccount(uid: string, isDisabled: boolean): Promise<void> {
  await updateDoc(doc(db, "users", uid), {
    isDisabled,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteUserAccount(uid: string): Promise<void> {
  await deleteDoc(doc(db, "users", uid));
}

export async function duplicateAdminProduct(product: AdminProduct): Promise<string> {
  const { id, createdAt, updatedAt, ...rest } = product;

  const duplicatePayload = {
    ...rest,
    name: `Copy of ${product.name}`,
    availability: false,
  };

  return await addAdminProduct(duplicatePayload);
}

// ─── Banners CRUD ────────────────────────────────────────────────────────────

export async function addBanner(data: Omit<Banner, "id">): Promise<string> {
  console.log("[Admin] Creating banner...", { title: (data as any).title, collection: "banners" });
  const ref = await addDoc(collection(db, "banners"), {
    ...data,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  console.log("[Admin] Firestore write successful. Document ID:", ref.id);
  return ref.id;
}

export async function updateBanner(id: string, data: Partial<Omit<Banner, "id">>): Promise<void> {
  console.log("[Admin] Updating banner...", { id, collection: "banners", payload: Object.keys(data) });
  await updateDoc(doc(db, "banners", id), {
    ...data,
    updatedAt: serverTimestamp(),
  });
  console.log("[Admin] Firestore update successful. Document ID:", id);
}

export async function deleteBanner(id: string): Promise<void> {
  console.log("[Admin] Deleting banner...", { id, collection: "banners" });
  await deleteDoc(doc(db, "banners", id));
  console.log("[Admin] Firestore delete successful. Document ID:", id);
}
