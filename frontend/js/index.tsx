import React, { useEffect } from 'react'
import ReactDOM from 'react-dom'
import { BrowserRouter as Router, Route } from 'react-router-dom'
import Web3Provider, { useWeb3Context } from 'web3-react'

import Nav from './nav'
import DepositRoute from './routes/deposit'
import connectors from './web3'

const App = () => {

    return (
        <Web3Provider connectors={connectors} libraryName='ethers.js'>
            <div className='section'>

                <Nav />

                <div className='section'>
                    <div className='container'>
                        <Router>
                            <Route path='/' exact component={DepositRoute} />
                        </Router>
                    </div>
                </div>
            </div>
        </Web3Provider>
    )
}

const root = document.getElementById('root')

ReactDOM.render(<App />, root)
