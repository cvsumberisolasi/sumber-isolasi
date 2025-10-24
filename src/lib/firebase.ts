// Import the functions you need from the SDKs you need
import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore, query } from "firebase/firestore";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyDPmSxOvFwB89hYpM3p-fEfX5Yg9w7yOg0",
  authDomain: "sumber-isolasi-76834.firebaseapp.com",
  projectId: "sumber-isolasi-76834",
  storageBucket: "sumber-isolasi-76834.appspot.com",
  messagingSenderId: "940327879799",
  appId: "1:940327879799:web:63431a5461f950719db272"
};

// Initialize Firebase
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const db = getFirestore(app);

export { app, db };
