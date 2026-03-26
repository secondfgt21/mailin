const loginView = document.getElementById("loginView");
const dashboardView = document.getElementById("dashboardView");
const inboxPage = document.getElementById("inboxPage");
const detailPage = document.getElementById("detailPage");
const loginForm = document.getElementById("loginForm");
const createUserForm = document.getElementById("createUserForm");
const loginMsg = document.getElementById("loginMsg");
const userEmail = document.getElementById("userEmail");
const emailList = document.getElementById("emailList");
const detailSubject = document.getElementById("detailSubject");
const detailFrom = document.getElementById("detailFrom");
const detailDate = document.getElementById("detailDate");
const detailBody = document.getElementById("detailBody");
const syncBtn = document.getElementById("syncBtn");
const logoutBtn = document.getElementById("logoutBtn");
const showLoginTab = document.getElementById("showLoginTab");
const showCreateTab = document.getElementById("showCreateTab");
const backBtn = document.getElementById("backBtn");
const inboxCount = document.getElementById("inboxCount");
const syncStatus = document.getElementById("syncStatus");
const detailSyncStatus = document.getElementById("detailSyncStatus");

let emails = [];
let syncTimer = null;
let selectedEmailId = null;

function setToken(token) {
  localStorage.setItem("impura_token", token);
}
function getToken() {
  return localStorage.getItem("impura_token");
}
function clearToken() {
  localStorage.removeItem("impura_token");
  localStorage.removeItem("impura_user_email");
}
function setUserEmailCache(email) {
  localStorage.setItem("impura_user_email", email);
}
function getUserEmailCache() {
  return localStorage.getItem("impura_user_email");
}

async function api(path, options = {}) {
  const token = getToken();
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {}),
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(path, { ...options, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.detail || "Request gagal");
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
    return d.toLocaleDateString("id-ID", { day: "2-digit", month: "short" }) + " " +
      d.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
  } catch {
    return v;
  }
}

function buildSnippet(text) {
  return (text || "").replace(/\s+/g, " ").trim().slice(0, 120);
}

function showInboxPage() {
  inboxPage.classList.remove("hidden");
  detailPage.classList.add("hidden");
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
  detailBody.textContent = item.body_text || "(Isi email kosong)";
}

function renderEmailList() {
  emailList.innerHTML = "";
  inboxCount.textContent = `${emails.length} email`;

  if (!emails.length) {
    emailList.innerHTML = '<div class="empty-list">Belum ada email di server kamu.</div>';
    showInboxPage();
    return;
  }

  emails.forEach((item) => {
    const row = document.createElement("div");
    row.className = "gmail-row" + (item.id === selectedEmailId ? " active" : "");
    row.innerHTML = `
      <div class="sender">${item.from_name || item.from_email || "(Unknown sender)"}</div>
      <div class="subject-line">
        <span class="subject">${item.subject || "(Tanpa subject)"}</span>
        <span class="snippet">${buildSnippet(item.body_text)}</span>
      </div>
      <div class="mail-date">${shortDate(item.received_at || item.created_at)}</div>
    `;
    row.onclick = () => {
      document.querySelectorAll(".gmail-row").forEach(x => x.classList.remove("active"));
      row.classList.add("active");
      showDetailPage(item);
      history.replaceState({}, "", "#mail-" + item.id);
    };
    emailList.appendChild(row);
  });

  if (!selectedEmailId) {
    selectedEmailId = emails[0].id;
  }
}

async function loadMe() {
  const me = await api("/api/me");
  userEmail.textContent = me.email;
  setUserEmailCache(me.email);
}

async function fetchEmailsOnly() {
  const data = await api("/api/emails");
  emails = data.emails || [];
  renderEmailList();

  if (window.location.hash.startsWith("#mail-")) {
    const id = Number(window.location.hash.replace("#mail-", ""));
    const selected = emails.find(x => x.id === id);
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
    await api("/api/sync", { method: "POST" });
    await fetchEmailsOnly();
    setSyncText("Auto sync aktif");
  } finally {
    syncBtn.disabled = false;
    syncBtn.textContent = "Sync Sekarang";
  }
}

function stopAutoSync() {
  if (syncTimer) {
    clearInterval(syncTimer);
    syncTimer = null;
  }
}

function startAutoSync() {
  stopAutoSync();
  syncTimer = setInterval(async () => {
    try {
      await syncAndLoadEmails(false);
    } catch (err) {
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
      password: document.getElementById("password").value,
    };
    const data = await api("/api/login", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    setToken(data.token);
    setUserEmailCache(data.user?.email || payload.email);
    userEmail.textContent = data.user?.email || payload.email;
    showDashboard();
    loginMsg.textContent = "";
    showInboxPage();
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
      mail_password: document.getElementById("createMailPassword").value,
    };
    const data = await api("/api/admin/create-user", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    loginMsg.textContent = `User berhasil dibuat: ${data.user?.email || payload.email}`;
    createUserForm.reset();
    setTab("login");
  } catch (err) {
    loginMsg.textContent = err.message;
  }
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
  selectedEmailId = null;
  showLogin();
  setTab("login");
});

(async function init() {
  setTab("login");
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
