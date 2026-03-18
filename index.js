// ====== FIREBASE INIT =====
if(!window.firebaseInitialized){
  const firebaseConfig = {
    apiKey: "AIzaSyD8thbh1A0KKkvQ5DrdolBFI5KisPWfXKk",
    authDomain: "marketing-4141c.firebaseapp.com",
    projectId: "marketing-4141c",
    storageBucket: "marketing-4141c.firebasestorage.app",
    messagingSenderId: "386014931979",
    appId: "1:386014931979:web:631f056535caa664b5eb0e",
    measurementId: "G-BPENXW6HNL"
  };

  firebase.initializeApp(firebaseConfig);
  window.db = firebase.firestore();
  window.firebaseInitialized = true;
  console.log("✅ Firebase initialized");
}

// ====== GLOBAL STATE =====
let activeView = null;
window.viewInitialized = {
  home:false,
  customer:false,
  input:false,
  profil:false
};

// ====== AUTH CHECK (FIX UTAMA ADA DI SINI) =====
firebase.auth().onAuthStateChanged(async (user) => {
  if (user) {
    try {
      console.log("⏳ Ambil data marketing...");

      const marketingDoc = await db.collection("marketing").doc(user.uid).get();
      const marketingData = marketingDoc.data() || {};

      window.currentUser = {
        uid: user.uid,
        email: user.email,
        role: marketingData.role || null,
        kantorCabang: marketingData.kantorCabang || null,
        nama: marketingData.nama || "",
        fotoURL: marketingData.fotoURL || "",
        motivasi: marketingData.motivasi || "",
        harga: marketingData.harga || { CB:5000, BB:5000, BK:4000 } // 🔥 INI PENTING
      };

      console.log("✅ User Authenticated", window.currentUser);

      // validasi role
      if(!["hunter","kurir","sales"].includes(window.currentUser.role)){
        alert("Role user tidak valid.");
        await firebase.auth().signOut();
        return;
      }

      // 🔥 PENTING: NAVBAR JANGAN JALAN DULU
      // langsung paksa ke home
      showView('home');
      initNavbar();

    } catch(err) {
      console.error("❌ Gagal load data marketing:", err);
      alert("Terjadi kesalahan saat memuat data user.");
    }
  } else {
    window.currentUser = null;
    window.location.replace("login.html");
  }
});


// ====== SPA VIEW SWITCHER =====
function showView(viewName){
  const target = document.getElementById(`view-${viewName}`);
  if(!target) return;

  // Hide semua view
  document.querySelectorAll('.view').forEach(v=>v.classList.remove('active'));

  // Aktifkan target
  target.classList.add('active');
  activeView = target;

  switch(viewName){

    case "home":
      if(!window.viewInitialized.home){
        window.initHomeView?.();
        window.viewInitialized.home = true;
      }
      window.renderHome?.();
      showNavbar();
      break;

    case "input":
      if(!window.viewInitialized.input){
        window.initInputView?.();
        window.viewInitialized.input = true;
      }
      window.renderInput?.();
      hideNavbar();
      break;

    case "customer":
      if(!window.viewInitialized.customer){
        window.initCustomerView?.();
        window.viewInitialized.customer = true;
      }
      window.renderCustomer?.();
      showNavbar();
      break;
    
    case "chatlist":
      console.log("Chat belum dibuat");
      break;

    case "profil":
      if(!window.viewInitialized.profil){
        window.initProfilView?.();
        window.viewInitialized.profil = true;
      }
      showNavbar();
      break;

    default:
      console.warn("View tidak dikenali:", viewName);
  }

  history.replaceState({view:viewName},"","#"+viewName);
  setBackButtonListener();
}


// ===== BACK BUTTON =====
function setBackButtonListener(){
  const btnBack = document.getElementById("btnBackHome");
  if(!btnBack || btnBack.dataset.listener) return;

  btnBack.dataset.listener = "true";
  btnBack.addEventListener("click", ()=>{
    if(activeView) activeView.classList.remove("active");
    showView("home");
  });
}


// ===== NAVBAR =====
const navItems = document.querySelectorAll('.nav-item');
const navCircle = document.getElementById('navCircle');

// 🔥 FIX: NAVBAR JANGAN AUTO JALAN SEBELUM LOGIN
function initNavbar(){
  if(window.navbarInitialized) return;
  window.navbarInitialized = true;

  const navItems = document.querySelectorAll('.nav-item');
  const navCircle = document.getElementById('navCircle');

  navItems.forEach((item, idx) => {
    item.addEventListener('click', () => setActive(idx));
  });

  function setActive(idx){
    if(idx < 0) idx = 0;

    navItems.forEach(i => i.classList.remove('active'));
    navItems[idx].classList.add('active');

    const rect = navItems[idx].getBoundingClientRect();
    const parentRect = navItems[idx].parentElement.getBoundingClientRect();
    const centerX = rect.left + rect.width/2 - parentRect.left;
    navCircle.style.left = `${centerX - navCircle.offsetWidth/2}px`;

    const viewName = navItems[idx].dataset.view;
    showView(viewName);
  }

  // init pertama
  setActive(0);
}

function setActive(idx){
  if(idx < 0) idx = 0;

  navItems.forEach(i => i.classList.remove('active'));
  navItems[idx].classList.add('active');

  const rect = navItems[idx].getBoundingClientRect();
  const parentRect = navItems[idx].parentElement.getBoundingClientRect();
  const centerX = rect.left + rect.width/2 - parentRect.left;
  navCircle.style.left = `${centerX - navCircle.offsetWidth/2}px`;

  const viewName = navItems[idx].dataset.view;
  showView(viewName);
}


// ===== NAVBAR CONTROL =====
function hideNavbar(){
  document.querySelector(".navbar-bottom")?.classList.add("hidden");
}
function showNavbar(){
  document.querySelector(".navbar-bottom")?.classList.remove("hidden");
}


// ===== ALERT =====
function showAlert(message, type="success"){
  const old = document.querySelector(".app-alert");
  if(old) old.remove();

  const alert = document.createElement("div");
  alert.className = `app-alert ${type}`;

  alert.innerHTML = `
    <div class="alert-box">
      <div class="alert-icon">
        ${type === "success"
          ? `<svg viewBox="0 0 24 24"><path d="M9 16.2l-3.5-3.5L4 14.2l5 5 11-11-1.5-1.5z"/></svg>`
          : `<svg viewBox="0 0 24 24"><path d="M12 2a10 10 0 100 20 10 10 0 000-20zm1 14h-2v-2h2v2zm0-4h-2V6h2v6z"/></svg>`
        }
      </div>
      <div class="alert-text">${message}</div>
    </div>
  `;

  document.body.appendChild(alert);

  setTimeout(()=>alert.classList.add("show"),10);
  setTimeout(()=>{
    alert.classList.remove("show");
    setTimeout(()=>alert.remove(),300);
  },2000);
}


// ===== DISABLE ZOOM =====
let lastTouchEnd = 0;
document.addEventListener("touchend", function (event) {
  const now = Date.now();
  if (now - lastTouchEnd <= 300) {
    event.preventDefault();
  }
  lastTouchEnd = now;
}, false);

document.addEventListener('gesturestart', function (e) {
  e.preventDefault();
});

// REGISTER SERVICE WORKER
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/service-worker.js")
      .then(reg => {
        console.log("✅ Service Worker aktif", reg);
      })
      .catch(err => {
        console.log("❌ Service Worker gagal", err);
      });
  });
}