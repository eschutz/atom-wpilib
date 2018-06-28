'use babel';
import { getLanguage } from './util';
import { loadExamples, openExample, exampleDir } from './example-loader';
import SelectListView from 'atom-select-list';

const MAX_TEXT_LENGTH = 110;

export default class ExampleView {

  constructor(serializedState) {
    this.selectList = new SelectListView({
      items: [],
      elementForItem: (item, options) => {
        const el = document.createElement('li');
        el.innerText = item.name;
        el.appendChild(document.createElement('br'));
        const desc = document.createElement('small');
        let description = item.description;
        if (description.length > MAX_TEXT_LENGTH) {
          description = item.description.slice(0, MAX_TEXT_LENGTH - 3) + '...';
        }
        desc.innerText = description;
        el.appendChild(desc);
        return el;
      },
      infoMessage: 'Select example:',
      emptyMessage: 'No matches found',
      didCancelSelection: () => this.hide(),
      filterKeyForItem: example => example.name + ',' + example.tags.join(),
      didConfirmSelection: selection => this.selectExample(selection)
    });
  }

  show() {
    this.getExamples()
    .then(examples => {
      this.selectList.update({items: examples});
      if (!this.panel) {
        this.panel = atom.workspace.addModalPanel({
          item: this.selectList
        });
      }
      this.panel.show();
      this.selectList.focus();
    });
  }

  selectExample(example) {
    let openInProject = false;
    openExample(example, this.language)
    .then(result => {
      if (result.length > 1) {
        openInProject = true;
      }
      return exampleDir(result);
    })
    .then(dir => {
      if (openInProject) {
        atom.open({pathsToOpen: [dir], newWindow: true});
      } else {
        return atom.workspace.open(dir);
      }
    })
    .then(editor => {
      if (editor) {
        editor.setReadOnly(true);
      }
    });
  }

  hide() {
    this.panel.hide();
  }

  destroy() {
    this.selectList.destroy();
    this.panel.destroy();
  }

  getExamples() {
    const reloadExamples = () => loadExamples(this.language).then(examples => this.exampleCache[this.language] = examples);
    if (!this.exampleCache) {
      if (!this.language) {
        this.language = getLanguage();
      }
      this.exampleCache = {};
      return reloadExamples().then(() => this.exampleCache[this.language]);
    }
    if (this.language !== getLanguage()) {
      return reloadExamples().then(() => this.exampleCache[this.language]);
    }
    return Promise.resolve(this.exampleCache[this.language]);
  }
}
