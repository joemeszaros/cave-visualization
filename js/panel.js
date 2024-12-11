import { classNames } from './external/classnames.js';
import { tag } from './external/html5-tag.js';
import { escapeHtml } from "./external/escape-html.js";
import * as U from "./utils.js";
import * as D from "./datapanel.js";

export function renderSurveyPanel(caves, show, renderFn) {
    const mapSurvey = (survey) => {
        return {
            id: U.randomAlphaNumbericString(8),
            name: survey.name,
            loadOnDemand: true,
            state: { checked: survey.visible, survey: survey }
        };
    }
    const mapCave = (cave) => {
        return {
            id: U.randomAlphaNumbericString(8),
            name: cave.name, 
            children: cave.surveys.map(mapSurvey), 
            loadOnDemand: true, 
            state: { checked: cave.visible, cave: cave }
        };
    }
    document.querySelector('#tree-panel').innerHTML = '';

    caves.forEach((cave) => {
        const tree = new InfiniteTree({
            el: document.querySelector('#tree-panel'),
            data: mapCave(cave),
            autoOpen: false,
            rowRenderer: renderer,
        });

        tree.on('click', function (event) {
            console.log(event.target);
            const currentNode = tree.getNodeFromPoint(event.clientX, event.clientY);
            if (!currentNode) {
                return;
            }

            if (event.target.className === 'checkbox') {
                event.stopPropagation();
                const value = !currentNode.state.checked;

                if (currentNode.state.survey !== undefined) {
                    const survey = currentNode.state.survey;
                    survey.visible = value;
                    survey.polygonSegments.visible = value && show.polygon;
                    survey.splaySegments.visible = value && show.splays;
                    survey.stationNames.visible = value && show.stationNames;
                    survey.stationSpheres.visible = value && show.spheres;
                    renderFn();
                }

                if (currentNode.state.cave !== undefined) {
                    const cave = currentNode.state.cave;
                    cave.visible = value;
                    cave.surveys.forEach((survey) => {
                        survey.visible = value;
                        survey.polygonSegments.visible = value && show.polygon;
                        survey.splaySegments.visible = value && show.splays;
                        survey.stationNames.visible = value && show.stationNames;
                        survey.stationSpheres.visible = value && show.spheres;
                    });
                    renderFn();
                }

                tree.checkNode(currentNode);
                return;
            } else if (event.target.id === "edit") {
                datapanel.style.display = "block";
                console.log(' state ', currentNode.state);
                console.log(' survey ', currentNode.state.survey);
                D.setupTable(currentNode.state.survey.shots);

            }
        });

        tree.on('contentDidUpdate', () => {
            updateIndeterminateState(tree);
        });

        tree.on('clusterDidChange', () => {
            updateIndeterminateState(tree);
        });

        return tree;
    });
}

const updateIndeterminateState = (tree) => {
    const checkboxes = tree.contentElement.querySelectorAll('input[type="checkbox"]');
    for (let i = 0; i < checkboxes.length; ++i) {
        const checkbox = checkboxes[i];
        if (checkbox.hasAttribute('data-indeterminate')) {
            checkbox.indeterminate = true;
        } else {
            checkbox.indeterminate = false;
        }
    }
};

function renderer(node, treeOptions) {
    const { id, name, loadOnDemand = false, children, state, props = {} } = node;
    const droppable = (treeOptions.droppable) && (props.droppable);
    const { depth, open, path, total, selected = false, filtered, checked, indeterminate } = state;
    const childrenLength = Object.keys(children).length;
    const more = node.hasChildren();

    if (filtered === false) {
        return;
    }

    let togglerContent = '';
    if (!more && loadOnDemand) {
        togglerContent = tag('i', {
            'class': classNames('glyphicon', 'glyphicon-triangle-right')
        }, '');
    }
    if (more && open) {
        togglerContent = tag('i', {
            'class': classNames('glyphicon', 'glyphicon-triangle-bottom')
        }, '');
    }
    if (more && !open) {
        togglerContent = tag('i', {
            'class': classNames('glyphicon', 'glyphicon-triangle-right')
        }, '');
    }
    if (state.expanding && !state.loading) {
        togglerContent = tag('i', {
            'class': classNames('glyphicon', 'glyphicon-refresh', 'rotating')
        }, '');
    }
    if (state.collapsing) {
        // TODO
    }
    const toggler = tag('a', {
        'class': (() => {
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
    }, togglerContent);

    const icon = tag('i', {
        'class': classNames(
            'infinite-tree-folder-icon',
            'glyphicon',
            { 'glyphicon-folder-open': more && open },
            { 'glyphicon-folder-close': more && !open },
            { 'glyphicon-file': !more }
        )
    }, '');

    const checkbox = tag('input', {
        type: 'checkbox',
        style: 'display: inline-block; margin: 0 4px',
        'class': 'checkbox',
        checked: checked,
        'data-checked': checked,
        'data-indeterminate': indeterminate
    });

    const title = tag('span', {
        'class': classNames('infinite-tree-title')
    }, escapeHtml(name));

    const loadingIcon = tag('i', {
        'style': 'margin-left: 5px',
        'class': classNames(
            { 'hidden': !state.loading },
            'glyphicon',
            'glyphicon-refresh',
            { 'rotating': state.loading }
        )
    }, '');

    const editIcon = tag('span', {
        'id': 'edit',
        'class': classNames('infinite-tree-edit', 'glyphicon', 'glyphicon-edit')
    }, '');

    const treeNode = tag('div', {
        'class': 'infinite-tree-node',
        'style': 'margin-left: ' + depth * 18 + 'px'
    }, toggler + checkbox + icon + title + loadingIcon + editIcon);

    let treeNodeAttributes = {
        'draggable': 'true',
        'data-id': id,
        'data-expanded': more && open,
        'data-depth': depth,
        'data-path': path,
        'data-selected': selected,
        'data-children': childrenLength,
        'data-total': total,
        'class': classNames(
            'infinite-tree-item',
            { 'infinite-tree-selected': selected }
        )
    };
    if (droppable) {
        treeNodeAttributes['droppable'] = true;
    }

    return tag('div', treeNodeAttributes, treeNode);
};