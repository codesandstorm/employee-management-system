require('dotenv').config();
const { io } = require('socket.io-client');
const screenshot = require('screenshot-desktop');
const activeWin = require('active-win');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

// Configuration
const SERVER_URL = process.env.SERVER_URL || 'http://localhost:5000';
const SCREENSHOT_INTERVAL = 30000;
const ACTIVITY_INTERVAL = 10000;

let EMPLOYEE_ID = '';
const CONFIG_FILE = path.join(__dirname, 'agent_config.json');

// --- AUTHENTICATION ---
const getEmployeeId = () => {
  return new Promise((resolve) => {
    if (fs.existsSync(CONFIG_FILE)) {
      const config = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
      if (config.employeeId) {
        EMPLOYEE_ID = config.employeeId;
        return resolve();
      }
    }

    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    console.log('\n=========================================');
    console.log('   EmpMonitor Desktop Agent Setup');
    console.log('=========================================\n');
    rl.question('Please enter your unique Employee ID to begin tracking: ', (answer) => {
      EMPLOYEE_ID = answer.trim() || 'EMP-001';
      fs.writeFileSync(CONFIG_FILE, JSON.stringify({ employeeId: EMPLOYEE_ID }));
      console.log(`\nSuccessfully authenticated as ${EMPLOYEE_ID}.\n`);
      rl.close();
      resolve();
    });
  });
};

const OFFLINE_QUEUE_FILE = path.join(__dirname, 'offline_sync_queue.json');

// --- OFFLINE QUEUE MANAGER ---
const saveToQueue = (eventType, payload) => {
  let queue = [];
  if (fs.existsSync(OFFLINE_QUEUE_FILE)) {
    try {
      queue = JSON.parse(fs.readFileSync(OFFLINE_QUEUE_FILE, 'utf8'));
    } catch (e) { queue = []; }
  }
  queue.push({ eventType, payload });
  fs.writeFileSync(OFFLINE_QUEUE_FILE, JSON.stringify(queue));
  console.log(`[Offline] Saved ${eventType} to local queue. Pending: ${queue.length}`);
};

const syncOfflineQueue = (socket) => {
  if (fs.existsSync(OFFLINE_QUEUE_FILE)) {
    try {
      const queue = JSON.parse(fs.readFileSync(OFFLINE_QUEUE_FILE, 'utf8'));
      if (queue.length > 0) {
        console.log(`[Sync] Internet restored. Bulk uploading ${queue.length} items...`);
        queue.forEach(item => {
          socket.emit(item.eventType, item.payload);
        });
        fs.unlinkSync(OFFLINE_QUEUE_FILE);
        console.log('[Sync] Complete.');
      }
    } catch (e) { console.error('Error syncing offline queue:', e.message); }
  }
};

// Start Agent Function
const startAgent = () => {
  const socket = io(SERVER_URL);

  let isIdle = false;
  let lastActiveTitle = '';
  let idleCounter = 0;

  console.log('--- Desktop Tracking Agent Started ---');

  socket.on('connect', () => {
    console.log(`Connected to backend server as ${socket.id}`);
    
    // Emit initial login status
    socket.emit('agent_connected', { employeeId: EMPLOYEE_ID });

    // Sync any offline data
    syncOfflineQueue(socket);
  });

// --- TRACKING FUNCTIONS ---

let schedule = null;

// Fetch Schedule
const fetchSchedule = async () => {
  try {
    const res = await fetch(`${SERVER_URL}/api/schedule`);
    if (res.ok) {
      schedule = await res.json();
    }
  } catch (err) {
    console.error('Could not fetch schedule, defaulting to dormant.');
  }
};

const isWithinSchedule = () => {
  if (!schedule) return true;
  const now = new Date();
  const currentHour = now.getHours();
  const currentMinute = now.getMinutes();

  const isAfterStart = currentHour > schedule.startHour || (currentHour === schedule.startHour && currentMinute >= schedule.startMinute);
  const isBeforeEnd = currentHour < schedule.endHour || (currentHour === schedule.endHour && currentMinute < schedule.endMinute);

  return isAfterStart && isBeforeEnd;
};

// 1. Application & Tab Tracking
const trackActivity = async () => {
  if (!isWithinSchedule()) return;

  try {
    const win = await activeWin();
    if (!win) return;

    if (win.title !== lastActiveTitle) {
      isIdle = false;
      idleCounter = 0;
      lastActiveTitle = win.title;
    } else {
      idleCounter += 1;
      if (idleCounter >= 3) isIdle = true;
    }

    const activityData = {
      employeeId: EMPLOYEE_ID,
      timestamp: new Date().toISOString(),
      appName: win.owner.name,
      windowTitle: win.title,
      status: isIdle ? 'Idle' : 'Active'
    };

    if (socket.connected) {
      console.log(`[Activity] Status: ${activityData.status} | App: ${activityData.appName}`);
      socket.emit('activity_log', activityData);
    } else {
      saveToQueue('activity_log', activityData);
    }

  } catch (err) {
    console.error('Error getting active window:', err.message);
  }
};

// 2. Visual Tracking (Screenshots)
const takeScreenshot = async () => {
  if (!isWithinSchedule()) return;

  try {
    const tempPath = path.join(__dirname, 'temp_screenshot.jpg');
    await screenshot({ filename: tempPath, format: 'jpg' });
    console.log(`[Visual] Captured screenshot at ${new Date().toLocaleTimeString()}`);
    
    const bitmap = fs.readFileSync(tempPath);
    const base64Str = Buffer.from(bitmap).toString('base64');
    
    const screenshotData = {
      employeeId: EMPLOYEE_ID,
      timestamp: new Date().toISOString(),
      image: `data:image/jpeg;base64,${base64Str}`
    };

    if (socket.connected) {
      socket.emit('screenshot_upload', screenshotData);
    } else {
      saveToQueue('screenshot_upload', screenshotData);
    }

    fs.unlinkSync(tempPath);
  } catch (err) {
    console.error('Error taking screenshot:', err.message);
  }
};

  // --- START INTERVALS ---
  // Fetch schedule every minute
  setInterval(fetchSchedule, 60000);
  fetchSchedule().then(() => {
    setInterval(trackActivity, ACTIVITY_INTERVAL);
    setInterval(takeScreenshot, SCREENSHOT_INTERVAL);
  });

  // Initial immediate runs
  trackActivity();
};

// --- PROCESS ARCHITECTURE ---
const { spawn } = require('child_process');
const args = process.argv.slice(2);

if (args.includes('--watchdog')) {
  // WATCHDOG SUPERVISOR
  console.log('[Watchdog] Supervisor started.');
  const runWorker = () => {
    if (fs.existsSync(path.join(__dirname, 'stop_tracker.txt'))) {
      console.log('[Watchdog] Kill switch (stop_tracker.txt) detected. Terminating stealth service.');
      process.exit(0);
    }
    
    // Check again every 5 seconds for kill switch
    const killCheck = setInterval(() => {
      if (fs.existsSync(path.join(__dirname, 'stop_tracker.txt'))) {
        process.exit(0);
      }
    }, 5000);

    const worker = spawn(process.execPath, [process.argv[1], '--worker'], { stdio: 'inherit' });
    
    worker.on('close', () => {
      clearInterval(killCheck);
      if (!fs.existsSync(path.join(__dirname, 'stop_tracker.txt'))) {
        console.log('[Watchdog] Worker unexpectedly closed. Restarting...');
        setTimeout(runWorker, 1000);
      } else {
        process.exit(0);
      }
    });
  };
  runWorker();

} else if (args.includes('--worker')) {
  // WORKER PROCESS
  getEmployeeId().then(() => {
    startAgent();
  });

} else {
  // DEFAULT LAUNCHER
  getEmployeeId().then(() => {
    console.log('\nAuthenticating and hiding process...');
    console.log('The tracker will now run securely in the background.');
    
    // Spawn the watchdog completely detached
    const watchdog = spawn(process.execPath, [process.argv[1], '--watchdog'], {
      detached: true,
      stdio: 'ignore'
    });
    
    watchdog.unref(); // Allow the parent launcher to exit independently
    
    setTimeout(() => {
      process.exit(0);
    }, 2000);
  });
}
