// 数据库初始化（文件系统版本）
import fs from 'fs'
import path from 'path'

// 确保数据目录存在
const dataDir = path.join(process.cwd(), 'data')
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true })
}

// 数据文件路径
const tasksFile = path.join(dataDir, 'tasks.json')
const keysFile = path.join(dataDir, 'keys.jsonl')
const legacyKeysFile = path.join(dataDir, 'keys.json')

// 把旧的 keys.json（数组格式）迁移为 keys.jsonl（每行一条）
function migrateLegacyKeys() {
  if (!fs.existsSync(legacyKeysFile)) return

  try {
    const raw = fs.readFileSync(legacyKeysFile, 'utf8')
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return

    const lines = parsed
      .map((k) => JSON.stringify(k))
      .filter(Boolean)
      .join('\n')

    fs.writeFileSync(keysFile, lines ? lines + '\n' : '')
    fs.unlinkSync(legacyKeysFile)
    console.log(`Migrated ${parsed.length} keys from keys.json to keys.jsonl`)
  } catch (error) {
    console.error('Failed to migrate legacy keys.json:', error)
  }
}

// 初始化数据文件
export function initDatabase() {
  // 初始化任务文件
  if (!fs.existsSync(tasksFile)) {
    fs.writeFileSync(tasksFile, JSON.stringify([]))
    console.log('Tasks file initialized:', tasksFile)
  }

  // 初始化密钥文件（先迁移旧格式）
  migrateLegacyKeys()
  if (!fs.existsSync(keysFile)) {
    fs.writeFileSync(keysFile, '')
  }
  console.log('Keys file initialized:', keysFile)

  console.log('Database initialized successfully (file system version)')
}

// 导出空对象，保持接口兼容
export const db = {}