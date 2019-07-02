// The functions in this file handle the storage of identities (keypair and
// identityNullifier) in the browser's localStorage. The identityCommitment is
// deterministically derived using mixer-crypto's genIdentityCommitment
// function, so we don't store it.

import {
    Identity,
    EddsaPrivateKey,
} from 'mixer-crypto'

interface IdentityStored {
    identityNullifier: BigInt,
    privKey: EddsaPrivateKey
    txHash: string
}

const localStorage = window.localStorage
const key = 'MIXER'

const initStorage = () => {
    if (!localStorage.getItem(key)) {
        localStorage.setItem(key, JSON.stringify([]))
    }
}

const hexifyItem = (item: IdentityStored) => {
    return Object.assign(
        item,
        {
            identityNullifier: item.identityNullifier.toString(16),
            privKey: item.privKey.toString('hex'),
        }
    )
}

const updateDepositTxStatus = (
    identity: Identity,
    txHash: string,
) => {
    let items = getItems()
    for (let i=0; i < items.length; i++) {
        if (items[i].identityNullifier === identity.identityNullifier.toString(16)) {
            items[i].txHash = txHash
            break
        }
    }
    saveItems(items)
}

const getItems = () => {
    const stored = localStorage.getItem(key)
    if (!stored) {
        throw 'Storage not initialised'
    }
    return JSON.parse(stored)
}

const saveItems = (items: any[]) => {
    const data = JSON.stringify(items.map(hexifyItem))
    localStorage.setItem(key, data)
}

const storeDeposit = (identity: Identity, recipientAddress: string, txHash=null) =>  {
    const items = getItems()
    items.push({
        privKey: identity.keypair.privKey,
        identityNullifier: identity.identityNullifier,
        txHash,
        recipientAddress,
        timestamp: (new Date()).getTime(),
    })
    saveItems(items)
}

export {
    initStorage,
    storeDeposit,
    updateDepositTxStatus,
}
