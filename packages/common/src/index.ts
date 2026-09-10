import { z } from 'zod'
import type { Address, Hex } from 'viem'

export * from './policy'
export * from './errors'
export * from './brand'
export { serializeUserOpForBundler } from './userOp'

export const ENTRYPOINT_V07 = '0x0000000071727De22E5E9d8BAf0edAc6f37da032' as const

export const CHAINS = {
  base: {
    id: 8453,
    name: 'Base',
    entryPoint: ENTRYPOINT_V07,
    testnet: false,
    rpcUrl: 'https://mainnet.base.org',
    bundlerUrl: 'https://api.pimlico.io/v2/base/rpc'
  },
  'base-sepolia': {
    id: 84532,
    name: 'Base Sepolia',
    entryPoint: ENTRYPOINT_V07,
    testnet: true,
    rpcUrl: 'https://sepolia.base.org',
    bundlerUrl: 'https://api.pimlico.io/v2/base-sepolia/rpc'
  },
  optimism: { id: 10, name: 'Optimism', entryPoint: ENTRYPOINT_V07, testnet: false, rpcUrl: 'https://mainnet.optimism.io' },
  arbitrum: { id: 42161, name: 'Arbitrum', entryPoint: ENTRYPOINT_V07, testnet: false, rpcUrl: 'https://arb1.arbitrum.io/rpc' },
  polygon:  { id: 137, name: 'Polygon',  entryPoint: ENTRYPOINT_V07, testnet: false, rpcUrl: 'https://polygon-rpc.com' }
} as const

export type ChainKey = keyof typeof CHAINS

export interface UserOperation {
  sender: Address
  nonce: bigint
  initCode: Hex
  callData: Hex
  callGasLimit: bigint
  verificationGasLimit: bigint
  preVerificationGas: bigint
  maxFeePerGas: bigint
  maxPriorityFeePerGas: bigint
  paymasterAndData: Hex
  signature: Hex
}

const bigintString = z
  .string()
  .min(1)
  .refine((v) => /^(\d+|0x[0-9a-fA-F]+)$/.test(v), 'Expected bigint string (decimal or 0x-hex)')
  .transform((v) => BigInt(v))

export const userOperationSchema = z.object({
  sender: z.string().regex(/^0x[0-9a-fA-F]{40}$/),
  nonce: bigintString,
  initCode: z.string().regex(/^0x[0-9a-fA-F]*$/).default('0x'),
  callData: z.string().regex(/^0x[0-9a-fA-F]*$/),
  callGasLimit: bigintString,
  verificationGasLimit: bigintString,
  preVerificationGas: bigintString,
  maxFeePerGas: bigintString,
  maxPriorityFeePerGas: bigintString
})

export interface PolicyV2 {
  version: 2
  sender: Address
  validUntil: number
  validAfter: number
  maxGas: bigint
  salt: Hex
}
export interface ApiPolicyV2 extends Omit<PolicyV2, 'maxGas'> { maxGas: string }

export const PLANS = {
  free:       { name: 'Free',       ops: 1000,    chains: 2,  price: 0,   features: ['1K ops/mo', '2 chains', 'Community support'] },
  starter:    { name: 'Starter',    ops: 50000,   chains: 5,  price: 29,  features: ['50K ops/mo', '5 chains', 'Email support', 'Webhooks'] },
  pro:        { name: 'Pro',        ops: 500000,  chains: -1, price: 199, features: ['500K ops/mo', 'All chains', 'Priority support'] },
  enterprise: { name: 'Enterprise', ops: -1,      chains: -1, price: 999, features: ['Unlimited', 'All chains', 'Dedicated support', 'Custom SLA'] }
} as const

export type PlanKey = keyof typeof PLANS
export const PLAN_LIMITS: Record<string, number> = {
  FREE: PLANS.free.ops,
  STARTER: PLANS.starter.ops,
  PRO: PLANS.pro.ops,
  ENTERPRISE: PLANS.enterprise.ops
}

export interface SponsorResponse {
  paymasterAndData: Hex
  policy: ApiPolicyV2
  expiresAt: number
}

export const randomSalt = (): Hex => {
  const g: any = globalThis as any
  const c = g.crypto
  if (!c?.getRandomValues) {
    throw new Error('WebCrypto is not available; Node.js 22+ required')
  }
  const bytes = new Uint8Array(32)
  c.getRandomValues(bytes)
  return ('0x' + Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('')) as Hex
}
