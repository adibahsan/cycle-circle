/**
 * Every `test.fail(...)` / `test.fixme(...)` (also `test.describe.fail/fixme`) must carry a
 * string containing a link to an open issue, so an expected failure always has an owner.
 */
const LINK = /github\.com\/adibahsan\/cycle-circle\/issues\/\d+/
const KINDS = new Set(['fail', 'fixme'])

/** Concatenate every string part we can see statically (literals, templates, `+`). */
function staticText(node) {
  if (!node) return ''
  if (node.type === 'Literal') return typeof node.value === 'string' ? node.value : ''
  if (node.type === 'TemplateLiteral') return node.quasis.map((q) => q.value.cooked ?? '').join(' ')
  if (node.type === 'BinaryExpression' && node.operator === '+') return `${staticText(node.left)}${staticText(node.right)}`
  return ''
}

function isTestMember(callee) {
  if (callee.type !== 'MemberExpression' || callee.computed || callee.property.type !== 'Identifier') return false
  if (!KINDS.has(callee.property.name)) return false
  const obj = callee.object
  if (obj.type === 'Identifier') return obj.name === 'test'
  return (
    obj.type === 'MemberExpression' &&
    !obj.computed &&
    obj.property.type === 'Identifier' &&
    obj.property.name === 'describe' &&
    obj.object.type === 'Identifier' &&
    obj.object.name === 'test'
  )
}

export default {
  meta: {
    type: 'problem',
    docs: { description: 'test.fail/test.fixme must link a github.com/adibahsan/cycle-circle/issues/<n> URL' },
    schema: [],
    messages: {
      missingLink:
        'test.{{kind}}() needs a description containing https://github.com/adibahsan/cycle-circle/issues/<n> (a bare "#NNN" is not enough).',
    },
  },
  create(context) {
    return {
      CallExpression(node) {
        if (!isTestMember(node.callee)) return
        if (node.arguments.some((arg) => LINK.test(staticText(arg)))) return
        context.report({ node, messageId: 'missingLink', data: { kind: node.callee.property.name } })
      },
    }
  },
}
