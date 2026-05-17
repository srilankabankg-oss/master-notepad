<script setup lang="ts">
import { ratingColor } from '@/composables/useRating'

defineProps<{ rating?: number }>()

defineOptions({ name: 'RatingBadge' })
</script>

<template>
  <span class="rating-badge" :style="{ background: ratingColor(rating) }">{{ rating ?? '—' }}</span>
</template>
