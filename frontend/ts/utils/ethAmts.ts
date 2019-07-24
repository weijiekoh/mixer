import * as ethers from 'ethers'

const config = require('../exported_config')

const mixAmtEth = config.mixAmtEth

// the operator is the same as the burn feee, a choice arbitarily made by
// this relayer
const operatorFeeEth = config.burnFeeEth

const feeAmtWei = ethers.utils.parseEther(
    (parseFloat(operatorFeeEth) * 2).toString()
)

export {
    mixAmtEth,
    operatorFeeEth,
    feeAmtWei,
}
