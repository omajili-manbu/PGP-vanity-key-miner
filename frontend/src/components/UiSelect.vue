<template>
  <div class="ui-select" ref="rootRef">
    <button
      type="button"
      class="select-trigger"
      :class="{ open: isOpen, disabled: disabled }"
      :disabled="disabled"
      @click="toggle"
      @keydown.down.prevent="openAndHighlight"
      @keydown.enter.prevent="selectHighlighted"
      @keydown.esc.prevent="close"
      :aria-haspopup="'listbox'"
      :aria-expanded="isOpen"
    >
      <span class="select-value">{{ displayLabel }}</span>
      <ChevronDown class="select-chevron" :size="14" />
    </button>

    <Teleport to="body">
      <div
        v-if="isOpen"
        class="select-dropdown"
        :style="dropdownStyle"
        role="listbox"
        @click="close"
      >
        <button
          v-for="(option, index) in options"
          :key="String(option.value)"
          type="button"
          class="select-option"
          :class="{ active: index === highlightedIndex, selected: option.value === modelValue }"
          role="option"
          :aria-selected="option.value === modelValue"
          @mouseenter="highlightedIndex = index"
          @click.stop="select(option.value)"
        >
          <span class="option-label">{{ option.label }}</span>
          <Check v-if="option.value === modelValue" class="option-check" :size="13" />
        </button>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue'
import { ChevronDown, Check } from 'lucide-vue-next'

export interface SelectOption {
  label: string
  value: string | number
}

const props = withDefaults(defineProps<{
  modelValue: string | number
  options: SelectOption[]
  disabled?: boolean
  placeholder?: string
}>(), {
  disabled: false,
  placeholder: '请选择',
})

const emit = defineEmits<{
  (e: 'update:modelValue', value: string | number): void
}>()

const rootRef = ref<HTMLElement | null>(null)
const isOpen = ref(false)
const highlightedIndex = ref(-1)
const triggerRect = ref<DOMRect | null>(null)

const displayLabel = computed(() => {
  const found = props.options.find(o => o.value === props.modelValue)
  return found ? found.label : props.placeholder
})

const dropdownStyle = computed(() => {
  const rect = triggerRect.value
  if (!rect) return {}
  const width = rect.width
  const spaceBelow = window.innerHeight - rect.bottom
  const flip = spaceBelow < 180 && rect.top > spaceBelow

  return {
    left: `${rect.left}px`,
    top: flip ? `${rect.top}px` : `${rect.bottom + 4}px`,
    width: `${width}px`,
    transform: flip ? 'translateY(-100%)' : 'none',
    maxHeight: flip ? `${rect.top - 12}px` : `${window.innerHeight - rect.bottom - 12}px`,
  }
})

function measure() {
  const el = rootRef.value?.querySelector('.select-trigger') as HTMLElement | null
  if (el) triggerRect.value = el.getBoundingClientRect()
}

function toggle() {
  if (props.disabled) return
  isOpen.value ? close() : open()
}

function open() {
  measure()
  const idx = props.options.findIndex(o => o.value === props.modelValue)
  highlightedIndex.value = idx >= 0 ? idx : 0
  isOpen.value = true
  nextTick(() => {
    document.addEventListener('click', onOutsideClick, true)
    document.addEventListener('keydown', onKeydown, true)
    window.addEventListener('scroll', measure, true)
    window.addEventListener('resize', measure)
  })
}

function openAndHighlight() {
  if (!isOpen.value) open()
}

function close() {
  if (!isOpen.value) return
  isOpen.value = false
  document.removeEventListener('click', onOutsideClick, true)
  document.removeEventListener('keydown', onKeydown, true)
  window.removeEventListener('scroll', measure, true)
  window.removeEventListener('resize', measure)
}

function select(value: string | number) {
  emit('update:modelValue', value)
  close()
}

function selectHighlighted() {
  const option = props.options[highlightedIndex.value]
  if (option) select(option.value)
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    close()
    return
  }
  if (e.key === 'ArrowDown') {
    e.preventDefault()
    highlightedIndex.value = (highlightedIndex.value + 1) % props.options.length
  }
  if (e.key === 'ArrowUp') {
    e.preventDefault()
    highlightedIndex.value =
      (highlightedIndex.value - 1 + props.options.length) % props.options.length
  }
}

function onOutsideClick(e: MouseEvent) {
  const el = rootRef.value
  const target = e.target as Node
  if (el && !el.contains(target)) close()
}

onMounted(() => {
  // 初始挂载时也监听，用于点击触发按钮后失焦关闭
  document.addEventListener('keydown', onKeydown, true)
})

onUnmounted(() => {
  document.removeEventListener('click', onOutsideClick, true)
  document.removeEventListener('keydown', onKeydown, true)
  window.removeEventListener('scroll', measure, true)
  window.removeEventListener('resize', measure)
})
</script>

<style scoped>
.ui-select {
  position: relative;
  display: block;
  min-width: 0;
}

.select-trigger {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
  padding: 4px 8px;
  border: 1px solid #333333;
  border-radius: 5px;
  background: var(--bg-raised);
  color: var(--fg);
  font-family: inherit;
  font-size: 12px;
  line-height: 1.4;
  cursor: pointer;
  transition: border-color 0.15s ease, background 0.15s ease;
  text-align: left;
}

.select-trigger:hover:not(.disabled) {
  border-color: var(--accent);
}

.select-trigger.open {
  border-color: var(--accent);
}

.select-trigger.disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.select-value {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.select-chevron {
  flex-shrink: 0;
  opacity: 0.5;
  transition: transform 0.15s ease;
}

.select-trigger.open .select-chevron {
  transform: rotate(180deg);
}
</style>

<style>
/* 下拉面板使用 Teleport 到 body，样式不能用 scoped */
.select-dropdown {
  position: fixed;
  z-index: 9999;
  overflow-y: auto;
  padding: 3px;
  background: var(--bg-raised);
  border: 1px solid #333333;
  border-radius: 6px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5);
}

.select-option {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  width: 100%;
  padding: 5px 8px;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: var(--fg);
  font-family: inherit;
  font-size: 12px;
  text-align: left;
  cursor: pointer;
  white-space: nowrap;
}

.select-option:hover,
.select-option.active {
  background: rgba(147, 51, 234, 0.15);
}

.select-option.selected {
  color: var(--accent-soft);
  font-weight: 600;
}

.option-label {
  overflow: hidden;
  text-overflow: ellipsis;
}

.option-check {
  flex-shrink: 0;
}
</style>
