import * as THREE from 'three';

import { LineMaterial } from 'three/addons/lines/LineMaterial.js';

export const materials = {
    segments: {
        centerLine: new LineMaterial({
            color: 0xff0000,
            linewidth: 1, // in world units with size attenuation, pixels otherwise
            worldUnits: false,
            vertexColors: false,
            alphaToCoverage: false,
        }),
        splay: new LineMaterial({
            color: 0x00ffff,
            linewidth: 1, // in world units with size attenuation, pixels otherwise
            worldUnits: false,
            vertexColors: false,
            alphaToCoverage: false,
        }),
    },
    text: new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide }),
    sphere: {
        centerLine: new THREE.MeshBasicMaterial({ color: 0xffff00 }),
        splay: new THREE.MeshBasicMaterial({ color: 0x0000ff }),
        selected: new THREE.MeshBasicMaterial({ color: 0xF00FFF }),
        selectedForContext: new THREE.MeshBasicMaterial({ color: 0x20ff3d }),
    },
    
    
    distanceLine: new THREE.LineDashedMaterial({ color: 0xffffff, linewidth: 2, scale: 2, dashSize: 1, gapSize: 1, }),
    planes: new Map([
        ["bedding", new THREE.MeshBasicMaterial({ color: 0xffff00, side: THREE.DoubleSide })],
        ["fault", new THREE.MeshBasicMaterial({ color: 0xfff0f, side: THREE.DoubleSide })]
    ]),
    whiteLine: new LineMaterial({
        color: 0xffffff, // this is very important to be white for gradient materials, don't change this
        linewidth: 0, // in world units with size attenuation, pixels otherwise
        worldUnits: false,
        vertexColors: true,
        alphaToCoverage: false,
    })
}
