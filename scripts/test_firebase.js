const fs = require('fs');
const path = require('path');
const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, limit } = require('firebase/firestore');

// Load .env variables manually
const envPath = path.join(__dirname, '..', '.env');
const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    let value = match[2] || '';
    if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
    env[match[1]] = value.trim();
  }
});

const firebaseConfig = {
  apiKey: env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function inspect() {
  const collections = ['products_v3', 'categories', 'users', 'carts', 'orders', 'tracking'];
  console.log("Inspecting Firestore collections...");
  for (const colName of collections) {
    try {
      const colRef = collection(db, colName);
      const q = await getDocs(colRef);
      console.log(`Collection '${colName}': found ${q.size} documents.`);
      if (q.size > 0) {
        console.log(`Sample document from '${colName}':`, JSON.stringify(q.docs[0].data(), null, 2));
      }
    } catch (e) {
      console.error(`Error listing collection '${colName}':`, e.message);
    }
  }
  process.exit(0);
}

inspect();
