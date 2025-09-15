// Register TypeScript path mappings for runtime
import { register } from 'tsconfig-paths';
import * as path from 'path';

const baseUrl = path.join(__dirname);
const tsConfigPath = path.join(__dirname, '..', 'tsconfig.json');

register({
  baseUrl,
  paths: {
    '@/*': ['./*'],
    '@/nodes/*': ['./nodes/*'],
    '@/converters/*': ['./converters/*'],
    '@/utils/*': ['./utils/*'],
    '@/credentials/*': ['./credentials/*'],
  },
});
