'use babel';
import EventEmitter from 'events';
import { CompositeDisposable } from 'atom';
import { access } from 'fs';
import { homedir } from 'os';
import path from 'path';
import { exec } from 'child_process';
import { getConfig, getLanguage } from './util';
import { TemplateRepo, ExampleRepo, update } from './updater';
import ProjectGenerator from './project-generator';
import ExampleView from './example-view';
import GradleRIOBuildProvider from './build-provider';

export default {

  subscriptions: null,
  globalTask: null,

  config: {
    teamNumber: {
      type: 'integer',
      default: 0,
      minimum: 0,
      order: 1
    },
    language: {
      type: 'string',
      default: 'Java',
      enum: [
        'Java',
        'C++'
      ],
      order: 2
    },
    useBuildForDashboard: {
      title: "Use atom-build for launching SmartDashboard and Shuffleboard",
      description: "__Note:__ You'll likely only want this enabled if you're" +
                   " using gradleRIO for the first time.",
      type: 'boolean',
      default: 'true',
      order: 3
    },
    autoUpdate: {
      title: "Automatically download code templates and examples when available.",
      type: 'boolean',
      default: 'true',
      order: 4
    },
    gradlerioSettings: {
      title: 'GradleRIO Settings',
      type: 'object',
      description: 'Note: These settings will __not__ affect existing projects.',
      order: 5,
      properties: {
        roborioIP: {
          title: 'RoboRIO IP Address',
          type: 'string',
          default: 'Autodetect'
        },
        gradleOpts: {
          title: 'Gradle Command Line Options',
          type: 'array',
          default: ['--console=plain'],
          items: {
            type: 'string'
          }
        }
      }
    },
    userLibraries: {
      type: 'object',
      order: 6,
      properties: {
        cppLibDir: {
          title: 'C++ Library Location',
          type: 'string',
          default: path.join(homedir(), 'wpilib/user/cpp')
        },
        javaLibDir: {
          title: 'Java Library Location',
          type: 'string',
          default: path.join(homedir(), 'wpilib/user/java')
        }
      }
    },
    dependencyVersions: {
      type: 'object',
      order: 7,
      properties: {
        wpilibVersion: {
          title: 'WPILib',
          type: 'string',
          default: 'latest'
        },
        ntcoreVersion: {
          title: 'Network Tables',
          type: 'string',
          default: 'latest'
        },
        ctreVersion: {
          title: 'CTRE Phoenix',
          type: 'string',
          default: 'latest'
        },
        navxVersion: {
          title: 'NavX',
          type: 'string',
          default: 'latest'
        }
      }
    },
  },

  activate(state) {
    require('atom-package-deps').install('atom-wpilib');
    // Events subscribed to in atom's system can be easily cleaned up with a CompositeDisposable
    this.subscriptions = new CompositeDisposable();
    this.projectGenerator = null;
    this.exampleView = null;

    let buildRefreshed = false;
    const refreshBuild = () => {
      if (!buildRefreshed) {
        buildRefreshed = true;
        return atom.commands.dispatch(atom.views.getView(atom.workspace.getActiveTextEditor()), 'build:refresh-targets');
      }
    }
    // Register command that toggles this view
    this.subscriptions.add(atom.commands.add('atom-workspace', {
      'wpilib:generate-project': () => this.generateProject(),
      'wpilib:update-templates': () => this.updateTemplates(),
      'wpilib:update-examples': () => this.updateExamples(),
      'wpilib:view-example': () => this.viewExample(),
      'wpilib:build': () => refreshBuild(),
      'wpilib:deploy': () => refreshBuild(),
      'wpilib:start-riolog': () => refreshBuild(),
      'wpilib:install-toolchain': () => refreshBuild()
    }));
    if (!getConfig('useBuildForDashboard')) {
      this.subscriptions.add(atom.commands.add('atom-workspace', {
        'wpilib:start-smartdashboard': () => this.startSmartDashboard(),
        'wpilib:start-shuffleboard': () => this.startShuffleboard()
      }));
    }

    this.updatedThisSession = {
      templates: false,
      examples: false
    }
  },

  consumeSignal(registry) {
    this.signalProvider = registry.create();
    this.subscriptions.add(this.signalProvider);
  },

  provideBuilder() {
    return GradleRIOBuildProvider;
  },

  deactivate() {
    this.subscriptions.dispose();
    if (this.exampleView) this.exampleView.destroy();
    if (this.projectGenerator) this.projectGenerator.destroy();
  },

  serialize() {
  },

  startSmartDashboard() {
    let signalString = 'Starting SmartDashboard';
    this.signalProvider.add(signalString);
    let buildFile = getProjectBuildfile();
    fs.access(buildFile, err => {
      if (err) return;
      exec(buildFile + "-q smartdashboard",
        (err, _, stderr) => {
          if (err) {
            atom.notifications.addError("An error was encountered while trying to start SmartDashboard", { stack: err.toString(), icon: 'zap' });
          } else if (stderr) {
            atom.notifications.addError("Gradle threw an error while trying to start SmartDashboard", { stack: err.toString(), icon: 'zap'});
          }
          this.signalProvider.remove(signalString);
        }
      );
    });
  },

  startShuffleboard() {
    let signalString = 'Starting Shuffleboard';
    this.signalProvider.add(signalString);
    let buildFile = getProjectBuildfile();
    fs.access(buildFile, err => {
      if (err) return;
      exec(buildFile + "-q shuffleboard",
        (err, _, stderr) => {
          if (err) {
            atom.notifications.addError("An error was encountered while trying to start Shuffleboard", { stack: err.toString(), icon: 'zap' });
          } else if (stderr) {
            atom.notifications.addError("Gradle threw an error while trying to start Shuffleboard", { stack: err.toString(), icon: 'zap'});
          }
          this.signalProvider.remove(signalString);
        }
      );
    });
  },

  updateTemplates() {
    this.updatedThisSession.templates = true;
    return this.updateGeneric(TemplateRepo);
  },

  updateExamples() {
    this.updatedThisSession.examples = true;
    return this.updateGeneric(ExampleRepo);
  },

  generateProject() {
    if (!this.projectGenerator) {
      this.projectGenerator = new ProjectGenerator();
    }
    const signalString = 'Generating project';
    this.signalProvider.add(signalString);
    const generate = () => this.projectGenerator.generate().then(() => this.signalProvider.remove(signalString)).catch(() => this.signalProvider.remove(signalString));
    if (getConfig('autoUpdate') === true && this.updatedThisSession.templates === false) {
      this.updateTemplates().then(() => generate());
      this.updatedThisSession.templates = true;
    } else {
      generate();
    }
  },

  viewExample() {
    if (!this.exampleView) {
        this.exampleView = new ExampleView();
    }
    if (getConfig('autoUpdate') === true && this.updatedThisSession.examples === false) {
      this.updateExamples().then(() => this.exampleView.show());
      this.updatedThisSession.examples = true;
    } else {
      this.exampleView.show();
    }
  },

  updateGeneric(type) {
    let name = type.niceName;
    let signalString = `Updating ${name.toLowerCase()}s`;
    this.signalProvider.add(signalString);
    let removeSignal = () => this.signalProvider.remove(signalString);
    let note = atom.notifications.addInfo(`Updating ${name.toLowerCase()}s`);
    return update(type, getLanguage())
    .then(updated => {
      note.dismiss();
      let msg = `${name}s updated!`;
      if (updated === true) {
        msg = `${name}s up to date!`;
      }
      atom.notifications.addSuccess(msg);
      removeSignal();
    })
    .catch(err => {
      atom.notifications.addError(
        `Something went wrong while trying to update ${name.toLowerCase()}s!`,
        { stack: err.toString(), icon: 'zap' }
      );
      console.error(err);
      removeSignal();
    });
  },

  getProjectBuildfile() {
    return path.join(atom.project.rootDirectories[0].path, /^win/.test(process.platform) ? 'gradlew.bat' : 'gradlew');
  }

};
