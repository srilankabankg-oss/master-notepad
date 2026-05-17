import tsParser from '@typescript-eslint/parser'
import tsPlugin from '@typescript-eslint/eslint-plugin'
import vueParser from 'vue-eslint-parser'
import vuePlugin from 'eslint-plugin-vue'
import prettier from 'eslint-config-prettier'

export default [
  // Base rules (JS + Vue SFC template scope)
  {
    rules: {
      'no-var': 'error',
      'no-console': ['warn', { allow: ['warn', 'error', 'info'] }],
      'no-debugger': 'warn',
      'no-empty': 'off',
      'no-undef': 'off',
    },
  },

  // Vue SFCs
  {
    files: ['**/*.vue'],
    languageOptions: {
      parser: vueParser,
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: 'module',
        parser: tsParser,
      },
      globals: {
        confirm: 'readonly',
        alert: 'readonly',
      },
    },
    plugins: {
      vue: vuePlugin,
      '@typescript-eslint': tsPlugin,
    },
    rules: {
      'vue/multi-word-component-names': 'off',
      'vue/no-template-shadow': 'off',
      'vue/no-v-html': 'warn',
      'vue/html-self-closing': ['warn', { html: { void: 'never', normal: 'always', component: 'always' } }],
      'vue/attributes-order': 'off',
      'vue/order-in-components': 'off',
    },
  },

  // TS files
  {
    files: ['**/*.ts'],
    languageOptions: {
      parser: tsParser,
      parserOptions: { ecmaVersion: 2022, sourceType: 'module' },
      globals: {
        fetch: 'readonly',
        confirm: 'readonly',
        alert: 'readonly',
      },
    },
    plugins: { '@typescript-eslint': tsPlugin },
    rules: {
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    },
  },

  prettier,
]
