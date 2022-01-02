import { MacroFn, OpcodeDef } from "../types"
import { standardMacros } from "./macros.js"
import { Pos } from "../util.js"
import { generateBytecodeAst, generateBytecode } from "./generate.js"
import { parseTrim } from "./parse.js"


type CompileOptions = {
  opcodes: OpcodeDef[]
}
export function compileTrim(source: string, options: CompileOptions) {
  const macros = { ...standardMacros }
  const program = parseTrim(source, new Pos(), { topLevel: true })
  const ast = generateBytecodeAst(program, options.opcodes, macros)
  return '0x' + generateBytecode(ast, options.opcodes, macros).join('')
}
