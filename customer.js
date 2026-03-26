// ====== INIT VIEW CUSTOMER ====== //
window.initCustomerView = async function(){
  console.log("✅ Customer view aktif");
  console.log("UID user saat ini:", window.currentUser?.uid);
  loadCustomer();

  const btnHari = document.getElementById("btnHari");
  const dropdown = document.getElementById("dropdownHari");

  if(btnHari && !btnHari.dataset.listener){
    btnHari.dataset.listener = "true";
    btnHari.addEventListener("click", e=>{
      e.stopPropagation();
      dropdown.style.display = dropdown.style.display==="block"?"none":"block";
    });
    document.addEventListener("click", ()=>{ dropdown.style.display="none"; });
  }

  dropdown.querySelectorAll("li").forEach(li=>{
    if(!li.dataset.listener){
      li.dataset.listener = "true";
      li.addEventListener("click", ()=>{
        const selectedHari = li.dataset.hari;
        window.selectedHari = selectedHari;
        document.getElementById("infoHari").textContent = "Hari: " + selectedHari;
        dropdown.style.display = "none";
        displayCustomers();
      });
    }
  });

  // ====== SEARCH CUSTOMER VIEW ====== //
  const searchInput = document.getElementById("searchNameCustomer");
  if(searchInput && !searchInput.dataset.listenerViewCustomer){
    searchInput.dataset.listenerViewCustomer = "true";
    searchInput.addEventListener("input", () => {
      displayCustomers(); // filter by search + hari
    });
  }
};

// ====== HITUNG JARAK DENGAN HAVERSINE ====== //
function getDistance(lat1,lng1,lat2,lng2){
  const R = 6371;
  const dLat = (lat2-lat1)*Math.PI/180;
  const dLng = (lng2-lng1)*Math.PI/180;
  const a = Math.sin(dLat/2)**2 +
            Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*
            Math.sin(dLng/2)**2;
  const c = 2*Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R*c;
}

// ====== DATA CUSTOMER GLOBAL ====== //
window.allCustomers = [];
window.cacheLastDataHarian = {};
window.cacheListenerDataHarian = {};

// ====== LOAD CUSTOMER ====== //
function getCustomerCacheKey(uid){
  return "customerCache_" + uid;
}
function saveCustomerCache(uid, data){
  localStorage.setItem(getCustomerCacheKey(uid), JSON.stringify({
    data,
    lastUpdated: Date.now()
  }));
}
function getCustomerCache(uid){
  const cache = localStorage.getItem(getCustomerCacheKey(uid));
  return cache ? JSON.parse(cache) : null;
}
function listenCustomerRealtime(uid, custId, latK, lngK){

  // stop listener lama biar ga double
  if(window.customerUnsubscribe){
    window.customerUnsubscribe();
  }

  window.customerUnsubscribe = db.collection(custId)
    .where("pemilik","==",uid)
    .onSnapshot(snapshot => {

      console.log("🔥 Realtime update customer");

      let newData = [];

      snapshot.forEach(doc=>{
        const data = doc.data();

        if(!data.lokasiCustomer) return;

        const latC = data.lokasiCustomer.latitude;
        const lngC = data.lokasiCustomer.longitude;

        if(latC == null || lngC == null) return;

        const distance = getDistance(latC, lngC, latK, lngK);

        newData.push({
          id: doc.id,
          data,
          distance,
          custId
        });
      });

      // sort berdasarkan jarak
      newData.sort((a,b)=>a.distance-b.distance);

      // update global
      window.allCustomers = newData;

      // update cache
      saveCustomerCache(uid, newData);

      // render ulang UI
      displayCustomers();
    });
}
async function loadCustomer(){
  const container = document.getElementById("customerList");
  container.innerHTML = "Loading...";

  const uid = window.currentUser?.uid;
  if(!uid){
    container.innerHTML = "User tidak terautentikasi";
    return;
  }

  try{

    // =========================
    // 1. CEK CACHE
    // =========================
    const cache = getCustomerCache(uid);

    if(cache && cache.data){
      console.log("⚡ Load dari cache");

      window.allCustomers = cache.data;
      displayCustomers();

      // tetap lanjut ambil data fresh + realtime
    }

    // =========================
    // 2. AMBIL DATA USER
    // =========================
    const userDoc = await db.collection("marketing").doc(uid).get();
    if(!userDoc.exists){
      container.innerHTML="Data user tidak ditemukan";
      return;
    }

    const userData = userDoc.data();
    const custId = userData.custId;
    const kantorCabang = userData.kantorCabang;

    if(!custId){
      container.innerHTML="User belum memiliki custId";
      return;
    }

    // =========================
    // 3. AMBIL LOKASI CABANG
    // =========================
    const cabangDoc = await db.collection("kantorCabang").doc(kantorCabang).get();
    const lokasiCabang = cabangDoc.data()?.lokasiKantorCabang;

    if(!lokasiCabang){
      container.innerHTML="Lokasi cabang tidak ditemukan";
      return;
    }

    const latK = lokasiCabang.latitude;
    const lngK = lokasiCabang.longitude;

    // =========================
    // 4. FETCH AWAL (BIAR CEPAT)
    // =========================
    const snapshot = await db.collection(custId)
      .where("pemilik","==",uid)
      .get();

    let newData = [];

    snapshot.forEach(doc=>{
      const data = doc.data();

      if(!data.lokasiCustomer) return;

      const latC = data.lokasiCustomer.latitude;
      const lngC = data.lokasiCustomer.longitude;

      if(latC == null || lngC == null) return;

      const distance = getDistance(latC, lngC, latK, lngK);

      newData.push({
        id: doc.id,
        data,
        distance,
        custId
      });
    });

    // sort
    newData.sort((a,b)=>a.distance-b.distance);

    // update global
    window.allCustomers = newData;

    // simpan cache
    saveCustomerCache(uid, newData);

    // tampilkan
    displayCustomers();

    // =========================
    // 5. AKTIFKAN REALTIME 🔥
    // =========================
    listenCustomerRealtime(uid, custId, latK, lngK);

  } catch(err){
    console.error(err);
    container.innerHTML = "Error sistem";
  }
}
async function refreshCustomerFromServer(uid){
  try{
    console.log("🔄 Refresh background...");

    const userDoc = await db.collection("marketing").doc(uid).get();
    const userData = userDoc.data();

    const custId = userData.custId;
    const kantorCabang = userData.kantorCabang;

    // ===== ambil lokasi cabang =====
    const cabangDoc = await db.collection("kantorCabang").doc(kantorCabang).get();
    const lokasiCabang = cabangDoc.data()?.lokasiKantorCabang;

    if(!lokasiCabang) return;

    const latK = lokasiCabang.latitude;
    const lngK = lokasiCabang.longitude;

    // ===== ambil data terbaru =====
    const snapshot = await db.collection(custId)
      .where("pemilik","==",uid)
      .get();

    let newData = [];

    snapshot.forEach(doc=>{
      const data = doc.data();

      if(!data.lokasiCustomer) return;

      const latC = data.lokasiCustomer.latitude;
      const lngC = data.lokasiCustomer.longitude;

      if(latC == null || lngC == null) return;

      const distance = getDistance(latC, lngC, latK, lngK);

      newData.push({
        id: doc.id,
        data,
        distance,
        custId
      });
    });

    // 🔥 sort
    newData.sort((a,b)=>a.distance-b.distance);

    // =========================
    // 2. CEK PERUBAHAN
    // =========================
    if(JSON.stringify(newData) !== JSON.stringify(window.allCustomers)){
      console.log("🔥 Data berubah → update UI");

      window.allCustomers = newData;
      saveCustomerCache(uid, newData);
      displayCustomers();

    } else {
      console.log("✅ Data sama, skip update");
    }

  } catch(err){
    console.error("Refresh error:", err);
  }
}

// ====== DISPLAY CUSTOMER LIST ====== //
function displayCustomers(){
  const container = document.getElementById("customerList");
  const hariFilter = window.selectedHari || new Date().toLocaleDateString('id-ID',{ weekday:'long' });
  const searchTerm = document.getElementById("searchNameCustomer")?.value.toLowerCase() || "";

  const filtered = window.allCustomers.filter(c=>{
    const matchHari = (hariFilter==="Semua" || c.data.hari===hariFilter);
    const matchSearch = c.data.namaCustomer.toLowerCase().includes(searchTerm) ||
                        (c.data.alamatCustomer||"").toLowerCase().includes(searchTerm);
    const isActive = c.data.status !== "nonAktif"; // <-- filter customer nonAktif
    return matchHari && matchSearch && isActive;
  });

  document.getElementById("infoJumlah").textContent="Jumlah Customer: "+filtered.length;
  document.getElementById("infoHari").textContent="Hari: "+hariFilter;
  container.innerHTML="";

  if(filtered.length===0) return container.innerHTML="Belum ada customer";

  filtered.forEach(cust=>{
    const data = cust.data;
    const card = document.createElement("div");
    card.className = "customer-card";
    const adaCatatan = data.catatan?.trim();
    const flagCatatan = adaCatatan
      ? `<div class="flag-catatan-customer btn-catatan-customer"></div>`
      : "";
    // === Foto / Inisial ===
    let fotoHTML = "";
    const isNew = data.isNew === true; // cek flag
    if(data.fotoURL && data.fotoURL.trim() !== ""){
      fotoHTML = `
        <div class="customer-foto-wrapper">
          <img class="customer-foto" src="${data.fotoURL}" alt="${data.namaCustomer}">
          ${isNew ? '<span class="new-badge">NEW</span>' : ''}
        </div>`;
    } else {
      const initials = data.namaCustomer.split(" ").map(n=>n[0].toUpperCase()).join("").slice(0,2);
      fotoHTML = `
        <div class="customer-foto-wrapper">
          <div class="customer-foto-initials">${initials}</div>
          ${isNew ? '<span class="new-badge">NEW</span>' : ''}
        </div>`;
    }

    card.innerHTML = `
      ${flagCatatan}
      ${fotoHTML}
    
      <div class="customer-info">
        <div class="nama">${data.namaCustomer}</div>
        <div class="alamat">${data.alamatCustomer || data.kantorCabang}</div>
        <div class="alamat">
          Jarak: ${(cust.distance ?? 0).toFixed(2)} km
        </div>
      </div>
    
      <div class="customer-actions">
    
        <div class="customer-edit-btn btn-catatan-customer" title="Edit Catatan">
          <svg viewBox="0 0 24 24">
            <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zm18-11.5
            c0-.39-.16-.78-.44-1.06l-2.34-2.34
            a1.5 1.5 0 0 0-2.12 0l-1.83 1.83
            3.75 3.75L20.56 6.69
            c.28-.28.44-.67.44-1.06z"/>
          </svg>
        </div>
    
        <div class="customer-map-btn" title="Buka Google Map">
          <svg viewBox="0 0 24 24">
            <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13
            s7-7.75 7-13c0-3.87-3.13-7-7-7zm0
            9.5c-1.38 0-2.5-1.12-2.5-2.5
            S10.62 6.5 12 6.5 14.5 7.62 14.5 9
            13.38 11.5 12 11.5z"/>
          </svg>
        </div>
    
      </div>
    `;
    card.querySelectorAll(".btn-catatan-customer").forEach(btn=>{
      btn.addEventListener("click", e=>{
        e.stopPropagation();
        openCatatanPopup({
          id: cust.id,
          namaCustomer: data.namaCustomer,
          catatan: data.catatan
        });
      });
    });
    // === Buka map ===
    card.querySelector(".customer-map-btn").addEventListener("click", e=>{
      e.stopPropagation();
      const lat = data.lokasiCustomer.latitude;
      const lng = data.lokasiCustomer.longitude;
      window.open(`https://www.google.com/maps/search/?api=1&query=${lat},${lng}`,"_blank");
    });

    // === Klik foto → preview ===
    const fotoElem = card.querySelector(".customer-foto, .customer-foto-initials");
    fotoElem.addEventListener("click", e=>{
      e.stopPropagation();
      const popup = document.createElement("div");
      popup.className="customer-view-popup";

      if(data.fotoURL && data.fotoURL.trim() !== ""){
        popup.innerHTML = `<div><img src="${data.fotoURL}" alt="${data.namaCustomer}" style="max-width:90%;max-height:90%;border-radius:8px"></div>`;
      } else {
        const initials = data.namaCustomer.split(" ").map(n=>n[0].toUpperCase()).join("").slice(0,2);
        popup.innerHTML = `<div style="font-size:50px;color:#fff;background:#b3874f;padding:40px 60px;border-radius:16px">${initials}</div>`;
      }

      document.body.appendChild(popup);
      popup.addEventListener("click", ()=>popup.remove());
    });

    // === Klik card → popup read-only dataHarian terakhir ===
    card.addEventListener("click", async ()=>{
    
      let doc;
    
      try{
    
        // ================================
        // 1. AMBIL DARI CACHE DULU
        // ================================
        if(window.cacheLastDataHarian[cust.id]){
          doc = window.cacheLastDataHarian[cust.id];
        }
    
        // ================================
        // 2. KALAU BELUM ADA → FETCH SEKALI
        // ================================
        if(!doc){
          const snapshot = await db.collection(cust.custId).doc(cust.id)
            .collection("dataHarian")
            .orderBy("createdAt","desc")
            .limit(1)
            .get();
    
          if(!snapshot.empty){
            doc = snapshot.docs[0].data();
            window.cacheLastDataHarian[cust.id] = doc;
          }
        }
    
        // ================================
        // 3. PASANG LISTENER REALTIME (🔥)
        // ================================
        if(!window.cacheListenerDataHarian[cust.id]){
    
          window.cacheListenerDataHarian[cust.id] = db.collection(cust.custId)
            .doc(cust.id)
            .collection("dataHarian")
            .orderBy("createdAt","desc")
            .limit(1)
            .onSnapshot(snapshot=>{
    
              if(!snapshot.empty){
                const newDoc = snapshot.docs[0].data();
    
                // 🔥 UPDATE CACHE OTOMATIS
                window.cacheLastDataHarian[cust.id] = newDoc;
    
                console.log("Auto update cache:", cust.id);
              }
    
            });
        }
    
      } catch(err){
        console.error(err);
      }
    
      // ================================
      // 4. RENDER POPUP
      // ================================
      let contentHTML = `<div style="color:#333;">Belum ada data</div>`;
    
      if(doc){
        const tanggal = doc.createdAt?.toDate().toLocaleDateString('id-ID',{
          weekday:'long', day:'numeric', month:'long'
        }) || "-";
    
         contentHTML = `
            <div class="last-data">
              <div class="customer-stock">
                <span class="stock-chip stock-cb">CB ${doc.lastData?.CB || 0}</span>
                <span class="stock-chip stock-bb">BB ${doc.lastData?.BB || 0}</span>
                <span class="stock-chip stock-bk">BK ${doc.lastData?.BK || 0}</span>
              </div>
              <div class="created-at">${tanggal}</div>
            </div>
        
            <div class="jumlah-pembayaran">
              <label>Jumlah Pembayaran</label>
              <input type="text" readonly value="${doc.lastData?.bayar ?? ((doc.fee?.CB||0)+(doc.fee?.BB||0)+(doc.fee?.BK||0))}">
            </div>
        
            ${['return','expired','konsinyasi','cash','tunggakan'].map(k=>{
              return `
                <div class="input-group ${k}">
                  <label>${k.charAt(0).toUpperCase()+k.slice(1)}</label>
                  <div class="input-row">
                    <input type="text" readonly value="${doc[k]?.CB ? doc[k].CB : ''}">
                    <input type="text" readonly value="${doc[k]?.BB ? doc[k].BB : ''}">
                    <input type="text" readonly value="${doc[k]?.BK ? doc[k].BK : ''}">
                  </div>
                </div>
              `;
            }).join('')}
        
            <div class="status-container">
              ${
                doc.keterangan === "putus" ? `<div class="status-badge status-putus">🔴 Putus</div>` :
                doc.keterangan === "pending" ? `<div class="status-badge status-pending">🟡 Pending</div>` :
                doc.keterangan === "tutup" ? `<div class="status-badge status-tutup">⚫ Tutup</div>` :
                `<div class="status-badge status-normal">🟢 Normal</div>`
              }
            </div>
        
            ${
              doc.fotoKeterangan && doc.fotoKeterangan !== "null"
              ? `<div class="btn-foto-container"><img class="foto-preview" src="${doc.fotoKeterangan}"></div>`
              : ''
            }
          `;
      }
    
      const popup = document.createElement("div");
      popup.className="customer-view-popup";
    
      popup.innerHTML = `
        <div style="display:flex;flex-direction:column;gap:12px;align-items:center;">
          <h1>${data.namaCustomer}</h1>
          ${contentHTML}
        </div>
      `;
    
      document.body.appendChild(popup);
      requestAnimationFrame(() => popup.classList.add("show"));
      popup.addEventListener("click", ()=>popup.remove());
    
    });
    container.appendChild(card);
  });
}
function getHariIndonesia(date = new Date()) {
  return date.toLocaleDateString('id-ID', { weekday:'long' });
}
// ======= UTILS =======
function compressImage(file, maxWidth = 800, maxHeight = 800, quality = 0.7) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = function(event) {
      const img = new Image();
      img.onload = function() {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        const scale = Math.min(maxWidth / img.width, maxHeight / img.height, 1);
        canvas.width = img.width * scale;
        canvas.height = img.height * scale;

        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = reject;
      img.src = event.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// ======= POPUP TAMBAH CUSTOMER UNTUK MARKETING =======
async function openNewCustomerPopup() {
  const overlay = document.createElement("div");
  overlay.className = "customer-input-popup new-customer-popup";

  const uniqueId = Date.now();

  overlay.innerHTML = `
    <div>
      <h1>Tambah Customer</h1>

      <div class="input-group">
        <label>Nama Customer</label>
        <input type="text" id="inputNamaCustomer-${uniqueId}" placeholder="Masukkan nama customer">
      </div>

      <div class="input-group">
        <label>Stok Awal</label>
        <div class="input-row">
          <input type="number" id="inputCB-${uniqueId}" placeholder="CB">
          <input type="number" id="inputBB-${uniqueId}" placeholder="BB">
          <input type="number" id="inputBK-${uniqueId}" placeholder="BK">
        </div>
      </div>

      <div class="input-group">
        <label>Jenis Pembayaran</label>
        <div class="radio-group">
          <label><input type="radio" name="jenisBayar-${uniqueId}" value="konsinyasi" checked> Konsinyasi</label>
          <label><input type="radio" name="jenisBayar-${uniqueId}" value="cash"> Cash</label>
        </div>
      </div>

      <div class="input-group">
        <label>Alamat</label>
        <textarea id="inputAlamat-${uniqueId}" placeholder="Masukkan alamat customer"></textarea>
      </div>

      <div class="input-group">
        <button type="button" class="location-btn">📍 Ambil Lokasi</button>
      </div>

      <div class="input-group foto-group">
        <div id="fotoBtn-${uniqueId}" class="btn-foto">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="size-6">
            <path d="M12 9a3.75 3.75 0 1 0 0 7.5A3.75 3.75 0 0 0 12 9Z" />
            <path fill-rule="evenodd" d="M9.344 3.071a49.52 49.52 0 0 1 5.312 0c.967.052 1.83.585 2.332 1.39l.821 1.317c.24.383.645.643 1.11.71.386.054.77.113 1.152.177 1.432.239 2.429 1.493 2.429 2.909V18a3 3 0 0 1-3 3h-15a3 3 0 0 1-3-3V9.574c0-1.416.997-2.67 2.429-2.909.382-.064.766-.123 1.151-.178a1.56 1.56 0 0 0 1.11-.71l.822-1.315a2.942 2.942 0 0 1 2.332-1.39ZM6.75 12.75a5.25 5.25 0 1 1 10.5 0 5.25 5.25 0 0 1-10.5 0Zm12-1.5a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Z" clip-rule="evenodd" />
          </svg>
        </div>
        <input type="file" id="inputFoto-${uniqueId}" accept="image/*" capture="environment" style="display:none;">
      </div>

      <button id="btnSimpanCustomer-${uniqueId}">Simpan</button>
    </div>
  `;

  document.body.appendChild(overlay);

  const inputFoto = document.getElementById(`inputFoto-${uniqueId}`);
  const fotoBtn = document.getElementById(`fotoBtn-${uniqueId}`);
  fotoBtn.addEventListener("click", () => inputFoto.click());
  inputFoto.addEventListener("change", e => {
    const file = e.target.files[0];
    if(file){
      const reader = new FileReader();
      reader.onload = ev => fotoBtn.innerHTML = `<img class="foto-preview" src="${ev.target.result}" />`;
      reader.readAsDataURL(file);
    }
  });

   // ===== AMBIL LOKASI =====
  const lokasiBtn = overlay.querySelector(".location-btn");
  lokasiBtn.addEventListener("click", async () => {
    const mapOverlay = document.createElement("div");
    mapOverlay.className = "map-popup-overlay";
  
    // ✅ pakai container lama biar UI aman
    mapOverlay.innerHTML = `
      <div class="map-popup-container">
        <div id="map-${uniqueId}" style="width:100%;height:80vh;"></div>
        <button class="confirm-location-btn">✅ Konfirmasi Lokasi</button>
      </div>
    `;
  
    document.body.appendChild(mapOverlay);
  
    let lat = overlay.dataset.lat || -6.338;
    let lng = overlay.dataset.lng || 106.821;
  
    if(navigator.geolocation){
      navigator.geolocation.getCurrentPosition(pos=>{
        lat = pos.coords.latitude;
        lng = pos.coords.longitude;
        map.setView([lat, lng], 16);
        marker.setLatLng([lat,lng]);
      });
    }
  
    const map = L.map(`map-${uniqueId}`).setView([lat, lng], 16);
  
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{
      maxZoom:19
    }).addTo(map);
  
    const marker = L.marker([lat, lng], {draggable:true}).addTo(map);
  
    marker.on('dragend', e=>{
      const pos = e.target.getLatLng();
      lat = pos.lat;
      lng = pos.lng;
    });
  
    mapOverlay.querySelector(".confirm-location-btn").addEventListener("click", ()=>{
      overlay.dataset.lat = lat;
      overlay.dataset.lng = lng;
  
      lokasiBtn.textContent = "Berhasil";
      lokasiBtn.classList.add("success");
  
      setTimeout(()=>{
        lokasiBtn.classList.remove("success");
        lokasiBtn.textContent = "Ambil Lokasi";
      },1000);
  
      mapOverlay.remove();
    });
  
    // ✅ penting (ini juga bikin UX enak)
    mapOverlay.addEventListener("click", e=>{
      if(e.target === mapOverlay) mapOverlay.remove();
    });
  });

  // ===== SIMPAN =====
  const btnSimpan = document.getElementById(`btnSimpanCustomer-${uniqueId}`);
  btnSimpan.addEventListener("click", async () => {
    btnSimpan.dataset.loading = "true";
    btnSimpan.textContent = "Menyimpan...";
    btnSimpan.style.background = "#f0ad4e";

    try {
      const uid = window.currentUser?.uid;
      if(!uid) throw new Error("User belum login");

      const userDoc = await db.collection("marketing").doc(uid).get();
      if(!userDoc.exists) throw new Error("Data user tidak ditemukan");

      const userData = userDoc.data();
      const custCollection = userData?.custId;
      if(!custCollection) throw new Error("User belum punya custId, hubungi admin");
      const kantorCabang = userData?.kantorCabang || null;

      const nama = document.getElementById(`inputNamaCustomer-${uniqueId}`).value.trim();
      const cb = Number(document.getElementById(`inputCB-${uniqueId}`).value || 0);
      const bb = Number(document.getElementById(`inputBB-${uniqueId}`).value || 0);
      const bk = Number(document.getElementById(`inputBK-${uniqueId}`).value || 0);
      const alamat = document.getElementById(`inputAlamat-${uniqueId}`).value.trim();
      const jenisBayar = overlay.querySelector(`input[name="jenisBayar-${uniqueId}"]:checked`).value;
      const lat = overlay.dataset.lat;
      const lng = overlay.dataset.lng;
      const fotoFile = inputFoto.files[0];

      if(!nama) throw new Error("Nama customer harus diisi");
      if(cb+bb+bk === 0) throw new Error("Stok minimal satu harus diisi");
      if(!alamat) throw new Error("Alamat harus diisi");
      if(!lat || !lng) throw new Error("Lokasi harus diambil");
      if(!fotoFile) throw new Error("Foto customer harus diunggah");

      const fotoBase64 = await compressImage(fotoFile);

      const harga = { CB:5000, BB:5000, BK:4000 };
      const bayar = cb*harga.CB + bb*harga.BB + bk*harga.BK;
      const lastData = { CB: cb, BB: bb, BK: bk, bayar, createdAt: firebase.firestore.Timestamp.now() };

      // ===== ROOT DATA =====
      const rootData = {
        namaCustomer: nama,
        alamatCustomer: alamat,
        lokasiCustomer: new firebase.firestore.GeoPoint(lat, lng),
        fotoURL: fotoBase64,
        createdAt: firebase.firestore.Timestamp.now(),
        createdBy: uid,
        hari: getHariIndonesia(),
        kantorCabang,
        pemilik: uid,
        custId: custCollection,
        lastData,
        isNew: true,
        status: "aktif"
      };

      // Tambah document
      const docRef = await db.collection(custCollection).add(rootData);

      const today = new Date().toISOString().split("T")[0];
      await docRef.collection("dataHarian").doc(today).set({
        createdAt: firebase.firestore.Timestamp.now(),
        cash: jenisBayar==="cash"?{CB:cb,BB:bb,BK:bk}:{CB:0,BB:0,BK:0},
        konsinyasi: jenisBayar==="konsinyasi"?{CB:cb,BB:bb,BK:bk}:{CB:0,BB:0,BK:0},
        expired:{CB:0,BB:0,BK:0},
        keterangan:"null",
        fotoKeterangan:"null",
        lastData,
        custId: custCollection
      });

      btnSimpan.textContent = "Berhasil";
      btnSimpan.style.background = "#4CAF50";
      setTimeout(()=>overlay.remove(),800);

    } catch(err) {
      console.error(err);
      btnSimpan.textContent = `Gagal: ${err.message}`;
      btnSimpan.style.background = "#d9534f";
      setTimeout(()=>{
        btnSimpan.textContent = "Simpan";
        btnSimpan.style.background = "#b3874f";
      },2000);
    } finally {
      delete btnSimpan.dataset.loading;
    }
  });

  overlay.addEventListener("click", e => {
    if(e.target === overlay) overlay.remove();
  });
}

// ====== PASANG EVENT UNTUK TOMBOL ======
document.querySelector(".icon-btn-add").addEventListener("click", e=>{
  e.stopPropagation();
  openNewCustomerPopup();
});