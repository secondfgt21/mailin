const loginView = document.getElementById("loginView");
const dashboardView = document.getElementById("dashboardView");
const loginForm = document.getElementById("loginForm");
const createUserForm = document.getElementById("createUserForm");
const loginMsg = document.getElementById("loginMsg");
const userEmail = document.getElementById("userEmail");
const emailList = document.getElementById("emailList");
const emptyState = document.getElementById("emptyState");
const emailDetail = document.getElementById("emailDetail");
const detailSubject = document.getElementById("detailSubject");
const detailFrom = document.getElementById("detailFrom");
const detailDate = document.getElementById("detailDate");
const detailBody = document.getElementById("detailBody");
const syncBtn = document.getElementById("syncBtn");
const logoutBtn = document.getElementById("logoutBtn");
const showLoginTab = document.getElementById("showLoginTab");
const showCreateTab = document.getElementById("showCreateTab");

let emails = [];

function setToken(token) {
  localStorage.setItem("impura_token", token);
}
function getToken() {
  return localStorage.getItem("impura_token");
}
function clearToken() {
  localStorage.removeItem("impura_token");
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

function formatDate(v) {
  if (!v) return "-";
  try {
    return new Date(v).toLocaleString("id-ID");
  } catch {
    return v;
  }
}

function renderEmailList() {
  emailList.innerHTML = "";
  if (!emails.length) {
    emailList.innerHTML = '<div class="email-item"><div class="subject">Belum ada email.</div></div>';
    emailDetail.classList.add("hidden");
    emptyState.classList.remove("hidden");
    return;
  }

  emails.forEach((item, index) => {
    const div = document.createElement("div");
    div.className = "email-item" + (index === 0 ? " active" : "");
    div.innerHTML = `
      <div class="from">${item.from_name || item.from_email || "(Unknown sender)"}</div>
      <div class="subject">${item.subject || "(Tanpa subject)"}</div>
      <div class="date">${formatDate(item.received_at || item.created_at)}</div>
    `;
    div.onclick = () => {
      document.querySelectorAll(".email-item").forEach(x => x.classList.remove("active"));
      div.classList.add("active");
      renderEmailDetail(item);
    };
    emailList.appendChild(div);
  });

  renderEmailDetail(emails[0]);
}

function renderEmailDetail(item) {
  emptyState.classList.add("hidden");
  emailDetail.classList.remove("hidden");
  detailSubject.textContent = item.subject || "(Tanpa subject)";
  detailFrom.textContent = item.from_name
    ? `${item.from_name} <${item.from_email || "-"}>`
    : (item.from_email || "-");
  detailDate.textContent = formatDate(item.received_at || item.created_at);
  detailBody.textContent = item.body_text || "(Isi email kosong)";
}

async function loadMe() {
  const me = await api("/api/me");
  userEmail.textContent = me.email;
}

async function syncAndLoadEmails() {
  syncBtn.disabled = true;
  syncBtn.textContent = "Sync...";
  try {
    await api("/api/sync", { method: "POST" });
    const data = await api("/api/emails");
    emails = data.emails || [];
    renderEmailList();
  } finally {
    syncBtn.disabled = false;
    syncBtn.textContent = "Sync Inbox";
  }
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
    showDashboard();
    loginMsg.textContent = "";
    await loadMe();
    await syncAndLoadEmails();
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

syncBtn.addEventListener("click", async () => {
  try {
    await syncAndLoadEmails();
  } catch (err) {
    alert(err.message);
  }
});

logoutBtn.addEventListener("click", () => {
  clearToken();
  emails = [];
  showLogin();
  setTab("login");
});

(async function init() {
  setTab("login");
  if (!getToken()) {
    showLogin();
    return;
  }
  try {
    await loadMe();
    showDashboard();
    await syncAndLoadEmails();
  } catch (err) {
    clearToken();
    showLogin();
  }
})();
