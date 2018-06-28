'use babel';
import { existsSync } from 'fs';
import path from 'path';
import EventEmitter from 'events';

const errorMatch = [
  '(?<file>/[^:\\n]+\\.java):(?<line>\\d+):',
  '(?::compile(?:Api)?(?:Scala|Java|Groovy))?(?<file>.+):(?<line>\\d+):\\s.+[;:]'
];

export default class GradleRIOBuildProvider extends EventEmitter {
  constructor(cwd) {
    super();
    this.cwd = cwd;
    this.buildFile = path.join(this.cwd, /^win/.test(process.platform) ? 'gradlew.bat' : 'gradlew');
  }

  getNiceName() {
    return 'GradleRIO';
  }

  isEligible() {
    return existsSync(this.buildFile) && existsSync(path.join(this.cwd, 'build.gradle'));
  }

  settings() {
    // This is a bit hacky
    // The atom commands are registered here and handled by build, but the
    // keymaps are registered separately.
    // Keymaps *can* be defined here, but I don't believe atom-build
    // supports cross-platform mappings.
    const opts = atom.config.get('atom-wpilib.gradlerioSettings.gradleOpts');
    const settings_ = [
        { name: "GradleRIO Build",
          exec: this.buildFile,
          args: opts.concat(["build"]),
          cwd: "{PROJECT_PATH}",
          sh: false,
          errorMatch: errorMatch,
          atomCommandName: "wpilib:build"
        },
        {
          name: "GradleRIO Deploy",
          exec: this.buildFile,
          args: opts.concat(["deploy"]),
          cwd: "{PROJECT_PATH}",
          sh: false,
          errorMatch: errorMatch,
          atomCommandName: "wpilib:deploy"
        },
        {
          name: "Start SmartDashboard",
          exec: this.buildFile,
          args: opts.concat(["smartDashboard"]),
          cwd: "{PROJECT_PATH}",
          sh: false,
          errorMatch: errorMatch
        },
        {
          name: "Start Shuffleboard",
          exec: this.buildFile,
          args: opts.concat(["shuffleboard"]),
          cwd: "{PROJECT_PATH}",
          sh: false,
          errorMatch: errorMatch
        },
        {
          name: "RIOLog",
          exec: this.buildFile,
          args: opts.concat(["riolog"]),
          cwd: "{PROJECT_PATH}",
          sh: false,
          errorMatch: errorMatch,
          atomCommandName: "wpilib:start-riolog"
        },
        {
          name: "Install C++ Toolchains",
          exec: this.buildFile,
          args: opts.concat(["installToolchain"]),
          cwd: "{PROJECT_PATH}",
          sh: false,
          errorMatch: errorMatch,
          atomCommandName: "wpilib:install-toolchain"
        }
    ];
    if (atom.config.get('atom-wpilib.useBuildForDashboard')) {
      settings_.find(o => o.name == "Start SmartDashboard").atomCommandName = "wpilib:start-smartdashboard";
      settings_.find(o => o.name == "Start Shuffleboard").atomCommandName = "wpilib:start-shuffleboard";
    }
    return settings_;
  }

};
