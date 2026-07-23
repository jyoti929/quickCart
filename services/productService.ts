import { collection, getDocs, writeBatch, doc, query, where, getDoc, getCountFromServer, onSnapshot, Unsubscribe, setDoc, limit } from "firebase/firestore";
import { db } from "./firebase";
import { isFuzzyMatch } from "./adminService";

export interface Product {
  id: number;
  name: string;
  category: string;
  weight: string;
  price: number;
  originalPrice: number;
  rating: number;
  imageUrl: string;
  icon: string;
  iconColor: string;
  bg: string;
  eta: string;
  state: string;
  stateId?: string;
  categoryId?: string;
  categoryName?: string;
  title?: string;
  description?: string;
  city?: string;
  serviceCity?: string;
  tags?: string[];
  label?: string;
  availability?: boolean;
  status?: string;
  stock?: number;
  isActive?: boolean;
  inStock?: boolean;
  isFeatured?: boolean;
}

export interface Banner {
  id: string;
  tag: string;
  title: string;
  couponCode: string;
  backgroundColor: string;
  imageUrl?: string;
  isActive?: boolean;
  createdAt?: any;
}

export interface Offer {
  id: string;
  title: string;
  subtitle: string;
  tag: string;
  backgroundColor: string;
  imageUrl?: string;
  createdAt?: any;
}

const states = [
  "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh", "Goa", "Gujarat",
  "Haryana", "Himachal Pradesh", "Jharkhand", "Karnataka", "Kerala", "Madhya Pradesh",
  "Maharashtra", "Manipur", "Meghalaya", "Mizoram", "Nagaland", "Odisha", "Punjab",
  "Rajasthan", "Sikkim", "Tamil Nadu", "Telangana", "Tripura", "Uttar Pradesh",
  "Uttarakhand", "West Bengal", "Delhi"
];

function normalizeId(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

const categoryDetails: { [key: string]: { name: string; icon: string; color: string; bg: string; items: { name: string; url: string }[] } } = {
  Veg: {
    name: "Veggies & Fruits", icon: "leaf-outline", color: "#16a34a", bg: "#dcfce7",
    items: [
      { name: "Fresh Red Tomatoes", url: "https://images.unsplash.com/photo-1597362925123-77861d3fbac7?w=400" },
      { name: "Organic Bananas", url: "https://images.unsplash.com/photo-1571771894821-ce9b6c11b08e?w=400" },
      { name: "Idaho Potatoes", url: "https://images.unsplash.com/photo-1587049352846-4a222e784d38?w=400" },
      { name: "Gala Apples", url: "https://images.unsplash.com/photo-1610832958506-ee5633619141?w=400" },
      { name: "Sweet Carrots", url: "https://images.unsplash.com/photo-1598170845058-32b9d6a5da37?w=400" },
      { name: "Fresh Oranges", url: "https://images.unsplash.com/photo-1557800636-894a64c1696f?w=400" },
      { name: "Red Onions", url: "https://images.unsplash.com/photo-1592924357228-91a4daadcfea?w=400" },
      { name: "Green Seedless Grapes", url: "https://images.unsplash.com/photo-1568584711271-e00584b1392e?w=400" },
      { name: "Organic Garlic", url: "https://images.unsplash.com/photo-1518977676601-b53f82aba655?w=400" },
      { name: "Fresh Spinach", url: "https://images.unsplash.com/photo-1595855759920-86582396756a?w=400" },
    ]
  },
  Dairy: {
    name: "Dairy & Bread", icon: "water-outline", color: "#2563eb", bg: "#dbeafe",
    items: [
      { name: "Amul Gold Full Cream Fresh Milk", url: "https://cdn.grofers.com/cdn-cgi/image/f=auto,fit=scale-down,q=70,metadata=none,w=270/app/assets/products/sliding_images/jpeg/1c0db977-31ab-4d8e-abf3-d42e4a4b4632.jpg?ts=1706182142" },
      { name: "Harvest Gold - White Bread", url: "https://cdn.grofers.com/cdn-cgi/image/f=auto,fit=scale-down,q=70,metadata=none,w=270/app/images/products/sliding_image/23779a.jpg?ts=1690808192" },
      { name: "Amul Salted Butter", url: "https://cdn.grofers.com/cdn-cgi/image/f=auto,fit=scale-down,q=70,metadata=none,w=270/app/assets/products/sliding_images/jpeg/7514beed-37f7-4c8c-b50a-4b39842009b8.jpg?ts=1707312315" },
      { name: "Amul Pure Milk Cheese Slices", url: "https://cdn.grofers.com/cdn-cgi/image/f=auto,fit=scale-down,q=70,metadata=none,w=270/app/assets/products/sliding_images/jpeg/0f895474-ac1e-4f52-9587-891e32ab1ba9.jpg?ts=1707312315" },
      { name: "Mother Dairy Classic Curd", url: "https://cdn.grofers.com/cdn-cgi/image/f=auto,fit=scale-down,q=70,metadata=none,w=270/app/images/products/sliding_image/86446a.jpg?ts=1687948913" },
      { name: "Mother Dairy Paneer", url: "https://cdn.grofers.com/cdn-cgi/image/f=auto,fit=scale-down,q=70,metadata=none,w=270/app/assets/products/sliding_images/jpeg/2d037337-0ca2-463c-9f98-a6cba298d7a5.jpg?ts=1707312317" },
      { name: "Table White Eggs (6 pieces)", url: "https://cdn.grofers.com/cdn-cgi/image/f=auto,fit=scale-down,q=70,metadata=none,w=270/app/images/products/sliding_image/487729a.jpg?ts=1700208078" },
      { name: "Amul Masti Curd", url: "https://cdn.grofers.com/cdn-cgi/image/f=auto,fit=scale-down,q=70,metadata=none,w=270/app/images/products/sliding_image/45533a.jpg?ts=1687948907" },
      { name: "Amul Fresh Malai Paneer", url: "https://cdn.grofers.com/cdn-cgi/image/f=auto,fit=scale-down,q=70,metadata=none,w=270/app/images/products/sliding_image/329500a.jpg?ts=1687949315" },
      { name: "Amul Blend Diced Cheese", url: "https://cdn.grofers.com/cdn-cgi/image/f=auto,fit=scale-down,q=70,metadata=none,w=270/app/images/products/sliding_image/439697a.jpg?ts=1688471557" },
    ]
  },
  Drinks: {
    name: "Cold Drinks", icon: "beer-outline", color: "#ea580c", bg: "#ffedd5",
    items: [
      { name: "Coca-Cola Soft Drink (750 ml)", url: "https://cdn.grofers.com/cdn-cgi/image/f=auto,fit=scale-down,q=70,metadata=none,w=270/app/assets/products/sliding_images/jpeg/6b98633c-7c6a-4708-a372-e2b49da568ab.jpg?ts=1707312322" },
      { name: "Red Bull Energy Drink (250 ml)", url: "https://cdn.grofers.com/cdn-cgi/image/f=auto,fit=scale-down,q=70,metadata=none,w=270/app/assets/products/sliding_images/jpeg/2217f2ec-4dc7-47ec-b67c-65fe1b848db4.jpg?ts=1707312716" },
      { name: "Real Fruit Power Cranberry Juice", url: "https://cdn.grofers.com/cdn-cgi/image/f=auto,fit=scale-down,q=70,metadata=none,w=270/app/images/products/sliding_image/20143a.jpg?ts=1687525090" },
      { name: "Storia 100% Tender Coconut Water", url: "https://cdn.grofers.com/cdn-cgi/image/f=auto,fit=scale-down,q=70,metadata=none,w=270/app/images/products/sliding_image/448503a.jpg?ts=1687331132" },
      { name: "Real Activ 100% Orange Juice", url: "https://cdn.grofers.com/cdn-cgi/image/f=auto,fit=scale-down,q=70,metadata=none,w=270/app/images/products/sliding_image/69250a.jpg?ts=1679035809" },
      { name: "Sting Energy Drink (250 ml)", url: "https://cdn.grofers.com/cdn-cgi/image/f=auto,fit=scale-down,q=70,metadata=none,w=270/app/images/products/sliding_image/374687a.jpg?ts=1688469730" },
      { name: "Frooti Mango Drink", url: "https://cdn.grofers.com/cdn-cgi/image/f=auto,fit=scale-down,q=70,metadata=none,w=270/app/images/products/sliding_image/10536a.jpg?ts=1694684179" },
      { name: "Real Activ Fibre+ Multi Fruit", url: "https://cdn.grofers.com/cdn-cgi/image/f=auto,fit=scale-down,q=70,metadata=none,w=270/app/assets/products/sliding_images/jpeg/29280a12-2e73-458c-912c-97a29b217229.jpg?ts=1707312715" },
      { name: "Fresh Mango Lassi", url: "https://images.unsplash.com/photo-1541658016709-82535e94bc69?w=400" },
      { name: "Lemon Iced Tea", url: "https://images.unsplash.com/photo-1556679343-c7306c1976bc?w=400" },
    ]
  },
  Snacks: {
    name: "Munchies", icon: "pizza-outline", color: "#b45309", bg: "#fef3c7",
    items: [
      { name: "Haldiram's Bhujia Sev", url: "https://cdn.grofers.com/cdn-cgi/image/f=auto,fit=scale-down,q=70,metadata=none,w=270/app/images/products/sliding_image/19266a.jpg?ts=1688625382" },
      { name: "Lay's India's Magic Masala Chips", url: "https://cdn.grofers.com/cdn-cgi/image/f=auto,fit=scale-down,q=70,metadata=none,w=270/app/images/products/sliding_image/240092a.jpg?ts=1687324818" },
      { name: "Doritos Cheese Nachos", url: "https://cdn.grofers.com/cdn-cgi/image/f=auto,fit=scale-down,q=70,metadata=none,w=270/app/images/products/sliding_image/432818a.jpg?ts=1688444559" },
      { name: "Haldiram's Lite Mixture Namkeen", url: "https://cdn.grofers.com/cdn-cgi/image/f=auto,fit=scale-down,q=70,metadata=none,w=270/app/images/products/sliding_image/19251a.jpg?ts=1687948393" },
      { name: "Doritos Sweet Chilli Nachos", url: "https://cdn.grofers.com/cdn-cgi/image/f=auto,fit=scale-down,q=70,metadata=none,w=270/app/images/products/sliding_image/381269a.jpg?ts=1668156784" },
      { name: "Uncle Chipps Spicy Treat Chips", url: "https://cdn.grofers.com/cdn-cgi/image/f=auto,fit=scale-down,q=70,metadata=none,w=270/app/images/products/sliding_image/11150a.jpg?ts=1688463551" },
      { name: "Act II Golden Sizzle Popcorn", url: "https://cdn.grofers.com/cdn-cgi/image/f=auto,fit=scale-down,q=70,metadata=none,w=270/app/images/products/sliding_image/54056a.jpg?ts=1687525097" },
      { name: "Lay's Cream & Onion Potato Chips", url: "https://cdn.grofers.com/cdn-cgi/image/f=auto,fit=scale-down,q=70,metadata=none,w=270/app/assets/products/sliding_images/jpeg/a28f4dec-a3fb-4f9e-a4e5-8acfe5722a1f.jpg?ts=1707312781" },
      { name: "Bingo Mad Angles Pizza Nachos", url: "https://cdn.grofers.com/cdn-cgi/image/f=auto,fit=scale-down,q=70,metadata=none,w=270/app/assets/products/sliding_images/jpeg/b6cbd918-6a6d-4ab3-81bd-cb6e22149ae7.jpg?ts=1705923105" },
      { name: "Salted Peanuts", url: "https://images.unsplash.com/photo-1569562211093-4ed0d0758f12?w=400" },
    ]
  },
  Sweets: {
    name: "Sweet Tooth", icon: "ice-cream-outline", color: "#db2777", bg: "#fce7f3",
    items: [
      { name: "Kaju Katli", url: "https://images.unsplash.com/photo-1587314168485-3236d6710814?w=400" },
      { name: "Gulab Jamun", url: "https://images.unsplash.com/photo-1589135304905-eb8969655e75?w=400" },
      { name: "Rasgulla Tin", url: "https://images.unsplash.com/photo-1505253716362-afaea1d3d1af?w=400" },
      { name: "Motichoor Laddoo", url: "https://images.unsplash.com/photo-1587314168485-3236d6710814?w=400" },
      { name: "Soan Papdi", url: "https://images.unsplash.com/photo-1587314168485-3236d6710814?w=400" },
      { name: "Chocolate Truffles", url: "https://images.unsplash.com/photo-1548907040-4d42b52125e0?w=400" },
      { name: "Milk Peda", url: "https://images.unsplash.com/photo-1587314168485-3236d6710814?w=400" },
      { name: "Dry Fruit Halwa", url: "https://images.unsplash.com/photo-1589135304905-eb8969655e75?w=400" },
      { name: "Vanilla Ice Cream", url: "https://images.unsplash.com/photo-1497034825429-c343d7c6a68f?w=400" },
      { name: "Mango Kulfi", url: "https://images.unsplash.com/photo-1501386761578-eac5c94b800a?w=400" },
    ]
  },
  Bakery: {
    name: "Bakery", icon: "restaurant-outline", color: "#854d0e", bg: "#fef9c3",
    items: [
      { name: "Butter Croissants", url: "https://images.unsplash.com/photo-1555507036-ab1f4038808a?w=400" },
      { name: "Chocolate Lava Cake", url: "https://images.unsplash.com/photo-1606313564200-e75d5e30476c?w=400" },
      { name: "Garlic Bread Loaf", url: "https://images.unsplash.com/photo-1573140247632-f8fd74997d5c?w=400" },
      { name: "Blueberry Muffins", url: "https://images.unsplash.com/photo-1607958996333-41aef7caefaa?w=400" },
      { name: "Apple Pie", url: "https://images.unsplash.com/photo-1519869325930-281384150729?w=400" },
      { name: "Cinnamon Rolls", url: "https://images.unsplash.com/photo-1509440159596-0249088772ff?w=400" },
      { name: "Oatmeal Raisin Cookie", url: "https://images.unsplash.com/photo-1499636136210-6f4ee915583e?w=400" },
      { name: "Plain Bagels", url: "https://images.unsplash.com/photo-1585478259715-876acc5be8eb?w=400" },
      { name: "Sourdough Bread", url: "https://images.unsplash.com/photo-1549931319-a545dcf3bc73?w=400" },
      { name: "Red Velvet Cupcake", url: "https://images.unsplash.com/photo-1587314168485-3236d6710814?w=400" },
    ]
  },
  Instant: {
    name: "Instant Foods", icon: "alarm-outline", color: "#7c3aed", bg: "#f3e8ff",
    items: [
      { name: "Masala Noodles", url: "https://images.unsplash.com/photo-1612966608997-30d0ec164828?w=400" },
      { name: "Instant Oats", url: "https://images.unsplash.com/photo-1586444248902-2f64eddc13df?w=400" },
      { name: "Tomato Cup Soup", url: "https://images.unsplash.com/photo-1547592165-e1d17f975555?w=400" },
      { name: "Ready to Eat Biryani", url: "https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=400" },
      { name: "Instant Poha Pack", url: "https://images.unsplash.com/photo-1601050690597-df056fb4ce78?w=400" },
      { name: "Mac & Cheese Instant", url: "https://images.unsplash.com/photo-1543339308-43e59d6b73a6?w=400" },
      { name: "Pasta in Cheese Sauce", url: "https://images.unsplash.com/photo-1612966608997-30d0ec164828?w=400" },
      { name: "Instant Upma Mix", url: "https://images.unsplash.com/photo-1601050690597-df056fb4ce78?w=400" },
      { name: "Canned Baked Beans", url: "https://images.unsplash.com/photo-1547592165-e1d17f975555?w=400" },
      { name: "Frozen French Fries", url: "https://images.unsplash.com/photo-1573080496219-bb080dd4f877?w=400" },
    ]
  },
  Atta: {
    name: "Atta & Dal", icon: "basket-outline", color: "#0d9488", bg: "#ccfbf1",
    items: [
      { name: "Premium Sharbati Atta", url: "https://images.unsplash.com/photo-1509440159596-0249088772ff?w=400" },
      { name: "Basmati Rice", url: "https://images.unsplash.com/photo-1586444248902-2f64eddc13df?w=400" },
      { name: "Toor Dal", url: "https://images.unsplash.com/photo-1586444248902-2f64eddc13df?w=400" },
      { name: "Moong Dal", url: "https://images.unsplash.com/photo-1586444248902-2f64eddc13df?w=400" },
      { name: "Chana Dal", url: "https://images.unsplash.com/photo-1586444248902-2f64eddc13df?w=400" },
      { name: "Kabuli Chana", url: "https://images.unsplash.com/photo-1586444248902-2f64eddc13df?w=400" },
      { name: "Organic Sugar", url: "https://images.unsplash.com/photo-1586444248902-2f64eddc13df?w=400" },
      { name: "Iodized Salt", url: "https://images.unsplash.com/photo-1586444248902-2f64eddc13df?w=400" },
      { name: "Mustard Oil", url: "https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?w=400" },
      { name: "Refined Sunflower Oil", url: "https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?w=400" },
    ]
  },
  Personal: {
    name: "Personal Care", icon: "sparkles-outline", color: "#0891b2", bg: "#cffafe",
    items: [
      { name: "Aloe Vera Soap", url: "https://images.unsplash.com/photo-1607006342411-9a3363f63b29?w=400" },
      { name: "Herbal Shampoo", url: "https://images.unsplash.com/photo-1535585209827-a15fcdbc4c2d?w=400" },
      { name: "Menthol Toothpaste", url: "https://images.unsplash.com/photo-1556228720-195a672e8a03?w=400" },
      { name: "Moisturizing Cream", url: "https://images.unsplash.com/photo-1556228720-195a672e8a03?w=400" },
      { name: "Hyaluronic Face Wash", url: "https://images.unsplash.com/photo-1556228720-195a672e8a03?w=400" },
      { name: "Sandalwood Talc", url: "https://images.unsplash.com/photo-1556228720-195a672e8a03?w=400" },
      { name: "Liquid Handwash", url: "https://images.unsplash.com/photo-1607006342411-9a3363f63b29?w=400" },
      { name: "Anti-perspirant Deodorant", url: "https://images.unsplash.com/photo-1535585209827-a15fcdbc4c2d?w=400" },
      { name: "Satin Hair Conditioner", url: "https://images.unsplash.com/photo-1535585209827-a15fcdbc4c2d?w=400" },
      { name: "Soft Facial Tissues", url: "https://images.unsplash.com/photo-1607006342411-9a3363f63b29?w=400" },
    ]
  },
  Household: {
    name: "Household Items", icon: "home-outline", color: "#4f46e5", bg: "#e0e7ff",
    items: [
      { name: "Dishwash Liquid Gel", url: "https://images.unsplash.com/photo-1583947215259-38e31be8751f?w=400" },
      { name: "Floor Cleaner Liquid", url: "https://images.unsplash.com/photo-1583947215259-38e31be8751f?w=400" },
      { name: "Liquid Laundry Detergent", url: "https://images.unsplash.com/photo-1583947215259-38e31be8751f?w=400" },
      { name: "Toilet Cleaner Power", url: "https://images.unsplash.com/photo-1583947215259-38e31be8751f?w=400" },
      { name: "Garbage Bags Roll", url: "https://images.unsplash.com/photo-1583947215259-38e31be8751f?w=400" },
      { name: "Kitchen Sponge Scrub", url: "https://images.unsplash.com/photo-1583947215259-38e31be8751f?w=400" },
      { name: "Glass Cleaner Spray", url: "https://images.unsplash.com/photo-1583947215259-38e31be8751f?w=400" },
      { name: "Air Freshener Spray", url: "https://images.unsplash.com/photo-1583947215259-38e31be8751f?w=400" },
      { name: "Disinfectant Wipes", url: "https://images.unsplash.com/photo-1583947215259-38e31be8751f?w=400" },
      { name: "Mosquito Repellent", url: "https://images.unsplash.com/photo-1583947215259-38e31be8751f?w=400" },
    ]
  }
};

/**
 * Generate 2,900 items across 29 states, 10 categories, 10 items per category
 */
export function generateMockProducts(): Product[] {
  const generatedList: Product[] = [];
  let currentId = 1;

  states.forEach((state, stateIndex) => {
    Object.keys(categoryDetails).forEach((catKey) => {
      const cat = categoryDetails[catKey];
      cat.items.forEach((item, itemIndex) => {
        // Calculate deterministic pricing/eta per state to make variations
        const stateFactor = stateIndex % 5; // Variation modifier
        const basePrice = Math.round((1.0 + (itemIndex * 0.4) + (stateFactor * 0.25)) * 80);
        const originalPrice = Math.round(basePrice * (1.15 + (itemIndex % 3) * 0.1));
        const rating = 4.0 + ((itemIndex + stateIndex) % 10) * 0.1;
        const eta = `${7 + ((itemIndex + stateIndex) % 8)} Mins`;

        const cityOptions = ["Delhi", "Mumbai", "Bengaluru", "Hyderabad", "Chennai", "Kolkata", "Pune", "Ahmedabad", "Lucknow", "Jaipur"];
        const city = cityOptions[(stateIndex + itemIndex) % cityOptions.length];
        generatedList.push({
          id: currentId++,
          name: item.name,
          title: item.name,
          category: catKey,
          categoryId: catKey,
          categoryName: cat.name,
          weight: itemIndex % 2 === 0 ? "500g" : "1kg",
          price: basePrice,
          originalPrice: originalPrice,
          rating: parseFloat(rating.toFixed(2)),
          imageUrl: item.url,
          icon: cat.icon,
          iconColor: cat.color,
          bg: cat.bg,
          eta: eta,
          state: state,
          stateId: normalizeId(state),
          city,
          serviceCity: city,
          description: `${item.name} available for quick delivery in ${city}, ${state}.`,
          tags: [normalizeId(state), normalizeId(cat.name), normalizeId(item.name)],
          label: itemIndex % 3 === 0 ? "Best value" : itemIndex % 3 === 1 ? "Fresh stock" : "Popular",
          availability: true,
          status: "available",
          stock: 25 + ((stateIndex + itemIndex) % 60),
          isActive: true,
          inStock: true,
          isFeatured: (itemIndex + stateIndex) % 7 === 0
        });
      });
    });
  });

  return generatedList;
}

/**
 * Seed products to Firestore if empty, in batches of 500
 */
export async function seedProductsIfEmpty(): Promise<void> {
  try {
    const productsCol = collection(db, "products");
    const countSnapshot = await getCountFromServer(productsCol);
    const currentCount = countSnapshot.data().count;

    if (currentCount < 2900) {
      console.log(`Firestore products has ${currentCount} products. Repairing seed data to 2,900 products...`);
      const allProducts = generateMockProducts();
      
      // Batch write 500 documents at a time
      const batchSize = 500;
      for (let i = 0; i < allProducts.length; i += batchSize) {
        const batch = writeBatch(db);
        const chunk = allProducts.slice(i, i + batchSize);
        
        chunk.forEach((product) => {
          const docRef = doc(db, "products", `prod_${product.id}`);
          batch.set(docRef, product);
        });
        
        await batch.commit();
        console.log(`Seeded batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(allProducts.length / batchSize)} (${chunk.length} items)...`);
      }
      console.log("Successfully seeded 2,900 mock products to Firestore products!");
    } else {
      console.log("Firestore products collection already has the full product seed.");
    }
  } catch (error) {
    console.error("Error seeding mock products to Firestore:", error);
  }
}

/**
 * Normalizes Indian state/region name to one of our 29 supported states
 */
export function normalizeStateName(stateName: string): string {
  return stateName ? stateName.trim() : "";
}

/**
 * Fetch products from Firestore filtered by user's detected Indian state
 */
export async function fetchProductsByState(stateName: string): Promise<Product[]> {
  try {
    // 1. Ensure database is seeded
    await seedProductsIfEmpty();

    // Load all states from Firestore to map the input stateName to a database state name
    const statesCol = collection(db, "states");
    const statesSnap = await getDocs(statesCol);
    
    let matchedStateName = "";
    statesSnap.forEach(d => {
      const data = d.data();
      const dbName = data.stateName || data.name || "";
      if (dbName && isFuzzyMatch(stateName, dbName).matches) {
        matchedStateName = dbName;
      }
    });

    const stateQuery = matchedStateName || (stateName && stateName !== "Default" ? stateName : "Delhi");
    console.log(`Querying Firestore products strictly for state: "${stateQuery}"`);
    
    const productsCol = collection(db, "products");
    const q = query(productsCol, where("state", "==", stateQuery));
    const snapshot = await getDocs(q);

    const productsList: Product[] = [];
    snapshot.forEach((doc) => {
      const data = doc.data() as Product;
      if (data.isActive !== false && data.inStock !== false) {
        productsList.push(data);
      }
    });

    if (productsList.length > 0) {
      return productsList.sort((a, b) => a.id - b.id);
    }

    // Return empty array if state has no data, so client can display empty state screen + manual select
    return [];
  } catch (error) {
    console.error("Error fetching state-wise products from Firestore:", error);
    // Throw error to be caught by UI retry/error handler
    throw error;
  }
}

/**
 * Strips state prefixes or city names from a product's title dynamically
 */
export function cleanProductName(name: string): string {
  if (!name) return "";

  const statesLower = [
    "andhra pradesh", "arunachal pradesh", "assam", "bihar", "chhattisgarh", "goa", "gujarat",
    "haryana", "himachal pradesh", "jharkhand", "karnataka", "kerala", "madhya pradesh",
    "maharashtra", "manipur", "meghalaya", "mizoram", "nagaland", "odisha", "punjab",
    "rajasthan", "sikkim", "tamil nadu", "telangana", "tripura", "uttar pradesh",
    "uttarakhand", "west bengal", "delhi"
  ];

  let cleaned = name.trim();

  // 1. Remove state name if it starts with it
  for (const st of statesLower) {
    if (cleaned.toLowerCase().startsWith(st)) {
      cleaned = cleaned.substring(st.length).trim();
      break;
    }
  }

  // 2. Remove common cities or short state names
  const extraPrefixes = ["up", "noida", "raipur", "mumbai", "pune", "bengaluru", "bangalore", "delhi"];
  for (const prefix of extraPrefixes) {
    if (cleaned.toLowerCase().startsWith(prefix + " ")) {
      cleaned = cleaned.substring(prefix.length + 1).trim();
      break;
    }
  }

  // 3. Capitalize first letter of cleaned name
  if (cleaned.length > 0) {
    cleaned = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
  }

  return cleaned;
}

/**
 * Resolves price dynamically into Rupee value (converts previous seed USD prices to INR if needed)
 */
export function getActualInrPrice(price: number): number {
  if (price < 25) {
    return Math.round(price * 80);
  }
  return Math.round(price);
}

/**
 * Formats price in Indian Rupees (INR) with Rs.  symbol
 */
export function formatPrice(price: number): string {
  const resolvedPrice = getActualInrPrice(price);
  return `Rs. ${resolvedPrice}`;
}

/**
 * Fetch a single product by its ID from Firestore
 */
export async function fetchProductById(id: number): Promise<Product | null> {
  try {
    const productsCol = collection(db, "products");
    const q = query(productsCol, where("id", "==", id), limit(1));
    const snapshot = await getDocs(q);
    if (!snapshot.empty) {
      return snapshot.docs[0].data() as Product;
    }
    return null;
  } catch (error) {
    console.error("Error fetching product by ID:", error);
    return null;
  }
}

export function subscribeProductById(
  id: number,
  cb: (product: Product | null) => void,
  onError?: (err: any) => void
): Unsubscribe {
  const productsCol = collection(db, "products");
  const q = query(productsCol, where("id", "==", id), limit(1));
  console.log(`[LISTENER:CREATE] subscribeProductById id=${id}`);
  const unsub = onSnapshot(q, (snapshot) => {
    if (!snapshot.empty) {
      cb(snapshot.docs[0].data() as Product);
    } else {
      cb(null);
    }
  }, (error) => {
    console.error(`Error in subscribeProductById for id ${id}:`, error);
    if (onError) onError(error);
  });
  return () => {
    console.log(`[LISTENER:DESTROY] subscribeProductById id=${id}`);
    unsub();
  };
}

/**
 * Subscribe to products by state in real-time.
 * NOTE: Seeding (seedProductsIfEmpty) must be called once by the app startup
 * flow BEFORE calling this function — NOT inside here. Calling seed inside a
 * subscribe function means every leaked or re-created listener triggers a full
 * Firestore count + potential batch-write, rapidly exhausting quota.
 */
export function subscribeProductsByState(
  stateName: string,
  cb: (products: Product[]) => void,
  onError?: (err: any) => void
): Unsubscribe {
  let unsub: Unsubscribe | null = null;
  let active = true;

  const startSubscription = async () => {
    try {
      const statesCol = collection(db, "states");
      const statesSnap = await getDocs(statesCol);
      
      let matchedStateName = "";
      statesSnap.forEach(d => {
        const data = d.data();
        const dbName = data.stateName || data.name || "";
        if (dbName && isFuzzyMatch(stateName, dbName).matches) {
          matchedStateName = dbName;
        }
      });

      const stateQuery = matchedStateName || (stateName && stateName !== "Default" ? stateName : "Delhi");
      if (!active) return;

      console.log(`[LISTENER:CREATE] subscribeProductsByState state="${stateQuery}"`);
      const productsCol = collection(db, "products");
      const q = query(productsCol, where("state", "==", stateQuery));

      unsub = onSnapshot(q, (snapshot) => {
        const productsList: Product[] = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data() as Product;
          if (data.isActive !== false && data.inStock !== false) {
            productsList.push(data);
          }
        });
        cb(productsList.sort((a, b) => a.id - b.id));
      }, (error) => {
        console.error(`Error in subscribeProductsByState for ${stateQuery}:`, error);
        if (onError) onError(error);
      });
    } catch (e: any) {
      console.error(`Error initializing products subscription for ${stateName}:`, e);
      if (onError) onError(e);
    }
  };

  startSubscription();

  return () => {
    active = false;
    if (unsub) {
      console.log(`[LISTENER:DESTROY] subscribeProductsByState state="${stateName}"`);
      unsub();
    }
  };
}

export async function seedBannersAndOffersIfEmpty(): Promise<void> {
  try {
    const bannersCol = collection(db, "banners");
    const countBanners = (await getDocs(bannersCol)).size;
    if (countBanners === 0) {
      console.log("Seeding mock banners to Firestore...");
      const mockBanners: Banner[] = [
        {
          id: "banner_1",
          tag: "SUMMER COOLERS FESTIVAL",
          title: "Up to 40% Off on Ice Cream & Juices",
          couponCode: "COLD40",
          backgroundColor: "#0f766e",
        },
        {
          id: "banner_2",
          tag: "WELCOME OFFER",
          title: "Flat Rs. 10 Off on your first order",
          couponCode: "WELCOME10",
          backgroundColor: "#ea580c",
        }
      ];
      for (const b of mockBanners) {
        await setDoc(doc(db, "banners", b.id), b);
      }
    }

    const offersCol = collection(db, "offers");
    const countOffers = (await getDocs(offersCol)).size;
    if (countOffers === 0) {
      console.log("Seeding mock offers to Firestore...");
      const mockOffers: Offer[] = [
        {
          id: "offer_1",
          title: "Premium Groceries",
          subtitle: "Get fresh farm vegetables, dairy, snacks & personal care items delivered instantly.",
          tag: "Up to 25% Off",
          backgroundColor: "#fbeeb8",
        }
      ];
      for (const o of mockOffers) {
        await setDoc(doc(db, "offers", o.id), o);
      }
    }
  } catch (error) {
    console.error("Error seeding banners and offers:", error);
  }
}

export function subscribeBanners(cb: (banners: Banner[]) => void): Unsubscribe {
  // NOTE: seedBannersAndOffersIfEmpty() must NOT be called here.
  // Calling a seeding function inside a subscribe function means every listener
  // creation (including leaked ones) triggers unnecessary Firestore reads/writes.
  // Call seedBannersAndOffersIfEmpty() once from the app startup path instead.
  const q = query(collection(db, "banners"));
  console.log("[LISTENER:CREATE] subscribeBanners");
  const unsub = onSnapshot(q, (snap) => {
    const list = snap.docs
      .map((d) => ({ ...d.data(), id: d.id } as Banner))
      .filter((b) => b.isActive !== false);
    cb(list);
  });
  return () => {
    console.log("[LISTENER:DESTROY] subscribeBanners");
    unsub();
  };
}

export function subscribeOffers(cb: (offers: Offer[]) => void): Unsubscribe {
  const q = query(collection(db, "offers"));
  console.log("[LISTENER:CREATE] subscribeOffers");
  const unsub = onSnapshot(q, (snap) => {
    cb(snap.docs.map((d) => ({ ...d.data(), id: d.id } as Offer)));
  });
  return () => {
    console.log("[LISTENER:DESTROY] subscribeOffers");
    unsub();
  };
}



