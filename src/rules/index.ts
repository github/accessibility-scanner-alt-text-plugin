import type {Rule} from '../types.js'
import {filenameAltText} from './filename-alt-text.js'
import {vagueAltText} from './vagueAltText.js'
import {missingAltText} from './missingAltText.js'
import {repeatedAltText} from './repeatedAltText.js'

// Array that stores all rules to be enforced by the scanner.
export const allRules: Rule[] = [filenameAltText, vagueAltText, missingAltText, repeatedAltText]
