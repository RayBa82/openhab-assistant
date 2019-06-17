/**
 * This is the main server code that processes requests and sends responses
 * back to users and to the HomeGraph.
 */

// Express imports
import * as express from 'express'
import * as bodyParser from 'body-parser'
import * as cors from 'cors'
import * as morgan from 'morgan'
import {AddressInfo} from 'net'
const moment = require('moment-timezone')

// Smart home imports
import {
    smarthome,
    SmartHomeV1ExecuteResponseCommands,
    Headers,
} from 'actions-on-google'

// Local imports
import * as Config from './config-provider'
import * as OpenHAB from './openhab'
import * as Devices from './devices'

const DATE_RFC2822 = 'ddd, DD MMM YYYY HH:mm:ss ZZ'
morgan.token('date', (req, res, tz) => {
    return moment().tz(tz).format(DATE_RFC2822)
})
morgan.format('myformat',
    '[:date[Europe/Berlin]] ":method :url" :status :res[content-length] - :response-time ms')

const expressApp = express()
expressApp.use(cors())
expressApp.use(morgan('myformat'))
expressApp.use(bodyParser.json({limit: '50mb'}))
expressApp.use(bodyParser.urlencoded({limit: '50mb', extended: true, parameterLimit: 50000}))
expressApp.set('trust proxy', 1)

let jwt
try {
    jwt = require('./smart-home-key.json')
} catch (e) {
    console.warn('Service account key is not found')
    console.warn('Report state and Request sync will be unavailable')
}

const app = smarthome({
    jwt,
    debug: true,
})

// Array could be of any type
// tslint:disable-next-line
async function asyncForEach(array: any[], callback: Function) {
    for (let index = 0; index < array.length; index++) {
        await callback(array[index], index, array)
    }
}

// tslint:disable-next-line:no-any
function forEach(array: any[], callback: Function) {
    for (let index = 0; index < array.length; index++) {
        callback(array[index], index, array)
    }
}

async function getUserId(accessToken: string): Promise<string> {
    return await OpenHAB.getUid(accessToken)
}

function getToken(headers: Headers): string {
    const authorization = headers.authorization
    return (authorization as string).substr(7)
}

app.onSync(async (body, headers) => {
    const accessToken = getToken(headers)
    const userId = await getUserId(accessToken)

    const devices = await OpenHAB.getDevices(accessToken)
    devices.forEach(device => {
        console.info('Adding device: ' + device.id)
    })
    return {
        requestId: body.requestId,
        payload: {
            agentUserId: userId,
            devices,
        },
    }
})

interface DeviceStatesMap {
    // tslint:disable-next-line
    [key: string]: any
}

app.onQuery(async (body, headers) => {
    const accessToken = getToken(headers)
    const deviceStates: DeviceStatesMap = {}
    const {devices} = body.inputs[0].payload
    await asyncForEach(devices, async (device: { id: string }) => {
        const states = await OpenHAB.getState(accessToken, device.id)
        deviceStates[device.id] = states
    })
    return {
        requestId: body.requestId,
        payload: {
            devices: deviceStates,
        },
    }
})

app.onExecute(async (body, headers) => {
    const accessToken = getToken(headers)
    const commands: SmartHomeV1ExecuteResponseCommands[] = [{
        ids: [],
        status: 'PENDING',
        states: {},
    }]

    const {devices, execution} = body.inputs[0].payload.commands[0]
    await asyncForEach(devices, async (device: { id: string }) => {
        try {
            const states = await OpenHAB.execute(accessToken, device.id, execution[0])
            commands[0].ids.push(device.id)
            commands[0].states = states
        } catch (e) {
            commands.push({
                ids: [device.id],
                status: 'ERROR',
                errorCode: e.message,
            })
        }
    })

    return {
        requestId: body.requestId,
        payload: {
            commands,
        },
    }
})

app.onDisconnect(async (body, headers) => {
    console.log('disconnected')
    return {}
})

expressApp.post('/smarthome', app)

expressApp.post('/smarthome/reportstate', async (req, res) => {
    const {uid, items} = req.body
    const devices = Devices.parseDevices(items)
    const states = {}
    await forEach(items, async (item) => {
        let isGoogleDevice = false
        for (const device of devices) {
            if (item.name === device.id) {
                isGoogleDevice = true
                break
            }
        }
        if (isGoogleDevice) {
            const state = await OpenHAB.parseItemStates(item)
            states[item.name.toString()] = state
        }
    })
    const reportState = {
        agentUserId: uid,
        requestId: Math.random().toString(),
        payload: {
            devices: {
                states,
            },
        },
    }
    const result = {}
    try {
        await app.reportState(reportState)
        result['status'] = 'SUCCESS'
        res.status(200).json(JSON.stringify(result))
    } catch (e) {
        result['status'] = 'ERROR'
        result['errorCode'] = e.message
        res.status(500).json(JSON.stringify(result))
    }
})

const appPort = process.env.PORT || Config.expressPort

const expressServer = expressApp.listen(appPort, () => {
    const server = expressServer.address() as AddressInfo
    const {address, port} = server

    console.log(`Smart home server listening at ${address}:${port}`)

})
