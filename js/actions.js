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
    // Ensure STOCK_CONCENTRATION is treated as a number
    return Number(config.STOCK_CONCENTRATION) * Number(stockVol) / Number(totalVol);
}

function getSimulatedPercentT(concentration) {
    // Using config.TRANSMITTANCE_LOOKUP
    if (concentration === -1) return 39.0; // Handle unknown
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
export function checkAndProcessInternalStep() {
    const state = getState(); // Get initial state for check
    if (!instructions || state.currentStep < 0 || state.currentStep >= instructions.length) {
        return; // No more steps or invalid index
    }

    let currentStepIndex = state.currentStep; // Work with a local index
    let stepConfig = instructions[currentStepIndex];
    let processedInternal = false;

    // Loop while the current step is internal (info or setUnknownFlag)
    while (stepConfig && (stepConfig.action === 'info' || stepConfig.action === 'setUnknownFlag')) {
        processedInternal = true;
        console.log(`Processing internal step ${currentStepIndex}: ${stepConfig.action}`);
        saveState(); // Save state *before* executing the internal action

        let internalActionSuccess = true;
        if (stepConfig.action === 'setUnknownFlag') {
            internalActionSuccess = trySetUnknownFlag(stepConfig.cuvette); // Execute the action
        }
        // Info steps are always "successful"

        if (internalActionSuccess) {
            currentStepIndex++; // Advance the local index
        } else {
            // If an internal action fails (e.g., setUnknownFlag couldn't find cuvette), stop processing
            console.error(`Internal action ${stepConfig.action} failed at step ${currentStepIndex}. Halting auto-advance.`);
            // Consider if state should be rolled back here if saveState was called
            return;
        }

        // Get the next step config based on the potentially advanced index
        stepConfig = (currentStepIndex < instructions.length) ? instructions[currentStepIndex] : null;
    }

    // If any internal steps were processed, update the main state's currentStep
    if (processedInternal) {
        setStateVariable('currentStep', currentStepIndex); // Update the actual state
        console.log("Finished internal steps. New currentStep:", currentStepIndex);
        updateUI(); // Update UI after processing all internal steps in the sequence
    }
}

// --- Action Implementations ---
export function tryZeroSpec() {
    const state = getState();
    const stepConfig = instructions[state.currentStep];
    if (!stepConfig?.action || stepConfig.action !== 'zeroSpec') { showFeedback(`Incorrect action. ${stepConfig?.hint || 'Follow instructions.'}`, 'error'); return; }
    const cuvette = state.spec20State.cuvetteInsideId ? findObjectById(state.spec20State.cuvetteInsideId) : null;
    if (!cuvette || Math.abs(cuvette.concentration - 0) > 0.0001) { showFeedback("Cannot zero. Insert Blank (0 µM) cuvette first.", 'error'); return; }
    saveState();
    updateSpec20State('isZeroed', true);
    const units = state.spec20State.absorbanceMode ? " Abs" : " %T";
    updateSpec20State('reading', state.spec20State.absorbanceMode ? "0.000" + units : "100.0" + units);
    setStateVariable('currentStep', state.currentStep + 1);
    showFeedback(`Spectrophotometer zeroed.`, 'success');
    checkAndProcessInternalStep(); // Check if next step is internal
    updateUI(); // Update UI after potential step advance
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
    saveState();
    updateLabObject(pipetteId, 'currentVolume', targetVolume);
    updateLabObject(pipetteId, 'contentsConcentration', source.concentration);
    updateLabObject(sourceId, 'currentVolume', source.currentVolume - targetVolume);
    setStateVariable('currentStep', state.currentStep + 1);
    showFeedback(`Pipette filled with ${targetVolume}mL from ${source.label}.`, 'success');
    checkAndProcessInternalStep();
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
    saveState();
    const initialDestVol = dest.currentVolume;
    const initialDestConc = dest.concentration;
    const addedVol = volume;
    const addedConc = pipette.contentsConcentration;
    const finalVol = initialDestVol + addedVol;
    let finalConc = 0;
    if (finalVol > 0.001) {
        if (initialDestConc === null || initialDestConc === undefined || initialDestVol < 0.001) { finalConc = addedConc; }
        else if (addedConc === null || addedConc === undefined) { finalConc = initialDestConc; }
        else if (dest.type === 'cuvette' && initialDestConc === 0 && addedConc === 0) { finalConc = 0; } // Water into water
        else { finalConc = ((initialDestConc * initialDestVol) + (addedConc * addedVol)) / finalVol; }
    }
    updateLabObject(destId, 'currentVolume', finalVol);
    updateLabObject(destId, 'concentration', finalConc);
    // Cuvette cleanliness is determined ONLY by emptying, not by dispensing into it.
    updateLabObject(pipetteId, 'currentVolume', pipette.currentVolume - addedVol);
    // Check if pipette is now empty
    const updatedPipette = findObjectById(pipetteId); // Get potentially updated pipette state
    if (updatedPipette.currentVolume < 0.001) {
         updateLabObject(pipetteId, 'currentVolume', 0);
         updateLabObject(pipetteId, 'contentsConcentration', 0);
    }
    setStateVariable('currentStep', state.currentStep + 1);
    showFeedback(`Dispensed ${volume.toFixed(1)}mL into ${dest.label}.`, 'success');
    checkAndProcessInternalStep();
    updateUI();
}

export function tryEmptyCuvette(cuvetteId, wasteId) {
    const state = getState(); // Get current state to find the step config
    const stepConfig = instructions[state.currentStep]; // Config for the step we are currently ON
    if (wasteId !== 'wasteBeaker') { showFeedback("Can only empty into Waste.", 'error'); return; }
    const cuvette = findObjectById(cuvetteId);
    const waste = findObjectById(wasteId);
    if (!cuvette || !waste) { showFeedback("Internal error: Cuvette or Waste not found.", 'error'); return; }
    if (cuvette.isInSpec) { showFeedback("Cannot empty cuvette while inside the Spectrophotometer. Drag it out first.", 'error'); return; }
    if (cuvette.currentVolume <= 0) { showFeedback("Cuvette is already empty.", 'info'); return; }

    let stepCompleted = false;
    // Check if this specific empty action matches the CURRENT instruction step
    if (stepConfig?.action === 'emptyCuvette' && stepConfig.cuvette === cuvetteId && stepConfig.destination === wasteId) {
        stepCompleted = true;
    }

    saveState(); // Save before modifying state
    updateLabObject(wasteId, 'currentVolume', Math.min(waste.maxVolume, waste.currentVolume + cuvette.currentVolume));
    updateLabObject(cuvetteId, 'currentVolume', 0);
    updateLabObject(cuvetteId, 'concentration', 0);

    // Manage isClean flag: ONLY set to true if this is the correct step AND the step has markClean=true
    if (stepCompleted && stepConfig?.markClean === true) {
        updateLabObject(cuvetteId, 'isClean', true);
        console.log(`Marking cuvette ${cuvetteId} clean after emptying (step match).`);
    } else {
        updateLabObject(cuvetteId, 'isClean', false); // Otherwise, it becomes dirty
        console.log(`Marking cuvette ${cuvetteId} dirty after emptying (no step match or no markClean flag).`);
    }

    if (stepCompleted) {
        const isCleanNow = findObjectById(cuvetteId).isClean; // Check updated state
        setStateVariable('currentStep', state.currentStep + 1); // Advance step only if it matched
        showFeedback(`Cuvette emptied into Waste. ${isCleanNow ? 'It is now clean.' : ''} Step complete.`, 'success');
        checkAndProcessInternalStep(); // Check if the NEW step is internal
    } else {
        // Allow emptying outside of specific steps, but don't advance step
        const isCleanNow = findObjectById(cuvetteId).isClean;
        showFeedback(`Cuvette emptied into Waste. ${isCleanNow ? 'It is now clean.' : ''}`, 'success');
    }
    updateUI(); // Update UI regardless
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

    // Check cleanliness: Fail ONLY if cuvette is NOT clean AND step does NOT allow dirty insert
    if (!cuvette.isClean && !stepConfig.allowDirtyInsert) {
        showFeedback("Cuvette must be rinsed before adding a new sample.", 'error');
        console.log(`Insertion failed for ${cuvetteId}: isClean=${cuvette.isClean}, allowDirtyInsert=${stepConfig.allowDirtyInsert}`);
        return;
    }
    console.log(`Insertion allowed for ${cuvetteId}: isClean=${cuvette.isClean}, allowDirtyInsert=${stepConfig.allowDirtyInsert}`);

    saveState();
    updateLabObject(cuvetteId, 'isInSpec', true);
    updateSpec20State('cuvetteInsideId', cuvetteId);
    updateSpec20State('reading', state.spec20State.absorbanceMode ? "-- Abs" : "-- %T");
    // isClean status does not change upon insertion
    setStateVariable('currentStep', state.currentStep + 1);
    showFeedback(`Cuvette inserted into Spectrophotometer.`, 'success');
    checkAndProcessInternalStep();
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
    saveState();
    if (state.spec20State.absorbanceMode) { updateSpec20State('reading', (absorbance === Infinity || absorbance > 10) ? '>10 Abs' : absorbance.toFixed(3) + " Abs"); }
    else { updateSpec20State('reading', percentT.toFixed(1) + " %T"); }
    let dataRowId = stepConfig.targetDataRowId || 'unknown';
    updateDataTableRow(dataRowId, 'measuredPercentT', percentT.toFixed(1));
    updateDataTableRow(dataRowId, 'T', (percentT / 100).toFixed(3));
    updateDataTableRow(dataRowId, 'negLogT', (absorbance === Infinity || absorbance > 10) ? Infinity : parseFloat(absorbance.toFixed(4)));
    setStateVariable('currentStep', state.currentStep + 1);
    // Use getState() again to ensure the feedback message shows the *updated* reading
    showFeedback(`Measurement complete: ${getState().spec20State.reading}.`, 'success');
    checkAndProcessInternalStep();
    updateUI();
    drawGraph(); // Update graph after measurement
}

export function tryToggleMode() {
    const state = getState();
    const newMode = !state.spec20State.absorbanceMode;
    updateSpec20State('absorbanceMode', newMode);
    let currentReading = state.spec20State.reading;
    // Update display based on current value if it's a valid number
    if (state.spec20State.cuvetteInsideId && currentReading !== '-- %T' && currentReading !== '-- Abs' && !currentReading.startsWith('>')) {
        const readingParts = currentReading.split(" ");
        const currentValue = parseFloat(readingParts[0]);
        let absorbance, percentT;
        if (!newMode) { // Switched TO %T mode (currentValue was Abs)
            absorbance = currentValue; percentT = Math.pow(10, -absorbance) * 100; updateSpec20State('reading', percentT.toFixed(1) + " %T");
        } else { // Switched TO Abs mode (currentValue was %T)
            percentT = currentValue; absorbance = -Math.log10(percentT / 100); if (isNaN(absorbance) || !isFinite(absorbance)) absorbance = Infinity; updateSpec20State('reading', (absorbance === Infinity || absorbance > 10) ? '>10 Abs' : absorbance.toFixed(3) + " Abs");
        }
    } else if (state.spec20State.isZeroed && state.spec20State.cuvetteInsideId && findObjectById(state.spec20State.cuvetteInsideId)?.concentration === 0) {
        // If blank is inside and zeroed, show 0/100
        updateSpec20State('reading', newMode ? "0.000 Abs" : "100.0 %T");
    } else if (currentReading.startsWith('>')) {
        // If reading was out of range, update units
        updateSpec20State('reading', newMode ? `>${config.MAX_ABS.toFixed(1)} Abs` : "0.0 %T");
    } else {
        // Otherwise, just show the default placeholder
        updateSpec20State('reading', newMode ? "-- Abs" : "-- %T");
    }
    showFeedback(`Display mode changed to: ${newMode ? 'Absorbance' : '%Transmittance'}.`, 'info');
    updateUI(); // Redraw needed to update spec display
}

export function trySetUnknownFlag(cuvetteId) {
    const cuvette = findObjectById(cuvetteId);
    if (!cuvette) { console.error("Internal error: Cuvette not found for unknown flag step."); showFeedback("Internal simulation error setting unknown flag.", "error"); return false; }
    updateLabObject(cuvetteId, 'concentration', -1); // Set flag using state update function
    console.log(`ACTION: Set concentration flag to -1 for cuvette ${cuvetteId}`);
    return true;
}