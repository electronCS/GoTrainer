<template>
  <div class="comment-box">
    <textarea
      v-model="comment"
      placeholder="Add a comment..."
      @input="updateComment"
    ></textarea>
  </div>
</template>

<script>
export default {
  name: 'CommentSection',
  props: {
    node: {
      type: Object,
      required: true // Ensure a node object is always passed
    }
  },
  computed: {
    // Safely get the comment, or default to an empty string
    comment: {
      get() {
        return (this.node && this.node.props && this.node.props.C) || ''; // Safe fallback
      },
      set(value) {
        if (this.node && this.node.props) {
          this.$emit('update-comment', value); // Emit an event to update the comment in the parent
        }
      }
    }
  },
  methods: {
    updateComment() {
      if (this.node && this.node.props) {
        this.$emit('update-comment', this.comment); // Safeguard event emission
      }
    }
  }
};
</script>


<style scoped>
.comment-section {
  margin-top: 10px;
}

textarea {
  width: 100%;
  height: 100px;
  resize: none; /* Disable resizing */
  padding: 10px;
  font-size: 16px;
  font-family: Arial, sans-serif;
  border: 1px solid #ccc;
  border-radius: 5px;
  box-sizing: border-box;
}

textarea:focus {
  outline: none;
  border-color: #007bff; /* Highlight border on focus */
}
</style>

