import React, { useState } from 'react'
import ReactDOM from 'react-dom'
import { BrowserRouter as Router, Route, Link } from 'react-router-dom'
import DepositRoute from './routes/deposit'

const App = () => {
    const [menuToggle, setMenuToggle] = useState(false)

    const burgerClassName = menuToggle ? 'navbar-burger is-active' : 'navbar-burger'
    const navbarMenuClassName = menuToggle ? 'navbar-menu is-active' : 'navbar-menu'

    return (
        <div className='section'>
            <nav className='navbar' role='navigation' aria-label='main navigation'>
                <div className='navbar-brand'>
                    <a className='navbar-item' href='/'>
                        MultiMix
                    </a>

                    <a role='button' className={burgerClassName} 
                        onClick={ () => setMenuToggle(!menuToggle) }
                        aria-label='menu' aria-expanded='false'>
                        <span aria-hidden='true'></span>
                        <span aria-hidden='true'></span>
                        <span aria-hidden='true'></span>
                    </a>

                </div>

                <div className={ navbarMenuClassName }>
                    <div className='navbar-end'>
                        <div className='navbar-item' id='wallet-widget'>
                            Wallet widget
                        </div>

                        <a className='navbar-item' href='/about'>
                            About
                        </a>

                        <div className='navbar-item has-dropdown is-hoverable'>
                            <a className='navbar-link' id='options-link'>
                                Options
                            </a>

                            <div className='navbar-dropdown'>
                                <a className='navbar-item' href='/quick-withdraw'>
                                    Quick withdrawal
                                </a>

                                <a className='navbar-item' href='/backup-keys'>
                                    Backup keys
                                </a>
                            </div>
                        </div>
                    </div>
                </div>
            </nav>

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
