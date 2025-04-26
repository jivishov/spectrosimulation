// actions.js
import { getState, setStateVariable, saveState, findObjectById, updateLabObject, updateDataTableRow, updateSpec20State } from './state.js';
import * as config from './config.js';
import instructions from './instructions.js'; // Import instructions array
import { updateUI, showFeedback } from './ui.js'; // Import UI update functions
import { drawGraph } from './renderer.js'; // Import graph drawing

// --- Helper ---
export function calculateConcentration(stockVol, waterVol) {
    const totalVol = stockVol + waterVol;
    if (totalVol <= 0) return 0;
    return config.STOCK_CONCENTRATION * stockVol / totalVol;
}

function getSimulatedPercentT(concentration) {
    // Using config.TRANSMITTANCE_LOOKUP
    if (concentration === -1) return 39.0;
    const concPoints = Object.keys(config.TRANSMITTANCE_LOOKUP).map(Number).sort((a, b) => a - b);
    if (concentration <= concPoints[0]) return config.TRANSMITTANCE_LOOKUP[concPoints[0]];
    if (concentration >= concPoints[concPoints.length - 1]) return config.TRANSMITTANCE_LOOKUP[concPoints[concPoints.length - 1]];
    let lowerConc = concPoints[0], upperConc = concPoints[1];
    for (let i = 0; i < concPoints.length - 1; i++) {
        if (concentration >= concPoints[i] && concentration <= concPoints[i + 1]) {
            lowerConc = concPoints[i]; upperConc = concPoints[i + 1]; break;
        }
    }
    if (upperConc === lowerConc) return config.TRANSMITTANCE_LOOKUP[lowerConc];
    const lowerT = config.TRANSMITTANCE_LOOKUP[lowerConc]; const upperT = config.TRANSMITTANCE_LOOKUP[upperConc];
    const ratio = (upperConc === lowerConc) ? 0 : (concentration - lowerConc) / (upperConc - lowerConc);
    return lowerT + (upperT - lowerT) * ratio;
}


// --- Internal Step Processor ---
export function checkAndProcessInternalStep(undoButtonElement) {
    const state = getState();
    if (!instructions || state.currentStep < 0 || state.currentStep >= instructions.length) {
        return;
    }
    let stepConfig = instructions[state.currentStep];
    let processedInternal = false;
    while (stepConfig && (stepConfig.action === 'info' || stepConfig.action === 'setUnknownFlag')) {
        processedInternal = true;
        saveState(undoButtonElement); // Pass undo button for disabling
        let internalActionSuccess = true;
        if (stepConfig.action === 'setUnknownFlag') {
            internalActionSuccess = trySetUnknownFlag(stepConfig.cuvette); // Call internal function
        }
        if (internalActionSuccess) {
            setStateVariable('currentStep', state.currentStep + 1); // Use setter
        } else {
            console.error(`Internal action ${stepConfig.action} failed at step ${state.currentStep}. Halting auto-advance.`);
            return;
        }
        stepConfig = (getState().currentStep < instructions.length) ? instructions[getState().currentStep] : null; // Re-fetch state
    }
    if (processedInternal) {
        updateUI(); // Update UI after processing
    }
}

// --- Action Implementations ---
export function tryZeroSpec() {
    const state = getState();
    const stepConfig = instructions[state.currentStep];
    if (!stepConfig?.action || stepConfig.action !== 'zeroSpec') { showFeedback(`Incorrect action. ${stepConfig?.hint || 'Follow instructions.'}`, 'error'); return; }
    const cuvette = state.spec20State.cuvetteInsideId ? findObjectById(state.spec20State.cuvetteInsideId) : null;
    if (!cuvette || Math.abs(cuvette.concentration - 0) > 0.0001) { showFeedback("Cannot zero. Insert Blank (0 µM) cuvette first.", 'error'); return; }
    saveState(document.getElementById('undo-button')); // Needs access to button element
    updateSpec20State('isZeroed', true);
    const units = state.spec20State.absorbanceMode ? " Abs" : " %T";
    updateSpec20State('reading', state.spec20State.absorbanceMode ? "0.000" + units : "100.0" + units);
    setStateVariable('currentStep', state.currentStep + 1);
    showFeedback(`Spectrophotometer zeroed.`, 'success');
    checkAndProcessInternalStep(document.getElementById('undo-button'));
    updateUI();
}

export function tryFillPipette(pipetteId, sourceId) {
    const state = getState();
    const stepConfig = instructions[state.currentStep];
    if (!stepConfig?.action || stepConfig.action !== 'fillPipette' || stepConfig.pipette !== pipetteId || stepConfig.source !== sourceId) { showFeedback(`Incorrect action. ${stepConfig?.hint || 'Follow instructions.'}`, 'error'); return; }
    const pipette = findObjectById(pipetteId);
    const source = findObjectById(sourceId);
    const targetVolume = stepConfig.volume;
    if (!pipette || !source) { showFeedback("Internal error: Pipette or source not found.", 'error'); return; }
    if (pipette.currentVolume > 0) { showFeedback("Pipette must be empty before filling.", 'error'); return; }
    if (source.currentVolume < targetVolume) { showFeedback(`Not enough liquid in ${source.label}. Need ${targetVolume}mL.`, 'error'); return; }
    saveState(document.getElementById('undo-button'));
    updateLabObject(pipetteId, 'currentVolume', targetVolume);
    updateLabObject(pipetteId, 'contentsConcentration', source.concentration);
    updateLabObject(sourceId, 'currentVolume', source.currentVolume - targetVolume);
    setStateVariable('currentStep', state.currentStep + 1);
    showFeedback(`Pipette filled with ${targetVolume}mL from ${source.label}.`, 'success');
    checkAndProcessInternalStep(document.getElementById('undo-button'));
    updateUI();
}

export function tryDispensePipette(pipetteId, destId, volume) {
    const state = getState();
    const stepConfig = instructions[state.currentStep];
    if (!stepConfig?.action || stepConfig.action !== 'dispensePipette' || stepConfig.pipette !== pipetteId || stepConfig.destination !== destId) { showFeedback(`Incorrect action. ${stepConfig?.hint || 'Follow instructions.'}`, 'error'); return; }
    if (stepConfig.volume && Math.abs(volume - stepConfig.volume) > 0.01) { showFeedback(`Incorrect volume dispensed. Expected ${stepConfig.volume}mL.`, 'error'); return; }
    const pipette = findObjectById(pipetteId);
    const dest = findObjectById(destId);
    if (!pipette || !dest) { showFeedback("Internal error: Pipette or destination not found.", 'error'); return; }
    if (pipette.currentVolume < volume - 0.001) { showFeedback("Not enough liquid in pipette.", 'error'); return; }
    if (dest.currentVolume + volume > dest.maxVolume + 0.001) { showFeedback(`${dest.label} will overflow.`, 'error'); return; }
    saveState(document.getElementById('undo-button'));
    const initialDestVol = dest.currentVolume;
    const initialDestConc = dest.concentration;
    const addedVol = volume;
    const addedConc = pipette.contentsConcentration;
    const finalVol = initialDestVol + addedVol;
    let finalConc = 0;
    if (finalVol > 0.001) {
        if (initialDestConc === null || initialDestConc === undefined || initialDestVol < 0.001) { finalConc = addedConc; }
        else if (addedConc === null || addedConc === undefined) { finalConc = initialDestConc; }
        else if (dest.type === 'cuvette' && initialDestConc === 0 && addedConc === 0) { finalConc = 0; }
        else { finalConc = ((initialDestConc * initialDestVol) + (addedConc * addedVol)) / finalVol; }
    }
    updateLabObject(destId, 'currentVolume', finalVol);
    updateLabObject(destId, 'concentration', finalConc);
    // isClean flag is NOT modified here
    updateLabObject(pipetteId, 'currentVolume', pipette.currentVolume - addedVol);
    if (getState().labObjects.find(o => o.id === pipetteId).currentVolume < 0.001) {
         updateLabObject(pipetteId, 'currentVolume', 0);
         updateLabObject(pipetteId, 'contentsConcentration', 0);
    }
    setStateVariable('currentStep', state.currentStep + 1);
    showFeedback(`Dispensed ${volume.toFixed(1)}mL into ${dest.label}.`, 'success');
    checkAndProcessInternalStep(document.getElementById('undo-button'));
    updateUI();
}

// Accept stepConfig directly for checking markClean
export function tryEmptyCuvette(cuvetteId, wasteId) {
    const stepConfig = instructions[getState().currentStep]; // Get config for current step
    if (wasteId !== 'wasteBeaker') { showFeedback("Can only empty into Waste.", 'error'); return; }
    const cuvette = findObjectById(cuvetteId);
    const waste = findObjectById(wasteId);
    if (!cuvette || !waste) { showFeedback("Internal error.", 'error'); return; }
    if (cuvette.isInSpec) { showFeedback("Cannot empty cuvette while inside the Spectrophotometer. Drag it out first.", 'error'); return; }
    if (cuvette.currentVolume <= 0) { showFeedback("Cuvette is already empty.", 'info'); return; }

    let stepCompleted = false;
    if (stepConfig?.action === 'emptyCuvette' && stepConfig.cuvette === cuvetteId && stepConfig.destination === wasteId) {
        stepCompleted = true;
    }

    saveState(document.getElementById('undo-button'));
    updateLabObject(wasteId, 'currentVolume', Math.min(waste.maxVolume, waste.currentVolume + cuvette.currentVolume));
    updateLabObject(cuvetteId, 'currentVolume', 0);
    updateLabObject(cuvetteId, 'concentration', 0);

    // Manage isClean flag based on the STEP config
    if (stepConfig?.markClean === true && stepCompleted) { // Only mark clean if it's the correct step AND configured to do so
         updateLabObject(cuvetteId, 'isClean', true);
         console.log("Marking cuvette clean after emptying rinse (step match).");
    } else {
         updateLabObject(cuvetteId, 'isClean', false);
         console.log("Marking cuvette dirty after emptying sample/intermediate rinse or step mismatch.");
    }

    if (stepCompleted) {
        const isCleanNow = findObjectById(cuvetteId).isClean; // Check updated state
        setStateVariable('currentStep', getState().currentStep + 1);
        showFeedback(`Cuvette emptied into Waste. ${isCleanNow ? 'It is now clean.' : ''} Step complete.`, 'success');
        checkAndProcessInternalStep(document.getElementById('undo-button'));
    } else {
        const isCleanNow = findObjectById(cuvetteId).isClean;
        showFeedback(`Cuvette emptied into Waste. ${isCleanNow ? 'It is now clean.' : ''}`, 'success');
    }
    updateUI();
}


export function tryInsertCuvette(cuvetteId, specId) {
    const state = getState();
    const stepConfig = instructions[state.currentStep];
    if (!stepConfig?.action || stepConfig.action !== 'insertCuvette' || stepConfig.cuvette !== cuvetteId || stepConfig.destination !== specId) { showFeedback(`Incorrect action. ${stepConfig?.hint || 'Follow instructions.'}`, 'error'); return; }
    const cuvette = findObjectById(cuvetteId);
    const spec = findObjectById(specId);
    if (!cuvette || !spec) { showFeedback("Internal error: Cuvette or Spectrophotometer not found.", 'error'); return; }
    if (state.spec20State.cuvetteInsideId) { showFeedback("Spectrophotometer already contains a cuvette.", 'error'); return; }
    if (cuvette.isInSpec) { showFeedback("Cuvette is already in the Spectrophotometer.", 'error'); return; }
    if (cuvette.currentVolume <= 0 && !stepConfig.allowEmpty) { showFeedback("Cannot insert an empty cuvette at this step.", 'error'); return; }

    // Revised Check: Insert fails only if it's NOT clean AND the step doesn't explicitly allow dirty inserts
    if (!cuvette.isClean && !stepConfig.allowDirtyInsert) {
        showFeedback("Cuvette must be rinsed before adding a new sample.", 'error');
        console.log(`Insertion failed: isClean=${cuvette.isClean}, allowDirtyInsert=${stepConfig.allowDirtyInsert}`);
        return;
    }

    saveState(document.getElementById('undo-button'));
    updateLabObject(cuvetteId, 'isInSpec', true);
    updateSpec20State('cuvetteInsideId', cuvetteId);
    updateSpec20State('reading', state.spec20State.absorbanceMode ? "-- Abs" : "-- %T");
    setStateVariable('currentStep', state.currentStep + 1);
    checkAndProcessInternalStep(document.getElementById('undo-button'));
    showFeedback(`Cuvette inserted into Spectrophotometer.`, 'success');
    updateUI();
}

export function tryMeasure() {
    const state = getState();
    const stepConfig = instructions[state.currentStep];
    if (!stepConfig?.action || stepConfig.action !== 'measure') { showFeedback(`Incorrect action. ${stepConfig?.hint || 'Follow instructions.'}`, 'error'); return; }
    if (!state.spec20State.cuvetteInsideId) { showFeedback("Cannot measure. No cuvette in Spectrophotometer.", 'error'); return; }
    if (!state.spec20State.isZeroed) { showFeedback("Cannot measure. Spectrophotometer must be zeroed first.", 'error'); return; }
    const cuvette = findObjectById(state.spec20State.cuvetteInsideId);
    if (!cuvette) { showFeedback("Internal error: Cuvette not found.", 'error'); return; }
    if (Math.abs(cuvette.concentration - 0) < 0.0001 && !stepConfig.allowBlankMeasure) { showFeedback("Cannot measure the blank again at this step.", 'error'); return; }
    const concentration = cuvette.concentration;
    let percentT = getSimulatedPercentT(concentration);
    let absorbance = -Math.log10(percentT / 100);
    if (isNaN(absorbance) || !isFinite(absorbance)) absorbance = Infinity;
    if (absorbance > config.MAX_ABS) { updateSpec20State('reading', state.spec20State.absorbanceMode ? `>${config.MAX_ABS.toFixed(1)} Abs` : "0.0 %T"); showFeedback(`Absorbance too high (> ${config.MAX_ABS.toFixed(1)}) to measure accurately.`, 'error'); updateUI(); return; }
    saveState(document.getElementById('undo-button'));
    if (state.spec20State.absorbanceMode) { updateSpec20State('reading', (absorbance === Infinity || absorbance > 10) ? '>10 Abs' : absorbance.toFixed(3) + " Abs"); }
    else { updateSpec20State('reading', percentT.toFixed(1) + " %T"); }
    let dataRowId = stepConfig.targetDataRowId || 'unknown';
    updateDataTableRow(dataRowId, 'measuredPercentT', percentT.toFixed(1));
    updateDataTableRow(dataRowId, 'T', (percentT / 100).toFixed(3));
    updateDataTableRow(dataRowId, 'negLogT', (absorbance === Infinity || absorbance > 10) ? Infinity : parseFloat(absorbance.toFixed(4)));
    setStateVariable('currentStep', state.currentStep + 1);
    showFeedback(`Measurement complete: ${getState().spec20State.reading}.`, 'success'); // Re-get state for latest reading
    checkAndProcessInternalStep(document.getElementById('undo-button'));
    updateUI();
    drawGraph();
}

export function tryToggleMode() {
    const state = getState();
    const newMode = !state.spec20State.absorbanceMode;
    updateSpec20State('absorbanceMode', newMode);
    let currentReading = state.spec20State.reading;
    if (state.spec20State.cuvetteInsideId && currentReading !== '-- %T' && currentReading !== '-- Abs' && !currentReading.startsWith('>')) {
        const readingParts = currentReading.split(" ");
        const currentValue = parseFloat(readingParts[0]);
        let absorbance, percentT;
        if (!newMode) { // Switched TO %T
            absorbance = currentValue; percentT = Math.pow(10, -absorbance) * 100; updateSpec20State('reading', percentT.toFixed(1) + " %T");
        } else { // Switched TO Abs
            percentT = currentValue; absorbance = -Math.log10(percentT / 100); if (isNaN(absorbance) || !isFinite(absorbance)) absorbance = Infinity; updateSpec20State('reading', (absorbance === Infinity || absorbance > 10) ? '>10 Abs' : absorbance.toFixed(3) + " Abs");
        }
    } else if (state.spec20State.isZeroed && state.spec20State.cuvetteInsideId && findObjectById(state.spec20State.cuvetteInsideId).concentration === 0) {
        updateSpec20State('reading', newMode ? "0.000 Abs" : "100.0 %T");
    } else if (currentReading.startsWith('>')) {
        updateSpec20State('reading', newMode ? `>${config.MAX_ABS.toFixed(1)} Abs` : "0.0 %T");
    } else {
        updateSpec20State('reading', newMode ? "-- Abs" : "-- %T");
    }
    showFeedback(`Display mode changed to: ${newMode ? 'Absorbance' : '%Transmittance'}.`, 'info');
    updateUI();
}

export function trySetUnknownFlag(cuvetteId) {
    const cuvette = findObjectById(cuvetteId);
    if (!cuvette) { console.error("Internal error: Cuvette not found for unknown flag step."); showFeedback("Internal simulation error setting unknown flag.", "error"); return false; }
    updateLabObject(cuvetteId, 'concentration', -1); // Set flag
    return true;
}