import * as path from 'path'

// set NODE_CONFIG_DIR 

if (!process.env.hasOwnProperty('NODE_CONFIG_DIR')) {
    process.env.NODE_CONFIG_DIR = path.join(__dirname, '../../config')
}

if (!process.env.hasOwnProperty('NODE_ENV')) {
    process.env.NODE_ENV = 'local-dev'
}

const config = require('config')

if (config.get('printConfigDetails')) {
    console.log(`Using config ${process.env.NODE_ENV} at ${process.env.NODE_CONFIG_DIR}`)
}

export { config }
