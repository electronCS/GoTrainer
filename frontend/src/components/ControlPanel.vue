<template>
  <div class="control-panel">
    <!-- Top Row Buttons -->
    <div class="top-row">
      <button
        v-for="action in actions"
        :key="action"
        class="action-button"
        @click="selectAction(action)">
        {{ action }}
      </button>
    </div>

    <!-- Bottom Row Buttons -->
    <div class="bottom-row">
      <button
        v-for="mode in modes"
        :key="mode"
        :class="['mode-button', { active: mode === currentMode }]"
        @click="selectMode(mode)">
        {{ mode }}
      </button>
    </div>
  </div>
</template>


<script>
export default {
  name: 'ControlPanel',
  props: {
    currentMode: {
      type: String,
      required: true // The current mode, passed from parent
    }
  },
  data() {
    return {
      modes: ['Play', 'A', '1'], // List of available modes
      actions: ['Open', 'Save', 'Game Info'] // Top row buttons
    };
  },
  methods: {
    selectMode(mode) {
      this.$emit('mode-selected', mode); // Emit selected mode to parent
    },
    selectAction(action) {
      this.$emit('action-selected', action); // Emit selected action to parent
    }
  }
};
</script>


<style scoped>
.control-panel {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin: 10px 0;
  align-items: center;
}

/* Top row styles */
.top-row {
  display: flex;
  gap: 10px;
  justify-content: center;
}

.action-button {
  padding: 10px 20px;
  font-size: 16px;
  border: 1px solid #ccc;
  border-radius: 5px;
  cursor: pointer;
  transition: background-color 0.3s, color 0.3s;
  background-color: #f0f0f0;
}

.action-button:hover {
  background-color: #ddd;
}

/* Bottom row styles */
.bottom-row {
  display: flex;
  gap: 10px;
  justify-content: center;
}

.mode-button {
  padding: 10px 20px;
  font-size: 16px;
  border: 1px solid #ccc;
  border-radius: 5px;
  cursor: pointer;
  transition: background-color 0.3s, color 0.3s;
  background-color: #f0f0f0;
}

.mode-button.active {
  background-color: #007bff;
  color: white;
  border-color: #007bff;
}

.mode-button:hover {
  background-color: #ddd;
}
</style>

