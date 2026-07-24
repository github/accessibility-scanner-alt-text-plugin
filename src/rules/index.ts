import type {Rule} from '../types.js'
import {altTextQuality} from './alt-text-quality.js'
import {filenameAltText} from './filename-alt-text.js'
import {vagueAltText} from './vague-alt-text.js'
import {missingAltText} from './missing-alt-text.js'
import {placeholderAltText} from './placeholder-alt-text.js'
import {repeatedAltText} from './repeated-alt-text.js'

// Rule registry. Add a rule by importing it here and pushing it onto the array.
export const allRules: Rule[] = [
  filenameAltText,
  vagueAltText,
  missingAltText,
  placeholderAltText,
  repeatedAltText,
  altTextQuality,
]
