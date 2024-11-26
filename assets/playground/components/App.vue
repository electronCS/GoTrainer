<template>
  <div id="app">
    <GoBoardController />
  </div>
</template>

<script>
import GoBoardController from './GoBoardController.vue';

export default {
  name: 'App',
  components: {
    GoBoardController
  }
};
</script>

<style>
/* Optional global styles */
body {
  font-family: Arial, sans-serif;
}
</style>
