'use babel';
import ProjectGeneratorView from './project-generator-view';
import {
    getConfig,
    getLanguage,
    TEMPLATE_PATH,
    TEMPLATE_REMOTE_FILE,
    mkdirp
} from './util';
import {
    TemplateRepo
} from './updater';
import archive from 'ls-archive';
import path from 'path';
import {
    promisify
} from 'util';
import {
    createWriteStream,
    mkdir,
    readFile
} from 'fs';
import {
    exec
} from 'child_process';

const ARCHIVE_ROOT_DIR = 'templates';
const SETTINGS_FILE = 'settings.gradle';
const WPILIB_DIR = '.wpilib';
const PREFERENCE_FILE = 'wpilib_preferences.json';
const getTemplateArchiveLocation = lang => TemplateRepo.getLatestVersion(lang).then(TEMPLATE_REMOTE_FILE).then(result => TemplateRepo.dir(lang, result));
const getTemplateArchivePath = type => path.join(ARCHIVE_ROOT_DIR, type.toLowerCase());
const PROJECT_ROOT_DIR = () => {
    if (getLanguage() == 'java') {
        return path.join('src/main/java/frc', 'team' + getConfig('teamNumber'), 'robot');
    } else {
        return 'src/cpp';
    }
};

const BUILD_TEMPLATE = {
    name: 'build.gradle',
    template: 'build.gradle.template'
};
const PROP_TEMPLATE = {
    name: 'gradle.properties',
    template: 'gradle.properties.template'
};

export default class ProjectGenerator {
    constructor(signalProvider) {
        this.view = new ProjectGeneratorView();
    }

    generate() {
        this.view.reset();
        this.view.show();
        let options;
        return this.view.getProjectOptions().then(opts => options = opts)
            .then(() => getTemplateArchiveLocation(getLanguage())) // generate build.gradle and copy gradle dependencies
            .then(archiveLocation => extractProject(options, archiveLocation, options.path))
            .then(() => {
                this.view.hide();
                atom.open({
                    pathsToOpen: [options.path],
                    newWindow: true
                });
            })
            .catch(err => {
                if (err) {
                    atom.notifications.addError('An error occured while trying to generate a project', {
                        icon: 'zap',
                        detail: err,
                        dismissable: true
                    });
                    console.err(err);
                }
            });
    }

    destroy() {
        this.view.destroy();
    }
}

function extractProject(options, archiveLocation, destPath) {
    const type = options.type.toLowerCase();
    const relative = partial(path.relative, path.join(ARCHIVE_ROOT_DIR, type));
    const includePath = path.join(path.dirname(PROJECT_ROOT_DIR()), 'include');
    return mkdirp(destPath, PROJECT_ROOT_DIR())
        .then(() => {
            if (getLanguage() === 'cpp') {
                return mkdirp(destPath, includePath);
            } else {
                return Promise.resolve();
            }
        })
        .then(() => promisify(archive.list)(archiveLocation))
        .then(list => list.filter(p => p.getPath().includes(type + '/')))
        .then(_paths => {
            let paths = _paths;
            // Sort by directories (type 5) first, then files (type 0)
            // Ensures all directories are created before writing files
            return paths.sort((a, b) => b.type - a.type).reduce((prev, p) => {
                return prev.then(() => {
                    const relPath = path.join(PROJECT_ROOT_DIR(), relative(p.getPath()));
                    if (p.isDirectory()) {
                        return mkdirp(destPath, relPath);
                    } else if (p.isFile()) {
                        // TODO: Add a condition to move header files into include/ instead of cpp/
                        return promisify(archive.readFile)(archiveLocation, p.getPath())
                            .then( //partial(copyTo, path.join(destPath, relPath)));
                                data => {
                                    let dst = relPath;
                                    let fname = path.basename(p.getPath());
                                    if (getLanguage() === 'cpp' && fname.endsWith('.h')) {
                                        dst = path.join(includePath, fname);
                                    }
                                    return copyTo(path.join(destPath, dst), data);
                                });
                    }
                });
            }, Promise.resolve());
        })
        .then(() => promisify(readFile)(TemplateRepo.dir(getLanguage(), BUILD_TEMPLATE.template)))
        .then(partial(copyTo, path.join(destPath, BUILD_TEMPLATE.name)))
        .then(() => promisify(readFile)(TemplateRepo.dir(getLanguage(), PROP_TEMPLATE.template)))
        .then(partial(substituteSettings, options))
        .then(partial(copyTo, path.join(destPath, PROP_TEMPLATE.name)))
        .then(() => promisify(readFile)(path.join(TEMPLATE_PATH, SETTINGS_FILE)))
        .then(partial(copyTo, path.join(destPath, SETTINGS_FILE)))
        .then(() => mkdir(path.join(destPath, WPILIB_DIR)))
        .then(partial(copyTo, path.join(destPath, WPILIB_DIR, PREFERENCE_FILE)))
        .then(() => promisify(readFile)(path.join(TEMPLATE_PATH, PREFERENCE_FILE)))
        .then(() => {
            return new Promise((resolve, reject) => {
                exec('gradle wrapper', {
                    cwd: destPath
                }, (err, stdout, stderr) => {
                    if (stderr) {
                        reject(stderr);
                    } else if (err) {
                        atom.notifications.addError('Gradle threw an error while trying to generate wrappers', {
                            icon: 'zap',
                            detail: stderr,
                            dismissable: true
                        });
                        console.err(stderr);
                        reject(stderr);
                    } else {
                        resolve(stdout);
                    }
                });
            });
        });

}

function copyTo(filePath, data) {
    const stream = createWriteStream(filePath);
    stream.write(data);
    stream.end();
}

function partial(a, ...args) {
    return (...b) => a(...args, ...b);
}

function substituteSettings(settings, buf) {
    // TODO: Update dependencyVersions throughout package to have 'Version' suffix
    const PROPERTIES = {
        teamNumber: getConfig('teamNumber'),
        frcDependencies: [getConfig(`userLibraries.${getLanguage()}LibDir`)].concat(settings.frcDependencies).join(),
        debug: settings.debug
    };

    let newStr = Object.keys(PROPERTIES).reduce((prev, prop) => prev.replace(new RegExp('\\${' + prop + '}', 'g'), PROPERTIES[prop]), buf.toString());

    const dependencies = getConfig('dependencyVersions');
    Object.keys(dependencies).filter(k => dependencies[k] !== 'latest').forEach(k => {
        newStr += `${k}=${dependencies[k]}\n`;
    });
    return newStr;
}
