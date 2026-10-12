/** Reasons a customer can give when cancelling an order (the shop shows them in mr/hi/en). */
export const CANCEL_REASONS = ["changed_mind", "ordered_by_mistake", "found_cheaper", "delivery_too_late", "other"] as const
export type CancelReason = (typeof CANCEL_REASONS)[number]
