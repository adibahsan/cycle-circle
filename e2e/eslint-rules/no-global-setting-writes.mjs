/**
 * `systemSetting` / `cronSetting` rows are global singletons shared by every parallel spec.
 * Writes to them are only allowed in files listed in the rule's `allow` option (a list of path
 * suffixes, e.g. `tests/admin/system.spec.ts`), so a new writer is added deliberately.
 */
const MODELS = new Set(['systemSetting', 'cronSetting'])
const WRITES = new Set(['create', 'upsert', 'update', 'updateMany', 'delete', 'deleteMany', 'createMany'])

export default {
  meta: {
    type: 'problem',
    docs: { description: 'Only allow-listed files may write systemSetting/cronSetting rows' },
    schema: [{ type: 'object', properties: { allow: { type: 'array', items: { type: 'string' } } }, additionalProperties: false }],
    messages: {
      notAllowed:
        '{{model}}.{{method}}() writes a global settings row. Only allow-listed files may (see "Global settings rows" in e2e/README.md); add this file to the allowlist in eslint.config.mjs deliberately.',
    },
  },
  create(context) {
    const allow = context.options[0]?.allow ?? []
    const file = context.filename.replaceAll('\\', '/')
    if (allow.some((suffix) => file.endsWith(suffix))) return {}
    return {
      CallExpression(node) {
        const callee = node.callee
        if (callee.type !== 'MemberExpression' || callee.computed || callee.property.type !== 'Identifier') return
        if (!WRITES.has(callee.property.name)) return
        const model = callee.object
        if (model.type !== 'MemberExpression' || model.computed || model.property.type !== 'Identifier') return
        if (!MODELS.has(model.property.name)) return
        context.report({ node, messageId: 'notAllowed', data: { model: model.property.name, method: callee.property.name } })
      },
    }
  },
}
