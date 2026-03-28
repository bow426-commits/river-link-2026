import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyCDEgez9CO2xane7n1bNIKCDArIAqOnpFA",
  authDomain: "river-link-pro.firebaseapp.com",
  projectId: "river-link-pro",
  storageBucket: "river-link-pro.firebasestorage.app",
  messagingSenderId: "131738281323",
  appId: "1:131738281323:web:27c745868522d443c3982e",
  measurementId: "G-4MVBNL6LKZ"
};

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const auth = getAuth(app);
const db = getFirestore(app);

export { auth, db };