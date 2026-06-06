export const SERVICE_TYPES = ["Quick Service", "Consultation", "Repair"] as const;
export type ServiceType = (typeof SERVICE_TYPES)[number];
