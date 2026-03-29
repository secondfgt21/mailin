const loginView = document.getElementById("loginView");
const dashboardView = document.getElementById("dashboardView");
const inboxPage = document.getElementById("inboxPage");
const detailPage = document.getElementById("detailPage");
const loginForm = document.getElementById("loginForm");
const createUserForm = document.getElementById("createUserForm");
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
const showLoginTab = document.getElementById("showLoginTab");
const showCreateTab = document.getElementById("showCreateTab");
const backBtn = document.getElementById("backBtn");
const inboxCount = document.getElementById("inboxCount");
const syncStatus = document.getElementById("syncStatus");
const detailSyncStatus = document.getElementById("detailSyncStatus");
const toggleAddAccountBtn = document.getElementById("toggleAddAccountBtn");

let emails = [];
let accounts = [];
let syncTimer = null;
let selectedEmailId = null;
let selectedAccountId = null;

function setToken(token) {
  localStorage.setItem("impura_token", token);
}

function getToken() {
  return localStorage.getItem("impura_token");
}

function clearToken() {
  localStorage.removeItem("impura_token");
  localStorage.removeItem("impura_user_email");
  localStorage.removeItem("impura_selected_account_id");
}

function setUserEmailCache(email) {
  localStorage.setItem("impura_user_email", email);
}

function getUserEmailCache() {
  return localStorage.getItem("impura_user_email");
}

function setSelectedAccount(id) {
  selectedAccountId = id ? Number(id) : null;
  if (selectedAccountId) {
    localStorage.setItem("impura_selected_account_id", String(selectedAccountId));
  } else {
    localStorage.removeItem("impura_selected_account_id");
  }
}

function getStoredSelectedAccount() {
  const v = localStorage.getItem("impura_selected_account_id");
  return v ? Number(v) : null;
}

async function api(path, options = {}) {
  const token = getToken();
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {})
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(path, { ...options, headers });
  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(data.detail || "Request gagal");
  }

  return data;
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

function setTab(mode) {
  const isLogin = mode === "login";
  loginForm.classList.toggle("hidden", !isLogin);
  createUserForm.classList.toggle("hidden", isLogin);
  showLoginTab.classList.toggle("active", isLogin);
  showCreateTab.classList.toggle("active", !isLogin);
  loginMsg.textContent = "";
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
    return (
      d.toLocaleDateString("id-ID", { day: "2-digit", month: "short" }) +
      " " +
      d.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })
    );
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
  allChip.className = "account-chip" + (!selectedAccountId ? " active" : "");
  allChip.innerHTML = '<div class="email">Semua akun</div>';
  allChip.onclick = async () => {
    setSelectedAccount(null);
    renderAccounts();
    await fetchEmailsOnly();
    showInboxPage();
  };
  accountList.appendChild(allChip);

  accounts.forEach((acc) => {
    const chip = document.createElement("div");
    chip.className =
      "account-chip" + (selectedAccountId === acc.id ? " active" : "");

    chip.innerHTML = `
      <div class="email">${acc.email}</div>
      <button class="remove" type="button">hapus</button>
    `;

    chip.onclick = async (e) => {
      if (e.target.classList.contains("remove")) return;
      setSelectedAccount(acc.id);
      renderAccounts();
      await fetchEmailsOnly();
      showInboxPage();
    };

    chip.querySelector(".remove").onclick = async (e) => {
      e.stopPropagation();

      if (!confirm("Hapus akun ini dari panel?")) return;

      try {
        await api("/api/accounts?id=" + acc.id, { method: "DELETE" });
        accountMsg.textContent = "Akun dihapus.";

        if (selectedAccountId === acc.id) {
          setSelectedAccount(null);
        }

        await loadAccounts();
        await fetchEmailsOnly();
      } catch (err) {
        accountMsg.textContent = err.message;
      }
    };

    accountList.appendChild(chip);
  });
}

function showDetailPage(item) {
  selectedEmailId = item.id;
  inboxPage.classList.add("hidden");
  detailPage.classList.remove("hidden");

  detailSubject.textContent = item.subject || "(Tanpa subject)";
  detailFrom.textContent = item.from_name
    ? `${item.from_name} <${item.from_email || "-"}>`
    : (item.from_email || "-");
  detailDate.textContent = formatDate(item.received_at || item.created_at);

  const acc = accounts.find((a) => a.id === item.mail_account_id);
  detailAccount.textContent = acc?.email || "-";

  detailBody.textContent = cleanBody(item.body_text);
}

function renderEmailList() {
  emailList.innerHTML = "";
  inboxCount.textContent = `${emails.length} email`;

  if (!emails.length) {
    emailList.innerHTML =
      '<div class="empty-list">Belum ada email di server kamu.</div>';
    showInboxPage();
    return;
  }

  emails.forEach((item) => {
    const row = document.createElement("div");
    row.className =
      "gmail-row" + (item.id === selectedEmailId ? " active" : "");

    const acc = accounts.find((a) => a.id === item.mail_account_id);

    row.innerHTML = `
      <div class="sender">${item.from_name || item.from_email || "(Unknown sender)"}</div>
      <div class="subject-line">
        <span class="subject">${item.subject || "(Tanpa subject)"}</span>
        <span class="snippet">${buildSnippet(item.body_text)}${acc ? " • " + acc.email : ""}</span>
      </div>
      <div class="mail-date">${shortDate(item.received_at || item.created_at)}</div>
    `;

    row.onclick = () => {
      document
        .querySelectorAll(".gmail-row")
        .forEach((x) => x.classList.remove("active"));
      row.classList.add("active");
      showDetailPage(item);
      history.replaceState({}, "", "#mail-" + item.id);
    };

    emailList.appendChild(row);
  });

  if (!selectedEmailId && emails[0]) {
    selectedEmailId = emails[0].id;
  }
}

async function loadMe() {
  const me = await api("/api/me");
  userEmail.textContent = me.email;
  setUserEmailCache(me.email);

  if (!selectedAccountId && me.primary_account_id) {
    const stored = getStoredSelectedAccount();
    if (stored) {
      selectedAccountId = stored;
    }
  }
}

async function loadAccounts() {
  const data = await api("/api/accounts");
  accounts = data.accounts || [];

  if (
    selectedAccountId &&
    !accounts.find((a) => a.id === selectedAccountId)
  ) {
    setSelectedAccount(null);
  }

  renderAccounts();
}

async function fetchEmailsOnly() {
  const url = selectedAccountId
    ? `/api/emails?account_id=${selectedAccountId}`
    : "/api/emails";

  const data = await api(url);
  emails = data.emails || [];
  renderEmailList();

  if (window.location.hash.startsWith("#mail-")) {
    const id = Number(window.location.hash.replace("#mail-", ""));
    const selected = emails.find((x) => x.id === id);
    if (selected) {
      showDetailPage(selected);
      return;
    }
  }

  showInboxPage();
}

async function syncAndLoadEmails(showLoading = true) {
  if (showLoading) setSyncText("Sedang sync...");
  syncBtn.disabled = true;
  syncBtn.textContent = "Sync...";

  try {
    const url = selectedAccountId
      ? `/api/sync?account_id=${selectedAccountId}`
      : "/api/sync";

    const result = await api(url, { method: "POST" });

    await loadAccounts();
    await fetchEmailsOnly();

    if (result?.mode === "all" && Array.isArray(result.results)) {
      const failed = result.results.filter((x) => x.ok === false);

      if (failed.length) {
        const names = failed.map((x) => x.email).join(", ");
        setSyncText(`Sebagian gagal (${failed.length})`);
        alert(`Akun yang gagal sync: ${names}`);
      } else {
        setSyncText("Auto sync aktif");
      }
    } else if (result?.mode === "single" && result.ok === false) {
      setSyncText("Akun ini gagal sync");
      alert(result.result?.error || "Sync akun gagal");
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
  if (syncTimer) {
    clearInterval(syncTimer);
  }
  syncTimer = null;
}

function startAutoSync() {
  stopAutoSync();

  syncTimer = setInterval(async () => {
    try {
      await syncAndLoadEmails(false);
    } catch {
      setSyncText("Sync gagal");
    }
  }, 30000);
}

loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  loginMsg.textContent = "Sedang login...";

  try {
    const payload = {
      email: document.getElementById("email").value.trim(),
      password: document.getElementById("password").value
    };

    const data = await api("/api/login", {
      method: "POST",
      body: JSON.stringify(payload)
    });

    setToken(data.token);
    setUserEmailCache(data.user?.email || payload.email);
    userEmail.textContent = data.user?.email || payload.email;

    showDashboard();
    loginMsg.textContent = "";
    showInboxPage();

    await loadMe();
    await loadAccounts();
    await syncAndLoadEmails(true);
    startAutoSync();
  } catch (err) {
    loginMsg.textContent = err.message;
  }
});

createUserForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  loginMsg.textContent = "Sedang membuat user...";

  try {
    const payload = {
      admin_key: document.getElementById("adminKey").value.trim(),
      email: document.getElementById("createEmail").value.trim(),
      web_password: document.getElementById("createWebPassword").value,
      mail_password: document.getElementById("createMailPassword").value
    };

    const data = await api("/api/admin/create-user", {
      method: "POST",
      body: JSON.stringify(payload)
    });

    loginMsg.textContent = `User berhasil dibuat: ${data.user?.email || payload.email}`;
    createUserForm.reset();
    setTab("login");
  } catch (err) {
    loginMsg.textContent = err.message;
  }
});

addAccountForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  accountMsg.textContent = "Sedang menambah akun...";

  try {
    const payload = {
      email: document.getElementById("addAccountEmail").value.trim(),
      mail_password: document.getElementById("addAccountPassword").value
    };

    await api("/api/accounts", {
      method: "POST",
      body: JSON.stringify(payload)
    });

    accountMsg.textContent = "Akun berhasil ditambahkan.";
    addAccountForm.reset();
    addAccountForm.classList.add("hidden");
    await loadAccounts();
  } catch (err) {
    accountMsg.textContent = err.message;
  }
});

toggleAddAccountBtn.addEventListener("click", () => {
  addAccountForm.classList.toggle("hidden");
});

showLoginTab.addEventListener("click", () => setTab("login"));
showCreateTab.addEventListener("click", () => setTab("create"));

backBtn.addEventListener("click", () => {
  showInboxPage();
  history.replaceState({}, "", "#inbox");
});

syncBtn.addEventListener("click", async () => {
  try {
    await syncAndLoadEmails(true);
  } catch (err) {
    alert(err.message);
    setSyncText("Sync gagal");
  }
});

logoutBtn.addEventListener("click", () => {
  clearToken();
  emails = [];
  accounts = [];
  selectedEmailId = null;
  selectedAccountId = null;
  showLogin();
  setTab("login");
});

(async function init() {
  setTab("login");
  selectedAccountId = getStoredSelectedAccount();

  const token = getToken();
  const cachedEmail = getUserEmailCache();

  if (!token) {
    showLogin();
    return;
  }

  userEmail.textContent = cachedEmail || "Sedang memuat...";
  showDashboard();
  showInboxPage();
  setSyncText("Mengecek sesi...");

  try {
    await loadMe();
    await loadAccounts();
    await fetchEmailsOnly();
    await syncAndLoadEmails(false);
    startAutoSync();
  } catch (err) {
    setSyncText("Sesi gagal dimuat");
    if (!cachedEmail) {
      clearToken();
      showLogin();
    }
  }
})();
