import { describe, it, expect } from 'vitest'
import {
  POLICY_TYPEHASH,
  CHAINS,
  packAccountGasLimits,
  packGasFees,
  randomSalt,
  PM_VERIFICATION_GAS_DEFAULT,
  PM_POSTOP_GAS_DEFAULT,
  BRAND
} from '@sponsor-kit/common'

describe('common basics', () => {
  it('policy typehash is valid', () => expect(POLICY_TYPEHASH).toMatch(/^0x[a-f0-9]{64}$/))
  it('chains configured', () =>
    expect(Object.keys(CHAINS).length).toBeGreaterThan(2))
  it('packers work', () => {
    expect(packAccountGasLimits(100000n, 200000n)).toMatch(/^0x[a-f0-9]{64}$/)
    expect(packGasFees(1n, 2n)).toMatch(/^0x[a-f0-9]{64}$/)
  })
  it('randomSalt works in Node via WebCrypto', () =>
    expect(randomSalt()).toMatch(/^0x[a-f0-9]{64}$/))
  it('PM gas defaults are sane', () => {
    expect(PM_VERIFICATION_GAS_DEFAULT).toBeGreaterThan(0n)
    expect(PM_POSTOP_GAS_DEFAULT).toBeGreaterThan(0n)
  })
  it('BRAND config is set', () => {
    expect(typeof BRAND.name).toBe('string')
    expect((BRAND.name as string).length).toBeGreaterThan(0)
  })
})
