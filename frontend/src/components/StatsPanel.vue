<template>
  <div class="stats-panel">
    <!-- 紧凑模式：一行三个指标 -->
    <div v-if="mode !== 'detailed'" class="stats-compact">
      <div class="stat-cell">
        <div class="stat-label">总尝试次数</div>
        <div class="stat-value">
          <AnimatedNumber :value="attempts" />
        </div>
      </div>
      <div class="stat-cell">
        <div class="stat-label">发现数量</div>
        <div class="stat-value text-green">
          <AnimatedNumber :value="matches" />
        </div>
        <div class="stat-hint">已存档 {{ archived }}</div>
      </div>
      <div class="stat-cell">
        <div class="stat-label">当前 HASHRATE</div>
        <div class="stat-value text-cyan">
          <AnimatedNumber :value="hashrate" :decimals="1" /> keys/s
        </div>
      </div>
    </div>

    <!-- 详细模式 -->
    <div v-else class="stats-detailed">
      <div class="stats-compact stats-compact-4">
        <div class="stat-cell">
          <div class="stat-label">总尝试次数</div>
          <div class="stat-value">
            <AnimatedNumber :value="attempts" />
          </div>
        </div>
        <div class="stat-cell">
          <div class="stat-label">发现数量</div>
          <div class="stat-value text-green">
            <AnimatedNumber :value="matches" />
          </div>
          <div class="stat-hint">已存档 {{ archived }}</div>
        </div>
        <div class="stat-cell">
          <div class="stat-label">当前 HASHRATE</div>
          <div class="stat-value text-cyan">
            <AnimatedNumber :value="hashrate" :decimals="1" /> keys/s
          </div>
        </div>
        <div class="stat-cell">
          <div class="stat-label">预计耗时</div>
          <div class="stat-value">{{ formatDuration(uptime) }}</div>
        </div>
      </div>

      <!-- 规则统计 -->
      <div class="rules-stats">
        <div class="section-title">规则统计</div>
        <div class="rules-list">
          <div
            v-for="(count, type) in matchStats"
            :key="type"
            class="rule-stat-item"
          >
            <span class="rule-type">{{ type }}</span>
            <span class="rule-count">{{ count }} 个</span>
          </div>
          <div v-if="Object.keys(matchStats).length === 0" class="rule-stat-item">
            <span class="rule-type">暂无匹配</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useMinerStore } from '../stores/miner'
import AnimatedNumber from './AnimatedNumber.vue'

defineProps<{
  mode?: 'simple' | 'detailed'
}>()

const minerStore = useMinerStore()

const attempts = computed(() => minerStore.attempts)
// 真实命中总数（worker 计数），不是 SSE 抽样条数
const matches = computed(() => minerStore.matchesFound)
const archived = computed(() => minerStore.archivedCount)
const hashrate = computed(() => minerStore.hashrate)

// 运行时间（秒）
const uptime = computed(() => {
  // 简化计算，实际应该从任务开始时间计算
  return Math.floor(minerStore.attempts / Math.max(minerStore.hashrate, 1))
})

// 按规则类型统计匹配数量
const matchStats = computed(() => {
  const stats: Record<string, number> = {}
  minerStore.matches.forEach(key => {
    const type = key.patternType
    stats[type] = (stats[type] || 0) + 1
  })
  return stats
})

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`
  return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`
}
</script>

<style scoped>
.stats-panel {
  font-family: Georgia, 'Times New Roman', Times, serif;
}

.stats-compact {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 6px;
}

.stats-compact-4 {
  grid-template-columns: repeat(4, minmax(0, 1fr));
}

.stat-cell {
  background: var(--bg-raised);
  border: none;
  border-radius: 6px;
  padding: 6px 8px;
  min-width: 0;
}

.stat-label {
  font-size: 10px;
  color: var(--fg-dim);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  margin-bottom: 2px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.stat-value {
  font-size: 17px;
  font-weight: 700;
  color: var(--fg);
  line-height: 1.2;
  white-space: nowrap;
}

.stat-hint {
  font-size: 10px;
  color: var(--fg-dim);
  margin-top: 1px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.stat-value.text-green {
  color: var(--green);
}

.stat-value.text-cyan {
  color: var(--accent-soft);
}

.rules-stats {
  margin-top: 10px;
}

.section-title {
  font-size: 12px;
  font-weight: 600;
  margin-bottom: 6px;
  color: var(--fg-muted);
}

.rules-list {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.rule-stat-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
  padding: 3px 8px;
  background: var(--bg-raised);
  border: none;
  border-radius: 4px;
  font-size: 12px;
}

.rule-type {
  text-transform: uppercase;
  font-size: 10px;
  letter-spacing: 0.05em;
  color: var(--fg-dim);
}

.rule-count {
  font-family: 'Courier New', monospace;
  font-weight: 700;
}
</style>
