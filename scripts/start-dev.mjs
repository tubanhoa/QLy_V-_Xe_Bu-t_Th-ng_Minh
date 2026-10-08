#!/usr/bin/env node
import { spawn, execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const backendDir = path.resolve(rootDir, 'backend');

const isWin = process.platform === 'win32';
const npmCmd = isWin ? 'npm.cmd' : 'npm';

// Kích hoạt bảng mã UTF-8 (Code Page 65001) trên Windows console để hiển thị tiếng Việt chuẩn
if (isWin) {
  try {
    execSync('chcp 65001', { stdio: 'ignore' });
  } catch {}
}

console.log('\x1b[36m%s\x1b[0m', '==========================================================');
console.log('\x1b[32m%s\x1b[0m', ' [SYSTEM] SMART BUS TICKETING SYSTEM - ICTU');
console.log('\x1b[33m%s\x1b[0m', ' [START]  Khoi dong song song Backend + Frontend (Port 3000 & 3001)');
console.log('\x1b[36m%s\x1b[0m', '==========================================================');
console.log('\x1b[90m%s\x1b[0m', ' - Frontend Web:    http://localhost:3000');
console.log('\x1b[90m%s\x1b[0m', ' - Bang Dieu Hanh:  http://localhost:3000/dashboard');
console.log('\x1b[90m%s\x1b[0m', ' - Backend API:     http://localhost:3001/api/v1');
console.log('\x1b[90m%s\x1b[0m', ' - Swagger API:     http://localhost:3001/api/docs\n');

const devEnv = {
  ...process.env,
  FORCE_COLOR: '1',
  LANG: 'en_US.UTF-8',
  LC_ALL: 'en_US.UTF-8',
};

// 1. Khởi động Backend (NestJS)
const backend = spawn(npmCmd, ['run', 'start:dev'], {
  cwd: backendDir,
  stdio: 'pipe',
  shell: true,
  env: devEnv,
});

backend.stdout.on('data', (data) => {
  const lines = data.toString().split('\n');
  for (const line of lines) {
    if (line.trim()) {
      console.log(`\x1b[32m[BACKEND 3001]\x1b[0m ${line}`);
    }
  }
});

backend.stderr.on('data', (data) => {
  const lines = data.toString().split('\n');
  for (const line of lines) {
    if (line.trim()) {
      console.log(`\x1b[31m[BACKEND ERR]\x1b[0m ${line}`);
    }
  }
});

// 2. Khởi động Frontend (Next.js)
const frontend = spawn(npmCmd, ['run', 'dev'], {
  cwd: rootDir,
  stdio: 'pipe',
  shell: true,
  env: devEnv,
});

frontend.stdout.on('data', (data) => {
  const lines = data.toString().split('\n');
  for (const line of lines) {
    if (line.trim()) {
      console.log(`\x1b[36m[FRONTEND 3000]\x1b[0m ${line}`);
    }
  }
});

frontend.stderr.on('data', (data) => {
  const lines = data.toString().split('\n');
  for (const line of lines) {
    if (line.trim()) {
      console.log(`\x1b[33m[FRONTEND WARN]\x1b[0m ${line}`);
    }
  }
});

// Xử lý dọn dẹp khi người dùng bấm Ctrl+C
function cleanup() {
  console.log('\n\x1b[33m%s\x1b[0m', ' Đang dừng toàn bộ dịch vụ an toàn...');
  try {
    if (isWin) {
      if (backend.pid) spawn('taskkill', ['/pid', String(backend.pid), '/f', '/t']);
      if (frontend.pid) spawn('taskkill', ['/pid', String(frontend.pid), '/f', '/t']);
    } else {
      backend.kill('SIGINT');
      frontend.kill('SIGINT');
    }
  } catch {}
  process.exit(0);
}

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);
process.on('exit', cleanup);
