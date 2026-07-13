const { contextBridge } = require('electron');

contextBridge.exposeInMainWorld('attendanceDesktop', {
  isDesktopApp: true,
});