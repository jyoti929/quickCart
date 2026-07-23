import { auth, db } from "./firebase";
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut,
  sendPasswordResetEmail,
} from "firebase/auth";
import { doc, getDoc, setDoc, collection, query, where, getDocs, updateDoc, deleteDoc, writeBatch, serverTimestamp, onSnapshot, Unsubscribe } from "firebase/firestore";
import { Alert } from "react-native";

export interface User {
  name: string;
  email: string;
  password?: string;
}

export interface Address {
  addressId: string;
  fullName: string;
  mobile: string;
  houseNo: string;
  building?: string;
  street: string;
  landmark?: string;
  city: string;
  state: string;
  pinCode: string;
  addressType: "Home" | "Work" | "Other";
  latitude?: number | null;
  longitude?: number | null;
  isDefault: boolean;
  createdAt?: string;
  updatedAt?: string;
}

class AuthStore {
  private currentUser: User | null = null;
  private selectedAddressId: string | null = null;
  private selectedAddress: Address | null = null;

  // Blocked account status
  private isBlocked: boolean = false;

  // Permission onboarding flow states
  private notificationsAllowed: boolean = false;
  private locationAllowed: boolean = false;
  private detectedState: string = "Default";
  private currentAddress: string = "Enable location for delivery ETA";
  private completedPermissionFlow: boolean = false;

  // Global cart management
  private cart: Map<number, number> = new Map();
  private cartListeners: Set<() => void> = new Set();

  setIsBlocked(val: boolean) {
    this.isBlocked = val;
    this.notifyCartListeners();
  }

  getIsBlocked(): boolean {
    return this.isBlocked;
  }



  // Register user directly with Email and Password
  async signUp(name: string, email: string, password: string, mobile?: string): Promise<User | null> {
    const targetEmail = email.trim();
    if (!password) throw new Error("Password is required for registration.");

    // 1. Create account in Firebase Auth
    const userCredential = await createUserWithEmailAndPassword(auth, targetEmail, password);
    const uid = userCredential.user.uid;

    // 2. Save details in Cloud Firestore in "users" collection (excluding password)
    const userProfile: User = {
      name: name.trim(),
      email: targetEmail
    };

    await setDoc(doc(db, "users", uid), {
      name: userProfile.name,
      email: userProfile.email,
      mobile: mobile ? mobile.trim() : null,
      uid: uid,
      createdAt: new Date().toISOString(),
      completedPermissionFlow: false
    });

    this.currentUser = userProfile;
    return this.currentUser;
  }

  // Legacy registerUser stub for compilation compatibility
  async registerUser(): Promise<User | null> {
    return this.currentUser;
  }

  // Login verification using Firebase Auth
  async verifyUser(email: string, password: string): Promise<User | null> {
    try {
      const targetEmail = email.trim();
      const userCredential = await signInWithEmailAndPassword(auth, targetEmail, password);
      const uid = userCredential.user.uid;

      // Fetch user details from Cloud Firestore
      const userDoc = await getDoc(doc(db, "users", uid));
      if (userDoc.exists()) {
        const data = userDoc.data();
        this.currentUser = {
          name: data.name || "User",
          email: data.email || targetEmail
        };
        if (data.currentAddress) {
          this.currentAddress = data.currentAddress;
        }
        if (data.detectedState) {
          this.detectedState = data.detectedState;
        }
        if (data.completedPermissionFlow !== undefined) {
          this.completedPermissionFlow = data.completedPermissionFlow;
        }
      } else {
        // Fallback if firestore document doesn't exist
        this.currentUser = {
          name: userCredential.user.displayName || "User",
          email: userCredential.user.email || targetEmail
        };
      }

      return this.currentUser;
    } catch (err: any) {
      // Map error to user-friendly error message
      const friendlyMessage = this.getFriendlyError(err);
      throw new Error(friendlyMessage);
    }
  }

  private getFriendlyError(error: any): string {
    const code = error.code || "";
    const msg = error.message || "";
    
    if (code === "auth/invalid-credential" || msg.includes("invalid-credential")) {
      return "Incorrect email or password. Please check your credentials.";
    }
    if (code === "auth/user-not-found" || msg.includes("user-not-found")) {
      return "No account found with this email.";
    }
    if (code === "auth/wrong-password" || msg.includes("wrong-password")) {
      return "Incorrect password. Please try again.";
    }
    if (code === "auth/too-many-requests" || msg.includes("too-many-requests")) {
      return "Too many failed attempts. Please try again later.";
    }
    if (code === "auth/user-disabled" || msg.includes("user-disabled")) {
      return "This account has been disabled. Please contact support.";
    }
    if (code === "auth/invalid-email" || msg.includes("invalid-email")) {
      return "Please enter a valid email address.";
    }
    if (code === "auth/network-request-failed" || msg.includes("network-request-failed")) {
      return "Network error. Please check your internet connection and try again.";
    }
    return error.message || "An unexpected error occurred. Please try again.";
  }

  // Forgot password update (returns true if user exists to let flow succeed)
  async resetPassword(email: string, newPassword: string): Promise<boolean> {
    const exists = await this.hasUser(email);
    return exists;
  }

  // Send password reset email via Firebase Auth
  async sendPasswordReset(email: string): Promise<void> {
    const targetEmail = email.trim();
    const exists = await this.hasUser(targetEmail);
    if (!exists) {
      throw new Error("No account found with this email.");
    }
    await sendPasswordResetEmail(auth, targetEmail);
  }

  // Check if a user with given email exists
  async hasUser(email: string): Promise<boolean> {
    const trimmed = email.trim();
    const usersRef = collection(db, "users");
    const q = query(usersRef, where("email", "==", trimmed));
    const querySnapshot = await getDocs(q);
    return !querySnapshot.empty;
  }

  // Set the current user manually (used when restoring auth session)
  setCurrentUser(user: User | null) {
    this.currentUser = user;
  }

  // Get current logged-in user details
  getCurrentUser(): User | null {
    return this.currentUser;
  }

  // Permission Flow Getters/Setters
  setNotificationsAllowed(val: boolean) {
    this.notificationsAllowed = val;
  }

  getNotificationsAllowed(): boolean {
    return this.notificationsAllowed;
  }

  setLocationAllowed(val: boolean) {
    this.locationAllowed = val;
  }

  getLocationAllowed(): boolean {
    return this.locationAllowed;
  }

  setDetectedState(val: string) {
    this.detectedState = val;
    this.syncLocationToFirestore();
  }

  getDetectedState(): string {
    return this.detectedState;
  }

  setCurrentAddress(val: string) {
    this.currentAddress = val;
    this.syncLocationToFirestore();
  }

  getCurrentAddress(): string {
    return this.currentAddress;
  }

  setCompletedPermissionFlow(val: boolean) {
    this.completedPermissionFlow = val;
    this.syncLocationToFirestore();
  }

  hasCompletedPermissionFlow(): boolean {
    return this.completedPermissionFlow;
  }

  private async syncLocationToFirestore() {
    const user = auth.currentUser;
    if (user) {
      try {
        await setDoc(doc(db, "users", user.uid), {
          currentAddress: this.currentAddress,
          detectedState: this.detectedState,
          completedPermissionFlow: this.completedPermissionFlow
        }, { merge: true });
      } catch (e) {
        console.warn("Failed to sync location to Firestore:", e);
      }
    }
  }

  // Global Cart store methods
  getCart(): { [key: number]: number } {
    const obj: { [key: number]: number } = {};
    this.cart.forEach((qty, id) => {
      obj[id] = qty;
    });
    return obj;
  }

  updateCart(productId: number, change: number) {
    if (this.isBlocked) {
      Alert.alert(
        "Account Blocked",
        "Your account has been temporarily blocked. You cannot place orders until your account is restored."
      );
      return;
    }
    const current = this.cart.get(productId) || 0;
    const next = Math.max(0, current + change);
    if (next === 0) {
      this.cart.delete(productId);
    } else {
      this.cart.set(productId, next);
    }
    this.notifyCartListeners();
  }

  clearCart() {
    if (this.isBlocked) {
      Alert.alert(
        "Account Blocked",
        "Your account has been temporarily blocked. You cannot place orders until your account is restored."
      );
      return;
    }
    this.cart.clear();
    this.notifyCartListeners();
  }

  subscribeCart(listener: () => void) {
    this.cartListeners.add(listener);
    return () => {
      this.cartListeners.delete(listener);
    };
  }

  private notifyCartListeners() {
    this.cartListeners.forEach((listener) => listener());
  }

  private isCompleteDeliveryAddress(address: string): boolean {
    const cleaned = (address || "").trim();
    const lowered = cleaned.toLowerCase();
    if (!cleaned || cleaned.length < 20) return false;
    if (lowered.includes("enable location") || lowered.includes("no address")) return false;
    return /\d/.test(cleaned);
  }

  // Place an order in Firestore
  async placeOrder(orderDetails: {
    items: Array<{
      productId: number;
      name: string;
      price: number;
      quantity: number;
      imageUrl?: string;
    }>;
    totalAmount: number;
    deliveryCharge: number;
    address: string;
    deliveryAddress?: {
      fullName: string;
      mobile: string;
      houseNo: string;
      building?: string;
      street: string;
      landmark?: string;
      city: string;
      state: string;
      pinCode: string;
      addressType?: string;
      latitude?: number | null;
      longitude?: number | null;
    };
    paymentMethod: string;
    deliveryOption: string;
  }): Promise<string> {
    const user = auth.currentUser;
    if (!user) throw new Error("You must be logged in to place an order.");

    // Checkout Protection: validate latest block status
    if (this.isBlocked) {
      throw new Error("Your account has been temporarily blocked. You cannot place orders until your account is restored.");
    }
    const userDoc = await getDoc(doc(db, "users", user.uid));
    if (userDoc.exists() && userDoc.data()?.isBlocked === true) {
      this.isBlocked = true;
      throw new Error("Your account has been temporarily blocked. You cannot place orders until your account is restored.");
    }

    const deliveryAddress = orderDetails.address.trim();
    if (!this.isCompleteDeliveryAddress(deliveryAddress)) {
      throw new Error("Please add a complete delivery address with house/flat number, street/locality, city, and pincode before placing the order.");
    }

    // Create a new document in root "orders" collection
    const ordersRef = collection(db, "orders");
    const orderDocRef = doc(ordersRef); // Generates a unique document ID
    
    await setDoc(orderDocRef, {
      orderId: orderDocRef.id,
      uid: user.uid,
      items: orderDetails.items,
      totalAmount: orderDetails.totalAmount,
      deliveryCharge: orderDetails.deliveryCharge,
      address: deliveryAddress,
      ...(orderDetails.deliveryAddress ? { deliveryAddress: orderDetails.deliveryAddress } : {}),
      paymentMethod: orderDetails.paymentMethod,
      deliveryOption: orderDetails.deliveryOption,
      createdAt: new Date().toISOString(),
      status: "Placed"
    });

    // Clear cart in store
    this.clearCart();
    return orderDocRef.id;
  }

  // Helper to seed realistic mock orders for testing/demo purposes
  async seedMockOrders(uid: string): Promise<any[]> {
    const ordersRef = collection(db, "orders");
    const mockOrders = [
      {
        orderId: "TB-124363893-93876378",
        uid: uid,
        items: [
          {
            productId: 9999, // Unique mock ID for matching screenshot item
            name: "Logan Crochet Outer Wear",
            price: 2499,
            originalPrice: 3299,
            quantity: 1,
            size: "M",
            imageUrl: "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=400"
          }
        ],
        totalAmount: 2499,
        deliveryCharge: 0,
        address: "C-10, Sector 3, OPP Fusion Street, Noida, Uttar Pradesh, Noida - 201301",
        paymentMethod: "UPI (Google Pay/PhonePe)",
        deliveryOption: "Standard Delivery",
        createdAt: new Date(Date.now() - 38 * 24 * 60 * 60 * 1000).toISOString(), // 38 days ago
        status: "Delivered"
      },
      {
        orderId: "TB-982736412-10826492",
        uid: uid,
        items: [
          {
            productId: 101,
            name: "Amul Gold Full Cream Fresh Milk",
            price: 66,
            quantity: 2,
            imageUrl: "https://cdn.grofers.com/cdn-cgi/image/f=auto,fit=scale-down,q=70,metadata=none,w=270/app/assets/products/sliding_images/jpeg/1c0db977-31ab-4d8e-abf3-d42e4a4b4632.jpg?ts=1706182142"
          },
          {
            productId: 102,
            name: "Lay's India's Magic Namkeen Chips",
            price: 20,
            quantity: 3,
            imageUrl: "https://cdn.grofers.com/cdn-cgi/image/f=auto,fit=scale-down,q=70,metadata=none,w=270/app/images/products/sliding_image/240092a.jpg?ts=1687324818"
          }
        ],
        totalAmount: 232,
        deliveryCharge: 40,
        address: "C-10, Sector 3, OPP Fusion Street, Noida, Uttar Pradesh, Noida - 201301",
        paymentMethod: "UPI (Google Pay/PhonePe)",
        deliveryOption: "Standard Delivery",
        createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // 2 hours ago
        status: "Preparing to pack"
      },
      {
        orderId: "TB-837492019-38491029",
        uid: uid,
        items: [
          {
            productId: 103,
            name: "Premium Sharbati Atta (5kg)",
            price: 260,
            quantity: 1,
            imageUrl: "https://images.unsplash.com/photo-1509440159596-0249088772ff?w=400"
          }
        ],
        totalAmount: 300,
        deliveryCharge: 40,
        address: "C-10, Sector 3, OPP Fusion Street, Noida, Uttar Pradesh, Noida - 201301",
        paymentMethod: "Cash on Delivery",
        deliveryOption: "Standard Delivery",
        createdAt: new Date(Date.now() - 20 * 60 * 60 * 1000).toISOString(), // 20 hours ago
        status: "Package in Transit"
      }
    ];

    const seededList: any[] = [];
    for (const order of mockOrders) {
      const orderDocRef = doc(ordersRef, order.orderId);
      await setDoc(orderDocRef, order);
      seededList.push(order);
    }
    return seededList;
  }

  // Fetch orders placed by the current user
  async fetchUserOrders(): Promise<any[]> {
    const user = auth.currentUser;
    if (!user) return [];

    const ordersRef = collection(db, "orders");
    const q = query(ordersRef, where("uid", "==", user.uid));
    const querySnapshot = await getDocs(q);

    const ordersList: any[] = [];
    querySnapshot.forEach((orderDoc) => {
      ordersList.push({ orderId: orderDoc.id, ...orderDoc.data() });
    });

    if (ordersList.length === 0) {
      return [];
    }

    // Sort orders by date descending
    return ordersList.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  // Subscribe to orders placed by the current user in real-time
  subscribeUserOrders(cb: (orders: any[]) => void, onError?: (err: any) => void): Unsubscribe {
    const user = auth.currentUser;
    if (!user) {
      cb([]);
      return () => {};
    }

    const ordersRef = collection(db, "orders");
    const q = query(ordersRef, where("uid", "==", user.uid));

    return onSnapshot(q, (snapshot) => {
      const ordersList: any[] = [];
      snapshot.forEach((orderDoc) => {
        ordersList.push({ orderId: orderDoc.id, ...orderDoc.data() });
      });
      cb(ordersList.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
    }, (error) => {
      console.error("subscribeUserOrders error:", error);
      if (onError) onError(error);
    });
  }

  // Cancel an order in Firestore
  async cancelOrder(orderId: string): Promise<void> {
    try {
      const orderRef = doc(db, "orders", orderId);
      await updateDoc(orderRef, {
        status: "Cancelled",
        cancelledAt: serverTimestamp()
      });
    } catch (e: any) {
      console.error("Error cancelling order:", e);
      throw e;
    }
  }

  // Update order status in Firestore
  async updateOrderStatus(orderId: string, status: string): Promise<void> {
    try {
      const orderRef = doc(db, "orders", orderId);
      await updateDoc(orderRef, {
        status: status,
        updatedAt: serverTimestamp()
      });
    } catch (e: any) {
      console.error("Error updating order status:", e);
      throw e;
    }
  }

  // Update order delivery address in Firestore
  async updateOrderAddress(orderId: string, address: string): Promise<void> {
    try {
      const orderRef = doc(db, "orders", orderId);
      await updateDoc(orderRef, {
        address: address,
        updatedAt: serverTimestamp()
      });
    } catch (e: any) {
      console.error("Error updating order address:", e);
      throw e;
    }
  }

  // Selected address state management
  setSelectedAddressId(id: string | null) {
    this.selectedAddressId = id;
  }

  getSelectedAddressId(): string | null {
    return this.selectedAddressId;
  }

  setSelectedAddress(address: Address | null) {
    this.selectedAddress = address;
  }

  getSelectedAddress(): Address | null {
    return this.selectedAddress;
  }

  // Subscribe to user's saved addresses in real-time
  subscribeAddresses(cb: (addresses: Address[]) => void, onError?: (err: any) => void): Unsubscribe {
    const user = auth.currentUser;
    if (!user) {
      cb([]);
      return () => {};
    }

    const addressesRef = collection(db, "users", user.uid, "addresses");
    return onSnapshot(addressesRef, (snapshot) => {
      const list: Address[] = [];
      snapshot.forEach((docSnap) => {
        list.push({ addressId: docSnap.id, ...docSnap.data() } as Address);
      });
      
      // Sort: isDefault first, then createdAt descending
      list.sort((a, b) => {
        if (a.isDefault && !b.isDefault) return -1;
        if (!a.isDefault && b.isDefault) return 1;
        const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return timeB - timeA;
      });
      cb(list);
    }, (error) => {
      console.error("subscribeAddresses error:", error);
      if (onError) onError(error);
    });
  }

  // Add a new address to users/{uid}/addresses
  async addAddress(addressData: Omit<Address, "addressId">): Promise<string> {
    const user = auth.currentUser;
    if (!user) throw new Error("You must be logged in to manage addresses.");
    if (this.isBlocked) {
      throw new Error("Your account has been temporarily blocked. You cannot place orders until your account is restored.");
    }

    const addressesRef = collection(db, "users", user.uid, "addresses");
    const docRef = doc(addressesRef);

    const now = new Date().toISOString();
    const finalAddress = {
      ...addressData,
      createdAt: now,
      updatedAt: now,
    };

    if (addressData.isDefault) {
      await this.clearOtherDefaults(user.uid, docRef.id);
    }

    await setDoc(docRef, finalAddress);
    return docRef.id;
  }

  // Update an existing address
  async updateAddress(addressId: string, addressData: Partial<Address>): Promise<void> {
    const user = auth.currentUser;
    if (!user) throw new Error("You must be logged in to manage addresses.");
    if (this.isBlocked) {
      throw new Error("Your account has been temporarily blocked. You cannot place orders until your account is restored.");
    }

    const docRef = doc(db, "users", user.uid, "addresses", addressId);
    
    if (addressData.isDefault) {
      await this.clearOtherDefaults(user.uid, addressId);
    }

    await updateDoc(docRef, {
      ...addressData,
      updatedAt: new Date().toISOString(),
    });
  }

  // Delete an address from Firestore
  async deleteAddress(addressId: string): Promise<void> {
    const user = auth.currentUser;
    if (!user) throw new Error("You must be logged in to manage addresses.");
    if (this.isBlocked) {
      throw new Error("Your account has been temporarily blocked. You cannot place orders until your account is restored.");
    }

    const docRef = doc(db, "users", user.uid, "addresses", addressId);
    await deleteDoc(docRef);
  }

  // Set an address as default
  async setDefaultAddress(addressId: string): Promise<void> {
    const user = auth.currentUser;
    if (!user) throw new Error("You must be logged in to manage addresses.");
    if (this.isBlocked) {
      throw new Error("Your account has been temporarily blocked. You cannot place orders until your account is restored.");
    }

    await this.clearOtherDefaults(user.uid, addressId);
    const docRef = doc(db, "users", user.uid, "addresses", addressId);
    await updateDoc(docRef, {
      isDefault: true,
      updatedAt: new Date().toISOString(),
    });
  }

  private async clearOtherDefaults(uid: string, exceptAddressId: string): Promise<void> {
    const addressesRef = collection(db, "users", uid, "addresses");
    const q = query(addressesRef, where("isDefault", "==", true));
    const snapshot = await getDocs(q);

    const batch = writeBatch(db);
    snapshot.forEach((docSnap) => {
      if (docSnap.id !== exceptAddressId) {
        batch.update(docSnap.ref, {
          isDefault: false,
          updatedAt: new Date().toISOString(),
        });
      }
    });
    await batch.commit();
  }

  // Logout
  async logout() {
    await signOut(auth);
    this.currentUser = null;
    this.notificationsAllowed = false;
    this.locationAllowed = false;
    this.detectedState = "Default";
    this.currentAddress = "Enable location for delivery ETA";
    this.completedPermissionFlow = false;
    this.cart.clear();
    this.notifyCartListeners();
  }
}

export const authStore = new AuthStore();
