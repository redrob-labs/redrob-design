import { ref } from 'vue'

/**
 * True on the `/demo` route. Services with no real backend yet answer from
 * the prototype's sample data here, and say "not connected" everywhere else.
 */
export const demoMode = ref(false)
