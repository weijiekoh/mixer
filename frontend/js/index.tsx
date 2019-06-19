import React from 'react'
import ReactDOM from 'react-dom'
import { BrowserRouter as Router, Route } from 'react-router-dom'
import Nav from './nav'
import DepositRoute from './routes/deposit'

const App = () => {
    return (
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
    )
}

const root = document.getElementById('root')

ReactDOM.render(<App />, root)
