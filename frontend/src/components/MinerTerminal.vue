<template>
  <div class="miner-terminal">
    <div class="terminal-content" ref="terminalContent">
      <div
        v-for="(log, index) in logs"
        :key="index"
        class="log-line"
        :class="log.type"
      >
        <span class="timestamp">{{ formatTime(log.time) }}</span>
        <span class="separator">|</span>
        <!-- 显示密钥指纹（如果有） -->
        <span
          v-if="log.fingerprint"
          class="fingerprint"
          :style="{ color: log.color || '#00f0ff' }"
        >
          [{{ log.fingerprint }}]
        </span>
        <span class="message">{{ log.message }}</span>
      </div>
      <div v-if="logs.length === 0" class="empty-state">
        等待任务启动...
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, nextTick, computed } from 'vue'
import { useMinerStore } from '../stores/miner'

const minerStore = useMinerStore()
const terminalContent = ref<HTMLDivElement>()

const logs = computed(() => minerStore.logs)

function formatTime(date: Date): string {
  return date.toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

// 自动滚动到底部
watch(
  () => logs.value.length,
  () => {
    nextTick(() => {
      if (terminalContent.value) {
        terminalContent.value.scrollTop = terminalContent.value.scrollHeight
      }
    })
  }
)
</script>

<style scoped>
.miner-terminal {
  background: var(--bg-sunken);
  border: none;
  border-radius: 0;
  overflow: hidden;
  height: 100%;
  display: flex;
  flex-direction: column;
}

.terminal-content {
  flex: 1;
  overflow-y: auto;
  padding: 8px 10px;
  font-family: 'Courier New', monospace;
  font-size: 12px;
  line-height: 1.5;
}

.log-line {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  margin-bottom: 2px;
  word-break: break-all;
}

.timestamp {
  color: var(--fg-dim);
  white-space: nowrap;
  flex-shrink: 0;
}

.separator {
  color: #3a3a3a;
  flex-shrink: 0;
}

.fingerprint {
  font-weight: bold;
  flex-shrink: 0;
}

.message {
  color: #d4d4d4;
}

.log-line.info .message {
  color: var(--fg-muted);
}

.log-line.match .message {
  color: #00ff41;
}

.log-line.match .timestamp {
  color: #00ff41;
}

.log-line.error .message {
  color: var(--red);
}

.empty-state {
  color: var(--fg-dim);
  text-align: center;
  padding: 24px 0;
  font-family: Georgia, 'Times New Roman', Times, serif;
}
</style>
