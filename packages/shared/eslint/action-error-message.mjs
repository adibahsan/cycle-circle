/**
 * In a file that calls server actions, flags showing a caught error's text
 * (`e instanceof Error ? e.message : …`). A production build replaces every error a
 * server action throws with "Minified React error #441", so the User sees that text
 * (#255). Return expected failures as a typed `{ ok: false, code }` result and show
 * translated copy (see `createProfile` in apps/web/src/app/actions/profile-actions.ts).
 */
const ACTIONS_IMPORT = /(^|\/)actions\//

export const actionErrorMessageRule = {
  meta: {
    type: 'problem',
    messages: {
      raw: 'Server-action errors reach the browser as "Minified React error #441" in production. Return a typed { ok: false, code } result and show translated copy instead of the error\'s message (#255).',
    },
    schema: [],
  },
  create(context) {
    let importsActions = false
    return {
      ImportDeclaration(node) {
        if (typeof node.source.value === 'string' && ACTIONS_IMPORT.test(node.source.value)) importsActions = true
      },
      ConditionalExpression(node) {
        const { test, consequent } = node
        if (
          !importsActions ||
          test.type !== 'BinaryExpression' ||
          test.operator !== 'instanceof' ||
          test.left.type !== 'Identifier' ||
          test.right.type !== 'Identifier' ||
          test.right.name !== 'Error' ||
          consequent.type !== 'MemberExpression' ||
          consequent.computed ||
          consequent.object.type !== 'Identifier' ||
          consequent.object.name !== test.left.name ||
          consequent.property.name !== 'message'
        ) return
        context.report({ node, messageId: 'raw' })
      },
    }
  },
}

/** Flat-config entry: applies the rule to the given client-component globs. */
export function actionErrorMessageConfig(files) {
  return {
    files,
    plugins: { vesta: { rules: { 'no-action-error-message': actionErrorMessageRule } } },
    rules: { 'vesta/no-action-error-message': 'error' },
  }
}
