export function serializeUserOpForBundler(userOp: any): any {
  const toHex = (v: bigint | undefined) => (v !== undefined ? '0x' + v.toString(16) : undefined)
  return {
    ...userOp,
    nonce: userOp.nonce !== undefined ? toHex(userOp.nonce) : undefined,
    callGasLimit: userOp.callGasLimit !== undefined ? toHex(userOp.callGasLimit) : undefined,
    verificationGasLimit: userOp.verificationGasLimit !== undefined ? toHex(userOp.verificationGasLimit) : undefined,
    preVerificationGas: userOp.preVerificationGas !== undefined ? toHex(userOp.preVerificationGas) : undefined,
    maxFeePerGas: userOp.maxFeePerGas !== undefined ? toHex(userOp.maxFeePerGas) : undefined,
    maxPriorityFeePerGas: userOp.maxPriorityFeePerGas !== undefined ? toHex(userOp.maxPriorityFeePerGas) : undefined
  }
}
