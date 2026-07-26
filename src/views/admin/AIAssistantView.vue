<script setup lang="ts">
import { ref, nextTick, onMounted, watch } from 'vue'
import { api } from '../../api/client'
import { Send, Sparkles, User, Loader2, Trash2, Copy, Check } from 'lucide-vue-next'
import { Bar, Line } from 'vue-chartjs'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  Title,
  Tooltip,
  Legend
} from 'chart.js'

ChartJS.register(CategoryScale, LinearScale, BarElement, LineElement, PointElement, Title, Tooltip, Legend)

type Message = {
  role: 'user' | 'ai'
  content: string
  sql?: string
  data?: any[]
  chartType?: string
  timestamp: number
}

const messages = ref<Message[]>([])
const input = ref('')
const loading = ref(false)
const chatContainer = ref<HTMLElement | null>(null)

const suggestions = [
  'Sa fitim pata sot?',
  'Cili produkt shitet me shume?',
  'Sa Coca-Cola kane mbet?',
  'Cili banakier ka bo me shume shitje sot?',
  'Sa tavolina jane te zena tash?',
  'Sa rezervime kena kete jave?'
]

const STORAGE_KEY = 'kendi-pos-ai-chat'
const copiedIndex = ref<number | null>(null)

// Load messages nga localStorage kur hapet faqja
onMounted(() => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) {
      messages.value = JSON.parse(saved)
    }
  } catch (e) {
    console.warn('Failed to load chat history:', e)
  }
})

// Ruaj automatikisht cdo here qe ndryshon
watch(messages, (newMessages) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newMessages))
  } catch (e) {
    console.warn('Failed to save chat history:', e)
  }
}, { deep: true })

function clearChat() {
  if (messages.value.length === 0) return
  if (!confirm('Fshi historinë e bisedës?')) return
  messages.value = []
  localStorage.removeItem(STORAGE_KEY)
}

async function copyMessage(content: string, index: number) {
  try {
    await navigator.clipboard.writeText(content)
    copiedIndex.value = index
    setTimeout(() => {
      copiedIndex.value = null
    }, 2000)
  } catch (e) {
    console.error('Copy failed:', e)
  }
}

async function ask(question: string) {
  if (!question.trim() || loading.value) return

  messages.value.push({
    role: 'user',
    content: question,
    timestamp: Date.now()
  })

  input.value = ''
  loading.value = true
  await scrollToBottom()

  try {
      const res = await api.post<{
          answer: string
          sql: string
          data: any[] | null
          chartType: string | null
          success: boolean
          error: string | null
      }>('/ai/analytics', { question })

      if (res.success) {
          messages.value.push({
              role: 'ai',
              content: res.answer,
              sql: res.sql,
              data: res.data || undefined,
              chartType: res.chartType || undefined,
              timestamp: Date.now()
          })
      } else {
      messages.value.push({
        role: 'ai',
        content: res.error || 'Diçka shkoi keq',
        timestamp: Date.now()
      })
    }
  } catch (e) {
    messages.value.push({
      role: 'ai',
      content: 'Gabim ne lidhje me AI. Provo prap.',
      timestamp: Date.now()
    })
  } finally {
    loading.value = false
    await scrollToBottom()
  }
}

async function scrollToBottom() {
  await nextTick()
  if (chatContainer.value) {
    chatContainer.value.scrollTop = chatContainer.value.scrollHeight
  }
}

function handleSubmit() {
  ask(input.value)
}

function useSuggestion(s: string) {
  ask(s)
}

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString('sq-AL', { hour: '2-digit', minute: '2-digit' })
}

function getChartData(msg: Message) {
  if (!msg.data || msg.data.length === 0) return null
  
  const firstRow = msg.data[0]
  const keys = Object.keys(firstRow)
  
  const labelKey = keys.find(k => typeof firstRow[k] === 'string')
  const valueKey = keys.find(k => typeof firstRow[k] === 'number')
  
  if (!labelKey || !valueKey) return null
  
  return {
    labels: msg.data.map(row => String(row[labelKey])),
    datasets: [{
      label: valueKey,
      data: msg.data.map(row => Number(row[valueKey])),
      backgroundColor: 'rgba(156, 184, 156, 0.6)',
      borderColor: '#9CB89C',
      borderWidth: 2,
      tension: 0.3
    }]
  }
}

const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { 
      labels: { color: '#E8E4D8' } 
    }
  },
  scales: {
    x: {
      ticks: { color: '#E8E4D8' },
      grid: { color: 'rgba(232, 228, 216, 0.1)' }
    },
    y: {
      ticks: { color: '#E8E4D8' },
      grid: { color: 'rgba(232, 228, 216, 0.1)' }
    }
  }
}
</script>

<template>
  <div class="page">
    <header class="page-head">
  <div>
    <p class="eyebrow">Analitikë</p>
    <h1>
      <Sparkles :size="24" class="head-icon" />
      Ask AI
    </h1>
  </div>
  <button 
    v-if="messages.length > 0"
    class="clear-btn"
    @click="clearChat"
    title="Pastro chat"
  >
    <Trash2 :size="14" />
    Pastro chat
  </button>
</header>

    <div class="chat-wrapper">
      <!-- Empty state me suggestions -->
      <div v-if="messages.length === 0" class="empty-state">
        <div class="empty-icon">
          <Sparkles :size="32" />
        </div>
        <h2>Pyet çdo gjë për biznesin</h2>
        <p>AI e ka access në krejt të dhënat e biznesit dhe të përgjigjet në shqip.</p>

        <div class="suggestions">
          <p class="suggestions-label">Provo:</p>
          <div class="suggestion-grid">
            <button 
              v-for="s in suggestions" 
              :key="s" 
              class="suggestion-btn"
              @click="useSuggestion(s)"
            >
              {{ s }}
            </button>
          </div>
        </div>
      </div>

      <!-- Chat messages -->
      <div v-else ref="chatContainer" class="chat-messages">
        <div v-for="(msg, i) in messages" :key="i" 
          :class="['message', `message--${msg.role}`]">
          <div class="avatar">
            <User v-if="msg.role === 'user'" :size="16" />
            <Sparkles v-else :size="16" />
          </div>
          <div class="bubble">
            <div class="bubble-content">{{ msg.content }}</div>
                       <button v-if="msg.role === 'ai'" class="copy-btn" @click="copyMessage(msg.content, i)"
                            :title="copiedIndex === i ? 'Kopjuar!' : 'Kopjo pergjigjen'">
                            <Check v-if="copiedIndex === i" :size="12" />
                            <Copy v-else :size="12" />
                            {{ copiedIndex === i ? 'Kopjuar' : 'Kopjo' }}
                        </button>
                       <div v-if="msg.chartType && getChartData(msg)" class="chart-container">
                            <Bar v-if="msg.chartType === 'bar'" :data="getChartData(msg)!" :options="chartOptions" />
                            <Line v-else-if="msg.chartType === 'line'" :data="getChartData(msg)!"
                                :options="chartOptions" />
                        </div>
          
            <details v-if="msg.sql" class="sql-details">
              <summary>Shiko SQL</summary>
              <pre class="sql-code">{{ msg.sql }}</pre>
            </details>
            <div class="bubble-time">{{ formatTime(msg.timestamp) }}</div>
          </div>
        </div>

        <div v-if="loading" class="message message--ai">
          <div class="avatar">
            <Sparkles :size="16" />
          </div>
          <div class="bubble bubble--loading">
            <Loader2 :size="16" class="spin" />
            <span>Duke menduar...</span>
          </div>
        </div>
      </div>

      <!-- Input area -->
      <div class="input-area">
        <input
          v-model="input"
          type="text"
          class="chat-input"
          placeholder="Pyet dicka per biznesin tend..."
          @keydown.enter="handleSubmit"
          :disabled="loading"
        />
        <button 
          class="send-btn" 
          @click="handleSubmit"
          :disabled="loading || !input.trim()"
        >
          <Send :size="16" />
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.page {
  display: flex;
  flex-direction: column;
  padding: 24px 28px;
  gap: 18px;
  height: 100%;
  overflow: hidden;
}

.page-head {
  flex-shrink: 0;
}

.page-head .eyebrow {
  margin-bottom: 4px;
}

.page-head h1 {
  font-size: 30px;
  font-weight: 700;
  letter-spacing: -0.02em;
  display: flex;
  align-items: center;
  gap: 12px;
}

.head-icon {
  color: var(--brand);
}

.chat-wrapper {
  flex: 1;
  display: flex;
  flex-direction: column;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  overflow: hidden;
  min-height: 0;
}

/* Empty state */
.empty-state {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px 20px;
  text-align: center;
}

.empty-icon {
  width: 72px;
  height: 72px;
  border-radius: 20px;
  background: var(--brand-soft);
  color: var(--brand);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 20px;
}

.empty-state h2 {
  font-size: 22px;
  font-weight: 700;
  color: var(--text);
  margin-bottom: 8px;
}

.empty-state p {
  font-size: 14px;
  color: var(--text-2);
  margin-bottom: 32px;
  max-width: 400px;
}

.suggestions {
  width: 100%;
  max-width: 600px;
}

.suggestions-label {
  font-size: 12px;
  color: var(--text-3);
  text-transform: uppercase;
  letter-spacing: 0.08em;
  margin-bottom: 12px;
  font-weight: 600;
}

.suggestion-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 8px;
}

.suggestion-btn {
  padding: 12px 16px;
  background: var(--surface-2);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  color: var(--text);
  font-size: 13px;
  text-align: left;
  transition: all var(--duration) var(--ease);
  font-family: inherit;
  cursor: pointer;
}

.suggestion-btn:hover {
  background: var(--brand-soft);
  border-color: var(--brand-line);
  color: var(--brand);
}

/* Chat messages */
.chat-messages {
  flex: 1;
  overflow-y: auto;
  padding: 20px 24px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.message {
  display: flex;
  gap: 12px;
  max-width: 80%;
}

.message--user {
  align-self: flex-end;
  flex-direction: row-reverse;
}

.avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: var(--surface-2);
  color: var(--text-2);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.message--user .avatar {
  background: var(--brand-soft);
  color: var(--brand);
}

.message--ai .avatar {
  background: var(--surface-2);
  color: var(--brand);
}

.bubble {
  background: var(--surface-2);
  padding: 12px 16px;
  border-radius: 16px;
  border-top-left-radius: 4px;
  min-width: 0;
}

.message--user .bubble {
  background: var(--brand-soft);
  border-radius: 16px;
  border-top-right-radius: 4px;
}

.bubble-content {
  font-size: 14px;
  color: var(--text);
  line-height: 1.5;
  white-space: pre-wrap;
  word-break: break-word;
}

.bubble-time {
  font-size: 10px;
  color: var(--text-3);
  margin-top: 6px;
  font-family: var(--font-mono);
}

.sql-details {
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px solid var(--border);
}

.sql-details summary {
  font-size: 11px;
  color: var(--text-3);
  cursor: pointer;
  user-select: none;
}

.sql-details summary:hover {
  color: var(--text-2);
}

.sql-code {
  margin-top: 8px;
  padding: 10px 12px;
  background: var(--bg);
  border-radius: 6px;
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--text-2);
  overflow-x: auto;
  white-space: pre-wrap;
  word-break: break-all;
}

.bubble--loading {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--text-2);
  font-size: 13px;
}

.chart-container {
  margin-top: 12px;
  padding: 12px;
  background: var(--bg);
  border-radius: 8px;
  height: 280px;
  width: 100%;
  position: relative;
}

.spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* Input area */
.input-area {
  display: flex;
  gap: 10px;
  padding: 16px 20px;
  border-top: 1px solid var(--border);
  background: var(--surface);
}

.chat-input {
  flex: 1;
  height: 44px;
  padding: 0 16px;
  background: var(--surface-2);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  color: var(--text);
  font-size: 14px;
  font-family: inherit;
  outline: none;
  transition: border-color var(--duration) var(--ease);
}

.chat-input:focus {
  border-color: var(--brand);
}

.chat-input:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.send-btn {
  width: 44px;
  height: 44px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: var(--brand);
  color: var(--surface);
  border: none;
  border-radius: var(--radius);
  transition: all var(--duration) var(--ease);
  cursor: pointer;
}

.send-btn:hover:not(:disabled) {
  background: var(--brand-deep, var(--brand));
  transform: scale(1.05);
}

.send-btn:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.page-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  flex-shrink: 0;
}

.clear-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 12px;
  background: transparent;
  color: var(--text-2);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  font-size: 12px;
  font-family: inherit;
  cursor: pointer;
  transition: all var(--duration) var(--ease);
}

.clear-btn:hover {
  background: var(--danger-soft);
  color: var(--danger);
  border-color: var(--danger);
}

.copy-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  margin-top: 8px;
  background: transparent;
  color: var(--text-3);
  border: 1px solid var(--border);
  border-radius: 6px;
  font-size: 11px;
  font-family: inherit;
  cursor: pointer;
  transition: all var(--duration) var(--ease);
}

.copy-btn:hover {
  background: var(--surface);
  color: var(--text-2);
}

.copy-btn:has(.lucide-check) {
  color: var(--brand);
  border-color: var(--brand-line);
}

@media (max-width: 720px) {
  .suggestion-grid {
    grid-template-columns: 1fr;
  }
  .message {
    max-width: 90%;
  }
}
</style>