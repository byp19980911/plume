// Configuration for your app
const rimraf = require('rimraf')
const path = require('path')
module.exports = function (ctx) {
  return {
    // app plugins (/src/plugins)
    plugins: [
      'axios',
      'vuelidate',
      'global',
      'components',
      'i18n'
    ],
    css: [
      'app.styl'
    ],
    extras: [
      ctx.theme.mat ? 'roboto-font' : null,
      'material-icons', // optional, you are not bound to it
      // 'ionicons',
      // 'mdi',
      'fontawesome'
    ],
    supportIE: false,
    build: {
      scopeHoisting: true,
      vueRouterMode: 'history',
      // vueCompiler: true,
      // gzip: true,
      // analyze: true,
      // extractCSS: false,
      extendWebpack (cfg) {
        cfg.module.rules.push({
          enforce: 'pre',
          test: /\.(js|vue)$/,
          loader: 'eslint-loader',
          exclude: /(node_modules|quasar)/
        })
      }
    },
    devServer: {
      // https: true,
      port: 18081,
      open: true // opens browser window automatically
    },
    // framework: 'all' --- includes everything; for dev only!
    framework: {
      i18n: 'en-us',
      components: [
        'QLayout',
        'QLayoutHeader',
        'QLayoutDrawer',
        'QPageContainer',
        'QPage',
        'QToolbar',
        'QToolbarTitle',
        'QBtnGroup',
        'QBtn',
        'QIcon',
        'QList',
        'QListHeader',
        'QItem',
        'QItemMain',
        'QItemSide',
        'QItemTile',
        'QModal',
        'QModalLayout',
        'QSearch',
        'QInput',
        'QField',
        'QChip',
        'QTooltip',
        'QSelect',
        'QSpinner',
        'QSpinnerBars',
        'QSpinnerGears',
        'QProgress',
        'QAlert',
        'QToggle',
        'QInnerLoading',
        'QTable',
        'QBreadcrumbs',
        'QBreadcrumbsEl',
        'QSlider',
        'QCard',
        'QCardTitle',
        'QCardMain',
        'QCardMedia',
        'QCardSeparator',
        'QCardActions'
      ],
      directives: [
        'Ripple',
        'CloseOverlay'
      ],
      // Quasar plugins
      plugins: [
        'Notify',
        'Loading',
        'Dialog'
      ]
      // iconSet: ctx.theme.mat ? 'material-icons' : 'ionicons'
      // i18n: 'de' // Quasar language
    },
    // animations: 'all' --- includes all animations
    animations: [
    ],
    pwa: {
      // workboxPluginMode: 'InjectManifest',
      // workboxOptions: {},
      manifest: {
        // name: 'Quasar App',
        // short_name: 'Quasar-PWA',
        // description: 'Best PWA App in town!',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#ffffff',
        theme_color: '#027be3',
        icons: [
          {
            'src': 'statics/icons/icon-128x128.png',
            'sizes': '128x128',
            'type': 'image/png'
          },
          {
            'src': 'statics/icons/icon-192x192.png',
            'sizes': '192x192',
            'type': 'image/png'
          },
          {
            'src': 'statics/icons/icon-256x256.png',
            'sizes': '256x256',
            'type': 'image/png'
          },
          {
            'src': 'statics/icons/icon-384x384.png',
            'sizes': '384x384',
            'type': 'image/png'
          },
          {
            'src': 'statics/icons/icon-512x512.png',
            'sizes': '512x512',
            'type': 'image/png'
          }
        ]
      }
    },
    cordova: {
      // id: 'org.cordova.quasar.app'
    },
    electron: {
      // bundler: 'builder', // or 'packager'
      extendWebpack (cfg) {
        // do something with Electron process Webpack cfg
      },
      beforePackaging: function (opts) {
        // do nothings
        const platformDel = process.platform
          .replace('darwin', 'win')
          .replace('win32', 'mac')
        let unpackagedDir = opts.unpackagedDir
        let delPath = path.join(unpackagedDir, 'statics', platformDel)
        rimraf(delPath, (err) => {
          if (err) {
            console.error(err.message, err)
          } else {
            console.log('remove chain of other platform success')
          }
        })
      },
      packager: {
        // https://github.com/electron-userland/electron-packager/blob/master/docs/api.md#options

        // OS X / Mac App Store
        // appBundleId: '',
        // appCategoryType: '',
        // osxSign: '',
        // protocol: 'myapp://path',

        // Window only
        // win32metadata: { ... }
      },
      builder: {
        appId: 'ltd.pdx.plume',
        mac: {
          category: 'public.app-category.productivity',
          icon: 'src-electron/icons/icon.icns',
          target: 'dmg',
          // eslint-disable-next-line no-template-curly-in-string
          artifactName: '${productName}-macosx-${version}.${ext}'
        },
        win: {
          icon: 'src-electron/icons/icon.ico',
          target: 'nsis',
          // eslint-disable-next-line no-template-curly-in-string
          artifactName: '${productName}-win64-${version}.${ext}'
        },
        // for windows package
        nsis: {
          oneClick: false,
          allowToChangeInstallationDirectory: true,
          runAfterFinish: true
        },
        linux: {
          category: 'Utility',
          icon: 'src-electron/icons/icon.png',
          target: 'zip',
          // eslint-disable-next-line no-template-curly-in-string
          artifactName: '${productName}-linux64-${version}.${ext}'
        }
      }
    }
  }
}
