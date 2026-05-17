<script setup lang="ts">
defineOptions({ name: 'EntityHeader' })
defineProps<{
  name: string
  companyName?: string | null
  specialization?: string | null
  rating?: number
  description?: string | null
  contactInfo?: string | null
}>()
import { ratingColor } from '@/composables/useRating'
</script>

<template>
  <div class="detail-card">
    <div class="detail-header">
      <div>
        <h2 class="detail-name">{{ name }}</h2>
        <div class="detail-meta">
          <span v-if="companyName">{{ companyName }}</span>
          <span v-if="specialization" class="meta-sep">{{ specialization }}</span>
        </div>
      </div>
      <div v-if="rating !== undefined" class="detail-rating">
        <span class="rating-value" :style="{ color: ratingColor(rating) }">{{ rating }}</span>
      </div>
    </div>
    <p v-if="description" class="detail-desc">{{ description }}</p>
    <p v-if="contactInfo" class="detail-contact">{{ contactInfo }}</p>
  </div>
</template>

<style scoped>
.detail-card { background: var(--color-bg-card); border-radius: var(--radius-lg); padding: var(--space-6); box-shadow: var(--shadow-card); margin-bottom: var(--space-5); }
.detail-header { display: flex; justify-content: space-between; align-items: flex-start; }
.detail-name { font-size: var(--font-size-xl); font-weight: var(--font-weight-semibold); color: var(--color-text); margin: 0; }
.detail-meta { font-size: var(--font-size-sm); color: var(--color-text-muted); margin-top: 0.25rem; }
.meta-sep::before { content: '·'; margin-right: 0.5rem; }
.detail-rating { text-align: right; }
.rating-value { font-size: var(--font-size-2xl); font-weight: var(--font-weight-bold); }
.detail-desc { font-size: var(--font-size-base); color: var(--color-text-secondary); margin-top: var(--space-3); line-height: 1.6; }
.detail-contact { font-size: var(--font-size-sm); color: var(--color-text-muted); margin-top: var(--space-2); }
</style>
