import { ipcMain as ipc } from 'electron'
import BigNumber from 'bignumber.js'
import { EventEmitter } from 'events'
import { Types } from '../ipc/types'
import logger from '../logger'
import fs from 'fs'
import Settings from '../settings'
import fse from 'fs-extra'
import path from 'path'

const log = logger.create('AccountState')

class AccountState extends EventEmitter {
  constructor () {
    super()
    this.on('sync', this._sync)

    ipc.on(Types.SYNC_ACCOUNT, () => {
      log.debug('ipc call: ', Types.SYNC_ACCOUNT)
      this._sync()
    })

    ipc.on(Types.CREATE_ACCOUNT, (pwd) => {
      log.debug('ipc call: ', Types.SYNC_ACCOUNT)
      this._create(pwd)
    })
  }

  _getAccountName (address, index) {
    let db = global.db
    let account = db.accounts.by('_id', address)
    if (account == null) {
      return 'Account ' + index
    } else {
      return account.name
    }
  }

  _create (pwd) {
    const that = this
    global.rpc.createAccount(pwd).then(result => {
      that._sync()
    })
  }

  _toEther (balance) {
    let web3 = global.web3
    let eth = web3.utils.fromWei(balance, 'ether')
    return new BigNumber(eth).toFixed(3, 1)
  }

  _sync () {
    log.info('account sync...')
    let web3 = global.web3
    fs.readdir(Settings.keystorePath, (err, files) => {
      if (!err) {
        Promise.all(
          files.map((file, index) => {
            try {
              let kfile = fse.readJsonSync(path.join(Settings.keystorePath, file))
              let address = kfile['address']
              if (address) {
                address = '0x' + address
                return new Promise((resolve, reject) => {
                  web3.eth.getBalance(address)
                    .then(balance => {
                      resolve({
                        name: this._getAccountName(address, index),
                        address,
                        balance,
                        ether: this._toEther(balance)
                      })
                    })
                    .catch(error => reject(error))
                })
              }
            } catch (err) {
              log.err(err)
            }
          })
        )
          .then(accounts => {
            global.windows.broadcast(Types.SYNC_ACCOUNT, { accounts })
          })
      }
    })
  }
}

export default new AccountState()
