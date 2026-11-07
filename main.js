const { app, BrowserWindow, Menu, session, ipcMain, shell } = require('electron');
const path = require('path');
const { scanLibrary, isLibraryPath } = require('./library-catalog');

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 1100,
    minHeight: 720,
    title: 'Straight Bar',
    backgroundColor: '#14110e',
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 18, y: 18 },
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  const hash = process.env.STRAIGHT_BAR_HASH;
  win.loadFile(path.join(__dirname, 'src', 'index.html'), hash ? { hash } : undefined);

  if (process.env.STRAIGHT_BAR_SMOKE) {
    const errors = [];
    win.webContents.on('console-message', (event, level, message) => {
      const text = typeof event?.message === 'string' ? event.message : String(message ?? '');
      const lvl = event?.level ?? level;
      console.log('PAGE', text);
      if (lvl === 3 || lvl === 'error' || text.includes('Uncaught')) errors.push(text);
    });
    win.webContents.once('did-finish-load', async () => {
      try {
        const report = await win.webContents.executeJavaScript(`(async () => {
          const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
          const click = (sel) => document.querySelector(sel).click();
          click('[data-mode="sixths"]');
          await sleep(40);
          const scale = {
            title: document.querySelector('#inspector h1')?.textContent || '',
            caption: document.getElementById('caption')?.textContent || '',
            steps: document.querySelectorAll('[data-sixths="step"]').length,
            svg: Boolean(document.querySelector('#neck-mount svg .fb-note'))
          };
          click('[data-sixths="view"][data-view="chord"]');
          await sleep(30);
          const chord = document.querySelector('#inspector h1')?.textContent || '';
          click('[data-sixths="step"][data-index="5"]');
          await sleep(20);
          const f6 = document.querySelector('#inspector h1')?.textContent || '';
          click('[data-sixths="view"][data-view="quiz"]');
          await sleep(30);
          const quiz = document.getElementById('caption')?.textContent || '';
          click('[data-mode="lesson"]');
          await sleep(30);
          const lesson = document.querySelector('#inspector h1')?.textContent || '';
          return {
            scale, chord, f6, quiz, lesson,
            hasLessons: Boolean(document.querySelector('[data-mode="lesson"]')),
            hasPractice: Boolean(document.querySelector('[data-mode="practice"]')),
            hasTuner: Boolean(document.querySelector('[data-mode="tuner"]'))
          };
        })()`);
        console.log('SMOKE', JSON.stringify({ report, errors }));
      } catch (error) {
        console.log('SMOKE_ERR', error);
      }
      app.quit();
    });
  }
}

function installMenu() {
  const template = [
    {
      label: 'Straight Bar',
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' },
      ],
    },
    { role: 'editMenu' },
    { role: 'viewMenu' },
    { role: 'windowMenu' },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

function installLibraryBridge() {
  ipcMain.handle('library:list', () => scanLibrary().entries);
  ipcMain.handle('library:open', async (_event, filePath) => {
    if (!isLibraryPath(filePath)) return { error: 'That file is not in the library.' };
    const error = await shell.openPath(filePath);
    return error ? { error } : {};
  });
}

app.whenReady().then(() => {
  installMenu();
  installLibraryBridge();
  session.defaultSession.setPermissionRequestHandler((_contents, permission, callback) => {
    callback(permission === 'media');
  });
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
