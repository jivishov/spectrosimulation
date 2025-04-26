// main.js - Simulation Entry Point and Orchestrator

import * as config from './config.js';
import * as state from './state.js';
import * as renderer from './renderer.js';
import * as interaction from './interaction.js';
import * as actions from './actions.js';
import * as ui from './ui.js';
// Instructions are imported by ui.js and actions.js where needed

document.addEventListener('DOMContentLoaded', () => {
    console.log("DOM Loaded. Initializing simulation modules...");

    // --- Safe Element Selection ---
    // Keep getElementById for elements with unique IDs kept for JS access
    function getElement(id) {
        const element = document.getElementById(id);
        if (!element) {
            console.error(`FATAL ERROR: Element with ID '${id}' not found! Cannot initialize simulation.`);
            throw new Error(`Element not found: ${id}`);
        }
        return element;
    }
    // Use querySelector for elements now identified by class
     function querySelector(selector) {
        const element = document.querySelector(selector);
        if (!element) {
            console.error(`FATAL ERROR: Element with selector '${selector}' not found! Cannot initialize simulation.`);
            throw new Error(`Element not found: ${selector}`);
        }
        return element;
    }


    // --- Initialize Modules ---
    try {
        // Get DOM Elements
        const labCanvas = getElement('lab-canvas'); // Still uses ID
        const labCtx = labCanvas.getContext('2d');
        const graphCanvas = getElement('graph-canvas'); // Still uses ID
        const graphCtx = graphCanvas.getContext('2d');
        const instructionEl = getElement('instruction-text'); // Still uses ID
        const feedbackEl = querySelector('.feedback'); // *** UPDATED: Select by class ***
        const resultsTbody = getElement('results-tbody'); // Still uses ID
        const slopeDisplayEl = getElement('slope-display'); // Still uses ID
        const unknownResultEl = getElement('unknown-result'); // Still uses ID
        const undoButton = getElement('undo-button'); // Still uses ID

        // 1. Initialize State (pass undo button reference for saveState)
        state.initializeState(undoButton);

        // 2. Initialize Renderer (Pass contexts)
        renderer.initRenderer(labCtx, graphCtx);

        // 3. Initialize UI (Pass DOM element references)
        ui.initUI({
            instructionEl,
            feedbackEl, // Pass the selected feedback element
            resultsTbody,
            slopeDisplayEl,
            unknownResultEl,
            undoButton
        });

        // 4. Initialize Interaction (Pass canvas, button, and action functions)
        const interactionActions = {
            tryZeroSpec: actions.tryZeroSpec,
            tryMeasure: actions.tryMeasure,
            tryToggleMode: actions.tryToggleMode,
            tryFillPipette: actions.tryFillPipette,
            tryDispensePipette: actions.tryDispensePipette,
            tryEmptyCuvette: actions.tryEmptyCuvette,
            tryInsertCuvette: actions.tryInsertCuvette,
        };
        interaction.initInteraction(labCanvas, undoButton, interactionActions);


        // --- Initial Render and State Check ---
        ui.updateUI();      // Initial UI render based on state 0
        renderer.drawGraph(); // Initial graph render (likely empty)
        actions.checkAndProcessInternalStep(undoButton); // Process initial info steps, pass button ref

        console.log("Initialization complete. Simulation running.");
        // Use ui.showFeedback to set initial message correctly
        ui.showFeedback("Welcome! Follow the instructions.", "info");

    } catch (error) {
        console.error("Error during modular simulation initialization:", error);
        const errorDisplay = document.getElementById('instruction-text') || document.body;
        errorDisplay.innerHTML = `<b style="color: ${config.COLORS.error};">ERROR during simulation initialization. Check console for details.</b>`;
    }
});