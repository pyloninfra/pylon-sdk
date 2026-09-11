# Pylon — Gasless Transactions SDK for Base

Production-grade ERC-4337 paymaster SDK and smart contracts. Sponsor gas
for your users on Base — they never need to hold ETH.

## Live Demo

🎥 **Demo video:** https://youtu.be/GFK45UYLqjA?si=xDtjo7XFdUhqfgCH

✅ **Verified on-chain transaction (Base Sepolia):**
https://sepolia.basescan.org/tx/0x37343b68b53e1e4c9ea35343fbdf10b88a757966678bac098dc67ea8eb050af3

The smart account in that transaction paid **zero gas** — the paymaster
covered the entire cost.

## Deployed Contracts (Base Sepolia)

| Contract | Address |
|---|---|
| PylonPaymasterV2 (proxy) | `0xE9DA15295cF4e436Ed93d6CF287122f196130707` |
| PylonPaymasterV2 (implementation) | `0x3B3FC6E377a241392fa46d0a6dddbfcab2a687F0` |
| SessionKeyManager | `0x97DF69892B5d3d1237a47a5BFA70a190F92197cC` |
| SimpleAccountFactory | `0xF1897165fBBE0Cfcc195B4698CcbD4b26d569c4f` |
| EntryPoint (v0.7, standard) | `0x0000000071727De22E5E9d8BAf0edAc6f37da032` |

## What's in this repo

- `packages/sdk` — TypeScript/React SDK for requesting gas sponsorship
- `packages/common` — shared types, policy signing, UserOperation helpers
- `contracts/` — the paymaster and account contracts (Solidity, Foundry)

The hosted API, dashboard, and billing system that power the managed
version of this service are maintained in a private repository.

## Quick start (SDK)

```bash
pnpm add @pylon/sdk
```

```ts
import { createSponsorKit } from '@pylon/sdk'

const client = createSponsorKit('base', process.env.PYLON_API_KEY)
const { paymasterAndData } = await client.sponsor(userOp)
```

## Building the contracts

```bash
cd contracts
forge install
forge build
```

## License

MIT
