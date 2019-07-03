import React, { Component, useState } from 'react'
import ReactDOM from 'react-dom'
import { Redirect } from 'react-router-dom'
const config = require('../exported_config')
import {
    getItems,
    getNumItems,
} from '../storage'

const mixAmtEth = config.mixAmtEth
const operatorFeeEth = config.operatorFeeEth

const months = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
]

export default () => {
    if (getNumItems() === 0) {
        return <Redirect to='/' />
    }

    const identityStored = getItems()[0]
    const recipientAddress = identityStored.recipientAddress
    
    const now = new Date()
    const utcMidnight = new Date(Date.UTC(
        now.getFullYear(),
        now.getMonth(),
        now.getDate() + 1,
    ))

    const [currentTime, setCurrentTime] = useState(new Date())

    // update the clock every `interval` ms
    const interval = 5000
    setTimeout(function update(){
        const time = new Date()
        setCurrentTime(time)
        setTimeout(update, interval)
    }, interval)

    const secsLeft = Math.floor((utcMidnight.getTime() - currentTime.getTime()) / 1000)
    const secsMod = secsLeft % 60

    const hoursMod = Math.floor(secsLeft / 3600)
    const minsMod = Math.floor((secsLeft - (hoursMod * 3600))/ 60)

    const timeStr = `${utcMidnight.getDate()} ${months[utcMidnight.getMonth()]} ${utcMidnight.getFullYear()}, ${utcMidnight.toLocaleTimeString()}`

    return (
        <div className='section'>

            <div className='columns has-text-centered'>
                <div className='column is-8 is-offset-2'>
                    <div className='section'>
                        <h2 className='subtitle'>
                            <pre>
                                {recipientAddress} 
                            </pre>
                            <br />
                            will
                            receive {mixAmtEth - operatorFeeEth} ETH shortly
                            after { timeStr }.
                        </h2>
                    </div>
                </div>
            </div>

            <div className='columns'>
                <div className='column is-3 is-offset-3'>
                    <p>
                        To maximise anonymity, we only allow users to
                        submit mix requests after midnight UTC.
                        For example, if you deposit your funds at 3pm UTC
                        on 1 Jan, this page will wait till midnight 2 Jan
                        UTC to mix the funds.
                    </p>
                </div>

                <div className='column is-3 is-offset-1'>
                    <p>
                        Please keep this tab open to automatically mix the
                        funds. If you close this tab, you can reopen it any
                        time, and withdraw it at a click of a button, even
                        after midnight UTC.
                    </p>
                </div>

            </div>

            <br />

            <div className="columns has-text-centered">
                <div className='column is-12'>
                        <h2 className='subtitle'>
                            {hoursMod}h {minsMod}m {secsMod}s left
                        </h2>
                    <h2 className='subtitle'>
                        Please keep this tab open.
                    </h2>
                </div>
            </div>
        </div>
    )
}

