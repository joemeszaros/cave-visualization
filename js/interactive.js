import * as THREE from 'three';

let pointer = new THREE.Vector2();
let selectedStation, selectedStationForContext;
let raycaster = new THREE.Raycaster();

export function calcualteDistanceListener(event, rect, sphereMaterial, renderFn) {
    const from = selectedStation.position.clone();
    const to = selectedStationForContext.position.clone();
    const diff = to.sub(from);
    hideContextMenu();
    const left = event.clientX - rect.left;
    const top = event.clientY - rect.top;
    showDistancePanel(diff, left, top);
    
    selectedStationForContext.material = sphereMaterial;
    selectedStationForContext = undefined;
    selectedStation.material = sphereMaterial;
    selectedStation = undefined;
    renderFn();
}

export function onPointerMove(event) {
    pointer.x = (event.clientX / window.innerWidth) * 2 - 1;
    pointer.y = - (event.clientY / window.innerHeight) * 2 + 1;
}
export function onClick(event, cavesStationSpheresGroup, currentCamera, sphereMaterial, selectedSphereMaterial, renderFn) {
    if (cavesStationSpheresGroup !== undefined) {
        raycaster.setFromCamera(pointer, currentCamera);
        const intersects = raycaster.intersectObjects(cavesStationSpheresGroup);

        if (intersects.length) {
            const intersectedObject = intersects[0].object;

            if (intersectedObject === selectedStation) {
                intersectedObject.material = sphereMaterial;
                selectedStation = undefined;
            } else {
                if (selectedStation !== undefined) {
                    selectedStation.material = sphereMaterial;
                }

                if (selectedStationForContext === intersectedObject) {
                    hideContextMenu();
                }
                intersectedObject.material = selectedSphereMaterial;
                selectedStation = intersectedObject;
            }


        } else if (selectedStation !== undefined) {
            selectedStation.material = sphereMaterial;
            selectedStation = undefined;
        }

        renderFn();

    }
}

export function onMouseDown(event, cavesStationSpheresGroup, currentCamera, sphereMaterial, selectedSphereMaterial, rect, renderFn) {
    event.preventDefault();
    var rightclick;
    if (!event) var event = window.event;
    if (event.which) rightclick = (event.which == 3);
    else if (event.button) rightclick = (event.button == 2);
    if (!rightclick) return;

    if (cavesStationSpheresGroup !== undefined) {
        raycaster.setFromCamera(pointer, currentCamera);

        var intersects = raycaster.intersectObjects(cavesStationSpheresGroup);

        if (intersects.length) {
            const intersectedObject = intersects[0].object;
            if (intersectedObject === selectedStation) {
                if (selectedStationForContext !== undefined) {
                    selectedStationForContext.material = sphereMaterial;
                    showContextMenu(event.clientX - rect.left, event.clientY - rect.top);
                }
                selectedStationForContext = intersectedObject;
                selectedStation = undefined;
            } else {
                if (selectedStationForContext !== undefined) {
                    selectedStationForContext.material = sphereMaterial;
                }
                selectedStationForContext = intersectedObject;
                intersectedObject.material = selectedSphereMaterial;
                showContextMenu(event.clientX - rect.left, event.clientY - rect.top);
            }

            renderFn();
        }

    }
}

function showContextMenu(left, top) {
    menu.style.left = left + "px";
    menu.style.top = top + "px";
    menu.style.display = "";
}

function hideContextMenu() {
    menu.style.display = "none";
}

function showDistancePanel(diffVector, left, top) {
    infopanel.style.left = left + "px";
    infopanel.style.top = top + "px";
    infopanel.style.display = "block";
    infopanelcontent.innerHTML = `
    X distance: ${diffVector.x}<br>
    Y distance: ${diffVector.y}<br>
    Z distance: ${diffVector.z}<br>
    Horizontal distance: ${Math.sqrt(Math.pow(diffVector.x, 2), Math.pow(diffVector.y))}<br>
    Spatial distance: ${diffVector.length()}
    `
}