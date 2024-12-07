const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const Dotenv = require('dotenv-webpack');

module.exports = {
    module: {
        rules: [
            {
                test: /\.(ts|tsx)$/,
                use: [
                    {
                        loader: 'babel-loader',
                        options: {
                            presets: [
                                '@babel/preset-env',
                                '@babel/preset-react',
                                '@babel/preset-typescript'
                            ]
                        }
                    }
                ],
                exclude: /node_modules/,
            },
            {
                test: /\.module\.css$/,
                use: [
                    'style-loader',
                    {
                        loader: 'css-loader',
                        options: {
                            modules: {
                                localIdentName: '[name]__[local]__[hash:base64:5]'
                            }
                        },
                    },
                ],
            },
            {
                test: /\.css$/,
                exclude: /\.module\.css$/,
                use: ['style-loader', 'css-loader'],
            }
        ],
    },
    resolve: {
        extensions: ['.ts', '.tsx', '.js', '.jsx'],
    },
    entry: {
        content: './src/content.tsx',
        background: './src/background.tsx',
        popup: './src/index.tsx'
    },
    output: {
        path: path.resolve(__dirname, 'dist'),
        filename: '[name].js'
    },
    plugins: [
        new HtmlWebpackPlugin({
            title: 'Popup',
            filename: 'popup.html',
            template: 'src/popup-template.html',
            chunks: ['popup'],
            cache: false
        }),
        new Dotenv()
    ],
};