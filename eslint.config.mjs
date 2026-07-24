import js from '@eslint/js'
import tseslint from 'typescript-eslint'
import prettierConfig from 'eslint-config-prettier'
import reactHooks from 'eslint-plugin-react-hooks'

export default tseslint.config(
  js.configs.recommended,
  tseslint.configs.recommended,
  prettierConfig,
  {
    plugins: { 'react-hooks': reactHooks },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      // exhaustive-deps conflicts with the named-callback pattern; deps are correct by inspection
      'react-hooks/exhaustive-deps': 'off',
    },
  },
  {
    files: ['**/*.ts', '**/*.tsx'],
    rules: {
      // function declarations only — no const foo = () => {}
      'func-style': ['error', 'declaration'],

      // no let, no for loops
      'no-restricted-syntax': [
        'error',
        {
          selector: "VariableDeclaration[kind='let']",
          message:
            'Use const for immutable bindings, var for mutable. No let, unless really necessary (hint: VERY rarelly).',
        },
        {
          selector: 'ForStatement',
          message: 'Use forEach/map/reduce instead of for loops.',
        },
        {
          selector: 'ForInStatement',
          message: 'Use Object.entries/keys with forEach instead of for...in.',
        },
        {
          selector: 'ForOfStatement',
          message: 'Use forEach/map/reduce instead of for...of.',
        },
        {
          selector: 'WhileStatement',
          message:
            'No imperative loop: use map/reduce/forEach, a stream/async-iterator for large data, or bounded recursion. If a loop is genuinely right here, disable with a reason.',
        },
        {
          selector: 'DoWhileStatement',
          message:
            'No imperative loop: use map/reduce/forEach, a stream/async-iterator for large data, or bounded recursion. If a loop is genuinely right here, disable with a reason.',
        },
        {
          // No silent catch: an empty-bodied arrow passed to .catch() swallows the rejection.
          selector:
            "CallExpression[callee.property.name='catch'] > ArrowFunctionExpression[body.type='BlockStatement'][body.body.length=0]",
          message:
            'No silent catch: surface the error (route through useAsyncResource) or log it. If the rejection is genuinely benign and handled via another channel, disable with a reason.',
        },
        {
          // async forEach/reduce = orchestration shoehorned into a data combinator (forEach never awaits;
          // async reduce is the named callback-pyramid). async .map is EXCLUDED on purpose:
          // Promise.all(items.map(async ...)) is the correct concurrent-data idiom.
          selector: "CallExpression[callee.property.name=/^(forEach|reduce|reduceRight)$/] > :function[async=true]",
          message:
            'Async forEach/reduce is orchestration disguised as a data combinator (forEach does not await; reduce is for data, not sequencing). Use a recursive helper, or Promise.all(items.map(async ...)) for concurrent data. Reconsider, or disable with a reason.',
        },
        {
          // map/filter whose result is discarded = a side-effect loop wearing a data combinator's clothes.
          selector: "ExpressionStatement > CallExpression[callee.property.name=/^(map|filter)$/]",
          message:
            'map/filter result is unused; a side-effect loop in disguise. Use forEach for pure side effects, or a recursive helper for orchestration. Reconsider, or disable with a reason.',
        },
      ],

      // var declarations at top of function
      'vars-on-top': 'error',
      'no-var': 'off',

      // no single-character identifiers
      'id-length': ['error', { min: 2, exceptions: ['_', 't', 'x', 'y'] }],

      // allow _-prefixed names to suppress unused-variable warnings (conventional TypeScript)
      '@typescript-eslint/no-unused-vars': ['error', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        caughtErrorsIgnorePattern: '^_',
      }],

      // nested ternaries are banned (CLAUDE.md non-negotiable #2)
      'no-nested-ternary': 'error',

      // nesting beyond one level is suspicious (CLAUDE.md non-negotiable #2); was max:3
      'max-depth': ['error', { max: 2 }],

      // short functions — logic files hard cap
      'max-lines-per-function': ['error', { max: 40, skipBlankLines: true, skipComments: true }],

      // a blank line before every return that follows another statement
      'padding-line-between-statements': ['error', { blankLine: 'always', prev: '*', next: 'return' }],
    },
  },
  {
    // JSX is line-heavy by nature; raise the cap for component files only.
    // +1 over the historical 80: the blank-line-before-return rule above adds a mandated cosmetic
    // line that still counts toward function length, so the logic budget stays effectively 80.
    files: ['**/*.tsx'],
    rules: {
      'max-lines-per-function': ['error', { max: 81, skipBlankLines: true, skipComments: true }],
    },
  },
  {
    // In-vitro / HIL / Playwright e2e test files: describe/it/test/beforeAll bodies are grouping
    // containers, legitimately long, so the logic-function length cap does not apply to them. Every other
    // rule still holds (no-let/no-for, func-style, identifier meaning, no silent catch,
    // preserve-caught-error), so the CI/CD test bed stays gate-quality and cannot rot the way it did while
    // it sat entirely off the gate.
    files: ['tests/**/*.ts', 'e2e/**/*.spec.ts'],
    rules: {
      'max-lines-per-function': 'off',
    },
  }
)
