import o from 'ospec'
import { compileTrim, getOpcodesForTrim } from '../dist/index.js'
import { getOpcodesForHF } from '@ethereumjs/evm'
import { Common, Chain, Hardfork } from '@ethereumjs/common'


o.spec('interop smoke tests', function () {

  o('Mainnet Berlin', function () {
    const common = new Common({ chain: Chain.Mainnet, hardfork: Hardfork.Berlin })
    const opcodes = getOpcodesForTrim(getOpcodesForHF(common).opcodes)

    compileTrim('(ADD 0x00 0x01)', { opcodes })
  })
})
