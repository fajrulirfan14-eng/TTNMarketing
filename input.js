/* ================= GLOBAL CACHE ================= */
window.cacheCustomer = [];
window.cacheCabang = null;
window.cacheDataHarian = {};
window.cacheBawaBarang = null;
window.cacheClosingHariIni = {
  CB:0,
  BB:0,
  BK:0
};
window.filterAnalisa = false;

// ====== BIKIN INISIAL NAMA ====== //
function getInitials(name){
  if(!name) return "?";
  const words = name.trim().split(" ");
  if(words.length === 1) return words[0][0].toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

/* ================= INIT VIEW INPUT ================= */
window.initInputView = async function() {
  console.log("✅ Input view inisialisasi");
  // Tombol back
  const btnBack = document.getElementById("btnBackHome");
  if(btnBack && !btnBack.dataset.listener){
    btnBack.dataset.listener = "true";
    btnBack.addEventListener("click", ()=>{
      showView("home");
    });
  }
  // Tombol Bawa Barang
  const btnBarang = document.getElementById("btnBawaBarang");
  if(btnBarang && !btnBarang.dataset.listener){
    btnBarang.dataset.listener = "true";
    btnBarang.addEventListener("click", async ()=>{
      const data = await loadBawaBarang();
      
      if(!data){
        showAlert("Data bawa barang belum ada","error");
        return;
      }
      
      openBawaBarangPopup(data);
      updateStokRealtime(); // ini sudah oke
    });
  }
  const radioAnalisa = document.getElementById("radioAnalisa");
  
  if(radioAnalisa && !radioAnalisa.dataset.listener){
    radioAnalisa.dataset.listener = "true";
  
    radioAnalisa.addEventListener("change", ()=>{
  
      window.filterAnalisa = radioAnalisa.checked;
  
      applyFilterCustomer();
  
    });
  }
  // **MUAT DATA BAWA BARANG SEKALIAN**
  await loadBawaBarang();  
  updateStokRealtime(); // tampilkan stok real-time langsung
  initSearchAndProgress();
  initKeyboardProgressCard();
}

/* ================= RENDER INPUT VIEW ================= */
window.renderInput = async function(){
  hideNavbar(); // sembunyikan navbar saat input view aktif
  setHeaderHari();
  await loadCustomerInput(); // render ulang customer
}

/* ================= GET HARI ================= */
function getHariIni(){
  const hariNames = ["Minggu","Senin","Selasa","Rabu","Kamis","Jumat","Sabtu"];
  return hariNames[new Date().getDay()];
}

// ===== POPUP BAWA BARANG DAN CEKBOX ANALISA ===== //
async function loadBawaBarang(){
  if(window.cacheBawaBarang) return window.cacheBawaBarang;
  const uid = window.currentUser?.uid;
  if(!uid) return null;
  const doc = await db.collection("marketing").doc(uid).get();
  if(!doc.exists) return null;
  const data = doc.data().bawaBarang || null;
  window.cacheBawaBarang = data;
  return data;
}
function hitungClosingDariCache(){
  let totalCB = 0;
  let totalBB = 0;
  let totalBK = 0;
  Object.values(window.cacheDataHarian).forEach(d=>{
    const konsinyasi = d.konsinyasi || {};
    const ret = d.return || {};
    const cash = d.cash || {};
    const fee = d.fee || {};
    const disable = d.disable || {};
    totalCB +=
      (konsinyasi.CB||0)
      - (ret.CB||0)
      + (cash.CB||0)
      + (fee.CB||0)
      + (disable.CB||0);
    totalBB +=
      (konsinyasi.BB||0)
      - (ret.BB||0)
      + (cash.BB||0)
      + (fee.BB||0)
      + (disable.BB||0);
    totalBK +=
      (konsinyasi.BK||0)
      - (ret.BK||0)
      + (cash.BK||0)
      + (fee.BK||0)
      + (disable.BK||0);
  });
  window.cacheClosingHariIni = {
    CB: totalCB,
    BB: totalBB,
    BK: totalBK
  };
}
function updateStokRealtime(){

  const el = document.getElementById("stokRealtime");
  if(!el) return;

  const bawa = window.cacheBawaBarang;
  if(!bawa) return;

  const closing = window.cacheClosingHariIni;

  const sisaCB = (bawa.CB || 0) - (closing.CB || 0);
  const sisaBB = (bawa.BB || 0) - (closing.BB || 0);
  const sisaBK = (bawa.BK || 0) - (closing.BK || 0);

  el.innerHTML = `
    <span class="cb">CB ${sisaCB}</span>
    <span class="bb">BB ${sisaBB}</span>
    <span class="bk">BK ${sisaBK}</span>
  `;

}
function applyFilterCustomer(){
  let list = window.cacheCustomer
    .filter(c => c.status !== "nonAktif");  // hanya tampilkan customer aktif
  
  if(window.filterAnalisa){
    list = list.filter(c=>{
      if(!c.sudahInput) return false;
      const level = cekSelisihKonsinyasi(c.id);
      return level !== null;
    });
  }
  renderCustomer(list,"view-input");
  updateProgress(list);
}

/* ======== loadDataHarianHariIni ======== */
async function loadDataHarianHariIni(customers, custId){
  if(!custId){
    console.error("❌ custId harus diberikan ke loadDataHarianHariIni");
    return;
  }

  const today = new Date();
  const todayStr =
    today.getFullYear() + "-" +
    String(today.getMonth() + 1).padStart(2, "0") + "-" +
    String(today.getDate()).padStart(2, "0");

  // Reset cache harian
  window.cacheDataHarian = {};
  window.cacheCustId = custId; // simpan custId supaya bisa dipakai fungsi lain

  await Promise.all(customers.map(async c => {
    try {
      const doc = await db
        .collection(custId)              // ✅ collection dinamis sesuai custId
        .doc(c.id)
        .collection("dataHarian")
        .doc(todayStr)
        .get();

      if(doc.exists){
        const data = doc.data();
        window.cacheDataHarian[c.id] = data;
        c.sudahInput = true;
        c.statusHariIni = (data.keterangan || "selesai").toLowerCase().trim();
      } else {
        c.statusHariIni = "selesai";
      }

    } catch(e){
      console.warn("cek dataHarian gagal", e);
      c.statusHariIni = "selesai";
    }
  }));
}

/* ====== INIT SEARCH & PROGRESS ======= */
function initSearchAndProgress(){
  const searchInput = document.getElementById("searchCustomer");
  if(searchInput && !searchInput.dataset.listener){
    searchInput.dataset.listener = "true";
    searchInput.addEventListener("input", () => {
      const term = searchInput.value.toLowerCase().trim();
      const filtered = term
        ? window.cacheCustomer.filter(c => (c.namaCustomer||"-").toLowerCase().includes(term))
        : window.cacheCustomer;
      let result = filtered;
      
      if(window.filterAnalisa){
        result = result.filter(c=>{
          if(!c.sudahInput) return false;
          return cekSelisihKonsinyasi(c.id) !== null;
        });
      }
      
      renderCustomer(result,"view-input");
      updateProgress(result);
    });
  }
  updateProgress(window.cacheCustomer);
}

/* ======= SET HEADER HARI ======= */
function setHeaderHari(){
  const textEl = document.getElementById("headerHariText");
  if(!textEl) return;
  const hari = getHariIni();
  textEl.textContent = `Trayek: ${hari}`;
}

/* ======= LOKASI CABANG & HITUNG JARAK ======== */
async function getLokasiCabang(namaCabang){
  if(window.cacheCabang) return window.cacheCabang;
  const doc = await db.collection("kantorCabang").doc(namaCabang).get();
  if(!doc.exists){
    console.error("❌ kantorCabang tidak ditemukan");
    return null;
  }
  const data = doc.data();
  const lat = data.lokasiKantorCabang?.latitude;
  const lng = data.lokasiKantorCabang?.longitude;
  if(!lat || !lng){
    console.error("❌ lokasiKantorCabang belum ada");
    return null;
  }
  window.cacheCabang = {lat,lng};
  return window.cacheCabang;
}

function hitungJarak(lat1,lng1,lat2,lng2){
  const R = 6371;
  const dLat = (lat2-lat1) * Math.PI/180;
  const dLng = (lng2-lng1) * Math.PI/180;
  const a =
    Math.sin(dLat/2)**2 +
    Math.cos(lat1*Math.PI/180) *
    Math.cos(lat2*Math.PI/180) *
    Math.sin(dLng/2)**2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c; // km
}

/* ================= UPDATE PROGRESS ================= */
function updateProgress(list){
  list = Array.isArray(list) ? list : (window.cacheCustomer || []);
  const total = list.length;
  const done = list.filter(c => c.sudahInput).length;
  const percent = total ? Math.round((done/total)*100) : 0;
  const elHari = document.getElementById("progressHari");
  const elText = document.getElementById("progressText");
  const elFill = document.getElementById("progressFill");
  const elStatus = document.getElementById("progressStatus");
  if(elText) elText.textContent = `Progress ${done} / ${total} toko`;
  if(elFill) elFill.style.width = percent + "%";
  if(elStatus){
    const statusNormalized = list.map(c => (c.statusHariIni || "selesai").toLowerCase().trim());
    const tutupCount = statusNormalized.filter(s => s === "tutup").length;
    const pendingCount = statusNormalized.filter(s => s === "pending").length;
    const putusCount = statusNormalized.filter(s => s === "putus").length;
    elStatus.innerHTML = `
      <span class="status-item tutup">Tutup (${tutupCount})</span>
      <span class="status-item pending">Pending (${pendingCount})</span>
      <span class="status-item putus">Putus (${putusCount})</span>
    `;
  }
}

/* ================= LOAD CUSTOMER ================= */
async function loadCustomerInput() {
  const container = document.getElementById("listCustomerInput");
  if (!container) return console.error("❌ container listCustomerInput tidak ditemukan");

  const uid = window.currentUser?.uid;
  if (!uid) return container.innerHTML = "User belum login";

  const hari = getHariIni();
  console.log("📅 Hari trayek:", hari);

  // Pakai cache jika ada
  if (window.cacheCustomer.length && window.cacheOwner === uid) {
    console.log("⚡ Load dari cache");
    renderCustomer(window.cacheCustomer, "view-input");
    updateProgress(window.cacheCustomer);
    return;
  }

  window.cacheOwner = uid;
  container.innerHTML = "Loading...";

  try {
    // 1️⃣ Ambil marketing doc untuk dapat custId
    const marketingDoc = await db.collection("marketing").doc(uid).get();
    if (!marketingDoc.exists) {
      container.innerHTML = "Data marketing tidak ditemukan";
      return;
    }
    const custId = marketingDoc.data().custId;
    if (!custId) {
      container.innerHTML = "CustId marketing tidak tersedia";
      return;
    }

    // 2️⃣ Query ke collection sesuai custId, filter hari & pemilik
    let queryRef = db.collection(custId)
                      .where("hari", "==", hari)
                      .where("pemilik", "==", uid);

    // Stop listener lama
    if (window.inputCustomerListener) {
      window.inputCustomerListener();
      window.inputCustomerListener = null;
    }

    window.inputCustomerListener = queryRef.onSnapshot(async snapshot => {
      let customers = [];
      snapshot.forEach(doc => {
        const data = doc.data();
        if (data.status !== "nonAktif") {
          customers.push({ id: doc.id, ...data, sudahInput: false, statusHariIni: null });
        }
      });

      if (customers.length === 0) {
        container.innerHTML = "Tidak ada customer";
        window.cacheCustomer = [];
        updateProgress();
        return;
      }

      // Ambil lokasi cabang
      const namaCabang = customers[0]?.kantorCabang;
      const cabang = await getLokasiCabang(namaCabang);

      // Hitung jarak
      customers.forEach(c => {
        const lat = c.lokasiCustomer?.latitude;
        const lng = c.lokasiCustomer?.longitude;
        c.jarak = (lat && lng && cabang)
          ? hitungJarak(cabang.lat, cabang.lng, lat, lng)
          : 9999;
      });

      // ✅ Load data harian hari ini dengan custId
      await loadDataHarianHariIni(customers, custId);

      hitungClosingDariCache();
      updateStokRealtime();

      // Sort: sudah input di bawah, urut jarak
      window.cacheCustomer = customers.sort((a, b) => {
        if (a.sudahInput !== b.sudahInput) return a.sudahInput ? 1 : -1;
        return a.jarak - b.jarak;
      });

      renderCustomer(window.cacheCustomer, "view-input");
      updateProgress(window.cacheCustomer);
    });

  } catch (err) {
    console.error(err);
    container.innerHTML = "Error load data";
  }
}

// ===== ANALISA ===== //
function cekSelisihKonsinyasi(customerId){

  const dataHariIni = window.cacheDataHarian?.[customerId];
  if(!dataHariIni) return null;

  const lastData = dataHariIni.lastData || {};
  const konsinyasi = dataHariIni.konsinyasi || {};

  const lastCB = lastData.CB || 0;
  const lastBB = lastData.BB || 0;
  const lastBK = lastData.BK || 0;

  const konCB = konsinyasi.CB || 0;
  const konBB = konsinyasi.BB || 0;
  const konBK = konsinyasi.BK || 0;

  const selisih =
    Math.abs(lastCB - konCB) +
    Math.abs(lastBB - konBB) +
    Math.abs(lastBK - konBK);

  if(selisih === 0) return null;

  if(selisih <= 3) return "kecil";
  if(selisih <= 6) return "sedang";

  return "besar";
}
/* ================= RENDER CUSTOMER ================= */
function renderCustomer(list = [], viewId="view-input"){
  if(!Array.isArray(list)) list = [];
  const containerId = viewId==="view-input" ? "listCustomerInput" : "customerList";
  const container = document.getElementById(containerId);
  if(!container) return;
  container.innerHTML = "";
  if(list.length === 0){
    container.innerHTML = "Tidak ada customer";
    return;
  }
  list.forEach(data=>{
    const nama = data.namaCustomer || "-";
    const foto = data.fotoURL || "";
    const fotoHTML = foto
      ? `<img class="customer-photo" src="${foto}" alt="${nama}" style="cursor:pointer">`
      : `<div class="customer-photo-initials">${getInitials(nama)}</div>`;
    let jarak = "-";
    if(typeof data.jarak === "number") jarak = data.jarak < 1 ? data.jarak.toFixed(2) : Math.round(data.jarak);
    const CB = data.lastData?.CB || 0;
    const BB = data.lastData?.BB || 0;
    const BK = data.lastData?.BK || 0;
    // Badge status hari ini
    let badgeStatus = "";
    if(data.sudahInput && data.statusHariIni !== "selesai"){
      badgeStatus = `<div class="badge-status ${data.statusHariIni}">${data.statusHariIni}</div>`;
    }
    // Badge analisa konsinyasi
    let badgeAnalisa = "";
    if(data.sudahInput){
      const level = cekSelisihKonsinyasi(data.id);
      if(level) badgeAnalisa = `<div class="badge-analisa ${level}"></div>`;
    }
    // Badge NEW untuk customer baru
    let badgeNew = "";
    if(!data.sudahInput && data.isNew){
      badgeNew = `<div class="badge-new">NEW</div>`;
    }
    // Flag catatan
    const adaCatatan = data.catatan?.trim();
    const flagCatatan = adaCatatan ? `<div class="flag-catatan btn-catatan"></div>` : "";
    const item = document.createElement("div");
    item.className = data.sudahInput ? "customer-item visited" : "customer-item";
    item.innerHTML = `
      ${badgeAnalisa}
      ${badgeNew}
      ${flagCatatan}
      ${fotoHTML}
      <div class="customer-info">
        <div class="customer-name-row">
          <div class="customer-name">${nama}</div>
          ${badgeStatus}
        </div>
        <div class="customer-stock">
          <span class="stock-chip stock-cb">CB ${CB}</span>
          <span class="stock-chip stock-bb">BB ${BB}</span>
          <span class="stock-chip stock-bk">BK ${BK}</span>
        </div>
        <div class="customer-distance">${jarak} km</div>
      </div>
      <div class="customer-actions">
        <div class="btn-catatan" title="Edit Catatan">
          <svg viewBox="0 0 24 24">
            <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zm18-11.5
            c0-.39-.16-.78-.44-1.06l-2.34-2.34
            a1.5 1.5 0 0 0-2.12 0l-1.83 1.83
            3.75 3.75L20.56 6.69
            c.28-.28.44-.67.44-1.06z"/>
          </svg>
        </div>
        <div class="btn-lokasi" title="Buka Lokasi">
          <svg viewBox="0 0 24 24">
            <path d="M12 2C8.1 2 5 5.1 5 9c0 5.2 7 13 7 13s7-7.8 7-13c0-3.9-3.1-7-7-7zm0 9.5A2.5 2.5 0 1 1 12 6a2.5 2.5 0 0 1 0 5.5z"/>
          </svg>
        </div>
      </div>
    `;
    // Event foto
    const fotoEl = item.querySelector(".customer-photo");
    if(fotoEl){
      fotoEl.addEventListener("click", e=>{
        e.stopPropagation();
        openImagePreview(foto);
      });
    }
    // Event lokasi
    item.querySelector(".btn-lokasi")?.addEventListener("click", ()=>{
      const lat = data.lokasiCustomer?.latitude;
      const lng = data.lokasiCustomer?.longitude;
      if(!lat || !lng) return alert("Lokasi tidak tersedia");
      window.open(`https://www.google.com/maps/search/?api=1&query=${lat},${lng}`, "_blank");
    });
    // Event catatan
    item.querySelectorAll(".btn-catatan").forEach(btn=>{
      btn.addEventListener("click",(e)=>{
        e.stopPropagation();
        openCatatanPopup(data);
      });
    });
    // Long press
    let pressTimer;
    let isLongPress = false;
    item.addEventListener("touchstart", (e) => {
      isLongPress = false;
      pressTimer = setTimeout(() => {
        isLongPress = true;
        openCustomerAdvancedPopup(data);
      }, 600);
    });
    item.addEventListener("touchend", () => clearTimeout(pressTimer));
    item.addEventListener("touchmove", () => clearTimeout(pressTimer));
    // Klik normal
    item.addEventListener("click", (e) => {
      if(isLongPress){
        e.preventDefault();
        return;
      }
      openCustomerInputPopup(data);
    });
    container.appendChild(item);
  });
}

/* ================= PREVIEW FOTO ================= */
function openImagePreview(url){
  const overlay = document.createElement("div");
  overlay.className = "image-preview-overlay";
  overlay.innerHTML = `
    <div class="image-preview-box">
      <img src="${url}" alt="Preview">
      <button id="closePreview">OK</button>
    </div>
  `;
  document.body.appendChild(overlay);
  const btnClose = overlay.querySelector("#closePreview");
  btnClose.addEventListener("click", ()=> overlay.remove());
  overlay.addEventListener("click", e=>{
    if(e.target === overlay) overlay.remove();
  });
}

/* ======== KEYBOARD ADJUST PROGRESS CARD ======= */
function initKeyboardProgressCard(){
  const card = document.querySelector(".search-progress-card"); // pakai class, bukan id
  const list = document.getElementById("listCustomerInput");
  if(!card || !list) return;
  function adjustCard(){
    const vh = window.visualViewport?.height || window.innerHeight;
    const offset = window.innerHeight - vh; // tinggi keyboard
    card.style.bottom = offset + "px";       // geser card saat keyboard muncul
    list.style.paddingBottom = (card.offsetHeight + offset + 12) + "px";
  }
  window.visualViewport?.addEventListener("resize", adjustCard);
  window.addEventListener("load", () => setTimeout(adjustCard, 100));
}
// ===== COMPRESS UKURAN FOTO ===== //
async function compressImage(file, maxSizeKB = 500){
  return new Promise((resolve) => {
    const img = new Image();
    const reader = new FileReader();
    reader.onload = function(e){
      img.src = e.target.result;
    };
    img.onload = function(){
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      let width = img.width;
      let height = img.height;
      const maxWidth = 1280;
      if(width > maxWidth){
        height *= maxWidth / width;
        width = maxWidth;
      }
      canvas.width = width;
      canvas.height = height;
      ctx.drawImage(img,0,0,width,height);
      let quality = 0.9;
      function generate(){
        canvas.toBlob(blob=>{
          if(blob.size / 1024 > maxSizeKB && quality > 0.3){
            quality -= 0.1;
            generate();
          }else{
            resolve(blob);
          }
        },"image/jpeg",quality);
      }
      generate();
    };
    reader.readAsDataURL(file);
  });
}
function fileToBase64(file){
  return new Promise((resolve,reject)=>{
    const reader = new FileReader();
    reader.onload = ()=>resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// ====== BUKA & LONG POPUP INPUT DAN CATATAN ====== //
async function openCustomerInputPopup(customer) {
  const nama = customer.namaCustomer || "-";
  const last = customer.lastData || {};
  const now = new Date();
  const tanggal =
    now.getFullYear()+"-"+
    String(now.getMonth()+1).padStart(2,"0")+"-"+
    String(now.getDate()).padStart(2,"0");
  const dataHariIni = window.cacheDataHarian[customer.id] || null;
  const harga = window.currentUser?.harga || { CB:5000, BB:5000, BK:4000 };
  const sourceTagihan = dataHariIni?.lastData || last;
  const tagihan = {
    CB: sourceTagihan.CB ?? "",
    BB: sourceTagihan.BB ?? "",
    BK: sourceTagihan.BK ?? ""
  };
  let createdAtText = "";
  if(last.createdAt){
    const ts = last.createdAt.toDate ? last.createdAt.toDate() : new Date(last.createdAt);
    const hariNames = ["Minggu","Senin","Selasa","Rabu","Kamis","Jumat","Sabtu"];
    const bulanNames = ["Januari","Februari","Maret","April","Mei","Juni","Juli","Agustus","September","Oktober","November","Desember"];
    createdAtText = `${hariNames[ts.getDay()]}, ${ts.getDate()} ${bulanNames[ts.getMonth()]}`;
  }
  const source = dataHariIni || {};
  const categories = {
    return: source.return || { CB:"", BB:"", BK:"" },
    expired: source.expired || { CB:"", BB:"", BK:"" },
    konsinyasi: source.konsinyasi || { CB:"", BB:"", BK:"" },
    cash: source.cash || { CB:"", BB:"", BK:"" },
    tunggakan: source.tunggakan || { CB:"", BB:"", BK:"" },
    fee: source.fee || { CB:"", BB:"", BK:"" },
    disable: source.disable || { CB:"", BB:"", BK:"" }
  };
  const colors = {
    return:"return",
    expired:"expired",
    konsinyasi:"konsinyasi",
    cash:"cash",
    tunggakan:"tunggakan"
  };
  // LABEL UI
  const labelMap = {
    return: "Return",
    expired: "Expired",
    konsinyasi: "Konsinyasi",
    cash: "Cash",
    tunggakan: "Tunggakan / Tutup"
  };
  function formatRibuan(x){
    return x.toString().replace(/\B(?=(\d{3})+(?!\d))/g,".");
  }
  function hitungJumlah() {
    const cbQty =
      ((Number(tagihan.CB) || 0)
      - (Number(categories.return.CB) || 0)
      - (Number(categories.expired.CB) || 0)
      + (Number(categories.cash.CB) || 0)
      - (Number(categories.tunggakan.CB) || 0)
      + (Number(categories.fee.CB) || 0));
  
    const bbQty =
      ((Number(tagihan.BB) || 0)
      - (Number(categories.return.BB) || 0)
      - (Number(categories.expired.BB) || 0)
      + (Number(categories.cash.BB) || 0)
      - (Number(categories.tunggakan.BB) || 0)
      + (Number(categories.fee.BB) || 0));
  
    const bkQty =
      ((Number(tagihan.BK) || 0)
      - (Number(categories.return.BK) || 0)
      - (Number(categories.expired.BK) || 0)
      + (Number(categories.cash.BK) || 0)
      - (Number(categories.tunggakan.BK) || 0)
      + (Number(categories.fee.BK) || 0));
  
    return (cbQty * harga.CB) +
           (bbQty * harga.BB) +
           (bkQty * harga.BK);
  }
  function validasiForm(){
    const konsinyasiInputs = popup.querySelectorAll('.input-group.konsinyasi input');
    const tunggakanInputs = popup.querySelectorAll('.input-group.tunggakan input');
  
    const status = popup.querySelector(
      'input[name="statusToko"]:checked'
    )?.value || null;
    let adaKonsinyasi = false;
    let adaTunggakan = false;
    konsinyasiInputs.forEach(i=>{
      if(i.value !== ""){
        adaKonsinyasi = true;
      }
    });
    tunggakanInputs.forEach(i=>{
      if(i.value !== ""){
        adaTunggakan = true;
      }
    });
    // =============================
    // RULE 1
    // =============================
    if(!adaKonsinyasi && !adaTunggakan){
      return false;
    }
    // =============================
    // RULE 3
    // =============================
    if(adaTunggakan){
      if(!status) return false;
      if(!fotoFile) return false;
    }
    // =============================
    // RULE 2
    // =============================
    if(status === "tutup"){
      if(
        Number(categories.tunggakan.CB || 0) !== Number(tagihan.CB || 0) ||
        Number(categories.tunggakan.BB || 0) !== Number(tagihan.BB || 0) ||
        Number(categories.tunggakan.BK || 0) !== Number(tagihan.BK || 0)
      ){
        return false;
      }
    }
    return true;
  }
  function updateBtnKirim(){
  if(validasiForm()){
    btnKirim.disabled = false;
    btnKirim.style.opacity = "1";
  }else{
    btnKirim.disabled = true;
    btnKirim.style.opacity = "0.5";
  }
}
  const popup = document.createElement("div");
  popup.className = "customer-input-popup";
  let html = `
    <div>
      <h1>${nama}</h1>
      <div class="last-data">
        <div class="customer-stock">
          <span class="stock-chip stock-cb">CB ${tagihan.CB}</span>
          <span class="stock-chip stock-bb">BB ${tagihan.BB}</span>
          <span class="stock-chip stock-bk">BK ${tagihan.BK}</span>
        </div>
        ${createdAtText ? `<div class="created-at">${createdAtText}</div>` : ""}
      </div>
      <div class="jumlah-pembayaran">
        <label>Jumlah Pembayaran</label>
        <input type="text" value="${formatRibuan(hitungJumlah())}" readonly>
      </div>
  `;
  for (let key of ["return","expired","konsinyasi","cash","tunggakan"]) {
    html += `
      <div class="input-group ${colors[key]}">
        <label>${labelMap[key]}</label>
        <div class="input-row">
          <input type="number" placeholder="CB" min="0"
            value="${categories[key].CB || ""}"
            data-key="${key}" data-type="CB">
          <input type="number" placeholder="BB" min="0"
            value="${categories[key].BB || ""}"
            data-key="${key}" data-type="BB">
          <input type="number" placeholder="BK" min="0"
            value="${categories[key].BK || ""}"
            data-key="${key}" data-type="BK">
        </div>
      </div>
    `;
  }
  html += `
    <div class="btn-foto-container" style="display:none">
  <label class="btn-foto">
  <input type="file"
  accept="image/*"
  capture="environment"
  style="display:none"
  id="cameraInput">
  <svg viewBox="0 0 24 24">
  <path d="M20 5h-3.2l-1.8-2H9L7.2 5H4c-1.1 0-2 .9-2 
  2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 
  2-2V7c0-1.1-.9-2-2-2zm-8 
  13a4 4 0 1 1 0-8 4 4 0 0 1 0 8z"/>
  </svg>
  <span>Ambil Foto</span>
  </label>
  <div class="status-tunggakan" style="display:none">
  <label class="status-item tutup">
  <input type="radio" name="statusToko" value="tutup">
  <span>Tutup</span>
  </label>
  <label class="status-item pending">
  <input type="radio" name="statusToko" value="pending">
  <span>Pending</span>
  </label>
  <label class="status-item putus">
  <input type="radio" name="statusToko" value="putus">
  <span>Putus</span>
  </label>
  </div>
  </div>
  <button id="btnKirim">Kirim</button>
  </div>
  `;
  popup.innerHTML = html;
  document.body.appendChild(popup);
  if(dataHariIni?.keterangan){
    const radio = popup.querySelector(
      `input[name="statusToko"][value="${dataHariIni.keterangan}"]`
    );
    if(radio) radio.checked = true;
  }
  if(dataHariIni?.fotoKeterangan){
    btnFoto.innerHTML = `
      <img src="${dataHariIni.fotoKeterangan}" class="foto-preview">
    `;
  }
  /* ===== HIGHLIGHT INPUT JIKA LAST DATA = 0 ===== */
  const bgColors = {
    return:"#fff3cd",
    expired:"#f8d7da",
    konsinyasi:"#d4edda",
    cash:"#d1ecf1",
    tunggakan:"#e2e3ff"
  };
  popup.querySelectorAll(".input-group").forEach(group => {
    let kategori =
      group.classList.contains("return") ? "return" :
      group.classList.contains("expired") ? "expired" :
      group.classList.contains("konsinyasi") ? "konsinyasi" :
      group.classList.contains("cash") ? "cash" :
      group.classList.contains("tunggakan") ? "tunggakan" : null;
    if(!kategori) return;
    const inputs = group.querySelectorAll("input");
    inputs.forEach(input => {
      const type = input.dataset.type;
      if(Number(tagihan[type]) === 0){
        input.style.background = bgColors[kategori];
      }
    });
  });
  const inputs = popup.querySelectorAll('.input-row input');
  const fotoContainer = popup.querySelector('.btn-foto-container');
  const statusContainer = popup.querySelector('.status-tunggakan');
  const statusRadios = popup.querySelectorAll('input[name="statusToko"]');
  const cameraInput = popup.querySelector('#cameraInput');
  const btnFoto = popup.querySelector('.btn-foto');
  let fotoFile = null;
  cameraInput.addEventListener("change", async function(){
    const file = this.files[0];
    if(!file) return;
    // compress otomatis
    const compressedBlob = await compressImage(file,500);
    fotoFile = new File(
      [compressedBlob],
      "foto_toko.jpg",
      {type:"image/jpeg"}
    );
    const url = URL.createObjectURL(fotoFile);
    btnFoto.innerHTML = `
      <img src="${url}" class="foto-preview">
    `;
    updateBtnKirim();
  });
  btnFoto.addEventListener("click", function(e){
    if(e.target.tagName === "IMG"){
      e.preventDefault();
      cameraInput.click();
    }
  });
  function checkTunggakan(){
  const tunggakanInputs = popup.querySelectorAll(
  '.input-group.tunggakan input'
  );
  const kategoriInputs = popup.querySelectorAll(
  '.input-group.return input, \
   .input-group.expired input, \
   .input-group.konsinyasi input, \
   .input-group.cash input'
  );
  let adaTunggakan = false;
  tunggakanInputs.forEach(input=>{
    if(input.value !== ""){
      adaTunggakan = true;
    }
  });
    if(adaTunggakan){
    fotoContainer.style.display = "block";
    statusContainer.style.display = "flex";
    }else{
    fotoContainer.style.display = "none";
    statusContainer.style.display = "none";
    }
  }
  const pembayaranInput = popup.querySelector('.jumlah-pembayaran input');
  inputs.forEach(input=>{
    input.addEventListener('input', (e)=>{
      const key = e.target.dataset.key;
      const type = e.target.dataset.type;
      categories[key][type] = e.target.value
        ? Number(e.target.value)
        : 0;
      pembayaranInput.value = formatRibuan(hitungJumlah());
      checkTunggakan();
      updateBtnKirim();
    });
  });
  statusRadios.forEach(r=>{
    r.addEventListener("change", updateBtnKirim);
  });
  const btnKirim = popup.querySelector("#btnKirim");
  btnKirim.addEventListener("click", async () => {
    if(!validasiForm()){
      btnKirim.textContent = "Gagal, cek input";
      setTimeout(() => {
        btnKirim.textContent = "Kirim";
        btnKirim.dataset.loading = "";
      }, 2000);
      return;
    }
    if(btnKirim.dataset.loading) return;
    btnKirim.dataset.loading = "true";
    btnKirim.textContent = "Loading...";
  
    try {
      const custId = window.cacheCustId;
      if(!custId){
        throw new Error("❌ custId belum tersedia, loadDataHarianHariIni belum dijalankan");
      }
  
      const status = popup.querySelector(
        'input[name="statusToko"]:checked'
      )?.value || null;
  
      let fotoBase64 = null;
      if(fotoFile){
        fotoBase64 = await fileToBase64(fotoFile);
      }
  
      const now = new Date();
      const tanggal =
        now.getFullYear() + "-" +
        String(now.getMonth() + 1).padStart(2, "0") + "-" +
        String(now.getDate()).padStart(2, "0");
  
      const lastDataBaru = {
        CB: (categories.konsinyasi.CB || 0) + (categories.tunggakan.CB || 0),
        BB: (categories.konsinyasi.BB || 0) + (categories.tunggakan.BB || 0),
        BK: (categories.konsinyasi.BK || 0) + (categories.tunggakan.BK || 0),
        bayar: hitungJumlah(),
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      };
  
      const dataHarian = {
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        lastData: tagihan,
        return: categories.return,
        expired: categories.expired,
        konsinyasi: categories.konsinyasi,
        cash: categories.cash,
        tunggakan: categories.tunggakan,
        fotoKeterangan: fotoBase64,
        keterangan: status
      };
  
      const db = firebase.firestore();
      const ref = db.collection(custId).doc(customer.id); // ✅ pakai custId
      const batch = db.batch();
      batch.update(ref, {
        lastData: lastDataBaru
      });
      batch.set(
        ref.collection("dataHarian").doc(tanggal),
        dataHarian
      );
  
      await batch.commit();
  
      // Update cacheClosingHariIni
      const tambahCB =
      (categories.konsinyasi.CB || 0)
      - (categories.return.CB || 0)
      + (categories.cash.CB || 0)
      + (categories.fee.CB || 0)
      + (categories.disable.CB || 0);
    
    const tambahBB =
      (categories.konsinyasi.BB || 0)
      - (categories.return.BB || 0)
      + (categories.cash.BB || 0)
      + (categories.fee.BB || 0)
      + (categories.disable.BB || 0);
    
    const tambahBK =
      (categories.konsinyasi.BK || 0)
      - (categories.return.BK || 0)
      + (categories.cash.BK || 0)
      + (categories.fee.BK || 0)
      + (categories.disable.BK || 0);
  
      window.cacheClosingHariIni.CB += tambahCB;
      window.cacheClosingHariIni.BB += tambahBB;
      window.cacheClosingHariIni.BK += tambahBK;
  
      updateStokRealtime();
  
      // Update cache data
      window.cacheDataHarian[customer.id] = dataHarian;
      customer.sudahInput = true;
      customer.statusHariIni = status || "selesai";
  
      // Sort dan render customer
      window.cacheCustomer.sort((a,b) => a.sudahInput === b.sudahInput ? 0 : (a.sudahInput ? 1 : -1));
      renderCustomer(window.cacheCustomer);
      updateProgress(window.cacheCustomer);
  
      btnKirim.textContent = "Sukses ✓";
      setTimeout(() => popup.remove(), 800);
  
    } catch(err){
      console.error(err);
      btnKirim.textContent = "Gagal, coba cek lagi";
      setTimeout(() => {
        btnKirim.textContent = "Kirim";
        btnKirim.dataset.loading = "";
      }, 2000);
    }
  });
  popup.addEventListener("click", e => {
    if(e.target === popup) popup.remove();
  });
}
// ===== POPUP BAWA BARANG ===== //
function hitungExpiredHariIni(){
  let expCB = 0
  let expBB = 0
  let expBK = 0
  Object.values(window.cacheDataHarian).forEach(d=>{
    const exp = d.expired || {}
    expCB += exp.CB || 0
    expBB += exp.BB || 0
    expBK += exp.BK || 0
  })
  return {
    CB: expCB,
    BB: expBB,
    BK: expBK
  }
}
function hitungFeeDisableHariIni(){
  let feeCB = 0, feeBB = 0, feeBK = 0;
  let disCB = 0, disBB = 0, disBK = 0;

  Object.values(window.cacheDataHarian).forEach(d=>{
    const fee = d.fee || {};
    const dis = d.disable || {};

    feeCB += fee.CB || 0;
    feeBB += fee.BB || 0;
    feeBK += fee.BK || 0;

    disCB += dis.CB || 0;
    disBB += dis.BB || 0;
    disBK += dis.BK || 0;
  });

  return {
    fee: { CB: feeCB, BB: feeBB, BK: feeBK },
    disable: { CB: disCB, BB: disBB, BK: disBK }
  };
}
function hitungPembayaranHariIni(){
  let total = 0
  const sekarang = new Date()
  const todayStart = new Date(sekarang.getFullYear(), sekarang.getMonth(), sekarang.getDate())
  const todayEnd = new Date(sekarang.getFullYear(), sekarang.getMonth(), sekarang.getDate() + 1)
  window.cacheCustomer.forEach(c => {
    const last = c.lastData
    if(!last) return
    const bayar = last.bayar || 0
    const createdAt = last.createdAt
    if(!createdAt) return
    const t = createdAt.toDate()
    if(t >= todayStart && t < todayEnd){
      total += bayar
    }
  })
  return total
}
function openBawaBarangPopup(data){
  const expired = hitungExpiredHariIni();
  const totalBayar = hitungPembayaranHariIni();
  const popup = document.createElement("div");
  popup.className = "customer-input-popup";
  const { fee, disable } = hitungFeeDisableHariIni();

  // Data awal customer
  const barang = [
    { kode: "CB", jumlah: data?.CB || 0, fee: fee.CB, disable: disable.CB },
    { kode: "BB", jumlah: data?.BB || 0, fee: fee.BB, disable: disable.BB },
    { kode: "BK", jumlah: data?.BK || 0, fee: fee.BK, disable: disable.BK }
  ];

  // Closing dari cache
  const closing = {
    CB: window.cacheClosingHariIni.CB,
    BB: window.cacheClosingHariIni.BB,
    BK: window.cacheClosingHariIni.BK
  };

  // Saldo & expired
  barang.forEach(b => {
    b.closing = closing[b.kode] || 0;
    b.saldo = b.jumlah - b.closing;
    b.expired = expired[b.kode] || 0;
  });

  const jumlahClosing = barang.reduce((sum, b) => sum + b.closing, 0);

  // Tanggal
  let tanggal = "";
  if(data?.createdAt){
    const d = data.createdAt.toDate();
    const hari = ["Minggu","Senin","Selasa","Rabu","Kamis","Jumat","Sabtu"];
    const bulan = ["Januari","Februari","Maret","April","Mei","Juni","Juli","Agustus","September","Oktober","November","Desember"];
    tanggal = `${hari[d.getDay()]}, ${d.getDate()} ${bulan[d.getMonth()]}`;
  }

  const renderChips = (arr, key) => arr.map(b => `<span class="stock-chip stock-${b.kode.toLowerCase()}">${b.kode} ${b[key]}</span>`).join("");

  popup.innerHTML = `
  <div>
    <h1>Bawa Barang</h1>

    <div class="last-data">
      <div class="customer-stock">
        ${renderChips(barang, "jumlah")}
      </div>
      ${tanggal ? `<div class="created-at">${tanggal}</div>` : ""}
    </div>

    <div class="last-data">
      <div style="font-weight:bold">Expired</div>
      <div class="customer-stock">
        ${renderChips(barang, "expired")}
      </div>

      <div style="font-weight:bold; margin-top:5px;">Fee</div>
      <div class="customer-stock">
        ${renderChips(barang, "fee")}
      </div>

      <div style="font-weight:bold; margin-top:5px;">Disable</div>
      <div class="customer-stock">
        ${renderChips(barang, "disable")}
      </div>
    </div>

    <div class="last-data">
      <div style="font-weight:bold">Closing</div>
      <div class="customer-stock">
        ${renderChips(barang, "closing")}
      </div>
      <div class="created-at">Jumlah ${jumlahClosing}</div>
    </div>

    <div class="last-data">
      <div style="font-weight:bold">Saldo Barang</div>
      <div class="customer-stock">
        ${renderChips(barang, "saldo")}
      </div>
    </div>

    <div class="jumlah-pembayaran">
      <label>Jumlah Pembayaran</label>
      <input type="text" readonly value="${totalBayar.toLocaleString('id-ID')}">
    </div>

    <div class="info-text">
      <p>*Hubungi admin jika pembawaan barang belum di-update</p>
      <p>*Pastikan saldo barang sesuai dengan real saldo</p>
    </div>
  </div>
  `;

  document.body.appendChild(popup);
  popup.addEventListener("click", e => {
    if(e.target === popup) popup.remove();
  });
}
// ===== POPUP INPUT DISABLE DAN FEE ===== //
function openCustomerAdvancedPopup(customer){
  const popup = document.createElement("div");
  popup.className = "customer-input-popup";
  popup.innerHTML = `
  <div>
    <h1>${customer.namaCustomer}</h1>
    <div class="input-group disable">
      <label>Disable</label>
      <div class="input-row">
        <input type="number" placeholder="CB" id="disCB">
        <input type="number" placeholder="BB" id="disBB">
        <input type="number" placeholder="BK" id="disBK">
      </div>
    </div>
    <div class="input-group fee">
      <label>Fee</label>
      <div class="input-row">
        <input type="number" placeholder="CB" id="feeCB">
        <input type="number" placeholder="BB" id="feeBB">
        <input type="number" placeholder="BK" id="feeBK">
      </div>
    </div>
    <button id="btnSimpanLanjutan">Simpan</button>
  </div>
  `;
  document.body.appendChild(popup);

  const btn = popup.querySelector("#btnSimpanLanjutan");
  const disCB = popup.querySelector("#disCB");
  const disBB = popup.querySelector("#disBB");
  const disBK = popup.querySelector("#disBK");
  const feeCB = popup.querySelector("#feeCB");
  const feeBB = popup.querySelector("#feeBB");
  const feeBK = popup.querySelector("#feeBK");

  const today = new Date();
  const tanggal =
    today.getFullYear()+"-"+
    String(today.getMonth()+1).padStart(2,"0")+"-"+
    String(today.getDate()).padStart(2,"0");

  // =========================
  // LOAD DARI CACHE (INSTANT)
  // =========================
  const dataHariIni = window.cacheDataHarian?.[customer.id];
  if(dataHariIni){
    if(dataHariIni.disable){
      disCB.value = dataHariIni.disable.CB || "";
      disBB.value = dataHariIni.disable.BB || "";
      disBK.value = dataHariIni.disable.BK || "";
    }
    if(dataHariIni.fee){
      feeCB.value = dataHariIni.fee.CB || "";
      feeBB.value = dataHariIni.fee.BB || "";
      feeBK.value = dataHariIni.fee.BK || "";
    }
  }

  // =========================
  // SIMPAN DATA KE SUBCOLLECTION dataHarian DI COLLECTION custId
  // =========================
  btn.addEventListener("click", async ()=>{
    if(btn.dataset.loading) return;
    btn.dataset.loading = "true";
    btn.textContent = "Loading...";

    const disable = {
      CB: Number(disCB.value || 0),
      BB: Number(disBB.value || 0),
      BK: Number(disBK.value || 0)
    };
    const fee = {
      CB: Number(feeCB.value || 0),
      BB: Number(feeBB.value || 0),
      BK: Number(feeBK.value || 0)
    };

    try{
      const custId = customer.custId || window.currentCustId;
      if(!custId) throw new Error("CustId tidak tersedia");

      await db
        .collection(custId)
        .doc(customer.id)
        .collection("dataHarian")
        .doc(tanggal)
        .set({
          disable: disable,
          fee: fee
        }, { merge: true });

      // =========================
      // UPDATE CACHE
      // =========================
      if(!window.cacheDataHarian[customer.id]){
        window.cacheDataHarian[customer.id] = {};
      }
      window.cacheDataHarian[customer.id].disable = disable;
      window.cacheDataHarian[customer.id].fee = fee;

      btn.textContent = "Berhasil ✓";
      setTimeout(()=>{
        popup.remove();
      }, 800);
    }catch(err){
      console.error(err);
      btn.textContent = "Gagal";
      setTimeout(()=>{
        btn.textContent = "Simpan";
        btn.dataset.loading = "";
      }, 1000);
    }
  });

  popup.addEventListener("click", e=>{
    if(e.target === popup) popup.remove();
  });
}
function saveFeeDisable(customerId, newFee, newDisable){
  if(!window.cacheDataHarian[customerId]){
    window.cacheDataHarian[customerId] = {};
  }
  window.cacheDataHarian[customerId].fee = newFee;
  window.cacheDataHarian[customerId].disable = newDisable;

  const custId = window.cacheCustId;
  const todayStr = new Date().toISOString().slice(0,10);

  db.collection(custId)
    .doc(customerId)
    .collection("dataHarian")
    .doc(todayStr)
    .set({
      fee: newFee,
      disable: newDisable
    }, { merge:true });
  
  hitungClosingDariCache();
  updateStokRealtime();
}
// ===== POPUP CATATAN ===== //
window.openCatatanPopup = async function(customer) {
  if(!customer) return;

  const overlay = document.createElement("div");
  overlay.className = "catatan-overlay";
  overlay.innerHTML = `
    <div class="catatan-box">
      <h1>${customer.namaCustomer || "-"}</h1>
      <textarea id="catatanField" placeholder="Catatan...">${customer.catatan || ""}</textarea>
      <button id="btnSimpanCatatan">Simpan</button>
    </div>
  `;
  document.body.appendChild(overlay);

  overlay.addEventListener("click", e => {
    if(e.target === overlay) overlay.remove();
  });

  document.getElementById("btnSimpanCatatan").addEventListener("click", async () => {
    const value = document.getElementById("catatanField").value.trim();

    if(!window.currentUser?.uid){
      showAlert("User belum login","error");
      return;
    }

    try {
      const marketingDoc = await db.collection("marketing")
        .doc(window.currentUser.uid).get();

      if(!marketingDoc.exists){
        showAlert("Data marketing tidak ditemukan","error");
        return;
      }

      const custId = marketingDoc.data().custId;
      if(!custId){
        showAlert("CustId tidak tersedia","error");
        return;
      }

      await db.collection(custId).doc(customer.id).set(
        { catatan: value },
        { merge: true }
      );

      overlay.remove();
      showAlert("Catatan berhasil disimpan","success");

    } catch(err){
      console.error(err);
      showAlert("Gagal menyimpan catatan","error");
    }
  });
};