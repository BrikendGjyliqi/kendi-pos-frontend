<script setup lang="ts">
import { RouterView } from 'vue-router'
</script>

<template>
  <RouterView v-slot="{ Component, route }">
    <transition name="fade">
      <div :key="route.fullPath" class="route-wrapper">
        <component :is="Component" />
      </div>
    </transition>
  </RouterView>
</template>

<style>
.route-wrapper {
  height: 100%;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 200ms ease;
}
.fade-enter-from {
  opacity: 0;
}
.fade-leave-to {
  opacity: 0;
}
</style>