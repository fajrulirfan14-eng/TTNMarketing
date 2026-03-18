async function initProfilView() {
  const uid = window.currentUser?.uid;
  if (!uid) return;

  const headerEl = document.getElementById("profilHeader");
  const namaEl = document.getElementById("profilNama");
  const emailEl = document.getElementById("profilEmail");
  const roleEl = document.getElementById("profilRole");
  const kantorEl = document.getElementById("profilKantor");

  try {
    db.collection("marketing").doc(uid)
    .onSnapshot(doc => {

      if (!doc.exists) {
        headerEl.style.background = "#b3874f";
        namaEl.textContent = "-";
        emailEl.textContent = "-";
        roleEl.textContent = "-";
        kantorEl.textContent = "-";
        return;
      }

      const data = doc.data();
      const fotoURL = data.fotoURL || "";

      // header foto
      if (fotoURL) {
        headerEl.style.backgroundImage = `url('${fotoURL}')`;
      } else {
        headerEl.style.background = "linear-gradient(135deg, #b3874f, #d9b382)";
      }

      // isi card
      namaEl.textContent = data.nama || "-";
      emailEl.textContent = data.email || "-";
      roleEl.textContent = data.role || "-";
      kantorEl.textContent = data.kantorCabang || "-";

    });

  } catch (err) {
    console.error("Gagal load profil:", err);
  }

  initLogout();
}

// ===== POPUP GANTI PROFIL ===== //
function setupGantiFoto() {
  const btn = document.getElementById("btnGantiFoto");
  if (!btn) return;

  if (btn.dataset.listener) return;
  btn.dataset.listener = "true";

  const popup = document.createElement("div");
  popup.className = "popup-ganti-foto";
  popup.innerHTML = `
    <div>Ganti foto profil Anda</div>
    <p><small>Foto profil akan terlihat oleh user lain</small></p>
    <button class="btn-ok">Oke</button>
    <button class="btn-cancel">Batal</button>
  `;
  document.body.appendChild(popup);

  const btnOk = popup.querySelector(".btn-ok");
  const btnCancel = popup.querySelector(".btn-cancel");

  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    popup.classList.add("show");
  });

  btnCancel.addEventListener("click", (e) => {
    e.stopPropagation();
    popup.classList.remove("show");
  });

  btnOk.addEventListener("click", async (e) => {
    e.stopPropagation();
    popup.classList.remove("show");

    const inputFile = document.createElement("input");
    inputFile.type = "file";
    inputFile.accept = "image/*";
    inputFile.click();

    inputFile.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = async function (event) {
        const base64 = event.target.result;

        try {
          const uid = window.currentUser.uid;
          await db.collection("marketing").doc(uid).update({ fotoURL: base64 });

          const headerEl = document.getElementById("profilHeader");
          headerEl.style.backgroundImage = `url('${base64}')`;

          showAlert("Foto profil berhasil diperbarui", "success");
        } catch (err) {
          console.error(err);
          showAlert("Gagal mengupdate foto", "error");
        }
      };
      reader.readAsDataURL(file);
    };
  });

  document.addEventListener("click", (e) => {
    if (!popup.contains(e.target) && e.target !== btn) {
      popup.classList.remove("show");
    }
  });
}

// panggil saat init profil
initProfilView().then(setupGantiFoto);

function initLogout(){

  const btnLogout = document.getElementById("btnLogout");
  const popup = document.getElementById("popupLogout");
  const cancel = document.getElementById("cancelLogout");
  const confirm = document.getElementById("confirmLogout");

  if(!btnLogout) return;

  // buka popup
  btnLogout.onclick = () => {
    popup.classList.add("show");
  };

  // batal
  cancel.onclick = () => {
    popup.classList.remove("show");
  };

  // klik luar popup
  popup.onclick = (e)=>{
    if(e.target === popup){
      popup.classList.remove("show");
    }
  };

  // logout
  confirm.onclick = async () => {
    try{
      await firebase.auth().signOut();
      window.location.href = "login.html";
    }catch(err){
      console.error("Logout gagal:", err);
    }
  };

}