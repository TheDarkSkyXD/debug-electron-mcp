const path = require('node:path');
const webpack = require('webpack');
const nodeExternals = require('webpack-node-externals');
const packageMetadata = require('./package.json');

/** @type {import('webpack').Configuration} */
module.exports = {
  target: 'node',
  mode: 'production',
  entry: './src/index.ts',
  output: {
    path: path.resolve(process.cwd(), 'dist'),
    filename: 'index.js',
    clean: true,
  },
  resolve: {
    extensions: ['.ts', '.js'],
    modules: ['node_modules', 'src'],
  },
  externals: [nodeExternals()],
  module: { rules: [{ test: /\.ts$/, use: 'ts-loader', exclude: /node_modules/ }] },
  plugins: [
    new webpack.BannerPlugin({ banner: '#!/usr/bin/env node', raw: true, entryOnly: true }),
    new webpack.DefinePlugin({ __PACKAGE_VERSION__: JSON.stringify(packageMetadata.version) }),
  ],
  optimization: { minimize: false },
  devtool: 'source-map',
};
