const rspack = require('@rspack/core')

exports = require('./rspack.base')

exports.mode = 'production'
exports.output.filename = 'eruda.js'
exports.devtool = 'source-map'
exports.target = ['web', 'es5']
exports.plugins = exports.plugins.concat([
  new rspack.DefinePlugin({
    ENV: '"production"',
  }),
])
exports.optimization = {
  minimize: true,
  minimizer: [
    new rspack.SwcJsMinimizerRspackPlugin({
      extractComments: false,
      minimizerOptions: {
        format: {
          // keep the /*! banner */ injected by BannerPlugin
          comments: 'some',
        },
      },
    }),
  ],
}

module.exports = exports
