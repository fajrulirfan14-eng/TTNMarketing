let filterHariCatatan = null;

// ====== INIT HOME VIEW & GET CUSTID===== //
window.initHomeView = async function() {
  if(window.homeInitialized) return;
  window.homeInitialized = true;

  console.log("🏠 Home view inisialisasi");

  getCustId(); // ✅ sekarang valid

  loadMarketing();
  loadCustomerCatatanHariIni();

  const btnInput = document.getElementById("btnInputMarketing");
  if(btnInput && !btnInput.dataset.listener){
    btnInput.dataset.listener = "true";
    btnInput.addEventListener("click", ()=>{
      showView("input");
      window.selectedDay = new Date().getDay();
    });
  }

  initFilterHari();
};
async function getCustId(){
  if(window.custIdGlobal) return window.custIdGlobal;

  const uid = window.currentUser?.uid;
  if(!uid) throw new Error("User belum login");

  const userDoc = await db.collection("marketing").doc(uid).get();
  if(!userDoc.exists) throw new Error("User tidak ditemukan");

  const custId = userDoc.data().custId;
  if(!custId) throw new Error("custId tidak ada");

  window.custIdGlobal = custId; // 🔥 simpan cache
  return custId;
}
// ====== INIT POPUP FILTER ===== //
function initFilterHari() {
  const btn = document.getElementById("btnFilterHari");
  const popup = document.getElementById("popupFilterHari");
  if (!btn || !popup) return;

  if (btn.dataset.listener) return;
  btn.dataset.listener = "true";

  btn.addEventListener("click", e => {
    e.stopPropagation();
    popup.classList.toggle("show");
  });

  popup.querySelectorAll("div").forEach(item => {
    item.addEventListener("click", () => {
      filterHariCatatan = item.dataset.hari;
      popup.classList.remove("show");
      loadCustomerCatatanHariIni(); // aman karena listener lama dimatikan
    });
  });

  document.addEventListener("click", e => {
    if (!popup.contains(e.target) && !btn.contains(e.target)) {
      popup.classList.remove("show");
    }
  });
}

// ====== RENDER HOME VIEW ===== //
window.renderHome = function(){
  console.log("🏠 Home view render ulang");
  // ❌ tidak perlu reload data (sudah realtime)
};

// ====== LOAD DATA MARKETING ===== //
async function loadMarketing() {
  if(window.marketingLoaded) return;
  window.marketingLoaded = true;

  const container = document.getElementById("marketingList");
  if(!container) return;

  try {
    const uid = window.currentUser?.uid;
    if(!uid) return;

    const doc = await db.collection("marketing").doc(uid).get();

    if(!doc.exists){
      container.innerHTML = "<p>Data tidak ditemukan</p>";
      return;
    }

    const data = doc.data();
    const card = container.querySelector(".marketing-card");

    if(card){
      const fotoEl = card.querySelector(".avatar");

      if(data.fotoURL){
        fotoEl.innerHTML = `<img src="${data.fotoURL}" alt="${data.nama || "-"}">`;
        fotoEl.classList.add("has-photo");
      } else if(data.nama){
        const inisial = data.nama.split(" ").map(w => w[0].toUpperCase()).join("");
        fotoEl.innerHTML = `<div class="avatar-inisial">${inisial}</div>`;
        fotoEl.classList.remove("has-photo");
      } else {
        fotoEl.innerHTML = `<div class="avatar-inisial">-</div>`;
        fotoEl.classList.remove("has-photo");
      }

      card.querySelector(".nama").textContent = data.nama || "-";
      card.querySelector(".motivasi").textContent = data.motivasi || "-";

      card.querySelector(".kantor").innerHTML = `
        <svg class="kantor-icon" viewBox="0 0 24 24">
          <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13
          c0-3.87-3.13-7-7-7zm0 9.5
          c-1.38 0-2.5-1.12-2.5-2.5
          S10.62 6.5 12 6.5
          14.5 7.62 14.5 9
          13.38 11.5 12 11.5z"/>
        </svg>
        Kantor Cabang: ${data.kantorCabang || "-"}
      `;

      function updateTime(){
        const now = new Date();

        const hariNama = ["Minggu","Senin","Selasa","Rabu","Kamis","Jumat","Sabtu"];
        const bulanNama = ["Januari","Februari","Maret","April","Mei","Juni","Juli","Agustus","September","Oktober","November","Desember"];

        card.querySelector(".tanggal-waktu .tanggal").textContent =
          `${hariNama[now.getDay()]}, ${now.getDate()} ${bulanNama[now.getMonth()]} ${now.getFullYear()}`;

        card.querySelector(".tanggal-waktu .waktu").textContent =
          now.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
      }

      updateTime();

      if(!window.homeClock){
        window.homeClock = setInterval(updateTime, 60000);
      }
    }

    // ===== REALTIME NOTIF ===== //
    const noteCard = document.getElementById("noteCard");

    if(noteCard && !window.notifListener){
      window.notifListener = db.collection("notifikasi").limit(1)
        .onSnapshot(snapshot=>{
          let infoText = "Tidak ada informasi hari ini";
          let infoDate = "";

          if(!snapshot.empty){
            const notifData = snapshot.docs[0].data();
            const informasiKurir = notifData?.informasiKurir || {};
            const cabangUser = data.kantorCabang;

            if(cabangUser && informasiKurir[cabangUser]){
              const info = informasiKurir[cabangUser];
              infoText = info.teks || infoText;

              if(info.createdAt){
                infoDate = info.createdAt.toDate()
                  .toLocaleDateString("id-ID",{day:"numeric", month:"short", year:"numeric"});
              }
            }
          }

          noteCard.querySelector(".note-text").textContent = infoText;

          const noteDate = document.getElementById("noteDate");
          if(noteDate) noteDate.textContent = infoDate;

          noteCard.classList.add("note-highlight");
          setTimeout(()=>noteCard.classList.remove("note-highlight"),2000);
        });
    }

  } catch(err){
    console.error("Error load marketing:", err);
    container.innerHTML = "<p>Gagal load data</p>";
  }
}

// ====== LOAD CUSTOMER CATATAN ===== //
async function loadCustomerCatatanHariIni(){
  const listEl = document.getElementById("customerNoteList");
  if(!listEl) return;

  const uid = window.currentUser?.uid;
  if(!uid) return;

  listEl.innerHTML = "Loading...";

  try{

    // ✅ pakai cache custId
    const custId = await getCustId();

    const hariNama = ["Minggu","Senin","Selasa","Rabu","Kamis","Jumat","Sabtu"];
    const hariIni = hariNama[new Date().getDay()];
    const hariFilter = filterHariCatatan ?? hariIni;

    // ❌ matikan listener lama
    if(window.customerNoteListener){
      window.customerNoteListener();
      window.customerNoteListener = null;
    }

    let query = db.collection(custId)
      .where("pemilik","==",uid);

    if(hariFilter !== "semua"){
      query = query.where("hari","==",hariFilter);
    }

    window.customerNoteListener = query.onSnapshot(snapshot => {

      let html = "";

      snapshot.forEach(doc=>{
        const data = doc.data();
        const catatan = (data.catatan || "").trim();

        if(catatan){
          html += `
            <div class="customer-note-item">
              <div class="customer-note-nama">${data.namaCustomer || "-"}</div>
              <div class="customer-note-text">${catatan}</div>
            </div>
          `;
        }
      });

      if(!html){
        html = `<div class="customer-note-empty">Tidak ada catatan</div>`;
      }

      listEl.innerHTML = html;

    }, err => {
      console.error("Realtime error:", err);
      listEl.innerHTML = "Gagal memuat data";
    });

  } catch(err){
    console.error(err);
    listEl.innerHTML = err.message || "Error sistem";
  }
}