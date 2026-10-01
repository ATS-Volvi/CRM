/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src/tests'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/',
  },
  transform: {
    '^.+\.[tj]sx?$': [
      'ts-jest',
      {
        tsconfig: {
          allowJs: true,
          jsx: 'react-jsx',
          esModuleInterop: true,
          allowSyntheticDefaultImports: true,
        },
      },
    ],
  },
  transformIgnorePatterns: [
    'node_modules/(?!(sanitize-html|htmlparser2|dom-serializer|domhandler|domutils|domelementtype|entities)/)',
  ],
};
