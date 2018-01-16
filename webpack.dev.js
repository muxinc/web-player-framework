const merge = require('webpack-merge');
const config = require('./webpack.config.js');

var devConfig = merge(config, {
  devtool: 'inline-source-map',
  devServer: {
    contentBase: './'
  }
});

module.exports = devConfig;
