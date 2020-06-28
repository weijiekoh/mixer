import React, { useState, Component } from 'react'
import ReactDOM from 'react-dom'
import { TxStatuses } from './txButton'
const config = require('../../exported_config')
const blockExplorerTxPrefix = config.frontend.blockExplorerTxPrefix

const TxHashMessage = ({
    txStatus,
    txHash,
    mixSuccessful,
}) => {
    let msg: string = ''
    let articleClass: string = ''

    if (mixSuccessful) {
        msg = 'Mix successful.'
        articleClass = 'is-success'
    } else if (txStatus === TxStatuses.Pending) {
        msg = 'Transaction pending.'
        articleClass = 'is-info'
    } else if (txStatus === TxStatuses.Mined) {
        msg = 'Transaction mined.'
        articleClass = 'is-success'
    }

    return (
        <article className={"message " + articleClass}>
            <div className="message-body">
                {msg} <a
                    href={blockExplorerTxPrefix + txHash}
                    target="_blank">View on Etherscan.
                </a>
            </div>
        </article>
    )
}

export { TxHashMessage }
