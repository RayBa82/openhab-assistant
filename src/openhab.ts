import * as Rest from './rest'
import * as Devices from './devices'
import {SmartHomeV1ExecuteRequestExecution, SmartHomeV1SyncDevices} from 'actions-on-google'
import {ApiClientObjectMap} from 'actions-on-google/dist/common'
const colr = require('colr')
import * as Utils from './utils'


export async function getDevices(token: string): Promise<SmartHomeV1SyncDevices[]> {
    const items = await Rest.getItem(token, '')
    return Devices.parseDevices(items)
}

export async function getUid(token: string): Promise<string> {
    return await Rest.getUid(token)
}

export async function getState (token: string,  deviceId: string):
    Promise<ApiClientObjectMap<string | boolean | number>> {
    const res = await Rest.getItem(token, deviceId)
    return await parseItemStates(res)
}

export async function parseItemStates(item):
    Promise<ApiClientObjectMap<string | boolean | number>> {
    let itemData = {}
    const checkTags = item.tags.toString()
    //get the data from the device
    switch (item.type) {
        case 'Switch':
        case 'Scene':
        case 'Outlet':
            itemData = getSwitchData(item)
            break
        case 'Group':
            //future proof in case Groups are used for other invocations
            if (checkTags.includes('Thermostat')) itemData = getTempData(item)
            break
        case 'Dimmer':
            itemData = getLightData(item)
            break
        case 'Color':
            itemData = getColorData(item)
            break
        case 'Rollershutter':
            itemData = getRollerShutterData(item)
            break
        default:
            if (checkTags.includes('CurrentTemperature')) itemData = getTempData(item)
            break
    }

    const result = {
        online: true,
    }
    //find out, which data needs to be delivered to google
    const traits = Devices.getSwitchableTraits(item)
    for (let i = 0; i < traits.length; i++) {
        switch (traits[i]) {
            case 'action.devices.traits.OnOff':
                result['on'] = itemData['on']
                break
            case 'action.devices.traits.Scene': //scene's are stateless in google home graph
                break
            case 'action.devices.traits.Brightness':
                result['brightness'] = itemData['brightness']
                break
            case 'action.devices.traits.ColorSpectrum':
                result['color'] = itemData['color']
                break
            case 'action.devices.traits.TemperatureSetting':
                result['thermostatMode'] = itemData['thermostatMode']
                result['thermostatTemperatureAmbient'] = itemData['thermostatTemperatureAmbient']
                result['thermostatTemperatureSetpoint'] = itemData['thermostatTemperatureSetpoint']
                result['thermostatHumidityAmbient'] = itemData['thermostatHumidityAmbient']
                break
            case 'action.devices.traits.OpenClose':
                result['openPercent'] = itemData['openPercent']
                break
            default:
                break
        }
    }
    return result
}

// tslint:disable-next-line:no-any
type StatesMap = ApiClientObjectMap<any>

// tslint:disable-next-line:max-line-length
export async function execute(token: string, deviceId: string, execution: SmartHomeV1ExecuteRequestExecution):
    Promise<StatesMap> {
    const states: StatesMap = {
        online: true,
    }
    let openHABState = ''
    switch (execution.command) {
        // action.devices.traits.ArmDisarm
        case 'action.devices.commands.OnOff':
            openHABState = execution.params.on ? 'ON' : 'OFF'
            states['on'] = execution.params.on
            break
        case 'action.devices.commands.BrightnessAbsolute':
            openHABState = execution.params.brightness.toString()
            states['brightness'] = execution.params.brightness
            break
        case 'action.devices.commands.ChangeColor':
        case 'action.devices.commands.ColorAbsolute':
            const red = Math.floor(execution.params.color.spectrumRGB / (256 * 256))
            const green = Math.floor((execution.params.color.spectrumRGB % (256 * 256)) / 256)
            const blue = execution.params.color.spectrumRGB % 256
            const rgbColor = colr.fromRgb(red, green, blue)
            openHABState = rgbColor.toHsvArray()
            states['color'] =  {
                spectrumRGB: execution.params.color.spectrumRGB,
            }
            break
        case 'action.devices.commands.ActivateScene':
            openHABState = execution.params.deactivate ? 'OFF' : 'ON'
            break
        case 'action.devices.commands.ThermostatTemperatureSetpoint':
            //adjustThermostatTemperature(request, response, i, j);
            break
        case 'action.devices.commands.ThermostatSetMode':
            const item = await Rest.getItem(token, deviceId)
            const items = Devices.getThermostatItems(item.members)
            deviceId = items['heatingCoolingMode'].name
            openHABState = execution.params.thermostatMode.toString()
            break
        case 'action.devices.commands.OpenClose':
            const iState = execution.params.openPercent
            if (iState === 0) {
                openHABState = 'DOWN'
            } else if (iState === 100) {
                openHABState = 'UP'
            } else {
                openHABState = (100 - iState).toString()
            }
            states['openPercent'] = execution.params.openPercent
            break
        case 'action.devices.commands.StartStop':
            openHABState = execution.params.start ? 'MOVE' : 'STOP'
            states['start'] = execution.params.start
            break
        default:
    }
    await Rest.postItemCommand(token, deviceId, openHABState)
    return states
}

/**
 *  Retrieves Switch Attributes from OpenHAB Item
 */
export function getSwitchData(item) {
    return {
        on: item.state === 'ON',
    }
}

/**
 *  Retrieves Light Attributes from OpenHAB Item
 */
export function getLightData(item) {
    return {
        on: item.state === 'ON' ? true : (Number(item.state) !== 0),
        brightness: Number(item.state),
    }
}

/**
 *  Retrieves Color Attributes from OpenHAB Item
 */
export function getColorData(item) {
    const hsvArray = item.state.split(',').map(val => Number(val))
    const color = colr.fromHsvArray(hsvArray)
    // tslint:disable-next-line:ban
    const rgbColor = parseInt(color.toHex().replace('#', ''), 16)

    return {
        color: {
            spectrumRGB: rgbColor,
        },
        brightness: hsvArray[2],
        on: hsvArray[2] === 0 ? false : true,
    }
}

/**
 * Gets Rollershutter Data
 */
export function getRollerShutterData(item) {
    const state = 100 - Number(item.state)
    return {
        openPercent: state,
    }
}

/**
 * Gets Temperature or Thermostat Data
 */
function getTempData(item) {
    const thermData = {}
    const isThermostat = item.tags.toString().toLowerCase().includes('thermostat')
    const thermItems = isThermostat ?
        Devices.getThermostatItems(item.members) : Devices.getThermostatItems([item])

    //Are we dealing with Fahrenheit?
    const isF = item.tags.toString().toLowerCase().includes('fahrenheit')
    //store long json variables in easier variables to work with below
    const tstatMode = thermItems.hasOwnProperty('heatingCoolingMode') ?
        thermItems['heatingCoolingMode'].state : 'heat'
    const currTemp = thermItems.hasOwnProperty('currentTemperature') ?
        // tslint:disable-next-line:max-line-length
        (isF ? Utils.toC(thermItems['currentTemperature'].state) : thermItems['currentTemperature'].state) : ''
    const tarTemp = thermItems.hasOwnProperty('targetTemperature') ?
        // tslint:disable-next-line:max-line-length
        (isF ? Utils.toC(thermItems['targetTemperature'].state) : thermItems['targetTemperature'].state) : ''
    const curHum = thermItems.hasOwnProperty('currentHumidity') ?
        thermItems['currentHumidity'].state : ''

    if (currTemp !== '') {
        thermData['thermostatMode'] = tstatMode
        // tslint:disable-next-line:ban
        thermData['thermostatTemperatureAmbient'] = Number(parseFloat(currTemp))
        // tslint:disable-next-line:ban
        thermData['thermostatTemperatureSetpoint'] = Number(parseFloat(currTemp))
    }
    if (isThermostat) {
        if (tarTemp !== '') {
            // tslint:disable-next-line:ban
            thermData['thermostatTemperatureSetpoint'] = Number(parseFloat(tarTemp))
        }
        if (curHum !== '') {
            // tslint:disable-next-line:ban
            thermData['thermostatHumidityAmbient'] = Number(parseFloat(curHum))
        }
    }

    return thermData
}
