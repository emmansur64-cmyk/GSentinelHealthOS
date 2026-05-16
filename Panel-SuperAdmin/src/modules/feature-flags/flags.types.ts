export type FlagScope = 'global' | 'per-tenant'

export interface FeatureFlag {
  key: string
  label: string
  description: string
  enabled: boolean
  scope: FlagScope
  module: string
  updatedAt: string
  updatedBy?: string
}

export interface FlagTogglePayload {
  key: string
  enabled: boolean
}
