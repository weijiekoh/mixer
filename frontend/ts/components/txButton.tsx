import React, { useState, Component } from 'react'
import ReactDOM from 'react-dom'

enum TxButtonStatus {
    Default, Loading, Disabled,
}

enum TxStatuses {
    None, Pending, Mined, Err,
}

const TxButton = ({
    onClick,
    label,
    txStatus,
    isDisabled,
}) => {
    let className = 'button is-large is-primary '

    if (txStatus === TxStatuses.Pending) {
        className += 'is-loading '
        isDisabled = true

    } else if (txStatus === TxStatuses.Mined) {
        isDisabled = true
    }

    const handleClick = () => {
        if (isDisabled) {
            return
        }
        onClick()
    }

    return (
        // @ts-ignore
        <span
            onClick={handleClick}
            disabled={isDisabled}
            className={className}>

            {label}

        </span>
    )
}

const Erc20ApproveButton = ({
    onClick,
    label,
    txStatus,
    isDisabled,
}) => {
    let className = 'button is-link '
    if (txStatus === TxStatuses.Pending) {
        className += 'is-loading '
        isDisabled = true

    } else if (txStatus === TxStatuses.Mined) {
        isDisabled = true
    }

    const handleClick = () => {
        if (isDisabled) {
            return
        }
        onClick()
    }

    return (
        // @ts-ignore
        <span
            onClick={handleClick}
            disabled={isDisabled}
            className={className}>

            {label}

        </span>
    )
}

export { Erc20ApproveButton, TxButton, TxStatuses, TxButtonStatus }
