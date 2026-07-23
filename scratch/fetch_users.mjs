import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyDhQ166kRf-WO4xclX-NvSy2j8dtEyMCTw",
  authDomain: "quickcart-shared.firebaseapp.com",
  projectId: "quickcart-shared",
  storageBucket: "quickcart-shared.firebasestorage.app",
  messagingSenderId: "221503732530",
  appId: "1:221503732530:web:f7e20e123bec7f36ceb52b",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function run() {
  const querySnapshot = await getDocs(collection(db, "users"));
  const users = querySnapshot.docs.map((d) => ({ uid: d.id, ...d.data() }));

  console.log("=== ALL USERS ===");
  users.forEach(u => {
    console.log(`ID: ${u.uid} | name: ${u.name} | isBlocked: ${u.isBlocked} | typeof: ${typeof u.isBlocked}`);
  });

  console.log("\n=== FILTERED FOR BLOCKED (u.isBlocked === true) ===");
  const blocked1 = users.filter((u) => u.isBlocked === true);
  blocked1.forEach(u => console.log(`ID: ${u.uid} | name: ${u.name}`));

  console.log("\n=== FILTERED FOR BLOCKED (!!u.isBlocked) ===");
  const blocked2 = users.filter((u) => !!u.isBlocked);
  blocked2.forEach(u => console.log(`ID: ${u.uid} | name: ${u.name}`));

  console.log("\n=== FILTERED FOR ACTIVE (u.isBlocked !== true) ===");
  const active1 = users.filter((u) => u.isBlocked !== true);
  active1.forEach(u => console.log(`ID: ${u.uid} | name: ${u.name}`));

  console.log("\n=== FILTERED FOR ACTIVE (!u.isBlocked) ===");
  const active2 = users.filter((u) => !u.isBlocked);
  active2.forEach(u => console.log(`ID: ${u.uid} | name: ${u.name}`));
}

run().catch(console.error);
