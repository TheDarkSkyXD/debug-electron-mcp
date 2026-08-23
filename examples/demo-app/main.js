const { app, BrowserWindow } = require('electron');
const path = require('path');

// Enable Chrome DevTools Protocol for MCP Server
const isDev =
  process.env.NODE_ENV === 'development' || process.argv.includes('--dev');

if (isDev) {
  const debugPort = process.env.ELECTRON_DEBUG_PORT || '9222';
  const parsedPort = Number(debugPort);
  if (!Number.isInteger(parsedPort) || parsedPort < 1024 || parsedPort > 65535) {
    throw new Error('ELECTRON_DEBUG_PORT must be an integer from 1024 through 65535.');
  }
  app.commandLine.appendSwitch('remote-debugging-port', debugPort);
  console.log(`🔧 Chrome DevTools Protocol enabled on port ${debugPort}`);
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1000,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
    title: 'MCP Demo App',
  });

  win.loadFile('index.html');

  if (isDev) {
    win.webContents.openDevTools();
  }

  win.on('closed', () => {
    console.log('Window closed');
  });
}

app.whenReady().then(() => {
  console.log('🚀 MCP Demo App starting...');
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
