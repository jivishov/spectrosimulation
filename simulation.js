// simulation.js

document.addEventListener('DOMContentLoaded', () => {
    console.log("DOM Loaded. Initializing simulation...");

    // --- Safe Element Selection ---
    function getElement(id) { const element = document.getElementById(id); if (!element) { console.error(`FATAL ERROR: Element with ID '${id}' not found!`); throw new Error(`Element not found: ${id}`); } return element; }
    let labCanvas, labCtx, graphCanvas, graphCtx;
    ResultEl, undoButton;
    try { labCanvas = getElement('lab-canvas'); labCtx = labCanvas.getContext('2d'); graphCanvas = getElement('graph-canvas'); graphCtx = graphCanvas.getContext('2d'); instructionEl = getElement('instruction-text'); feedbackEl = getElement('feedback-message'); resultsTbody = getElement('results-tbody'); slopeDisplayEl = getElement('slope-display'); unknownResultEl = getElement('unknown-result'); undoButton = getElement('undo-button'); console.log("Essential DOM elements obtained."); } catch (error) { if(instructionEl) instructionEl.textContent = "ERROR: Failed to load simulation elements. Check console."; return; }

    // --- Constants ---
    const STOCK_CONCENTRATION = 2.31; const TARGET_WAVELENGTH = 630; const KNOWN_SLOPE = 0.1358; const MAX_ABS = 1.5; const COLORS = { water: 'rgba(200, 200, 255, 0.6)', stockBlue: 'rgba(0, 0, 255, 0.8)', glass: '#ddd', label: '#333', pipetteFill: 'rgba(0, 0, 255, 0.5)', error: '#d32f2f', success: '#388e3c', info: '#1976d2', highlight: 'orange', }; const TRANSMITTANCE_LOOKUP = { 0: 100.0, 0.231: 95.0, 0.462: 87.0, 0.693: 81.0, 0.924: 77.0, 1.39: 65.0, 1.85: 58.0, 2.31: 49.0, };

    // --- State Management ---
    let currentStep = 0; let labObjects = []; let dataTableData = []; let spec20State = {}; let historyStack = []; let draggedObject = null; let dragOffsetX = 0, dragOffsetY = 0; let feedback = { message: '', type: 'info' }; let highlights = []; let isDragging = false;

    // --- Core Functions ---
    function initializeState() { /* ... (same as before) ... */ currentStep = 0; feedback = { message: 'Welcome! Follow the instructions.', type: 'info' }; historyStack = []; draggedObject = null; highlights = []; isDragging = false; labObjects = [ { id: 'stockBottle', type: 'bottle', label: 'Stock Blue#1', x: 50, y: 50, width: 50, height: 100, concentration: STOCK_CONCENTRATION, maxVolume: 1000, currentVolume: 1000, isDraggable: false, isDropTarget: true }, { id: 'waterBottle', type: 'bottle', label: 'Distilled H₂O', x: 120, y: 50, width: 50, height: 100, concentration: 0, maxVolume: 1000, currentVolume: 1000, isDraggable: false, isDropTarget: true }, { id: 'pipette', type: 'pipette', label: '10mL Pipette', x: 50, y: 250, width: 10, height: 150, maxVolume: 10, currentVolume: 0, contentsConcentration: 0, isDraggable: true, isDropTarget: false }, { id: 'wasteBeaker', type: 'beaker', label: 'Waste', x: 680, y: 300, width: 80, height: 100, maxVolume: 250, currentVolume: 0, concentration: null, isDraggable: false, isDropTarget: true }, { id: 'spec20', type: 'spectrophotometer', label: 'Spec 20', x: 500, y: 50, width: 250, height: 150, isDraggable: false, isDropTarget: true }, { id: 'cuvette', type: 'cuvette', label: 'Cuvette', x: 200, y: 350, width: 15, height: 50, maxVolume: 4, currentVolume: 0, concentration: 0, isClean: true, isDraggable: true, isDropTarget: true, isInSpec: false }, { id: 'tube_10_0', type: 'testTube', label: '10/0', x: 250, y: 50, width: 25, height: 100, maxVolume: 10, currentVolume: 0, concentration: 0, isDraggable: false, isDropTarget: true }, { id: 'tube_8_2', type: 'testTube', label: '8/2', x: 285, y: 50, width: 25, height: 100, maxVolume: 10, currentVolume: 0, concentration: 0, isDraggable: false, isDropTarget: true }, { id: 'tube_6_4', type: 'testTube', label: '6/4', x: 320, y: 50, width: 25, height: 100, maxVolume: 10, currentVolume: 0, concentration: 0, isDraggable: false, isDropTarget: true }, { id: 'tube_4_6', type: 'testTube', label: '4/6', x: 355, y: 50, width: 25, height: 100, maxVolume: 10, currentVolume: 0, concentration: 0, isDraggable: false, isDropTarget: true }, { id: 'tube_2_8', type: 'testTube', label: '2/8', x: 390, y: 50, width: 25, height: 100, maxVolume: 10, currentVolume: 0, concentration: 0, isDraggable: false, isDropTarget: true }, { id: 'tube_0_10', type: 'testTube', label: '0/10 (Blank)', x: 425, y: 50, width: 25, height: 100, maxVolume: 10, currentVolume: 0, concentration: 0, isDraggable: false, isDropTarget: true }, { id: 'unknownBottle', type: 'bottle', label: 'Unknown Drink', x: 50, y: 180, width: 50, height: 80, concentration: -1, maxVolume: 500, currentVolume: 500, isDraggable: false, isDropTarget: true }, ]; dataTableData = [ { id: 'tube_10_0', solution: '1 (Stock)', dilution: '10 / 0', conc: STOCK_CONCENTRATION, measuredPercentT: null, T: null, negLogT: null }, { id: 'tube_8_2', solution: '2', dilution: '8 / 2', conc: calculateConcentration(8, 2), measuredPercentT: null, T: null, negLogT: null }, { id: 'tube_6_4', solution: '3', dilution: '6 / 4', conc: calculateConcentration(6, 4), measuredPercentT: null, T: null, negLogT: null }, { id: 'tube_4_6', solution: '4', dilution: '4 / 6', conc: calculateConcentration(4, 6), measuredPercentT: null, T: null, negLogT: null }, { id: 'tube_2_8', solution: '5', dilution: '2 / 8', conc: calculateConcentration(2, 8), measuredPercentT: null, T: null, negLogT: null }, { id: 'tube_0_10', solution: '6 (Blank)', dilution: '0 / 10', conc: 0, measuredPercentT: null, T: null, negLogT: null }, { id: 'unknown', solution: 'Unknown Drink', dilution: 'N/A', conc: null, measuredPercentT: null, T: null, negLogT: null }, ]; spec20State = { cuvetteInsideId: null, reading: "-- %T", wavelength: TARGET_WAVELENGTH, isZeroed: false, absorbanceMode: false, zeroButtonPos: { x: 510, y: 160, width: 50, height: 25 }, measureButtonPos: { x: 570, y: 160, width: 60, height: 25 }, modeButtonPos: { x: 640, y: 160, width: 50, height: 25 } }; console.log("State initialized."); }
    function calculateConcentration(stockVol, waterVol) { if (stockVol + waterVol <= 0) return 0; return STOCK_CONCENTRATION * stockVol / (stockVol + waterVol); }
    function cloneState() { return JSON.parse(JSON.stringify({ currentStep, labObjects, dataTableData, spec20State })); }
    function restoreState(state) { currentStep = state.currentStep; labObjects = state.labObjects; dataTableData = state.dataTableData; spec20State = state.spec20State; highlights = []; }
    function findObjectById(id) { return labObjects.find(obj => obj.id === id); }
    function saveState() { if (historyStack.length > 20) { historyStack.shift(); } historyStack.push(cloneState()); undoButton.disabled = false; }
    function showFeedback(message, type = 'info') { feedback = { message, type }; if(feedbackEl) {feedbackEl.textContent = message; feedbackEl.className = type;} else {console.warn("Feedback element not found");} }
    function getSimulatedPercentT(concentration) { if (concentration === -1) return 39.0; const concPoints = Object.keys(TRANSMITTANCE_LOOKUP).map(Number).sort((a, b) => a - b); if (concentration <= concPoints[0]) return TRANSMITTANCE_LOOKUP[concPoints[0]]; if (concentration >= concPoints[concPoints.length - 1]) return TRANSMITTANCE_LOOKUP[concPoints[concPoints.length - 1]]; let lowerConc = concPoints[0], upperConc = concPoints[1]; for (let i = 0; i < concPoints.length - 1; i++) { if (concentration >= concPoints[i] && concentration <= concPoints[i + 1]) { lowerConc = concPoints[i]; upperConc = concPoints[i + 1]; break; } } if (upperConc === lowerConc) return TRANSMITTANCE_LOOKUP[lowerConc]; const lowerT = TRANSMITTANCE_LOOKUP[lowerConc]; const upperT = TRANSMITTANCE_LOOKUP[upperConc]; const ratio = (upperConc === lowerConc) ? 0 : (concentration - lowerConc) / (upperConc - lowerConc); return lowerT + (upperT - lowerT) * ratio; }
    function getLiquidColor(concentration) { if (concentration === null || concentration === undefined) return 'rgba(128,128,128,0.5)'; if (concentration <= 0) return COLORS.water; if (concentration === -1) return 'rgba(100, 0, 200, 0.7)'; const ratio = Math.min(concentration / STOCK_CONCENTRATION, 1); const blueIntensity = Math.floor(100 + 155 * ratio); const alpha = 0.6 + 0.2 * ratio; return `rgba(0, 0, ${blueIntensity}, ${alpha})`; }

    // --- Drawing Functions ---
    // (Assumed correct - include all draw functions here)
    function drawSimulation() { if (!labCtx) return; labCtx.clearRect(0, 0, labCanvas.width, labCanvas.height); labObjects.forEach(obj => { const isHighlighted = highlights.includes(obj.id); if (obj.type === 'bottle') drawBottle(obj, isHighlighted); else if (obj.type === 'testTube') drawTestTube(obj, isHighlighted); else if (obj.type === 'pipette') drawPipette(obj, isHighlighted); else if (obj.type === 'beaker') drawBeaker(obj, isHighlighted); else if (obj.type === 'spectrophotometer') drawSpectrophotometer(obj, isHighlighted); else if (obj.type === 'cuvette') drawCuvette(obj, isHighlighted); }); if (draggedObject) { const isDraggedHighlighted = highlights.includes(draggedObject.id); if (draggedObject.type === 'pipette') drawPipette(draggedObject, isDraggedHighlighted); else if (draggedObject.type === 'cuvette') drawCuvette(draggedObject, isDraggedHighlighted); } }
    function drawBottle(obj, isHighlighted) { labCtx.save(); labCtx.fillStyle = COLORS.glass; labCtx.fillRect(obj.x, obj.y, obj.width, obj.height); labCtx.strokeRect(obj.x, obj.y, obj.width, obj.height); labCtx.fillRect(obj.x + obj.width * 0.3, obj.y - obj.height * 0.1, obj.width * 0.4, obj.height * 0.1); labCtx.strokeRect(obj.x + obj.width * 0.3, obj.y - obj.height * 0.1, obj.width * 0.4, obj.height * 0.1); const liquidHeight = obj.height * (obj.currentVolume / obj.maxVolume) * 0.95; labCtx.fillStyle = getLiquidColor(obj.concentration); labCtx.fillRect(obj.x + 2, obj.y + obj.height - liquidHeight, obj.width - 4, liquidHeight); labCtx.fillStyle = COLORS.label; labCtx.textAlign = 'center'; labCtx.font = '10px sans-serif'; labCtx.fillText(obj.label, obj.x + obj.width / 2, obj.y + obj.height + 12); if (isHighlighted) highlightObjectBorder(obj); labCtx.restore(); }
    function drawTestTube(obj, isHighlighted) { labCtx.save(); labCtx.strokeStyle = '#555'; labCtx.fillStyle = 'rgba(230, 230, 230, 0.5)'; labCtx.fillRect(obj.x, obj.y, obj.width, obj.height); labCtx.strokeRect(obj.x, obj.y, obj.width, obj.height); labCtx.beginPath(); labCtx.arc(obj.x + obj.width / 2, obj.y + obj.height, obj.width / 2, 0, Math.PI); labCtx.stroke(); labCtx.fill(); if (obj.currentVolume > 0) { const liquidLevel = obj.height * (obj.currentVolume / obj.maxVolume); const liquidY = obj.y + obj.height - liquidLevel; labCtx.fillStyle = getLiquidColor(obj.concentration); const fillHeight = liquidLevel - (obj.width/4); if (fillHeight > 0) { labCtx.fillRect(obj.x + 1, liquidY + (obj.width/4), obj.width - 2, fillHeight); } labCtx.beginPath(); const bottomArcAmount = Math.min(liquidLevel, obj.width / 2); if (obj.width > 0) { try { const angle = Math.acos(Math.max(-1, Math.min(1, 1 - 2 * bottomArcAmount / obj.width))); const startAngle = Math.PI + angle; const endAngle = 2 * Math.PI - angle; if (!isNaN(startAngle) && !isNaN(endAngle)) labCtx.arc(obj.x + obj.width / 2, obj.y + obj.height, obj.width / 2, startAngle, endAngle); } catch(e) {console.error("Error drawing test tube arc", e)} } labCtx.fill(); } labCtx.fillStyle = COLORS.label; labCtx.textAlign = 'center'; labCtx.font = '10px sans-serif'; labCtx.fillText(obj.label, obj.x + obj.width / 2, obj.y + obj.height + 15 + obj.width/2); if (isHighlighted) highlightObjectBorder(obj); labCtx.restore(); }
    function drawPipette(obj, isHighlighted) { labCtx.save(); labCtx.strokeStyle = '#333'; labCtx.lineWidth = 1; labCtx.beginPath(); labCtx.arc(obj.x + obj.width / 2, obj.y + 15, 15, 0, 2 * Math.PI); labCtx.stroke(); labCtx.strokeRect(obj.x, obj.y + 30, obj.width, obj.height); labCtx.beginPath(); labCtx.moveTo(obj.x, obj.y + 30 + obj.height); labCtx.lineTo(obj.x + obj.width / 2, obj.y + 30 + obj.height + 15); labCtx.lineTo(obj.x + obj.width, obj.y + 30 + obj.height); labCtx.stroke(); if (obj.currentVolume > 0) { const liquidHeight = obj.height * (obj.currentVolume / obj.maxVolume); const liquidY = obj.y + 30 + obj.height - liquidHeight; const color = getLiquidColor(obj.contentsConcentration); labCtx.fillStyle = color; labCtx.fillRect(obj.x + 1, liquidY, obj.width - 2, liquidHeight); if(liquidHeight > 0) { labCtx.beginPath(); labCtx.moveTo(obj.x+1, obj.y + 30 + obj.height); labCtx.lineTo(obj.x + obj.width / 2, obj.y + 30 + obj.height + 15); labCtx.lineTo(obj.x + obj.width-1, obj.y + 30 + obj.height); labCtx.closePath(); labCtx.fill(); } } if (isHighlighted) highlightObjectBorder(obj, 0, 0, obj.width, obj.height + 45); labCtx.restore(); }
    function drawBeaker(obj, isHighlighted) { labCtx.save(); labCtx.strokeStyle = '#555'; labCtx.lineWidth = 1; labCtx.beginPath(); labCtx.moveTo(obj.x, obj.y); labCtx.lineTo(obj.x + obj.width * 0.1, obj.y + obj.height); labCtx.lineTo(obj.x + obj.width * 0.9, obj.y + obj.height); labCtx.lineTo(obj.x + obj.width, obj.y); labCtx.lineTo(obj.x + obj.width * 1.05, obj.y - obj.height * 0.05); labCtx.lineTo(obj.x - obj.width * 0.05, obj.y - obj.height * 0.05); labCtx.closePath(); labCtx.stroke(); if (obj.currentVolume > 0) { const liquidLevelRatio = Math.min(1, obj.currentVolume / obj.maxVolume); const liquidHeight = obj.height * liquidLevelRatio; const topWidth = obj.width; const bottomWidth = obj.width * 0.8; const currentTopWidth = bottomWidth + (topWidth - bottomWidth) * liquidLevelRatio; const currentY = obj.y + obj.height - liquidHeight; const currentX = obj.x + (obj.width - currentTopWidth) / 2; labCtx.fillStyle = 'rgba(150, 150, 100, 0.5)'; labCtx.beginPath(); labCtx.moveTo(currentX, currentY); labCtx.lineTo(obj.x + obj.width * 0.1, obj.y + obj.height); labCtx.lineTo(obj.x + obj.width * 0.9, obj.y + obj.height); labCtx.lineTo(currentX + currentTopWidth, currentY); labCtx.closePath(); labCtx.fill(); } labCtx.fillStyle = COLORS.label; labCtx.textAlign = 'center'; labCtx.font = '12px sans-serif'; labCtx.fillText(obj.label, obj.x + obj.width / 2, obj.y + obj.height + 15); if (isHighlighted) highlightObjectBorder(obj); labCtx.restore(); }
    function drawSpectrophotometer(obj, isHighlighted) { labCtx.save(); labCtx.fillStyle = '#B0BEC5'; labCtx.fillRect(obj.x, obj.y, obj.width, obj.height); labCtx.strokeStyle = '#546E7A'; labCtx.strokeRect(obj.x, obj.y, obj.width, obj.height); const displayX = obj.x + 20; const displayY = obj.y + 20; const displayWidth = obj.width * 0.6; const displayHeight = obj.height * 0.4; labCtx.fillStyle = '#263238'; labCtx.fillRect(displayX, displayY, displayWidth, displayHeight); labCtx.fillStyle = '#B2FF59'; labCtx.font = 'bold 20px monospace'; labCtx.textAlign = 'right'; labCtx.fillText(spec20State.reading, displayX + displayWidth - 10, displayY + displayHeight / 2 + 8); labCtx.fillStyle = '#76FF03'; labCtx.font = '10px monospace'; labCtx.textAlign = 'left'; const modeText = spec20State.absorbanceMode ? 'Abs' : '%T'; labCtx.fillText(`${modeText} @ ${spec20State.wavelength}nm`, displayX + 5, displayY + displayHeight - 5); const slotX = obj.x + obj.width * 0.8; const slotY = obj.y + 15; const slotWidth = 30; const slotHeight = 60; labCtx.fillStyle = '#455A64'; labCtx.fillRect(slotX, slotY, slotWidth, slotHeight); labCtx.strokeRect(slotX, slotY, slotWidth, slotHeight); labCtx.fillStyle = '#78909C'; labCtx.textAlign = 'center'; labCtx.font = '9px sans-serif'; labCtx.fillText("Cuvette", slotX + slotWidth/2, slotY + slotHeight + 10); if (spec20State.cuvetteInsideId) { const cuvette = findObjectById(spec20State.cuvetteInsideId); if (cuvette) { const cuvetteDrawX = slotX + (slotWidth - cuvette.width) / 2; const cuvetteDrawY = slotY + 5; drawCuvette({ ...cuvette, x: cuvetteDrawX, y: cuvetteDrawY, isInSpec: true }, false); } } labCtx.fillStyle = '#78909C'; labCtx.strokeStyle = '#37474F'; const zb = spec20State.zeroButtonPos; labCtx.fillRect(zb.x, zb.y, zb.width, zb.height); labCtx.strokeRect(zb.x, zb.y, zb.width, zb.height); labCtx.fillStyle = '#FFF'; labCtx.font = 'bold 12px sans-serif'; labCtx.textAlign = 'center'; labCtx.fillText("Zero", zb.x + zb.width / 2, zb.y + zb.height / 2 + 4); const mb = spec20State.measureButtonPos; labCtx.fillStyle = '#78909C'; labCtx.fillRect(mb.x, mb.y, mb.width, mb.height); labCtx.strokeRect(mb.x, mb.y, mb.width, mb.height); labCtx.fillStyle = '#FFF'; labCtx.fillText("Measure", mb.x + mb.width / 2, mb.y + mb.height / 2 + 4); const modeB = spec20State.modeButtonPos; labCtx.fillStyle = '#78909C'; labCtx.fillRect(modeB.x, modeB.y, modeB.width, modeB.height); labCtx.strokeRect(modeB.x, modeB.y, modeB.width, modeB.height); labCtx.fillStyle = '#FFF'; labCtx.fillText(spec20State.absorbanceMode ? "%T" : "Abs", modeB.x + modeB.width / 2, modeB.y + modeB.height / 2 + 4); if (isHighlighted) highlightObjectBorder(obj); labCtx.restore(); }
    function drawCuvette(obj, isHighlighted) { if (obj.isInSpec && !isHighlighted) { return; } labCtx.save(); labCtx.fillStyle = obj.isClean ? 'rgba(240, 240, 240, 0.7)' : 'rgba(220, 220, 200, 0.7)'; labCtx.strokeStyle = '#666'; labCtx.lineWidth = 1; labCtx.fillRect(obj.x, obj.y, obj.width, obj.height); labCtx.strokeRect(obj.x, obj.y, obj.width, obj.height); if (obj.currentVolume > 0) { const liquidHeight = obj.height * (obj.currentVolume / obj.maxVolume) * 0.9; const liquidY = obj.y + obj.height - liquidHeight; labCtx.fillStyle = getLiquidColor(obj.concentration); labCtx.fillRect(obj.x + 1, liquidY, obj.width - 2, liquidHeight); } if (isHighlighted) highlightObjectBorder(obj); labCtx.restore(); }
    function highlightObjectBorder(obj, xOffset = 0, yOffset = 0, highlightWidth = obj.width, highlightHeight = obj.height) { labCtx.save(); labCtx.strokeStyle = COLORS.highlight; labCtx.lineWidth = 3; labCtx.setLineDash([5, 3]); labCtx.strokeRect(obj.x + xOffset - 2, obj.y + yOffset - 2, highlightWidth + 4, highlightHeight + 4); labCtx.setLineDash([]); labCtx.lineWidth = 1; labCtx.restore(); }
      // --- Graphing Functions ---
    function drawGraph() {
        if (!graphCtx) return; // Ensure context exists
        graphCtx.clearRect(0, 0, graphCanvas.width, graphCanvas.height);

        // Filter known data with valid absorbance for plotting
        const plotData = dataTableData.filter(d => d.conc !== null && d.id !== 'unknown' && d.negLogT !== null && isFinite(d.negLogT));

        const padding = { top: 20, right: 20, bottom: 40, left: 50 };
        const plotWidth = graphCanvas.width - padding.left - padding.right;
        const plotHeight = graphCanvas.height - padding.top - padding.bottom;

        // Determine axis ranges (include stock concentration and potential unknown)
        const allConcValues = plotData.map(d => d.conc);
        const unknownRow = dataTableData.find(r => r.id === 'unknown');
        let calculatedUnknownConc = null;
        if (unknownRow && unknownRow.negLogT !== null && KNOWN_SLOPE > 0 && isFinite(unknownRow.negLogT)) {
             calculatedUnknownConc = unknownRow.negLogT / KNOWN_SLOPE;
             allConcValues.push(calculatedUnknownConc); // Include for axis scaling
        }
         allConcValues.push(STOCK_CONCENTRATION); // Ensure stock is included for range

        const allAbsValues = plotData.map(d => d.negLogT);
         if (unknownRow && unknownRow.negLogT !== null && isFinite(unknownRow.negLogT)) {
             allAbsValues.push(unknownRow.negLogT); // Include unknown Abs for range
         }
        allAbsValues.push(0.5); // Ensure some minimum height

        const maxConc = Math.max(...allConcValues) * 1.1 || 1;
        const maxAbs = Math.max(...allAbsValues) * 1.1 || 1;

        // Scaling functions
        const scaleX = (conc) => padding.left + (conc / maxConc) * plotWidth;
        const scaleY = (abs) => padding.top + plotHeight - (abs / maxAbs) * plotHeight;

        // Draw Axes
        graphCtx.strokeStyle = '#333';
        graphCtx.lineWidth = 1;
        graphCtx.beginPath();
        graphCtx.moveTo(padding.left, padding.top);
        graphCtx.lineTo(padding.left, padding.top + plotHeight); // Y-axis
        graphCtx.lineTo(padding.left + plotWidth, padding.top + plotHeight); // X-axis
        graphCtx.stroke();

        // Draw Labels and Ticks
        graphCtx.fillStyle = '#333';
        graphCtx.textAlign = 'center';
        graphCtx.font = '10px sans-serif';
        graphCtx.fillText("Concentration (µM)", padding.left + plotWidth / 2, graphCanvas.height - 5);
        graphCtx.save();
        graphCtx.translate(15, padding.top + plotHeight / 2);
        graphCtx.rotate(-Math.PI / 2);
        graphCtx.fillText("Absorbance (-log T)", 0, 0);
        graphCtx.restore();

        // Y-axis ticks
        graphCtx.textAlign = 'right';
        for (let i = 0; i <= 5; i++) {
            const absValue = (maxAbs / 5) * i;
            const y = scaleY(absValue);
            graphCtx.moveTo(padding.left - 5, y);
            graphCtx.lineTo(padding.left, y);
            graphCtx.fillText(absValue.toFixed(2), padding.left - 8, y + 3);
        }
        // X-axis ticks
        graphCtx.textAlign = 'center';
         for (let i = 0; i <= 5; i++) {
            const concValue = (maxConc / 5) * i;
            const x = scaleX(concValue);
            graphCtx.moveTo(x, padding.top + plotHeight);
            graphCtx.lineTo(x, padding.top + plotHeight + 5);
            graphCtx.fillText(concValue.toFixed(2), x, padding.top + plotHeight + 15);
        }
        graphCtx.stroke();


        // Plot Known Data Points (Blue)
        graphCtx.fillStyle = 'blue';
        plotData.forEach(d => {
            graphCtx.beginPath();
            graphCtx.arc(scaleX(d.conc), scaleY(d.negLogT), 3, 0, 2 * Math.PI);
            graphCtx.fill();
        });

        // Draw Best Fit Line (Red)
        if (plotData.length > 0 && KNOWN_SLOPE) { // Check if there's data to draw line for
            graphCtx.strokeStyle = 'red';
            graphCtx.lineWidth = 1.5;
            graphCtx.beginPath();
            graphCtx.moveTo(scaleX(0), scaleY(0)); // Line should pass through origin
            const endConc = maxConc;
            const endAbs = KNOWN_SLOPE * endConc;
             if (endAbs <= maxAbs * 1.05) { // Extend slightly beyond maxAbs if needed
                graphCtx.lineTo(scaleX(endConc), scaleY(endAbs));
             } else {
                 const boundedConc = maxAbs / KNOWN_SLOPE;
                 if (isFinite(boundedConc)) graphCtx.lineTo(scaleX(boundedConc), scaleY(maxAbs));
             }
            graphCtx.stroke();
        }

        // *** NEW: Plot Unknown Point (Green) ***
        if (calculatedUnknownConc !== null && unknownRow && unknownRow.negLogT !== null && isFinite(unknownRow.negLogT)) {
            const unknownX = scaleX(calculatedUnknownConc);
            const unknownY = scaleY(unknownRow.negLogT);

            // Draw the point
            graphCtx.fillStyle = 'green';
            graphCtx.beginPath();
            graphCtx.arc(unknownX, unknownY, 4, 0, 2 * Math.PI); // Slightly larger point
            graphCtx.fill();

            // Optional: Draw dashed lines to axes
            graphCtx.strokeStyle = 'rgba(0, 128, 0, 0.5)'; // Light green dashed
            graphCtx.lineWidth = 1;
            graphCtx.setLineDash([3, 3]);

            // Line to Y-axis (Absorbance)
            graphCtx.beginPath();
            graphCtx.moveTo(padding.left, unknownY);
            graphCtx.lineTo(unknownX, unknownY);
            graphCtx.stroke();

            // Line to X-axis (Concentration)
            graphCtx.beginPath();
            graphCtx.moveTo(unknownX, unknownY);
            graphCtx.lineTo(unknownX, padding.top + plotHeight);
            graphCtx.stroke();

            graphCtx.setLineDash([]); // Reset dash pattern
        }

        // Display message if no data yet
        if (plotData.length === 0 && calculatedUnknownConc === null) {
            graphCtx.fillStyle = '#777';
            graphCtx.textAlign = 'center';
            graphCtx.fillText("Graph will appear here", graphCanvas.width/2, graphCanvas.height/2);
        }
    }


    // --- Interaction Logic ---
    function isPointOverObject(x, y, obj) { /* (Same as previous version) */ let hit = x >= obj.x && x <= obj.x + obj.width && y >= obj.y && y <= obj.y + obj.height; if (!hit && obj.type === 'pipette') { const bulbX = obj.x + obj.width / 2; const bulbY = obj.y + 15; const bulbRadius = 15; const tipYEnd = obj.y + 30 + obj.height + 15; const dxBulb = x - bulbX; const dyBulb = y - bulbY; if (dxBulb * dxBulb + dyBulb * dyBulb <= bulbRadius * bulbRadius) { hit = true; } else if (y > obj.y + 30 + obj.height && y < tipYEnd) { if (x >= obj.x && x <= obj.x + obj.width && y >= (obj.y + 30 + obj.height) && y <= tipYEnd) { hit = true; } } } if (hit && obj.type === 'spectrophotometer') { if (isPointInRect(x, y, spec20State.zeroButtonPos)) return { ...obj, clickedButton: 'zero' }; if (isPointInRect(x, y, spec20State.measureButtonPos)) return { ...obj, clickedButton: 'measure' }; if (isPointInRect(x, y, spec20State.modeButtonPos)) return { ...obj, clickedButton: 'mode' }; return obj; } return hit ? obj : null; }
    function getObjectAt(x, y) { /* (Same as previous version) */ for (let i = labObjects.length - 1; i >= 0; i--) { const obj = labObjects[i]; if (obj === draggedObject) continue; const hitResult = isPointOverObject(x, y, obj); if (hitResult) return hitResult; } return null; }
    function getObjectAtMouseDown(x, y) { /* (Same as previous version) */ for (let i = labObjects.length - 1; i >= 0; i--) { const obj = labObjects[i]; const hitResult = isPointOverObject(x, y, obj); if (hitResult) return hitResult; } return null; }
    function isPointInRect(x, y, rect) { /* (Same as previous version) */ return x >= rect.x && x <= rect.x + rect.width && y >= rect.y && y <= rect.y + rect.height; }

    labCanvas.addEventListener('mousedown', (e) => { /* (Same as previous version) */ if (!labCanvas) return; const rect = labCanvas.getBoundingClientRect(); const mouseX = e.clientX - rect.left; const mouseY = e.clientY - rect.top; const clickedObjectResult = getObjectAtMouseDown(mouseX, mouseY); isDragging = false; draggedObject = null; if (clickedObjectResult?.clickedButton) { console.log("Mousedown on button, click handled in mouseup."); return; } const clickedObject = clickedObjectResult; if (clickedObject && clickedObject.isDraggable) { draggedObject = findObjectById(clickedObject.id); if (!draggedObject) { console.error("Failed to find draggable object ref:", clickedObject.id); return; } isDragging = true; dragOffsetX = mouseX - draggedObject.x; dragOffsetY = mouseY - draggedObject.y; labObjects = labObjects.filter(obj => obj.id !== draggedObject.id); labObjects.push(draggedObject); highlights = [draggedObject.id]; labCanvas.classList.add('dragging'); drawSimulation(); } });
    labCanvas.addEventListener('mousemove', (e) => { /* (Same as previous version) */ if (!isDragging || !draggedObject) return; const rect = labCanvas.getBoundingClientRect(); const mouseX = e.clientX - rect.left; const mouseY = e.clientY - rect.top; const objWidth = draggedObject.width || 20; const objHeight = (draggedObject.type === 'pipette') ? draggedObject.height + 45 : (draggedObject.height || 50); draggedObject.x = Math.max(0, Math.min(labCanvas.width - objWidth, mouseX - dragOffsetX)); draggedObject.y = Math.max(0, Math.min(labCanvas.height - objHeight, mouseY - dragOffsetY)); highlights = []; const potentialTargetResult = getObjectAt(mouseX, mouseY); const potentialTarget = potentialTargetResult && !potentialTargetResult.clickedButton ? findObjectById(potentialTargetResult.id) : null; let isValidTarget = false; if (potentialTarget && potentialTarget.isDropTarget) { const stepConfig = instructions[currentStep]; if (stepConfig?.action) { if (draggedObject.type === 'pipette') { if (draggedObject.currentVolume === 0 && stepConfig.action === 'fillPipette' && stepConfig.source === potentialTarget.id) isValidTarget = true; else if (draggedObject.currentVolume > 0 && stepConfig.action === 'dispensePipette' && stepConfig.destination === potentialTarget.id) isValidTarget = true; } else if (draggedObject.type === 'cuvette') { if (stepConfig.action === 'insertCuvette' && stepConfig.destination === potentialTarget.id && potentialTarget.type === 'spectrophotometer') isValidTarget = true; else if (stepConfig.action === 'emptyCuvette' && stepConfig.destination === potentialTarget.id && potentialTarget.id === 'wasteBeaker') isValidTarget = true; else if (potentialTarget.id === 'wasteBeaker') isValidTarget = true; } } else if (draggedObject.type === 'cuvette' && potentialTarget.id === 'wasteBeaker') isValidTarget = true; } if (isValidTarget && potentialTarget) highlights.push(potentialTarget.id); highlights.push(draggedObject.id); drawSimulation(); });
    labCanvas.addEventListener('mouseup', (e) => { /* (Same as previous version, includes cuvette removal logic) */ const wasDragging = isDragging; isDragging = false; labCanvas.classList.remove('dragging'); const rect = labCanvas.getBoundingClientRect(); const mouseX = e.clientX - rect.left; const mouseY = e.clientY - rect.top; const objectUnderMouseResult = getObjectAtMouseDown(mouseX, mouseY); if (wasDragging && draggedObject) { console.log(`MouseUp (Drop) at (${mouseX.toFixed(0)}, ${mouseY.toFixed(0)}). Dragged: ${draggedObject.id}`); const dropTargetResult = getObjectAt(mouseX, mouseY); const dropTarget = dropTargetResult && !dropTargetResult.clickedButton ? findObjectById(dropTargetResult.id) : null; console.log(`Drop Target identified: ${dropTarget ? dropTarget.id : 'null'}`); let stateUpdatedByRemoval = false; const draggedCuvetteRef = (draggedObject.type === 'cuvette') ? findObjectById(draggedObject.id) : null; if (draggedCuvetteRef && draggedCuvetteRef.isInSpec && (!dropTarget || dropTarget.id !== 'spec20')) { draggedCuvetteRef.isInSpec = false; spec20State.cuvetteInsideId = null; spec20State.reading = spec20State.absorbanceMode ? "-- Abs" : "-- %T"; stateUpdatedByRemoval = true; console.log("Internal State Updated: Cuvette marked as removed from spec."); } if (dropTarget) { if (draggedObject.type === 'pipette') { if (draggedObject.currentVolume === 0 && (dropTarget.type === 'bottle' || dropTarget.type === 'testTube')) { tryFillPipette(draggedObject.id, dropTarget.id); } else if (draggedObject.currentVolume > 0 && (dropTarget.type === 'testTube' || dropTarget.type === 'cuvette' || dropTarget.type === 'beaker')) { tryDispensePipette(draggedObject.id, dropTarget.id, draggedObject.currentVolume); } else { console.log("Pipette drop condition not met."); } } else if (draggedObject.type === 'cuvette') { if (dropTarget.id === 'wasteBeaker') { tryEmptyCuvette(draggedObject.id, dropTarget.id); } else if (dropTarget.type === 'spectrophotometer') { if (!stateUpdatedByRemoval) { tryInsertCuvette(draggedObject.id, dropTarget.id); } else { console.log("Prevented immediate re-insert after removal."); showFeedback("Place cuvette elsewhere before re-inserting.", "info"); } } } } else { console.log("No valid drop target found, or dropped on self/empty space."); } draggedObject = null; } else if (!wasDragging && objectUnderMouseResult?.clickedButton) { if (objectUnderMouseResult.type === 'spectrophotometer') { console.log(`Spectrophotometer button clicked: ${objectUnderMouseResult.clickedButton}`); if (objectUnderMouseResult.clickedButton === 'zero') { tryZeroSpec(); } else if (objectUnderMouseResult.clickedButton === 'measure') { tryMeasure(); } else if (objectUnderMouseResult.clickedButton === 'mode') { tryToggleMode(); } } else { console.log("Click detected, but not on a known button."); } } else { console.log("MouseUp on empty space or non-interactive element."); } highlights = []; updateUI(); });
    undoButton.addEventListener('click', () => { if (historyStack.length > 0) { const prevState = historyStack.pop(); restoreState(prevState); feedback = { message: 'Undo successful.', type: 'info' }; updateUI(); drawGraph(); } undoButton.disabled = historyStack.length === 0; });

    // --- Action Functions ---

    // *** UPDATED HELPER FUNCTION ***
    function checkAndProcessInternalStep() {
        if (!instructions || currentStep < 0 || currentStep >= instructions.length) {
             console.log("Reached end of instructions or invalid step index during check.");
             return; // Stop processing if no more instructions
        }

        let stepConfig = instructions[currentStep];
        let processedInternal = false; // Flag if we actually processed an internal step

        // Loop as long as the current step is internal/info AND is valid
        while (stepConfig && (stepConfig.action === 'info' || stepConfig.action === 'setUnknownFlag')) {
            console.log(`Processing internal/info step ${currentStep}: ${stepConfig.action}`);
            processedInternal = true;

            // Save state *before* executing or skipping, allows undoing the skip
            saveState();

            let internalActionSuccess = true; // Assume success for info steps
            if (stepConfig.action === 'setUnknownFlag') {
                 // trySetUnknownFlag now ONLY sets the flag, returns true/false
                 internalActionSuccess = trySetUnknownFlag(stepConfig.cuvette);
            }
             // If the internal action was successful (or it was just info), advance
             if (internalActionSuccess) {
                 currentStep++;
             } else {
                 // If internal action failed, stop processing further steps
                 console.error(`Internal action ${stepConfig.action} failed at step ${currentStep}. Halting auto-advance.`);
                 return;
             }

            // Get config for the *new* currentStep to check the next iteration
            stepConfig = (currentStep < instructions.length) ? instructions[currentStep] : null;
        }

        if (processedInternal) {
            console.log("Finished processing internal/info steps. New step:", currentStep);
            // Update UI *after* potentially skipping multiple steps
            updateUI();
        } else {
            // console.log(`Step ${currentStep} is interactive, waiting for user.`);
        }
    }


    // --- Modified Action Functions (Call checkAndProcessInternalStep AFTER incrementing step) ---
    function tryZeroSpec() { console.log("--- tryZeroSpec called ---"); const stepConfig = instructions[currentStep]; if (!stepConfig?.action || stepConfig.action !== 'zeroSpec') { showFeedback(`Incorrect action. ${stepConfig?.hint || ''}`, 'error'); return; } const cuvette = findObjectById(spec20State.cuvetteInsideId); if (!cuvette || !spec20State.cuvetteInsideId || Math.abs(cuvette.concentration - 0) > 0.0001) { showFeedback("Cannot zero. Insert Blank (0 µM).", 'error'); return; } saveState(); spec20State.isZeroed = true; const units = spec20State.absorbanceMode ? " Abs" : " %T"; spec20State.reading = spec20State.absorbanceMode ? "0.000" : "100.0"; spec20State.reading += units; currentStep++; showFeedback(`Spectrophotometer zeroed.`, 'success'); checkAndProcessInternalStep(); updateUI(); } // Call check AFTER increment
    function tryFillPipette(pipetteId, sourceId) { console.log(`--- tryFillPipette called ---`); const stepConfig = instructions[currentStep]; if (!stepConfig?.action || stepConfig.action !== 'fillPipette' || stepConfig.pipette !== pipetteId || stepConfig.source !== sourceId) { showFeedback(`Incorrect action. ${stepConfig?.hint || ''}`, 'error'); return; } const pipette = findObjectById(pipetteId); const source = findObjectById(sourceId); const targetVolume = stepConfig.volume; if (!pipette || !source || source.currentVolume < targetVolume || pipette.currentVolume > 0) { showFeedback("Cannot fill pipette.", 'error'); return; } saveState(); pipette.currentVolume = targetVolume; pipette.contentsConcentration = source.concentration; source.currentVolume -= targetVolume; currentStep++; showFeedback(`Pipette filled...`, 'success'); checkAndProcessInternalStep(); updateUI(); }
    function tryDispensePipette(pipetteId, destId, volume) { console.log(`--- tryDispensePipette called ---`); const stepConfig = instructions[currentStep]; if (!stepConfig?.action || stepConfig.action !== 'dispensePipette' || stepConfig.pipette !== pipetteId || stepConfig.destination !== destId) { showFeedback(`Incorrect action. ${stepConfig?.hint || ''}`, 'error'); return; } if (stepConfig.volume && Math.abs(volume - stepConfig.volume) > 0.01) { showFeedback(`Incorrect volume.`, 'error'); return; } const pipette = findObjectById(pipetteId); const dest = findObjectById(destId); if (!pipette || !dest || pipette.currentVolume < volume - 0.001 || dest.currentVolume + volume > dest.maxVolume + 0.001) { showFeedback("Cannot dispense.", 'error'); return; } saveState(); const initialDestVol = dest.currentVolume; const initialDestConc = dest.concentration; const addedVol = volume; const addedConc = pipette.contentsConcentration; const finalVol = initialDestVol + addedVol; let finalConc = 0; if (finalVol > 0.001) { finalConc = ((initialDestConc * initialDestVol) + (addedConc * addedVol)) / finalVol; } dest.currentVolume = finalVol; dest.concentration = finalConc; pipette.currentVolume -= addedVol; if (pipette.currentVolume < 0.001) { pipette.currentVolume = 0; pipette.contentsConcentration = 0; } currentStep++; showFeedback(`Dispensed...`, 'success'); checkAndProcessInternalStep(); updateUI(); }
    function tryEmptyCuvette(cuvetteId, wasteId) { console.log("--- tryEmptyCuvette called ---"); if (wasteId !== 'wasteBeaker') { showFeedback("Can only empty into Waste.", 'error'); return; } const cuvette = findObjectById(cuvetteId); const waste = findObjectById(wasteId); if (!cuvette || !waste) { showFeedback("Internal error.", 'error'); return; } if (cuvette.isInSpec) { showFeedback("Cannot empty cuvette in Spec.", 'error'); return; } if (cuvette.currentVolume <= 0) { showFeedback("Cuvette already empty.", 'info'); return; } const stepConfig = instructions[currentStep]; let stepCompleted = false; if (stepConfig?.action === 'emptyCuvette' && stepConfig.cuvette === cuvetteId && stepConfig.destination === wasteId) { stepCompleted = true; } saveState(); waste.currentVolume += cuvette.currentVolume; if (waste.currentVolume > waste.maxVolume) waste.currentVolume = waste.maxVolume; cuvette.currentVolume = 0; cuvette.concentration = 0; cuvette.isClean = false; if (stepCompleted) { currentStep++; showFeedback(`Cuvette emptied. Step complete.`, 'success'); checkAndProcessInternalStep(); } else { showFeedback(`Cuvette emptied.`, 'success'); } updateUI(); }
    function tryInsertCuvette(cuvetteId, specId) { console.log("--- tryInsertCuvette called ---"); const stepConfig = instructions[currentStep]; if (!stepConfig?.action || stepConfig.action !== 'insertCuvette' || stepConfig.cuvette !== cuvetteId || stepConfig.destination !== specId) { showFeedback(`Incorrect action. ${stepConfig?.hint || ''}`, 'error'); return; } const cuvette = findObjectById(cuvetteId); const spec = findObjectById(specId); if (!cuvette || !spec || spec20State.cuvetteInsideId || (cuvette.currentVolume <= 0 && !stepConfig.allowEmpty) || cuvette.isInSpec) { showFeedback("Cannot insert cuvette.", 'error'); return; } saveState(); cuvette.isInSpec = true; spec20State.cuvetteInsideId = cuvetteId; spec20State.reading = spec20State.absorbanceMode ? "-- Abs" : "-- %T"; currentStep++; checkAndProcessInternalStep(); showFeedback(`Cuvette inserted.`, 'success'); updateUI(); }
    function tryMeasure() { console.log("--- tryMeasure called ---"); const stepConfig = instructions[currentStep]; if (!stepConfig?.action || stepConfig.action !== 'measure') { showFeedback(`Incorrect action. ${stepConfig?.hint || ''}`, 'error'); return; } if (!spec20State.cuvetteInsideId || !spec20State.isZeroed) { showFeedback("Cannot measure.", 'error'); return; } const cuvette = findObjectById(spec20State.cuvetteInsideId); if (!cuvette || (Math.abs(cuvette.concentration - 0) < 0.0001 && !stepConfig.allowBlankMeasure)) { showFeedback("Cannot measure blank.", 'error'); return; } const concentration = cuvette.concentration; let percentT = getSimulatedPercentT(concentration); let absorbance = -Math.log10(percentT / 100); if (isNaN(absorbance)) absorbance = Infinity; if (absorbance > MAX_ABS && !stepConfig.allowHighAbs) { spec20State.reading = ">1.5 Abs"; showFeedback(`Abs too high (> ${MAX_ABS}).`, 'error'); updateUI(); return; } saveState(); if (spec20State.absorbanceMode) { spec20State.reading = absorbance > 10 ? '>10 Abs' : absorbance.toFixed(3) + " Abs"; } else { spec20State.reading = percentT.toFixed(1) + " %T"; } let dataRowId = stepConfig.targetDataRowId || 'unknown'; const dataRow = dataTableData.find(row => row.id === dataRowId); if (dataRow) { dataRow.measuredPercentT = percentT.toFixed(1); dataRow.T = (percentT / 100).toFixed(3); dataRow.negLogT = absorbance > 10 ? Infinity : absorbance.toFixed(4); } currentStep++; showFeedback(`Measurement complete: ${spec20State.reading}.`, 'success'); checkAndProcessInternalStep(); updateUI(); drawGraph(); }
    function tryToggleMode() { /* (Same as before - no step change) */ console.log("--- tryToggleMode called ---"); spec20State.absorbanceMode = !spec20State.absorbanceMode; if (spec20State.cuvetteInsideId && spec20State.reading !== '-- %T' && spec20State.reading !== '-- Abs' && spec20State.reading !== '>1.5 Abs') { const readingParts = spec20State.reading.split(" "); const currentValue = parseFloat(readingParts[0]); let absorbance, percentT; if (!spec20State.absorbanceMode) { absorbance = currentValue; percentT = Math.pow(10, -absorbance) * 100; spec20State.reading = percentT.toFixed(1) + " %T"; } else { percentT = currentValue; absorbance = -Math.log10(percentT / 100); if (isNaN(absorbance)) absorbance = Infinity; spec20State.reading = absorbance > 10 ? '>10 Abs' : absorbance.toFixed(3) + " Abs"; } } else if (spec20State.isZeroed && spec20State.cuvetteInsideId && Math.abs(findObjectById(spec20State.cuvetteInsideId).concentration - 0) < 0.0001) { spec20State.reading = spec20State.absorbanceMode ? "0.000 Abs" : "100.0 %T"; } else { spec20State.reading = spec20State.absorbanceMode ? "-- Abs" : "-- %T"; } showFeedback(`Display mode: ${spec20State.absorbanceMode ? 'Absorbance' : '%Transmittance'}.`, 'info'); updateUI(); }

    // *** REVISED trySetUnknownFlag - Returns true/false, DOES NOT save state or advance step ***
    function trySetUnknownFlag(cuvetteId) {
        console.log("--- trySetUnknownFlag executing ---");
        const cuvette = findObjectById(cuvetteId);
        if (!cuvette) {
            console.error("Internal error: Cuvette not found for unknown flag.");
            showFeedback("Internal simulation error.", "error");
            return false; // Indicate failure
        }
        // This action is internal, no user-facing checks needed here,
        // but ensure the cuvette *should* be the one holding the unknown.
        // We assume the step logic calling this is correct.
        console.log("ACTION: Setting unknown flag on cuvette:", cuvetteId);
        cuvette.concentration = -1; // Set the flag
        return true; // Indicate success
    }


    // --- UI Update ---
    // --- UI Update ---
    function updateUI() {
        try {
            // ... (Update Instructions, Feedback, Table - same as before) ...
            const stepConfig = instructions[currentStep];
            highlights = [];
            if (stepConfig) { instructionEl.innerHTML = `<b>Step ${currentStep + 1}:</b> ${stepConfig.text}`; if(stepConfig.highlight) { highlights = [...stepConfig.highlight]; } }
            else { instructionEl.textContent = "Experiment Complete!"; }
            feedbackEl.textContent = feedback.message; feedbackEl.className = feedback.type;
            resultsTbody.innerHTML = '';
            dataTableData.forEach(row => { const tr = document.createElement('tr'); let displayConc = row.conc; let displayAbs = row.negLogT; if (row.id === 'unknown' && row.negLogT !== null && KNOWN_SLOPE > 0 && isFinite(row.negLogT)) { displayConc = (row.negLogT / KNOWN_SLOPE); } if(displayAbs === Infinity || displayAbs > 10) displayAbs = '>2.0'; else if(displayAbs !== null) displayAbs = parseFloat(displayAbs).toFixed(4); else displayAbs = '--'; tr.innerHTML = `<td>${row.solution}</td><td>${row.dilution}</td><td>${displayConc !== null ? displayConc.toFixed(3) : 'N/A'}</td><td>${row.measuredPercentT !== null ? row.measuredPercentT : '--'}</td><td>${row.T !== null ? row.T : '--'}</td><td>${displayAbs}</td>`; resultsTbody.appendChild(tr); });


            // Update Slope Display
             if (currentStep >= instructions.findIndex(instr => instr.id === 'graph_analysis')) {
                 slopeDisplayEl.textContent = `Calibration Line Slope (Abs/µM) ≈ ${KNOWN_SLOPE}`;
             } else {
                 slopeDisplayEl.textContent = '';
             }

            // *** UPDATED UNKNOWN RESULT DISPLAY ***
            const unknownRow = dataTableData.find(r => r.id === 'unknown');
            if (unknownRow && unknownRow.negLogT !== null && KNOWN_SLOPE > 0 && isFinite(unknownRow.negLogT)) {
                 const measuredAbs = parseFloat(unknownRow.negLogT); // Ensure it's a number
                 const calculatedConc = (measuredAbs / KNOWN_SLOPE);
                 // Format the output with calculation steps
                 unknownResultEl.innerHTML = `
                     <b>Unknown Drink Concentration ≈ ${calculatedConc.toFixed(3)} µM</b><br>
                     <small><i>Calculation: Abs = Slope * Conc</i></small><br>
                     <small><i>Conc = Abs / Slope = ${measuredAbs.toFixed(4)} / ${KNOWN_SLOPE}</i></small>
                 `;
            } else if (unknownRow?.negLogT === Infinity) {
                 unknownResultEl.textContent = `Unknown Concentration too high to measure accurately.`;
            } else {
                  unknownResultEl.textContent = ''; // Clear if no valid unknown data
            }

            // Update Undo Button state
            undoButton.disabled = historyStack.length === 0;

            // Trigger redraw AFTER state/highlights are updated
            drawSimulation();

        } catch (error) {
            console.error("Error during updateUI:", error);
            showFeedback("An error occurred updating the interface.", "error");
        }
    }


    // --- Instructions Definition ---
    const instructions = [ /* (Same steps 0-62 as previous version) */
        { step: 0, text: "Prepare Sample 1 (Stock): Drag the Pipette to the 'Stock Blue#1' bottle.", action: 'fillPipette', pipette: 'pipette', source: 'stockBottle', volume: 10, highlight: ['pipette', 'stockBottle'] },
        { step: 1, text: "Drag the full Pipette to Test Tube '10/0'.", action: 'dispensePipette', pipette: 'pipette', destination: 'tube_10_0', volume: 10, highlight: ['pipette', 'tube_10_0'] },
        { step: 2, text: "Prepare Sample 2 (8/2): Drag Pipette to 'Stock Blue#1' bottle.", action: 'fillPipette', pipette: 'pipette', source: 'stockBottle', volume: 8, highlight: ['pipette', 'stockBottle'] },
        { step: 3, text: "Drag Pipette to Test Tube '8/2'.", action: 'dispensePipette', pipette: 'pipette', destination: 'tube_8_2', volume: 8, highlight: ['pipette', 'tube_8_2'] },
        { step: 4, text: "Drag Pipette to 'Distilled H₂O' bottle.", action: 'fillPipette', pipette: 'pipette', source: 'waterBottle', volume: 2, highlight: ['pipette', 'waterBottle'] },
        { step: 5, text: "Drag Pipette to Test Tube '8/2'.", action: 'dispensePipette', pipette: 'pipette', destination: 'tube_8_2', volume: 2, highlight: ['pipette', 'tube_8_2'] },
        { step: 6, text: "Prepare Sample 3 (6/4): Drag Pipette to 'Stock Blue#1'.", action: 'fillPipette', pipette: 'pipette', source: 'stockBottle', volume: 6, highlight: ['pipette', 'stockBottle'] },
        { step: 7, text: "Drag Pipette to Test Tube '6/4'.", action: 'dispensePipette', pipette: 'pipette', destination: 'tube_6_4', volume: 6, highlight: ['pipette', 'tube_6_4'] },
        { step: 8, text: "Drag Pipette to 'Distilled H₂O'.", action: 'fillPipette', pipette: 'pipette', source: 'waterBottle', volume: 4, highlight: ['pipette', 'waterBottle'] },
        { step: 9, text: "Drag Pipette to Test Tube '6/4'.", action: 'dispensePipette', pipette: 'pipette', destination: 'tube_6_4', volume: 4, highlight: ['pipette', 'tube_6_4'] },
        { step: 10, text: "Prepare Sample 4 (4/6): Fill pipette with 4mL Stock.", action: 'fillPipette', pipette: 'pipette', source: 'stockBottle', volume: 4, highlight: ['pipette', 'stockBottle'] },
        { step: 11, text: "Dispense stock into Tube '4/6'.", action: 'dispensePipette', pipette: 'pipette', destination: 'tube_4_6', volume: 4, highlight: ['pipette', 'tube_4_6'] },
        { step: 12, text: "Fill pipette with 6mL Water.", action: 'fillPipette', pipette: 'pipette', source: 'waterBottle', volume: 6, highlight: ['pipette', 'waterBottle'] },
        { step: 13, text: "Dispense water into Tube '4/6'.", action: 'dispensePipette', pipette: 'pipette', destination: 'tube_4_6', volume: 6, highlight: ['pipette', 'tube_4_6'] },
        { step: 14, text: "Prepare Sample 5 (2/8): Fill pipette with 2mL Stock.", action: 'fillPipette', pipette: 'pipette', source: 'stockBottle', volume: 2, highlight: ['pipette', 'stockBottle'] },
        { step: 15, text: "Dispense stock into Tube '2/8'.", action: 'dispensePipette', pipette: 'pipette', destination: 'tube_2_8', volume: 2, highlight: ['pipette', 'tube_2_8'] },
        { step: 16, text: "Fill pipette with 8mL Water.", action: 'fillPipette', pipette: 'pipette', source: 'waterBottle', volume: 8, highlight: ['pipette', 'waterBottle'] },
        { step: 17, text: "Dispense water into Tube '2/8'.", action: 'dispensePipette', pipette: 'pipette', destination: 'tube_2_8', volume: 8, highlight: ['pipette', 'tube_2_8'] },
        { step: 18, text: "Prepare Blank (0/10): Fill pipette with 10mL Water.", action: 'fillPipette', pipette: 'pipette', source: 'waterBottle', volume: 10, highlight: ['pipette', 'waterBottle'] },
        { step: 19, text: "Dispense water into Tube '0/10 (Blank)'.", action: 'dispensePipette', pipette: 'pipette', destination: 'tube_0_10', volume: 10, highlight: ['pipette', 'tube_0_10'] },
        { step: 20, text: "Zero Spectrophotometer: Fill pipette from Tube '0/10 (Blank)'. Use ~3mL.", action: 'fillPipette', pipette: 'pipette', source: 'tube_0_10', volume: 3, highlight: ['pipette', 'tube_0_10'] },
        { step: 21, text: "Dispense blank into the Cuvette.", action: 'dispensePipette', pipette: 'pipette', destination: 'cuvette', volume: 3, highlight: ['pipette', 'cuvette'] },
        { step: 22, text: "Place the Cuvette (with Blank) into the Spectrophotometer.", action: 'insertCuvette', cuvette: 'cuvette', destination: 'spec20', allowEmpty: false, highlight: ['cuvette', 'spec20'] },
        { step: 23, text: "Click the 'Zero' button on the Spectrophotometer.", action: 'zeroSpec', hint:"Click the button labeled Zero.", highlight: ['spec20'] },
        { step: 24, text: "Empty the Blank Cuvette: Drag the Cuvette from the Spec to the Waste beaker.", action: 'emptyCuvette', cuvette: 'cuvette', destination: 'wasteBeaker', hint: "First drag cuvette out, then drag to Waste.", highlight: ['cuvette', 'wasteBeaker'] },
        { step: 25, text: "Measure Sample 1 (10/0): Fill pipette from Tube '10/0'. (~3mL)", action: 'fillPipette', pipette: 'pipette', source: 'tube_10_0', volume: 3, highlight: ['pipette', 'tube_10_0'] },
        { step: 26, text: "Dispense Sample 1 (10/0) into the empty Cuvette.", action: 'dispensePipette', pipette: 'pipette', destination: 'cuvette', volume: 3, highlight: ['pipette', 'cuvette'] },
        { step: 27, text: "Place the Cuvette (Sample 1) into the Spectrophotometer.", action: 'insertCuvette', cuvette: 'cuvette', destination: 'spec20', highlight: ['cuvette', 'spec20'] },
        { step: 28, text: "Click the 'Measure' button.", action: 'measure', targetDataRowId: 'tube_10_0', highlight: ['spec20'] },
        { step: 29, text: "Empty Sample 1 Cuvette: Drag Cuvette to Waste.", action: 'emptyCuvette', cuvette: 'cuvette', destination: 'wasteBeaker', highlight: ['cuvette', 'wasteBeaker'] },
        { step: 30, text: "Measure Sample 2 (8/2): Fill pipette from Tube '8/2'.", action: 'fillPipette', pipette: 'pipette', source: 'tube_8_2', volume: 3, highlight: ['pipette', 'tube_8_2'] },
        { step: 31, text: "Dispense Sample 2 into Cuvette.", action: 'dispensePipette', pipette: 'pipette', destination: 'cuvette', volume: 3, highlight: ['pipette', 'cuvette'] },
        { step: 32, text: "Place Cuvette (Sample 2) into Spec.", action: 'insertCuvette', cuvette: 'cuvette', destination: 'spec20', highlight: ['cuvette', 'spec20'] },
        { step: 33, text: "Click 'Measure'.", action: 'measure', targetDataRowId: 'tube_8_2', highlight: ['spec20'] },
        { step: 34, text: "Empty Sample 2 Cuvette: Drag Cuvette to Waste.", action: 'emptyCuvette', cuvette: 'cuvette', destination: 'wasteBeaker', highlight: ['cuvette', 'wasteBeaker'] },
        { step: 35, text: "Measure Sample 3 (6/4): Fill pipette from Tube '6/4'.", action: 'fillPipette', pipette: 'pipette', source: 'tube_6_4', volume: 3, highlight: ['pipette', 'tube_6_4'] },
        { step: 36, text: "Dispense Sample 3 into Cuvette.", action: 'dispensePipette', pipette: 'pipette', destination: 'cuvette', volume: 3, highlight: ['pipette', 'cuvette'] },
        { step: 37, text: "Place Cuvette (Sample 3) into Spec.", action: 'insertCuvette', cuvette: 'cuvette', destination: 'spec20', highlight: ['cuvette', 'spec20'] },
        { step: 38, text: "Click 'Measure'.", action: 'measure', targetDataRowId: 'tube_6_4', highlight: ['spec20'] },
        { step: 39, text: "Empty Sample 3 Cuvette: Drag Cuvette to Waste.", action: 'emptyCuvette', cuvette: 'cuvette', destination: 'wasteBeaker', highlight: ['cuvette', 'wasteBeaker'] },
        { step: 40, text: "Measure Sample 4 (4/6): Fill pipette from Tube '4/6'.", action: 'fillPipette', pipette: 'pipette', source: 'tube_4_6', volume: 3, highlight: ['pipette', 'tube_4_6'] },
        { step: 41, text: "Dispense Sample 4 into Cuvette.", action: 'dispensePipette', pipette: 'pipette', destination: 'cuvette', volume: 3, highlight: ['pipette', 'cuvette'] },
        { step: 42, text: "Place Cuvette (Sample 4) into Spec.", action: 'insertCuvette', cuvette: 'cuvette', destination: 'spec20', highlight: ['cuvette', 'spec20'] },
        { step: 43, text: "Click 'Measure'.", action: 'measure', targetDataRowId: 'tube_4_6', highlight: ['spec20'] },
        { step: 44, text: "Empty Sample 4 Cuvette: Drag Cuvette to Waste.", action: 'emptyCuvette', cuvette: 'cuvette', destination: 'wasteBeaker', highlight: ['cuvette', 'wasteBeaker'] },
        { step: 45, text: "Measure Sample 5 (2/8): Fill pipette from Tube '2/8'.", action: 'fillPipette', pipette: 'pipette', source: 'tube_2_8', volume: 3, highlight: ['pipette', 'tube_2_8'] },
        { step: 46, text: "Dispense Sample 5 into Cuvette.", action: 'dispensePipette', pipette: 'pipette', destination: 'cuvette', volume: 3, highlight: ['pipette', 'cuvette'] },
        { step: 47, text: "Place Cuvette (Sample 5) into Spec.", action: 'insertCuvette', cuvette: 'cuvette', destination: 'spec20', highlight: ['cuvette', 'spec20'] },
        { step: 48, text: "Click 'Measure'.", action: 'measure', targetDataRowId: 'tube_2_8', highlight: ['spec20'] },
        { step: 49, text: "Empty Sample 5 Cuvette: Drag Cuvette to Waste.", action: 'emptyCuvette', cuvette: 'cuvette', destination: 'wasteBeaker', highlight: ['cuvette', 'wasteBeaker'] },
        { step: 50, text: "Measure Blank (0/10): Fill pipette from Tube '0/10'.", action: 'fillPipette', pipette: 'pipette', source: 'tube_0_10', volume: 3, highlight: ['pipette', 'tube_0_10'] },
        { step: 51, text: "Dispense Blank into Cuvette.", action: 'dispensePipette', pipette: 'pipette', destination: 'cuvette', volume: 3, highlight: ['pipette', 'cuvette'] },
        { step: 52, text: "Place Cuvette (Blank) into Spec.", action: 'insertCuvette', cuvette: 'cuvette', destination: 'spec20', highlight: ['cuvette', 'spec20'] },
        { step: 53, text: "Click 'Measure'. (Should read ~100%T / 0 Abs).", action: 'measure', targetDataRowId: 'tube_0_10', allowBlankMeasure: true, highlight: ['spec20'] },
        { step: 54, id: 'graph_analysis', text: "Calibration complete. Observe the Data Table and Graph.", action:'info', highlight: ['data-panel', 'graph-panel'] }, // INFO STEP
        { step: 55, text: "Empty the Blank Cuvette: Drag Cuvette to Waste.", action: 'emptyCuvette', cuvette: 'cuvette', destination: 'wasteBeaker', highlight: ['cuvette', 'wasteBeaker'] },
        { step: 56, text: "Measure Unknown: Fill pipette from 'Unknown Drink' bottle.", action: 'fillPipette', pipette: 'pipette', source: 'unknownBottle', volume: 3, highlight: ['pipette', 'unknownBottle'] },
        { step: 57, text: "Dispense Unknown into Cuvette.", action: 'dispensePipette', pipette: 'pipette', destination: 'cuvette', volume: 3, highlight: ['pipette', 'cuvette'] },
        { step: 58, text: "Set Cuvette as Unknown (Internal).", action: 'setUnknownFlag', cuvette: 'cuvette' }, // INTERNAL STEP
        { step: 59, text: "Place Cuvette (Unknown) into Spec.", action: 'insertCuvette', cuvette: 'cuvette', destination: 'spec20', highlight: ['cuvette', 'spec20'] },
        { step: 60, text: "Click 'Measure' to find the absorbance of the Unknown.", action: 'measure', targetDataRowId: 'unknown', highlight: ['spec20'] },
        { step: 61, text: "Result recorded. Use Absorbance and Calibration Slope to calculate concentration.", action:'info', highlight: ['data-panel'] }, // INFO STEP
        { step: 62, text: "Experiment Complete!" }, // FINAL STEP
    ];

    // --- Initial Setup ---
    try {
        initializeState();
        updateUI(); // Initial UI setup
        drawGraph();
        // Initial check for internal steps AFTER initial state is set
        checkAndProcessInternalStep();
        // updateUI(); // Call updateUI again in case first step was internal
        console.log("Initialization complete. Simulation running.");
    } catch (error) {
        console.error("Error during initial setup:", error);
        if(instructionEl) instructionEl.textContent = "ERROR during initialization. Check console.";
        showFeedback("Error initializing simulation. Check console.", "error");
    }

}); // End DOMContentLoaded listener
