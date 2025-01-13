import { trim } from "../index.js"

export function makeStubbedContract(stubs: { [functionSig: string]: string }): string {
  const labels = new Map(Object.keys(stubs).map(sig => [sig, '#' + sig.replace(/[()]/g, '__').replace(/,/g, '_')]))
  return trim.source`
    #runtime
    (CALLDATACOPY (math 1word - 4bytes) 0 4bytes) ; Copy function selector
    (MLOAD 0)

    ${Object.keys(stubs).map(sig => trim.source`
      (EQ (abi/fn-selector "${sig}") DUP1)
      (JUMPI ${labels.get(sig)} _)
    `).join('\n')}

    REVERT ; No matching function selector

    ${Object.keys(stubs).map(sig => trim.source`
      ${labels.get(sig)}
      JUMPDEST
      (MSTORE 0 ${stubs[sig]})
      (RETURN 0 1word)
    `).join('\n')}
  `
}
