'use babel';

import { ifExists, EXAMPLE_REMOTE_FILE, mkdirp } from './util';
import { ExampleRepo } from './updater';
import { createWriteStream, mkdir } from 'fs';
import { promisify } from 'util';
import path from 'path';
import archive from 'ls-archive';
import { parseString } from 'xml2js';
import { mkdir as mkTmpDir, open as openTmp } from 'temp';

class Example {
  constructor(params) {
    this.name = params.name;
    this.description = params.description;
    this.tags = params.tags;
    this.files = params.files;
  }

  static loadFromXML(example) {
    return new Example({
      name: example.name[0],
      description: example.description[0].split("\n").join(' '),
      tags: example.tags[0].tag,
      files: example.files[0].file.map(f => f.$.source)
    });
  }
}

const examplePathCache = {};
const EXAMPLE_META_FILE = 'examples.xml';
const getExamplePath = lang => ExampleRepo.getLatestVersion(lang).then(EXAMPLE_REMOTE_FILE).then(result => ExampleRepo.dir(lang, result));
const MAIN_PROJECT_FILE = /Robot\.(java|cpp)$/;

export default {

  loadExamples(lang) {
    let exampleArchive;
    function setArchive(result) {
      exampleArchive = result;
    }
    return getExamplePath(lang)
      .then(result => setArchive(result))
      .then(() => ifExists(exampleArchive))
      .then(() => promisify(archive.list)(exampleArchive))
      .then(entries => entries.filter(e => e.path.includes(EXAMPLE_META_FILE))[0].path)
      .then(exampleMetaPath => promisify(archive.readFile)(exampleArchive, exampleMetaPath))
      .then(promisify(parseString))
      .then(exampleData => exampleData.examples.example.map(Example.loadFromXML));
  },

  openExample(example, lang) {
    if (examplePathCache[example.name] !== undefined) {
      return Promise.resolve(examplePathCache[example.name]);
    } else {
      let exampleArchive;
      function setArchive(result) {
        exampleArchive = result;
      }
      let tmpDir;
      return getExamplePath(lang)
        .then(result => setArchive(result))
        .then(() => promisify(mkTmpDir)('wpilib'))
        .then(dirPath => tmpDir = dirPath)
        .then(() => Promise.all(
          example.files.map(
            file => promisify(archive.readFile)(exampleArchive, file)
              .then(contents =>
                mkdirp(tmpDir, file.split(path.sep).slice(0, -1).join(path.sep))
                  .then(() => {
                    const fullPath = path.join(tmpDir, file);
                    const stream = createWriteStream(fullPath);
                    stream.write(contents);
                    stream.end();
                    return fullPath;
                  })))))
        .then(paths => {
          examplePathCache[example.name] = paths;
          return paths;
        });
    }
  },

  exampleDir(examplePaths) {
    const mainFile = examplePaths.find(str => MAIN_PROJECT_FILE.test(str));
    if (mainFile !== null) {
      return mainFile;
    } else {
      throw new FileNotFoundException('could not find Robot.java or Robot.cpp');
    }
  },

  FileNotFoundException: FileNotFoundException
}

class FileNotFoundException extends Error {}
