import type { UserOperation, SponsorResponse, ChainKey } from '@sponsor-kit/common'
import { CHAINS, serializeUserOpForBundler } from '@sponsor-kit/common'
import type { Address } from 'viem'

export * from '@sponsor-kit/common'

export class SponsorKitError extends Error {
  constructor(
    public code: string,
    message: string,
    public httpStatus?: number,
    public details?: any
  ) {
    super(message)
  }
}

export interface SponsorKitConfig {
  apiUrl: string
  apiKey?: string
  chainId: number
  bundlerUrl?: string
  entryPoint?: Address
}

export interface SponsorKitSponsorOptions {
  ttlSec?: number
  maxGas?: string | number | bigint
  idempotencyKey?: string
}

function serializeUserOpForApi(userOp: Partial<UserOperation>): any {
  const b = (v: bigint | undefined) => (v !== undefined ? v.toString() : undefined)
  return {
    ...userOp,
    nonce: b(userOp.nonce),
    callGasLimit: b(userOp.callGasLimit),
    verificationGasLimit: b(userOp.verificationGasLimit),
    preVerificationGas: b(userOp.preVerificationGas),
    maxFeePerGas: b(userOp.maxFeePerGas),
    maxPriorityFeePerGas: b(userOp.maxPriorityFeePerGas)
  }
}

function normalizeMaxGas(maxGas: string | number | bigint | undefined): string | undefined {
  if (maxGas === undefined) return undefined
  if (typeof maxGas === 'string') return maxGas
  if (typeof maxGas === 'bigint') return maxGas.toString()
  if (Number.isFinite(maxGas)) return Math.trunc(maxGas).toString()
  throw new SponsorKitError('INVALID_MAX_GAS', 'maxGas must be string | number | bigint')
}

export class SponsorKitClient {
  constructor(private config: SponsorKitConfig) {}

  async sponsor(
    userOp: Partial<UserOperation>,
    options?: SponsorKitSponsorOptions
  ): Promise<SponsorResponse> {
    let res: Response
    const body: any = {
      userOperation: serializeUserOpForApi(userOp),
      chainId: this.config.chainId
    }
    if (options?.ttlSec !== undefined) body.ttlSec = options.ttlSec
    if (options?.maxGas !== undefined) body.maxGas = normalizeMaxGas(options.maxGas)

    try {
      res = await fetch(`${this.config.apiUrl}/v1/sponsor`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(this.config.apiKey && { 'x-api-key': this.config.apiKey }),
          ...(options?.idempotencyKey && { 'Idempotency-Key': options.idempotencyKey })
        },
        body: JSON.stringify(body)
      })
    } catch (e: any) {
      throw new SponsorKitError('NETWORK_ERROR', e?.message || 'Network error calling sponsor')
    }

    let json: any = {}
    try {
      json = await res.json()
    } catch {
      json = {}
    }

    if (!res.ok) {
      throw new SponsorKitError(
        json.code || 'SPONSOR_FAILED',
        json.error || 'Sponsorship failed',
        res.status,
        json
      )
    }
    return json
  }

  async sendUserOperation(userOp: UserOperation, entryPoint?: Address): Promise<string> {
    if (!this.config.bundlerUrl) {
      throw new SponsorKitError('BUNDLER_NOT_CONFIGURED', 'Bundler URL is not configured')
    }
    const ep = entryPoint ?? this.config.entryPoint
    if (!ep) {
      throw new SponsorKitError(
        'ENTRYPOINT_NOT_CONFIGURED',
        'EntryPoint address is not configured'
      )
    }

    let res: Response
    try {
      res = await fetch(this.config.bundlerUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: Date.now(),
          method: 'eth_sendUserOperation',
          params: [serializeUserOpForBundler(userOp), ep]
        })
      })
    } catch (e: any) {
      throw new SponsorKitError('NETWORK_ERROR', e?.message || 'Network error calling bundler')
    }

    let json: any = {}
    try {
      json = await res.json()
    } catch {
      json = {}
    }

    if (!res.ok || json.error) {
      throw new SponsorKitError(
        json.error?.code || 'BUNDLER_ERROR',
        json.error?.message || 'Bundler eth_sendUserOperation failed',
        res.status,
        json
      )
    }
    return json.result as string
  }

  async sponsorAndSend(
    userOp: Partial<UserOperation>,
    signUserOp: (userOp: UserOperation) => Promise<UserOperation>,
    options?: SponsorKitSponsorOptions
  ) {
    const sponsored = await this.sponsor(userOp, options)

    const baseUserOp: UserOperation = {
      ...(userOp as UserOperation),
      paymasterAndData: sponsored.paymasterAndData,
      signature: '0x'
    }

    const signedUserOp = await signUserOp(baseUserOp)
    const userOpHash = await this.sendUserOperation(signedUserOp)
    return { userOpHash, response: sponsored }
  }
}

export function createSponsorKit(
  chain: ChainKey,
  apiKey?: string,
  apiUrl = 'http://localhost:8080'
): SponsorKitClient {
  const chainConfig = CHAINS[chain]
  if (!chainConfig) throw new SponsorKitError('UNSUPPORTED_CHAIN', `Unsupported chain: ${chain}`)
  return new SponsorKitClient({
    apiUrl,
    apiKey,
    chainId: chainConfig.id,
    bundlerUrl: 'bundlerUrl' in chainConfig ? (chainConfig as any).bundlerUrl : undefined,
    entryPoint: chainConfig.entryPoint as Address
  })
}
