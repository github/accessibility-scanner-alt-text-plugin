import type {Rule} from '../types.js'
import {filenameAltText} from './filename-alt-text.js'

// Append-only registry. Add a rule by importing it here and pushing it onto the array.
export const allRules: Rule[] = [filenameAltText]
