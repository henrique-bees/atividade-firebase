import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import {
  createUserWithEmailAndPassword,
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import {
  get,
  getDatabase,
  onValue,
  ref,
  serverTimestamp,
  set,
  update
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-database.js";

const elements = {
  email: document.getElementById("email"),
  password: document.getElementById("password"),
  role: document.getElementById("role"),
  signup: document.getElementById("signup-btn"),
  login: document.getElementById("login-btn"),
  logout: document.getElementById("logout-btn"),
  seedAdminData: document.getElementById("seed-admin-data-btn"),
  status: document.getElementById("status-box"),
  sessionState: document.getElementById("session-state"),
  profileSummary: document.getElementById("profile-summary"),
  summaryRole: document.getElementById("summary-role"),
  summaryAccess: document.getElementById("summary-access"),
  summaryViewMode: document.getElementById("summary-view-mode"),
  accessCards: document.getElementById("access-cards"),
  userJson: document.getElementById("user-json"),
  adminJson: document.getElementById("admin-json"),
  usersJson: document.getElementById("users-json"),
  rulesJson: document.getElementById("rules-json"),
  snapshotModeBtn: document.getElementById("snapshot-mode-btn"),
  liveModeBtn: document.getElementById("live-mode-btn"),
  snapshotView: document.getElementById("snapshot-view"),
  liveView: document.getElementById("live-view"),
  presetSelfBtn: document.getElementById("preset-self-btn"),
  presetUsersBtn: document.getElementById("preset-users-btn"),
  presetAdminBtn: document.getElementById("preset-admin-btn"),
  livePathInput: document.getElementById("live-path-input"),
  applyLivePathBtn: document.getElementById("apply-live-path-btn"),
  clearLiveLogBtn: document.getElementById("clear-live-log-btn"),
  liveStateValue: document.getElementById("live-state-value"),
  livePathValue: document.getElementById("live-path-value"),
  liveEventsValue: document.getElementById("live-events-value"),
  liveUpdatedValue: document.getElementById("live-updated-value"),
  liveStateMeta: document.getElementById("live-state-meta"),
  liveJson: document.getElementById("live-json"),
  liveLog: document.getElementById("live-log")
};

const firebaseConfig = window.__FIREBASE_CONFIG__ || {};
const missingFirebaseConfig = Object.entries(firebaseConfig)
  .filter(([, value]) => !value)
  .map(([key]) => key);

const state = {
  authReady: false,
  currentUser: null,
  currentRole: "guest",
  allowedCount: 0,
  viewMode: "snapshot",
  livePath: "",
  liveStatus: "paused",
  liveEvents: 0,
  liveLastUpdate: null,
  liveEntries: [],
  liveUnsubscribe: null
};

let auth;
let db;

if (!missingFirebaseConfig.length) {
  const app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getDatabase(app);
}

bindEvents();
bootstrap();

function bindEvents() {
  elements.signup.addEventListener("click", handleSignup);
  elements.login.addEventListener("click", handleLogin);
  elements.logout.addEventListener("click", handleLogout);
  elements.seedAdminData.addEventListener("click", handleSeedAdminData);
  elements.snapshotModeBtn.addEventListener("click", () => setViewMode("snapshot"));
  elements.liveModeBtn.addEventListener("click", () => setViewMode("live"));
  elements.presetSelfBtn.addEventListener("click", () => handlePreset(elements.presetSelfBtn.dataset.path));
  elements.presetUsersBtn.addEventListener("click", () => handlePreset("users"));
  elements.presetAdminBtn.addEventListener("click", () => handlePreset("admin-data"));
  elements.applyLivePathBtn.addEventListener("click", handleApplyLivePath);
  elements.clearLiveLogBtn.addEventListener("click", clearLiveLog);
  elements.livePathInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      handleApplyLivePath();
    }
  });
}

function bootstrap() {
  renderSignedOut();
  setViewMode("snapshot");

  if (missingFirebaseConfig.length) {
    updateControlsAvailability(true);
    setStatus(
      `Preencha o .env com a configuracao do Firebase. Campos faltando: ${missingFirebaseConfig.join(", ")}.`,
      "denied"
    );
    return;
  }

  setStatus("Aguardando autenticacao do Firebase...", "neutral");

  onAuthStateChanged(auth, async (firebaseUser) => {
    state.authReady = true;

    if (!firebaseUser) {
      state.currentUser = null;
      state.currentRole = "guest";
      state.allowedCount = 0;
      resetLiveState();
      renderSignedOut();
      setStatus("Entre com uma conta Firebase para testar os acessos.", "neutral");
      return;
    }

    const switchedUser = state.currentUser?.uid !== firebaseUser.uid;
    state.currentUser = firebaseUser;

    if (switchedUser) {
      resetLiveState(`users/${firebaseUser.uid}`);
    }

    try {
      await syncLastLogin(firebaseUser.uid);
      await renderAuthenticatedState(firebaseUser);
    } catch (error) {
      setStatus(formatFirebaseError(error), "denied");
    }
  });
}

async function handleSignup() {
  if (!auth) {
    return;
  }

  const email = elements.email.value.trim().toLowerCase();
  const password = elements.password.value.trim();
  const role = elements.role.value === "admin" ? "admin" : "user";

  if (!email || !password) {
    setStatus("Preencha e-mail e senha para criar a conta.", "denied");
    return;
  }

  if (password.length < 6) {
    setStatus("A senha precisa ter pelo menos 6 caracteres.", "denied");
    return;
  }

  updateControlsAvailability(true);
  setStatus(`Criando conta Firebase com cargo ${role}...`, "neutral");

  try {
    const credential = await createUserWithEmailAndPassword(auth, email, password);
    state.currentUser = credential.user;
    resetLiveState(`users/${credential.user.uid}`);
    await createUserProfile(credential.user, role);

    if (role === "admin") {
      await seedAdminDataForUser(credential.user, true);
    }

    await renderAuthenticatedState(credential.user);
    setStatus(`Conta criada. Cargo salvo como ${role}.`, "allowed");
  } catch (error) {
    setStatus(formatFirebaseError(error), "denied");
  } finally {
    updateControlsAvailability(false);
  }
}

async function handleLogin() {
  if (!auth) {
    return;
  }

  const email = elements.email.value.trim().toLowerCase();
  const password = elements.password.value.trim();

  if (!email || !password) {
    setStatus("Preencha e-mail e senha para entrar.", "denied");
    return;
  }

  updateControlsAvailability(true);
  setStatus("Entrando com Firebase Auth...", "neutral");

  try {
    const credential = await signInWithEmailAndPassword(auth, email, password);
    state.currentUser = credential.user;
    resetLiveState(`users/${credential.user.uid}`);
    await syncLastLogin(credential.user.uid);
    await renderAuthenticatedState(credential.user);
    setStatus("Login realizado com sucesso via Firebase Auth.", "allowed");
  } catch (error) {
    setStatus(formatFirebaseError(error), "denied");
  } finally {
    updateControlsAvailability(false);
  }
}

async function handleLogout() {
  if (!auth) {
    return;
  }

  updateControlsAvailability(true);

  try {
    await signOut(auth);
    state.currentUser = null;
    state.currentRole = "guest";
    state.allowedCount = 0;
    resetLiveState();
    renderSignedOut();
    setStatus("Sessao encerrada.", "neutral");
  } catch (error) {
    setStatus(formatFirebaseError(error), "denied");
  } finally {
    updateControlsAvailability(false);
  }
}

async function handleSeedAdminData() {
  if (!state.currentUser) {
    setStatus("Faca login antes de tentar popular /admin-data.", "denied");
    return;
  }

  updateControlsAvailability(true);
  setStatus("Tentando gravar dados em /admin-data...", "neutral");

  try {
    await seedAdminDataForUser(state.currentUser, false);
    await renderAuthenticatedState(state.currentUser);
    setStatus("Dados de /admin-data gravados com sucesso.", "allowed");
  } catch (error) {
    setStatus(formatFirebaseError(error), "denied");
  } finally {
    updateControlsAvailability(false);
  }
}

async function renderAuthenticatedState(firebaseUser) {
  const [ownData, adminData, usersList] = await Promise.all([
    safeGet(`users/${firebaseUser.uid}`),
    safeGet("admin-data"),
    safeGet("users")
  ]);

  const role = ownData.ok ? ownData.data?.profile?.role || "indefinido" : "indefinido";
  state.currentRole = role;
  state.allowedCount = [ownData, adminData, usersList].filter((result) => result.ok).length;

  renderSummary(firebaseUser, role);
  renderAccessCards(ownData, adminData, usersList);
  renderSnapshot(ownData, adminData, usersList, role);
  renderPresetButtons(firebaseUser);
  updateControlsAvailability(false);

  if (state.viewMode === "live" && state.livePath) {
    startLiveListener(state.livePath, true);
  } else {
    updateLivePanel();
  }
}

function renderSummary(firebaseUser, role) {
  elements.sessionState.textContent = "Autenticado";
  elements.sessionState.className = "pill allowed";
  elements.profileSummary.className = "profile-summary";
  elements.profileSummary.innerHTML = [
    `<strong>${escapeHtml(firebaseUser.email || "Sem e-mail")}</strong>`,
    `UID: <code>${escapeHtml(firebaseUser.uid)}</code>`,
    `Cargo salvo no banco: <code>${escapeHtml(role)}</code>`,
    "Origem do login: <code>Firebase Auth</code>"
  ].join("<br>");

  elements.summaryRole.textContent = role;
  elements.summaryAccess.textContent = `${state.allowedCount}/3`;
  elements.summaryViewMode.textContent = state.viewMode;
}

function renderAccessCards(ownData, adminData, usersList) {
  const cards = [
    buildAccessCard(
      "Meu no em /users/{uid}",
      ownData.ok,
      "O proprio usuario consegue ler o perfil salvo no banco.",
      "O proprio perfil foi bloqueado pelas rules."
    ),
    buildAccessCard(
      "No /admin-data",
      adminData.ok,
      "O caminho administrativo foi liberado para este cargo.",
      "Leitura bloqueada para este cargo."
    ),
    buildAccessCard(
      "Raiz /users",
      usersList.ok,
      "A conta conseguiu listar a raiz completa de usuarios.",
      "Leitura bloqueada da raiz /users."
    )
  ];

  elements.accessCards.innerHTML = cards.join("");
}

function renderSnapshot(ownData, adminData, usersList, role) {
  renderJson(elements.userJson, ownData);
  renderJson(elements.adminJson, adminData);
  renderJson(elements.usersJson, usersList);

  const summary = {
    authenticatedRole: role,
    allowedReads: {
      ownUserNode: ownData.ok,
      adminData: adminData.ok,
      usersRoot: usersList.ok
    },
    interpretation:
      role === "admin"
        ? "Conta admin pode ler /users e /admin-data."
        : "Conta user fica restrita ao proprio /users/{uid}."
  };

  elements.rulesJson.textContent = JSON.stringify(summary, null, 2);
  elements.rulesJson.className = `json-box ${role === "admin" ? "allowed" : "neutral"}`;
}

function renderSignedOut() {
  elements.sessionState.textContent = state.authReady ? "Desconectado" : "Inicializando";
  elements.sessionState.className = "pill neutral";
  elements.profileSummary.className = "profile-summary empty";
  elements.profileSummary.textContent = "Nenhum usuario autenticado.";
  elements.summaryRole.textContent = "Nenhum";
  elements.summaryAccess.textContent = "0/3";
  elements.summaryViewMode.textContent = state.viewMode;

  elements.accessCards.innerHTML = [
    buildAccessCard("Meu no em /users/{uid}", false, "", "Faca login para testar."),
    buildAccessCard("No /admin-data", false, "", "Faca login para testar."),
    buildAccessCard("Raiz /users", false, "", "Faca login para testar.")
  ].join("");

  elements.userJson.textContent = "Sem dados ainda.";
  elements.adminJson.textContent = "Sem dados ainda.";
  elements.usersJson.textContent = "Sem dados ainda.";
  elements.rulesJson.textContent = "As regras serao testadas apos o login.";
  elements.rulesJson.className = "json-box neutral";

  elements.presetSelfBtn.textContent = "Meu /users/{uid}";
  elements.livePathInput.value = "";
  elements.liveJson.textContent = "Ative o modo realtime e escolha um caminho para iniciar o monitor.";
  elements.liveJson.className = "json-box neutral";
  renderLivePlaceholder("Monitor parado", "Ative o modo realtime para comecar a escutar um caminho.", "neutral");
  updateLivePanel();
}

function setViewMode(mode) {
  state.viewMode = mode;
  const liveMode = mode === "live";

  elements.snapshotModeBtn.classList.toggle("is-active", !liveMode);
  elements.liveModeBtn.classList.toggle("is-active", liveMode);
  elements.snapshotModeBtn.setAttribute("aria-pressed", String(!liveMode));
  elements.liveModeBtn.setAttribute("aria-pressed", String(liveMode));
  elements.snapshotView.classList.toggle("is-active", !liveMode);
  elements.liveView.classList.toggle("is-active", liveMode);
  elements.summaryViewMode.textContent = state.viewMode;

  if (liveMode && state.currentUser && state.livePath) {
    startLiveListener(state.livePath, true);
  }

  if (!liveMode) {
    stopLiveListener();
    state.liveStatus = state.currentUser ? "paused" : "paused";
    updateLivePanel();
  }
}

function handlePreset(path) {
  if (!state.currentUser) {
    setStatus("Entre com uma conta antes de usar o modo realtime.", "denied");
    return;
  }

  state.livePath = path;
  elements.livePathInput.value = path;

  if (state.viewMode !== "live") {
    setViewMode("live");
    return;
  }

  startLiveListener(path, true);
}

function handleApplyLivePath() {
  if (!state.currentUser) {
    setStatus("Entre com uma conta antes de escutar um caminho.", "denied");
    return;
  }

  const path = normalizePath(elements.livePathInput.value);

  if (!path) {
    setStatus("Informe um caminho valido para o listener realtime.", "denied");
    return;
  }

  state.livePath = path;

  if (state.viewMode !== "live") {
    setViewMode("live");
    return;
  }

  startLiveListener(path, true);
}

function startLiveListener(path, forceRestart = false) {
  if (!db || !state.currentUser) {
    return;
  }

  const normalizedPath = normalizePath(path);

  if (!normalizedPath) {
    return;
  }

  if (!forceRestart && state.liveUnsubscribe && state.livePath === normalizedPath) {
    return;
  }

  stopLiveListener();

  state.livePath = normalizedPath;
  state.liveStatus = "connecting";
  state.liveEvents = 0;
  state.liveLastUpdate = null;
  state.liveEntries = [];
  elements.livePathInput.value = normalizedPath;
  elements.liveJson.textContent = `Conectando listener em /${normalizedPath}...`;
  elements.liveJson.className = "json-box neutral";
  renderLivePlaceholder("Conectando", `Abrindo listener em /${normalizedPath}.`, "neutral");
  highlightActivePreset();
  updateLivePanel();

  state.liveUnsubscribe = onValue(
    ref(db, normalizedPath),
    (snapshot) => {
      state.liveEvents += 1;
      state.liveLastUpdate = new Date();
      state.liveStatus = snapshot.exists() ? "listening" : "empty";

      const payload = snapshot.exists() ? snapshot.val() : null;
      elements.liveJson.textContent = JSON.stringify(payload, null, 2) || "null";
      elements.liveJson.className = `json-box ${payload ? "allowed" : "neutral"}`;

      addLiveEntry(
        payload ? "allowed" : "neutral",
        `Evento ${state.liveEvents}`,
        payload ? `Dados recebidos de /${normalizedPath}.` : `O caminho /${normalizedPath} retornou vazio.`
      );

      updateLivePanel();
    },
    (error) => {
      state.liveStatus = "denied";
      state.liveLastUpdate = new Date();
      elements.liveJson.textContent = `ERRO EM /${normalizedPath}\n${formatFirebaseError(error)}`;
      elements.liveJson.className = "json-box denied";
      addLiveEntry("denied", `Bloqueio em /${normalizedPath}`, formatFirebaseError(error));
      updateLivePanel();
    }
  );
}

function stopLiveListener() {
  if (typeof state.liveUnsubscribe === "function") {
    state.liveUnsubscribe();
  }

  state.liveUnsubscribe = null;
}

function resetLiveState(defaultPath = "") {
  stopLiveListener();
  state.livePath = defaultPath;
  state.liveStatus = "paused";
  state.liveEvents = 0;
  state.liveLastUpdate = null;
  state.liveEntries = [];
  highlightActivePreset();
}

function updateLivePanel() {
  const statusMap = {
    paused: "Pausado",
    connecting: "Conectando",
    listening: "Escutando",
    empty: "Escutando vazio",
    denied: "Bloqueado"
  };

  const metaMap = {
    paused: state.currentUser
      ? "Troque para o modo realtime para ouvir o caminho selecionado."
      : "Entre com uma conta para iniciar o monitor.",
    connecting: state.livePath ? `Abrindo listener em /${state.livePath}.` : "Preparando listener.",
    listening: "O listener esta recebendo atualizacoes do Realtime Database.",
    empty: "O listener esta ativo, mas o caminho atual retornou vazio.",
    denied: "As Firebase Security Rules bloquearam a leitura deste caminho."
  };

  elements.liveStateValue.textContent = statusMap[state.liveStatus] || "Pausado";
  elements.livePathValue.textContent = state.livePath ? `/${state.livePath}` : "/";
  elements.liveEventsValue.textContent = String(state.liveEvents);
  elements.liveUpdatedValue.textContent = state.liveLastUpdate ? formatClock(state.liveLastUpdate) : "--:--:--";
  elements.liveStateMeta.textContent = metaMap[state.liveStatus] || metaMap.paused;
  elements.summaryViewMode.textContent = state.viewMode;
}

function addLiveEntry(tone, title, description) {
  state.liveEntries.unshift({
    tone,
    title,
    description,
    time: new Date()
  });

  state.liveEntries = state.liveEntries.slice(0, 8);
  renderLiveLog();
}

function renderLiveLog() {
  if (!state.liveEntries.length) {
    renderLivePlaceholder("Sem eventos", "O listener ainda nao recebeu dados.", "neutral");
    return;
  }

  elements.liveLog.innerHTML = state.liveEntries.map((entry) => `
    <article class="log-entry ${entry.tone}">
      <strong>${escapeHtml(entry.title)}</strong>
      <p>${escapeHtml(entry.description)}</p>
      <small>${formatClock(entry.time)}</small>
    </article>
  `).join("");
}

function renderLivePlaceholder(title, description, tone) {
  elements.liveLog.innerHTML = `
    <article class="log-entry ${tone}">
      <strong>${escapeHtml(title)}</strong>
      <p>${escapeHtml(description)}</p>
    </article>
  `;
}

function clearLiveLog() {
  state.liveEntries = [];
  renderLivePlaceholder("Log limpo", "O historico do listener foi reiniciado.", "neutral");
}

function renderJson(target, result) {
  if (!result.ok) {
    target.textContent = `ERRO EM ${result.path}\n${result.error}`;
    target.className = "json-box denied";
    return;
  }

  target.textContent = JSON.stringify(result.data, null, 2) || "null";
  target.className = `json-box ${result.data ? "allowed" : "neutral"}`;
}

function renderPresetButtons(firebaseUser) {
  const selfPath = `users/${firebaseUser.uid}`;
  elements.presetSelfBtn.dataset.path = selfPath;
  elements.presetSelfBtn.textContent = `Meu /users/${shortUid(firebaseUser.uid)}`;

  if (!state.livePath) {
    state.livePath = selfPath;
    elements.livePathInput.value = selfPath;
  }

  highlightActivePreset();
}

function highlightActivePreset() {
  const presetPaths = [
    { element: elements.presetSelfBtn, path: normalizePath(elements.presetSelfBtn.dataset.path) },
    { element: elements.presetUsersBtn, path: "users" },
    { element: elements.presetAdminBtn, path: "admin-data" }
  ];

  presetPaths.forEach((item) => {
    item.element.classList.toggle("is-active", item.path === state.livePath);
  });
}

function updateControlsAvailability(isLoading) {
  const ready = Boolean(auth);
  const authenticated = Boolean(state.currentUser);
  const isAdmin = state.currentRole === "admin";

  elements.signup.disabled = isLoading || !ready;
  elements.login.disabled = isLoading || !ready;
  elements.logout.disabled = isLoading || !authenticated;
  elements.seedAdminData.disabled = isLoading || !authenticated || !isAdmin;
  elements.presetSelfBtn.disabled = isLoading || !authenticated;
  elements.presetUsersBtn.disabled = isLoading || !authenticated;
  elements.presetAdminBtn.disabled = isLoading || !authenticated;
  elements.livePathInput.disabled = isLoading || !authenticated;
  elements.applyLivePathBtn.disabled = isLoading || !authenticated;
  elements.clearLiveLogBtn.disabled = isLoading || !authenticated;
}

async function createUserProfile(firebaseUser, role) {
  const now = Date.now();
  const basePath = `users/${firebaseUser.uid}`;

  await set(ref(db, `${basePath}/profile`), {
    uid: firebaseUser.uid,
    email: firebaseUser.email,
    role,
    createdAt: now
  });

  await set(ref(db, `${basePath}/private`), {
    lastLoginAt: now,
    welcomeMessage:
      role === "admin"
        ? "Conta admin criada para a demonstracao."
        : "Conta user criada para a demonstracao."
  });

  if (role === "admin") {
    await set(ref(db, `${basePath}/adminAccess`), {
      grantedAt: now,
      note: "Admin autorizado para a demonstracao."
    });
  }
}

async function syncLastLogin(uid) {
  await update(ref(db, `users/${uid}/private`), {
    lastLoginAt: serverTimestamp()
  });
}

async function seedAdminDataForUser(firebaseUser, silentIfDenied) {
  const now = Date.now();

  try {
    await update(ref(db, "admin-data"), {
      "dashboard/title": "Painel exclusivo do administrador",
      "dashboard/lastReviewAt": now,
      "dashboard/managedBy": firebaseUser.email || firebaseUser.uid,
      [`audit/${firebaseUser.uid}/email`]: firebaseUser.email || "sem-email",
      [`audit/${firebaseUser.uid}/grantedAt`]: now,
      [`audit/${firebaseUser.uid}/note`]: "Registro gerado pela interface da atividade"
    });
  } catch (error) {
    if (!silentIfDenied) {
      throw error;
    }
  }
}

async function safeGet(path) {
  try {
    const snapshot = await get(ref(db, path));
    return {
      ok: true,
      path: `/${path}`,
      data: snapshot.exists() ? snapshot.val() : null
    };
  } catch (error) {
    return {
      ok: false,
      path: `/${path}`,
      error: formatFirebaseError(error)
    };
  }
}

function buildAccessCard(title, allowed, allowedText, deniedText) {
  return `
    <article class="access-card ${allowed ? "allowed" : "denied"}">
      <span class="card-chip ${allowed ? "allowed" : "denied"}">${allowed ? "Liberado" : "Bloqueado"}</span>
      <h3>${title}</h3>
      <p>${allowed ? allowedText : deniedText}</p>
    </article>
  `;
}

function setStatus(message, tone) {
  elements.status.textContent = message;
  elements.status.className = `status-box ${tone}`;
}

function normalizePath(value) {
  return String(value || "").trim().replace(/^\/+/, "").replace(/\/+$/, "");
}

function shortUid(uid) {
  return uid ? `${uid.slice(0, 6)}...` : "{uid}";
}

function formatClock(date) {
  return new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  }).format(date);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function formatFirebaseError(error) {
  const code = error?.code || "";

  if (code === "auth/email-already-in-use") {
    return "Este e-mail ja esta em uso no Firebase Auth.";
  }

  if (code === "auth/invalid-credential" || code === "auth/invalid-login-credentials") {
    return "Credenciais invalidas.";
  }

  if (code === "auth/weak-password") {
    return "A senha e fraca. Use pelo menos 6 caracteres.";
  }

  if (code === "auth/configuration-not-found") {
    return "O Firebase Auth do projeto ainda nao esta configurado. Abra Firebase Console > Authentication, clique em Get started e habilite Email/Password.";
  }

  if (code === "auth/operation-not-allowed") {
    return "O provedor Email/Password nao esta habilitado neste projeto Firebase.";
  }

  if (code === "auth/unauthorized-domain") {
    return "O dominio atual nao esta autorizado no Firebase Auth. Verifique se localhost esta em Authentication > Settings > Authorized domains.";
  }

  if (code === "auth/network-request-failed") {
    return "Falha de rede ao falar com o Firebase.";
  }

  if (code === "PERMISSION_DENIED") {
    return "PERMISSION_DENIED: esta leitura ou escrita foi bloqueada pelas Firebase Security Rules.";
  }

  return error?.message || "Ocorreu um erro inesperado.";
}
