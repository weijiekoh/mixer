import React from 'react'
import ReactDOM from 'react-dom'

const AboutRoute = () => {
    return (
        <div className='columns'>
            <div className='column is-12-mobile is-8-desktop is-offset-2-desktop'>
                <h2 className='subtitle'>
                    About MicroMix
                </h2>
                
                <p>
                    Your Ethereum transaction history and balance is public by
                    default. All transactions can be seen on block explorers
                    like <a href="https://etherscan.io/">Etherscan</a>, and
                    anyone who knows that you own a particular address can
                    easily view your balance and trace your payments.
                </p>

                <br />

                <p>
                    MicroMix helps you to reclaim your privacy. You can use it
                    to send Ether to any address in a way that obscures your
                    sending address.
                </p>

                <br />

                <p>
                    MicroMix does this using zero-knowledge proof technology.
                    You can use this app to deposit some ETH into a
                    noncustodial smart contract, and then easily generate a
                    proof that you had perfomed said deposit <em>without
                    revealing your original address</em>. The app will then
                    send this proof to an operator, which will submit it to the
                    smart contract, which will in turn send the ETH to the
                    desired recipient and reimburse the operator a small fee.
                </p>

                <br />

                <p>
                    If there are enough depositors, a nosy observer cannot link
                    any particular recipient's addresses to the depositor's.
                    To maximise the number of deposits (also known as the
                    {' '}<em>anonymity set</em>), the MicroMix user interface
                    encourages the user to leave the app open till midnight
                    UTC, which is when it will automatically mix the funds via
                    the operator. The user interface makes the user wait till
                    midnight instead of telling the user how large the
                    anonymity set is because an attacker could easily spam the
                    contract with deposits, causing a user to falsely believe that it is
                    large enough when it could easily be just 1, which grants no
                    privacy at all.
                </p>

                <br />

                <p>
                    Additionally, since a third-party operator pays the gas for
                    the transaction to mix the funds (also known as a
                    withdrawal), the recipient does not need the depositor to
                    send them gas to mix the funds (which would defeat the
                    purpose of the mixer).
                </p>

                <br />

                <p>
                    Click <a 
                        target="_blank"
                        href="https://github.com/weijiekoh/mixer">here</a>
                    {' '} for the source code, build instructions, and more
                    information about MicroMix.
                </p>

            </div>
        </div>
    )
}

export default AboutRoute
