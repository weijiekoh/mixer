import * as ethers from 'ethers'

const config = require('../exported_config')

const mixAmtEth = config.mixAmtEth
const operatorFeeEth = config.burnFeeEth
const feeAmtWei = ethers.utils.parseEther(
    (parseFloat(operatorFeeEth) * 2).toString()
)

export {
    mixAmtEth,
    operatorFeeEth,
    feeAmtWei,
}
