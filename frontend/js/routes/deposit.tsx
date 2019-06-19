import React, { Component } from 'react'
import ReactDOM from 'react-dom'

const DepositRoute = () => {
    return (
        <div className='section'>
            <div className='columns has-text-centered'>
                <div className='column is-12'>
                    <div className='section'>
                        <h2 className='subtitle'>
                            MultiMix (working name) helps you hide your bags.
                        </h2>
                    </div>
                    <div className='section'>
                        <p>
                            You can mix 0.1 ETH at a time.
                        </p>
                        <p>
                            The operator's fee is 1%.
                        </p>
                        <p>
                            You can get back 0.099 ETH at midnight, UTC.
                        </p>
                    </div>

                    <div className='section'>
                        <a className="button is-primary is-large">
                            Deposit 0.1 ETH
                        </a>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default DepositRoute
