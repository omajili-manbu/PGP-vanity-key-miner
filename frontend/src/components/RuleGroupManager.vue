<template>
  <div class="rule-group-manager">
    <!-- 全局配置 -->
    <div class="global-config">
      <div class="config-item config-item-inline">
        <label>冲突策略</label>
        <UiSelect
          v-model="ruleEngineStore.conflictResolution"
          :options="conflictOptions"
        />
      </div>
      <div class="config-item config-item-inline">
        <label>规则优先级 <span class="config-num">{{ ruleEngineStore.defaultRulePriority }}</span></label>
        <input
          type="range"
          v-model.number="ruleEngineStore.defaultRulePriority"
          min="1"
          max="100"
          class="priority-slider"
        />
      </div>
      <div class="config-item config-item-inline">
        <label>规则组优先级 <span class="config-num">{{ ruleEngineStore.defaultGroupPriority }}</span></label>
        <input
          type="range"
          v-model.number="ruleEngineStore.defaultGroupPriority"
          min="1"
          max="100"
          class="priority-slider"
        />
      </div>
    </div>

    <!-- 独立规则区域 -->
    <div class="independent-rules-section">
      <div class="section-header">
        <h4>独立规则 (默认OR逻辑)</h4>
        <button @click="addNewRule" class="ghost-btn add-btn">
          <Plus class="icon-sm" :size="12" />
          添加规则
        </button>
      </div>
      <div class="rules-list">
        <div
          v-for="rule in ruleEngineStore.independentRules"
          :key="rule.id"
          class="rule-card"
          :class="{ disabled: !rule.enabled }"
        >
          <div class="rule-main">
            <div class="rule-title">
              <input
                type="checkbox"
                v-model="rule.enabled"
                class="rule-enable"
              />
              <input
                v-model="rule.name"
                class="rule-name line-input"
                placeholder="规则名称"
              />
              <input
                type="color"
                v-model="rule.color"
                class="rule-color"
                title="高亮颜色"
              />
              <input
                type="number"
                v-model.number="rule.priority"
                min="1"
                max="100"
                class="priority-input"
                title="优先级"
              />
              <button @click="removeRule(rule.id)" class="ghost-btn remove-btn" title="删除规则">
                <Trash2 class="icon-sm" :size="12" />
              </button>
            </div>
            <div class="rule-controls">
              <UiSelect
                v-model="rule.type"
                :options="ruleTypeOptions"
                class="rule-type-select"
              />
            </div>
          </div>
          <div class="rule-params-compact">
            <template v-if="rule.type === 'consecutive' || rule.type === 'repeating' || rule.type === 'palindrome'">
              <label>最小长度:
                <input
                  type="number"
                  v-model.number="rule.params.minLength"
                  min="3"
                  max="40"
                  class="param-input"
                />
              </label>
            </template>
            <template v-if="rule.type === 'special_date' || rule.type === 'custom_regex'">
              <label>模式:
                <input
                  type="text"
                  v-model="rule.params.pattern"
                  class="param-input"
                  :placeholder="rule.type === 'custom_regex' ? '正则，如 ^ab.*$' : '如 20240101'"
                />
              </label>
            </template>
            <template v-if="rule.type === 'leading_zeros'">
              <label>零个数:
                <input
                  type="number"
                  v-model.number="rule.params.zeroCount"
                  min="1"
                  max="40"
                  class="param-input"
                />
              </label>
            </template>
          </div>
        </div>
      </div>
    </div>

    <!-- 规则组区域 -->
    <div class="rule-groups-section">
      <div class="section-header">
        <h4>规则组</h4>
        <button @click="addNewGroup" class="ghost-btn add-btn">
          <Plus class="icon-sm" :size="12" />
          添加规则组
        </button>
      </div>

      <div v-if="ruleEngineStore.ruleGroups.length === 0" class="empty-hint">
        暂无规则组，点击上方按钮创建
      </div>

      <div class="groups-list">
        <div
          v-for="group in ruleEngineStore.ruleGroups"
          :key="group.id"
          class="group-card"
          :class="{ disabled: !group.enabled }"
        >
          <div class="group-header">
            <input
              type="checkbox"
              v-model="group.enabled"
              class="group-enable"
            />
            <input
              v-model="group.name"
              class="group-name line-input"
              placeholder="规则组名称"
            />
            <div class="group-logic" role="group" aria-label="组内逻辑">
              <button
                class="pill-tab"
                :class="{ active: group.logicOperator === 'OR' }"
                @click="group.logicOperator = 'OR'"
                title="组内任一规则命中即算命中"
              >
                OR
              </button>
              <button
                class="pill-tab"
                :class="{ active: group.logicOperator === 'AND' }"
                @click="group.logicOperator = 'AND'"
                title="组内所有规则都命中才算命中"
              >
                AND
              </button>
            </div>
            <input
              type="number"
              v-model.number="group.priority"
              min="1"
              max="100"
              class="priority-input"
              title="优先级"
            />
            <button @click="removeGroup(group.id)" class="ghost-btn remove-btn" title="删除规则组">
              <Trash2 class="icon-sm" :size="12" />
            </button>
          </div>

          <!-- 组内自有规则 -->
          <div class="group-rules">
            <div class="group-rules-header">
              <span>组内规则</span>
              <button
                @click="addGroupRule(group.id)"
                class="ghost-btn add-rule-btn"
                title="添加组内规则"
              >
                <Plus class="icon-sm" :size="11" />
                添加
              </button>
            </div>

            <div v-if="group.rules.length === 0" class="empty-hint empty-hint-sm">
              该组还没有规则，点击上方「添加」创建
            </div>

            <div class="group-rule-items">
              <div
                v-for="rule in group.rules"
                :key="rule.id"
                class="group-rule-card"
                :class="{ disabled: !rule.enabled }"
              >
                <div class="rule-title">
                  <input
                    type="checkbox"
                    v-model="rule.enabled"
                    class="rule-enable"
                  />
                  <input
                    v-model="rule.name"
                    class="rule-name line-input"
                    placeholder="规则名称"
                  />
                  <input
                    type="color"
                    v-model="rule.color"
                    class="rule-color"
                    title="高亮颜色"
                  />
                  <input
                    type="number"
                    v-model.number="rule.priority"
                    min="1"
                    max="100"
                    class="priority-input"
                    title="优先级"
                  />
                  <button
                    @click="removeGroupRule(group.id, rule.id)"
                    class="ghost-btn remove-btn"
                    title="删除组内规则"
                  >
                    <Trash2 class="icon-sm" :size="11" />
                  </button>
                </div>
                <div class="rule-controls">
                  <UiSelect
                    v-model="rule.type"
                    :options="ruleTypeOptions"
                    class="rule-type-select"
                  />
                </div>
                <div class="rule-params-compact">
                  <template v-if="rule.type === 'consecutive' || rule.type === 'repeating' || rule.type === 'palindrome'">
                    <label>最小长度:
                      <input
                        type="number"
                        v-model.number="rule.params.minLength"
                        min="3"
                        max="40"
                        class="param-input"
                      />
                    </label>
                  </template>
                  <template v-if="rule.type === 'special_date' || rule.type === 'custom_regex'">
                    <label>模式:
                      <input
                        type="text"
                        v-model="rule.params.pattern"
                        class="param-input"
                        :placeholder="rule.type === 'custom_regex' ? '正则，如 ^ab.*$' : '如 20240101'"
                      />
                    </label>
                  </template>
                  <template v-if="rule.type === 'leading_zeros'">
                    <label>零个数:
                      <input
                        type="number"
                        v-model.number="rule.params.zeroCount"
                        min="1"
                        max="40"
                        class="param-input"
                      />
                    </label>
                  </template>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 操作按钮 -->
    <div class="actions">
      <button @click="exportConfig" class="ghost-btn icon-btn action-btn" title="导出配置">
        <Download class="icon-sm" :size="13" />
      </button>
      <button @click="importConfig" class="ghost-btn icon-btn action-btn" title="导入配置">
        <Upload class="icon-sm" :size="13" />
      </button>
      <button @click="resetConfig" class="ghost-btn icon-btn action-btn danger" title="重置配置">
        <RotateCcw class="icon-sm" :size="13" />
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Plus, Trash2, Download, Upload, RotateCcw } from 'lucide-vue-next'
import UiSelect from './UiSelect.vue'
import { useRuleEngineStore } from '../stores/ruleEngine'

const ruleEngineStore = useRuleEngineStore()

// 冲突解决策略选项
const conflictOptions = [
  { label: '按优先级', value: 'priority' },
  { label: '首个匹配', value: 'first-match' },
  { label: '全部执行', value: 'all' },
  { label: '规则组优先', value: 'group-first' },
]

// 规则类型选项
const ruleTypeOptions = [
  { label: '连续字符', value: 'consecutive' },
  { label: '重复序列', value: 'repeating' },
  { label: '回文', value: 'palindrome' },
  { label: '特殊日期', value: 'special_date' },
  { label: '自定义正则', value: 'custom_regex' },
  { label: '前导零', value: 'leading_zeros' },
]

// 添加新规则
function addNewRule() {
  ruleEngineStore.addRule()
}

// 删除规则
function removeRule(ruleId: string) {
  if (confirm('确定要删除此规则吗？')) {
    ruleEngineStore.removeRule(ruleId)
  }
}

// 添加新规则组
function addNewGroup() {
  ruleEngineStore.addRuleGroup(`规则组 ${ruleEngineStore.ruleGroups.length + 1}`)
}

// 删除规则组
function removeGroup(groupId: string) {
  if (confirm('确定要删除此规则组吗？')) {
    ruleEngineStore.removeRuleGroup(groupId)
  }
}

// 在组内新建规则
function addGroupRule(groupId: string) {
  ruleEngineStore.addGroupRule(groupId)
}

// 删除组内规则
function removeGroupRule(groupId: string, ruleId: string) {
  ruleEngineStore.removeGroupRule(groupId, ruleId)
}

// 导出配置
function exportConfig() {  const config = ruleEngineStore.exportConfiguration()
  const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `rule-config-${Date.now()}.json`
  link.click()
  URL.revokeObjectURL(url)
}

// 导入配置
function importConfig() {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = '.json'
  input.onchange = (e) => {
    const file = (e.target as HTMLInputElement).files?.[0]
    if (!file) return
    
    const reader = new FileReader()
    reader.onload = (event) => {
      try {
        const config = JSON.parse(event.target?.result as string)
        ruleEngineStore.importConfiguration(config)
        alert('配置导入成功')
      } catch (error) {
        alert('配置导入失败: ' + (error instanceof Error ? error.message : '未知错误'))
      }
    }
    reader.readAsText(file)
  }
  input.click()
}

// 重置配置
function resetConfig() {
  if (confirm('确定要重置所有配置吗？此操作不可恢复。')) {
    ruleEngineStore.resetToDefault()
  }
}
</script>

<style scoped>
.rule-group-manager {
  font-family: Georgia, 'Times New Roman', Times, serif;
}

/* 图标按钮内的图标 */
.icon-sm {
  display: block;
  flex-shrink: 0;
}

/* 通用按钮 */
.ghost-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  background: transparent;
  border: 1px solid transparent;
  color: var(--accent-soft);
  padding: 4px 8px;
  border-radius: 5px;
  cursor: pointer;
  transition: all 0.15s ease;
  font-weight: 500;
  font-size: 12px;
  font-family: inherit;
}

.ghost-btn:hover {
  background: rgba(147, 51, 234, 0.15);
  border-color: rgba(147, 51, 234, 0.25);
}

.ghost-btn.danger {
  color: var(--red);
}

.ghost-btn.danger:hover {
  background: rgba(239, 68, 68, 0.12);
  border-color: rgba(239, 68, 68, 0.25);
}

/* 仅图标的按钮 */
.icon-btn {
  justify-content: center;
  padding: 4px;
  min-width: 26px;
  height: 26px;
  line-height: 0;
}

/* 全局配置 */
.global-config {
  margin-bottom: 10px;
  padding: 8px;
  background: var(--bg-raised);
  border-radius: var(--radius);
  border: none;
}

.config-item {
  margin-bottom: 6px;
}

.config-item:last-child {
  margin-bottom: 0;
}

.config-item-inline {
  display: grid;
  grid-template-columns: 92px 1fr;
  align-items: center;
  gap: 8px;
}

.config-item-inline label {
  margin-bottom: 0;
}

.config-num {
  font-family: 'Courier New', monospace;
  font-weight: 700;
  color: var(--accent-soft);
}

.config-item label {
  display: block;
  font-size: 11px;
  color: var(--fg-muted);
  margin-bottom: 3px;
  white-space: nowrap;
}

.priority-slider {
  width: 100%;
  height: 4px;
  margin-top: 2px;
}

/* 区域标题 */
.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.section-header h4 {
  margin: 0;
  font-size: 12px;
  color: var(--fg);
}

.add-btn {
  font-size: 11px;
}

/* 规则卡片 */
.rule-card {
  background: var(--bg-raised);
  border: none;
  border-radius: var(--radius);
  padding: 7px 8px;
  margin-bottom: 6px;
  transition: all 0.2s ease;
}

.rule-card.disabled,
.group-rule-card.disabled {
  opacity: 0.5;
}

/* 标题（规则名 + 颜色 + 优先级 + 删除）独占一行，其余控件在下一行 */
.rule-main {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.rule-title {
  display: flex;
  align-items: center;
  gap: 5px;
  min-width: 0;
}

.rule-controls {
  display: flex;
  align-items: center;
  gap: 5px;
  flex-wrap: wrap;
}

.rule-name {
  flex: 1;
  min-width: 0;
  font-size: 11px;
  padding: 3px 5px;
}

.rule-enable {
  width: 14px;
  height: 14px;
  flex-shrink: 0;
  cursor: pointer;
}

.rule-type-select {
  flex: 0 0 auto;
  min-width: 74px;
}

.rule-color {
  flex: 0 0 auto;
  width: 22px;
  height: 18px;
}

.priority-input {
  flex: 0 0 auto;
  width: 42px;
  padding: 3px;
  border-radius: 4px;
  font-size: 11px;
  text-align: center;
}

.remove-btn {
  flex: 0 0 auto;
  margin-left: auto;
  padding: 2px 4px;
  color: var(--red);
  line-height: 0;
}

/* 参数区 */
.rule-params-compact {
  margin-top: 5px;
  padding-left: 19px;
  font-size: 11px;
  color: var(--fg-muted);
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  align-items: center;
}

.rule-params-compact label {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  color: var(--fg-muted);
}

.param-input {
  width: 84px;
  padding: 3px 4px;
  border-radius: 4px;
  font-size: 11px;
  font-family: inherit;
}

/* 规则组 */
.group-card {
  background: var(--bg-raised);
  border: none;
  border-radius: var(--radius);
  padding: 8px;
  margin-bottom: 8px;
  transition: all 0.2s ease;
}

.group-card.disabled {
  opacity: 0.5;
}

.group-header {
  display: flex;
  align-items: center;
  gap: 5px;
  flex-wrap: wrap;
}

.group-enable {
  width: 14px;
  height: 14px;
  flex-shrink: 0;
  cursor: pointer;
}

.group-name {
  flex: 1;
  min-width: 60px;
  font-size: 11px;
  padding: 3px 5px;
}

.group-logic {
  display: inline-flex;
  gap: 2px;
  padding: 1px;
  border-radius: 12px;
  background: rgba(0, 0, 0, 0.3);
}

.group-logic .pill-tab {
  padding: 2px 8px;
  border-radius: 10px;
  border: none;
  background: transparent;
  color: var(--fg-muted);
  font-size: 10px;
  font-weight: 600;
  font-family: inherit;
  cursor: pointer;
  transition: all 0.15s ease;
}

.group-logic .pill-tab.active {
  background: var(--accent);
  color: #ffffff;
}

.group-rules {
  margin-top: 6px;
  padding-top: 6px;
  border-top: 1px solid rgba(255, 255, 255, 0.06);
}

.group-rules-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 6px;
}

.group-rules-header span {
  font-size: 11px;
  color: var(--fg-muted);
}

.add-rule-btn {
  font-size: 11px;
  padding: 2px 7px;
}

.group-rule-items {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.group-rule-card {
  background: var(--bg-sunken);
  border-radius: 6px;
  padding: 6px 7px;
}

.group-rule-item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 8px;
  background: var(--bg-sunken);
  border-radius: 4px;
  font-size: 12px;
}

.ref-enable {
  width: 14px;
  height: 14px;
}

.ref-name {
  flex: 1;
  color: var(--fg);
}

/* 空提示 */
.empty-hint {
  text-align: center;
  padding: 20px 8px;
  color: var(--fg-dim);
  font-size: 12px;
}

.empty-hint-sm {
  padding: 10px 8px;
}

/* 操作按钮 */
.actions {
  display: flex;
  gap: 6px;
  margin-top: 16px;
  padding-top: 12px;
  border-top: 1px solid rgba(255, 255, 255, 0.07);
}

.action-btn {
  font-size: 11px;
}
</style>
