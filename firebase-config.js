// firebase-config.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, setLogLevel } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-storage.js";

const firebaseConfig = {
    apiKey: "AIzaSyDLTypVwqqtopBRT0Uh2MP_dLUQVvZ2QZI",
    authDomain: "sutechtvcorporativa.firebaseapp.com",
    projectId: "sutechtvcorporativa",
    storageBucket: "sutechtvcorporativa.firebasestorage.app",
    messagingSenderId: "160016306059",
    appId: "1:160016306059:web:4c75629cb9cd07be89a98e"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);
setLogLevel('debug');

// Export the services so other files can use them
export { auth, db, storage };