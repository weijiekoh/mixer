import React, { Component, useState } from 'react'
import ReactDOM from 'react-dom'


export default () => {
    const now = new Date()
    const utcMidnight = new Date(Date.UTC(
        now.getFullYear(),
        now.getMonth(),
        now.getDate() + 1,
    ))

    const [currentTime, setCurrentTime] = useState(new Date())

    setInterval(() => {
        setCurrentTime(new Date())
    }, 1000)

    const minsLeft = Math.floor((utcMidnight.getTime() - currentTime.getTime()) / 60 / 1000)

    const hoursLeft = Math.floor(minsLeft / 60)
    const minsMod = minsLeft - (hoursLeft * 60)

    const months = [
        'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
    ]

    const timeStr = `${utcMidnight.getDate()} ${months[utcMidnight.getMonth()]} ${utcMidnight.getFullYear()}, ${utcMidnight.toLocaleTimeString()}`

    return (
        <div className='section'>

            <div className='columns has-text-centered'>
                <div className='column is-12'>
                    <div className='section'>
                        <h2 className='subtitle'>
                            The recipient you specified will receive the ETH
                            shortly after { timeStr }.
                        </h2>

                        <h2 className='subtitle'>
                            {hoursLeft} hours and {minsMod} minutes left.
                        </h2>

                    </div>
                </div>
            </div>

            <div className='columns'>
                <div className='column is-3 is-offset-3'>
                    <p>
                        To maximise anonymity, we only allow users to
                        submit withdrawal requests after midnight UTC.
                        For example, if you deposit your funds at 3pm UTC
                        on 1 Jan, this page will wait till midnight 2 Jan
                        UTC to mix the funds.
                    </p>
                </div>

                <div className='column is-3 is-offset-1'>
                    <p>
                        If you close this tab, you can reopen it any time.
                        You can even open it after midnight UTC. You'll see
                        a button which you can click to mix the funds.
                    </p>
                </div>

            </div>

            <br />
            <div className="columns has-text-centered">
                <div className='column is-12'>
                    <h2 className='subtitle'>
                        Please keep this tab open.
                    </h2>
                </div>
            </div>
        </div>
    )
}

