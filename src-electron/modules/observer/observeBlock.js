import logger from '../logger'
import observeTransaction from '../observer/observeTransaction'
import _ from 'lodash'

const log = logger.create('ObserveBlock')

class ObserveBlock {
  constructor () {
    this.timer = null
  }

  start () {
    this.web3 = global.web3

    this.timer = setInterval(() => {
      this.web3.eth.getBlockNumber().then(number => {
        if (number) {
          let blockHeader = {number: number}
          syncAccount()
          syncNodeState()
          observeTransaction.updateTransactions(blockHeader)
        }
      })
    }, 2000)
    /* this.web3.eth
      .subscribe('newBlockHeaders')
      .on('data', blockHeader => {
        // log.debug('Incoming new block's header: ', blockHeader)
        if (blockHeader.number) {
          syncAccount()
          syncNodeState()
          observeTransaction.updateTransactions(blockHeader)
        }
      }) */
  }

  stop () {
    // unsubscribes the subscription
    if (this.timer) {
      clearInterval(this.timer)
    }
    log.info('stopped.')
  }
}

// update the node status to front end
const syncNodeState = _.debounce(() => {
  global.stateManager.emit('sync', 'node')
}, 1000)

// update the account to front end
const syncAccount = _.debounce(() => {
  global.stateManager.emit('sync', 'account')
}, 1000)

export default new ObserveBlock()
