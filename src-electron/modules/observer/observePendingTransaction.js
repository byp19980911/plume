import _ from 'lodash'
import moment from 'moment'
import logger from '../logger'
import Q from 'bluebird'
import Settings from '../settings'
import got from 'got'

const log = logger.create('ObservePendingTransaction')

class ObservePendingTransaction {
  constructor () {
    this.timer = null
  }

  start () {
    this.web3 = global.web3
    let that = this
    this.transactions = global.db.transactions
    this.timer = setInterval(() => {
      this._pendingTransactions().then(txIds => {
        txIds.forEach(txId => {
          that.web3.eth.getTransaction(txId).then(tx => {
            that._checkOwnedPendingTransaction(tx)
          })
        })
      })
    }, 5000)
    // this.subscription = this.web3.eth
    //   .subscribe('pendingTransactions')
    //   .on('data', txHash => {
    //     this.web3.eth.getTransaction(txHash)
    //       .then(tx => {
    //         this._checkOwnedPendingTransaction(tx)
    //       })
    //   })
  }

  _pendingTransactions () {
    let promise = new Q((resolve, reject) => {
      got.post(Settings.rpcUrl, {body: Settings.pendingData, headers:{'content-type': 'application/json'}}).then(response => {
        let res = response.body
        if (typeof res === 'string') {
          res = JSON.parse(res)
        }
        log.info(res)
        let txIds = res['result']
        log.info(`pending transactions length : ${txIds.length}`)
        resolve(txIds)
      }).catch(e => {
        log.info(e)
        reject(e)
      })
    })
    return promise
  }

  _checkOwnedPendingTransaction (tx) {
    log.debug('Check incoming pending tx:\n', _.pick(tx, ['hash', 'blockNumber', 'from', 'to', 'value']))
    Promise.resolve()
      .then(() => {
        if (global.accounts) {
          return global.accounts
        } else {
          return this.web3.eth.getAccounts()
        }
      })
      .then(accounts => {
        if (accounts && accounts.length > 0) {
          let from = (tx.from ? tx.from.toLowerCase() : '')
          let to = (tx.to ? tx.to.toLowerCase() : '')
          let owned = accounts.filter(address => {
            address = address.toLowerCase()
            return address === from || address === to
          })
          if (owned && owned.length > 0) {
            let transaction = {
              _id: tx.hash,
              confirmed: false,
              confirmCount: 0,
              timestamp: moment().unix()
            }

            transaction = _.assign(transaction, tx)
            this.transactions.insert(transaction)

            log.debug('Insert pending tx to db: ', tx.hash)

            syncTransaction()
          }
        }
      })
      .catch(err => {
        log.error(err)
      })
  }

  stop () {
    // unsubscribes the subscription
    // if (this.subscription != null) {
    //   this.subscription.unsubscribe(function (error, success) {
    //     if (success) {
    //       log.info('Successfully unsubscribed!')
    //     } else {
    //       log.error('Failed to unsubscribe "pendingTransactions".', error)
    //     }
    //   })
    // }
    if (this.timer != null) {
      this.timer.clear()
      log.info('stopped.')
    }
  }
}

// notify UI changed
const syncTransaction = _.debounce(() => {
  global.stateManager.emit('sync', 'transaction')
}, 1000)

export default new ObservePendingTransaction()
