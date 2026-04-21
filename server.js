const express = require("express");
const path = require("path");
require("dotenv").config();

const app = express();
const port = Number(process.env.PORT || 3000);

const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY || "",
  authDomain: process.env.FIREBASE_AUTH_DOMAIN || "",
  databaseURL: process.env.FIREBASE_DATABASE_URL || "",
  projectId: process.env.FIREBASE_PROJECT_ID || "",
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET || "",
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID || "",
  appId: process.env.FIREBASE_APP_ID || ""
};

app.use(express.static(__dirname));

app.get("/firebase-config.js", (_request, response) => {
  response.type("application/javascript");
  response.send(`window.__FIREBASE_CONFIG__ = ${JSON.stringify(firebaseConfig, null, 2)};`);
});

app.get("/api/health", (_request, response) => {
  const configured = Object.values(firebaseConfig).every((value) => value);
  response.json({
    ok: true,
    firebaseConfigured: configured
  });
});

app.use((_request, response) => {
  response.sendFile(path.join(__dirname, "index.html"));
});

app.listen(port, () => {
  console.log(`Servidor em http://localhost:${port}`);
});
