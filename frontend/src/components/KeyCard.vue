<template>
  <div class="key-card" :style="{ borderColor: keyData.color }">
    <div class="key-header">
      <span class="pattern-badge" :style="{ backgroundColor: keyData.color + '20', color: keyData.color }">
        {{ keyData.patternType }}
      </span>
      <span class="match-text">{{ keyData.matchedText }}</span>
    </div>
    <div class="key-fingerprint">{{ keyData.fingerprint }}</div>
    <div class="key-keyid">
      <span class="keyid-label">Long Key ID</span>
      <code class="keyid-value">{{ keyData.keyId || '—' }}</code>
    </div>
    <div class="key-meta">
      <span>尝试次数: {{ keyData.attemptsToFind }}</span>
      <span>{{ formatDate(keyData.createdAt) }}</span>
    </div>
    <div class="key-actions">
      <button @click="copyFingerprint" class="ghost-btn action-btn" title="复制指纹">
        <Copy class="icon-sm" :size="11" />
        复制
      </button>
      <button
        @click="downloadPublicKey"
        class="ghost-btn action-btn"
        :disabled="downloading"
        title="下载公钥"
      >
        <Download class="icon-sm" :size="11" />
        公钥
      </button>
      <button
        @click="downloadPrivateKey"
        class="ghost-btn action-btn private-btn"
        :class="{ pending: downloading }"
        :disabled="downloading"
        title="下载私钥"
      >
        <KeyRound class="icon-sm" :size="11" />
        私钥
      </button>
      <button @click="showDetails" class="ghost-btn action-btn" title="查看详情">
        <Info class="icon-sm" :size="11" />
        详情
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { Copy, Download, Info, KeyRound } from 'lucide-vue-next'
import { useMinerStore } from '../stores/miner'
import type { SpecialKey } from '../types'

const props = defineProps<{
  keyData: SpecialKey
}>()

const minerStore = useMinerStore()
const showDetail = ref(false)
const downloading = ref(false)

function formatDate(dateStr: string): string {
  const date = new Date(dateStr)
  return date.toLocaleString('zh-CN')
}

function copyFingerprint() {
  navigator.clipboard.writeText(props.keyData.fingerprint)
    .then(() => {
      alert('指纹已复制到剪贴板')
    })
    .catch(err => {
      console.error('复制失败:', err)
      alert('复制失败')
    })
}

// 下载公钥（正文不在 SSE 里，用时从后端拉）
async function downloadPublicKey() {
  if (downloading.value) return

  let armored = props.keyData.publicKeyArmored
  if (!armored) {
    downloading.value = true
    try {
      armored = (await minerStore.fetchPublicKey(props.keyData.keyId)) || ''
    } finally {
      downloading.value = false
    }
  }

  if (!armored || armored.trim() === '') {
    alert('未找到公钥内容')
    return
  }
  if (!armored.includes('-----BEGIN PGP PUBLIC KEY BLOCK-----')) {
    alert('公钥格式不正确')
    return
  }

  downloadFile(
    armored,
    `pgp-public-${props.keyData.fingerprint}.asc`,
    'text/plain;charset=utf-8'
  )
}

// 下载私钥（向后端取，私钥持久化保存，可重复下载）
async function downloadPrivateKey() {
  if (downloading.value) return

  const keyId = props.keyData.keyId
  if (!keyId) {
    alert('该密钥没有长 Key ID，无法下载私钥')
    return
  }

  downloading.value = true
  try {
    const result = await minerStore.fetchPrivateKey(keyId)

    if (!result.ok) {
      alert('私钥下载失败：\n' + result.error)
      return
    }

    downloadFile(
      result.privateKey,
      `pgp-private-${result.fingerprint}.asc`,
      'application/pgp-keys'
    )
  } finally {
    downloading.value = false
  }
}

// 触发浏览器下载
function downloadFile(content: string, filename: string, mime: string) {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

function showDetails() {
  showDetail.value = !showDetail.value
  if (showDetail.value) {
    // 显示详细信息
    const details = `
指纹: ${props.keyData.fingerprint}
长 Key ID: ${props.keyData.keyId || '—'}  (规则匹配目标)
规则类型: ${props.keyData.patternType}
匹配文本: ${props.keyData.matchedText}
匹配位置: ${props.keyData.matchPosition}
尝试次数: ${props.keyData.attemptsToFind}
创建时间: ${formatDate(props.keyData.createdAt)}
公钥长度: ${props.keyData.publicKeyArmored?.length || 0} 字符
    `.trim()
    alert(details)
  }
}
</script>

<style scoped>
/* 无边框风格：用左侧色条 + 背景色差区分 */
.key-card {
  background: var(--bg-raised);
  border: none;
  border-left: 3px solid;
  border-radius: 6px;
  padding: 7px 9px;
  transition: all 0.2s ease;
}

.key-card:hover {
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.4);
}

.key-header {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 5px;
}

.pattern-badge {
  padding: 1px 7px;
  border-radius: 10px;
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  white-space: nowrap;
}

.match-text {
  font-size: 12px;
  color: var(--fg-muted);
  font-weight: 700;
  font-family: 'JetBrains Mono', 'Courier New', monospace;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.key-fingerprint {
  font-family: 'JetBrains Mono', 'Courier New', monospace;
  font-size: 11px;
  color: var(--fg);
  word-break: break-all;
  line-height: 1.45;
  margin-bottom: 5px;
  padding: 4px 6px;
  background: rgba(0, 0, 0, 0.3);
  border-radius: 4px;
}

/* 长 Key ID —— 规则实际匹配的目标 */
.key-keyid {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 5px;
}

.keyid-label {
  font-size: 9px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--fg-dim);
  white-space: nowrap;
}

.keyid-value {
  font-family: 'JetBrains Mono', 'Courier New', monospace;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.06em;
  color: var(--accent-soft);
  background: rgba(147, 51, 234, 0.12);
  padding: 1px 7px;
  border-radius: 4px;
}

.key-meta {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  font-size: 10px;
  color: var(--fg-dim);
  margin-bottom: 5px;
}

.key-actions {
  display: flex;
  gap: 4px;
}

.icon-sm {
  display: block;
  flex-shrink: 0;
}

.ghost-btn {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  background: transparent;
  border: 1px solid transparent;
  color: var(--accent-soft);
  padding: 2px 7px;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.15s ease;
  font-weight: 500;
  font-size: 11px;
  font-family: inherit;
}

.ghost-btn:hover {
  background: rgba(147, 51, 234, 0.15);
  border-color: rgba(147, 51, 234, 0.25);
}

/* 私钥下载按钮：醒目但不过分 */
.private-btn {
  color: var(--green);
}

.private-btn:hover:not(:disabled) {
  background: rgba(16, 185, 129, 0.12);
  border-color: rgba(16, 185, 129, 0.3);
  color: var(--green);
}

.private-btn.pending {
  opacity: 0.5;
  cursor: wait;
}
</style>
