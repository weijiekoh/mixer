import * as ethers from 'ethers'

const config = require('../exported_config')

const mixAmtEth = config.mixAmtEth

const operatorFeeEth = config.feeAmtEth

const feeAmtWei = ethers.utils.parseEther(operatorFeeEth)

export {
    mixAmtEth,
    operatorFeeEth,
    feeAmtWei,
}
