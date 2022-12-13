module.exports = {
    presets: [
        '@babel/preset-typescript',
        ['@babel/preset-env', {
            targets: {
                node: 16
            },
            modules: 'cjs'
        }]
    ]
}
