const { app, BrowserWindow, ipcMain, powerMonitor, shell, Tray, Menu } = require('electron');
const path = require('path');

// --- CONFIGURATION ---
const DEFAULT_API_BASE = "https://teampulse-api-backend-prod.azurewebsites.net/api";
const WEB_APP_URL = "https://teampulse-app.vercel.app";

let mainWindow;
let tray = null;
let currentUser = null;
let heartbeatInterval;
let isQuitting = false;
let currentApiBase = normalizeApiBase(process.env.TEAMPULSE_API_BASE);

function normalizeApiBase(apiBase) {
  return (apiBase || DEFAULT_API_BASE).trim().replace(/\/$/, '');
}

async function postJson(apiBase, endpoint, payload) {
  const baseUrl = normalizeApiBase(apiBase);
  const response = await fetch(`${baseUrl}${endpoint}`, {
    method: 'POST',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  const text = await response.text();
  let data = {};

  if (text) {
    try {
      data = JSON.parse(text);
    } catch (error) {
      throw new Error(`Server returned invalid JSON (${response.status})`);
    }
  }

  if (!response.ok) {
    throw new Error(data.message || `Server returned status ${response.status}`);
  }

  return data;
}

function getConnectionErrorMessage(error) {
  if (error.cause && error.cause.code === 'ENOTFOUND') {
    return 'TeamPulse server address was not found. Please try again later.';
  }

  return 'Cannot connect to TeamPulse server. Please try again later.';
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 430, height: 650,
    icon: path.join(__dirname, 'icon.png'),
    webPreferences: { nodeIntegration: true, contextIsolation: false },
    autoHideMenuBar: true, resizable: false
  });
  mainWindow.loadFile('index.html');
  mainWindow.on('close', (e) => { if (!isQuitting) { e.preventDefault(); mainWindow.hide(); } });
}

function createTray() {
  tray = new Tray(path.join(__dirname, 'icon.png'));
  const contextMenu = Menu.buildFromTemplate([
    { label: 'Open Tracker', click: () => mainWindow.show() },
    { type: 'separator' },
    { label: 'Exit', click: () => { isQuitting = true; app.quit(); } }
  ]);
  tray.setContextMenu(contextMenu);
}

// --- AZURE LOGIN ---
ipcMain.on('login-attempt', async (event, { u, p }) => {
  const loginApiBase = currentApiBase;

  try {
    const result = await postJson(loginApiBase, '/login', { username: u, password: p });

    if (result.success) {
      currentApiBase = loginApiBase;
      currentUser = result.user;
      event.reply('login-success', currentUser.fullname);
      startHeartbeat();
      // Auto-login to web app using the session token
      shell.openExternal(`${WEB_APP_URL}/login?token=${currentUser.sessionToken}`);
      setTimeout(() => mainWindow.hide(), 1500);
    } else {
      event.reply('login-fail', result.message || 'Invalid username or password');
    }
  } catch (e) {
    console.error(`Login failed for API ${loginApiBase}:`, e);
    event.reply('login-fail', getConnectionErrorMessage(e));
  }
});

// --- TRACKING HEARTBEAT ---
function startHeartbeat() {
  if (heartbeatInterval) clearInterval(heartbeatInterval);
  
  heartbeatInterval = setInterval(async () => {
    if (!currentUser) return;

    const idleSeconds = powerMonitor.getSystemIdleTime();
    const status = idleSeconds > 60 ? 'Idle' : 'Online';

    try {
      await postJson(currentApiBase, '/updateStatus', { userId: currentUser.id, status: status });
    } catch (e) { console.log("Heartbeat failed", e); }
  }, 30000); // Check every 30 seconds
}

app.whenReady().then(() => { createWindow(); createTray(); });
