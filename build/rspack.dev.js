const rspack = require('@rspack/core')

exports = require('./rspack.base')

exports.mode = 'development'
exports.output.filename = 'eruda.js'
exports.devtool = 'source-map'
exports.plugins = exports.plugins.concat([
  new rspack.DefinePlugin({
    ENV: '"development"',
  }),
])

module.exports = exports
