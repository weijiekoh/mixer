const path = require('path')
const HtmlWebpackPlugin = require('html-webpack-plugin')
const TerserPlugin = require('terser-webpack-plugin');

const isProduction = process.env.NODE_ENV === 'production' || process.env.NODE_ENV === 'kovan'

module.exports = {
  mode: isProduction ? 'production' : 'development',
  entry: {
    index: './build/index.js',
  },
  devtool: "source-map",
  output: {
    filename: '[name].[contenthash].js',
  },
	optimization: {
		minimize: isProduction,
    minimizer: [
      new TerserPlugin({
        terserOptions: {
          compress: true,
          mangle: false,
        },
      }),
    ],
	},
  plugins: [
    new HtmlWebpackPlugin({
      title: 'MicroMix',
      template: 'index.html'
    })
  ],
  externals: /^(worker_threads)$/,
  module: {
    rules: [
      {
        test: /\.(png|svg|jpg|gif)$/,
        use: ['file-loader'],
      },
      {
        test: /\.less$/,
				include: [
					path.resolve(__dirname, "less/")
				],
        use: [
          'style-loader',
          'css-loader',
          'less-loader',
        ]
      }
    ],
  }
};
