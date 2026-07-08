const { app, BrowserWindow, ipcMain, powerMonitor, shell, Tray, Menu, dialog } = require('electron');
const path = require('path');

// --- CONFIGURATION ---
const API_BASE = "https://teampulse-api-backend-prod.azurewebsites.net/api"; 
const WEB_APP_URL = "https://teampulse-app.vercel.app";

let mainWindow;
let tray = null;
let currentUser = null;
let heartbeatInterval;
let isQuitting = false;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 400, height: 600,
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
  try {
    const response = await fetch(`${API_BASE}/login`, {
      method: 'POST',
      body: JSON.stringify({ username: u, password: p })
    });
    const result = await response.json();

    if (result.success) {
      currentUser = result.user;
      event.reply('login-success', currentUser.fullname);
      startHeartbeat();
      // Auto-login to web app using the session token
      shell.openExternal(`${WEB_APP_URL}/login?token=${currentUser.sessionToken}`);
      setTimeout(() => mainWindow.hide(), 1500);
    } else {
      event.reply('login-fail', result.message);
    }
  } catch (e) {
    event.reply('login-fail', 'Server Connection Failed');
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
      await fetch(`${API_BASE}/updateStatus`, {
        method: 'POST',
        body: JSON.stringify({ userId: currentUser.id, status: status })
      });
    } catch (e) { console.log("Heartbeat failed"); }
  }, 30000); // Check every 30 seconds
}

app.whenReady().then(() => { createWindow(); createTray(); });