/**
 * F0.2 quarantine boundary.
 * The concierge no longer exports booking mutations or communication actions.
 */
export {
  createConciergeReadModel,
  type ConciergeReadModel,
  type SafeBookingProjection,
} from './concierge-read-model.js';
