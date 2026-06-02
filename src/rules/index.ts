import type {Rule} from '../types.js'
import {filenameAltText} from './filename-alt-text.js'
import {vagueAltText} from './vagueAltText.js'
import {missingAltText} from './missingAltText.js'
import {repeatedAltText} from './repeatedAltText.js'

// Append-only registry. Add a rule by importing it here and pushing it onto the array.
export const allRules: Rule[] = [filenameAltText, vagueAltText, missingAltText, repeatedAltText]
