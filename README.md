# WPILib for Atom
Atom extension for generating, building, and deploying WPILib code.

## Features
- Build and deploy WPILib code in both C++ and Java
- Launch SmartDashboard & Shuffleboard and view RIOLog
- Generate new projects from templates
- View example projects

## Installation
Install `atom-wpilib` through Atom's package manager or via `apm install atom-wpilib`.

## Usage
To first set up, you'll need to navigate to `Settings > Packages > atom-wpilib` and set your team number and language.
- Build a GradleRIO project with `alt-cmd-x` (macOS)/`alt-ctrl-x` (Windows/Linux)
- Deploy using `alt-cmd-r` (macOS)/`alt-ctrl-r` (Windows/Linux)
- Activate `WPILib: Generate Project` and `WPILib: View Example` via the Command Palette (`shift-cmd-p`)
- Other features such as launching RIOLog and Shuffleboard are available under the `Packages > WPILib` menu (there must be a GradleRIO project open for these to work)

## Contributing
Bug reports and suggestions are welcome in the [issues section](https://github.com/eschutz/atom-wpilib.git).
