import tseslint from 'typescript-eslint'
import prettier from 'eslint-config-prettier'
import checkFile from 'eslint-plugin-check-file'

export default tseslint.config(
  {ignores: ['node_modules', 'dist', 'coverage', '.vitest']},
  ...tseslint.configs.recommended,
  prettier,
  {
    files: ['**/*.ts'],
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
        },
      ],
    },
  },
  {
    files: ['src/**/*.ts', 'tests/**/*.ts'],
    plugins: {'check-file': checkFile},
    rules: {
      'check-file/filename-naming-convention': ['error', {'**/*.ts': 'KEBAB_CASE'}, {ignoreMiddleExtensions: true}],
    },
  },
)
