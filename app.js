const elements = {
  email: document.getElementById("email"),
  password: document.getElementById("password"),
  role: document.getElementById("role"),
  signup: document.getElementById("signup-btn"),
  login: document.getElementById("login-btn"),
  logout: document.getElementById("logout-btn"),
  status: document.getElementById("status-box"),
  sessionState: document.getElementById("session-state"),
  profile: document.getElementById("profile-summary"),
  userJson: document.getElementById("user-json"),
  adminJson: document.getElementById("admin-json"),
  usersJson: document.getElementById("users-json"),
  cards: document.getElementById("access-cards")
};

const sessionStorageKey = "mongo-demo-session-token";

elements.signup.addEventListener("click", handleSignup);
elements.login.addEventListener("click", handleLogin);
elements.logout.addEventListener("click", handleLogout);

bootstrapSession();

async function bootstrapSession() {
  const token = getSessionToken();

  if (!token) {
    renderSignedOut();
    setStatus("Crie uma conta ou faca login para testar o acesso por cargo.", "neutral");
    return;
  }

  setStatus("Restaurando sessao...", "neutral");

  try {
    const result = await apiRequest("/api/session");
    await renderAuthenticatedState(result.user);
    setStatus("Sessao restaurada com sucesso.", "allowed");
  } catch (error) {
    clearSessionToken();
    renderSignedOut();
    setStatus(error.message, "denied");
  }
}

async function handleSignup() {
  const email = elements.email.value.trim();
  const password = elements.password.value.trim();
  const role = elements.role.value;

  if (!email || !password) {
    setStatus("Preencha e-mail e senha para criar a conta.", "denied");
    return;
  }

  toggleAuthButtons(true);
  setStatus(`Criando conta com cargo ${role}...`, "neutral");

  try {
    const result = await apiRequest("/api/auth/signup", {
      method: "POST",
      body: { email, password, role }
    });

    setSessionToken(result.token);
    await renderAuthenticatedState(result.user);
    setStatus(`Conta criada com sucesso. Cargo salvo como ${role}.`, "allowed");
  } catch (error) {
    setStatus(error.message, "denied");
  } finally {
    toggleAuthButtons(false);
  }
}

async function handleLogin() {
  const email = elements.email.value.trim();
  const password = elements.password.value.trim();

  if (!email || !password) {
    setStatus("Preencha e-mail e senha para entrar.", "denied");
    return;
  }

  toggleAuthButtons(true);
  setStatus("Entrando...", "neutral");

  try {
    const result = await apiRequest("/api/auth/login", {
      method: "POST",
      body: { email, password }
    });

    setSessionToken(result.token);
    await renderAuthenticatedState(result.user);
    setStatus("Login realizado com sucesso.", "allowed");
  } catch (error) {
    setStatus(error.message, "denied");
  } finally {
    toggleAuthButtons(false);
  }
}

async function handleLogout() {
  toggleAuthButtons(true);

  try {
    await apiRequest("/api/auth/logout", { method: "POST" });
  } catch (_error) {
    // Mesmo que a sessao ja esteja invalida, a UI deve voltar ao estado inicial.
  } finally {
    clearSessionToken();
    renderSignedOut();
    setStatus("Sessao encerrada.", "neutral");
    toggleAuthButtons(false);
  }
}

async function renderAuthenticatedState(user) {
  elements.sessionState.textContent = "Autenticado";
  elements.sessionState.className = "pill allowed";
  elements.logout.disabled = false;
  await loadDashboard(user);
}

async function loadDashboard(user) {
  const role = user.profile?.role ?? "indefinido";
  const email = user.profile?.email ?? user.email ?? "Sem e-mail";
  const uid = user.uid ?? "sem-uid";

  elements.profile.className = "profile-summary";
  elements.profile.innerHTML = `
    <strong>${email}</strong>
    UID: <code>${uid}</code><br>
    Cargo salvo no banco: <code>${role}</code>
  `;

  const [ownData, adminData, usersList] = await Promise.all([
    safeGet("/api/users/me"),
    safeGet("/api/admin-data"),
    safeGet("/api/users")
  ]);

  renderJson(elements.userJson, ownData);
  renderJson(elements.adminJson, adminData);
  renderJson(elements.usersJson, usersList);
  renderAccessCards(ownData, adminData, usersList, role);
}

async function safeGet(path) {
  try {
    const result = await apiRequest(path);
    return {
      ok: true,
      path,
      data: result.data ?? result.user ?? null
    };
  } catch (error) {
    return {
      ok: false,
      path,
      error: error.message
    };
  }
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

function renderAccessCards(ownData, adminData, usersList, role) {
  const cards = [
    buildCard("Minha area em `users`", ownData, "Todo usuario autenticado deve conseguir ler seus proprios dados."),
    buildCard("Painel derivado da collection", adminData, "Apenas `admin` deve conseguir ler o painel agregado."),
    buildCard("Lista completa de `users`", usersList, "Somente `admin` enxerga todos os usuarios; `user` fica restrito ao proprio perfil.")
  ];

  elements.cards.innerHTML = "";
  cards.forEach((card) => elements.cards.append(card));
  setStatus(`Painel atualizado para o cargo ${role}.`, "allowed");
}

function buildCard(title, result, description) {
  const article = document.createElement("article");
  article.className = `access-card ${result.ok ? "allowed" : "denied"}`;

  const heading = document.createElement("h3");
  heading.textContent = title;

  const body = document.createElement("p");
  body.textContent = result.ok
    ? `Liberado pela API. ${description}`
    : `Bloqueado pela API. ${description}`;

  article.append(heading, body);
  return article;
}

function renderSignedOut() {
  elements.sessionState.textContent = "Desconectado";
  elements.sessionState.className = "pill neutral";
  elements.logout.disabled = true;
  elements.profile.className = "profile-summary empty";
  elements.profile.textContent = "Nenhum usuario autenticado.";
  elements.userJson.textContent = "Sem dados ainda.";
  elements.adminJson.textContent = "Sem dados ainda.";
  elements.usersJson.textContent = "Sem dados ainda.";
  elements.cards.innerHTML = `
    <article class="access-card neutral">
      <h3>Minha area em \`users\`</h3>
      <p>Faca login para testar.</p>
    </article>
    <article class="access-card neutral">
      <h3>Painel derivado da collection</h3>
      <p>Faca login para testar.</p>
    </article>
    <article class="access-card neutral">
      <h3>Lista completa de \`users\`</h3>
      <p>Faca login para testar.</p>
    </article>
  `;
}

function toggleAuthButtons(isLoading) {
  elements.signup.disabled = isLoading;
  elements.login.disabled = isLoading;
  elements.logout.disabled = isLoading;
}

function setStatus(message, tone) {
  elements.status.textContent = message;
  elements.status.className = `status-box ${tone}`;
}

function getSessionToken() {
  return window.localStorage.getItem(sessionStorageKey);
}

function setSessionToken(token) {
  window.localStorage.setItem(sessionStorageKey, token);
}

function clearSessionToken() {
  window.localStorage.removeItem(sessionStorageKey);
}

async function apiRequest(path, options = {}) {
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {})
  };
  const token = getSessionToken();

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(path, {
    method: options.method || "GET",
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(payload.message || "Ocorreu um erro inesperado.");
  }

  return payload;
}
