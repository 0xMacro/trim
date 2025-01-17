import { GenerateFeatures, OpcodeDef, OpcodeMeta } from "../types"
import { standardMacros } from "./macros.js"
import { Counter, Pos } from "../util.js"
import { generateBytecodeAst, generateBytecode } from "./generate.js"
import { parseTrim } from "./parse.js"
import { standardOpcodes } from "../standard-opcodes.js"
import { standardOpcodesMetadata } from "../opcodes.js"


type CompileOptions = {
  opcodes?: OpcodeDef[]
  opcodesMetadata?: Record<string, OpcodeMeta>
  features?: GenerateFeatures
}
export function compileTrim(source: string, options: CompileOptions = {}) {
  const opcodes = options.opcodes || standardOpcodes
  const opcodesMetadata = options.opcodesMetadata || standardOpcodesMetadata
  const features = options.features || {}
  features.push0 ||= true
  if (features.push0 && !opcodes.find(op => op.asm === 'PUSH0')) {
    if (options.features?.push0) console.warn('Warning: features.push0 is true but PUSH0 opcode is not defined. Ignoring.')
    features.push0 = false
  }
  const macros = { ...standardMacros }
  const compileOptions = { opcodes, macros, opcodesMetadata, features }
  const program = parseTrim(source, new Pos(), { topLevel: true })
  const ast = generateBytecodeAst(program, compileOptions)
  return '0x' + generateBytecode(ast, compileOptions).join('')
}
