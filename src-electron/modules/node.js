import _ from 'lodash'
import Q from 'bluebird'
import { spawn } from 'child_process'
import { dialog, app } from 'electron'
import logRotate from 'log-rotate'
import { EventEmitter } from 'events'
import Web3 from 'web3'
import net from 'net'
import pretry from 'promise-retry'
import Settings from './settings'
import ClientBinaryManager from './clientBinaryManager'
import logger from './logger'
import got from 'got'
import fs from 'fs-extra'

const log = logger.create('node')

const DEFAULT_NODE_TYPE = 'plume'

const NODE_START_WAIT_MS = 3000

const STATES = {
  STARTING: 0 /* Node about to be started */,
  STARTED: 1 /* Node started */,
  CONNECTED: 2 /* IPC connected - all ready */,
  STOPPING: 3 /* Node about to be stopped */,
  STOPPED: 4 /* Node stopped */,
  ERROR: -1 /* Unexpected error */
}

/**
 * plume nodes manager.
 */
class PlumeNode extends EventEmitter {
  constructor () {
    super()

    this.STATES = STATES

    this._loadDefaults()

    this._node = null
    this._type = null
    this._network = null

    this.on('data', _.bind(this._logNodeData, this))
  }

  get isOwnNode () {
    return !!this._node
  }

  get type () {
    return this.isOwnNode ? this._type : null
  }

  get state () {
    return this._state
  }

  get stateAsText () {
    switch (this._state) {
      case STATES.STARTING:
        return 'starting'
      case STATES.STARTED:
        return 'started'
      case STATES.CONNECTED:
        return 'connected'
      case STATES.STOPPING:
        return 'stopping'
      case STATES.STOPPED:
        return 'stopped'
      case STATES.ERROR:
        return 'error'
      default:
        return false
    }
  }

  set state (newState) {
    this._state = newState

    this.emit('state', this.state, this.stateAsText)
  }

  get lastError () {
    return this._lastErr
  }

  set lastError (err) {
    this._lastErr = err
  }

  /**
   * This method should always be called first to initialise the connection.
   * @return {Promise}
   */
  init () {
    let rpcPort = Settings.rpcPort
    let wsPort = Settings.wsPort
    return new Q((resolve, reject) => {
      Q.all([this._checkPort(rpcPort), this._checkPort(wsPort)])
        .then(() => {
          reject()
        })
        .catch(() => {
          resolve()
        })
    })
      .then(() => {
        return this._web3Init()
      })
      .then(() => {
        log.info('web3 connected to exists node success!')
        this.state = STATES.CONNECTED
      })
      .catch(() => {
        log.warn(
          "Failed to connect to node. Maybe it's not running so let's start our own..."
        )

        log.info(`Node type: ${this.defaultNodeType}`)

        // if not, start node yourself
        return this._start(
          this.defaultNodeType
        ).catch(err => {
          log.error('Failed to start node', err)
          throw err
        })
      })
  }

  restart (newType) {
    return Q.try(() => {
      if (!this.isOwnNode) {
        throw new Error('Cannot restart node since it was started externally')
      }

      log.info('Restart node', newType)

      return this.stop()
        // .then(() => this.emit('show-loading'))
        .then(() =>
          this._start(
            newType || this.type
          )
        )
        // .then(() => this.emit('hide-loading'))
        .catch(err => {
          log.error('Error restarting node', err)
          throw err
        })
    })
  }

  /**
   * Stop node.
   *
   * @return {Promise}
   */
  stop () {
    if (!this._stopPromise && this.state !== STATES.STOPPING) {
      return new Q(resolve => {
        if (!this._node) {
          return resolve()
        }

        this.state = STATES.STOPPING

        log.info(`Stopping existing node: ${this._type} ${this._network}`)

        this._node.stderr.removeAllListeners('data')
        this._node.stdout.removeAllListeners('data')
        this._node.stdin.removeAllListeners('error')
        this._node.removeAllListeners('error')
        this._node.removeAllListeners('exit')

        this._node.kill('SIGINT')

        // after some time just kill it if not already done so
        const killTimeout = setTimeout(() => {
          if (this._node) {
            this._node.kill('SIGKILL')
          }
        }, 8000 /* 8 seconds */)

        this._node.once('close', () => {
          clearTimeout(killTimeout)

          this._node = null

          resolve()
        })
      }).then(() => {
        this.state = STATES.STOPPED
        this._stopPromise = null
      })
    }
    log.debug('Disconnection already in progress, returning Promise.')
    return this._stopPromise
  }

  getLog () {
    return Settings.loadUserData('node.log')
  }

  /**
   * Start an ethereum node.
   * @param  {String} nodeType geth, eth, etc
   * @param  {String} network  network id
   * @return {Promise}
   */
  _start (nodeType) {
    log.info(`Start node: ${nodeType} `)

    return this.stop()
      .then(() => {
        return this.__startNode(nodeType).catch(err => {
          log.error('Failed to start node', err)

          this._showNodeErrorDialog(nodeType)

          throw err
        })
      })
      .then(proc => {
        log.info(
          `Started node successfully: ${nodeType}`
        )

        this._node = proc
        this.state = STATES.STARTED

        Settings.saveUserData('node', this._type)

        return this._web3Init()
          .then(() => {
            this.state = STATES.CONNECTED
          })
          .catch(err => {
            log.error('Web3 failed to connected to node.')
            this.emit('error', err)
          })
      })
      .catch(err => {
        // set before updating state so that state change event observers
        // can pick up on this
        this.lastError = err.tag
        this.state = STATES.ERROR

        throw err
      })
  }

  _web3Init () {
    if (!global.web3) {
      global.web3 = new Web3()
    }

    let providerUrl = Settings.httpConnection
    log.info(`http url provider: ${providerUrl}`)
    global.web3.setProvider(providerUrl)
    return pretry(
      (retry, number) => {
        log.debug(`web3 try to set provider ${number} times.`)
        return this._checkFnodes().then(() => {
          fs.ensureDirSync(Settings.keystorePath)
        }).catch(retry)
        // return global.web3.eth.net.isListening().catch(retry)
      },
      { retries: 10 }
    )
  }

  _checkFnodes () {
    let promise = new Q((resolve, reject) => {
      got.post(Settings.adminRpcUrl, {body: Settings.fnodesData}).then(response => {
        let res = response.body
        if (typeof res === 'string') {
          res = JSON.parse(res)
        }
        let nodes = res['result']['nodes']
        log.info(`nodes length : ${nodes.length}`)
        if (nodes.length === 0) {
          reject()
        } else {
          resolve()
        }
      })
    })
    return promise
  }

  _checkPort (port) {
    let promise = new Q((resolve, reject) => {
      let server = net.createServer().listen(port, '127.0.0.1')

      server.on('listening', function () {
        server.close()
        log.info('The port【', port, '】 is available.')
        resolve(port)
      })

      server.on('error', function (err) {
        if (err.code === 'EADDRINUSE') {
          log.info(
            'The port【',
            port,
            '】 is occupied, please change other port.'
          )
        }
        reject(new Error('The port was occupied.'))
      })
    })
    return promise
  }

  /**
   * @return {Promise}
   */
  __startNode (nodeType) {
    this.state = STATES.STARTING

    this._type = nodeType

    const client = ClientBinaryManager.getClient(nodeType)
    let binPath

    if (client) {
      binPath = client.binPath
    } else {
      throw new Error(`Node "${nodeType}" binPath is not available.`)
    }

    log.info(`Start node using ${binPath}`)

    return new Q((resolve, reject) => {
      this.__startProcess(nodeType, binPath).then(
        resolve,
        reject
      )
    })
  }

  /**
   * @return {Promise}
   */
  __startProcess (nodeType, binPath) {
    return new Q((resolve, reject) => {
      log.trace('Rotate log file')

      // rotate the log file
      logRotate(
        Settings.constructUserDataPath('node.log'),
        { count: 5 },
        err => {
          if (err) {
            log.error('Log rotation problems', err)

            return reject(err)
          }

          let args = ['-b', Settings.bootstrap, '-n', Settings.chainId]

          const nodeOptions = Settings.nodeOptions

          if (nodeOptions && nodeOptions.length) {
            log.debug('Custom node options', nodeOptions)

            args = args.concat(nodeOptions)
          }

          log.trace('Spawn', binPath, args)

          const proc = spawn(binPath, args)

          // node has a problem starting
          proc.once('error', error => {
            if (STATES.STARTING === this.state) {
              this.state = STATES.ERROR

              log.info('Node startup error')

              // TODO: detect this properly
              // this.emit('nodeBinaryNotFound');

              reject(error)
            }
          })
          proc.on('exit', (code, signal) => {
            this._node = null
            app.quit()
          })
          // we need to read the buff to prevent node from not working
          proc.stderr.pipe(
            fs.createWriteStream(Settings.constructUserDataPath('node.log'), {
              flags: 'a'
            })
          )

          // when proc outputs data
          proc.stdout.on('data', data => {
            log.trace('Got stdout data')

            this.emit('data', data)
          })

          // when proc outputs data in stderr
          proc.stderr.on('data', data => {
            log.trace('Got stderr data')

            this.emit('data', data)
          })

          this.on('data', _.bind(this._logNodeData, this))

          // when data is first received
          this.once('data', () => {
            /*
                        We wait a short while before marking startup as successful
                        because we may want to parse the initial node output for
                        errors, etc (see geth port-binding error above)
                    */
            setTimeout(() => {
              if (STATES.STARTING === this.state) {
                log.info(
                  `${NODE_START_WAIT_MS}ms elapsed, assuming node started up successfully`
                )

                resolve(proc)
              }
            }, NODE_START_WAIT_MS)
          })
        }
      )
    })
  }

  _showNodeErrorDialog (nodeType) {
    let nodelog = this.getLog()

    if (nodelog) {
      nodelog = `...${nodelog.slice(-1000)}`
    } else {
      nodelog = "It seems like the node couldn't be started."
    }

    // add node type
    nodelog =
      `Node type: ${nodeType}\n` +
      `Platform: ${process.platform} (Architecture ${
        process.arch
      })\n\n${nodelog}`

    dialog.showMessageBox(
      {
        type: 'error',
        buttons: ['OK'],
        message: "Couldn't connect to node? See the logs for more",
        detail: nodelog
      },
      () => {}
    )
  }

  _logNodeData (data) {
    const cleanData = data.toString().replace(/[\r\n]+/, '')
    const nodeType = (this.type || 'node').toUpperCase()

    log.trace(`${nodeType}: ${cleanData}`)

    if (!/^-*$/.test(cleanData) && !_.isEmpty(cleanData)) {
      this.emit('nodeLog', cleanData)
    }
  }

  _loadDefaults () {
    log.trace('Load defaults')

    this.defaultNodeType =
      Settings.nodeType || Settings.loadUserData('node') || DEFAULT_NODE_TYPE

    log.info(
      `Defaults loaded: ${this.defaultNodeType} ${this.defaultNetwork} ${
        this.defaultSyncMode
      }`
    )
  }
}

PlumeNode.STARTING = 0

export default new PlumeNode()
