import { compileTrim } from './trim/index.js'
export { compileBasm } from './basm.js'
export { getOpcodesForTrim } from './interop.js'
export { debugDecompileToBasm } from './decompile.js'
export { makeStaticRouter } from './templates/static-router.js'
export { makeStubbedContract } from './templates/stubbed-contract.js'

//
// Support syntaxes:
// trim`...`
// trim.compile(trim.source`...`, options)
//
function templateTag(strings: TemplateStringsArray, ...values: any[]): string {
  return String.raw(strings, ...values)
}

type TemplateFn = (strings: TemplateStringsArray, ...values: any[]) => string
export const trim: TemplateFn & { source: TemplateFn, compile: typeof compileTrim } = function(...args) {
  return templateTag(...args)
}

trim.source = templateTag
trim.compile = compileTrim
