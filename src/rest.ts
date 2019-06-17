import {Response} from 'request'
import * as Config from './config-provider'

const https = require('http')


export const fetch = (options) => new Promise((resolve, reject) => {
    https.get(options, (res: Response) => {
        let data = ''
        res.on('end', () => resolve(data))
        res.on('data', (buf) => data += buf.toString())
    })
        .on('error', e => reject(e))
})

export async function getItem(token: string, itemName: string) {
    const options = httpItemOptions(token, itemName, null, null)
    const data = await fetch(options)
    return JSON.parse(String(data))
}

export async function getUid(token: string): Promise<string> {
    const options = {
        hostname: Config.openHABHost,
        port: Config.openHABPort,
        path: '/rest/uuid',
        method: 'GET',
        headers: {},
    }
    options.headers['Authorization'] = 'Bearer ' + token
    const data = await fetch(options)
    return String(data)
}


// @ts-ignore
function httpItemOptions(token, itemname, method, length) {
    const options = {
        hostname: Config.openHABHost,
        port: Config.openHABPort,
        path: Config.itemPath + (itemname || '') + '?recursive=true',
        method: method || 'GET',
        headers: {},
    }
    options.headers['Authorization'] = 'Bearer ' + token

    if (method === 'POST' || method === 'PUT') {
        options.headers['Content-Type'] = 'text/plain'
        options.headers['Content-Length'] = length
    }
    return options
}

export async function postItemCommand(token, itemName, value) {
    const options = httpItemOptions(token, itemName, 'POST', value.length)
    await post(options, value)
}

export const post = (options, value) => new Promise((resolve, reject) => {
    const req = https.request(options, (res: Response) => {
        let data = ''
        res.on('end', () => resolve(data))
        res.on('data', (buf) => data += buf.toString())
    })
        .on('error', e => reject(e))
    req.write(value)
    req.end()
})
