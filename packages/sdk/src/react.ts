'use client'

import { useState, useCallback } from 'react'
import type { UserOperation, SponsorResponse } from '@sponsor-kit/common'
import { SponsorKitClient, SponsorKitError, type SponsorKitSponsorOptions } from './index'

export interface UseSponsorKitState {
  loading: boolean
  error: SponsorKitError | null
}

export function useSponsorKit(client: SponsorKitClient) {
  const [state, setState] = useState<UseSponsorKitState>({ loading: false, error: null })

  const sponsor = useCallback(
    async (
      userOp: Partial<UserOperation>,
      options?: SponsorKitSponsorOptions
    ): Promise<SponsorResponse> => {
      setState({ loading: true, error: null })
      try {
        const res = await client.sponsor(userOp, options)
        setState({ loading: false, error: null })
        return res
      } catch (e: any) {
        const err =
          e instanceof SponsorKitError
            ? e
            : new SponsorKitError('UNKNOWN', e?.message || 'Unknown error')
        setState({ loading: false, error: err })
        throw err
      }
    },
    [client]
  )

  return { sponsor, ...state }
}
