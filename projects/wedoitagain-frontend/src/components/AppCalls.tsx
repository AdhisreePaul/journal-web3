import { useWallet } from '@txnlab/use-wallet-react'
import { useSnackbar } from 'notistack'
import { useEffect, useState } from 'react'
import {AttendanceFactory } from '../contracts/AttendanceClient'
import { OnSchemaBreak, OnUpdate } from '@algorandfoundation/algokit-utils/types/app'
import { getAlgodConfigFromViteEnvironment, getIndexerConfigFromViteEnvironment } from '../utils/network/getAlgoClientConfigs'
import { AlgorandClient } from '@algorandfoundation/algokit-utils'

interface AppCallsInterface {
  openModal: boolean
  setModalState: (value: boolean) => void
}

const AppCalls = ({ openModal, setModalState }: AppCallsInterface) => {
  const [loading, setLoading] = useState<boolean>(false)
  const [fetching, setFetching] = useState<boolean>(false)
  const [presentCount, setPresentCount] = useState<bigint | null>(null)
  const { enqueueSnackbar } = useSnackbar()
  const { transactionSigner, activeAddress } = useWallet()

  const algodConfig = getAlgodConfigFromViteEnvironment()
  const indexerConfig = getIndexerConfigFromViteEnvironment()
  const algorand = AlgorandClient.fromConfig({
    algodConfig,
    indexerConfig,
  })
  algorand.setDefaultSigner(transactionSigner)

  const appid = 745894647
  //
  // 745586193

  const getAppClient = () => {
    const factory = new AttendanceFactory({
      defaultSender: activeAddress ?? undefined,
      algorand,
    })
    return factory.getAppClientById({ appId: BigInt(appid) })
  }

  const getExplorerAppUrl = (appId: string | number | bigint | undefined) => {
    if (appId === undefined || appId === null) return undefined
    const id = appId.toString()
    const net = (algodConfig.network || '').toLowerCase()
    if (net.includes('main')) return `https://algoexplorer.io/application/${id}`
    if (net.includes('test')) return `https://lora.algokit.io/testnet/application/${id}`
    if (net.includes('beta')) return `https://betanet.algoexplorer.io/application/${id}`
    return undefined
  }

  const fetchPresent = async () => {
    if (!activeAddress) return
    setFetching(true)
    try {
      const client = getAppClient()
      const value = await client.state.global.present()
      setPresentCount(value ?? BigInt(0))
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      enqueueSnackbar(`Error fetching attendance: ${message}`, { variant: 'error' })
    } finally {
      setFetching(false)
    }
  }

  useEffect(() => {
    if (openModal) {
      void fetchPresent()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openModal, activeAddress])

  const sendAppCall = async () => {
    if (!activeAddress) {
      enqueueSnackbar('Please connect a wallet first.', { variant: 'warning' })
      return
    }

    setLoading(true)

    try {
      const appClient = getAppClient()
      const response = await appClient.send.markPresent()
      enqueueSnackbar(`Response from the contract: ${response.return}`, { variant: 'success' })
      await fetchPresent()

      const url = getExplorerAppUrl(appid)
      enqueueSnackbar(
        <span>
          App ID: <code className="px-1 py-0.5 bg-base-200 rounded">{appid}</code>{' '}
          {url ? (
            <a className="link link-primary" href={url} target="_blank" rel="noreferrer">
              View application
            </a>
          ) : null}
        </span>,
        { variant: 'info', autoHideDuration: 8000 }
      )
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      enqueueSnackbar(`Error calling the contract: ${message}`, { variant: 'error' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <dialog id="appcalls_modal" className={`modal ${openModal ? 'modal-open' : ''} bg-slate-200`}>
      <form method="dialog" className="modal-box">
        <h3 className="font-bold text-lg">Say hello to your Algorand smart contract</h3>
        <br />

        <div className="grid gap-4">
          <div className="card bg-base-100 shadow">
            <div className="card-body">
              <h2 className="card-title">Attendance</h2>
              <p className="text-sm opacity-70">Global present counter</p>
              <div className="flex items-center gap-3 mt-2">
                <div className="stat place-items-center p-0">
                  <div className="stat-title">Present</div>
                  <div className="stat-value text-primary">
                    {presentCount !== null ? presentCount.toString() : '—'}
                  </div>
                </div>
                <button type="button" className={`btn btn-ghost btn-sm ${fetching ? 'loading' : ''}`} onClick={(e) => { e.preventDefault(); void fetchPresent() }}>
                  {fetching ? '' : 'Refresh'}
                </button>
              </div>
            </div>
          </div>
        </div>
        
        <div className="modal-action ">
          <button className="btn" onClick={() => setModalState(!openModal)}>
            Close
          </button>
          <button className={`btn`} onClick={(e) => { e.preventDefault(); void sendAppCall(); }}>
            {loading ? <span className="loading loading-spinner" /> : 'Mark present'}
          </button>
        </div>
      </form>
      <div className="modal-action">
        
      </div>
    </dialog>
  )
}

export default AppCalls;
