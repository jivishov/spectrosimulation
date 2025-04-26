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
    function getElement(id) {
        const element = document.getElementById(id);
        if (!element) {
            console.error(`FATAL ERROR: Element with ID '${id}' not found! Cannot initialize simulation.`);
            throw new Error(`Element not found: ${id}`);
        }
        return element;
    }

    // --- Initialize Modules ---
    try {
        // Get DOM Elements
        const labCanvas = getElement('lab-canvas');
        const labCtx = labCanvas.getContext('2d');
        const graphCanvas = getElement('graph-canvas');
        const graphCtx = graphCanvas.getContext('2d');
        const instructionEl = getElement('instruction-text');
        const feedbackEl = getElement('feedback-message');
        const resultsTbody = getElement('results-tbody');
        const slopeDisplayEl = getElement('slope-display');
        const unknownResultEl = getElement('unknown-result');
        const undoButton = getElement('undo-button');

        // 1. Initialize State
        // actions.calculateConcentration needs to be available before initializeState
        state.initializeState();

        // 2. Initialize Renderer (Pass contexts)
        renderer.initRenderer(labCtx, graphCtx);

        // 3. Initialize UI (Pass DOM element references)
        ui.initUI({
            instructionEl,
            feedbackEl,
            resultsTbody,
            slopeDisplayEl,
            unknownResultEl,
            undoButton // Pass undoButton for disabling state updates
        });

        // 4. Initialize Interaction (Pass canvas, button, and action functions)
        // Collect action functions needed by interaction module
        const interactionActions = {
            tryZeroSpec: actions.tryZeroSpec,
            tryMeasure: actions.tryMeasure,
            tryToggleMode: actions.tryToggleMode,
            tryFillPipette: actions.tryFillPipette,
            tryDispensePipette: actions.tryDispensePipette,
            tryEmptyCuvette: actions.tryEmptyCuvette,
            tryInsertCuvette: actions.tryInsertCuvette,
            // Undo is handled internally in interaction.js using state functions
        };
        interaction.initInteraction(labCanvas, undoButton, interactionActions);


        // --- Initial Render and State Check ---
        ui.updateUI();      // Initial UI render based on state 0
        renderer.drawGraph(); // Initial graph render (likely empty)
        actions.checkAndProcessInternalStep(undoButton); // Process any initial info/internal steps

        console.log("Initialization complete. Simulation running.");
        ui.showFeedback("Welcome! Follow the instructions.", "info"); // Set initial feedback clearly

    } catch (error) {
        console.error("Error during modular simulation initialization:", error);
        // Attempt to display error message in the UI if possible
        const errorDisplay = document.getElementById('instruction-text') || document.body;
        errorDisplay.innerHTML = `<b style="color: ${config.COLORS.error};">ERROR during simulation initialization. Check console for details.</b>`;
    }
});