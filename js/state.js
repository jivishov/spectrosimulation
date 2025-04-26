// state.js
import * as config from './config.js'; // Needed for initializeState
import { calculateConcentration } from './actions.js'; // Needed for initializeState

// Module-scoped state variables
let currentStep = 0;
let labObjects = [];
let dataTableData = [];
let spec20State = {};
let historyStack = [];
let draggedObject = null;
let dragOffsetX = 0;
let dragOffsetY = 0;
let feedback = { message: '', type: 'info' };
let highlights = [];
let isDragging = false;

// Function to get the current state snapshot
export function getState() {
    return {
        currentStep,
        labObjects,
        dataTableData,
        spec20State,
        historyStack,
        draggedObject,
        dragOffsetX,
        dragOffsetY,
        feedback,
        highlights,
        isDragging,
    };
}

// Function to set specific state variables (use sparingly, prefer dedicated functions)
export function setStateVariable(key, value) {
    switch (key) {
        case 'currentStep': currentStep = value; break;
        case 'labObjects': labObjects = value; break; // Use with care, might need deep copy
        case 'dataTableData': dataTableData = value; break; // Use with care
        case 'spec20State': spec20State = value; break; // Use with care
        case 'historyStack': historyStack = value; break; // Use with care
        case 'draggedObject': draggedObject = value; break;
        case 'dragOffsetX': dragOffsetX = value; break;
        case 'dragOffsetY': dragOffsetY = value; break;
        case 'feedback': feedback = value; break;
        case 'highlights': highlights = value; break;
        case 'isDragging': isDragging = value; break;
        default: console.error("Unknown state variable:", key);
    }
}

// Function to update a specific property of an object in labObjects
export function updateLabObject(id, property, value) {
    const objIndex = labObjects.findIndex(o => o.id === id);
    if (objIndex > -1) {
        labObjects[objIndex][property] = value;
        // console.log(`Updated ${id}: ${property}=${value}`);
    } else {
        console.error(`Cannot update object: ID ${id} not found.`);
    }
}

// Function to update a property in dataTableData
export function updateDataTableRow(id, property, value) {
     const rowIndex = dataTableData.findIndex(row => row.id === id);
     if (rowIndex > -1) {
         dataTableData[rowIndex][property] = value;
     } else {
         console.error(`Cannot update data table: ID ${id} not found.`);
     }
}
// Function to update a property in spec20State
export function updateSpec20State(property, value) {
    if (spec20State.hasOwnProperty(property)) {
        spec20State[property] = value;
    } else {
        console.error(`Cannot update spec20 state: Property ${property} not found.`);
    }
}

export function initializeState() {
    currentStep = 0;
    feedback = { message: 'Welcome! Follow the instructions.', type: 'info' };
    historyStack = [];
    draggedObject = null;
    highlights = [];
    isDragging = false;

    const originalPipetteWidth = 10;
    const originalPipetteHeight = 150;
    const pipetteScaleFactor = 0.7;
    const pipetteWidth = originalPipetteWidth * pipetteScaleFactor;
    const pipetteHeight = originalPipetteHeight * pipetteScaleFactor;

    const stockBottle = { id: 'stockBottle', type: 'bottle', label: 'Stock Blue#1', x: 50, y: 50, width: 50, height: 100, concentration: config.STOCK_CONCENTRATION, maxVolume: 1000, currentVolume: 1000, isDraggable: false, isDropTarget: true };
    const waterBottle = { id: 'waterBottle', type: 'bottle', label: 'Distilled H₂O', x: 120, y: 50, width: 50, height: 100, concentration: 0, maxVolume: 1000, currentVolume: 1000, isDraggable: false, isDropTarget: true };
    const unknownBottle = { id: 'unknownBottle', type: 'bottle', label: 'Unknown Drink', x: 50, y: 195, width: 50, height: 80, concentration: -1, maxVolume: 500, currentVolume: 500, isDraggable: false, isDropTarget: true };

    const pipetteX = unknownBottle.x + unknownBottle.width + 15;
    const pipetteY = unknownBottle.y;

    const pipette = { id: 'pipette', type: 'pipette', label: 'Pipette',
                      x: pipetteX, y: pipetteY,
                      width: pipetteWidth, height: pipetteHeight,
                      maxVolume: 10, currentVolume: 0, contentsConcentration: 0, isDraggable: true, isDropTarget: false };

    const wasteBeaker = { id: 'wasteBeaker', type: 'beaker', label: 'Waste', x: 680, y: 300, width: 80, height: 100, maxVolume: 250, currentVolume: 0, concentration: null, isDraggable: false, isDropTarget: true };
    const spec20 = { id: 'spec20', type: 'spectrophotometer', label: 'Spec 20', x: 500, y: 50, width: 250, height: 150, isDraggable: false, isDropTarget: true };

    const tubes = [
        { id: 'tube_10_0', type: 'testTube', label: '10/0', x: 250, y: 50, width: 25, height: 100, maxVolume: 10, currentVolume: 0, concentration: 0, isDraggable: false, isDropTarget: true },
        { id: 'tube_8_2', type: 'testTube', label: '8/2', x: 285, y: 50, width: 25, height: 100, maxVolume: 10, currentVolume: 0, concentration: 0, isDraggable: false, isDropTarget: true },
        { id: 'tube_6_4', type: 'testTube', label: '6/4', x: 320, y: 50, width: 25, height: 100, maxVolume: 10, currentVolume: 0, concentration: 0, isDraggable: false, isDropTarget: true },
        { id: 'tube_4_6', type: 'testTube', label: '4/6', x: 355, y: 50, width: 25, height: 100, maxVolume: 10, currentVolume: 0, concentration: 0, isDraggable: false, isDropTarget: true },
        { id: 'tube_2_8', type: 'testTube', label: '2/8', x: 390, y: 50, width: 25, height: 100, maxVolume: 10, currentVolume: 0, concentration: 0, isDraggable: false, isDropTarget: true },
        { id: 'tube_0_10', type: 'testTube', label: '0/10 (Blank)', x: 425, y: 50, width: 25, height: 100, maxVolume: 10, currentVolume: 0, concentration: 0, isDraggable: false, isDropTarget: true },
    ];

    const firstTube = tubes[0];
    const lastTube = tubes[tubes.length - 1];
    const tubeRowCenterX = firstTube.x + (lastTube.x + lastTube.width - firstTube.x) / 2;
    const tubeBottomY = firstTube.y + firstTube.height + firstTube.width / 2;
    const cuvetteWidth = 15;
    const cuvetteHeight = 50;
    const cuvetteX = tubeRowCenterX - cuvetteWidth / 2;
    const cuvetteY = tubeBottomY + 30;

    const cuvette = { id: 'cuvette', type: 'cuvette', label: 'Cuvette',
                      x: cuvetteX, y: cuvetteY,
                      width: cuvetteWidth, height: cuvetteHeight,
                      maxVolume: 4, currentVolume: 0, concentration: 0,
                      isClean: true,
                      isDraggable: true, isDropTarget: true, isInSpec: false };

    labObjects = [ stockBottle, waterBottle, unknownBottle, pipette, ...tubes, cuvette, wasteBeaker, spec20 ];

    dataTableData = [
        { id: 'tube_10_0', solution: '1 (Stock)', dilution: '10 / 0', conc: calculateConcentration(10, 0), measuredPercentT: null, T: null, negLogT: null },
        { id: 'tube_8_2', solution: '2', dilution: '8 / 2', conc: calculateConcentration(8, 2), measuredPercentT: null, T: null, negLogT: null },
        { id: 'tube_6_4', solution: '3', dilution: '6 / 4', conc: calculateConcentration(6, 4), measuredPercentT: null, T: null, negLogT: null },
        { id: 'tube_4_6', solution: '4', dilution: '4 / 6', conc: calculateConcentration(4, 6), measuredPercentT: null, T: null, negLogT: null },
        { id: 'tube_2_8', solution: '5', dilution: '2 / 8', conc: calculateConcentration(2, 8), measuredPercentT: null, T: null, negLogT: null },
        { id: 'tube_0_10', solution: '6 (Blank)', dilution: '0 / 10', conc: 0, measuredPercentT: null, T: null, negLogT: null },
        { id: 'unknown', solution: 'Unknown Drink', dilution: 'N/A', conc: null, measuredPercentT: null, T: null, negLogT: null },
    ];
    spec20State = { cuvetteInsideId: null, reading: "-- %T", wavelength: config.TARGET_WAVELENGTH, isZeroed: false, absorbanceMode: false, zeroButtonPos: { x: 510, y: 160, width: 50, height: 25 }, measureButtonPos: { x: 570, y: 160, width: 60, height: 25 }, modeButtonPos: { x: 640, y: 160, width: 50, height: 25 } };
    console.log("State initialized.");
}


export function cloneState() {
    // Deep clone is important here
    return JSON.parse(JSON.stringify({
        currentStep, labObjects, dataTableData, spec20State
    }));
}

export function restoreState(state) {
    // Directly assign properties from the cloned state
    currentStep = state.currentStep;
    labObjects = state.labObjects; // Assumes state.labObjects is a deep clone
    dataTableData = state.dataTableData; // Assumes state.dataTableData is a deep clone
    spec20State = state.spec20State; // Assumes state.spec20State is a deep clone
    highlights = []; // Reset highlights on restore
    // Reset interaction state potentially affected by undo
    draggedObject = null;
    isDragging = false;
}

export function saveState(undoButtonElement) {
    if (historyStack.length > 20) {
        historyStack.shift();
    }
    // Use the internal cloneState which deep clones the necessary parts
    historyStack.push(cloneState());
    if(undoButtonElement) undoButtonElement.disabled = false;
}

export function findObjectById(id) {
    return labObjects.find(obj => obj.id === id);
}

// Add a function to pop from history stack for the undo action
export function popHistory() {
    if (historyStack.length > 0) {
        return historyStack.pop();
    }
    return null;
}