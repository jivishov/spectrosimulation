// instructions.js
import { RINSE_VOLUME } from './config.js'; // Use constant for rinse volume consistency

const instructions = [
    // Sample Prep (Steps 0-19)
    { step: 0, text: "Prepare Sample 1 (Stock): Drag Pipette to 'Stock Blue#1' bottle (Fill 10mL).", action: 'fillPipette', pipette: 'pipette', source: 'stockBottle', volume: 10, highlight: ['pipette', 'stockBottle'] },
    { step: 1, text: "Dispense Stock into Tube '10/0'.", action: 'dispensePipette', pipette: 'pipette', destination: 'tube_10_0', volume: 10, highlight: ['pipette', 'tube_10_0'] },
    { step: 2, text: "Prepare Sample 2 (8/2): Fill Pipette with 8mL Stock.", action: 'fillPipette', pipette: 'pipette', source: 'stockBottle', volume: 8, highlight: ['pipette', 'stockBottle'] },
    { step: 3, text: "Dispense 8mL Stock into Tube '8/2'.", action: 'dispensePipette', pipette: 'pipette', destination: 'tube_8_2', volume: 8, highlight: ['pipette', 'tube_8_2'] },
    { step: 4, text: "Fill Pipette with 2mL Water.", action: 'fillPipette', pipette: 'pipette', source: 'waterBottle', volume: 2, highlight: ['pipette', 'waterBottle'] },
    { step: 5, text: "Dispense 2mL Water into Tube '8/2'.", action: 'dispensePipette', pipette: 'pipette', destination: 'tube_8_2', volume: 2, highlight: ['pipette', 'tube_8_2'] },
    { step: 6, text: "Prepare Sample 3 (6/4): Fill Pipette with 6mL Stock.", action: 'fillPipette', pipette: 'pipette', source: 'stockBottle', volume: 6, highlight: ['pipette', 'stockBottle'] },
    { step: 7, text: "Dispense 6mL Stock into Tube '6/4'.", action: 'dispensePipette', pipette: 'pipette', destination: 'tube_6_4', volume: 6, highlight: ['pipette', 'tube_6_4'] },
    { step: 8, text: "Fill Pipette with 4mL Water.", action: 'fillPipette', pipette: 'pipette', source: 'waterBottle', volume: 4, highlight: ['pipette', 'waterBottle'] },
    { step: 9, text: "Dispense 4mL Water into Tube '6/4'.", action: 'dispensePipette', pipette: 'pipette', destination: 'tube_6_4', volume: 4, highlight: ['pipette', 'tube_6_4'] },
    { step: 10, text: "Prepare Sample 4 (4/6): Fill Pipette with 4mL Stock.", action: 'fillPipette', pipette: 'pipette', source: 'stockBottle', volume: 4, highlight: ['pipette', 'stockBottle'] },
    { step: 11, text: "Dispense 4mL Stock into Tube '4/6'.", action: 'dispensePipette', pipette: 'pipette', destination: 'tube_4_6', volume: 4, highlight: ['pipette', 'tube_4_6'] },
    { step: 12, text: "Fill Pipette with 6mL Water.", action: 'fillPipette', pipette: 'pipette', source: 'waterBottle', volume: 6, highlight: ['pipette', 'waterBottle'] },
    { step: 13, text: "Dispense 6mL Water into Tube '4/6'.", action: 'dispensePipette', pipette: 'pipette', destination: 'tube_4_6', volume: 6, highlight: ['pipette', 'tube_4_6'] },
    { step: 14, text: "Prepare Sample 5 (2/8): Fill Pipette with 2mL Stock.", action: 'fillPipette', pipette: 'pipette', source: 'stockBottle', volume: 2, highlight: ['pipette', 'stockBottle'] },
    { step: 15, text: "Dispense 2mL Stock into Tube '2/8'.", action: 'dispensePipette', pipette: 'pipette', destination: 'tube_2_8', volume: 2, highlight: ['pipette', 'tube_2_8'] },
    { step: 16, text: "Fill Pipette with 8mL Water.", action: 'fillPipette', pipette: 'pipette', source: 'waterBottle', volume: 8, highlight: ['pipette', 'waterBottle'] },
    { step: 17, text: "Dispense 8mL Water into Tube '2/8'.", action: 'dispensePipette', pipette: 'pipette', destination: 'tube_2_8', volume: 8, highlight: ['pipette', 'tube_2_8'] },
    { step: 18, text: "Prepare Blank (0/10): Fill Pipette with 10mL Water.", action: 'fillPipette', pipette: 'pipette', source: 'waterBottle', volume: 10, highlight: ['pipette', 'waterBottle'] },
    { step: 19, text: "Dispense 10mL Water into Tube '0/10 (Blank)'.", action: 'dispensePipette', pipette: 'pipette', destination: 'tube_0_10', volume: 10, highlight: ['pipette', 'tube_0_10'] },
    // Zeroing
    { step: 20, text: `Zero Spectrophotometer: Fill Pipette (~${RINSE_VOLUME}mL) from Blank Tube '0/10'.`, action: 'fillPipette', pipette: 'pipette', source: 'tube_0_10', volume: RINSE_VOLUME, highlight: ['pipette', 'tube_0_10'] },
    { step: 21, text: "Dispense Blank into the Cuvette.", action: 'dispensePipette', pipette: 'pipette', destination: 'cuvette', volume: RINSE_VOLUME, highlight: ['pipette', 'cuvette'] },
    { step: 22, text: "Place Cuvette (with Blank) into the Spectrophotometer.", action: 'insertCuvette', cuvette: 'cuvette', destination: 'spec20', allowEmpty: false, allowDirtyInsert: true, highlight: ['cuvette', 'spec20'] }, // Allow insert even if not marked clean yet
    { step: 23, text: "Click the 'Zero' button on the Spectrophotometer.", action: 'zeroSpec', hint:"Click the 'Zero' button.", highlight: ['spec20'] },
    // Empty Blank + Rinse
    { step: 24, text: "Empty the Blank Cuvette: Drag Cuvette from Spec to Waste.", action: 'emptyCuvette', cuvette: 'cuvette', destination: 'wasteBeaker', markClean: false, hint: "Drag cuvette out of Spec first, then drag to Waste.", highlight: ['cuvette', 'wasteBeaker'] },
    { step: 25, text: `Rinse Cuvette 1/3: Fill Pipette with Water (~${RINSE_VOLUME}mL).`, action: 'fillPipette', pipette: 'pipette', source: 'waterBottle', volume: RINSE_VOLUME, highlight: ['pipette', 'waterBottle'] },
    { step: 26, text: "Rinse Cuvette 2/3: Dispense Water into the Cuvette.", action: 'dispensePipette', pipette: 'pipette', destination: 'cuvette', volume: RINSE_VOLUME, highlight: ['pipette', 'cuvette'] },
    { step: 27, text: "Rinse Cuvette 3/3: Empty rinse water into Waste (Drag Cuvette to Waste).", action: 'emptyCuvette', cuvette: 'cuvette', destination: 'wasteBeaker', markClean: true, hint: "Drag cuvette to Waste.", highlight: ['cuvette', 'wasteBeaker'] }, // Mark clean here
    // Measure Sample 1 + Rinse
    { step: 28, text: `Measure Sample 1 (10/0): Fill Pipette (~${RINSE_VOLUME}mL) from Tube '10/0'.`, action: 'fillPipette', pipette: 'pipette', source: 'tube_10_0', volume: RINSE_VOLUME, highlight: ['pipette', 'tube_10_0'] },
    { step: 29, text: "Dispense Sample 1 into the *clean* Cuvette.", action: 'dispensePipette', pipette: 'pipette', destination: 'cuvette', volume: RINSE_VOLUME, highlight: ['pipette', 'cuvette'] },
    { step: 30, text: "Place Cuvette (Sample 1) into Spec.", action: 'insertCuvette', cuvette: 'cuvette', destination: 'spec20', highlight: ['cuvette', 'spec20'] }, // Should pass check now
    { step: 31, text: "Click the 'Measure' button.", action: 'measure', targetDataRowId: 'tube_10_0', highlight: ['spec20'] },
    { step: 32, text: "Empty Sample 1 Cuvette: Drag Cuvette to Waste.", action: 'emptyCuvette', cuvette: 'cuvette', destination: 'wasteBeaker', markClean: false, highlight: ['cuvette', 'wasteBeaker'] }, // Mark dirty
    { step: 33, text: "Rinse Cuvette 1/3: Fill Pipette with Water.", action: 'fillPipette', pipette: 'pipette', source: 'waterBottle', volume: RINSE_VOLUME, highlight: ['pipette', 'waterBottle'] },
    { step: 34, text: "Rinse Cuvette 2/3: Dispense Water into Cuvette.", action: 'dispensePipette', pipette: 'pipette', destination: 'cuvette', volume: RINSE_VOLUME, highlight: ['pipette', 'cuvette'] },
    { step: 35, text: "Rinse Cuvette 3/3: Empty rinse water into Waste.", action: 'emptyCuvette', cuvette: 'cuvette', destination: 'wasteBeaker', markClean: true, highlight: ['cuvette', 'wasteBeaker'] }, // Mark clean
    // ... (Repeat pattern for Samples 2, 3, 4, 5) ...
     // Measure Sample 2 + Rinse
     { step: 36, text: `Measure Sample 2 (8/2): Fill Pipette (~${RINSE_VOLUME}mL) from Tube '8/2'.`, action: 'fillPipette', pipette: 'pipette', source: 'tube_8_2', volume: RINSE_VOLUME, highlight: ['pipette', 'tube_8_2'] },
     { step: 37, text: "Dispense Sample 2 into Cuvette.", action: 'dispensePipette', pipette: 'pipette', destination: 'cuvette', volume: RINSE_VOLUME, highlight: ['pipette', 'cuvette'] },
     { step: 38, text: "Place Cuvette (Sample 2) into Spec.", action: 'insertCuvette', cuvette: 'cuvette', destination: 'spec20', highlight: ['cuvette', 'spec20'] },
     { step: 39, text: "Click 'Measure'.", action: 'measure', targetDataRowId: 'tube_8_2', highlight: ['spec20'] },
     { step: 40, text: "Empty Sample 2 Cuvette: Drag Cuvette to Waste.", action: 'emptyCuvette', cuvette: 'cuvette', destination: 'wasteBeaker', markClean: false, highlight: ['cuvette', 'wasteBeaker'] },
     { step: 41, text: "Rinse Cuvette 1/3: Fill Pipette with Water.", action: 'fillPipette', pipette: 'pipette', source: 'waterBottle', volume: RINSE_VOLUME, highlight: ['pipette', 'waterBottle'] },
     { step: 42, text: "Rinse Cuvette 2/3: Dispense Water into Cuvette.", action: 'dispensePipette', pipette: 'pipette', destination: 'cuvette', volume: RINSE_VOLUME, highlight: ['pipette', 'cuvette'] },
     { step: 43, text: "Rinse Cuvette 3/3: Empty rinse water into Waste.", action: 'emptyCuvette', cuvette: 'cuvette', destination: 'wasteBeaker', markClean: true, highlight: ['cuvette', 'wasteBeaker'] },
     // Measure Sample 3 + Rinse
     { step: 44, text: `Measure Sample 3 (6/4): Fill Pipette (~${RINSE_VOLUME}mL) from Tube '6/4'.`, action: 'fillPipette', pipette: 'pipette', source: 'tube_6_4', volume: RINSE_VOLUME, highlight: ['pipette', 'tube_6_4'] },
     { step: 45, text: "Dispense Sample 3 into Cuvette.", action: 'dispensePipette', pipette: 'pipette', destination: 'cuvette', volume: RINSE_VOLUME, highlight: ['pipette', 'cuvette'] },
     { step: 46, text: "Place Cuvette (Sample 3) into Spec.", action: 'insertCuvette', cuvette: 'cuvette', destination: 'spec20', highlight: ['cuvette', 'spec20'] },
     { step: 47, text: "Click 'Measure'.", action: 'measure', targetDataRowId: 'tube_6_4', highlight: ['spec20'] },
     { step: 48, text: "Empty Sample 3 Cuvette: Drag Cuvette to Waste.", action: 'emptyCuvette', cuvette: 'cuvette', destination: 'wasteBeaker', markClean: false, highlight: ['cuvette', 'wasteBeaker'] },
     { step: 49, text: "Rinse Cuvette 1/3: Fill Pipette with Water.", action: 'fillPipette', pipette: 'pipette', source: 'waterBottle', volume: RINSE_VOLUME, highlight: ['pipette', 'waterBottle'] },
     { step: 50, text: "Rinse Cuvette 2/3: Dispense Water into Cuvette.", action: 'dispensePipette', pipette: 'pipette', destination: 'cuvette', volume: RINSE_VOLUME, highlight: ['pipette', 'cuvette'] },
     { step: 51, text: "Rinse Cuvette 3/3: Empty rinse water into Waste.", action: 'emptyCuvette', cuvette: 'cuvette', destination: 'wasteBeaker', markClean: true, highlight: ['cuvette', 'wasteBeaker'] },
     // Measure Sample 4 + Rinse
     { step: 52, text: `Measure Sample 4 (4/6): Fill Pipette (~${RINSE_VOLUME}mL) from Tube '4/6'.`, action: 'fillPipette', pipette: 'pipette', source: 'tube_4_6', volume: RINSE_VOLUME, highlight: ['pipette', 'tube_4_6'] },
     { step: 53, text: "Dispense Sample 4 into Cuvette.", action: 'dispensePipette', pipette: 'pipette', destination: 'cuvette', volume: RINSE_VOLUME, highlight: ['pipette', 'cuvette'] },
     { step: 54, text: "Place Cuvette (Sample 4) into Spec.", action: 'insertCuvette', cuvette: 'cuvette', destination: 'spec20', highlight: ['cuvette', 'spec20'] },
     { step: 55, text: "Click 'Measure'.", action: 'measure', targetDataRowId: 'tube_4_6', highlight: ['spec20'] },
     { step: 56, text: "Empty Sample 4 Cuvette: Drag Cuvette to Waste.", action: 'emptyCuvette', cuvette: 'cuvette', destination: 'wasteBeaker', markClean: false, highlight: ['cuvette', 'wasteBeaker'] },
     { step: 57, text: "Rinse Cuvette 1/3: Fill Pipette with Water.", action: 'fillPipette', pipette: 'pipette', source: 'waterBottle', volume: RINSE_VOLUME, highlight: ['pipette', 'waterBottle'] },
     { step: 58, text: "Rinse Cuvette 2/3: Dispense Water into Cuvette.", action: 'dispensePipette', pipette: 'pipette', destination: 'cuvette', volume: RINSE_VOLUME, highlight: ['pipette', 'cuvette'] },
     { step: 59, text: "Rinse Cuvette 3/3: Empty rinse water into Waste.", action: 'emptyCuvette', cuvette: 'cuvette', destination: 'wasteBeaker', markClean: true, highlight: ['cuvette', 'wasteBeaker'] },
     // Measure Sample 5 + Rinse
     { step: 60, text: `Measure Sample 5 (2/8): Fill Pipette (~${RINSE_VOLUME}mL) from Tube '2/8'.`, action: 'fillPipette', pipette: 'pipette', source: 'tube_2_8', volume: RINSE_VOLUME, highlight: ['pipette', 'tube_2_8'] },
     { step: 61, text: "Dispense Sample 5 into Cuvette.", action: 'dispensePipette', pipette: 'pipette', destination: 'cuvette', volume: RINSE_VOLUME, highlight: ['pipette', 'cuvette'] },
     { step: 62, text: "Place Cuvette (Sample 5) into Spec.", action: 'insertCuvette', cuvette: 'cuvette', destination: 'spec20', highlight: ['cuvette', 'spec20'] },
     { step: 63, text: "Click 'Measure'.", action: 'measure', targetDataRowId: 'tube_2_8', highlight: ['spec20'] },
     { step: 64, text: "Empty Sample 5 Cuvette: Drag Cuvette to Waste.", action: 'emptyCuvette', cuvette: 'cuvette', destination: 'wasteBeaker', markClean: false, highlight: ['cuvette', 'wasteBeaker'] },
     { step: 65, text: "Rinse Cuvette 1/3: Fill Pipette with Water.", action: 'fillPipette', pipette: 'pipette', source: 'waterBottle', volume: RINSE_VOLUME, highlight: ['pipette', 'waterBottle'] },
     { step: 66, text: "Rinse Cuvette 2/3: Dispense Water into Cuvette.", action: 'dispensePipette', pipette: 'pipette', destination: 'cuvette', volume: RINSE_VOLUME, highlight: ['pipette', 'cuvette'] },
     { step: 67, text: "Rinse Cuvette 3/3: Empty rinse water into Waste.", action: 'emptyCuvette', cuvette: 'cuvette', destination: 'wasteBeaker', markClean: true, highlight: ['cuvette', 'wasteBeaker'] },
    // Measure Blank again + Rinse
    { step: 68, text: `Measure Blank (0/10) again: Fill Pipette (~${RINSE_VOLUME}mL) from Tube '0/10'.`, action: 'fillPipette', pipette: 'pipette', source: 'tube_0_10', volume: RINSE_VOLUME, highlight: ['pipette', 'tube_0_10'] },
    { step: 69, text: "Dispense Blank into Cuvette.", action: 'dispensePipette', pipette: 'pipette', destination: 'cuvette', volume: RINSE_VOLUME, highlight: ['pipette', 'cuvette'] },
    { step: 70, text: "Place Cuvette (Blank) into Spec.", action: 'insertCuvette', cuvette: 'cuvette', destination: 'spec20', allowEmpty: false, allowDirtyInsert: true, highlight: ['cuvette', 'spec20'] },
    { step: 71, text: "Click 'Measure' (Should read ~100%T / ~0 Abs).", action: 'measure', targetDataRowId: 'tube_0_10', allowBlankMeasure: true, highlight: ['spec20'] },
    { step: 72, text: "Empty the Blank Cuvette: Drag Cuvette to Waste.", action: 'emptyCuvette', cuvette: 'cuvette', destination: 'wasteBeaker', markClean: false, highlight: ['cuvette', 'wasteBeaker'] },
    { step: 73, text: "Rinse Cuvette 1/3: Fill Pipette with Water.", action: 'fillPipette', pipette: 'pipette', source: 'waterBottle', volume: RINSE_VOLUME, highlight: ['pipette', 'waterBottle'] },
    { step: 74, text: "Rinse Cuvette 2/3: Dispense Water into Cuvette.", action: 'dispensePipette', pipette: 'pipette', destination: 'cuvette', volume: RINSE_VOLUME, highlight: ['pipette', 'cuvette'] },
    { step: 75, text: "Rinse Cuvette 3/3: Empty rinse water into Waste.", action: 'emptyCuvette', cuvette: 'cuvette', destination: 'wasteBeaker', markClean: true, highlight: ['cuvette', 'wasteBeaker'] },
    // Graph Analysis Info Step
    { step: 76, id: 'graph_analysis', text: "Calibration complete. Observe Data Table & Graph. Note the slope.", action:'info', highlight: ['data-panel', 'graph-panel', 'slope-display'] },
    // Measure Unknown
    { step: 77, text: `Measure Unknown: Fill Pipette (~${RINSE_VOLUME}mL) from 'Unknown Drink'.`, action: 'fillPipette', pipette: 'pipette', source: 'unknownBottle', volume: RINSE_VOLUME, highlight: ['pipette', 'unknownBottle'] },
    { step: 78, text: "Dispense Unknown into the clean Cuvette.", action: 'dispensePipette', pipette: 'pipette', destination: 'cuvette', volume: RINSE_VOLUME, highlight: ['pipette', 'cuvette'] },
    { step: 79, text: "Set Cuvette as Unknown (Internal Step - Auto).", action: 'setUnknownFlag', cuvette: 'cuvette' },
    { step: 80, text: "Place Cuvette (Unknown) into Spec.", action: 'insertCuvette', cuvette: 'cuvette', destination: 'spec20', highlight: ['cuvette', 'spec20'] },
    { step: 81, text: "Click 'Measure' to find the absorbance of the Unknown.", action: 'measure', targetDataRowId: 'unknown', highlight: ['spec20'] },
    // Final Info Steps
    { step: 82, text: "Result recorded. Use Abs and Slope to find concentration.", action:'info', highlight: ['data-panel', 'unknown-result', 'graph-panel'] },
    { step: 83, text: "Experiment Complete! Analysis finished." },
];

export default instructions; // Export the array as the default export