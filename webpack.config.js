const path = require('path');
const { VueLoaderPlugin } = require('vue-loader');
const { BundleAnalyzerPlugin } = require('webpack-bundle-analyzer');

module.exports = {

    entry: './frontend/src/main.js', // Update with your JavaScript entry point

    output: {
        filename: 'bundle.js',
        path: path.resolve(__dirname, 'backend/goTrainer/js'), // Path to write bundle.js during build
        publicPath: '/static/goTrainer/js/', // Public URL where the bundle is served from

    },
    mode: 'development',

    devServer: {
        static: {
            directory: path.resolve(__dirname, 'backend/goTrainer/static'), // Serve static files from this directory
        },
        hot: true, // Enable hot module replacement
        compress: true,
        port: 8080, // Change this port as needed
                headers: {
            'Access-Control-Allow-Origin': '*', // Add this line to enable CORS
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
            'Access-Control-Allow-Headers': 'X-Requested-With, content-type, Authorization'
        }

    },
    module: {
        rules: [
            {
                test: /\.js$/,
                exclude: /node_modules/,
                use: {
                    loader: 'babel-loader',
                    options: {
                        presets: ['@babel/preset-env']
                    }
                },
            },
            {
                test: /\.css$/,
                use: ['style-loader', 'css-loader'], // Process CSS files
            },
                        {
                test: /\.vue$/,
                loader: 'vue-loader',
            }

        ]
    },
    plugins: [
        new VueLoaderPlugin(), // Ensure this plugin is included
        new BundleAnalyzerPlugin() // Add the analyzer plugin

    ],
    resolve: {
        alias: {
            vue$: 'vue/dist/vue.esm-bundler.js' // Required for Vue 3
        },
        extensions: ['*', '.js', '.vue', '.json']
    }
};
