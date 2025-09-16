import { useWallet } from '@txnlab/use-wallet-react'
import { useSnackbar } from 'notistack'
import { useEffect, useState } from 'react'
import { TokenVestingFactory } from '../contracts/TokenVestingClient'
import { getAlgodConfigFromViteEnvironment, getIndexerConfigFromViteEnvironment } from '../utils/network/getAlgoClientConfigs'
import { AlgorandClient } from '@algorandfoundation/algokit-utils'
import algosdk from 'algosdk'

interface AppCallsInterface {
  openModal: boolean
  setModalState: (value: boolean) => void
}

const AppCalls = ({ openModal, setModalState }: AppCallsInterface) => {
  const [loading, setLoading] = useState(false)
  const [fetching, setFetching] = useState(false)
  const [vestingInfo, setVestingInfo] = useState<any | null>(null)
  const [asaId, setAsaId] = useState<number | null>(null)

  const { enqueueSnackbar } = useSnackbar()
  const { transactionSigner, activeAddress } = useWallet()

  const algodConfig = getAlgodConfigFromViteEnvironment()
  const indexerConfig = getIndexerConfigFromViteEnvironment()
  const algorand = AlgorandClient.fromConfig({ algodConfig, indexerConfig })
  algorand.setDefaultSigner(transactionSigner)

  const appId = 745896679 // deployed vesting contract app ID

  const getAppClient = () => {
    const factory = new TokenVestingFactory({
      defaultSender: activeAddress ?? undefined,
      algorand,
    })
    return factory.getAppClientById({ appId: BigInt(appId) })
  }

  // ----------------------------
  // Deploy a new ASA token
  // ----------------------------
  const deployToken = async () => {
    if (!activeAddress) {
      enqueueSnackbar('Connect a wallet first', { variant: 'warning' })
      return
    }

    setLoading(true)
    try {
      const params = await algorand.getSuggestedParams()
      const txn = algosdk.makeAssetCreateTxnWithSuggestedParamsFromObject({
        from: activeAddress,
        total: 1_000_000, // total supply
        decimals: 0,
        defaultFrozen: false,
        unitName: 'VEST',
        assetName: 'VestingToken',
        manager: activeAddress,
        reserve: activeAddress,
        freeze: activeAddress,
        clawback: activeAddress,
        suggestedParams: params
      })

      const signedTxn = await transactionSigner?.signTransaction(txn)
      if (!signedTxn) throw new Error('Transaction signing failed')

      const { txId } = await algorand.algod.sendRawTransaction(signedTxn).do()
      const confirmed = await algosdk.waitForConfirmation(algorand.algod, txId, 4)
      const newAsaId = confirmed['asset-index']
      setAsaId(newAsaId)
      enqueueSnackbar(`Token deployed! ASA ID: ${newAsaId}`, { variant: 'success' })
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      enqueueSnackbar(`Error deploying token: ${msg}`, { variant: 'error' })
    } finally {
      setLoading(false)
    }
  }

  // ----------------------------
  // Fetch vesting info
  // ----------------------------
  const fetchVestingInfo = async () => {
    if (!activeAddress) return
    setFetching(true)
    try {
      const client = getAppClient()
      const info = await client.send.getVestingInfo()

      const [
        employerBytes,
        employeeBytes,
        tokenId,
        total,
        start,
        cliff,
        duration,
        claimed,
        vested,
        claimable,
      ] = info.return

      const decoded = {
        employer: algosdk.encodeAddress(new Uint8Array(employerBytes)),
        employee: algosdk.encodeAddress(new Uint8Array(employeeBytes)),
        tokenId: tokenId.toString(),
        total: total.toString(),
        start: new Date(Number(start) * 1000).toLocaleString(),
        cliff: new Date(Number(cliff) * 1000).toLocaleString(),
        duration: `${Number(duration)} sec`,
        claimed: claimed.toString(),
        vested: vested.toString(),
        claimable: claimable.toString(),
      }

      setVestingInfo(decoded)
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      enqueueSnackbar(`Error fetching vesting info: ${msg}`, { variant: 'error' })
    } finally {
      setFetching(false)
    }
  }

  // ----------------------------
  // Claim tokens
  // ----------------------------
  const claimTokens = async () => {
    if (!activeAddress) {
      enqueueSnackbar('Please connect a wallet first.', { variant: 'warning' })
      return
    }

    setLoading(true)
    try {
      const client = getAppClient()
      await client.send.claim()
      enqueueSnackbar(`Claim successful!`, { variant: 'success' })
      await fetchVestingInfo()
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      enqueueSnackbar(`Error claiming tokens: ${msg}`, { variant: 'error' })
    } finally {
      setLoading(false)
    }
  }

  // ----------------------------
  // Create vesting (employer only)
  // ----------------------------
  const createVesting = async () => {
    if (!activeAddress) {
      enqueueSnackbar('Connect a wallet first', { variant: 'warning' })
      return
    }

    if (!asaId) {
      enqueueSnackbar('Deploy a token first', { variant: 'warning' })
      return
    }

    setLoading(true)
    try {
      const client = getAppClient()

      // Example values
      const employeeAddress = algosdk.decodeAddress('OA57DAFKUMATT3WK3DPJP7XZEFIXHRN7DAWR72YTOKYECVI3AOP2VYJQIE').publicKey
      const totalTokens = BigInt(1000)
      const startTime = BigInt(Math.floor(Date.now() / 1000))
      const cliffTime = startTime + BigInt(60) // 1 min later
      const duration = BigInt(3600) // 1 hour

      await client.send.createVesting({
        args: [
          employeeAddress,
          BigInt(asaId),
          totalTokens,
          startTime,
          cliffTime,
          duration
        ]
      })

      enqueueSnackbar('Vesting created successfully!', { variant: 'success' })
      await fetchVestingInfo()
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      enqueueSnackbar(`Error creating vesting: ${msg}`, { variant: 'error' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (openModal) void fetchVestingInfo()
  }, [openModal, activeAddress])

  return (
    <dialog id="vesting_modal" className={`modal ${openModal ? 'modal-open' : ''} bg-slate-200`}>
      <form method="dialog" className="modal-box">
        <h3 className="font-bold text-lg">Token Vesting Contract</h3>
        <br />

        <div className="grid gap-4">
          <div className="card bg-base-100 shadow">
            <div className="card-body">
              <h2 className="card-title">Vesting Info</h2>
              <p className="text-sm opacity-70">Details from contract</p>
              {vestingInfo ? (
                <pre className="text-xs bg-gray-100 p-2 rounded whitespace-pre-wrap">
                  {JSON.stringify(vestingInfo, null, 2)}
                </pre>
              ) : (
                <p>No info loaded</p>
              )}
              <button
                type="button"
                className={`btn btn-ghost btn-sm ${fetching ? 'loading' : ''}`}
                onClick={(e) => {
                  e.preventDefault()
                  void fetchVestingInfo()
                }}
              >
                {fetching ? '' : 'Refresh'}
              </button>
            </div>
          </div>
        </div>

        <div className="modal-action flex flex-col gap-2">
          <button className="btn" onClick={() => setModalState(!openModal)}>Close</button>
          <button className="btn btn-success" onClick={(e) => { e.preventDefault(); void deployToken() }}>
            {loading ? <span className="loading loading-spinner" /> : 'Deploy Token'}
          </button>
          <button className="btn btn-primary" onClick={(e) => { e.preventDefault(); void createVesting() }}>
            {loading ? <span className="loading loading-spinner" /> : 'Create Vesting'}
          </button>
          <button className="btn btn-secondary" onClick={(e) => { e.preventDefault(); void claimTokens() }}>
            {loading ? <span className="loading loading-spinner" /> : 'Claim Tokens'}
          </button>
        </div>
      </form>
    </dialog>
  )
}

export default AppCalls
