import React, { useState } from 'react'
import ReactDOM from 'react-dom'
// @ts-ignore
import logo from '../img/logo.png'

import WalletWidget from './components/walletWidget'

const Nav = () => {
    const [menuToggle, setMenuToggle] = useState(false)

    const burgerClassName = menuToggle ? 'navbar-burger is-active' : 'navbar-burger'
    const navbarMenuClassName = menuToggle ? 'navbar-menu is-active' : 'navbar-menu'

    return (
        <nav className='navbar' role='navigation' aria-label='main navigation'>
            <div className='navbar-brand'>
                <a className='navbar-item' href='/'>
                    <img src={logo} />
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
                        <WalletWidget />
                    </div>

                    <a className='navbar-item' href='/about'>
                        About
                    </a>

                    <div className='navbar-item has-dropdown is-hoverable'>
                        <a className='navbar-link' id='options-link'>
                            Options
                        </a>

                        <div className='navbar-dropdown'>
                            <a className='navbar-item' href='/quick_withdraw'>
                                Quick withdrawal
                            </a>

                            {/*
                            <a className='navbar-item' href='/backup-keys'>
                                Backup keys
                            </a>
                            */}
                        </div>
                    </div>
                </div>
            </div>
        </nav>
    )
}

export default Nav
