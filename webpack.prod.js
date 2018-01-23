const merge = require('webpack-merge');
const config = require('./webpack.config.js');
const UglifyJSPlugin = require('uglifyjs-webpack-plugin');

module.exports = merge(config, {
  plugins: [
    new UglifyJSPlugin()
  ]
});
