'use babel';
import { TEMPLATE_PATH,
         EXAMPLE_PATH,
         TEMPLATE_REMOTE_FILE,
         EXAMPLE_REMOTE_FILE,
         ifExists
       } from './util';
import { createWriteStream, access, readFile } from 'fs';
import { get } from 'http';
import path from 'path';
import { parseString } from 'xml2js';

const TEMPLATE_URI = {
  java: 'first.wpi.edu/FRC/roborio/maven/release/edu/wpi/first/wpilibj/templates/',
  cpp: 'first.wpi.edu/FRC/roborio/maven/release/edu/wpi/first/wpilibc/templates/'
};
const EXAMPLE_URI = {
  java: 'first.wpi.edu/FRC/roborio/maven/release/edu/wpi/first/wpilibj/examples/',
  cpp: 'first.wpi.edu/FRC/roborio/maven/release/edu/wpi/first/wpilibc/examples/'
};
const HASH_TYPE = 'sha1';
const META_PATH = 'maven-metadata.xml';
const HASH_PATH = META_PATH + '.' + HASH_TYPE;
const getURI = (uri, ...ps) => 'http://' + path.join(uri, ...ps);

class RemoteRepo {
  constructor(props) {
    this.uriPath = props.uriPath;
    this.localPath = props.localPath;
    this.remoteFile = props.remoteFile;
    this._niceName = props.niceName;
  }

  get niceName() {
    return this._niceName;
  }

  getLatestVersion(lang) {
    return this.readMetadata(lang).then(meta => meta.versioning[0].release[0]);
  }

  update(lang) {
    return this.getLatestVersion(lang).then(v =>
      downloadToFile(
        getURI(this.uriPath[lang.toLowerCase()], v, this.remoteFile(v)),
        this.dir(lang, this.remoteFile(v))
      ));
  }

  getMetadataHash(lang) {
    return downloadToString(getURI(this.uriPath[lang.toLowerCase()], HASH_PATH));
  }

  readMetadata(lang) {
    return downloadToString(getURI(this.uriPath[lang.toLowerCase()], META_PATH)).then(parseMetadata);
  }

  dir(...paths) {
    return path.join(this.localPath, ...paths);
  }

}

export const TemplateRepo = new RemoteRepo({
  uriPath: TEMPLATE_URI,
  localPath: TEMPLATE_PATH,
  remoteFile: TEMPLATE_REMOTE_FILE,
  niceName: 'Template'
});

export const ExampleRepo = new RemoteRepo({
  uriPath: EXAMPLE_URI,
  localPath: EXAMPLE_PATH,
  remoteFile: EXAMPLE_REMOTE_FILE,
  niceName: 'Example'
})

function downloadToFile(url, filePath) {
  return download(url).then(data => saveToFile(data, filePath));
}

// Download file to directory, with same name as in the URL
function download(url) {
  return new Promise((resolve, reject) => {
    get(url, response => {
      resolve(response);
    })
    .on('error', err => {
      reject(err);
    });
  });
}

function downloadToString(url) {
  return download(url).then(data => {
    data.setEncoding('utf8');
    return new Promise((resolve, reject) => {
      data.on('data', resolve);
      data.on('error', reject);
    });
  });
}

function saveToFile(data, filePath) {
  let file = createWriteStream(filePath);
  if (data.readable === true) {
    data.pipe(file);
    // data.destroy();
  } else {
    file.write(data);
  }
  // file.destroy();
}

function parseMetadata(data) {
  return new Promise((resolve, reject) => {
    parseString(data, (err, result) => {
      if (err) {
        reject(err);
      } else {
        resolve(result.metadata);
      }
    });
  });
}

function getHash(file, type) {
  return new Promise((resolve, reject) => {
    readFile(file, (err, data) => {
      if (err) {
        reject(err);
      } else {
        resolve(data.toString());
      }
    });
  });
}

export function update(type, lang) {
  const update_ = () => type.update(lang);
  const metaHashFile = type.dir(path.join(lang, HASH_PATH));
  return ifExists(metaHashFile)
        .then( // Hash file exists
          () => Promise.all([
               type.getMetadataHash(lang),
               getHash(metaHashFile, HASH_TYPE)
             ]
           ))
        .then(hashes => {
          let remoteHash = hashes[0];
          let localHash = hashes[1];
          if (remoteHash === localHash) {
            // Local version up to date, no update needed
            return true;
          } else {
            saveToFile(remoteHash, metaHashFile);
            return update_();
          }
        }).catch( // Hash file doesn't exist
          () => type.getMetadataHash(lang)
            .then(h => saveToFile(h, metaHashFile))
            .then(update_)
     );
}
