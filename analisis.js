// ===== CACHE KEY =====
function getAnalisisCacheKey(uid){
  return "analisisCache_" + uid;
}
function saveAnalisisCache(uid, data){
  localStorage.setItem(getAnalisisCacheKey(uid), JSON.stringify({
    data,
    lastUpdated: Date.now()
  }));
}
function getAnalisisCache(uid){
  const cache = localStorage.getItem(getAnalisisCacheKey(uid));
  return cache ? JSON.parse(cache) : null;
}

// ===== RENDER ANALISIS SUPER CEPAT (DENGAN TANGGAL TERAKHIR VALID) =====
window.renderAnalisis = async function(){
  console.log("🎯 Render Analisis PRO Malam");

  const container = document.getElementById("analisisContent");
  if(!container) return;

  container.innerHTML = `<p style="text-align:center;">Loading...</p>`;

  try{
    const uid = window.currentUser?.uid;
    if(!uid) throw new Error("User belum login");

    // =========================
    // 1. LOAD CACHE DULU ⚡
    // =========================
    const cache = getAnalisisCache(uid);
    if(cache && cache.data){
      console.log("⚡ Load analisis dari cache");
      renderAnalisisUI(cache.data);
    }

    // =========================
    // 2. AMBIL DATA CUSTOMER SEKALI 🔥
    // =========================
    const userDoc = await db.collection("marketing").doc(uid).get();
    const custId = userDoc.data().custId;
    if(!custId) throw new Error("custId tidak ditemukan");

    const customerSnap = await db.collection(custId)
      .where("pemilik","==", uid)
      .get();

    const hariList = ["Senin","Selasa","Rabu","Kamis","Jumat","Sabtu","Minggu"];
    const countPerHari = {
      Senin:0, Selasa:0, Rabu:0, Kamis:0, Jumat:0, Sabtu:0, Minggu:0
    };
    const hijau = [];
    const kuning = [];
    const merah = [];

    const today = new Date();
    today.setHours(0,0,0,0); // reset ke jam 00:00 hari ini

    // ===== LOOP CUSTOMER =====
    for(const doc of customerSnap.docs){
      const data = doc.data();
      if(data.status === "nonAktif") continue;

      // Hitung customer per hari
      if(countPerHari[data.hari] !== undefined){
        countPerHari[data.hari]++;
      }

      // ===== AMBIL DATA TERAKHIR SEBELUM HARI INI =====
      const snapHarian = await db.collection(custId)
        .doc(doc.id)
        .collection("dataHarian")
        .orderBy("createdAt","desc")
        .get();

      let lastData = null;
      let lastDate = "-";

      snapHarian.forEach(d => {
        if(lastData) return; // ambil data pertama yang valid
        const tgl = d.data().createdAt?.toDate();
        if(tgl && tgl < today){
          lastData = d.data();
          lastDate = tgl.toLocaleDateString();
        }
      });

      // jika tidak ada data sebelum hari ini, gunakan data analisis terakhir (cache)
      const expired = lastData?.expired || (data.analisis?.expired || {});
      const ret     = lastData?.return  || (data.analisis?.return  || {});

      const totalExpired = (expired.CB||0)+(expired.BB||0)+(expired.BK||0);
      const totalReturn  = (ret.CB||0)+(ret.BB||0)+(ret.BK||0);

      const item = { namaCustomer: data.namaCustomer, expired, return: ret, lastUpdated: lastDate };

      if(totalExpired > 2 || totalReturn > 3){
        merah.push(item);
      } else if((totalExpired > 0 && totalExpired <= 2) || (totalReturn > 1 && totalReturn <= 2)){
        kuning.push(item);
      } else {
        hijau.push(item);
      }
    }

    const result = { countPerHari, hijau, kuning, merah };

    // =========================
    // SIMPAN CACHE & RENDER UI
    // =========================
    if(JSON.stringify(result) !== JSON.stringify(window.lastAnalisisData)){
      window.lastAnalisisData = result;
      saveAnalisisCache(uid, result);
      renderAnalisisUI(result);
    } else {
      console.log("✅ Analisis sama, skip render");
    }

  } catch(err){
    console.error(err);
    container.innerHTML = `<p style="color:red;text-align:center;">Gagal load data</p>`;
  }
};

// ===== RENDER UI TERPISAH (TAMBAH TANGGAL TERAKHIR) =====
function renderAnalisisUI(data){
  const container = document.getElementById("analisisContent");
  const hariList = ["Senin","Selasa","Rabu","Kamis","Jumat","Sabtu","Minggu"];
  function getClass(jumlah){
    if(jumlah < 50) return "danger";
    if(jumlah < 60) return "warning";
    return "normal";
  }

  container.innerHTML = `
    <div class="card-analisis">
      <div class="card-title">Jumlah Customer</div>
      ${hariList.map(hari=>{
        const jumlah = data.countPerHari[hari];
        const kelas = getClass(jumlah);
        return `<div class="row-analisis ${kelas}"><span>${hari}</span><span>${jumlah} Customer</span></div>`;
      }).join("")}
    </div>

    <div class="trikotomi-wrapper">
      <div class="trikotomi-title">ANALISIS TRIKOTOMI</div>
      <div class="trikotomi-scroll">
        ${["hijau","kuning","merah"].map((warna,i)=>{
          const arr = [data.hijau, data.kuning, data.merah][i];
          return `<div class="trikotomi-card ${warna}">
            <div class="trikotomi-list">
              ${arr.map(c=>`
                <div class="trikotomi-item"
                  data-expired='${JSON.stringify(c.expired)}'
                  data-return='${JSON.stringify(c.return)}'
                  data-tgl='${c.lastUpdated}'>
                  ${c.namaCustomer}
                </div>
              `).join("")}
            </div>
          </div>`;
        }).join("")}
      </div>
    </div>
  `;

  // ===== EVENT CLICK =====
  document.querySelectorAll(".trikotomi-item").forEach(item=>{
    item.addEventListener("click", e=>{
      e.stopPropagation();
      const expired = JSON.parse(item.dataset.expired || "{}");
      const ret = JSON.parse(item.dataset.return || "{}");
      const lastUpdated = item.dataset.tgl || "-";

      const popup = document.createElement("div");
      popup.className = "customer-view-popup";
      popup.innerHTML = `
        <div style="display:flex;flex-direction:column;gap:12px;text-align:center;">
          <h2 style="color:#b3874f;">TRACK TERAKHIR</h2>
          <div style="font-size:0.9rem;color:#555;">Tanggal: ${lastUpdated}</div>
          <div style="background:#fdecea;padding:10px;border-radius:12px;">
            <b>Expired</b>
            <div>CB: ${expired.CB||0}</div>
            <div>BB: ${expired.BB||0}</div>
            <div>BK: ${expired.BK||0}</div>
          </div>
          <div style="background:#fff3cd;padding:10px;border-radius:12px;">
            <b>Return</b>
            <div>CB: ${ret.CB||0}</div>
            <div>BB: ${ret.BB||0}</div>
            <div>BK: ${ret.BK||0}</div>
          </div>
        </div>
      `;
      document.body.appendChild(popup);
      popup.addEventListener("click", ()=>popup.remove());
    });
  });
}