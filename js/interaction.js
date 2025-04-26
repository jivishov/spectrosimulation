// interaction.js
import { getState, setStateVariable, findObjectById, saveState, popHistory, restoreState, updateLabObject, updateSpec20State } from './state.js';
import { drawSimulation, drawGraph } from './renderer.js';
import { updateUI, showFeedback } from './ui.js';
// Import instructions only if needed directly here (e.g., for drop validation, but currently handled in actions)
// import instructions from './instructions.js';

// Store references provided by main.js
let labCanvas = null;
let undoButton = null;
let actions = {}; // To hold try... functions from actions.js

// --- Hit Detection ---
function isPointInRect(x, y, rect) {
    return x >= rect.x && x <= rect.x + rect.width &&
           y >= rect.y && y <= rect.y + rect.height;
}

function isPointOverObject(x, y, obj) {
    const state = getState();
    let hit = false;

    if (obj.type === 'pipette') {
        // Use geometry matching drawPipette in renderer.js
        const bodyStartX = obj.x;
        const bodyStartY = obj.y;
        const bodyEndY = bodyStartY + obj.height;
        const bulbRadius = obj.width * 1.6; // Matches renderer
        const bulbCenterX = bodyStartX + obj.width / 2;
        const bulbCenterY = bodyStartY - bulbRadius * 0.7; // Matches renderer
        const tipLength = 18; // Matches renderer
        const tipEndY = bodyEndY + tipLength;

        const dxBulb = x - bulbCenterX;
        const dyBulb = y - bulbCenterY;
        // Check bulb, body, and tip area
        if (dxBulb * dxBulb + dyBulb * dyBulb <= bulbRadius * bulbRadius) { hit = true; }
        else if (x >= bodyStartX && x <= bodyStartX + obj.width && y >= bodyStartY && y <= bodyEndY) { hit = true; }
        else if (y > bodyEndY && y <= tipEndY) {
            const tipBaseWidth = obj.width; // Approximate tip hit area width
            const tipXStart = bodyStartX;
            if (x >= tipXStart && x <= tipXStart + tipBaseWidth) { hit = true; }
        }
    } else if (obj.type === 'spectrophotometer') {
        const { zeroButtonPos, measureButtonPos, modeButtonPos } = state.spec20State;
        // Check buttons first, return specific button info if hit
        if (isPointInRect(x, y, zeroButtonPos)) return { ...obj, clickedButton: 'zero' };
        if (isPointInRect(x, y, measureButtonPos)) return { ...obj, clickedButton: 'measure' };
        if (isPointInRect(x, y, modeButtonPos)) return { ...obj, clickedButton: 'mode' };
        // Check slot and main body for general hit detection (drop target)
        const slotX = obj.x + obj.width * 0.8; const slotY = obj.y + 15; const slotWidth = 30; const slotHeight = 60;
        if (isPointInRect(x, y, {x: slotX, y: slotY, width: slotWidth, height: slotHeight})) { hit = true; }
        else if (x >= obj.x && x <= obj.x + obj.width && y >= obj.y && y <= obj.y + obj.height) { hit = true; }
    } else {
        // Default bounding box check for other objects
        hit = x >= obj.x && x <= obj.x + obj.width && y >= obj.y && y <= obj.y + obj.height;
    }
    // Return the object itself if hit (without button distinction unless handled above)
    return hit ? obj : null;
}

// Find the topmost object under the cursor, excluding buttons (for drop targets)
function getObjectAt(x, y) {
    const state = getState();
    for (let i = state.labObjects.length - 1; i >= 0; i--) { // Iterate backwards (top objects first)
        const obj = state.labObjects[i];
        if (obj === state.draggedObject) continue; // Don't detect drop on self while dragging
        const hitResult = isPointOverObject(x, y, obj);
        // Important: For drop targets, ignore button hits on Spec20
        if (hitResult && !hitResult.clickedButton) return hitResult;
    }
    return null;
}

// Find the topmost object under the cursor, including buttons (for mousedown)
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
        // Button click will be fully handled on mouseup to avoid accidental drags
        return;
    }

    const clickedObject = clickedObjectResult; // Already checked for button
    if (clickedObject && clickedObject.isDraggable) {
        const objToDrag = findObjectById(clickedObject.id); // Find the actual object reference
        if (!objToDrag) { console.error("Failed to find draggable object ref:", clickedObject.id); return; }
        setStateVariable('draggedObject', objToDrag);
        setStateVariable('isDragging', true);
        setStateVariable('dragOffsetX', mouseX - objToDrag.x);
        setStateVariable('dragOffsetY', mouseY - objToDrag.y);

        // Bring dragged object to top for drawing (modify labObjects array in state)
        const currentLabObjects = getState().labObjects;
        const updatedLabObjects = currentLabObjects.filter(obj => obj.id !== objToDrag.id);
        updatedLabObjects.push(objToDrag); // Add to the end
        setStateVariable('labObjects', updatedLabObjects); // Replace the array in state

        setStateVariable('highlights', [objToDrag.id]);
        labCanvas.classList.add('lab-canvas--dragging'); // Use BEM class
        drawSimulation(); // Redraw immediately
    }
}

function handleMouseMove(e) {
    const state = getState();
    if (!state.isDragging || !state.draggedObject) return;

    const rect = labCanvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    // --- Calculate visual bounds for boundary check (specific for pipette) ---
    let objWidth = state.draggedObject.width || 20;
    let objHeight = state.draggedObject.height || 50;
    let visualXOffset = 0;
    let visualYOffset = 0;
    let pipetteVisualX = state.draggedObject.x; // Default visual X
    let pipetteVisualY = state.draggedObject.y; // Default visual Y
    if (state.draggedObject.type === 'pipette') {
         const bulbRadius = state.draggedObject.width * 1.6;
         const tipLength = 18;
         const bulbCenterX = state.draggedObject.x + state.draggedObject.width / 2;
         const bulbCenterY = state.draggedObject.y - bulbRadius * 0.7;
         const bulbTopY = bulbCenterY - bulbRadius;
         const bodyEndY = state.draggedObject.y + state.draggedObject.height;
         const tipEndY = bodyEndY + tipLength;

         objHeight = tipEndY - bulbTopY; // Total visual height
         objWidth = bulbRadius * 2;     // Total visual width (bulb)
         pipetteVisualX = bulbCenterX - bulbRadius; // Top-left X of visual bounds
         pipetteVisualY = bulbTopY;                // Top-left Y of visual bounds
         visualXOffset = state.draggedObject.x - pipetteVisualX; // How much visual X differs from object's base x
         visualYOffset = state.draggedObject.y - pipetteVisualY; // How much visual Y differs from object's base y
    }

    // --- Update object's core x,y position in state ---
    const newX = Math.max(0 - visualXOffset, Math.min(labCanvas.width - objWidth - visualXOffset, mouseX - state.dragOffsetX));
    const newY = Math.max(0 - visualYOffset, Math.min(labCanvas.height - objHeight - visualYOffset, mouseY - state.dragOffsetY));
    updateLabObject(state.draggedObject.id, 'x', newX);
    updateLabObject(state.draggedObject.id, 'y', newY);


    // --- Highlight potential drop target ---
    const currentHighlights = [state.draggedObject.id];
    const potentialTargetResult = getObjectAt(mouseX, mouseY); // Gets object excluding buttons
    if (potentialTargetResult) {
        const potentialTarget = findObjectById(potentialTargetResult.id);
        if (potentialTarget && potentialTarget.isDropTarget) {
            // Optional: Add validation logic based on current step if needed
            currentHighlights.push(potentialTarget.id);
        }
    }
    setStateVariable('highlights', currentHighlights);
    drawSimulation(); // Redraw on move
}

function handleMouseUp(e) {
    const wasDragging = getState().isDragging;
    const draggedObjBefore = getState().draggedObject; // Store ref before resetting state

    // Remove dragging state and class immediately
    setStateVariable('isDragging', false);
    labCanvas.classList.remove('lab-canvas--dragging'); // Use BEM class

    const rect = labCanvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    // Check for object/button under mouse *at the point of mouseup*
    const objectUnderMouseResult = getObjectAtMouseDown(mouseX, mouseY);

    // Scenario 1: Click on a button (no dragging involved)
    if (!wasDragging && objectUnderMouseResult?.clickedButton) {
        if (objectUnderMouseResult.type === 'spectrophotometer') {
            console.log(`Button Click: ${objectUnderMouseResult.clickedButton}`);
            if (objectUnderMouseResult.clickedButton === 'zero') actions.tryZeroSpec();
            else if (objectUnderMouseResult.clickedButton === 'measure') actions.tryMeasure();
            else if (objectUnderMouseResult.clickedButton === 'mode') actions.tryToggleMode();
        }
    }
    // Scenario 2: Drop after dragging
    else if (wasDragging && draggedObjBefore) {
        console.log(`Drop: ${draggedObjBefore.id}`);
        const dropTargetResult = getObjectAt(mouseX, mouseY); // Check excludes buttons
        const dropTarget = dropTargetResult ? findObjectById(dropTargetResult.id) : null;

        let stateUpdatedByRemoval = false;
        // Check if cuvette was removed from spec during this drag
        if (draggedObjBefore.type === 'cuvette' && draggedObjBefore.isInSpec) {
            // Removed if dropped outside spec OR onto spec itself (which implies removal first)
            if (!dropTarget || dropTarget.id !== 'spec20') {
                console.log(`Cuvette ${draggedObjBefore.id} removed from spec.`);
                updateLabObject(draggedObjBefore.id, 'isInSpec', false);
                updateSpec20State('cuvetteInsideId', null);
                updateSpec20State('reading', getState().spec20State.absorbanceMode ? "-- Abs" : "-- %T");
                stateUpdatedByRemoval = true;
                saveState(); // Save state *after* removal
            }
        }

        // Process the drop action onto the target
        if (dropTarget) {
            console.log(`Dropped ${draggedObjBefore.id} onto ${dropTarget.id}`);
            if (draggedObjBefore.type === 'pipette') {
                if (draggedObjBefore.currentVolume === 0 && (dropTarget.type === 'bottle' || dropTarget.type === 'testTube')) {
                    actions.tryFillPipette(draggedObjBefore.id, dropTarget.id);
                } else if (draggedObjBefore.currentVolume > 0 && (dropTarget.type === 'testTube' || dropTarget.type === 'cuvette' || dropTarget.type === 'beaker')) {
                    actions.tryDispensePipette(draggedObjBefore.id, dropTarget.id, draggedObjBefore.currentVolume);
                }
            } else if (draggedObjBefore.type === 'cuvette') {
                if (dropTarget.id === 'wasteBeaker') {
                     // Pass the ID, the action function will get the step config internally
                     actions.tryEmptyCuvette(draggedObjBefore.id, dropTarget.id);
                } else if (dropTarget.type === 'spectrophotometer') {
                    if (!stateUpdatedByRemoval) { // Don't re-insert immediately after removal
                        actions.tryInsertCuvette(draggedObjBefore.id, dropTarget.id);
                    } else {
                        showFeedback("Place cuvette elsewhere before re-inserting.", "info");
                    }
                }
            }
        } else {
            console.log(`Dropped ${draggedObjBefore.id} onto empty space.`);
        }
        setStateVariable('draggedObject', null); // Clear dragged object reference
    }
    // Scenario 3: Click on empty space or non-interactive element (no action needed)
    else {
         console.log("MouseUp on empty space or non-actionable element.");
    }


    setStateVariable('highlights', []); // Clear highlights after any mouseup
    updateUI(); // Update UI to reflect final state after action/click
}

function handleUndoClick() {
    const prevState = popHistory(); // Get previous state from history
    if (prevState) {
        restoreState(prevState); // Restore the state variables
        // Feedback is set within restoreState now
        updateUI(); // Update all UI elements based on restored state
        drawGraph(); // Redraw graph based on restored data
    }
    // Update button disabled state based on history stack *after* popping
    if (undoButton) undoButton.disabled = getState().historyStack.length === 0;
}


// --- Initialization ---
export function initInteraction(canvasElement, undoButtonElement, actionFunctions) {
    labCanvas = canvasElement;
    undoButton = undoButtonElement;
    actions = actionFunctions; // Store the passed action functions { tryX: funcX, ... }

    if (!labCanvas || !undoButton) {
        console.error("Interaction module requires canvas and undo button elements.");
        return;
    }

    // Add Listeners
    labCanvas.addEventListener('mousedown', handleMouseDown);
    labCanvas.addEventListener('mousemove', handleMouseMove);
    labCanvas.addEventListener('mouseup', handleMouseUp);
    // Optional: Add touch event listeners here if needed, mapping them to mouse events
    // labCanvas.addEventListener('touchstart', (e) => handleMouseDown(e.touches[0]));
    // labCanvas.addEventListener('touchmove', (e) => { e.preventDefault(); handleMouseMove(e.touches[0]); }); // Prevent scroll
    // labCanvas.addEventListener('touchend', (e) => handleMouseUp(e.changedTouches[0]));

    undoButton.addEventListener('click', handleUndoClick);

    console.log("Interaction listeners initialized.");
}