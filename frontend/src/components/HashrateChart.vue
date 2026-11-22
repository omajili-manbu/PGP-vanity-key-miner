<template>
  <div class="chart-box">
    <canvas ref="chartRef"></canvas>
  </div>
</template>

<script setup lang="ts">
import { ref, shallowRef, onMounted, watch, onUnmounted, computed } from 'vue'
import { Chart, registerables } from 'chart.js'
import { useMinerStore } from '../stores/miner'

// 注册 Chart.js 组件
Chart.register(...registerables)

const chartRef = ref<HTMLCanvasElement>()
// Chart 实例必须用 shallowRef + markRaw：深度响应式代理会破坏 Chart.js 的内部递归访问
const chart = shallowRef<Chart | null>(null)
const minerStore = useMinerStore()

// hashrateHistory 在 store 中是原地 push/shift 的数组，
// 浅层 watch 不会触发，因此这里用拷贝后的数组作为依赖源
const historySnapshot = computed(() => [...minerStore.hashrateHistory])

onMounted(() => {
  if (!chartRef.value) return

  const ctx = chartRef.value.getContext('2d')
  if (!ctx) return

  const instance = new Chart(ctx, {
    type: 'line',
    data: {
      labels: Array(60).fill(''),
      datasets: [{
        label: 'Hashrate (keys/s)',
        data: [...minerStore.hashrateHistory],
        borderColor: '#9333ea',
        backgroundColor: 'rgba(147, 51, 234, 0.12)',
        borderWidth: 2,
        tension: 0.35,
        pointRadius: 0,
        fill: true
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      devicePixelRatio: 1,
      interaction: { mode: 'index', intersect: false },
      scales: {
        x: {
          display: false,
          grid: {
            display: false
          }
        },
        y: {
          beginAtZero: true,
          grid: {
            color: 'rgba(255, 255, 255, 0.08)'
          },
          ticks: {
            color: 'rgba(255, 255, 255, 0.55)',
            maxTicksLimit: 5,
            font: { size: 10 }
          }
        }
      },
      plugins: {
        legend: {
          display: false
        },
        tooltip: {
          enabled: true,
          displayColors: false,
          callbacks: {
            label: (item) => `${(item.parsed.y ?? 0).toFixed(1)} keys/s`
          }
        }
      }
    }
  })

  chart.value = instance
})

// 监听 hashrate 历史数据（依赖拷贝后的新数组，元素变化会触发）
watch(
  historySnapshot,
  (newHistory) => {
    const instance = chart.value
    if (!instance) return
    instance.data.datasets[0].data = [...newHistory]
    instance.update('none')
  },
  { deep: false }
)

onUnmounted(() => {
  if (chart.value) {
    chart.value.destroy()
    chart.value = null
  }
})
</script>

<style scoped>
.chart-box {
  position: relative;
  width: 100%;
  height: 100%;
  min-height: 0;
}
</style>
