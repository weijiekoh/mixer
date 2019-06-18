import React from 'react'
import ReactDOM from 'react-dom'
import { BrowserRouter as Router, Route, Link } from 'react-router-dom'
import DepositRoute from './routes/deposit'

const App = () => {
    return (
        <div>
            <div id='header'>
                <div id='logo'>
                    Logo
                </div>

                <nav>Navigation</nav>

                <div id='wallet'>
                    Wallet
                </div>
            </div>

            <Router>
                <Route path='/' exact component={DepositRoute} />
            </Router>
        </div>
    )
}

const root = document.getElementById('root')

ReactDOM.render(<App />, root)
