import * as ethers from 'ethers'

const config = require('../../exported_config')

const mixAmtEth = config.mixAmtEth
const operatorFeeEth = config.feeAmtEth.toString()
const feeAmtWei = ethers.utils.parseEther(operatorFeeEth)

const tokenDecimals = config.tokenDecimals
const mixAmtTokens = config.mixAmtTokens
const operatorFeeTokens = config.feeAmtTokens

export {
    mixAmtEth,
    mixAmtTokens,
    operatorFeeEth,
    operatorFeeTokens,
    feeAmtWei,
}
