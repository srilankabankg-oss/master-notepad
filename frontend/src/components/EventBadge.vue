<script setup lang="ts">
import { eventTypeLabel, eventTypeClass } from '@/composables/useEventLabels'
import type { EventType } from '@/types/api'

defineProps<{ type: EventType }>()

defineOptions({ name: 'EventBadge' })
</script>

<template>
  <span :class="['event-badge', eventTypeClass(type)]">{{ eventTypeLabel(type) }}</span>
</template>
