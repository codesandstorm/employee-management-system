import { Server as SocketServer } from 'socket.io';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { db } from './db';

// Productivity Categorization Helper
const categorizeApp = (appName: string, windowTitle: string = ''): 'Productive' | 'Unproductive' | 'Neutral' => {
  const name = appName.toLowerCase();
  const title = windowTitle.toLowerCase();
  
  const productive = [
    'code', 'visual studio', 'word', 'excel', 'powerpoint', 'slack', 'teams', 'antigravity', 'zoom', 'figma', 'notion', 'trello', 'jira', 'postman',
    'github', 'gitlab', 'stackoverflow', 'stack overflow', 'google meet', 'meet.google', 'google doc', 'google sheet', 'localhost', 'docs.', 'developer', 'mdn', 'w3schools', 'bitbucket', 'copilot', 'chatgpt', 'claude', 'gemini'
  ];
  
  const unproductive = [
    'spotify', 'netflix', 'steam', 'game', 'discord', 'whatsapp', 'facebook', 'instagram', 'twitter', 'x.com', 'reddit', 'youtube', 'twitch', 'prime video', 'disney', 'pinterest', 'tiktok'
  ];
  
  if (unproductive.some(u => name.includes(u) || title.includes(u))) return 'Unproductive';
  if (productive.some(p => name.includes(p) || title.includes(p))) return 'Productive';
  return 'Neutral';
};

const getCleanAppName = (appName: string, windowTitle: string = ''): string => {
  const appLower = appName.toLowerCase();
  const titleLower = windowTitle.toLowerCase();
  const browsers = ['chrome', 'brave', 'firefox', 'edge', 'safari', 'browser'];
  const isBrowser = browsers.some(b => appLower.includes(b));
  
  if (isBrowser) {
    if (titleLower.includes('github')) return `${appName} (GitHub)`;
    if (titleLower.includes('gitlab')) return `${appName} (GitLab)`;
    if (titleLower.includes('stackoverflow') || titleLower.includes('stack overflow')) return `${appName} (Stack Overflow)`;
    if (titleLower.includes('youtube')) return `${appName} (YouTube)`;
    if (titleLower.includes('netflix')) return `${appName} (Netflix)`;
    if (titleLower.includes('slack')) return `${appName} (Slack)`;
    if (titleLower.includes('meet.google') || titleLower.includes('google meet')) return `${appName} (Google Meet)`;
    if (titleLower.includes('chatgpt')) return `${appName} (ChatGPT)`;
    if (titleLower.includes('claude')) return `${appName} (Claude)`;
    if (titleLower.includes('gemini')) return `${appName} (Gemini)`;
    if (titleLower.includes('figma')) return `${appName} (Figma)`;
    if (titleLower.includes('notion')) return `${appName} (Notion)`;
    if (titleLower.includes('localhost')) return `${appName} (Localhost Dev)`;
    return `${appName} (Web Browsing)`;
  }
  return appName;
};

export function setupSockets(server: http.Server) {
  const io = new SocketServer(server, {
    cors: {
      origin: "*",
      methods: ["GET", "POST", "PUT"]
    }
  });

  io.on('connection', (socket) => {
    console.log(`[Socket] Desktop agent/client connected: ${socket.id}`);

    socket.on('agent_connected', (data) => {
      console.log(`[Socket] Desktop Agent for Employee ${data.employeeId} connected.`);
    });

    socket.on('activity_log', async (data) => {
      const { employeeId, status, appName, windowTitle, timestamp } = data;
      console.log(`[Agent Log] ${employeeId} | Status: ${status} | App: ${appName} | Title: ${windowTitle || ''}`);

      try {
        // Find employee by code (like EMP-001)
        const employee = await db.getEmployeeByCode(employeeId);
        if (!employee) {
          console.warn(`[Socket Error] Employee with code ${employeeId} not found.`);
          return;
        }

        // Get today's attendance for the employee
        let attendance = await db.getAttendanceToday(employee.id);
        if (!attendance) {
          console.log(`[Socket] Employee ${employee.first_name} ${employee.last_name} not checked in. Performing auto-check-in...`);
          // Auto check-in the employee
          attendance = await db.checkIn(employee.id, 'Present', 'Auto-clocked in by Desktop Agent');
        }

        if (attendance.check_out) {
          console.warn(`[Socket] Employee ${employeeId} is already checked out today. Ignoring activity.`);
          return;
        }

        const windowLabel = appName && windowTitle ? `${appName} - ${windowTitle}` : (appName || windowTitle || 'Unknown App');

        // Add heartbeat
        const mappedStatus = status === 'Idle' ? 'Idle' : 'Active';
        await db.addHeartbeat(
          employee.id,
          attendance.id,
          mappedStatus,
          0, // mouse clicks (not tracked by Node agent)
          0, // keyboard presses (not tracked by Node agent)
          windowLabel,
          undefined, // no screenshot url in activity log
          timestamp
        );

      } catch (err: any) {
        console.error(`[Socket Error] Failed to process activity_log:`, err.message);
      }
    });

    socket.on('screenshot_upload', async (data) => {
      const { employeeId, timestamp, image } = data;
      console.log(`[Agent Upload] Screenshot received for ${employeeId} at ${timestamp}`);

      try {
        const employee = await db.getEmployeeByCode(employeeId);
        if (!employee) {
          console.warn(`[Socket Error] Employee with code ${employeeId} not found for screenshot upload.`);
          return;
        }

        let attendance = await db.getAttendanceToday(employee.id);
        if (!attendance) {
          console.log(`[Socket] Employee ${employee.first_name} ${employee.last_name} not checked in. Performing auto-check-in for screenshot...`);
          attendance = await db.checkIn(employee.id, 'Present', 'Auto-clocked in by Desktop Agent (Visual)');
        }

        if (attendance.check_out) {
          console.warn(`[Socket] Employee ${employeeId} is already checked out today. Ignoring screenshot.`);
          return;
        }

        const base64Data = image.replace(/^data:image\/jpeg;base64,/, "");
        const fileName = `screenshot_${employee.id}_${Date.now()}.jpg`;

        const uploadsDir = path.resolve(__dirname, '../../uploads');
        if (!fs.existsSync(uploadsDir)) {
          fs.mkdirSync(uploadsDir, { recursive: true });
        }

        fs.writeFile(path.join(uploadsDir, fileName), base64Data, 'base64', async (err) => {
          if (err) {
            console.error('Error saving screenshot file:', err);
            return;
          }

          const screenshotUrl = `http://localhost:5000/uploads/${fileName}`;

          try {
            // Save heartbeat with screenshot URL
            await db.addHeartbeat(
              employee.id,
              attendance.id,
              'Active',
              0,
              0,
              undefined,
              screenshotUrl,
              timestamp
            );
            console.log(`[Socket] Screenshot successfully recorded for ${employee.first_name} ${employee.last_name}`);
          } catch (dbErr: any) {
            console.error('[Socket Error] Database error saving screenshot heartbeat:', dbErr.message);
          }
        });

      } catch (err: any) {
        console.error(`[Socket Error] Failed to process screenshot_upload:`, err.message);
      }
    });

    socket.on('disconnect', () => {
      console.log(`[Socket] Client disconnected: ${socket.id}`);
    });
  });

  return io;
}
