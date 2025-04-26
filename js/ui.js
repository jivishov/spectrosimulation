// ui.js
import { getState } from './state.js';
import * as config from './config.js';
import instructions from './instructions.js'; // Needs instructions array for step count
import { drawSimulation, drawGraph } from './renderer.js'; // Needs redraw functions

// Store references to DOM elements
let uiElements = {};

export function initUI(elements) {
    uiElements = elements;
    if (!uiElements.instructionEl || !uiElements.feedbackEl || !uiElements.resultsTbody || !uiElements.slopeDisplayEl || !uiElements.unknownResultEl || !uiElements.undoButton) {
        console.error("UI module initialization failed: Missing required DOM elements.");
    }
}

export function showFeedback(message, type = 'info') {
    if (uiElements.feedbackEl) {
        uiElements.feedbackEl.textContent = message;
        uiElements.feedbackEl.className = type;
    } else {
        console.warn("Feedback element not found for message:", message);
    }
    // Also update the state's feedback object for consistency if needed elsewhere
    // import { setStateVariable } from './state.js';
    // setStateVariable('feedback', { message, type });
}


export function updateUI() {
    if (!uiElements.instructionEl) {
        console.error("Cannot update UI: DOM elements not initialized.");
        return;
    }
    try {
        const state = getState(); // Get current state
        const stepConfig = instructions[state.currentStep];
        const totalSteps = instructions.length - 1; // Exclude final message

        // Update Instructions
        if (stepConfig) {
            uiElements.instructionEl.innerHTML = `<b>Step ${state.currentStep + 1} / ${totalSteps}:</b> ${stepConfig.text}`;
        } else {
            const finalStepIndex = instructions.length - 1;
            if (finalStepIndex >= 0 && instructions[finalStepIndex]) {
                uiElements.instructionEl.innerHTML = `<b>${instructions[finalStepIndex].text}</b>`;
            } else {
                uiElements.instructionEl.textContent = "Experiment Complete!";
            }
        }

        // Update Feedback (usually handled by showFeedback, but set here for consistency)
        uiElements.feedbackEl.textContent = state.feedback.message;
        uiElements.feedbackEl.className = state.feedback.type;

        // Update Data Table
        uiElements.resultsTbody.innerHTML = '';
        state.dataTableData.forEach(row => {
            const tr = document.createElement('tr');
            let displayConc = row.conc;
            let displayAbs = row.negLogT;
            if (row.id === 'unknown') {
                if (row.negLogT !== null && config.KNOWN_SLOPE > 0 && isFinite(row.negLogT)) { displayConc = (row.negLogT / config.KNOWN_SLOPE).toFixed(3); displayAbs = parseFloat(row.negLogT).toFixed(4); }
                else if (row.negLogT === Infinity) { displayConc = 'Too High'; displayAbs = `>${config.MAX_ABS.toFixed(1)}`; }
                else { displayConc = 'N/A'; displayAbs = '--'; }
            } else {
                displayConc = (displayConc !== null) ? displayConc.toFixed(3) : '--';
                if(displayAbs === Infinity || displayAbs > 10) displayAbs = `>${config.MAX_ABS.toFixed(1)}`;
                else if(displayAbs !== null) displayAbs = parseFloat(displayAbs).toFixed(4);
                else displayAbs = '--';
            }
            tr.innerHTML = `<td>${row.solution}</td><td>${row.dilution}</td><td>${displayConc}</td><td>${row.measuredPercentT !== null ? row.measuredPercentT : '--'}</td><td>${row.T !== null ? row.T : '--'}</td><td>${displayAbs}</td>`;
            uiElements.resultsTbody.appendChild(tr);
        });

        // Update Slope Display
        const measureCompleteStep = instructions.findIndex(instr => instr.id === 'graph_analysis');
        if (measureCompleteStep > -1 && state.currentStep >= measureCompleteStep) {
            uiElements.slopeDisplayEl.textContent = `Calibration Line Slope (Abs/µM) ≈ ${config.KNOWN_SLOPE}`;
        } else {
            uiElements.slopeDisplayEl.textContent = '';
        }

        // Update Unknown Result Display
        const unknownRow = state.dataTableData.find(r => r.id === 'unknown');
        if (unknownRow && unknownRow.negLogT !== null && config.KNOWN_SLOPE > 0) {
            if (isFinite(unknownRow.negLogT)) {
                const measuredAbs = parseFloat(unknownRow.negLogT); const calculatedConc = (measuredAbs / config.KNOWN_SLOPE);
                uiElements.unknownResultEl.innerHTML = `<b>Unknown Drink Conc. ≈ ${calculatedConc.toFixed(3)} µM</b><br><small><i>Calc: Conc = Abs / Slope = ${measuredAbs.toFixed(4)} / ${config.KNOWN_SLOPE}</i></small>`;
            } else if (unknownRow.negLogT === Infinity) {
                uiElements.unknownResultEl.innerHTML = `<b>Unknown Concentration Too High</b><br><small><i>Absorbance > ${config.MAX_ABS.toFixed(1)}.</i></small>`;
            } else { uiElements.unknownResultEl.textContent = ''; }
        } else { uiElements.unknownResultEl.textContent = ''; }

        // Update Undo Button state
        uiElements.undoButton.disabled = state.historyStack.length === 0;

        // Trigger redraw AFTER state/highlights are updated
        drawSimulation();

    } catch (error) {
        console.error("Error during updateUI:", error);
        showFeedback("An error occurred updating the interface. Check console.", "error");
    }
}