import logger from '../logger'
import fse from 'fs-extra'
import fs from 'fs'
import path from 'path'
import Settings from '../settings'

const log = logger.create('ObserveAccounts')

class ObserveAccounts {
  start () {
    log.info('starting ...')
    this.web3 = global.web3
    this.timer = setInterval(() => {
      this._getAccounts()
    }, 3000)
  }

  _getAccounts () {
    fs.readdir(Settings.keystorePath, (err, files) => {
      if (!err) {
        let addressList = []
        files.forEach(file => {
          try {
            let kfile = fse.readJsonSync(path.join(Settings.keystorePath, file))
            let address = kfile['address']
            if (address) {
              addressList.push('0x' + address)
            }
          } catch (err) {
            log.err(err)
          }
        })
        global.accounts = addressList
      }
    })
  }

  stop () {
    if (this.timer) {
      clearInterval(this.timer)
    }
    log.info('stopped.')
  }
}

export default new ObserveAccounts()
