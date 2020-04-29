import { ipcMain as ipc } from 'electron'
import { EventEmitter } from 'events'
import _ from 'lodash'
import logger from '../logger'
import { Types } from '../ipc/types'
import settings from '../settings'
import BigNumber from 'bignumber.js'

const log = logger.create('TransactionState')

class TransactionState extends EventEmitter {
  constructor () {
    super()
    this.on('sync', this._sync)

    ipc.on(Types.SEND_TRANSACTION, _.bind(this._sendTransaction, this))
  }

  _sync () {
    log.info('load transactions from db')
    const db = global.db
    let transactions = db.transactions
      .chain()
      .simplesort('timestamp', true)
      .data()
    global.windows.broadcast(Types.SYNC_TRANSACTION, { transactions })
  }

  _sendTransaction (event, obj) {
    const web3 = global.web3
    log.info(
      'ipc call send transaction: \n',
      _.pick(obj.tx, ['from', 'to', 'value', 'data'])
    )
    let chainId = settings.chainId
    chainId = web3.utils.toHex(chainId)
    let tx = obj.tx
    log.info('tx : {}', tx)
    let rawTx = {
      'from': tx.from,
      'gasPrice': new BigNumber(tx.gasPrice).toString(),
      'gas': new BigNumber(tx.gas).toString(),
      'to': tx.to,
      'data': '',
      'value': tx.value,
      'chainid': new BigNumber(chainId).toString(),
      'passwd': obj.password
    }

    web3.eth.getTransactionCount(tx.from, 'pending').then(transactionCount => {
      log.info('transactionCount: {}', transactionCount)
      rawTx['nonce'] = transactionCount.toString()
      log.info(rawTx)
      return global.rpc.signTx(rawTx)
    }).then(res => {
      log.info(res)
      log.info('result : ', res['result'])
      web3.eth
        .sendSignedTransaction(res['result'])
        .once('transactionHash', hash => {
          let reply = { transactionHash: hash, tx }
          event.sender.send(Types.SEND_TRANSACTION_REPLY, reply)
        })
        .on('error', error => {
          throw error
        })
    }).catch(error => {
      if (error) {
        log.info(error)
        let reply = { error: 'invalid-password' }
        event.sender.send(Types.SEND_TRANSACTION_REPLY, reply)
      }
    })
  }
}

export default new TransactionState()
