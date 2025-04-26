// interaction.js
import { getState, setStateVariable, findObjectById, saveState, popHistory, restoreState } from './state.js';
import { drawSimulation, drawGraph } from './renderer.js';
import { updateUI, showFeedback } from './ui.js';

// Store references provided by main.js
let labCanvas = null;
let undoButton = null;
let actions = {}; // To hold try... functions

// --- Hit Detection ---
function isPointInRect(x, y, rect) {
    return x >= rect.x && x <= rect.x + rect.width &&
           y >= rect.y && y <= rect.y + rect.height;
}

function isPointOverObject(x, y, obj) {
    // Use getState() here if needed for spec20State etc.
    const state = getState();
    let hit = false; // Default to no hit

    if (obj.type === 'pipette') {
        // Use geometry from drawPipette
        const bodyStartX = obj.x;
        const bodyStartY = obj.y;
        const bodyEndY = bodyStartY + obj.height;
        const bulbRadius = obj.width * 1.6; // Match renderer
        const bulbCenterX = bodyStartX + obj.width / 2;
        const bulbCenterY = bodyStartY - bulbRadius * 0.7;
        const tipLength = 18;
        const tipEndY = bodyEndY + tipLength;

        const dxBulb = x - bulbCenterX;
        const dyBulb = y - bulbCenterY;
        if (dxBulb * dxBulb + dyBulb * dyBulb <= bulbRadius * bulbRadius) {
            hit = true;
        } else if (x >= bodyStartX && x <= bodyStartX + obj.width && y >= bodyStartY && y <= bodyEndY) {
            hit = true;
        } else if (y > bodyEndY && y <= tipEndY) {
            const tipBaseWidth = obj.width;
            const tipXStart = bodyStartX;
            if (x >= tipXStart && x <= tipXStart + tipBaseWidth) {
                hit = true;
            }
        }
    } else if (obj.type === 'spectrophotometer') {
        const { zeroButtonPos, measureButtonPos, modeButtonPos } = state.spec20State;
        if (isPointInRect(x, y, zeroButtonPos)) return { ...obj, clickedButton: 'zero' };
        if (isPointInRect(x, y, measureButtonPos)) return { ...obj, clickedButton: 'measure' };
        if (isPointInRect(x, y, modeButtonPos)) return { ...obj, clickedButton: 'mode' };
        const slotX = obj.x + obj.width * 0.8; const slotY = obj.y + 15; const slotWidth = 30; const slotHeight = 60;
        if (isPointInRect(x, y, {x: slotX, y: slotY, width: slotWidth, height: slotHeight})) {
            hit = true;
        } else if (x >= obj.x && x <= obj.x + obj.width && y >= obj.y && y <= obj.y + obj.height) {
            hit = true;
        }
    } else {
        // Default bounding box check
        hit = x >= obj.x && x <= obj.x + obj.width && y >= obj.y && y <= obj.y + obj.height;
    }
    return hit ? obj : null;
}

function getObjectAt(x, y) {
    const state = getState();
    for (let i = state.labObjects.length - 1; i >= 0; i--) {
        const obj = state.labObjects[i];
        if (obj === state.draggedObject) continue;
        const hitResult = isPointOverObject(x, y, obj);
        // Important: For drop targets, ignore button hits on Spec20
        if (hitResult && !hitResult.clickedButton) return hitResult;
    }
    return null;
}

function getObjectAtMouseDown(x, y) {
    const state = getState();
    for (let i = state.labObjects.length - 1; i >= 0; i--) {
        const obj = state.labObjects[i];
        const hitResult = isPointOverObject(x, y, obj);
        // Include button hits for initial click detection
        if (hitResult) return hitResult;
    }
    return null;
}


// --- Event Handlers ---
function handleMouseDown(e) {
    if (!labCanvas) return;
    const rect = labCanvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    const clickedObjectResult = getObjectAtMouseDown(mouseX, mouseY);

    setStateVariable('isDragging', false);
    setStateVariable('draggedObject', null);

    if (clickedObjectResult?.clickedButton) {
        // Button click handled on mouseup
        return;
    }

    const clickedObject = clickedObjectResult; // Already checked for button
    if (clickedObject && clickedObject.isDraggable) {
        const objToDrag = findObjectById(clickedObject.id); // Find the actual object reference
        if (!objToDrag) {
            console.error("Failed to find draggable object ref:", clickedObject.id); return;
        }
        setStateVariable('draggedObject', objToDrag);
        setStateVariable('isDragging', true);
        setStateVariable('dragOffsetX', mouseX - objToDrag.x);
        setStateVariable('dragOffsetY', mouseY - objToDrag.y);

        // Bring dragged object to top for drawing (modify labObjects array in state)
        const currentLabObjects = getState().labObjects;
        const updatedLabObjects = currentLabObjects.filter(obj => obj.id !== objToDrag.id);
        updatedLabObjects.push(objToDrag); // Add to the end
        setStateVariable('labObjects', updatedLabObjects);

        setStateVariable('highlights', [objToDrag.id]);
        labCanvas.classList.add('dragging');
        drawSimulation(); // Redraw immediately
    }
}

function handleMouseMove(e) {
    const state = getState();
    if (!state.isDragging || !state.draggedObject) return;

    const rect = labCanvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    // Calculate visual bounds for boundary check (specific for pipette)
    let objWidth = state.draggedObject.width || 20;
    let objHeight = state.draggedObject.height || 50;
    if (state.draggedObject.type === 'pipette') {
         const bulbRadius = state.draggedObject.width * 1.6;
         const tipLength = 18;
         objHeight = bulbRadius*1.8 + state.draggedObject.height + tipLength; // Approx visual height
         objWidth = bulbRadius * 2; // Width based on bulb
    }

    // Update position (respecting boundaries)
    // Adjust for potentially wider visual width of pipette
    const visualXOffset = (state.draggedObject.type === 'pipette') ? (objWidth / 2 - state.draggedObject.width / 2) : 0;
    state.draggedObject.x = Math.max(-visualXOffset, Math.min(labCanvas.width - objWidth + visualXOffset, mouseX - state.dragOffsetX));
    // Adjust Y for pipette bulb top
    const visualYOffset = (state.draggedObject.type === 'pipette') ? (state.draggedObject.y - (state.draggedObject.y + 10 - (state.draggedObject.width*1.6)*0.7 - state.draggedObject.width*1.6)) : 0;
    state.draggedObject.y = Math.max(-visualYOffset, Math.min(labCanvas.height - objHeight + visualYOffset, mouseY - state.dragOffsetY));


    // Update highlights based on potential drop target
    const currentHighlights = [state.draggedObject.id]; // Always highlight dragged
    const potentialTargetResult = getObjectAt(mouseX, mouseY); // Gets object excluding buttons
    if (potentialTargetResult) {
        const potentialTarget = findObjectById(potentialTargetResult.id);
        if (potentialTarget && potentialTarget.isDropTarget) {
            // Check if target is valid for the *current* step (using imported instructions)
            // This logic might need refinement or access to instructions array
            // For now, just highlight if it's a drop target
            currentHighlights.push(potentialTarget.id);
        }
    }
    setStateVariable('highlights', currentHighlights);
    drawSimulation();
}

function handleMouseUp(e) {
    const wasDragging = getState().isDragging;
    const draggedObjBefore = getState().draggedObject; // Store ref before resetting state

    setStateVariable('isDragging', false);
    labCanvas.classList.remove('dragging');

    const rect = labCanvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    const objectUnderMouseResult = getObjectAtMouseDown(mouseX, mouseY); // Check includes buttons

    if (!wasDragging && objectUnderMouseResult?.clickedButton) {
        // Handle button click if NOT dragging
        if (objectUnderMouseResult.type === 'spectrophotometer') {
            if (objectUnderMouseResult.clickedButton === 'zero') actions.tryZeroSpec();
            else if (objectUnderMouseResult.clickedButton === 'measure') actions.tryMeasure();
            else if (objectUnderMouseResult.clickedButton === 'mode') actions.tryToggleMode();
        }
    } else if (wasDragging && draggedObjBefore) {
        // Handle drop if dragging occurred
        const dropTargetResult = getObjectAt(mouseX, mouseY); // Check excludes buttons
        const dropTarget = dropTargetResult ? findObjectById(dropTargetResult.id) : null;

        let stateUpdatedByRemoval = false;
        if (draggedObjBefore.type === 'cuvette' && draggedObjBefore.isInSpec) {
            if (!dropTarget || dropTarget.id !== 'spec20') {
                // Cuvette removed from spec
                updateLabObject(draggedObjBefore.id, 'isInSpec', false);
                updateSpec20State('cuvetteInsideId', null);
                updateSpec20State('reading', getState().spec20State.absorbanceMode ? "-- Abs" : "-- %T");
                stateUpdatedByRemoval = true;
                saveState(undoButton); // Save state *after* removal
            }
        }

        if (dropTarget) {
            // Call appropriate action based on dragged type and target type
            if (draggedObjBefore.type === 'pipette') {
                if (draggedObjBefore.currentVolume === 0 && (dropTarget.type === 'bottle' || dropTarget.type === 'testTube')) {
                    actions.tryFillPipette(draggedObjBefore.id, dropTarget.id);
                } else if (draggedObjBefore.currentVolume > 0 && (dropTarget.type === 'testTube' || dropTarget.type === 'cuvette' || dropTarget.type === 'beaker')) {
                    actions.tryDispensePipette(draggedObjBefore.id, dropTarget.id, draggedObjBefore.currentVolume);
                }
            } else if (draggedObjBefore.type === 'cuvette') {
                if (dropTarget.id === 'wasteBeaker') {
                    // Need stepConfig to pass to emptyCuvette for markClean logic
                    actions.tryEmptyCuvette(draggedObjBefore.id, dropTarget.id); // Pass null for now, need to import instructions
                } else if (dropTarget.type === 'spectrophotometer') {
                    if (!stateUpdatedByRemoval) {
                        actions.tryInsertCuvette(draggedObjBefore.id, dropTarget.id);
                    } else {
                        showFeedback("Place cuvette elsewhere before re-inserting.", "info");
                    }
                }
            }
        }
        setStateVariable('draggedObject', null); // Clear dragged object ref
    }

    setStateVariable('highlights', []); // Clear highlights regardless
    updateUI(); // Update UI after any action
}

function handleUndoClick() {
    const prevState = popHistory();
    if (prevState) {
        restoreState(prevState);
        showFeedback('Undo successful.', 'info');
        updateUI(); // Update UI elements
        drawGraph(); // Redraw graph
    }
    if (undoButton) undoButton.disabled = getState().historyStack.length === 0;
}


// --- Initialization ---
export function initInteraction(canvasElement, undoButtonElement, actionFunctions) {
    labCanvas = canvasElement;
    undoButton = undoButtonElement;
    actions = actionFunctions; // Store the passed action functions

    if (!labCanvas || !undoButton) {
        console.error("Interaction module requires canvas and undo button elements.");
        return;
    }

    labCanvas.addEventListener('mousedown', handleMouseDown);
    labCanvas.addEventListener('mousemove', handleMouseMove);
    labCanvas.addEventListener('mouseup', handleMouseUp);
    // Add touch events if needed later

    undoButton.addEventListener('click', handleUndoClick);

    console.log("Interaction listeners initialized.");
}