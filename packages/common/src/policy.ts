import type { Address, Hex } from 'viem'
import {
  keccak256,
  encodeAbiParameters,
  getAddress,
  toBytes,
  pad,
  toHex,
  concatHex
} from 'viem'
import type { UserOperation, PolicyV2 } from './index'

export const PM_VERIFICATION_GAS_DEFAULT = 200_000n
export const PM_POSTOP_GAS_DEFAULT = 40_000n

export const POLICY_TYPEHASH = keccak256(
  toBytes(
    'PolicyV2(bytes32 preUserOpHash,uint8 version,address sender,uint48 validUntil,uint48 validAfter,uint256 maxGas,bytes32 salt)'
  )
)

export function packAccountGasLimits(verificationGasLimit: bigint, callGasLimit: bigint): Hex {
  const left = pad(toHex(verificationGasLimit), { size: 16 })
  const right = pad(toHex(callGasLimit), { size: 16 })
  return (left + right.slice(2)) as Hex
}

export function packGasFees(maxPriorityFeePerGas: bigint, maxFeePerGas: bigint): Hex {
  const left = pad(toHex(maxPriorityFeePerGas), { size: 16 })
  const right = pad(toHex(maxFeePerGas), { size: 16 })
  return (left + right.slice(2)) as Hex
}

export function buildPreUserOpHash(
  userOp: Partial<UserOperation>,
  entryPoint: Address,
  chainId: bigint,
  paymaster: Address,
  paymasterVerificationGasLimit: bigint = PM_VERIFICATION_GAS_DEFAULT,
  paymasterPostOpGasLimit: bigint = PM_POSTOP_GAS_DEFAULT
): Hex {
  const accountGasLimits = packAccountGasLimits(
    userOp.verificationGasLimit ?? 0n,
    userOp.callGasLimit ?? 0n
  )
  const gasFees = packGasFees(
    userOp.maxPriorityFeePerGas ?? 0n,
    userOp.maxFeePerGas ?? 0n
  )

  return keccak256(
    encodeAbiParameters(
      [
        { type: 'address' },
        { type: 'uint256' },
        { type: 'bytes32' },
        { type: 'bytes32' },
        { type: 'bytes32' },
        { type: 'uint256' },
        { type: 'bytes32' },
        { type: 'address' },
        { type: 'uint256' },
        { type: 'address' },
        { type: 'uint128' },
        { type: 'uint128' }
      ],
      [
        getAddress(userOp.sender!),
        userOp.nonce ?? 0n,
        keccak256((userOp.initCode ?? '0x') as Hex),
        keccak256((userOp.callData ?? '0x') as Hex),
        accountGasLimits,
        userOp.preVerificationGas ?? 0n,
        gasFees,
        getAddress(entryPoint),
        chainId,
        getAddress(paymaster),
        paymasterVerificationGasLimit,
        paymasterPostOpGasLimit
      ]
    )
  )
}

export function buildPolicyHash(preUserOpHash: Hex, policy: PolicyV2): Hex {
  return keccak256(
    encodeAbiParameters(
      [
        { type: 'bytes32' },
        { type: 'bytes32' },
        { type: 'uint8' },
        { type: 'address' },
        { type: 'uint48' },
        { type: 'uint48' },
        { type: 'uint256' },
        { type: 'bytes32' }
      ],
      [
        POLICY_TYPEHASH,
        preUserOpHash,
        policy.version,
        policy.sender,
        policy.validUntil,
        policy.validAfter,
        policy.maxGas,
        policy.salt
      ]
    )
  )
}

export function packPaymasterAndData(
  paymaster: Address,
  policy: PolicyV2,
  signature: Hex,
  paymasterVerificationGasLimit: bigint = PM_VERIFICATION_GAS_DEFAULT,
  paymasterPostOpGasLimit: bigint = PM_POSTOP_GAS_DEFAULT
): Hex {
  const pmV = pad(toHex(paymasterVerificationGasLimit), { size: 16 })
  const pmP = pad(toHex(paymasterPostOpGasLimit), { size: 16 })

  const encoded = encodeAbiParameters(
    [
      {
        type: 'tuple',
        components: [
          { name: 'version', type: 'uint8' },
          { name: 'sender', type: 'address' },
          { name: 'validUntil', type: 'uint48' },
          { name: 'validAfter', type: 'uint48' },
          { name: 'maxGas', type: 'uint256' },
          { name: 'salt', type: 'bytes32' }
        ]
      },
      { type: 'bytes' }
    ],
    [policy, signature]
  )

  return concatHex([paymaster, pmV, pmP, encoded])
}
