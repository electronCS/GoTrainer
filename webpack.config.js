const path = require('path');

module.exports = {
    entry: './assets/playground/js/board-controller.js', // Update with your JavaScript entry point
    output: {
        filename: 'bundle.js',
        path: path.resolve(__dirname, 'dist'), // Path to write bundle.js during build
        publicPath: '/static/playground/js/', // Public URL where the bundle is served from

    },
    mode: 'development',

    devServer: {
        static: {
            directory: path.resolve(__dirname, 'playground/static'), // Serve static files from this directory
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
            }

        ]
    }
};
