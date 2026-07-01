const path = require('path')

module.exports = {
  mode: 'production',
  entry: './src/polyfill',
  target: ['web', 'es5'],
  output: {
    path: path.resolve(__dirname, '../dist'),
    filename: 'eruda-polyfill.js',
  },
}
