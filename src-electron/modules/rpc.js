import got from 'got'
import Settings from './settings'
import Q from 'bluebird'
import logger from './logger'
const log = logger.create('rpc')
class Rpc {
  createAccount (pwd) {
    const data = `{"id":"","method":"account_create","params":["${pwd}"]}`
    return this._remote(data)
  }

  _remote (data) {
    let promise = new Q((resolve, reject) => {
      got.post(Settings.adminRpcUrl, {body: data}).then(response => {
        let res = response.body
        if (typeof res === 'string') {
          res = JSON.parse(res)
        }
        log.debug('remote result: {}', res)
        if (res.error) {
          reject(res)
        } else {
          resolve(res)
        }
      })
    })
    return promise
  }

  listAccount () {
    const data = `{"id":"","method":"account_list"}`
    return this._remote(data)
  }

  delAccount (address, pwd) {
    const data = `{"id":"","method":"account_create","params":["${address}", ${pwd}"]}`
    return this._remote(data)
  }

  signTx (tx) {
    let data = {'id': '', 'method': 'account_signtx', 'params': [tx]}
    data = JSON.stringify(data)
    log.info('data:', data)
    return this._remote(data)
  }
}

export default new Rpc()
