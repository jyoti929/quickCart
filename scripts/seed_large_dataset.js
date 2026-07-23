const fs = require('fs');
const path = require('path');
const { initializeApp } = require("firebase/app");
const { getFirestore, collection, writeBatch, doc, getDocs, limit, query } = require("firebase/firestore");

// 1. Manually parse .env variables to connect to Firestore
const dotenv = {};
try {
  const envPath = path.join(__dirname, '../.env');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    envContent.split('\n').forEach(line => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) return;
      const parts = trimmed.split('=');
      if (parts.length >= 2) {
        dotenv[parts[0].trim()] = parts.slice(1).join('=').trim();
      }
    });
  } else {
    console.error(".env file not found at " + envPath);
  }
} catch (e) {
  console.error("Error reading .env file:", e);
}

// 2. Initialize Firebase
const firebaseConfig = {
  apiKey: dotenv.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: dotenv.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: dotenv.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: dotenv.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: dotenv.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: dotenv.EXPO_PUBLIC_FIREBASE_APP_ID,
};

console.log("Initializing Firebase with project ID:", firebaseConfig.projectId);
if (!firebaseConfig.apiKey) {
  console.error("ERROR: Firebase API Key missing. Please ensure your .env variables are loaded.");
  process.exit(1);
}

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// 3. Define 29 Indian States / UTs with realistic localized metadata
const states = [
  { id: "ap", name: "Andhra Pradesh", cities: ["Visakhapatnam", "Vijayawada", "Guntur", "Tirupati"], accent: "Tirupati Ghee", specialItem: "Andhra Chili Paste" },
  { id: "ar", name: "Arunachal Pradesh", cities: ["Itanagar", "Tawang", "Ziro", "Pasighat"], accent: "Tawang Green Tea", specialItem: "Pasighat Bamboo Shoot" },
  { id: "as", name: "Assam", cities: ["Guwahati", "Dibrugarh", "Silchar", "Jorhat"], accent: "Assam CTC Tea", specialItem: "Jorhat Ginger Root" },
  { id: "br", name: "Bihar", cities: ["Patna", "Gaya", "Bhagalpur", "Muzaffarpur"], accent: "Muzaffarpur Litchi Juice", specialItem: "Patna Roasted Sattu" },
  { id: "cg", name: "Chhattisgarh", cities: ["Raipur", "Bilaspur", "Durg", "Korba"], accent: "Bastar Forest Honey", specialItem: "Raipur Dubraj Rice" },
  { id: "ga", name: "Goa", cities: ["Panaji", "Margao", "Vasco da Gama", "Mapusa"], accent: "Goan Cashew Nuts", specialItem: "Panaji Kokum Syrup" },
  { id: "gj", name: "Gujarat", cities: ["Ahmedabad", "Surat", "Vadodara", "Rajkot"], accent: "Surati Shrikhand", specialItem: "Ahmedabad Dhokla Mix" },
  { id: "hr", name: "Haryana", cities: ["Gurugram", "Faridabad", "Panipat", "Ambala"], accent: "Kurukshetra Basmati Rice", specialItem: "Gurugram A2 Cow Ghee" },
  { id: "hp", name: "Himachal Pradesh", cities: ["Shimla", "Manali", "Dharamshala", "Solan"], accent: "Shimla Golden Apples", specialItem: "Solan Button Mushrooms" },
  { id: "jh", name: "Jharkhand", cities: ["Ranchi", "Jamshedpur", "Dhanbad", "Bokaro"], accent: "Hazaribagh Tamarind", specialItem: "Ranchi Madhuca Honey" },
  { id: "ka", name: "Karnataka", cities: ["Bengaluru", "Mysuru", "Hubballi", "Mangaluru"], accent: "Mysore Pak Sweet", specialItem: "Coorg Filter Coffee" },
  { id: "kl", name: "Kerala", cities: ["Kochi", "Thiruvananthapuram", "Kozhikode", "Thrissur"], accent: "Wayanad Black Pepper", specialItem: "Kochi Cold-Pressed Coconut Oil" },
  { id: "mp", name: "Madhya Pradesh", cities: ["Indore", "Bhopal", "Jabalpur", "Gwalior"], accent: "Indori Chatpata Sev", specialItem: "Sharbati Wheat Atta" },
  { id: "mh", name: "Maharashtra", cities: ["Mumbai", "Pune", "Nagpur", "Nashik"], accent: "Alphonso Mango pulp", specialItem: "Nagpur Orange Juice" },
  { id: "mn", name: "Manipur", cities: ["Imphal", "Thoubal", "Kakching", "Ukhrul"], accent: "Imphal Black Rice", specialItem: "Ukhrul King Chili Sauce" },
  { id: "ml", name: "Meghalaya", cities: ["Shillong", "Tura", "Jowai", "Nongpoh"], accent: "Lakadong High-Curcumin Turmeric", specialItem: "Shillong Ginger Powder" },
  { id: "mz", name: "Mizoram", cities: ["Aizawl", "Lunglei", "Saiha", "Champhai"], accent: "Mizo Bird's Eye Chili", specialItem: "Champhai Grape Juice" },
  { id: "nl", name: "Nagaland", cities: ["Kohima", "Dimapur", "Mokokchung", "Tuensang"], accent: "Naga Raja Mircha Chili", specialItem: "Dimapur Wild Honey" },
  { id: "or", name: "Odisha", cities: ["Bhubaneswar", "Cuttack", "Rourkela", "Puri"], accent: "Puri Jagannath Ghee", specialItem: "Bhubaneswar Chena Poda Sweet" },
  { id: "pb", name: "Punjab", cities: ["Amritsar", "Ludhiana", "Jalandhar", "Patiala"], accent: "Patiala Premium Lassi", specialItem: "Amritsari Urad Dal Warian" },
  { id: "rj", name: "Rajasthan", cities: ["Jaipur", "Jodhpur", "Udaipur", "Kota"], accent: "Bikaneri Moong Papad", specialItem: "Jodhpur Cold-Pressed Mustard Oil" },
  { id: "sk", name: "Sikkim", cities: ["Gangtok", "Namchi", "Geyzing", "Mangan"], accent: "Sikkim Large Cardamom", specialItem: "Namchi Organic Temi Tea" },
  { id: "tn", name: "Tamil Nadu", cities: ["Chennai", "Coimbatore", "Madurai", "Salem"], accent: "Ooty Tea Leaves", specialItem: "Madurai Jasmine Water Spray" },
  { id: "tg", name: "Telangana", cities: ["Hyderabad", "Warangal", "Nizamabad", "Khammam"], accent: "Hyderabadi Haleem Instant Mix", specialItem: "Telangana Mango Pickle" },
  { id: "tr", name: "Tripura", cities: ["Agartala", "Dharmanagar", "Udaipur", "Kailasahar"], accent: "Agartala Queen Pineapple", specialItem: "Tripura Bamboo Shoot Pickles" },
  { id: "up", name: "Uttar Pradesh", cities: ["Noida", "Lucknow", "Kanpur", "Varanasi"], accent: "Banarasi Lal Petha", specialItem: "Lucknowi Biryani Spices" },
  { id: "uk", name: "Uttarakhand", cities: ["Dehradun", "Haridwar", "Haldwani", "Roorkee"], accent: "Dehraduni Basmati Rice", specialItem: "Pithoragarh Rock Honey" },
  { id: "wb", name: "West Bengal", cities: ["Kolkata", "Howrah", "Darjeeling", "Siliguri"], accent: "Darjeeling First Flush Tea", specialItem: "Kolkata Nolen Gur Rasgulla" },
  { id: "dl", name: "Delhi", cities: ["Connaught Place", "Dwarka", "Saket", "Karol Bagh"], accent: "Chandni Chowk Chole Masala", specialItem: "Karol Bagh Almond Saffron Mix" }
];

// 4. Define 10 categories matching modern quick commerce UI layouts
const categories = [
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

// Template items per category to programmatically generate 10 products
const categoryTemplates = {
  Veg: [
    { name: "Organic Red Tomatoes", weight: "500g", price: 1.49, originalPrice: 1.99, rating: 4.8, icon: "fruit-watermelon", iconColor: "#ef4444", bg: "#fee2e2" },
    { name: "Fresh Local Bananas", weight: "6 Units", price: 1.10, originalPrice: 1.40, rating: 4.9, icon: "food-apple", iconColor: "#eab308", bg: "#fefbc3" },
    { name: "Crisp Green Capsicum", weight: "250g", price: 0.99, originalPrice: 1.25, rating: 4.7, icon: "pine-tree", iconColor: "#16a34a", bg: "#dcfce7" },
    { name: "Special Accent Fruits", weight: "500g", price: 2.99, originalPrice: 3.50, rating: 4.9, icon: "food-apple", iconColor: "#eab308", bg: "#fef9c3", useSpecial: true },
    { name: "Spicy Green Chilies", weight: "100g", price: 0.49, originalPrice: 0.69, rating: 4.8, icon: "leaf-outline", iconColor: "#16a34a", bg: "#dcfce7" },
    { name: "Farm Spinach Bunch", weight: "250g", price: 0.89, originalPrice: 1.10, rating: 4.7, icon: "leaf-outline", iconColor: "#16a34a", bg: "#dcfce7" },
    { name: "Fresh Red Potatoes", weight: "1kg", price: 1.79, originalPrice: 2.29, rating: 4.8, icon: "cookie", iconColor: "#b45309", bg: "#fef3c7" },
    { name: "Red Salad Onions", weight: "1kg", price: 1.69, originalPrice: 2.10, rating: 4.7, icon: "fruit-watermelon", iconColor: "#db2777", bg: "#fce7f3" },
    { name: "Clean Cauliflower Head", weight: "1 Unit", price: 1.29, originalPrice: 1.60, rating: 4.6, icon: "pine-tree", iconColor: "#94a3b8", bg: "#f8fafc" },
    { name: "Organic Juicy Lemons", weight: "4 Units", price: 0.79, originalPrice: 0.99, rating: 4.8, icon: "food-apple", iconColor: "#eab308", bg: "#fef9c3" }
  ],
  Dairy: [
    { name: "Fresh Standard Milk", weight: "1 Litre", price: 2.29, originalPrice: 2.50, rating: 4.9, icon: "bottle-tonic-plus", iconColor: "#2563eb", bg: "#dbeafe" },
    { name: "Accent Local Butter/Ghee", weight: "200g", price: 4.49, originalPrice: 4.99, rating: 4.9, icon: "water-outline", iconColor: "#ea580c", bg: "#ffedd5", useAccent: true },
    { name: "Fresh Cooking Butter", weight: "100g", price: 1.89, originalPrice: 2.10, rating: 4.8, icon: "square", iconColor: "#ca8a04", bg: "#fefbc3" },
    { name: "Sliced Sandwich Bread", weight: "400g", price: 1.79, originalPrice: 2.20, rating: 4.7, icon: "bread-slice", iconColor: "#b45309", bg: "#fef3c7" },
    { name: "Thick Natural Dahi Cup", weight: "400g", price: 1.10, originalPrice: 1.35, rating: 4.8, icon: "cup", iconColor: "#2563eb", bg: "#dbeafe" },
    { name: "Premium Soft Paneer Block", weight: "200g", price: 2.99, originalPrice: 3.49, rating: 4.9, icon: "cheese", iconColor: "#ca8a04", bg: "#fefbc3" },
    { name: "Cheese Slices Pack", weight: "100g", price: 2.49, originalPrice: 2.99, rating: 4.8, icon: "square", iconColor: "#eab308", bg: "#fefbc3" },
    { name: "Low-Fat Brown Bread", weight: "400g", price: 1.99, originalPrice: 2.40, rating: 4.7, icon: "bread-slice", iconColor: "#854d0e", bg: "#fef9c3" },
    { name: "Creamy Salad Fresh Cream", weight: "200ml", price: 1.69, originalPrice: 1.99, rating: 4.8, icon: "cup", iconColor: "#2563eb", bg: "#dbeafe" },
    { name: "Spiced Buttermilk Packet", weight: "200ml", price: 0.50, originalPrice: 0.60, rating: 4.8, icon: "water-outline", iconColor: "#2563eb", bg: "#dbeafe" }
  ],
  Drinks: [
    { name: "Accent Hot Beverage/Coffee", weight: "250g", price: 3.99, originalPrice: 4.50, rating: 4.9, icon: "coffee", iconColor: "#854d0e", bg: "#fef9c3", useAccent: true },
    { name: "Sweet Accent Syrup/Juice", weight: "1 Litre", price: 3.49, originalPrice: 4.20, rating: 4.8, icon: "cup", iconColor: "#ea580c", bg: "#ffedd5", useSpecial: true },
    { name: "Premium Coconut Water", weight: "200ml", price: 1.25, originalPrice: 1.50, rating: 4.9, icon: "water-outline", iconColor: "#16a34a", bg: "#dcfce7" },
    { name: "Chilled Diet Cola", weight: "750ml", price: 1.49, originalPrice: 1.80, rating: 4.6, icon: "cup", iconColor: "#dc2626", bg: "#fee2e2" },
    { name: "Sparkling Lemon Water", weight: "500ml", price: 0.99, originalPrice: 1.20, rating: 4.7, icon: "wine", iconColor: "#0d9488", bg: "#ccfbf1" },
    { name: "Creamy Mango Lassi Juice", weight: "250ml", price: 1.20, originalPrice: 1.40, rating: 4.8, icon: "cup", iconColor: "#ea580c", bg: "#ffedd5" },
    { name: "Pure Mineral Spring Water", weight: "1 Litre", price: 0.60, originalPrice: 0.75, rating: 4.8, icon: "water-outline", iconColor: "#2563eb", bg: "#dbeafe" },
    { name: "Chilled Spicy Ginger Ale", weight: "300ml", price: 1.50, originalPrice: 1.80, rating: 4.5, icon: "wine", iconColor: "#ca8a04", bg: "#fefbc3" },
    { name: "Cold Brew Black Coffee Can", weight: "250ml", price: 2.29, originalPrice: 2.80, rating: 4.8, icon: "coffee", iconColor: "#475569", bg: "#f1f5f9" },
    { name: "Chilled Tonic Soda Can", weight: "300ml", price: 0.89, originalPrice: 1.10, rating: 4.5, icon: "cup", iconColor: "#94a3b8", bg: "#f8fafc" }
  ],
  Snacks: [
    { name: "Crispy Salted Potato Chips", weight: "120g", price: 1.49, originalPrice: 1.99, rating: 4.6, icon: "cookie", iconColor: "#ca8a04", bg: "#fef9c3" },
    { name: "Spicy Roasted Peanut Mix", weight: "150g", price: 1.20, originalPrice: 1.50, rating: 4.7, icon: "pizza-outline", iconColor: "#b45309", bg: "#fef3c7" },
    { name: "Premium Salted Cashews Pack", weight: "100g", price: 3.99, originalPrice: 4.80, rating: 4.8, icon: "nutrition-outline", iconColor: "#ca8a04", bg: "#fefbc3" },
    { name: "Roasted Almonds Salted Bag", weight: "100g", price: 3.49, originalPrice: 4.20, rating: 4.8, icon: "nutrition-outline", iconColor: "#854d0e", bg: "#fef9c3" },
    { name: "Spiced Roasted Makhana", weight: "60g", weight: "60g", price: 2.10, originalPrice: 2.60, rating: 4.8, icon: "cookie", iconColor: "#0d9488", bg: "#ccfbf1" },
    { name: "Cheese Ball Crunchy Bites", weight: "80g", price: 1.29, originalPrice: 1.60, rating: 4.7, icon: "pizza-outline", iconColor: "#ea580c", bg: "#ffedd5" },
    { name: "Traditional Spicy Bhujia Mix", weight: "200g", price: 1.69, originalPrice: 2.10, rating: 4.8, icon: "pizza-outline", iconColor: "#b45309", bg: "#fef3c7" },
    { name: "Baked Samosa Bites Pack", weight: "150g", price: 2.49, originalPrice: 3.00, rating: 4.7, icon: "pizza-outline", iconColor: "#ca8a04", bg: "#fefbc3" },
    { name: "Tortilla Chips Jalapeno Pack", weight: "150g", price: 1.99, originalPrice: 2.40, rating: 4.6, icon: "cookie", iconColor: "#16a34a", bg: "#dcfce7" },
    { name: "Instant Butter Popcorn Pack", weight: "90g", price: 0.99, originalPrice: 1.25, rating: 4.7, icon: "pizza-outline", iconColor: "#eab308", bg: "#fefbc3" }
  ],
  Sweets: [
    { name: "State Premium Accent Sweet", weight: "250g", price: 4.99, originalPrice: 5.80, rating: 4.9, icon: "cake", iconColor: "#ca8a04", bg: "#fefbc3", useAccent: true },
    { name: "Luxury Milk Chocolate Bar", weight: "80g", price: 2.49, originalPrice: 2.99, rating: 4.8, icon: "square", iconColor: "#db2777", bg: "#fce7f3" },
    { name: "Creamy Vanilla Ice Cream Tub", weight: "500ml", price: 3.49, originalPrice: 3.99, rating: 4.8, icon: "ice-cream-outline", iconColor: "#2563eb", bg: "#dbeafe" },
    { name: "Traditional Rasgulla Tin Box", weight: "500g", price: 4.29, originalPrice: 4.99, rating: 4.8, icon: "cake", iconColor: "#ea580c", bg: "#ffedd5" },
    { name: "Gooey Gulab Jamun Cup", weight: "2 Units", price: 1.49, originalPrice: 1.80, rating: 4.8, icon: "cake", iconColor: "#b45309", bg: "#fef3c7" },
    { name: "Mango Double Ice Cream Bar", weight: "80ml", price: 1.20, originalPrice: 1.50, rating: 4.8, icon: "ice-cream-outline", iconColor: "#eab308", bg: "#fefbc3" },
    { name: "Double Dark Chocolate Cookie", weight: "120g", price: 1.99, originalPrice: 2.49, rating: 4.7, icon: "cookie", iconColor: "#854d0e", bg: "#fef9c3" },
    { name: "Sweet Traditional Shrikhand Cup", weight: "200g", price: 1.89, originalPrice: 2.20, rating: 4.8, icon: "cup", iconColor: "#ea580c", bg: "#ffedd5" },
    { name: "Premium Kaju Katli Box", weight: "250g", price: 7.99, originalPrice: 9.50, rating: 4.9, icon: "cake", iconColor: "#eab308", bg: "#fef9c3" },
    { name: "Sweet Creamy Rabri Pot", weight: "100g", price: 1.99, originalPrice: 2.40, rating: 4.9, icon: "cup", iconColor: "#ca8a04", bg: "#fefbc3" }
  ],
  Bakery: [
    { name: "State Specialty Baked Pav/Bread", weight: "6 Units", price: 1.29, originalPrice: 1.60, rating: 4.8, icon: "bread-slice", iconColor: "#854d0e", bg: "#fef9c3", useAccent: true },
    { name: "Crispy Butter Milk Rusk Pack", weight: "300g", price: 1.49, originalPrice: 1.80, rating: 4.8, icon: "bread-slice", iconColor: "#ca8a04", bg: "#fefbc3" },
    { name: "Chocolate Fudge Chip Muffin", weight: "1 Unit", price: 1.10, originalPrice: 1.40, rating: 4.7, icon: "cake", iconColor: "#db2777", bg: "#fce7f3" },
    { name: "100% Whole Wheat Toast Bread", weight: "400g", price: 2.10, originalPrice: 2.60, rating: 4.7, icon: "bread-slice", iconColor: "#b45309", bg: "#fef3c7" },
    { name: "Garlic Butter French Sticks", weight: "150g", price: 2.49, originalPrice: 3.00, rating: 4.8, icon: "restaurant-outline", iconColor: "#854d0e", bg: "#fefbc3" },
    { name: "Fresh Fruit Tea Cake Slices", weight: "200g", price: 2.29, originalPrice: 2.80, rating: 4.7, icon: "cake", iconColor: "#db2777", bg: "#fce7f3" },
    { name: "Assorted Danish Butter Cookies", weight: "150g", price: 2.99, originalPrice: 3.60, rating: 4.8, icon: "cookie", iconColor: "#ca8a04", bg: "#fefbc3" },
    { name: "Organic Oatmeal Raisin Cookies", weight: "150g", price: 2.49, originalPrice: 2.99, rating: 4.7, icon: "cookie", iconColor: "#b45309", bg: "#fef3c7" },
    { name: "Flaky Butter Croissant Pastry", weight: "1 Unit", price: 1.60, originalPrice: 2.00, rating: 4.8, icon: "bread-slice", iconColor: "#ea580c", bg: "#ffedd5" },
    { name: "Crisp Sweet Cream Roll Pack", weight: "3 Units", price: 1.20, originalPrice: 1.50, rating: 4.7, icon: "restaurant-outline", iconColor: "#ea580c", bg: "#ffedd5" }
  ],
  Instant: [
    { name: "Accent Instant Indian Gravy Mix", weight: "300g", price: 2.99, originalPrice: 3.60, rating: 4.9, icon: "pot-steam", iconColor: "#7c3aed", bg: "#f3e8ff", useSpecial: true },
    { name: "Quick Spicy Masala Oats Bag", weight: "500g", price: 3.49, originalPrice: 3.99, rating: 4.8, icon: "basket", iconColor: "#0d9488", bg: "#ccfbf1" },
    { name: "Spicy Instant Noodles Pot", weight: "70g", price: 0.99, originalPrice: 1.20, rating: 4.6, icon: "alarm-outline", iconColor: "#ef4444", bg: "#fee2e2" },
    { name: "Instant Vegetable Upma Cup", weight: "80g", price: 1.20, originalPrice: 1.50, rating: 4.8, icon: "alarm-outline", iconColor: "#7c3aed", bg: "#f3e8ff" },
    { name: "Creamy Tomato Soup Packet", weight: "50g", price: 0.69, originalPrice: 0.85, rating: 4.7, icon: "cup", iconColor: "#dc2626", bg: "#fee2e2" },
    { name: "Ready-to-eat Dal Makhani Tub", weight: "250g", price: 2.49, originalPrice: 2.99, rating: 4.8, icon: "pot-steam", iconColor: "#854d0e", bg: "#fef9c3" },
    { name: "Instant Veg Poha Bowl", weight: "80g", price: 1.10, originalPrice: 1.40, rating: 4.7, icon: "alarm-outline", iconColor: "#16a34a", bg: "#dcfce7" },
    { name: "Cheesy Masala Macaroni Pasta Cup", weight: "75g", price: 1.39, originalPrice: 1.70, rating: 4.6, icon: "alarm-outline", iconColor: "#ea580c", bg: "#ffedd5" },
    { name: "Fresh Idli Dosa Batter Pack", weight: "1kg", price: 2.29, originalPrice: 2.80, rating: 4.9, icon: "water-outline", iconColor: "#2563eb", bg: "#dbeafe" },
    { name: "Ready-to-eat Basmati Biryani Tub", weight: "250g", price: 2.89, originalPrice: 3.50, rating: 4.8, icon: "pot-steam", iconColor: "#ea580c", bg: "#ffedd5" }
  ],
  Atta: [
    { name: "Accent Local Grains/Flour", weight: "5kg", price: 4.99, originalPrice: 5.99, rating: 4.9, icon: "basket", iconColor: "#0d9488", bg: "#ccfbf1", useSpecial: true },
    { name: "Premium Basmati Rice Bag", weight: "1kg", price: 3.99, originalPrice: 4.60, rating: 4.8, icon: "basket", iconColor: "#0d9488", bg: "#ccfbf1" },
    { name: "Organic Arhar/Toor Dal Pack", weight: "1kg", price: 2.49, originalPrice: 2.99, rating: 4.8, icon: "basket", iconColor: "#ca8a04", bg: "#fefbc3" },
    { name: "Accent Cold Pressed Cooking Oil", weight: "1 Litre", price: 3.29, originalPrice: 3.99, rating: 4.9, icon: "water-outline", iconColor: "#ca8a04", bg: "#fef9c3", useAccent: true },
    { name: "Organic Chana Dal Packet", weight: "1kg", price: 1.99, originalPrice: 2.40, rating: 4.8, icon: "basket", iconColor: "#b45309", bg: "#fef3c7" },
    { name: "Premium Sona Masoori Rice Bag", weight: "5kg", price: 7.99, originalPrice: 9.20, rating: 4.8, icon: "basket", iconColor: "#0d9488", bg: "#ccfbf1" },
    { name: "Organic Yellow Moong Dal", weight: "1kg", price: 2.29, originalPrice: 2.75, rating: 4.8, icon: "basket", iconColor: "#16a34a", bg: "#dcfce7" },
    { name: "Refined Sun-Flower Cooking Oil", weight: "1 Litre", price: 2.49, originalPrice: 2.99, rating: 4.7, icon: "water-outline", iconColor: "#0d9488", bg: "#ccfbf1" },
    { name: "Kala Chana Whole Seed Bag", weight: "1kg", price: 1.49, originalPrice: 1.85, rating: 4.8, icon: "basket", iconColor: "#475569", bg: "#f1f5f9" },
    { name: "Organic White Kabuli Chana Pack", weight: "1kg", price: 2.10, originalPrice: 2.50, rating: 4.7, icon: "basket", iconColor: "#94a3b8", bg: "#f8fafc" }
  ],
  Personal: [
    { name: "Accent Fragrant Herbal Soap", weight: "125g", price: 1.10, originalPrice: 1.35, rating: 4.8, icon: "sparkles", iconColor: "#0891b2", bg: "#cffafe", useAccent: true },
    { name: "Natural Soothing Aloe Vera Gel", weight: "150g", price: 2.49, originalPrice: 2.99, rating: 4.8, icon: "sparkles", iconColor: "#16a34a", bg: "#dcfce7" },
    { name: "Anti-Dandruff Herbal Shampoo", weight: "200ml", price: 3.29, originalPrice: 3.99, rating: 4.7, icon: "sparkles", iconColor: "#0891b2", bg: "#cffafe" },
    { name: "Active Protection Herbal Toothpaste", weight: "150g", price: 1.89, originalPrice: 2.25, rating: 4.8, icon: "sparkles", iconColor: "#0d9488", bg: "#ccfbf1" },
    { name: "Deep Moisturizing Skin Cream Lotion", weight: "200ml", price: 3.49, originalPrice: 4.20, rating: 4.8, icon: "sparkles", iconColor: "#db2777", bg: "#fce7f3" },
    { name: "Antibacterial Liquid Handwash Bottle", weight: "250ml", price: 1.99, originalPrice: 2.40, rating: 4.8, icon: "sparkles", iconColor: "#0891b2", bg: "#cffafe" },
    { name: "Pure Cold-Pressed Coconut Hair Oil", weight: "200ml", price: 2.10, originalPrice: 2.50, rating: 4.9, icon: "water-outline", iconColor: "#2563eb", bg: "#dbeafe" },
    { name: "Antibacterial Fresh Mint Mouthwash", weight: "250ml", price: 2.79, originalPrice: 3.30, rating: 4.7, icon: "sparkles", iconColor: "#0d9488", bg: "#ccfbf1" },
    { name: "Super Soft Facial Tissue Pack", weight: "200 Sheets", price: 1.49, originalPrice: 1.80, rating: 4.8, icon: "sparkles", iconColor: "#94a3b8", bg: "#f8fafc" },
    { name: "Sunscreens Matte Face Gel SPF50", weight: "50g", price: 4.49, originalPrice: 5.50, rating: 4.8, icon: "sparkles", iconColor: "#eab308", bg: "#fef9c3" }
  ],
  Household: [
    { name: "State Accent Floor Cleaner", weight: "1 Litre", price: 2.29, originalPrice: 2.80, rating: 4.8, icon: "home-outline", iconColor: "#4f46e5", bg: "#e0e7ff", useAccent: true },
    { name: "Liquid Dishwash Lemon Gel Bottle", weight: "500ml", price: 1.99, originalPrice: 2.40, rating: 4.8, icon: "home-outline", iconColor: "#0891b2", bg: "#cffafe" },
    { name: "Eco-friendly Tough Garbage Bags", weight: "30 Units", price: 2.49, originalPrice: 3.00, rating: 4.7, icon: "home-outline", iconColor: "#475569", bg: "#f1f5f9" },
    { name: "Heavy Duty Scrub Sponge Pads", weight: "3 Units", price: 0.99, originalPrice: 1.20, rating: 4.7, icon: "home-outline", iconColor: "#ca8a04", bg: "#fefbc3" },
    { name: "Ultra Power Liquid Laundry Detergent", weight: "1 Litre", price: 4.99, originalPrice: 5.80, rating: 4.9, icon: "home-outline", iconColor: "#2563eb", bg: "#dbeafe" },
    { name: "Lavender Fresh Air Freshener Spray", weight: "220ml", price: 1.89, originalPrice: 2.25, rating: 4.8, icon: "home-outline", iconColor: "#7c3aed", bg: "#f3e8ff" },
    { name: "Stainless Steel Scrub Pads Set", weight: "2 Units", price: 0.79, originalPrice: 0.95, rating: 4.6, icon: "home-outline", iconColor: "#94a3b8", bg: "#f8fafc" },
    { name: "Disinfectant Toilet Cleaner Gel", weight: "500ml", price: 1.69, originalPrice: 1.99, rating: 4.8, icon: "home-outline", iconColor: "#dc2626", bg: "#fee2e2" },
    { name: "Microfiber Lint-Free Cleaning Clothes", weight: "4 Units", price: 3.49, originalPrice: 4.20, rating: 4.8, icon: "home-outline", iconColor: "#0d9488", bg: "#ccfbf1" },
    { name: "Multi-Surface All Purpose Disinfectant Spray", weight: "500ml", price: 2.99, originalPrice: 3.60, rating: 4.8, icon: "home-outline", iconColor: "#0891b2", bg: "#cffafe" }
  ]
};

// 5. Programmatic generator to produce 10 items * 10 categories * 29 states = 2900 items
console.log("Generating 2900+ items...");
const items = [];
let itemCounter = 1;

states.forEach((state) => {
  // Select a city list for this state
  const cities = state.cities;
  
  categories.forEach((category) => {
    const templates = categoryTemplates[category.id];
    
    templates.forEach((template, index) => {
      // Pick a city from the list deterministically
      const city = cities[index % cities.length];
      
      // Determine descriptive product title
      let pName = template.name;
      if (template.useAccent) {
        pName = `${state.name} ${state.accent}`;
      } else if (template.useSpecial) {
        pName = `${state.name} ${state.specialItem}`;
      } else {
        pName = `${state.name} ${pName}`;
      }

      // Create a description using city and state specific details
      const description = `Freshly sourced and available in ${city}, ${state.name}. Made with high-quality ingredients, perfect for your daily household needs. Get it delivered in minutes.`;

      // Generate tags
      const tags = [category.name.toLowerCase(), state.name.toLowerCase(), city.toLowerCase(), "groceries", "fast_delivery"];
      if (index % 2 === 0) tags.push("organic");
      if (index % 3 === 0) tags.push("fresh");

      const item = {
        id: itemCounter,
        name: pName,
        category: category.id,
        weight: template.weight,
        price: template.price,
        originalPrice: template.originalPrice,
        rating: template.rating,
        icon: template.icon,
        iconColor: template.iconColor,
        bg: template.bg,
        eta: `${7 + (itemCounter % 6)} Mins`, // realistic varying ETA
        state: state.name,
        stateId: state.id,
        categoryId: category.id,
        categoryName: category.name,
        description: description,
        city: city,
        tags: tags,
        status: index === 9 ? "out_of_stock" : "available" // mock one out of stock item per category
      };

      items.push(item);
      itemCounter++;
    });
  });
});

console.log(`Successfully generated ${items.length} product items.`);

// 6. Push data in commit chunks to Cloud Firestore
async function seedLargeDataset() {
  try {
    // Optional check to see if database has items (to prevent double-seeding accidentally)
    const productsCol = collection(db, "products");
    const q = query(productsCol, limit(1));
    const snapshot = await getDocs(q);
    
    // We force overwrite/reseed if requested, but let's do a warning check
    if (!snapshot.empty) {
      console.log("Firestore products collection is not empty.");
      console.log("Proceeding to seed/overwrite the dataset to ensure all 2,900+ items are properly stored...");
    }

    const BATCH_SIZE = 450; // Firestore limit is 500, we keep it safe at 450
    console.log(`Writing ${items.length} items to Firestore in ${Math.ceil(items.length / BATCH_SIZE)} batches...`);

    for (let i = 0; i < items.length; i += BATCH_SIZE) {
      const chunk = items.slice(i, i + BATCH_SIZE);
      const batch = writeBatch(db);
      
      chunk.forEach((item) => {
        const docRef = doc(db, "products", `prod_${item.id}`);
        batch.set(docRef, item);
      });

      const batchNum = Math.floor(i / BATCH_SIZE) + 1;
      const totalBatches = Math.ceil(items.length / BATCH_SIZE);
      console.log(`Writing batch ${batchNum}/${totalBatches} (${chunk.length} items)...`);
      
      await batch.commit();
      console.log(`Batch ${batchNum}/${totalBatches} successfully committed to Firestore.`);
    }

    console.log("🎉 Firestore database seeding complete! 2,900+ items added successfully!");
    process.exit(0);
  } catch (error) {
    console.error("Fatal error during Firestore seeding:", error);
    process.exit(1);
  }
}

seedLargeDataset();
