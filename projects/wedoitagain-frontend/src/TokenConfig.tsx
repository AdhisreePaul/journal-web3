/** src/TokenConfig.tsx
 * Type definitions and helper functions expected by src/components/AppCalls.tsx
 * These helpers are stubs so TypeScript compiles; replace stubbed ASA creation with real Algorand SDK logic later.
 */

import type { AlgorandClient } from '@algorandfoundation/algokit-utils'

export type TokenConfig = {
  total: number
  decimals: number
  defaultFrozen: boolean
  unitName: string
  assetName: string
  assetURL?: string
  url?: string
  metadata?: Record<string, unknown>
  manager?: string
  reserve?: string
  freeze?: string
  clawback?: string
}

// result object expected by the frontend
export type CreateTokenResult = {
  asaId: number
  txId: string
  confirmedRound: number
  tokenConfig: TokenConfig
}

export function defaultTokenConfig(): TokenConfig {
  return {
    total: 1_000_000,
    decimals: 0,
    defaultFrozen: false,
    unitName: 'CUSTOM',
    assetName: 'Custom Token',
    assetURL: '',
    metadata: {},
  }
}

// validateTokenConfig returns { isValid, errors } (AppCalls expects .isValid)
export function validateTokenConfig(cfg: Partial<TokenConfig>): { isValid: boolean; errors: string[] } {
  const errors: string[] = []
  if (typeof cfg.total !== 'number' || !Number.isFinite(cfg.total) || cfg.total <= 0) {
    errors.push('total must be a positive number')
  }
  if (typeof cfg.decimals !== 'number' || cfg.decimals < 0 || cfg.decimals > 19) {
    errors.push('decimals must be a non-negative number (0-19 recommended)')
  }
  if (typeof cfg.defaultFrozen !== 'boolean') {
    errors.push('defaultFrozen must be boolean')
  }
  if (!cfg.unitName || String(cfg.unitName).length > 8) {
    errors.push('unitName must be non-empty and at most 8 characters (Algorand limit)')
  }
  if (!cfg.assetName || String(cfg.assetName).length > 32) {
    errors.push('assetName must be non-empty and at most 32 characters (Algorand limit)')
  }
  for (const key of ['manager','reserve','freeze','clawback'] as const) {
    const v = (cfg as any)[key]
    if (v !== undefined && typeof v !== 'string') {
      errors.push(`${key} must be an address string`)
    }
  }
  return { isValid: errors.length === 0, errors }
}

// createSampleMetadata(title, description, imageUrl)
export function createSampleMetadata(title?: string, description?: string, imageUrl?: string) {
  return {
    title: title ?? 'Demo Token',
    description: description ?? 'Token created by the demo frontend',
    image: imageUrl ?? '',
    external_url: '',
  }
}

/*
  Async helpers used by AppCalls.tsx
  - createDefaultToken() has overload: zero-arg (local) OR (algorand, transactionSigner, activeAddress, customConfig?)
  - createTokenWithMetadata(algorand, transactionSigner, activeAddress, metadata, tokenCfg)
  These are stubs — replace with actual Algorand transaction creation and confirmation.
*/

export async function createDefaultToken(): Promise<CreateTokenResult>
export async function createDefaultToken(algorand: AlgorandClient, transactionSigner: any, activeAddress: string, customConfig?: Partial<TokenConfig>): Promise<CreateTokenResult>
export async function createDefaultToken(...args: any[]): Promise<CreateTokenResult> {
  if (args.length === 0) {
    const cfg = defaultTokenConfig()
    return { asaId: 0, txId: '', confirmedRound: 0, tokenConfig: cfg }
  }
  // stubbed on-chain creation; replace with real ASA create + waitForConfirmation logic
  const customConfig = args[3] ?? {}
  const cfg: TokenConfig = { ...defaultTokenConfig(), ...(customConfig as any) }
  return { asaId: 123456, txId: 'TXID_STUB', confirmedRound: 0, tokenConfig: cfg }
}

export async function createTokenWithMetadata(algorand: AlgorandClient, transactionSigner: any, activeAddress: string, metadata: Record<string, unknown>, tokenCfg: Partial<TokenConfig>): Promise<CreateTokenResult> {
  const cfg: TokenConfig = { ...defaultTokenConfig(), ...(tokenCfg ?? {}), metadata, assetURL: (tokenCfg as any).assetURL ?? '' }
  
  try {
    // Create the ASA token on Algorand
    const result = await algorand.send.assetCreate({
      signer: transactionSigner,
      sender: activeAddress,
      total: BigInt(cfg.total),
      decimals: cfg.decimals,
      defaultFrozen: cfg.defaultFrozen,
      unitName: cfg.unitName,
      assetName: cfg.assetName,
      url: cfg.assetURL,
      manager: cfg.manager || activeAddress,
      reserve: cfg.reserve || activeAddress,
      freeze: cfg.freeze || activeAddress,
      clawback: cfg.clawback || activeAddress,
    })

    return { 
      asaId: Number(result.assetId), 
      txId: result.transaction.txID(), 
      confirmedRound: Number(result.confirmation?.confirmedRound || 0), 
      tokenConfig: cfg 
    }
  } catch (error) {
    console.error('Error creating token with metadata:', error)
    throw error
  }
}
