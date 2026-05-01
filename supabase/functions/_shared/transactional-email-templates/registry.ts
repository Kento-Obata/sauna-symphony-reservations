/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'

export interface TemplateEntry {
  component: React.ComponentType<any>
  subject: string | ((data: Record<string, any>) => string)
  to?: string
  displayName?: string
  previewData?: Record<string, any>
}

import { template as reservationPending } from './reservation-pending.tsx'
import { template as reservationConfirmed } from './reservation-confirmed.tsx'
import { template as reservationReceived } from './reservation-received.tsx'

export const TEMPLATES: Record<string, TemplateEntry> = {
  'reservation-pending': reservationPending,
  'reservation-confirmed': reservationConfirmed,
  'reservation-received': reservationReceived,
}
