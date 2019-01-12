'use babel';

import {
    getLanguage,
    PROJECT_TYPES
} from './util';
import {
    TextEditor,
    CompositeDisposable
} from 'atom';
import etch from 'etch';

export default class ProjectGeneratorView {
    constructor(serializedState) {
        this.disposables = new CompositeDisposable();
        this.optionsView = new ProjectOptionsView();
        this.panel = atom.workspace.addModalPanel({
            item: this.optionsView.element,
            visible: false
        });
        this.disposables.add(global.atom.commands.add(this.optionsView.element, {
            'core:cancel': (event) => {
                this.hide();
                if (this.optionsView.reject) this.optionsView.reject();
                event.stopPropagation();
            }
        }));
    }

    show() {
        this.panel.show();
        this.optionsView.refs.pathTextEditor.element.focus();
    }

    hide() {
        this.panel.hide();
    }

    reset() {
        this.optionsView.reset();
    }

    getProjectOptions() {
        return this.optionsView.getProjectOptions();
    }

    destroy() {
        this.disposables.destroy();
        return this.optionsView.destroy();
    }
}

/** @jsx etch.dom */

class ProjectOptionsView {
    constructor() {
        etch.initialize(this);
        PROJECT_TYPES.forEach(type => {
            const opt = document.createElement('option');
            opt.value = type;
            opt.innerText = type.charAt(0).toUpperCase() + type.slice(1);
            this.refs.typeMenu.appendChild(opt);
        });
        this.refs.pathTextEditor.element.classList.add('text-path');
    }

    render() {
        /* jshint ignore:start */
        return (
            <div className='atom-wpilib'>
              <div className='option'>
                <div className='subtitle'>Project Path</div>
                <div className='option-container'>
                  <TextEditor mini={true} placeholderText='/path/to/project' ref='pathTextEditor'/>
                  <button className='btn icon icon-file-directory select-path' on={{click: this.getProjectPath}} ref='selectPathButton'/>
                </div>
              </div>
              <div className='option'>
                <div className='subtitle'>Project Type</div>
                <div className='option-container'>
                  <select ref='typeMenu' className='form-control' />
                </div>
              </div>
              <div className='section-advanced'>
                <div className='title-container' on={{click: () => this.toggleAdvancedSection() }}>
                  <div className='btn-collapse icon icon-chevron-right' ref='collapseIcon'></div>
                  <div className='advanced-title'>Advanced</div>
                </div>
                <div className='advanced-content' ref='advancedSection'>
                  <div className='option'>
                    <div className='subtitle'>Additional Dependencies</div>
                    <TextEditor mini={true} placeholderText='e.g. /path/to/lib; some.maven:artifact:version' ref='depsTextEditor'/>
                  </div>
                  <div className='option option-checkbox'>
                    <div className='subtitle'>Debug Mode</div>
                    <input type='checkbox' className='input-checkbox' ref='debugMode'/>
                  </div>
                </div>
              </div>
              <button className='btn create-project' on={{click: () => this.confirm()}}>Create Project</button>
            </div>
        );
        /* jshint ignore:end */
    }

    destroy() {
        return etch.detroy(this);
    }

    update() {
        return etch.update(this);
    }

    confirm() {
        if (this.refs.pathTextEditor.getText() !== '') {
            this.resolve(this.getOptions());
        }
    }

    getProjectPath() {
        atom.pickFolder(paths => {
            this.paths = paths;
            if (paths !== null) {
                this.refs.pathTextEditor.setText(paths[0]);
            }
        });
    }

    toggleAdvancedSection() {
        if (this.refs.advancedSection.style.display === 'none' || this.refs.advancedSection.style.display === '') {
            this.refs.advancedSection.style.display = 'block';
            this.refs.collapseIcon.classList.remove('icon-chevron-right');
            this.refs.collapseIcon.classList.add('icon-chevron-down');
        } else {
            this.refs.advancedSection.style.display = 'none';
            this.refs.collapseIcon.classList.remove('icon-chevron-down');
            this.refs.collapseIcon.classList.add('icon-chevron-right');
        }
    }

    reset() {
        this.refs.typeMenu.selectedIndex = 0;
        this.refs.pathTextEditor.setText('');
        this.refs.depsTextEditor.setText('');
        this.refs.debugMode.checked = false;
    }

    getOptions() {
        return {
            type: this.refs.typeMenu.selectedOptions[0].value,
            path: this.refs.pathTextEditor.getText(),
            frcDependencies: this.refs.depsTextEditor.getText().split(','),
            debug: this.refs.debugMode.checked
        };
    }

    getProjectOptions() {
        const _this = this;
        return new Promise((resolve, reject) => {
            _this.resolve = resolve;
            _this.reject = reject;
        });
    }

}
