module.exports = {
    preset: 'ts-jest',
    testEnvironment: 'node',
    roots: ['<rootDir>/test'],
    moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
    transform: {
      '^.+\\.tsx?$': ['ts-jest', { tsconfig: '<rootDir>/test/tsconfig.json' }],
    },
    // Couverture (npm run test:coverage) : le moteur seulement, l'interface est couverte par Playwright
    collectCoverageFrom: ['src/**/*.ts', '!src/ui/**', '!src/**/*.d.ts', '!src/index.ts', '!src/main.tsx', '!src/ai/aiWorker.ts'],
    coverageReporters: ['text-summary', 'text', 'html'],
    // Tout le moteur est exécuté par les tests : une instruction non couverte fait échouer test:coverage
    // (la tester, ou la retirer si elle est inatteignable). Les branches suivent le niveau atteint.
    coverageThreshold: {
      global: { statements: 100, lines: 100, functions: 100, branches: 91 },
    },
  };
