<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useSubcontractorStore } from '@/stores/subcontractors'
import RatingBadge from '@/components/RatingBadge.vue'

const router = useRouter()
const subcontractorStore = useSubcontractorStore()
const loading = ref(true)
const error = ref('')

onMounted(async () => {
  try {
    await subcontractorStore.fetchAll()
  } catch (e: unknown) {
    error.value = String(e)
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <div class="view">
    <div v-if="loading" class="state-message">Загрузка...</div>
    <div v-else-if="error" class="state-message state-error">{{ error }}</div>

    <div v-else class="tender-grid">
      <article
        v-for="sub in subcontractorStore.items"
        :key="sub.id"
        class="tender-card"
        @click="router.push(`/tender/${sub.id}`)"
      >
        <div class="card-top">
          <h3 class="card-name">{{ sub.name }}</h3>
          <RatingBadge :rating="sub.rating" />
        </div>

        <div class="card-meta">
          <span v-if="sub.companyName" class="card-company">{{ sub.companyName }}</span>
          <span class="card-specialization">{{ sub.specialization }}</span>
        </div>

        <p v-if="sub.description" class="card-desc">{{ sub.description }}</p>

        <div class="card-action">
          <span class="card-link">Открыть справку →</span>
        </div>
      </article>
    </div>
  </div>
</template>

<style scoped>
.view { max-width: 56.25rem; }

.tender-grid {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.tender-card {
  background: var(--color-bg-card);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  padding: var(--space-5);
  cursor: pointer;
  transition: border-color 0.15s, box-shadow 0.15s;
}

.tender-card:hover {
  border-color: var(--color-primary);
  box-shadow: 0 2px 12px rgba(26, 86, 219, 0.08);
}

.card-top {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: var(--space-2);
}

.card-name {
  font-size: var(--font-size-lg);
  font-weight: 600;
  color: var(--color-text);
  margin: 0;
}

.card-meta {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  margin-bottom: var(--space-2);
}

.card-company {
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
  background: var(--color-bg);
  padding: 0.125rem 0.5rem;
  border-radius: var(--radius-sm);
}

.card-specialization {
  font-size: var(--font-size-sm);
  color: var(--color-primary);
  background: rgba(26, 86, 219, 0.06);
  padding: 0.125rem 0.5rem;
  border-radius: var(--radius-sm);
}

.card-desc {
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  line-height: 1.5;
  margin: 0 0 var(--space-3);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.card-action {
  text-align: right;
}

.card-link {
  font-size: var(--font-size-sm);
  font-weight: 500;
  color: var(--color-primary);
}
</style>