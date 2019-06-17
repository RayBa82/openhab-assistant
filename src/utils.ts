/**
 * Copyright (c) 2014-2018 by the respective copyright holders.
 *
 * All rights reserved. This program and the accompanying materials
 * are made available under the terms of the Eclipse Public License v1.0
 * which accompanies this distribution, and is available at
 * http://www.eclipse.org/legal/epl-v10.html
 */

/**
 * openHAB Utils helper for temperature, color transformations and more,
 * adapted from the opanHAB Alexa Skill
 *
 * @author Mehmet Arziman - Initial contribution
 * @author Dan Cunningham - Foundations
 *
 */


//Convert F to C
export function toC(value) {
    return ((value - 32) * 5 / 9).toFixed(2)
}
