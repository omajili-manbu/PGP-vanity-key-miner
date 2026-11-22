// 基于文件系统的存储方案
// - 密钥使用 JSONL 追加写入（每次匹配只 append 一行，不重写整个文件）
// - 任务使用 JSON（数量少，整体重写无压力）
import fs from 'fs'
import path from 'path'
import type { MiningTask, SpecialKey, PatternConfig } from '../pgp/types'

// 确保数据目录存在
const dataDir = path.join(process.cwd(), 'data')
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true })
}

// 数据文件路径
const tasksFile = path.join(dataDir, 'tasks.json')
const keysFile = path.join(dataDir, 'keys.jsonl')
// 私钥单独存放，便于批量导出，也避免每次读 keys.jsonl 都把私钥拉进内存
const privateKeysFile = path.join(dataDir, 'private-keys.jsonl')

// 初始化数据文件
function initDataFiles() {
  if (!fs.existsSync(tasksFile)) {
    fs.writeFileSync(tasksFile, JSON.stringify([]))
  }
  if (!fs.existsSync(keysFile)) {
    fs.writeFileSync(keysFile, '')
  }
  if (!fs.existsSync(privateKeysFile)) {
    fs.writeFileSync(privateKeysFile, '')
  }
}

// 读取数据
function readData<T>(filePath: string): T[] {
  try {
    const data = fs.readFileSync(filePath, 'utf8')
    return JSON.parse(data)
  } catch (error) {
    console.error('Error reading data file:', error)
    return []
  }
}

// 写入数据
function writeData<T>(filePath: string, data: T[]) {
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2))
  } catch (error) {
    console.error('Error writing data file:', error)
  }
}

// 读取 JSONL 密钥（逐行解析，跳过损坏行）
function readKeys(): SpecialKey[] {
  try {
    if (!fs.existsSync(keysFile)) return []
    const content = fs.readFileSync(keysFile, 'utf8')
    const keys: SpecialKey[] = []
    for (const line of content.split('\n')) {
      const trimmed = line.trim()
      if (!trimmed) continue
      try {
        keys.push(JSON.parse(trimmed) as SpecialKey)
      } catch {
        // 跳过损坏行（例如进程被强杀时写了一半）
      }
    }
    return keys
  } catch (error) {
    console.error('Error reading keys file:', error)
    return []
  }
}

// ========== 私钥存储 ==========
// 本机运行场景：私钥持久化保存，方便随时下载和批量导出。
// 单独放在 private-keys.jsonl，避免读取密钥列表时把私钥全部拉进内存。

export interface StoredPrivateKey {
  keyId: string;
  fingerprint: string;
  privateKeyArmored: string;
  publicKeyArmored: string;
  createdAt: string;
  taskId?: string;
}

// 读取全部私钥
export function getPrivateKeys(): StoredPrivateKey[] {
  initDataFiles()
  flushPendingPrivate()
  try {
    if (!fs.existsSync(privateKeysFile)) return []
    const content = fs.readFileSync(privateKeysFile, 'utf8')
    const out: StoredPrivateKey[] = []
    for (const line of content.split('\n')) {
      const trimmed = line.trim()
      if (!trimmed) continue
      try {
        out.push(JSON.parse(trimmed) as StoredPrivateKey)
      } catch {
        // 跳过损坏行
      }
    }
    return out
  } catch (error) {
    console.error('Error reading private keys file:', error)
    return []
  }
}

// 按 keyId 查私钥
export function getPrivateKey(keyId: string): StoredPrivateKey | null {
  const normalized = keyId.trim().toLowerCase()
  return getPrivateKeys().find(k => k.keyId === normalized) || null
}

// 追加一条私钥（同上，异步批量写）
export function savePrivateKey(entry: StoredPrivateKey) {
  initDataFiles()
  pendingPrivateKeys.push(entry)
  scheduleFlushPrivate()
}

// 任务相关操作
export function createTask(task: Omit<MiningTask, 'id' | 'startedAt' | 'totalAttempts' | 'matchesFound'> & { id: string }) {
  initDataFiles()

  const tasks = readData<MiningTask>(tasksFile)
  const newTask: MiningTask = {
    ...task,
    startedAt: new Date(),
    totalAttempts: 0,
    matchesFound: 0,
  }

  tasks.push(newTask)
  writeData(tasksFile, tasks)
}

export function updateTaskProgress(taskId: string, attempts: number, matchesFound: number) {
  initDataFiles()

  const tasks = readData<MiningTask>(tasksFile)
  const taskIndex = tasks.findIndex(t => t.id === taskId)

  if (taskIndex !== -1) {
    tasks[taskIndex].totalAttempts = attempts
    tasks[taskIndex].matchesFound = matchesFound
    writeData(tasksFile, tasks)
  }
}

export function stopTask(taskId: string) {
  initDataFiles()

  const tasks = readData<MiningTask>(tasksFile)
  const taskIndex = tasks.findIndex(t => t.id === taskId)

  if (taskIndex !== -1) {
    tasks[taskIndex].status = 'stopped'
    tasks[taskIndex].stoppedAt = new Date()
    writeData(tasksFile, tasks)
  }
}

export function getTask(taskId: string): MiningTask | null {
  initDataFiles()

  const tasks = readData<MiningTask>(tasksFile)
  const task = tasks.find(t => t.id === taskId)
  return task || null
}

// 追加一条密钥（异步写入，不阻塞事件循环）
// 高频命中时同步写盘会把 Next 的事件循环堵死，导致 SSE 无法推送。
export function createSpecialKey(key: SpecialKey) {
  initDataFiles()
  pendingKeys.push(key)
  scheduleFlush()
}

// 待写入队列 + 批量刷盘
let pendingKeys: SpecialKey[] = [];
let flushScheduled = false;
let flushTimer: ReturnType<typeof setTimeout> | null = null;

function scheduleFlush() {
  if (flushScheduled) return
  flushScheduled = true
  flushTimer = setTimeout(flushKeys, 200)
  if (typeof flushTimer.unref === 'function') flushTimer.unref()
}

function flushKeys() {
  flushScheduled = false
  if (pendingKeys.length === 0) return
  const batch = pendingKeys
  pendingKeys = []
  try {
    fs.appendFileSync(keysFile, batch.map(k => JSON.stringify(k)).join('\n') + '\n')
  } catch (error) {
    console.error('Error flushing keys:', error)
  }
}

// 读取前强制刷盘，保证读到最新数据
function flushPendingKeys() {
  if (pendingKeys.length === 0) return
  flushKeys()
}

let pendingPrivateKeys: StoredPrivateKey[] = [];
let flushPrivateScheduled = false;

function scheduleFlushPrivate() {
  if (flushPrivateScheduled) return
  flushPrivateScheduled = true
  const t = setTimeout(() => {
    flushPrivateScheduled = false
    if (pendingPrivateKeys.length === 0) return
    const batch = pendingPrivateKeys
    pendingPrivateKeys = []
    try {
      fs.appendFileSync(privateKeysFile, batch.map(k => JSON.stringify(k)).join('\n') + '\n')
    } catch (error) {
      console.error('Error flushing private keys:', error)
    }
  }, 200)
  if (typeof t.unref === 'function') t.unref()
}

// 读取前强制刷盘
function flushPendingPrivate() {
  if (pendingPrivateKeys.length === 0) return
  flushPrivateScheduled = false
  const batch = pendingPrivateKeys
  pendingPrivateKeys = []
  try {
    fs.appendFileSync(privateKeysFile, batch.map(k => JSON.stringify(k)).join('\n') + '\n')
  } catch (error) {
    console.error('Error flushing private keys:', error)
  }
}

export function getKeys(page: number = 1, pageSize: number = 10): { keys: SpecialKey[]; total: number } {
  initDataFiles()
  flushPendingKeys()
  const allKeys = readKeys()
  const total = allKeys.length

  // 按创建时间降序排序
  const sortedKeys = allKeys.sort((a, b) => {
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  })

  // 分页
  const start = (page - 1) * pageSize
  const end = start + pageSize
  const keys = sortedKeys.slice(start, end)

  return { keys, total }
}
