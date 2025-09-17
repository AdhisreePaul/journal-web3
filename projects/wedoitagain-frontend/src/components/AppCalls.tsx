import { useWallet } from '@txnlab/use-wallet-react'
import { useSnackbar } from 'notistack'
import { useState } from 'react'
import { getAlgodConfigFromViteEnvironment, getIndexerConfigFromViteEnvironment } from '../utils/network/getAlgoClientConfigs'
import { AlgorandClient } from '@algorandfoundation/algokit-utils'
import {
  createTokenWithMetadata,
  createSampleMetadata,
  validateTokenConfig,
  type TokenConfig
} from '../TokenConfig'

interface AppCallsInterface {
  openModal: boolean
  setModalState: (value: boolean) => void
}

interface TokenMetadata extends Record<string, unknown> {
  name: string
  description: string
  image: string
  attributes?: Array<{
    trait_type: string
    value: string | number
  }>
  external_url?: string
}

const AppCalls = ({ openModal, setModalState }: AppCallsInterface) => {
  const [loading, setLoading] = useState(false)
  const [asaId, setAsaId] = useState<number | null>(null)
  const [tokenMetadata, setTokenMetadata] = useState<TokenMetadata | null>(null)
  const [urlValidation, setUrlValidation] = useState<{ isValid: boolean; message: string } | null>(null)
  const [imageUrlValidation, setImageUrlValidation] = useState<{ isValid: boolean; message: string } | null>(null)
  const [customConfig, setCustomConfig] = useState<Partial<TokenConfig>>({
    total: 1_000_000,
    decimals: 0,
    unitName: 'NFT',
    assetName: 'My NFT Token',
    assetURL: '',
  })
  const [imageUrl, setImageUrl] = useState<string>('')
  const [nftName, setNftName] = useState<string>('')
  const [nftDescription, setNftDescription] = useState<string>('')

  const { enqueueSnackbar } = useSnackbar()
  const { transactionSigner, activeAddress } = useWallet()

  const algodConfig = getAlgodConfigFromViteEnvironment()
  const indexerConfig = getIndexerConfigFromViteEnvironment()
  const algorand = AlgorandClient.fromConfig({ algodConfig, indexerConfig })
  algorand.setDefaultSigner(transactionSigner)

  // ----------------------------
  // Validate Metadata URL
  // ----------------------------
  const validateImageUrl = (url: string): { isValid: boolean; message: string } => {
    if (!url) {
      return { isValid: false, message: 'Please enter an image URL' }
    }

    // Handle bare IPFS hashes
    if (url.startsWith('Qm') || url.startsWith('bafy')) {
      return { isValid: true, message: 'IPFS hash detected - will be converted to ipfs:// format' }
    }

    // Handle Pinata URLs
    if (url.includes('mypinata.cloud/ipfs/')) {
      return { isValid: true, message: 'Pinata URL detected - will extract IPFS hash' }
    }

    try {
      const urlObj = new URL(url.startsWith('ipfs://') ? url.replace('ipfs://', 'https://ipfs.io/ipfs/') : url)
      
      // Check if it's a valid protocol
      if (!['http:', 'https:'].includes(urlObj.protocol)) {
        return { isValid: false, message: 'URL must use HTTP or HTTPS protocol' }
      }

      return { isValid: true, message: 'Image URL looks valid' }
    } catch (e) {
      return { isValid: false, message: 'Invalid URL format' }
    }
  }

  const validateMetadataUrl = (url: string): { isValid: boolean; message: string } => {
    if (!url) {
      return { isValid: false, message: 'Please enter a metadata URL' }
    }

    // Handle bare IPFS hashes
    if (url.startsWith('Qm') || url.startsWith('bafy')) {
      return { isValid: true, message: 'IPFS hash detected - will be converted to gateway URL' }
    }

    try {
      const urlObj = new URL(url.startsWith('ipfs://') ? url.replace('ipfs://', 'https://ipfs.io/ipfs/') : url)
      
      // Check if it's a valid protocol
      if (!['http:', 'https:'].includes(urlObj.protocol)) {
        return { isValid: false, message: 'URL must use HTTP or HTTPS protocol' }
      }

      // Suggest common file extensions
      const pathname = urlObj.pathname.toLowerCase()
      if (!pathname.endsWith('.json') && !pathname.includes('metadata')) {
        return { 
          isValid: true, 
          message: 'Warning: URL doesn\'t appear to be a JSON file. Make sure it points to a valid JSON metadata file.' 
        }
      }

      return { isValid: true, message: 'URL looks valid' }
    } catch (e) {
      return { isValid: false, message: 'Invalid URL format' }
    }
  }

  // ----------------------------
  // Create Metadata from Image
  // ----------------------------
  const createMetadataFromImage = (imageUrl: string, name: string, description: string): TokenMetadata => {
    // Convert Pinata URL to IPFS format if needed
    let processedImageUrl = imageUrl
    if (imageUrl.includes('mypinata.cloud/ipfs/')) {
      // Extract IPFS hash from Pinata URL
      const ipfsHash = imageUrl.split('/ipfs/')[1]
      processedImageUrl = `ipfs://${ipfsHash}`
    } else if (imageUrl.includes('ipfs.io/ipfs/')) {
      // Convert IPFS gateway URL to ipfs:// format
      const ipfsHash = imageUrl.split('/ipfs/')[1]
      processedImageUrl = `ipfs://${ipfsHash}`
    }

    return {
      name: name || 'My NFT',
      description: description || 'An NFT created with this app',
      image: processedImageUrl,
      attributes: [
        {
          trait_type: 'Created By',
          value: 'NFT Deployer App'
        },
        {
          trait_type: 'Image Source',
          value: 'Pinata IPFS'
        }
      ],
      external_url: ''
    }
  }

  // ----------------------------
  // Deploy Token with Image-Only Metadata
  // ----------------------------
  const deployTokenWithImage = async () => {
    if (!activeAddress) {
      enqueueSnackbar('Connect a wallet first', { variant: 'warning' })
      return
    }

    if (!imageUrl) {
      enqueueSnackbar('Please provide an image URL', { variant: 'warning' })
      return
    }

    setLoading(true)
    try {
      // Create metadata automatically from image
      const metadata = createMetadataFromImage(imageUrl, nftName, nftDescription)
      
      // Validate configuration
      const fullConfig: TokenConfig = {
        total: 1_000_000,
        decimals: 0,
        defaultFrozen: false,
        unitName: 'NFT',
        assetName: 'NFT Token',
        manager: activeAddress,
        reserve: activeAddress,
        freeze: activeAddress,
        clawback: activeAddress,
        ...customConfig,
        assetURL: JSON.stringify(metadata) // Store metadata as JSON string
      }

      const validation = validateTokenConfig(fullConfig)
      if (!validation.isValid) {
        enqueueSnackbar(`Invalid token configuration: ${validation.errors.join(', ')}`, {
          variant: 'error'
        })
        return
      }

      // Create token with auto-generated metadata
      const result = await createTokenWithMetadata(
        algorand,
        transactionSigner,
        activeAddress,
        metadata,
        fullConfig
      )

      setAsaId(result.asaId)
      setTokenMetadata(metadata)

      enqueueSnackbar(
        `Token deployed successfully! ASA ID: ${result.asaId}`,
        { variant: 'success' }
      )

      console.log('Token Creation Details:', {
        asaId: result.asaId,
        txId: result.txId,
        confirmedRound: result.confirmedRound,
        tokenConfig: result.tokenConfig,
        metadata: metadata
      })

    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      enqueueSnackbar(`Error deploying token: ${msg}`, { variant: 'error' })
      console.error('Token deployment error:', e)
    } finally {
      setLoading(false)
    }
  }

  // ----------------------------
  // Deploy Token with IPFS Metadata
  // ----------------------------
  const deployTokenWithIPFS = async () => {
    if (!activeAddress) {
      enqueueSnackbar('Connect a wallet first', { variant: 'warning' })
      return
    }

    if (!customConfig.assetURL) {
      enqueueSnackbar('Please provide a metadata URL', { variant: 'warning' })
      return
    }

    setLoading(true)
    try {
      // Validate configuration
      const fullConfig: TokenConfig = {
        total: 1_000_000,
        decimals: 0,
        defaultFrozen: false,
        unitName: 'NFT',
        assetName: 'NFT Token',
        manager: activeAddress,
        reserve: activeAddress,
        freeze: activeAddress,
        clawback: activeAddress,
        ...customConfig
      }

      const validation = validateTokenConfig(fullConfig)
      if (!validation.isValid) {
          enqueueSnackbar(`Invalid token configuration: ${validation.errors.join(', ')}`, {
            variant: 'error'
          })
        return
      }

      // Create token with IPFS metadata
      const result = await createTokenWithMetadata(
        algorand,
        transactionSigner,
        activeAddress,
        { ipfs_url: customConfig.assetURL },
        fullConfig
      )

      setAsaId(result.asaId)

      // Try to fetch metadata for display (non-blocking)
      try {
        await fetchMetadataFromUrl(customConfig.assetURL!)
      } catch (metadataError) {
        console.warn('Metadata fetch failed, but token was deployed successfully:', metadataError)
        // Don't show error to user since token deployment succeeded
      }

        enqueueSnackbar(
        `Token deployed successfully! ASA ID: ${result.asaId}`,
          { variant: 'success' }
        )

      console.log('Token Creation Details:', {
        asaId: result.asaId,
        txId: result.txId,
        confirmedRound: result.confirmedRound,
        tokenConfig: result.tokenConfig,
        ipfsUrl: customConfig.assetURL
      })

    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      enqueueSnackbar(`Error deploying token: ${msg}`, { variant: 'error' })
      console.error('Token deployment error:', e)
    } finally {
      setLoading(false)
    }
  }

  // ----------------------------
  // Fetch Metadata from URL
  // ----------------------------
  const fetchMetadataFromUrl = async (metadataUrl: string) => {
    try {
      let fetchUrl = metadataUrl
      
      // Handle different IPFS URL formats
      if (metadataUrl.startsWith('ipfs://')) {
        fetchUrl = metadataUrl.replace('ipfs://', 'https://ipfs.io/ipfs/')
      } else if (metadataUrl.startsWith('Qm') || metadataUrl.startsWith('bafy')) {
        // Handle bare IPFS hashes (Qm... or bafy...)
        fetchUrl = `https://ipfs.io/ipfs/${metadataUrl}`
      }
      
      console.log('Fetching metadata from:', fetchUrl)
      
      const response = await fetch(fetchUrl)
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }
      
      // Check if the response is actually JSON
      const contentType = response.headers.get('content-type')
      if (!contentType || !contentType.includes('application/json')) {
        // Try to get the response text to see what we actually received
        const responseText = await response.text()
        console.error('Non-JSON response received:', responseText.substring(0, 200))
        throw new Error(`Expected JSON but received ${contentType || 'unknown content type'}. The URL might not point to a valid JSON file.`)
      }
      
      const metadata: TokenMetadata = await response.json()
      
      // Validate that we have the required fields
      if (!metadata.name || !metadata.description) {
        throw new Error('Invalid metadata: missing required fields (name, description)')
      }
      
      setTokenMetadata(metadata)
      console.log('Successfully fetched metadata:', metadata)
      
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      enqueueSnackbar(`Error fetching metadata: ${msg}`, { variant: 'error' })
      console.error('Metadata fetch error:', e)
      
      // Clear any existing metadata on error
      setTokenMetadata(null)
    }
  }

  // ----------------------------
  // NFT Display Component
  // ----------------------------
  const NFTCard = ({ metadata, asaId }: { metadata: TokenMetadata; asaId: number }) => {

    return (
      <div className="card bg-white shadow-2xl max-w-sm border border-gray-200">
        <div className="card-body p-4">
          <div className="flex items-center justify-between mb-2">
            <h2 className="card-title text-lg font-bold text-gray-800">{metadata.name}</h2>
            <div className="badge badge-success badge-sm">✓ Verified</div>
          </div>
          <p className="text-gray-600 text-sm mb-4">{metadata.description}</p>
          
          <div className="bg-gradient-to-r from-blue-50 to-purple-50 p-3 rounded-lg mb-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-700">ASA ID:</span>
              <span className="font-mono text-sm bg-white px-2 py-1 rounded border">{asaId}</span>
            </div>
          </div>

          {metadata.external_url && (
            <div className="mb-4">
              <a 
                href={metadata.external_url} 
                target="_blank" 
                rel="noopener noreferrer"
                className="btn btn-outline btn-primary btn-sm w-full"
              >
                🔗 View External Link
              </a>
            </div>
          )}

          {metadata.attributes && metadata.attributes.length > 0 && (
            <div className="mt-4">
              <h3 className="font-semibold text-sm mb-3 text-gray-700">🎨 Attributes:</h3>
              <div className="flex flex-wrap gap-2">
                {metadata.attributes.map((attr, index) => (
                  <div key={index} className="badge badge-outline badge-sm">
                    <span className="font-medium">{attr.trait_type}:</span> {attr.value}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <dialog id="nft_modal" className={`modal ${openModal ? 'modal-open' : ''} bg-gradient-to-br from-purple-50 to-blue-50`}>
      <form method="dialog" className="modal-box max-w-5xl bg-white shadow-2xl">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="font-bold text-2xl bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
              🎨 Deploy NFT Token
            </h3>
            <p className="text-gray-600 text-sm mt-1">Create and deploy your NFT on Algorand blockchain</p>
          </div>
          <button 
            className="btn btn-sm btn-circle btn-ghost" 
            onClick={() => setModalState(false)}
          >
            ✕
          </button>
        </div>

        <div className="grid gap-6">
          {/* Simple Image Upload Option */}
          <div className="card bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 shadow-lg">
            <div className="card-body">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                  <span className="text-green-600 text-xl">🚀</span>
                </div>
                <div>
                  <h2 className="card-title text-green-800">Quick NFT Creation</h2>
                  <p className="text-green-600 text-sm">Just upload an image and we'll handle the rest!</p>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="form-control">
                  <label className="label">
                    <span className="label-text font-medium">NFT Name</span>
                  </label>
                  <input
                    type="text"
                    className="input input-bordered border-green-300 focus:border-green-500 focus:ring-green-500"
                    value={nftName}
                    onChange={(e) => setNftName(e.target.value)}
                    placeholder="My Awesome NFT"
                  />
                </div>
                <div className="form-control">
                  <label className="label">
                    <span className="label-text font-medium">Description</span>
                  </label>
                  <input
                    type="text"
                    className="input input-bordered border-green-300 focus:border-green-500 focus:ring-green-500"
                    value={nftDescription}
                    onChange={(e) => setNftDescription(e.target.value)}
                    placeholder="A cool NFT description"
                  />
                </div>
                <div className="form-control md:col-span-2">
                  <label className="label">
                    <span className="label-text font-medium">🖼️ Image URL</span>
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      className={`input input-bordered w-full pr-12 ${imageUrlValidation && !imageUrlValidation.isValid ? 'input-error border-red-300' : 'border-green-300 focus:border-green-500 focus:ring-green-500'}`}
                      value={imageUrl}
                      onChange={(e) => {
                        const url = e.target.value
                        setImageUrl(url)
                        setImageUrlValidation(validateImageUrl(url))
                      }}
                      placeholder="https://azure-glad-anaconda-12.mypinata.cloud/ipfs/bafybeic3ge6dqjg4slmosr7ayvclwopvrg7gz4mxrd3qc26ho3vvduo42u"
                    />
                    {imageUrl && imageUrlValidation?.isValid && (
                      <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                        <span className="text-green-500 text-lg">✓</span>
                      </div>
                    )}
                  </div>
                  <label className="label">
                    <span className="label-text-alt text-gray-600">Paste your Pinata URL or any image URL - we'll create the metadata automatically!</span>
                  </label>
                  {imageUrlValidation && (
                    <div className={`text-sm mt-1 ${imageUrlValidation.isValid ? 'text-success' : 'text-error'}`}>
                      {imageUrlValidation.message}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Advanced Configuration */}
          <div className="card bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 shadow-lg">
            <div className="card-body">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                  <span className="text-blue-600 text-xl">⚙️</span>
                </div>
                <div>
                  <h2 className="card-title text-blue-800">Advanced Configuration</h2>
                  <p className="text-blue-600 text-sm">Customize token parameters and metadata</p>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="form-control">
                  <label className="label">
                    <span className="label-text">Token Name</span>
                  </label>
                  <input
                    type="text"
                    className="input input-bordered"
                    value={customConfig.assetName || ''}
                    onChange={(e) => setCustomConfig(prev => ({ ...prev, assetName: e.target.value }))}
                    placeholder="My NFT Token"
                  />
                </div>
                <div className="form-control">
                  <label className="label">
                    <span className="label-text">Unit Name</span>
                  </label>
                  <input
                    type="text"
                    className="input input-bordered"
                    value={customConfig.unitName || ''}
                    onChange={(e) => setCustomConfig(prev => ({ ...prev, unitName: e.target.value }))}
                    placeholder="NFT"
                    maxLength={8}
                  />
                </div>
                <div className="form-control">
                  <label className="label">
                    <span className="label-text">Total Supply</span>
                  </label>
                  <input
                    type="number"
                    className="input input-bordered"
                    value={customConfig.total || ''}
                    onChange={(e) => setCustomConfig(prev => ({ ...prev, total: parseInt(e.target.value) || 0 }))}
                    placeholder="1000000"
                  />
                </div>
                <div className="form-control">
                  <label className="label">
                    <span className="label-text">Decimals</span>
                  </label>
                  <input
                    type="number"
                    className="input input-bordered"
                    value={customConfig.decimals || ''}
                    onChange={(e) => setCustomConfig(prev => ({ ...prev, decimals: parseInt(e.target.value) || 0 }))}
                    placeholder="0"
                    min="0"
                    max="19"
                  />
                </div>
                <div className="form-control md:col-span-2">
                  <label className="label">
                    <span className="label-text">Metadata URL</span>
                  </label>
                  <input
                    type="text"
                    className={`input input-bordered ${urlValidation && !urlValidation.isValid ? 'input-error' : ''}`}
                    value={customConfig.assetURL || ''}
                    onChange={(e) => {
                      const url = e.target.value
                      setCustomConfig(prev => ({ ...prev, assetURL: url }))
                      setUrlValidation(validateMetadataUrl(url))
                    }}
                    placeholder="https://example.com/metadata.json or ipfs://QmYourHashHere..."
                  />
                  <label className="label">
                    <span className="label-text-alt">Enter any URL containing your NFT metadata JSON (IPFS, HTTP, HTTPS supported)</span>
                  </label>
                  {urlValidation && (
                    <div className={`text-sm mt-1 ${urlValidation.isValid ? 'text-success' : 'text-error'}`}>
                      {urlValidation.message}
                    </div>
                  )}
                  {customConfig.assetURL && urlValidation?.isValid && (
              <button
                type="button"
                      className="btn btn-sm btn-outline mt-2"
                      onClick={() => fetchMetadataFromUrl(customConfig.assetURL!)}
                    >
                      Test URL
              </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* NFT Display */}
          {asaId && (
            <div className="card bg-gradient-to-r from-purple-50 to-pink-50 border border-purple-200 shadow-lg">
              <div className="card-body">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center">
                    <span className="text-purple-600 text-xl">🎉</span>
                  </div>
                  <div>
                    <h2 className="card-title text-purple-800">Deployed NFT</h2>
                    <p className="text-purple-600 text-sm">Your NFT has been successfully created!</p>
                  </div>
                </div>
                {tokenMetadata ? (
                  <div className="flex justify-center">
                    <NFTCard metadata={tokenMetadata} asaId={asaId} />
                  </div>
                ) : (
                  <div className="text-center p-6 bg-white rounded-lg border border-purple-200">
                    <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <span className="text-purple-600 text-2xl">🖼️</span>
                    </div>
                    <p className="text-purple-700 font-medium mb-2">ASA ID: {asaId}</p>
                    <p className="text-sm text-purple-600 mb-4">
                      Metadata not loaded. Click "Load Metadata" to fetch and display your NFT.
                    </p>
                    <button
                      type="button"
                      className="btn btn-outline btn-primary btn-sm"
                      onClick={() => fetchMetadataFromUrl(customConfig.assetURL!)}
                    >
                      Load Metadata
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="modal-action flex flex-col gap-3 mt-8">
          {/* Simple Image Deployment */}
          <button 
            className={`btn btn-lg w-full ${loading ? 'btn-disabled' : 'btn-success hover:btn-success-focus'} shadow-lg`}
            onClick={(e) => { 
              e.preventDefault(); 
              void deployTokenWithImage() 
            }}
            disabled={loading || !imageUrl}
          >
            {loading ? (
              <>
                <span className="loading loading-spinner loading-sm"></span>
                Deploying NFT...
              </>
            ) : (
              <>
                <span className="text-xl">🚀</span>
                Deploy NFT (Quick Mode)
              </>
            )}
          </button>
          
          {/* Advanced Metadata Deployment */}
          <button 
            className={`btn btn-lg w-full ${loading ? 'btn-disabled' : 'btn-outline btn-primary'} shadow-lg`}
            onClick={(e) => { 
            e.preventDefault();
              void deployTokenWithIPFS() 
            }}
            disabled={loading || !customConfig.assetURL}
          >
            {loading ? (
              <>
                <span className="loading loading-spinner loading-sm"></span>
                Deploying NFT...
              </>
            ) : (
              <>
                <span className="text-xl">⚙️</span>
                Deploy NFT (Advanced Mode)
              </>
            )}
          </button>
          
          <button 
            className="btn btn-ghost btn-sm w-full mt-2" 
            onClick={() => setModalState(!openModal)}
          >
            Cancel
          </button>
        </div>
      </form>
    </dialog>
  )
}

export default AppCalls