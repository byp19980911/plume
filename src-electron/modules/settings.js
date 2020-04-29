import { app } from 'electron'
import path from 'path'
import logger from './logger'
import fs from 'fs-extra'

import packageJson from '../../package.json'

const _defaults = {
  network: process.env.PROD ? 'main' : 'test',
  nodeType: 'plume',
  rpcPort: 18545,
  wsPort: 18546,
  bootstrap: '/ip4/10.0.0.7/mux/5978:30262/ipfs/16Uiu2HAmKXjiJfqnchKKAAF4UbHA1d4mB3zN6UgFsuW8WQs9Woju',
  chainId: 739,
  requiredConfirmations: 10
}

class Settings {
  constructor () {
    this.init()
  }

  init () {
    logger.setup({loglevel: this.loglevel})
    this._log = logger.create('Settings')
  }

  get chainId () {
    return _defaults.chainId
  }

  get bootstrap () {
    return _defaults.bootstrap
  }

  get rpcPort () {
    return _defaults.rpcPort
  }

  get wsPort () {
    return _defaults.wsPort
  }

  get nodeOptions () {
    return []
  }

  get fnodesData () {
    return '{"id":"","method":"admin_fnodes"}'
  }

  get pendingData () {
    return '{"id":"","method":"eth_pendingTransactions"}'
  }

  get adminRpcUrl () {
    return `http://localhost:${_defaults.rpcPort}/admin`
  }

  get rpcUrl () {
    return `http://localhost:${_defaults.rpcPort}`
  }

  get requiredConfirmations () {
    return _defaults.requiredConfirmations
  }

  get userDataPath () {
    return app.getPath('userData')
  }

  get dbFilePath () {
    const dbFileName = this.appName + '.lokidb'
    return path.join(this.userDataPath, dbFileName)
  }

  get appDataPath () {
    // Application Support/
    return app.getPath('appData')
  }

  get userHomePath () {
    return app.getPath('home')
  }

  get appVersion () {
    return packageJson.version
  }

  get appName () {
    return packageJson.name
  }

  get appLicense () {
    return packageJson.license
  }

  get inProductionMode () {
    return process.env.PROD
  }

  get productName () {
    return packageJson.productName
  }

  get appDescription () {
    return packageJson.description
  }

  get platform () {
    return process.platform
      .replace('darwin', 'mac')
      .replace('win32', 'win')
      .replace('freebsd', 'linux')
      .replace('sunos', 'linux')
  }

  get chainDataPath () {
    let dataDir = this.userHomePath
    if (this.platform === 'win') {
      dataDir = path.join(dataDir, 'AppData', 'Roaming', 'plume')
    } else if (this.platform === 'mac') {
      // dataDir = path.join(dataDir, 'Library', 'plume')
      dataDir = path.join(dataDir, '.plume')
    } else {
      dataDir = path.join(dataDir, '.plume')
    }

    return dataDir
  }

  get keystorePath () {
    return path.join(this.chainDataPath, 'keystore')
  }

  get httpConnection () {
    return `http://localhost:${_defaults.rpcPort}`
  }

  loadUserData (path2) {
    const fullPath = this.constructUserDataPath(path2)

    this._log.trace('Load user data', fullPath)

    // check if the file exists
    try {
      fs.accessSync(fullPath, fs.R_OK)
    } catch (err) {
      return null
    }

    // try to read it
    try {
      const data = fs.readFileSync(fullPath, { encoding: 'utf8' })
      this._log.debug(`Reading "${data}" from ${fullPath}`)
      return data
    } catch (err) {
      this._log.warn(`File not readable: ${fullPath}`, err)
    }

    return null
  }

  saveUserData (path2, data) {
    if (!data) return // return so we dont write null, or other invalid data

    const fullPath = this.constructUserDataPath(path2)

    try {
      this._log.debug(`Saving "${data}" to ${fullPath}`)
      fs.writeFileSync(fullPath, data, { encoding: 'utf8' })
    } catch (err) {
      this._log.warn(`Unable to write to ${fullPath}`, err)
    }
  }

  constructUserDataPath (filePath) {
    return path.join(this.userDataPath, filePath)
  }
}

export default new Settings()
