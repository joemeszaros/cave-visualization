import { classNames } from '../../dependencies/classnames.js';
import { tag } from '../../dependencies/html5-tag.js';
import { escapeHtml } from '../../dependencies/escape-html.js';
import * as U from '../utils/utils.js';
import { SurveyHelper } from '../survey.js';
import { Color } from '../model.js';
import { SurveyEditor, CaveEditor } from './editor.js';

class ProjectManager {

  /**
   * Creates a new project manager that is used on survey updates
   * @param {Database} db - The project database containing caves and surveys
   * @param {MyScene} scene - The 3D scene
   * @param {ProjectExplorer} explorer - The project explorer that displays caves and surveys in a tree view
   */
  constructor(db, options, scene, explorer) {
    this.db = db;
    this.options = options;
    this.scene = scene;
    this.explorer = explorer;
    document.addEventListener('surveyChanged', (e) => this.onSurveyChanged(e));
    document.addEventListener('surveyDeleted', (e) => this.onSurveyDeleted(e));
    document.addEventListener('caveDeleted', (e) => this.onCaveDeleted(e));
    document.addEventListener('caveRenamed', (e) => this.onCaveRenamed(e));
  }

  onSurveyChanged(e) {
    //TODO : consider survey here and only recalculate following surveys
    const cave = e.detail.cave;
    this.recalculateCave(cave);
    this.scene.renderScene();
    this.explorer.updateCave(cave, (n) => n.name === cave.name);
  }

  onSurveyDeleted(e) {
    const caveName = e.detail.cave;
    const surveyName = e.detail.survey;
    this.scene.disposeSurvey(caveName, surveyName);
    const cave = this.db.getCave(caveName);
    this.recalculateCave(cave);
    this.scene.renderScene();
    this.explorer.deleteSurvey(caveName, surveyName);
    this.explorer.updateCave(cave, (n) => n.name === cave.name);
  }

  onCaveRenamed(e) {
    const oldName = e.detail.oldName;
    const cave = e.detail.cave;
    this.scene.renameCave(oldName, cave.name);
    this.explorer.updateCave(cave, (n) => n.name === oldName);
  }

  onCaveDeleted(e) {
    const caveName = e.detail.cave;
    this.scene.disposeCave(caveName);
    this.scene.deleteCave(caveName);
    this.scene.renderScene();
    this.explorer.deleteCave(caveName);
    this.explorer.closeEditors(caveName);
  }

  recalculateCave(cave) {
    let caveStations = new Map();
    const lOptions = this.options.scene.caveLines;

    cave.surveys.entries().forEach(([index, es]) => {
      SurveyHelper.recalculateSurvey(index, es, caveStations, cave.aliases);
      this.#emitSurveyRecalculated(cave, es);
    });
    cave.stations = caveStations;
    //TODO: should recalculate section attributes

    // get color gradients after recalculation
    const colorGradients = SurveyHelper.getColorGradients(cave, lOptions);

    cave.surveys.forEach((es) => {
      const [clSegments, splaySegments] = SurveyHelper.getSegments(es, caveStations);
      this.scene.disposeSurvey(cave.name, es.name);
      const _3dObjects = this.scene.addToScene(
        es.name,
        caveStations,
        clSegments,
        splaySegments,
        cave.visible && es.visible,
        colorGradients.get(es.name)
      );
      this.scene.deleteSurvey(cave.name, es.name);
      this.scene.addSurvey(cave.name, es.name, _3dObjects);
    });
    this.scene.updateVisiblePlanes();
    const boundingBox = this.scene.computeBoundingBox();
    this.scene.grid.adjust(boundingBox);
    this.scene.fitScene(boundingBox);
  }

  #emitSurveyRecalculated(cave, survey) {
    const event = new CustomEvent('surveyRecalculated', {
      detail : {
        cave   : cave,
        survey : survey
      }
    });
    document.dispatchEvent(event);
  }

}

class ProjectExplorer {

  constructor(options, db, scene, attributeDefs, treeNode) {
    this.options = options;
    this.db = db;
    this.scene = scene;
    this.attributeDefs = attributeDefs;
    this.trees = new Map();
    this.treeNode = treeNode;
    this.itree = undefined;
  }

  deleteSurvey(caveName, surveyName) {
    const caveNode = this.itree.getChildNodes().find((n) => n.name === caveName);
    const surveyNode = this.itree.getChildNodes(caveNode).find((n) => n.name === surveyName);
    this.itree.removeNode(surveyNode);
  }

  deleteCave(caveName) {
    const caveNode = this.itree.getChildNodes().find((n) => n.name === caveName);
    this.itree.removeNode(caveNode);
  }

  closeEditors(caveName) {
    if (this.caveeditor !== undefined && !this.caveeditor.closed && this.caveeditor.cave.name === caveName) {
      this.caveeditor.closeEditor();
    }
    if (this.surveyeditor !== undefined && !this.surveyeditor.closed && this.surveyeditor.cave.name === caveName) {
      this.surveyeditor.closeEditor();
    }

  }

  updateCave(cave, predicate) {
    const caveNode = this.itree.getChildNodes().find(predicate);
    const data = this.transformCave(cave);
    this.itree.updateNode(caveNode, data);
  }

  initializeTree(data) {
    this.itree = new InfiniteTree({
      el          : this.treeNode,
      data        : data,
      autoOpen    : true,
      rowRenderer : this.treeRenderer,
      scene       : this.scene,
      options     : this.options
    });
    this.itree.on('click', this.click(this.itree));
  }

  transformCave(cave) {
    const mapSurvey = (cave, survey) => {
      return {
        id           : U.randomAlphaNumbericString(8),
        name         : survey.name,
        loadOnDemand : true,
        state        : { checked: survey.visible, nodeType: 'survey', cave: cave, survey: survey }
      };
    };
    const mapCave = (cave) => {
      return {
        id           : U.randomAlphaNumbericString(8),
        name         : cave.name,
        children     : cave.surveys.map((s) => mapSurvey(cave, s)),
        loadOnDemand : true,
        state        : { checked: cave.visible, nodeType: 'cave', cave: cave }
      };
    };
    return mapCave(cave);
  }

  addCave(cave) {
    const data = this.transformCave(cave);

    if (this.itree === undefined) {
      this.initializeTree(data);
    } else {
      this.itree.appendChildNode(data);
    }
  }

  click = (tree) => (event) => {
    const currentNode = tree.getNodeFromPoint(event.clientX, event.clientY);

    if (!currentNode) {
      return;
    }
    const state = currentNode.state;
    if (event.target.className === 'checkbox') {
      event.stopPropagation();
      const value = !state.checked;

      if (state.nodeType === 'survey') {
        state.survey.visible = value;
        this.scene.setSurveyVisibility(state.cave.name, state.survey.name, value);
      } else if (state.nodeType === 'cave') {
        const cave = state.cave;
        cave.visible = value;
        cave.surveys.forEach((survey) => {
          survey.visible = value;
          this.scene.setSurveyVisibility(cave.name, survey.name, value);
        });
      }

      tree.checkNode(currentNode);
      return;
    } else if (event.target.id === 'edit') {

      if (this.caveeditor !== undefined && !this.caveeditor.closed) {
        this.caveeditor.closeEditor();
      }
      if (this.surveyeditor !== undefined && !this.surveyeditor.closed) {
        this.surveyeditor.closeEditor();
      }

      if (state.nodeType === 'survey') {
        this.surveyeditor = new SurveyEditor(
          state.cave,
          state.survey,
          this.scene,
          this.attributeDefs,
          document.getElementById('surveyeditor')
        );
        this.surveyeditor.setupTable();
        this.surveyeditor.show();
      } else if (state.nodeType === 'cave') {

        this.caveeditor = new CaveEditor(
          this.db,
          this.options,
          state.cave,
          this.scene,
          this.attributeDefs,
          document.getElementById('caveeditor')
        );
        this.caveeditor.setupPanel();
        this.caveeditor.show();
      }

    } else if (event.target.id === 'delete') {
      if (state.nodeType === 'survey') {
        const result = confirm(`Do you want to delete survey '${state.survey.name}'?`);
        if (result) {
          this.db.deleteSurvey(state.cave.name, state.survey.name);
        }
      } else if (state.nodeType === 'cave') {
        const result = confirm(`Do you want to delete cave '${state.cave.name}'?`);
        if (result) {
          this.db.deleteCave(state.cave.name);
        }
      }
    } else if (event.target.id.startsWith('color-picker')) {
      const updateColor = (surveyOrCave) => (event2) => {
        surveyOrCave.color = new Color(event2.target.value);
        this.updateCave(state.cave, (n) => n.name === state.cave.name);
      };
      if (event.target.oninput === null) {
        if (state.nodeType === 'survey') {
          event.target.oninput = updateColor(state.survey);
        } else if (state.nodeType === 'cave') {
          event.target.oninput = updateColor(state.cave);
        }
      }
      event.target.showPicker();
      event.stopPropagation();
    }
  };

  treeRenderer(node, treeOptions) {
    const { id, name, loadOnDemand = false, children, state, props = {} } = node;
    const droppable = treeOptions.droppable && props.droppable;
    const { depth, open, path, total, selected = false, filtered, checked } = state;
    const childrenLength = Object.keys(children).length;
    const more = node.hasChildren();

    const isolatedSurvey = state.nodeType === 'survey' && state.survey.isolated === true;
    const orphanSurvey = state.nodeType === 'survey' && state.survey.orphanShotIds.size > 0;
    let color;

    if (state.nodeType === 'survey' && state.survey.color !== undefined) {
      color = state.survey.color.hexString();
    } else if (state.nodeType === 'cave' && state.cave.color !== undefined) {
      color = state.cave.color.hexString();
    }

    if (filtered === false) {
      return;
    }

    let togglerContent = '';
    if (!more && loadOnDemand) {
      togglerContent = tag(
        'i',
        {
          class : classNames('infinite-tree-right-arrow')
        },
        ''
      );
    }
    if (more && open) {
      togglerContent = tag(
        'i',
        {
          class : classNames('infinite-tree-down-arrow')
        },
        ''
      );
    }
    if (more && !open) {
      togglerContent = tag(
        'i',
        {
          class : classNames('infinite-tree-right-arrow')
        },
        ''
      );
    }
    if (state.expanding && !state.loading) {
      togglerContent = tag(
        'i',
        {
          class : classNames('glyphicon', 'glyphicon-refresh', 'rotating')
        },
        ''
      );
    }
    if (state.collapsing) {
      // TODO
    }
    const toggler = tag(
      'a',
      {
        class : (() => {
          if (!more && loadOnDemand) {
            return classNames(treeOptions.togglerClass, 'infinite-tree-closed');
          }
          if (more && open) {
            return classNames(treeOptions.togglerClass);
          }
          if (more && !open) {
            return classNames(treeOptions.togglerClass, 'infinite-tree-closed');
          }
          return '';
        })()
      },
      togglerContent
    );

    const icon = tag(
      'i',
      {
        class : classNames(
          { 'infinite-tree-isolated': isolatedSurvey },
          { 'infinite-tree-orphan': orphanSurvey && !isolatedSurvey }
        )
      },
      ''
    );

    const title = tag(
      'span',
      {
        class : classNames('infinite-tree-title')
      },
      escapeHtml(name)
    );

    const checkbox = tag('input', {
      type           : 'checkbox',
      checked        : checked,
      class          : classNames('checkbox'),
      'data-checked' : checked,
      id             : `checkbox-${id}`
    });

    const label = `<label for="checkbox-${id}"></label>`;

    const deleteIcon = tag(
      'span',
      {
        id    : 'delete',
        class : classNames('infinite-tree-delete')
      },
      ''
    );

    const colorIcon = tag(
      'input',
      {
        type  : 'color',
        id    : `color-picker-${id}`,
        value : color,
        class : classNames('infinite-tree-color')
      },
      ''
    );
    const colorLabel = tag('label', {
      for   : `color-picker-${id}`,
      class : classNames({ 'no-color': color === undefined }),
      style : color !== undefined ? `background: ${color};` : ''
    });
    //      '<span class="infinite-tree-color-line"></span>'

    const editIcon = tag(
      'span',
      {
        id    : 'edit',
        class : classNames('infinite-tree-edit')
      },
      ''
    );

    const treeNode = tag(
      'div',
      {
        class : 'infinite-tree-node',
        style : 'margin-left: ' + depth * 10 + 'px'
      },
      toggler + icon + title + checkbox + label + deleteIcon + editIcon + colorIcon + colorLabel
    );

    let treeNodeAttributes = {
      draggable       : 'false',
      'data-id'       : id,
      'data-expanded' : more && open,
      'data-depth'    : depth,
      'data-path'     : path,
      'data-selected' : selected,
      'data-children' : childrenLength,
      'data-total'    : total,
      class           : classNames('infinite-tree-item', { 'infinite-tree-selected': selected })
    };
    if (droppable) {
      treeNodeAttributes['droppable'] = true;
    }

    return tag('div', treeNodeAttributes, treeNode);
  }

}

export { ProjectManager, ProjectExplorer };
