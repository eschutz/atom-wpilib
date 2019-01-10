'use babel';

import path from 'path';
import { promisify } from 'util';
import { access, mkdir } from 'fs';

function getConfig(path) {
  return atom.config.get('atom-wpilib.' + path);
}

function getLanguage() {
  if (getConfig('language') === 'C++') {
    return 'cpp';
  } else {
    return 'java';
  }
}

function mkdirp(rootDir, dirPath) {
  return dirPath.split(path.sep).reduce((prom, dir) => {
    return prom.then(prev => {
      return new Promise((resolve, reject) => {
        const fullPath = path.join(prev, dir);
        mkdir(fullPath, err => {
          if (err && err.code !== 'EEXIST') {
            reject(err);
          } else {
            resolve(fullPath);
          }
        });
      })
    });
  }, Promise.resolve(rootDir));
}

export default {
  TEMPLATE_PATH: path.join(process.env.ATOM_HOME, 'packages/atom-wpilib/templates'),
  EXAMPLE_PATH: path.join(process.env.ATOM_HOME, 'packages/atom-wpilib/examples'),
  GRADLERIO_PATH: path.join(process.env.ATOM_HOME, 'packages/atom-wpilib/templates')
  TEMPLATE_REMOTE_FILE: version => `templates-${version}.zip`,
  EXAMPLE_REMOTE_FILE: version => `examples-${version}.zip`,
  PROJECT_TYPES: ['sample', 'commandbased', 'iterative', 'timed'],
  ifExists: promisify(access),
  getConfig: getConfig,
  getLanguage: getLanguage,
  mkdirp: mkdirp
}
