<template>
  <div class="dashboard">
    <div class="dashboard-content">
      <!-- 左列：控制面板 + 规则引擎 -->
      <section class="col col-left">
        <div class="panel panel-control">
          <div class="panel-head">
            <span class="panel-title">控制面板</span>
            <span class="panel-hint">{{ enabledRuleCount }} 条规则生效</span>
          </div>
          <div class="panel-body">
            <MinerControl />
          </div>
        </div>

        <div class="panel panel-rules">
          <div class="panel-head">
            <span class="panel-title">规则引擎</span>
          </div>
          <div class="panel-body">
            <RuleGroupManager />
          </div>
        </div>
      </section>

      <!-- 中列：实时终端 + 统计 + 图表 -->
      <section class="col col-mid">
        <div class="panel panel-terminal">
          <div class="panel-head">
            <span class="panel-title">实时终端</span>
            <span class="panel-hint">{{ minerStore.logs.length }} 条</span>
          </div>
          <div class="panel-body panel-body-flush">
            <MinerTerminal />
          </div>
        </div>

        <div class="panel panel-stats">
          <div class="panel-body">
            <StatsPanel />
          </div>
        </div>

        <div class="panel panel-chart">
          <div class="panel-head">
            <span class="panel-title">Hashrate 趋势</span>
          </div>
          <div class="panel-body panel-body-flush">
            <div class="chart-wrapper">
              <HashrateChart />
            </div>
          </div>
        </div>
      </section>

      <!-- 右列：已发现的特殊密钥 -->
      <section class="col col-right">
        <div class="panel panel-keys">
          <div class="panel-head">
            <span class="panel-title">已发现的特殊密钥</span>
            <div class="panel-head-actions">
              <span class="panel-hint panel-hint-accent" :title="`存档总数 ${minerStore.archivedTotal} 把，列表显示最近 ${minerStore.matches.length} 把`">
                {{ minerStore.archivedTotal }}
              </span>
              <button
                class="icon-action-btn"
                :disabled="exporting"
                title="导出为 ZIP（含公钥与私钥）"
                @click="doExport('zip')"
              >
                <FileArchive class="icon-sm" :size="13" />
              </button>
              <button
                class="icon-action-btn"
                :disabled="exporting"
                title="导出为 JSON（含公钥与私钥）"
                @click="doExport('json')"
              >
                <Braces class="icon-sm" :size="13" />
              </button>
            </div>
          </div>
          <div class="panel-body panel-body-flush">
            <div v-if="minerStore.matches.length > 0" class="keys-list">
              <KeyCard
                v-for="key in visibleKeys"
                :key="key.id"
                :keyData="key"
              />
            </div>
            <div v-else class="illustration-empty">
              <Search class="empty-icon" :size="40" />
              <div class="text">暂无特殊密钥</div>
            </div>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, onMounted, onBeforeUnmount, watch } from 'vue'
import { Search, FileArchive, Braces } from 'lucide-vue-next'
import { useMinerStore } from '../stores/miner'
import { useRuleEngineStore } from '../stores/ruleEngine'
import StatsPanel from '../components/StatsPanel.vue'
import MinerControl from '../components/MinerControl.vue'
import MinerTerminal from '../components/MinerTerminal.vue'
import HashrateChart from '../components/HashrateChart.vue'
import KeyCard from '../components/KeyCard.vue'
import RuleGroupManager from '../components/RuleGroupManager.vue'

const minerStore = useMinerStore()
const ruleEngineStore = useRuleEngineStore()

const enabledRuleCount = computed(
  () =>
    ruleEngineStore.independentRules.filter(r => r.enabled).length +
    ruleEngineStore.ruleGroups
      .filter(g => g.enabled)
      .reduce((n, g) => n + g.rules.filter(r => r.enabled).length, 0)
)

// 批量导出（由后端打包，导出后端全量存档，不受前端列表上限影响）
const exporting = ref(false)

// 只渲染最近的一批卡片，避免高频命中时 DOM 过多导致浏览器卡死
const visibleKeys = computed(() => minerStore.matches.slice(0, 40))

// 右侧列表展示「已存档」的真实数据：定期从后端拉取（SSE 只做抽样提醒与终端日志）
let archiveTimer: ReturnType<typeof setInterval> | null = null

function startArchivePolling() {
  if (archiveTimer) return
  minerStore.fetchArchivedKeys(40)
  archiveTimer = setInterval(() => minerStore.fetchArchivedKeys(40), 4000)
}

function stopArchivePolling() {
  if (!archiveTimer) return
  clearInterval(archiveTimer)
  archiveTimer = null
  // 停挖后补一次，确保拿到最后一批
  minerStore.fetchArchivedKeys(40)
}

watch(
  () => minerStore.isRunning,
  running => {
    if (running) startArchivePolling()
    else stopArchivePolling()
  },
  { immediate: true }
)

onMounted(() => {
  // 进页面先拉一次存档，展示历史结果
  minerStore.fetchArchivedKeys(40)
  if (minerStore.isRunning) startArchivePolling()
})

onBeforeUnmount(() => {
  if (archiveTimer) clearInterval(archiveTimer)
  archiveTimer = null
})

async function doExport(format: 'zip' | 'json') {
  if (exporting.value) return
  exporting.value = true
  try {
    const result = await minerStore.exportKeys({ format, withPrivate: true })
    if (!result.ok) {
      alert('导出失败：\n' + (result.error || '未知错误'))
    }
  } finally {
    exporting.value = false
  }
}
</script>

<style scoped>
.dashboard {
  height: 100vh;
  overflow: hidden;
  background: var(--bg-app);
  color: var(--fg);
  font-family: Georgia, 'Times New Roman', Times, serif;
}

.dashboard-content {
  display: grid;
  grid-template-columns: minmax(240px, 0.85fr) minmax(0, 1.25fr) minmax(240px, 1fr);
  gap: 10px;
  padding: 10px;
  height: 100vh;
  box-sizing: border-box;
}

.col {
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
}

/* 无边框微阴影风格：靠背景色差区分层级 */
.panel {
  background: var(--bg-panel);
  border: none;
  border-radius: var(--radius);
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.3), 0 4px 16px rgba(0, 0, 0, 0.25);
  display: flex;
  flex-direction: column;
  min-height: 0;
  overflow: hidden;
}

.panel-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 8px 12px;
  flex-shrink: 0;
}

.panel-title {
  font-size: 13px;
  font-weight: 600;
  letter-spacing: 0.02em;
}

.panel-hint {
  font-size: 11px;
  color: var(--fg-dim);
  font-family: 'Courier New', monospace;
}

.panel-hint-accent {
  color: var(--accent);
  font-weight: 700;
}

/* 面板标题栏右侧的操作区 */
.panel-head-actions {
  display: flex;
  align-items: center;
  gap: 5px;
}

/* 仅图标的小按钮 */
.icon-action-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  padding: 0;
  border: 1px solid transparent;
  border-radius: 4px;
  background: transparent;
  color: var(--fg-muted);
  cursor: pointer;
  transition: all 0.15s ease;
}

.icon-action-btn:hover:not(:disabled) {
  background: rgba(147, 51, 234, 0.15);
  border-color: rgba(147, 51, 234, 0.25);
  color: var(--accent-soft);
}

.icon-action-btn:disabled {
  opacity: 0.4;
  cursor: wait;
}

.icon-sm {
  display: block;
  flex-shrink: 0;
}

.panel-body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 0 12px 10px;
}

.panel-body-flush {
  padding: 0;
  overflow: hidden;
}

/* 左列：控制面板固定高度，规则引擎占剩余空间 */
.panel-control {
  flex-shrink: 0;
}

.panel-rules {
  flex: 1;
  min-height: 0;
}

/* 中列：终端占大部分 */
.panel-terminal {
  flex: 1 1 55%;
  min-height: 160px;
}

.panel-stats {
  flex-shrink: 0;
}

.panel-chart {
  flex: 1 1 30%;
  min-height: 130px;
}

/* 右列：密钥列表占满 */
.panel-keys {
  flex: 1;
  min-height: 0;
}

.keys-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 8px;
  height: 100%;
  overflow-y: auto;
}

.chart-wrapper {
  height: 100%;
  min-height: 0;
  padding: 6px 8px;
  box-sizing: border-box;
}

.illustration-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  height: 100%;
  color: var(--fg-dim);
  font-size: 13px;
}

.empty-icon {
  opacity: 0.35;
}

/* 窄屏回退为纵向堆叠 */
@media (max-width: 900px) {
  .dashboard-content {
    grid-template-columns: 1fr;
    height: auto;
    overflow-y: auto;
  }

  .dashboard {
    height: auto;
    overflow: auto;
  }

  .col {
    overflow: visible;
  }

  .panel-terminal,
  .panel-chart {
    flex: none;
    height: 320px;
  }

  .panel-keys {
    height: 420px;
  }
}
</style>
