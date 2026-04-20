const express = require("express");
const path = require("path");
const crypto = require("crypto");
const { MongoClient } = require("mongodb");
require("dotenv").config();

const app = express();
const port = Number(process.env.PORT || 3000);
const mongoUri = process.env.MONGODB_URI;
const databaseName = process.env.MONGODB_DB_NAME || "FirebaseProject";
const usersCollectionName = process.env.MONGODB_USERS_COLLECTION || "users";

if (!mongoUri) {
  throw new Error("MONGODB_URI nao definido no arquivo .env.");
}

const client = new MongoClient(mongoUri);
const sessions = new Map();

app.use(express.json());
app.use(express.static(__dirname));

function getUsersCollection() {
  return client.db(databaseName).collection(usersCollectionName);
}

function createPasswordHash(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

function verifyPassword(password, storedHash) {
  const [salt, currentHash] = String(storedHash || "").split(":");

  if (!salt || !currentHash) {
    return false;
  }

  const candidateHash = crypto.scryptSync(password, salt, 64);
  const savedHash = Buffer.from(currentHash, "hex");

  if (candidateHash.length !== savedHash.length) {
    return false;
  }

  return crypto.timingSafeEqual(candidateHash, savedHash);
}

function sanitizeUser(user) {
  if (!user) {
    return null;
  }

  const { passwordHash, _id, ...safeUser } = user;
  return safeUser;
}

function buildAdminPanel(users) {
  const adminUsers = users.filter((user) => user.profile?.role === "admin");
  const audit = {};

  adminUsers.forEach((user) => {
    audit[user.uid] = {
      email: user.profile?.email ?? user.email,
      grantedAt: user.adminAccess?.grantedAt ?? user.profile?.createdAt ?? new Date().toISOString(),
      note: user.adminAccess?.note ?? "Admin autorizado na criacao da conta"
    };
  });

  return {
    dashboard: {
      title: "Painel exclusivo do administrador",
      lastReviewAt: new Date().toISOString(),
      totalUsers: users.length,
      totalAdmins: adminUsers.length
    },
    audit
  };
}

async function authMiddleware(request, response, next) {
  const token = request.headers.authorization?.replace("Bearer ", "").trim();

  if (!token || !sessions.has(token)) {
    response.status(401).json({ message: "Sessao invalida ou expirada." });
    return;
  }

  const session = sessions.get(token);
  const user = await getUsersCollection().findOne({ uid: session.uid });

  if (!user) {
    sessions.delete(token);
    response.status(401).json({ message: "Usuario da sessao nao encontrado." });
    return;
  }

  request.sessionToken = token;
  request.user = user;
  next();
}

function requireAdmin(request, response, next) {
  if (request.user?.profile?.role !== "admin") {
    response.status(403).json({ message: "Acesso restrito a administradores." });
    return;
  }

  next();
}

app.get("/api/health", (_request, response) => {
  response.json({ ok: true });
});

app.get("/api/session", authMiddleware, (request, response) => {
  response.json({ user: sanitizeUser(request.user) });
});

app.post("/api/auth/signup", async (request, response) => {
  const email = String(request.body?.email || "").trim().toLowerCase();
  const password = String(request.body?.password || "").trim();
  const role = request.body?.role === "admin" ? "admin" : "user";

  if (!email || !password) {
    response.status(400).json({ message: "Preencha e-mail e senha." });
    return;
  }

  if (password.length < 6) {
    response.status(400).json({ message: "Use pelo menos 6 caracteres na senha." });
    return;
  }

  const existingUser = await getUsersCollection().findOne({ email });

  if (existingUser) {
    response.status(409).json({ message: "Este e-mail ja esta em uso." });
    return;
  }

  const now = new Date().toISOString();
  const uid = crypto.randomUUID();
  const user = {
    uid,
    email,
    passwordHash: createPasswordHash(password),
    profile: {
      email,
      role,
      createdAt: now
    },
    private: {
      lastLoginAt: now,
      welcomeMessage: role === "admin"
        ? "Conta admin criada para demonstracao."
        : "Conta user criada para demonstracao."
    },
    adminAccess: role === "admin"
      ? {
          grantedAt: now,
          note: "Admin autorizado na criacao da conta"
        }
      : null
  };

  await getUsersCollection().insertOne(user);

  const token = crypto.randomUUID();
  sessions.set(token, { uid });

  response.status(201).json({
    token,
    user: sanitizeUser(user)
  });
});

app.post("/api/auth/login", async (request, response) => {
  const email = String(request.body?.email || "").trim().toLowerCase();
  const password = String(request.body?.password || "").trim();

  if (!email || !password) {
    response.status(400).json({ message: "Preencha e-mail e senha." });
    return;
  }

  const user = await getUsersCollection().findOne({ email });

  if (!user || !verifyPassword(password, user.passwordHash)) {
    response.status(401).json({ message: "Credenciais invalidas." });
    return;
  }

  const lastLoginAt = new Date().toISOString();
  await getUsersCollection().updateOne(
    { uid: user.uid },
    { $set: { "private.lastLoginAt": lastLoginAt } }
  );

  const updatedUser = {
    ...user,
    private: {
      ...user.private,
      lastLoginAt
    }
  };

  const token = crypto.randomUUID();
  sessions.set(token, { uid: user.uid });

  response.json({
    token,
    user: sanitizeUser(updatedUser)
  });
});

app.post("/api/auth/logout", authMiddleware, (request, response) => {
  sessions.delete(request.sessionToken);
  response.json({ ok: true });
});

app.get("/api/users/me", authMiddleware, (request, response) => {
  response.json({ data: sanitizeUser(request.user) });
});

app.get("/api/users", authMiddleware, requireAdmin, async (_request, response) => {
  const users = await getUsersCollection().find({}, { sort: { "profile.createdAt": 1 } }).toArray();
  response.json({ data: users.map(sanitizeUser) });
});

app.get("/api/admin-data", authMiddleware, requireAdmin, async (_request, response) => {
  const users = await getUsersCollection().find({}).toArray();
  response.json({ data: buildAdminPanel(users.map(sanitizeUser)) });
});

app.use((_request, response) => {
  response.sendFile(path.join(__dirname, "index.html"));
});

async function start() {
  await client.connect();
  await getUsersCollection().createIndex({ email: 1 }, { unique: true });
  await getUsersCollection().createIndex({ uid: 1 }, { unique: true });

  app.listen(port, () => {
    console.log(`Servidor em http://localhost:${port}`);
  });
}

start().catch((error) => {
  console.error("Falha ao iniciar a aplicacao:", error);
  process.exit(1);
});
