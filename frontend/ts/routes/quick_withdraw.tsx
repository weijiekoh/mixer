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

export default () => {
    const identityStored = getItems()[0]
    const recipientAddress = identityStored.recipientAddress

    return (
        <div className='section'>
            <div className='columns has-text-centered'>
                <div className='column is-8 is-offset-2'>
                    <div className='section'>
                        <h2 className='subtitle'>

                            You can choose to immediately withdraw { mixAmtEth - operatorFeeEth * 2 } to
                            <pre>
                                {recipientAddress} 
                            </pre>
                        </h2>
                    </div>

                    <div className='section'>
                        <label className="checkbox">
                            <input type="checkbox" className="consent_checkbox" />
                            I understand that when I do this, I will not gain any privacy.
                       </label>

                        <br />
                        <br />

                        <span
                            onClick={() => {}}
                            href='/countdown'
                            className='button is-large is-primary'>
                            {`Withdraw ${mixAmtEth - operatorFeeEth * 2} now`}
                        </span>
                   </div>
                </div>
            </div>
        </div>
    )
}
