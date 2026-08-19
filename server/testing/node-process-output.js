'use strict';

const bytes = Math.max(0, Math.min(8 * 1024 * 1024, Number(process.argv[2]) || 0));
process.stdout.write('x'.repeat(bytes));

