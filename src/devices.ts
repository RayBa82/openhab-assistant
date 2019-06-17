import {SmartHomeV1SyncDevices} from 'actions-on-google'

export function parseDevices(items): SmartHomeV1SyncDevices[] {
    const devices: SmartHomeV1SyncDevices[] = []
    const thermostatGroups: string[] = []
    for (const itemNum in items) {
        const item = items[itemNum]
        for (const tagNum in item.tags) {
            const tag = item.tags[tagNum]
            if (tag === 'Thermostat' && item.type === 'Group') {
                thermostatGroups.push(item.name)
            }
        }
    }

    for (const itemNum in items) {
        const item = items[itemNum]
        for (const tagNum in item.tags) {
            const tag = item.tags[tagNum]
            let deviceTraits: string[] = []
            const attributeDetails = {}
            let deviceTypes = ''

            switch (tag) {

                case 'Lighting':
                    deviceTypes = 'action.devices.types.LIGHT'
                    deviceTraits = getSwitchableTraits(item)
                    break
                case 'Switchable':
                    deviceTypes = 'action.devices.types.SWITCH'
                    deviceTraits = getSwitchableTraits(item)
                    break
                case 'Scene':
                    deviceTypes = 'action.devices.types.SCENE'
                    deviceTraits.push('action.devices.traits.Scene')
                    attributeDetails['sceneReversible'] = true
                    break
                case 'Outlet':
                    deviceTypes = 'action.devices.types.OUTLET'
                    deviceTraits = getSwitchableTraits(item)
                    break
                case 'CurrentTemperature':
                    //if this is not part of a thermostatGroup then add it
                    //standalone otherwise it will be available as a thermostat
                    if (!matchesGroup(thermostatGroups, item.groupNames)) {
                        deviceTraits.push('action.devices.traits.TemperatureSetting')
                        deviceTypes = 'action.devices.types.THERMOSTAT'
                        setTempAttributes(item, attributeDetails, false)
                    }
                    break
                case 'Thermostat':
                    //only group items are allowed to have a Temperature tag
                    if (item.type === 'Group') {
                        deviceTraits.push('action.devices.traits.TemperatureSetting')
                        deviceTypes = 'action.devices.types.THERMOSTAT'
                        setTempAttributes(item, attributeDetails, true)
                    }
                    break
                case 'Blinds':
                    deviceTypes = 'action.devices.types.BLINDS'
                    deviceTraits.push('action.devices.traits.OpenClose')
                    deviceTraits.push('action.devices.traits.StartStop')
                    attributeDetails['openDirection'] = ['UP', 'DOWN']
                    break
                default:
                    break
            }
            if (deviceTraits.length > 0) {

                const nickNames: string[] = []
                nickNames.push(item.label)

                const device: SmartHomeV1SyncDevices = {
                    id: item.name,
                    type: deviceTypes,
                    traits: deviceTraits,
                    name: {
                        defaultNames: nickNames,
                        name: item.label,
                        nicknames: nickNames,
                    },
                    deviceInfo: {
                        manufacturer: 'OpenHAB',
                        model: item.type,
                        hwVersion: '1.0',
                        swVersion: '1.0',
                    },
                    willReportState: true,
                    attributes: attributeDetails,
                }
                devices.push(device)
            }
        }
    }

    return devices
}

/**
 * Given an item, returns an array of traits that are supported.
 */
// @ts-ignore
export function getSwitchableTraits(item) {
    const traits: string[] = []
    if (item.type === 'Switch' ||
        (item.type === 'Group' && item.groupType && item.groupType === 'Switch')) {
        traits.push('action.devices.traits.OnOff')
    } else if (item.type === 'Dimmer' ||
        (item.type === 'Group' && item.groupType && item.groupType === 'Dimmer')) {
        traits.push('action.devices.traits.Brightness')
        traits.push('action.devices.traits.OnOff')
    } else if (item.type === 'Color' ||
        (item.type === 'Group' && item.groupType && item.groupType === 'Color')) {
        traits.push('action.devices.traits.Brightness')
        traits.push('action.devices.traits.OnOff')
        traits.push('action.devices.traits.ColorSpectrum')
    } else if (item.type === 'Rollershutter' ||
        (item.type === 'Group' && item.groupType && item.groupType === 'Rollershutter')) {
        traits.push('action.devices.traits.OpenClose')
    } else if ((item.tags.toString().includes('CurrentTemperature')
        || (item.type === 'Group' && item.tags.toString().includes('Thermostat')))) {
        traits.push('action.devices.traits.TemperatureSetting')
    }
    return traits
}

// @ts-ignore
function matchesGroup(groups1, groups2) {
    for (const num in groups1) {
        if (groups2.indexOf(groups1[num]) >= 0) {
            return true
        }
    }
    return false
}

function setTempAttributes(item, attributeDetails, isThermostat) {
    if (item.tags.indexOf('Fahrenheit') > -1 || item.tags.indexOf('fahrenheit') > -1) {
        attributeDetails.thermostatTemperatureUnit = 'F'
    } else {
        attributeDetails.thermostatTemperatureUnit = 'C'
    }
    if (isThermostat) {
        const heatingCoolingMode = getThermostatItems(item.members)['heatingCoolingMode']
        if (heatingCoolingMode !== undefined
            && heatingCoolingMode['stateDescription'] !== undefined
            && heatingCoolingMode['stateDescription']['options'] !== undefined) {
            const options = heatingCoolingMode['stateDescription']['options']
            attributeDetails.availableThermostatModes = options.map(option => option.value)
                .toString()
        } else {
            attributeDetails.availableThermostatModes = 'heat'
        }
    } else {
        attributeDetails.queryOnlyTemperatureSetting = true
    }
}

/**
 * Returns a thermostat object based on members of a thermostat tagged group
 */
export function getThermostatItems(thermoGroup): object {
    const values = {}
    thermoGroup.forEach(member => {
        member.tags.forEach(tag => {
            if (tag === 'CurrentTemperature') {
                values['currentTemperature'] = member
            }
            if (tag === 'TargetTemperature') {
                values['targetTemperature'] = member
            }
            if (tag === 'homekit:HeatingCoolingMode') {
                values['heatingCoolingMode'] = member
            }
            if (tag === 'CurrentHumidity') {
                values['currentHumidity'] = member
            }
        })
    })
    return values
}
