import type {Rule} from '../types.js'
import {vagueAltText} from './vagueAltText.js'

// Array stores all rules to be enforced by the scanner.
export const allRules: Rule[] = [vagueAltText]
