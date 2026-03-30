const loginView = document.getElementById("loginView");
const dashboardView = document.getElementById("dashboardView");
const inboxPage = document.getElementById("inboxPage");
const detailPage = document.getElementById("detailPage");

const loginForm = document.getElementById("loginForm");
const addAccountForm = document.getElementById("addAccountForm");

const loginMsg = document.getElementById("loginMsg");
const accountMsg = document.getElementById("accountMsg");

const userEmail = document.getElementById("userEmail");
const emailList = document.getElementById("emailList");
const accountList = document.getElementById("accountList");

const detailSubject = document.getElementById("detailSubject");
const detailFrom = document.getElementById("detailFrom");
const detailDate = document.getElementById("detailDate");
const detailAccount = document.getElementById("detailAccount");
const detailBody = document.getElementById("detailBody");

const syncBtn = document.getElementById("syncBtn");
const logoutBtn = document.getElementById("logoutBtn");
const backBtn = document.getElementById("backBtn");
const inboxCount = document.getElementById("inboxCount");
const syncStatus = document.getElementById("syncStatus");
const detailSyncStatus = document.getElementById("detailSyncStatus");
const toggleAddAccountBtn = document.getElementById("toggleAddAccountBtn");

let emails = [];
let accounts = [];
let syncTimer = null;
let selectedEmailId = null;
let selectedAccountEmail = null;

function getAccounts() {
  try {
    return JSON.parse(localStorage.getItem("impura_accounts") || "[]");
  } catch {
    return [];
  }
}

function saveAccounts(newAccounts) {
  localStorage.setItem("impura_accounts", JSON.stringify(newAccounts));
}

function clearAccounts() {
  localStorage.removeItem("impura_accounts");
  localStorage.removeItem("impura_selected_account_email");
}

function setSelectedAccountEmail(email) {
  selectedAccountEmail = email || null;
  if (selectedAccountEmail) {
    localStorage.setItem("impura_selected_account_email", selectedAccountEmail);
  } else {
    localStorage.removeItem("impura_selected_account_email");
  }
}

function getStoredSelectedAccountEmail() {
  return localStorage.getItem("impura_selected_account_email");
}

function showLogin() {
  stopAutoSync();
  loginView.classList.remove("hidden");
  dashboardView.classList.add("hidden");
}

function showDashboard() {
  loginView.classList.add("hidden");
  dashboardView.classList.remove("hidden");
}

function setSyncText(text) {
  syncStatus.textContent = text;
  detailSyncStatus.textContent = text;
}

function formatDate(v) {
  if (!v) return "-";
  try {
    return new Date(v).toLocaleString("id-ID");
  } catch {
    return v;
  }
}

function shortDate(v) {
  if (!v) return "-";
  try {
    const d = new Date(v);
    return d.toLocaleDateString("id-ID", { day: "2-digit", month: "short" }) + " " +
      d.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
  } catch {
    return v;
  }
}

function buildSnippet(text) {
  return (text || "").replace(/\s+/g, " ").trim().slice(0, 120);
}

function cleanBody(text) {
  return (text || "(Isi email kosong)")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n +/g, "\n")
    .trim();
}

function showInboxPage() {
  inboxPage.classList.remove("hidden");
  detailPage.classList.add("hidden");
}

function renderAccounts() {
  accountList.innerHTML = "";

  if (!accounts.length) {
    accountList.innerHTML = '<div class="empty-list">Belum ada akun email.</div>';
    return;
  }

  const allChip = document.createElement("div");
  allChip.className = "account-chip" + (!selectedAccountEmail ? " active" : "");
  allChip.innerHTML = '<div class="email">Semua akun</div>';
  allChip.onclick = async () => {
    setSelectedAccountEmail(null);
    renderAccounts();
    renderEmailList();
    showInboxPage();
  };
  accountList.appendChild(allChip);

  accounts.forEach((acc) => {
    const chip = document.createElement("div");
    chip.className =
      "account-chip" + (selectedAccountEmail === acc.email ? " active" : "");

    chip.innerHTML = `
      <div class="email">${acc.email}</div>
      <button class="remove" type="button">hapus</button>
    `;

    chip.onclick = async (e) => {
      if (e.target.classList.contains("remove")) return;
      setSelectedAccountEmail(acc.email);
      renderAccounts();
      renderEmailList();
      showInboxPage();
    };

    chip.querySelector(".remove").onclick = async (e) => {
      e.stopPropagation();

      const next = accounts.filter((x) => x.email !== acc.email);
      accounts = next;
      saveAccounts(next);

      if (selectedAccountEmail === acc.email) {
        setSelectedAccountEmail(null);
      }

      accountMsg.textContent = "Akun dihapus.";
      renderAccounts();
      renderEmailList();

      if (!accounts.length) {
        clearAccounts();
        showLogin();
        loginMsg.textContent = "";
      }
    };

    accountList.appendChild(chip);
  });
}

function getVisibleEmails() {
  if (!selectedAccountEmail) return emails;
  return emails.filter((x) => x.account_email === selectedAccountEmail);
}

function showDetailPage(item) {
  selectedEmailId = item.id;
  inboxPage.classList.add("hidden");
  detailPage.classList.remove("hidden");

  detailSubject.textContent = item.subject || "(Tanpa subject)";
  detailFrom.textContent = item.from_name
    ? `${item.from_name} <${item.from_email || "-"}>`
    : (item.from_email || "-");
  detailDate.textContent = formatDate(item.received_at);
  detailAccount.textContent = item.account_email || "-";
  detailBody.textContent = cleanBody(item.body_text);
}

function renderEmailList() {
  emailList.innerHTML = "";

  const visibleEmails = getVisibleEmails();
  inboxCount.textContent = `${visibleEmails.length} email`;

  if (!visibleEmails.length) {
    emailList.innerHTML = '<div class="empty-list">Belum ada email di server kamu.</div>';
    showInboxPage();
    return;
  }

  visibleEmails.forEach((item) => {
    const row = document.createElement("div");
    row.className = "gmail-row" + (item.id === selectedEmailId ? " active" : "");

    row.innerHTML = `
      <div class="sender">${item.from_name || item.from_email || "(Unknown sender)"}</div>
      <div class="subject-line">
        <span class="subject">${item.subject || "(Tanpa subject)"}</span>
        <span class="snippet">${buildSnippet(item.body_text)} • ${item.account_email}</span>
      </div>
      <div class="mail-date">${shortDate(item.received_at)}</div>
    `;

    row.onclick = () => {
      document.querySelectorAll(".gmail-row").forEach((x) => x.classList.remove("active"));
      row.classList.add("active");
      showDetailPage(item);
      history.replaceState({}, "", "#mail-" + encodeURIComponent(item.id));
    };

    emailList.appendChild(row);
  });

  if (!selectedEmailId && visibleEmails[0]) {
    selectedEmailId = visibleEmails[0].id;
  }
}

async function syncAll(showLoading = true) {
  if (!accounts.length) {
    setSyncText("Belum ada akun");
    return;
  }

  if (showLoading) setSyncText("Sedang sync...");
  syncBtn.disabled = true;
  syncBtn.textContent = "Sync...";

  try {
    const res = await fetch("/api/sync", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        accounts: accounts.map((x) => ({
          email: x.email,
          password: x.password
        }))
      })
    });

    const result = await res.json();

    if (!res.ok) {
      throw new Error(result.detail || "Request gagal");
    }

    emails = Array.isArray(result.emails) ? result.emails : [];
    renderAccounts();
    renderEmailList();

    const failed = Array.isArray(result.results)
      ? result.results.filter((x) => !x.ok)
      : [];

    if (failed.length) {
      setSyncText(`Sebagian gagal (${failed.length})`);
      alert(
        "Akun yang gagal sync: " +
          failed.map((x) => `${x.email}${x.error ? " - " + x.error : ""}`).join(", ")
      );
    } else {
      setSyncText("Auto sync aktif");
    }
  } catch (err) {
    setSyncText("Sync gagal");
    alert(err.message || "Sync gagal");
  } finally {
    syncBtn.disabled = false;
    syncBtn.textContent = "Sync Sekarang";
  }
}

function stopAutoSync() {
  if (syncTimer) clearInterval(syncTimer);
  syncTimer = null;
}

function startAutoSync() {
  stopAutoSync();

  syncTimer = setInterval(async () => {
    try {
      await syncAll(false);
    } catch {
      setSyncText("Sync gagal");
    }
  }, 30000);
}

loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  loginMsg.textContent = "Mengecek login...";

  const email = String(document.getElementById("email").value || "").trim().toLowerCase();
  const password = String(document.getElementById("password").value || "");

  if (!email || !password) {
    loginMsg.textContent = "Email dan password wajib diisi.";
    return;
  }

  try {
    const res = await fetch("/api/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ email, password })
    });

    const result = await res.json();

    if (!res.ok || !result.ok) {
      throw new Error(result.detail || "Email atau password salah.");
    }

    accounts = [{ email, password }];
    saveAccounts(accounts);
    setSelectedAccountEmail(null);

    userEmail.textContent = email;
    showDashboard();
    renderAccounts();

    loginForm.reset();
    loginMsg.textContent = "";

    await syncAll(true);
    startAutoSync();
  } catch (err) {
    loginMsg.textContent = err.message || "Login gagal.";
  }
});

addAccountForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  accountMsg.textContent = "Mengecek akun...";

  const email = String(document.getElementById("addAccountEmail").value || "").trim().toLowerCase();
  const password = String(document.getElementById("addAccountPassword").value || "");

  if (!email || !password) {
    accountMsg.textContent = "Email dan password wajib diisi.";
    return;
  }

  if (accounts.find((x) => x.email === email)) {
    accountMsg.textContent = "Akun sudah ditambahkan.";
    return;
  }

  try {
    const res = await fetch("/api/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ email, password })
    });

    const result = await res.json();

    if (!res.ok || !result.ok) {
      throw new Error(result.detail || "Email atau password salah.");
    }

    accounts.push({ email, password });
    saveAccounts(accounts);

    accountMsg.textContent = "Akun berhasil ditambahkan.";
    addAccountForm.reset();
    addAccountForm.classList.add("hidden");

    renderAccounts();
    await syncAll(true);
  } catch (err) {
    accountMsg.textContent = err.message || "Tambah akun gagal.";
  }
});

toggleAddAccountBtn.addEventListener("click", () => {
  addAccountForm.classList.toggle("hidden");
});

backBtn.addEventListener("click", () => {
  showInboxPage();
  history.replaceState({}, "", "#inbox");
});

syncBtn.addEventListener("click", async () => {
  await syncAll(true);
});

logoutBtn.addEventListener("click", () => {
  clearAccounts();
  accounts = [];
  emails = [];
  selectedEmailId = null;
  selectedAccountEmail = null;
  showLogin();
});

(function init() {
  accounts = getAccounts();
  selectedAccountEmail = getStoredSelectedAccountEmail();

  if (!accounts.length) {
    showLogin();
    return;
  }

  userEmail.textContent = accounts[0]?.email || "-";
  showDashboard();
  renderAccounts();
  renderEmailList();
  setSyncText("Siap");
  syncAll(false);
  startAutoSync();
})();
