// ui.js
import { getState, setStateVariable } from './state.js'; // Import setStateVariable
import * as config from './config.js';
import instructions from './instructions.js';
import { drawSimulation, drawGraph } from './renderer.js';

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
        // *** UPDATED: Use classList for BEM modifiers ***
        uiElements.feedbackEl.classList.remove('feedback--success', 'feedback--error', 'feedback--info'); // Remove old modifiers
        if (type === 'success') {
            uiElements.feedbackEl.classList.add('feedback--success');
        } else if (type === 'error') {
            uiElements.feedbackEl.classList.add('feedback--error');
        } else {
            uiElements.feedbackEl.classList.add('feedback--info'); // Default to info
        }
    } else {
        console.warn("Feedback element not found for message:", message);
    }
    // Update the state's feedback object
    setStateVariable('feedback', { message, type });
}


export function updateUI() {
    if (!uiElements.instructionEl) {
        console.error("Cannot update UI: DOM elements not initialized.");
        return;
    }
    try {
        const state = getState();
        const stepConfig = instructions[state.currentStep];
        const totalSteps = instructions.length - 1;

        // Update Instructions
        if (stepConfig) {
            uiElements.instructionEl.innerHTML = `<b>Step ${state.currentStep + 1} / ${totalSteps}:</b> ${stepConfig.text}`;
             // Update highlights in state based on instruction config
            setStateVariable('highlights', stepConfig.highlight ? [...stepConfig.highlight] : []);
        } else {
            const finalStepIndex = instructions.length - 1;
            if (finalStepIndex >= 0 && instructions[finalStepIndex]) {
                uiElements.instructionEl.innerHTML = `<b>${instructions[finalStepIndex].text}</b>`;
            } else {
                uiElements.instructionEl.textContent = "Experiment Complete!";
            }
             setStateVariable('highlights', []); // Clear highlights at the end
        }

        // Update Feedback display from state
        showFeedback(state.feedback.message, state.feedback.type);

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
            // *** UPDATED: Add 'data-table__cell' class to each generated TD ***
            tr.innerHTML = `
                <td class="data-table__cell">${row.solution}</td>
                <td class="data-table__cell">${row.dilution}</td>
                <td class="data-table__cell">${displayConc}</td>
                <td class="data-table__cell">${row.measuredPercentT !== null ? row.measuredPercentT : '--'}</td>
                <td class="data-table__cell">${row.T !== null ? row.T : '--'}</td>
                <td class="data-table__cell">${displayAbs}</td>
            `;
            uiElements.resultsTbody.appendChild(tr);
        });

        // Update Slope Display
        const measureCompleteStep = instructions.findIndex(instr => instr.id === 'graph_analysis');
        if (measureCompleteStep > -1 && state.currentStep >= measureCompleteStep) {
            uiElements.slopeDisplayEl.textContent = `Calibration Line Slope (Abs/µM) ≈ ${config.KNOWN_SLOPE}`;
        } else {
            uiElements.slopeDisplayEl.textContent = '';
        }

        // Update Unknown Result Display (code unchanged, logic is fine)
        const unknownRow = state.dataTableData.find(r => r.id === 'unknown');
        if (unknownRow && unknownRow.negLogT !== null && config.KNOWN_SLOPE > 0) {
            if (isFinite(unknownRow.negLogT)) {
                const measuredAbs = parseFloat(unknownRow.negLogT); const calculatedConc = (measuredAbs / config.KNOWN_SLOPE);
                uiElements.unknownResultEl.innerHTML = `<b>Unknown Drink Conc. ≈ ${calculatedConc.toFixed(3)} µM</b><br><small><i>Calc: Conc = Abs / Slope = ${measuredAbs.toFixed(4)} / ${config.KNOWN_SLOPE}</i></small>`;
            } else if (unknownRow.negLogT === Infinity){
                uiElements.unknownResultEl.innerHTML = `<b>Unknown Concentration Too High</b><br><small><i>Absorbance > ${config.MAX_ABS.toFixed(1)}.</i></small>`;
            } else { uiElements.unknownResultEl.textContent = ''; }
        } else { uiElements.unknownResultEl.textContent = ''; }

        // Update Undo Button state
        uiElements.undoButton.disabled = state.historyStack.length === 0;

        // Trigger redraw AFTER state/highlights are updated
        drawSimulation();

    } catch (error) {
        console.error("Error during updateUI:", error);
        // Use the showFeedback function itself to display the error
        showFeedback("An error occurred updating the interface. Check console.", "error");
    }
}