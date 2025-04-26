// simulation.js

document.addEventListener('DOMContentLoaded', () => {
    console.log("DOM Loaded. Initializing simulation...");

    // --- Safe Element Selection ---
    function getElement(id) { const element = document.getElementById(id); if (!element) { console.error(`FATAL ERROR: Element with ID '${id}' not found!`); throw new Error(`Element not found: ${id}`); } return element; }
    let labCanvas, labCtx, graphCanvas, graphCtx;
    let instructionEl, feedbackEl, resultsTbody, slopeDisplayEl, unknownResultEl, undoButton;
    try {
        labCanvas = getElement('lab-canvas');
        labCtx = labCanvas.getContext('2d');
        graphCanvas = getElement('graph-canvas');
        graphCtx = graphCanvas.getContext('2d');
        instructionEl = getElement('instruction-text');
        feedbackEl = getElement('feedback-message');
        resultsTbody = getElement('results-tbody');
        slopeDisplayEl = getElement('slope-display');
        unknownResultEl = getElement('unknown-result');
        undoButton = getElement('undo-button');
        console.log("Essential DOM elements obtained.");
    } catch (error) {
        const initialInstructionEl = document.getElementById('instruction-text');
        if(initialInstructionEl) initialInstructionEl.textContent = "ERROR: Failed to load simulation elements. Check console.";
        console.error("Error fetching essential elements:", error);
        return;
    }

    // --- Constants ---
    const STOCK_CONCENTRATION = 2.31; const TARGET_WAVELENGTH = 630; const KNOWN_SLOPE = 0.1358; const MAX_ABS = 1.5;
    const WATER_COLOR_COMPONENTS = { r: 200, g: 200, b: 255, a: 0.6 };
    const STOCK_COLOR_COMPONENTS = { r: 0, g: 0, b: 255, a: 0.8 };
    const COLORS = {
        glass: '#ddd', label: '#333',
        error: '#d32f2f', success: '#388e3c', info: '#1976d2', highlight: 'orange', };
    const TRANSMITTANCE_LOOKUP = { 0: 100.0, 0.231: 95.0, 0.462: 87.0, 0.693: 81.0, 0.924: 77.0, 1.39: 65.0, 1.85: 58.0, 2.31: 49.0, };
    const RINSE_VOLUME = 3; // Volume used for rinsing cuvette

    // --- State Management ---
    let currentStep = 0; let labObjects = []; let dataTableData = []; let spec20State = {}; let historyStack = []; let draggedObject = null; let dragOffsetX = 0, dragOffsetY = 0; let feedback = { message: '', type: 'info' }; let highlights = []; let isDragging = false;

    // --- Core Functions ---
    function initializeState() {
        currentStep = 0;
        feedback = { message: 'Welcome! Follow the instructions.', type: 'info' };
        historyStack = [];
        draggedObject = null;
        highlights = [];
        isDragging = false;

        const originalPipetteWidth = 10;
        const originalPipetteHeight = 150;
        const pipetteScaleFactor = 0.7;
        const pipetteWidth = originalPipetteWidth * pipetteScaleFactor;
        const pipetteHeight = originalPipetteHeight * pipetteScaleFactor;

        const stockBottle = { id: 'stockBottle', type: 'bottle', label: 'Stock Blue#1', x: 50, y: 50, width: 50, height: 100, concentration: STOCK_CONCENTRATION, maxVolume: 1000, currentVolume: 1000, isDraggable: false, isDropTarget: true };
        const waterBottle = { id: 'waterBottle', type: 'bottle', label: 'Distilled H₂O', x: 120, y: 50, width: 50, height: 100, concentration: 0, maxVolume: 1000, currentVolume: 1000, isDraggable: false, isDropTarget: true };
        const unknownBottle = { id: 'unknownBottle', type: 'bottle', label: 'Unknown Drink', x: 50, y: 195, width: 50, height: 80, concentration: -1, maxVolume: 500, currentVolume: 500, isDraggable: false, isDropTarget: true };

        const pipetteX = unknownBottle.x + unknownBottle.width + 15;
        const pipetteY = unknownBottle.y;

        const pipette = { id: 'pipette', type: 'pipette', label: 'Pipette',
                          x: pipetteX, y: pipetteY,
                          width: pipetteWidth, height: pipetteHeight,
                          maxVolume: 10, currentVolume: 0, contentsConcentration: 0, isDraggable: true, isDropTarget: false };

        const wasteBeaker = { id: 'wasteBeaker', type: 'beaker', label: 'Waste', x: 680, y: 300, width: 80, height: 100, maxVolume: 250, currentVolume: 0, concentration: null, isDraggable: false, isDropTarget: true };
        const spec20 = { id: 'spec20', type: 'spectrophotometer', label: 'Spec 20', x: 500, y: 50, width: 250, height: 150, isDraggable: false, isDropTarget: true };

        const tubes = [
            { id: 'tube_10_0', type: 'testTube', label: '10/0', x: 250, y: 50, width: 25, height: 100, maxVolume: 10, currentVolume: 0, concentration: 0, isDraggable: false, isDropTarget: true },
            { id: 'tube_8_2', type: 'testTube', label: '8/2', x: 285, y: 50, width: 25, height: 100, maxVolume: 10, currentVolume: 0, concentration: 0, isDraggable: false, isDropTarget: true },
            { id: 'tube_6_4', type: 'testTube', label: '6/4', x: 320, y: 50, width: 25, height: 100, maxVolume: 10, currentVolume: 0, concentration: 0, isDraggable: false, isDropTarget: true },
            { id: 'tube_4_6', type: 'testTube', label: '4/6', x: 355, y: 50, width: 25, height: 100, maxVolume: 10, currentVolume: 0, concentration: 0, isDraggable: false, isDropTarget: true },
            { id: 'tube_2_8', type: 'testTube', label: '2/8', x: 390, y: 50, width: 25, height: 100, maxVolume: 10, currentVolume: 0, concentration: 0, isDraggable: false, isDropTarget: true },
            { id: 'tube_0_10', type: 'testTube', label: '0/10 (Blank)', x: 425, y: 50, width: 25, height: 100, maxVolume: 10, currentVolume: 0, concentration: 0, isDraggable: false, isDropTarget: true },
        ];

        const firstTube = tubes[0];
        const lastTube = tubes[tubes.length - 1];
        const tubeRowCenterX = firstTube.x + (lastTube.x + lastTube.width - firstTube.x) / 2;
        const tubeBottomY = firstTube.y + firstTube.height + firstTube.width / 2;
        const cuvetteWidth = 15;
        const cuvetteHeight = 50;
        const cuvetteX = tubeRowCenterX - cuvetteWidth / 2;
        const cuvetteY = tubeBottomY + 30;

        const cuvette = { id: 'cuvette', type: 'cuvette', label: 'Cuvette',
                          x: cuvetteX, y: cuvetteY,
                          width: cuvetteWidth, height: cuvetteHeight,
                          maxVolume: 4, currentVolume: 0, concentration: 0,
                          isClean: true, // Start clean
                          isDraggable: true, isDropTarget: true, isInSpec: false };

        labObjects = [ stockBottle, waterBottle, unknownBottle, pipette, ...tubes, cuvette, wasteBeaker, spec20 ];

        dataTableData = [
            { id: 'tube_10_0', solution: '1 (Stock)', dilution: '10 / 0', conc: calculateConcentration(10, 0), measuredPercentT: null, T: null, negLogT: null },
            { id: 'tube_8_2', solution: '2', dilution: '8 / 2', conc: calculateConcentration(8, 2), measuredPercentT: null, T: null, negLogT: null },
            { id: 'tube_6_4', solution: '3', dilution: '6 / 4', conc: calculateConcentration(6, 4), measuredPercentT: null, T: null, negLogT: null },
            { id: 'tube_4_6', solution: '4', dilution: '4 / 6', conc: calculateConcentration(4, 6), measuredPercentT: null, T: null, negLogT: null },
            { id: 'tube_2_8', solution: '5', dilution: '2 / 8', conc: calculateConcentration(2, 8), measuredPercentT: null, T: null, negLogT: null },
            { id: 'tube_0_10', solution: '6 (Blank)', dilution: '0 / 10', conc: 0, measuredPercentT: null, T: null, negLogT: null },
            { id: 'unknown', solution: 'Unknown Drink', dilution: 'N/A', conc: null, measuredPercentT: null, T: null, negLogT: null },
        ];
        spec20State = { cuvetteInsideId: null, reading: "-- %T", wavelength: TARGET_WAVELENGTH, isZeroed: false, absorbanceMode: false, zeroButtonPos: { x: 510, y: 160, width: 50, height: 25 }, measureButtonPos: { x: 570, y: 160, width: 60, height: 25 }, modeButtonPos: { x: 640, y: 160, width: 50, height: 25 } };
        console.log("State initialized.");
    }
    function calculateConcentration(stockVol, waterVol) { const totalVol = stockVol + waterVol; if (totalVol <= 0) return 0; return STOCK_CONCENTRATION * stockVol / totalVol; }
    function cloneState() { return JSON.parse(JSON.stringify({ currentStep, labObjects, dataTableData, spec20State })); }
    function restoreState(state) { currentStep = state.currentStep; labObjects = state.labObjects; dataTableData = state.dataTableData; spec20State = state.spec20State; highlights = []; }
    function findObjectById(id) { return labObjects.find(obj => obj.id === id); }
    function saveState() { if (historyStack.length > 20) { historyStack.shift(); } historyStack.push(cloneState()); undoButton.disabled = false; }
    function showFeedback(message, type = 'info') { feedback = { message, type }; if(feedbackEl) {feedbackEl.textContent = message; feedbackEl.className = type;} else {console.warn("Feedback element not found");} }
    function getSimulatedPercentT(concentration) { if (concentration === -1) return 39.0; const concPoints = Object.keys(TRANSMITTANCE_LOOKUP).map(Number).sort((a, b) => a - b); if (concentration <= concPoints[0]) return TRANSMITTANCE_LOOKUP[concPoints[0]]; if (concentration >= concPoints[concPoints.length - 1]) return TRANSMITTANCE_LOOKUP[concPoints[concPoints.length - 1]]; let lowerConc = concPoints[0], upperConc = concPoints[1]; for (let i = 0; i < concPoints.length - 1; i++) { if (concentration >= concPoints[i] && concentration <= concPoints[i + 1]) { lowerConc = concPoints[i]; upperConc = concPoints[i + 1]; break; } } if (upperConc === lowerConc) return TRANSMITTANCE_LOOKUP[lowerConc]; const lowerT = TRANSMITTANCE_LOOKUP[lowerConc]; const upperT = TRANSMITTANCE_LOOKUP[upperConc]; const ratio = (upperConc === lowerConc) ? 0 : (concentration - lowerConc) / (upperConc - lowerConc); return lowerT + (upperT - lowerT) * ratio; }
    function getLiquidColor(concentration) { if (concentration === null || concentration === undefined) return 'rgba(128,128,128,0.5)'; if (concentration === -1) return 'rgba(100, 0, 200, 0.7)'; const effectiveConc = Math.max(0, Math.min(concentration, STOCK_CONCENTRATION)); const ratio = (STOCK_CONCENTRATION > 0) ? effectiveConc / STOCK_CONCENTRATION : 0; const r = Math.round(WATER_COLOR_COMPONENTS.r * (1 - ratio) + STOCK_COLOR_COMPONENTS.r * ratio); const g = Math.round(WATER_COLOR_COMPONENTS.g * (1 - ratio) + STOCK_COLOR_COMPONENTS.g * ratio); const b = Math.round(WATER_COLOR_COMPONENTS.b * (1 - ratio) + STOCK_COLOR_COMPONENTS.b * ratio); const a = WATER_COLOR_COMPONENTS.a * (1 - ratio) + STOCK_COLOR_COMPONENTS.a * ratio; return `rgba(${r}, ${g}, ${b}, ${a.toFixed(2)})`; }

    // --- Drawing Functions ---
    function drawSimulation() { if (!labCtx) return; labCtx.clearRect(0, 0, labCanvas.width, labCanvas.height); labObjects.forEach(obj => { const isHighlighted = highlights.includes(obj.id); if (obj.type === 'bottle') drawBottle(obj, isHighlighted); else if (obj.type === 'testTube') drawTestTube(obj, isHighlighted); else if (obj.type === 'pipette') drawPipette(obj, isHighlighted); else if (obj.type === 'beaker') drawBeaker(obj, isHighlighted); else if (obj.type === 'spectrophotometer') drawSpectrophotometer(obj, isHighlighted); else if (obj.type === 'cuvette') drawCuvette(obj, isHighlighted); }); if (draggedObject) { const isDraggedHighlighted = highlights.includes(draggedObject.id); if (draggedObject.type === 'pipette') drawPipette(draggedObject, isDraggedHighlighted); else if (draggedObject.type === 'cuvette') drawCuvette(draggedObject, isDraggedHighlighted); } }
    function drawBottle(obj, isHighlighted) { labCtx.save(); labCtx.fillStyle = COLORS.glass; labCtx.fillRect(obj.x, obj.y, obj.width, obj.height); labCtx.strokeRect(obj.x, obj.y, obj.width, obj.height); labCtx.fillRect(obj.x + obj.width * 0.3, obj.y - obj.height * 0.1, obj.width * 0.4, obj.height * 0.1); labCtx.strokeRect(obj.x + obj.width * 0.3, obj.y - obj.height * 0.1, obj.width * 0.4, obj.height * 0.1); const liquidHeight = obj.height * (obj.currentVolume / obj.maxVolume) * 0.95; labCtx.fillStyle = getLiquidColor(obj.concentration); labCtx.fillRect(obj.x + 2, obj.y + obj.height - liquidHeight, obj.width - 4, liquidHeight); labCtx.fillStyle = COLORS.label; labCtx.textAlign = 'center'; labCtx.font = '10px sans-serif'; labCtx.fillText(obj.label, obj.x + obj.width / 2, obj.y + obj.height + 12); if (isHighlighted) highlightObjectBorder(obj); labCtx.restore(); }
    function drawTestTube(obj, isHighlighted) { labCtx.save(); labCtx.strokeStyle = '#555'; labCtx.fillStyle = 'rgba(230, 230, 230, 0.5)'; labCtx.fillRect(obj.x, obj.y, obj.width, obj.height); labCtx.strokeRect(obj.x, obj.y, obj.width, obj.height); labCtx.beginPath(); labCtx.arc(obj.x + obj.width / 2, obj.y + obj.height, obj.width / 2, 0, Math.PI); labCtx.stroke(); labCtx.fillStyle = 'rgba(230, 230, 230, 0.5)'; labCtx.fill(); if (obj.currentVolume > 0 && obj.maxVolume > 0) { const liquidLevelRatio = obj.currentVolume / obj.maxVolume; const liquidLevel = obj.height * liquidLevelRatio; const liquidColor = getLiquidColor(obj.concentration); labCtx.fillStyle = liquidColor; const tubeRadius = obj.width / 2; const liquidTopY = obj.y + obj.height - liquidLevel; const rectFillHeight = Math.max(0, liquidLevel - tubeRadius); if (rectFillHeight > 0) { labCtx.fillRect(obj.x + 1, liquidTopY, obj.width - 2, rectFillHeight); } const arcFillHeight = Math.min(liquidLevel, tubeRadius); if (arcFillHeight > 0) { const angle = Math.acos(Math.max(-1, Math.min(1, 1 - arcFillHeight / tubeRadius))); const startAngle = Math.PI - angle; const endAngle = angle; labCtx.beginPath(); labCtx.arc(obj.x + tubeRadius, obj.y + obj.height, tubeRadius, startAngle, endAngle); const arcStartX = obj.x + tubeRadius - Math.sin(angle) * tubeRadius; const arcEndX = obj.x + tubeRadius + Math.sin(angle) * tubeRadius; const connectY = liquidTopY + rectFillHeight; // Y-level where arc connects to rectangle (or top if no rect part)
                 labCtx.lineTo(arcEndX, connectY); labCtx.lineTo(arcStartX, connectY); labCtx.closePath(); labCtx.fill(); } } labCtx.fillStyle = COLORS.label; labCtx.textAlign = 'center'; labCtx.font = '10px sans-serif'; labCtx.fillText(obj.label, obj.x + obj.width / 2, obj.y + obj.height + 15 + obj.width/2); if (isHighlighted) highlightObjectBorder(obj); labCtx.restore(); }
    function drawPipette(obj, isHighlighted) { labCtx.save(); labCtx.strokeStyle = '#333'; labCtx.lineWidth = 1; const bulbRadius = 10; const bulbY = obj.y + bulbRadius; const bodyStartY = bulbY + bulbRadius * 0.8; const bodyEndY = bodyStartY + obj.height; const tipLength = 10; const tipEndY = bodyEndY + tipLength; const pipetteTotalHeight = tipEndY - obj.y; labCtx.beginPath(); labCtx.arc(obj.x + obj.width / 2, bulbY, bulbRadius, 0, 2 * Math.PI); labCtx.stroke(); labCtx.strokeRect(obj.x, bodyStartY, obj.width, obj.height); labCtx.beginPath(); labCtx.moveTo(obj.x, bodyEndY); labCtx.lineTo(obj.x + obj.width / 2, tipEndY); labCtx.lineTo(obj.x + obj.width, bodyEndY); labCtx.stroke(); if (obj.currentVolume > 0) { const liquidHeightRatio = obj.currentVolume / obj.maxVolume; const liquidBodyHeight = obj.height * liquidHeightRatio; const liquidStartY = bodyEndY - liquidBodyHeight; const color = getLiquidColor(obj.contentsConcentration); labCtx.fillStyle = color; labCtx.fillRect(obj.x + 1, liquidStartY, obj.width - 2, liquidBodyHeight); labCtx.beginPath(); labCtx.moveTo(obj.x + 1, bodyEndY); labCtx.lineTo(obj.x + obj.width / 2, tipEndY); labCtx.lineTo(obj.x + obj.width - 1, bodyEndY); labCtx.closePath(); labCtx.fill(); } if (isHighlighted) highlightObjectBorder(obj, 0, 0, obj.width, pipetteTotalHeight); labCtx.restore(); }
    function drawBeaker(obj, isHighlighted) { labCtx.save(); labCtx.strokeStyle = '#555'; labCtx.lineWidth = 1; labCtx.beginPath(); labCtx.moveTo(obj.x, obj.y); labCtx.lineTo(obj.x + obj.width * 0.1, obj.y + obj.height); labCtx.lineTo(obj.x + obj.width * 0.9, obj.y + obj.height); labCtx.lineTo(obj.x + obj.width, obj.y); labCtx.lineTo(obj.x + obj.width * 1.05, obj.y - obj.height * 0.05); labCtx.lineTo(obj.x - obj.width * 0.05, obj.y - obj.height * 0.05); labCtx.closePath(); labCtx.stroke(); if (obj.currentVolume > 0) { const liquidLevelRatio = Math.min(1, obj.currentVolume / obj.maxVolume); const liquidHeight = obj.height * liquidLevelRatio; const topWidth = obj.width; const bottomWidth = obj.width * 0.8; const currentTopWidth = bottomWidth + (topWidth - bottomWidth) * liquidLevelRatio; const currentY = obj.y + obj.height - liquidHeight; const currentX = obj.x + (obj.width - currentTopWidth) / 2; labCtx.fillStyle = 'rgba(150, 150, 100, 0.5)'; labCtx.beginPath(); labCtx.moveTo(currentX, currentY); labCtx.lineTo(obj.x + obj.width * 0.1, obj.y + obj.height); labCtx.lineTo(obj.x + obj.width * 0.9, obj.y + obj.height); labCtx.lineTo(currentX + currentTopWidth, currentY); labCtx.closePath(); labCtx.fill(); } labCtx.fillStyle = COLORS.label; labCtx.textAlign = 'center'; labCtx.font = '12px sans-serif'; labCtx.fillText(obj.label, obj.x + obj.width / 2, obj.y + obj.height + 15); if (isHighlighted) highlightObjectBorder(obj); labCtx.restore(); }
    function drawSpectrophotometer(obj, isHighlighted) { labCtx.save(); labCtx.fillStyle = '#B0BEC5'; labCtx.fillRect(obj.x, obj.y, obj.width, obj.height); labCtx.strokeStyle = '#546E7A'; labCtx.strokeRect(obj.x, obj.y, obj.width, obj.height); const displayX = obj.x + 20; const displayY = obj.y + 20; const displayWidth = obj.width * 0.6; const displayHeight = obj.height * 0.4; labCtx.fillStyle = '#263238'; labCtx.fillRect(displayX, displayY, displayWidth, displayHeight); labCtx.fillStyle = '#B2FF59'; labCtx.font = 'bold 20px monospace'; labCtx.textAlign = 'right'; labCtx.fillText(spec20State.reading, displayX + displayWidth - 10, displayY + displayHeight / 2 + 8); labCtx.fillStyle = '#76FF03'; labCtx.font = '10px monospace'; labCtx.textAlign = 'left'; const modeText = spec20State.absorbanceMode ? 'Abs' : '%T'; labCtx.fillText(`${modeText} @ ${spec20State.wavelength}nm`, displayX + 5, displayY + displayHeight - 5); const slotX = obj.x + obj.width * 0.8; const slotY = obj.y + 15; const slotWidth = 30; const slotHeight = 60; labCtx.fillStyle = '#455A64'; labCtx.fillRect(slotX, slotY, slotWidth, slotHeight); labCtx.strokeRect(slotX, slotY, slotWidth, slotHeight); labCtx.fillStyle = '#78909C'; labCtx.textAlign = 'center'; labCtx.font = '9px sans-serif'; labCtx.fillText("Cuvette", slotX + slotWidth/2, slotY + slotHeight + 10); if (spec20State.cuvetteInsideId) { const cuvette = findObjectById(spec20State.cuvetteInsideId); if (cuvette) { const cuvetteDrawX = slotX + (slotWidth - cuvette.width) / 2; const cuvetteDrawY = slotY + 5; drawCuvette({ ...cuvette, x: cuvetteDrawX, y: cuvetteDrawY, isInSpec: true }, false); } } labCtx.fillStyle = '#78909C'; labCtx.strokeStyle = '#37474F'; const zb = spec20State.zeroButtonPos; labCtx.fillRect(zb.x, zb.y, zb.width, zb.height); labCtx.strokeRect(zb.x, zb.y, zb.width, zb.height); labCtx.fillStyle = '#FFF'; labCtx.font = 'bold 12px sans-serif'; labCtx.textAlign = 'center'; labCtx.fillText("Zero", zb.x + zb.width / 2, zb.y + zb.height / 2 + 4); const mb = spec20State.measureButtonPos; labCtx.fillStyle = '#78909C'; labCtx.fillRect(mb.x, mb.y, mb.width, mb.height); labCtx.strokeRect(mb.x, mb.y, mb.width, mb.height); labCtx.fillStyle = '#FFF'; labCtx.fillText("Measure", mb.x + mb.width / 2, mb.y + mb.height / 2 + 4); const modeB = spec20State.modeButtonPos; labCtx.fillStyle = '#78909C'; labCtx.fillRect(modeB.x, modeB.y, modeB.width, modeB.height); labCtx.strokeRect(modeB.x, modeB.y, modeB.width, modeB.height); labCtx.fillStyle = '#FFF'; labCtx.fillText(spec20State.absorbanceMode ? "%T" : "Abs", modeB.x + modeB.width / 2, modeB.y + modeB.height / 2 + 4); if (isHighlighted) highlightObjectBorder(obj); labCtx.restore(); }
    function drawCuvette(obj, isHighlighted) { if (obj.isInSpec && !isHighlighted) { return; } labCtx.save(); // Draw glass with background color reflecting cleanliness
        labCtx.fillStyle = obj.isClean ? 'rgba(240, 240, 240, 0.7)' : 'rgba(220, 220, 200, 0.7)'; labCtx.strokeStyle = '#666'; labCtx.lineWidth = 1; labCtx.fillRect(obj.x, obj.y, obj.width, obj.height); labCtx.strokeRect(obj.x, obj.y, obj.width, obj.height); if (obj.currentVolume > 0) { const liquidHeight = obj.height * (obj.currentVolume / obj.maxVolume) * 0.9; const liquidY = obj.y + obj.height - liquidHeight; labCtx.fillStyle = getLiquidColor(obj.concentration); labCtx.fillRect(obj.x + 1, liquidY, obj.width - 2, liquidHeight); } if (isHighlighted) highlightObjectBorder(obj); labCtx.restore(); }
    function highlightObjectBorder(obj, xOffset = 0, yOffset = 0, highlightWidth = obj.width, highlightHeight = obj.height) { labCtx.save(); labCtx.strokeStyle = COLORS.highlight; labCtx.lineWidth = 3; labCtx.setLineDash([5, 3]); labCtx.strokeRect(obj.x + xOffset - 2, obj.y + yOffset - 2, highlightWidth + 4, highlightHeight + 4); labCtx.setLineDash([]); labCtx.lineWidth = 1; labCtx.restore(); }

    // --- Graphing Functions ---
    function drawGraph() { if (!graphCtx) return; graphCtx.clearRect(0, 0, graphCanvas.width, graphCanvas.height); const plotData = dataTableData.filter(d => d.conc !== null && d.id !== 'unknown' && d.negLogT !== null && isFinite(d.negLogT)); const padding = { top: 20, right: 20, bottom: 40, left: 50 }; const plotWidth = graphCanvas.width - padding.left - padding.right; const plotHeight = graphCanvas.height - padding.top - padding.bottom; const allConcValues = plotData.map(d => d.conc); const unknownRow = dataTableData.find(r => r.id === 'unknown'); let calculatedUnknownConc = null; if (unknownRow && unknownRow.negLogT !== null && KNOWN_SLOPE > 0 && isFinite(unknownRow.negLogT)) { calculatedUnknownConc = unknownRow.negLogT / KNOWN_SLOPE; allConcValues.push(calculatedUnknownConc); } allConcValues.push(STOCK_CONCENTRATION); const allAbsValues = plotData.map(d => d.negLogT); if (unknownRow && unknownRow.negLogT !== null && isFinite(unknownRow.negLogT)) { allAbsValues.push(unknownRow.negLogT); } allAbsValues.push(0.1); const maxConc = Math.max(0.1, ...allConcValues) * 1.1 || 1; const maxAbs = Math.max(0.1, ...allAbsValues) * 1.1 || 1; const scaleX = (conc) => padding.left + (conc / maxConc) * plotWidth; const scaleY = (abs) => padding.top + plotHeight - (abs / maxAbs) * plotHeight; graphCtx.strokeStyle = '#333'; graphCtx.lineWidth = 1; graphCtx.beginPath(); graphCtx.moveTo(padding.left, padding.top); graphCtx.lineTo(padding.left, padding.top + plotHeight); graphCtx.lineTo(padding.left + plotWidth, padding.top + plotHeight); graphCtx.stroke(); graphCtx.fillStyle = '#333'; graphCtx.textAlign = 'center'; graphCtx.font = '10px sans-serif'; graphCtx.fillText("Concentration (µM)", padding.left + plotWidth / 2, graphCanvas.height - 5); graphCtx.save(); graphCtx.translate(15, padding.top + plotHeight / 2); graphCtx.rotate(-Math.PI / 2); graphCtx.fillText("Absorbance (-log T)", 0, 0); graphCtx.restore(); graphCtx.textAlign = 'right'; graphCtx.beginPath(); for (let i = 0; i <= 5; i++) { const absValue = (maxAbs / 5) * i; const y = scaleY(absValue); graphCtx.moveTo(padding.left - 5, y); graphCtx.lineTo(padding.left, y); graphCtx.fillText(absValue.toFixed(2), padding.left - 8, y + 3); } graphCtx.textAlign = 'center'; for (let i = 0; i <= 5; i++) { const concValue = (maxConc / 5) * i; const x = scaleX(concValue); graphCtx.moveTo(x, padding.top + plotHeight); graphCtx.lineTo(x, padding.top + plotHeight + 5); graphCtx.fillText(concValue.toFixed(2), x, padding.top + plotHeight + 15); } graphCtx.stroke(); graphCtx.fillStyle = 'blue'; plotData.forEach(d => { graphCtx.beginPath(); graphCtx.arc(scaleX(d.conc), scaleY(d.negLogT), 3, 0, 2 * Math.PI); graphCtx.fill(); }); if (plotData.length > 0 && KNOWN_SLOPE && KNOWN_SLOPE > 0) { graphCtx.strokeStyle = 'red'; graphCtx.lineWidth = 1.5; graphCtx.beginPath(); graphCtx.moveTo(scaleX(0), scaleY(0)); const endConc = maxConc; const endAbs = KNOWN_SLOPE * endConc; if (endAbs <= maxAbs * 1.05) { graphCtx.lineTo(scaleX(endConc), scaleY(endAbs)); } else { const boundedConc = maxAbs / KNOWN_SLOPE; if (isFinite(boundedConc)) graphCtx.lineTo(scaleX(boundedConc), scaleY(maxAbs)); } graphCtx.stroke(); } if (calculatedUnknownConc !== null && unknownRow && unknownRow.negLogT !== null && isFinite(unknownRow.negLogT)) { const unknownX = scaleX(calculatedUnknownConc); const unknownY = scaleY(unknownRow.negLogT); if (unknownX >= padding.left && unknownX <= padding.left + plotWidth && unknownY >= padding.top && unknownY <= padding.top + plotHeight) { graphCtx.fillStyle = 'green'; graphCtx.beginPath(); graphCtx.arc(unknownX, unknownY, 4, 0, 2 * Math.PI); graphCtx.fill(); graphCtx.strokeStyle = 'rgba(0, 128, 0, 0.5)'; graphCtx.lineWidth = 1; graphCtx.setLineDash([3, 3]); graphCtx.beginPath(); graphCtx.moveTo(padding.left, unknownY); graphCtx.lineTo(unknownX, unknownY); graphCtx.stroke(); graphCtx.beginPath(); graphCtx.moveTo(unknownX, unknownY); graphCtx.lineTo(unknownX, padding.top + plotHeight); graphCtx.stroke(); graphCtx.setLineDash([]); } else { console.log("Unknown point calculated outside graph bounds."); } } if (plotData.length === 0 && calculatedUnknownConc === null) { graphCtx.fillStyle = '#777'; graphCtx.textAlign = 'center'; graphCtx.fillText("Graph will appear here", graphCanvas.width/2, graphCanvas.height/2); } }

    // --- Interaction Logic ---
    function isPointOverObject(x, y, obj) { let hit = x >= obj.x && x <= obj.x + obj.width && y >= obj.y && y <= obj.y + obj.height; if (obj.type === 'pipette') { const bulbRadius = 10; const bulbY = obj.y + bulbRadius; const bodyStartY = bulbY + bulbRadius * 0.8; const bodyEndY = bodyStartY + obj.height; const tipLength = 10; const tipEndY = bodyEndY + tipLength; const bulbX = obj.x + obj.width / 2; const dxBulb = x - bulbX; const dyBulb = y - bulbY; if (dxBulb * dxBulb + dyBulb * dyBulb <= bulbRadius * bulbRadius) { hit = true; } else if (x >= obj.x && x <= obj.x + obj.width && y >= bodyStartY && y <= bodyEndY) { hit = true; } else if (y > bodyEndY && y <= tipEndY) { const tipBaseWidth = obj.width; const tipXStart = obj.x; if (x >= tipXStart && x <= tipXStart + tipBaseWidth) { hit = true; } } else { hit = false; } } else if (obj.type === 'spectrophotometer') { if (isPointInRect(x, y, spec20State.zeroButtonPos)) return { ...obj, clickedButton: 'zero' }; if (isPointInRect(x, y, spec20State.measureButtonPos)) return { ...obj, clickedButton: 'measure' }; if (isPointInRect(x, y, spec20State.modeButtonPos)) return { ...obj, clickedButton: 'mode' }; const slotX = obj.x + obj.width * 0.8; const slotY = obj.y + 15; const slotWidth = 30; const slotHeight = 60; if (isPointInRect(x, y, {x: slotX, y: slotY, width: slotWidth, height: slotHeight})) { hit = true; } else if (x >= obj.x && x <= obj.x + obj.width && y >= obj.y && y <= obj.y + obj.height) { hit = true; } else { hit = false; } return hit ? obj : null; } else { hit = x >= obj.x && x <= obj.x + obj.width && y >= obj.y && y <= obj.y + obj.height; } return hit ? obj : null; }
    function getObjectAt(x, y) { for (let i = labObjects.length - 1; i >= 0; i--) { const obj = labObjects[i]; if (obj === draggedObject) continue; const hitResult = isPointOverObject(x, y, obj); if (hitResult && !hitResult.clickedButton) return hitResult; } return null; }
    function getObjectAtMouseDown(x, y) { for (let i = labObjects.length - 1; i >= 0; i--) { const obj = labObjects[i]; const hitResult = isPointOverObject(x, y, obj); if (hitResult) return hitResult; } return null; }
    function isPointInRect(x, y, rect) { return x >= rect.x && x <= rect.x + rect.width && y >= rect.y && y <= rect.y + rect.height; }
    labCanvas.addEventListener('mousedown', (e) => { if (!labCanvas) return; const rect = labCanvas.getBoundingClientRect(); const mouseX = e.clientX - rect.left; const mouseY = e.clientY - rect.top; const clickedObjectResult = getObjectAtMouseDown(mouseX, mouseY); isDragging = false; draggedObject = null; if (clickedObjectResult?.clickedButton) { return; } const clickedObject = clickedObjectResult; if (clickedObject && clickedObject.isDraggable) { draggedObject = findObjectById(clickedObject.id); if (!draggedObject) { console.error("Failed to find draggable object ref:", clickedObject.id); return; } isDragging = true; dragOffsetX = mouseX - draggedObject.x; dragOffsetY = mouseY - draggedObject.y; labObjects = labObjects.filter(obj => obj.id !== draggedObject.id); labObjects.push(draggedObject); highlights = [draggedObject.id]; labCanvas.classList.add('dragging'); drawSimulation(); } });
    labCanvas.addEventListener('mousemove', (e) => { if (!isDragging || !draggedObject) return; const rect = labCanvas.getBoundingClientRect(); const mouseX = e.clientX - rect.left; const mouseY = e.clientY - rect.top; const bulbRadius = 10; const tipLength = 10; const pipetteTotalHeight = bulbRadius*1.8 + draggedObject.height + tipLength; const objWidth = draggedObject.width || 20; const objHeight = (draggedObject.type === 'pipette') ? pipetteTotalHeight : (draggedObject.height || 50); draggedObject.x = Math.max(0, Math.min(labCanvas.width - objWidth, mouseX - dragOffsetX)); draggedObject.y = Math.max(0, Math.min(labCanvas.height - objHeight, mouseY - dragOffsetY)); highlights = []; const potentialTargetResult = getObjectAt(mouseX, mouseY); const potentialTarget = potentialTargetResult ? findObjectById(potentialTargetResult.id) : null; let isValidTarget = false; if (potentialTarget && potentialTarget.isDropTarget) { const stepConfig = instructions[currentStep]; if (stepConfig?.action) { if (draggedObject.type === 'pipette') { if (draggedObject.currentVolume === 0 && stepConfig.action === 'fillPipette' && stepConfig.source === potentialTarget.id) isValidTarget = true; else if (draggedObject.currentVolume > 0 && stepConfig.action === 'dispensePipette' && stepConfig.destination === potentialTarget.id) isValidTarget = true; } else if (draggedObject.type === 'cuvette') { if (stepConfig.action === 'insertCuvette' && stepConfig.destination === potentialTarget.id && potentialTarget.type === 'spectrophotometer') isValidTarget = true; else if (stepConfig.action === 'emptyCuvette' && stepConfig.destination === potentialTarget.id && potentialTarget.id === 'wasteBeaker') isValidTarget = true; else if (potentialTarget.id === 'wasteBeaker') isValidTarget = true; } } else if (draggedObject.type === 'cuvette' && potentialTarget.id === 'wasteBeaker') isValidTarget = true; } if (isValidTarget && potentialTarget) highlights.push(potentialTarget.id); highlights.push(draggedObject.id); drawSimulation(); });
    labCanvas.addEventListener('mouseup', (e) => { const wasDragging = isDragging; isDragging = false; labCanvas.classList.remove('dragging'); const rect = labCanvas.getBoundingClientRect(); const mouseX = e.clientX - rect.left; const mouseY = e.clientY - rect.top; const objectUnderMouseResult = getObjectAtMouseDown(mouseX, mouseY); if (!wasDragging && objectUnderMouseResult?.clickedButton) { if (objectUnderMouseResult.type === 'spectrophotometer') { if (objectUnderMouseResult.clickedButton === 'zero') { tryZeroSpec(); } else if (objectUnderMouseResult.clickedButton === 'measure') { tryMeasure(); } else if (objectUnderMouseResult.clickedButton === 'mode') { tryToggleMode(); } } } else if (wasDragging && draggedObject) { const dropTargetResult = getObjectAt(mouseX, mouseY); const dropTarget = dropTargetResult ? findObjectById(dropTargetResult.id) : null; let stateUpdatedByRemoval = false; const draggedCuvetteRef = (draggedObject.type === 'cuvette') ? findObjectById(draggedObject.id) : null; if (draggedCuvetteRef && draggedCuvetteRef.isInSpec && (!dropTarget || dropTarget.id !== 'spec20')) { draggedCuvetteRef.isInSpec = false; spec20State.cuvetteInsideId = null; spec20State.reading = spec20State.absorbanceMode ? "-- Abs" : "-- %T"; stateUpdatedByRemoval = true; saveState(); } if (dropTarget) { if (draggedObject.type === 'pipette') { if (draggedObject.currentVolume === 0 && (dropTarget.type === 'bottle' || dropTarget.type === 'testTube')) { tryFillPipette(draggedObject.id, dropTarget.id); } else if (draggedObject.currentVolume > 0 && (dropTarget.type === 'testTube' || dropTarget.type === 'cuvette' || dropTarget.type === 'beaker')) { tryDispensePipette(draggedObject.id, dropTarget.id, draggedObject.currentVolume); } } else if (draggedObject.type === 'cuvette') { if (dropTarget.id === 'wasteBeaker') { const configForDrop = instructions[currentStep]; // Pass config to check for markClean
                         tryEmptyCuvette(draggedObject.id, dropTarget.id, configForDrop); } else if (dropTarget.type === 'spectrophotometer') { if (!stateUpdatedByRemoval) { tryInsertCuvette(draggedObject.id, dropTarget.id); } else { showFeedback("Place cuvette elsewhere before re-inserting.", "info"); } } } } draggedObject = null; } highlights = []; updateUI(); });
    undoButton.addEventListener('click', () => { if (historyStack.length > 0) { const prevState = historyStack.pop(); restoreState(prevState); feedback = { message: 'Undo successful.', type: 'info' }; updateUI(); drawGraph(); } undoButton.disabled = historyStack.length === 0; });

    // --- Action Functions ---
    function checkAndProcessInternalStep() { if (!instructions || currentStep < 0 || currentStep >= instructions.length) { return; } let stepConfig = instructions[currentStep]; let processedInternal = false; while (stepConfig && (stepConfig.action === 'info' || stepConfig.action === 'setUnknownFlag')) { processedInternal = true; saveState(); let internalActionSuccess = true; if (stepConfig.action === 'setUnknownFlag') { internalActionSuccess = trySetUnknownFlag(stepConfig.cuvette); } if (internalActionSuccess) { currentStep++; } else { console.error(`Internal action ${stepConfig.action} failed at step ${currentStep}. Halting auto-advance.`); return; } stepConfig = (currentStep < instructions.length) ? instructions[currentStep] : null; } if (processedInternal) { updateUI(); } }
    function tryZeroSpec() { const stepConfig = instructions[currentStep]; if (!stepConfig?.action || stepConfig.action !== 'zeroSpec') { showFeedback(`Incorrect action. ${stepConfig?.hint || 'Follow instructions.'}`, 'error'); return; } const cuvette = spec20State.cuvetteInsideId ? findObjectById(spec20State.cuvetteInsideId) : null; if (!cuvette || Math.abs(cuvette.concentration - 0) > 0.0001) { showFeedback("Cannot zero. Insert Blank (0 µM) cuvette first.", 'error'); return; } saveState(); spec20State.isZeroed = true; const units = spec20State.absorbanceMode ? " Abs" : " %T"; spec20State.reading = spec20State.absorbanceMode ? "0.000" + units : "100.0" + units; currentStep++; showFeedback(`Spectrophotometer zeroed.`, 'success'); checkAndProcessInternalStep(); updateUI(); }
    function tryFillPipette(pipetteId, sourceId) { const stepConfig = instructions[currentStep]; if (!stepConfig?.action || stepConfig.action !== 'fillPipette' || stepConfig.pipette !== pipetteId || stepConfig.source !== sourceId) { showFeedback(`Incorrect action. ${stepConfig?.hint || 'Follow instructions.'}`, 'error'); return; } const pipette = findObjectById(pipetteId); const source = findObjectById(sourceId); const targetVolume = stepConfig.volume; if (!pipette || !source ) { showFeedback("Internal error: Pipette or source not found.", 'error'); return; } if (pipette.currentVolume > 0) { showFeedback("Pipette must be empty before filling.", 'error'); return; } if (source.currentVolume < targetVolume) { showFeedback(`Not enough liquid in ${source.label}. Need ${targetVolume}mL.`, 'error'); return; } saveState(); pipette.currentVolume = targetVolume; pipette.contentsConcentration = source.concentration; source.currentVolume -= targetVolume; currentStep++; showFeedback(`Pipette filled with ${targetVolume}mL from ${source.label}.`, 'success'); checkAndProcessInternalStep(); updateUI(); }
    function tryDispensePipette(pipetteId, destId, volume) { const stepConfig = instructions[currentStep]; if (!stepConfig?.action || stepConfig.action !== 'dispensePipette' || stepConfig.pipette !== pipetteId || stepConfig.destination !== destId) { showFeedback(`Incorrect action. ${stepConfig?.hint || 'Follow instructions.'}`, 'error'); return; } if (stepConfig.volume && Math.abs(volume - stepConfig.volume) > 0.01) { showFeedback(`Incorrect volume dispensed. Expected ${stepConfig.volume}mL.`, 'error'); return; } const pipette = findObjectById(pipetteId); const dest = findObjectById(destId); if (!pipette || !dest) { showFeedback("Internal error: Pipette or destination not found.", 'error'); return; } if (pipette.currentVolume < volume - 0.001) { showFeedback("Not enough liquid in pipette.", 'error'); return; } if (dest.currentVolume + volume > dest.maxVolume + 0.001) { showFeedback(`${dest.label} will overflow.`, 'error'); return; } saveState(); const initialDestVol = dest.currentVolume; const initialDestConc = dest.concentration; const addedVol = volume; const addedConc = pipette.contentsConcentration; const finalVol = initialDestVol + addedVol; let finalConc = 0; if (finalVol > 0.001) { if (initialDestConc === null || initialDestConc === undefined || initialDestVol < 0.001 ) { finalConc = addedConc; } else if (addedConc === null || addedConc === undefined) { finalConc = initialDestConc; } else if (dest.type === 'cuvette' && initialDestConc === 0 && addedConc === 0) { finalConc = 0; } else { finalConc = ((initialDestConc * initialDestVol) + (addedConc * addedVol)) / finalVol; } } dest.currentVolume = finalVol; dest.concentration = finalConc;
        // --- FIX: Do NOT set isClean=false here. Cleanliness is determined by emptying. ---
        // if (dest.type === 'cuvette' && addedConc !== 0) {
        //     // dest.isClean = false; // REMOVED THIS LINE
        // }
    pipette.currentVolume -= addedVol; if (pipette.currentVolume < 0.001) { pipette.currentVolume = 0; pipette.contentsConcentration = 0; } currentStep++; showFeedback(`Dispensed ${volume.toFixed(1)}mL into ${dest.label}.`, 'success'); checkAndProcessInternalStep(); updateUI(); }

    function tryEmptyCuvette(cuvetteId, wasteId, stepConfig) {
        if (wasteId !== 'wasteBeaker') { showFeedback("Can only empty into Waste.", 'error'); return; }
        const cuvette = findObjectById(cuvetteId);
        const waste = findObjectById(wasteId);
        if (!cuvette || !waste) { showFeedback("Internal error.", 'error'); return; }
        if (cuvette.isInSpec) { showFeedback("Cannot empty cuvette while inside the Spectrophotometer. Drag it out first.", 'error'); return; }
        if (cuvette.currentVolume <= 0) { showFeedback("Cuvette is already empty.", 'info'); return; }

        const currentStepConfig = instructions[currentStep];
        let stepCompleted = false;
        const configToCheck = stepConfig || currentStepConfig; // Use passed config if available (from mouseup)
        if (configToCheck?.action === 'emptyCuvette' && configToCheck.cuvette === cuvetteId && configToCheck.destination === wasteId) {
            stepCompleted = true;
        }

        saveState();
        waste.currentVolume += cuvette.currentVolume;
        if (waste.currentVolume > waste.maxVolume) waste.currentVolume = waste.maxVolume;
        cuvette.currentVolume = 0;
        cuvette.concentration = 0;

        // --- FIX: Correctly manage isClean flag based ONLY on emptying action ---
        if (configToCheck?.markClean === true) {
             cuvette.isClean = true; // Becomes clean ONLY after emptying designated rinse water
             console.log("Marking cuvette clean after emptying rinse.");
        } else {
             cuvette.isClean = false; // Becomes dirty after emptying sample or non-final rinse
             console.log("Marking cuvette dirty after emptying sample/intermediate rinse.");
        }

        if (stepCompleted) {
            currentStep++;
            showFeedback(`Cuvette emptied into Waste. ${cuvette.isClean ? 'It is now clean.' : ''} Step complete.`, 'success');
            checkAndProcessInternalStep();
        } else {
            showFeedback(`Cuvette emptied into Waste. ${cuvette.isClean ? 'It is now clean.' : ''}`, 'success');
        }
        updateUI();
    }

    function tryInsertCuvette(cuvetteId, specId) {
        const stepConfig = instructions[currentStep];
        if (!stepConfig?.action || stepConfig.action !== 'insertCuvette' || stepConfig.cuvette !== cuvetteId || stepConfig.destination !== specId) {
            showFeedback(`Incorrect action. ${stepConfig?.hint || 'Follow instructions.'}`, 'error'); return;
        }
        const cuvette = findObjectById(cuvetteId);
        const spec = findObjectById(specId);
        if (!cuvette || !spec) { showFeedback("Internal error: Cuvette or Spectrophotometer not found.", 'error'); return; }
        if (spec20State.cuvetteInsideId) { showFeedback("Spectrophotometer already contains a cuvette.", 'error'); return; }
        if (cuvette.isInSpec) { showFeedback("Cuvette is already in the Spectrophotometer.", 'error'); return; }
        if (cuvette.currentVolume <= 0 && !stepConfig.allowEmpty) { showFeedback("Cannot insert an empty cuvette at this step.", 'error'); return; }

        // --- FIX: Revised Check ---
        // Allow insertion if EITHER the cuvette is marked as clean OR it's the blank being inserted (allowDirtyInsert flag)
        // The concentration check is removed as it was redundant with !isClean
        if (!cuvette.isClean && !stepConfig.allowDirtyInsert) {
            showFeedback("Cuvette must be rinsed before adding a new sample.", 'error');
            console.log(`Insertion failed: isClean=${cuvette.isClean}, allowDirtyInsert=${stepConfig.allowDirtyInsert}`); // Debug log
            return;
        }

        saveState();
        cuvette.isInSpec = true;
        spec20State.cuvetteInsideId = cuvetteId;
        spec20State.reading = spec20State.absorbanceMode ? "-- Abs" : "-- %T";
        // Note: We don't change isClean status upon insertion.
        currentStep++;
        checkAndProcessInternalStep();
        showFeedback(`Cuvette inserted into Spectrophotometer.`, 'success');
        updateUI();
    }
    function tryMeasure() { const stepConfig = instructions[currentStep]; if (!stepConfig?.action || stepConfig.action !== 'measure') { showFeedback(`Incorrect action. ${stepConfig?.hint || 'Follow instructions.'}`, 'error'); return; } if (!spec20State.cuvetteInsideId) { showFeedback("Cannot measure. No cuvette in Spectrophotometer.", 'error'); return; } if (!spec20State.isZeroed) { showFeedback("Cannot measure. Spectrophotometer must be zeroed first.", 'error'); return; } const cuvette = findObjectById(spec20State.cuvetteInsideId); if (!cuvette) { showFeedback("Internal error: Cuvette not found.", 'error'); return; } if (Math.abs(cuvette.concentration - 0) < 0.0001 && !stepConfig.allowBlankMeasure) { showFeedback("Cannot measure the blank again at this step.", 'error'); return; } const concentration = cuvette.concentration; let percentT = getSimulatedPercentT(concentration); let absorbance = -Math.log10(percentT / 100); if (isNaN(absorbance) || !isFinite(absorbance)) absorbance = Infinity; if (absorbance > MAX_ABS) { spec20State.reading = spec20State.absorbanceMode ? `>${MAX_ABS.toFixed(1)} Abs` : "0.0 %T"; showFeedback(`Absorbance too high (> ${MAX_ABS.toFixed(1)}) to measure accurately.`, 'error'); updateUI(); return; } saveState(); if (spec20State.absorbanceMode) { spec20State.reading = (absorbance === Infinity || absorbance > 10) ? '>10 Abs' : absorbance.toFixed(3) + " Abs"; } else { spec20State.reading = percentT.toFixed(1) + " %T"; } let dataRowId = stepConfig.targetDataRowId || 'unknown'; const dataRow = dataTableData.find(row => row.id === dataRowId); if (dataRow) { dataRow.measuredPercentT = percentT.toFixed(1); dataRow.T = (percentT / 100).toFixed(3); dataRow.negLogT = (absorbance === Infinity || absorbance > 10) ? Infinity : parseFloat(absorbance.toFixed(4)); } else { console.error("Could not find data row with ID:", dataRowId); } currentStep++; showFeedback(`Measurement complete: ${spec20State.reading}.`, 'success'); checkAndProcessInternalStep(); updateUI(); drawGraph(); }
    function tryToggleMode() { spec20State.absorbanceMode = !spec20State.absorbanceMode; if (spec20State.cuvetteInsideId && spec20State.reading !== '-- %T' && spec20State.reading !== '-- Abs' && !spec20State.reading.startsWith('>')) { const readingParts = spec20State.reading.split(" "); const currentValue = parseFloat(readingParts[0]); let absorbance, percentT; if (!spec20State.absorbanceMode) { absorbance = currentValue; percentT = Math.pow(10, -absorbance) * 100; spec20State.reading = percentT.toFixed(1) + " %T"; } else { percentT = currentValue; absorbance = -Math.log10(percentT / 100); if (isNaN(absorbance) || !isFinite(absorbance)) absorbance = Infinity; spec20State.reading = (absorbance === Infinity || absorbance > 10) ? '>10 Abs' : absorbance.toFixed(3) + " Abs"; } } else if (spec20State.isZeroed && spec20State.cuvetteInsideId && findObjectById(spec20State.cuvetteInsideId).concentration === 0) { spec20State.reading = spec20State.absorbanceMode ? "0.000 Abs" : "100.0 %T"; } else if (spec20State.reading.startsWith('>')) { spec20State.reading = spec20State.absorbanceMode ? `>${MAX_ABS.toFixed(1)} Abs` : "0.0 %T"; } else { spec20State.reading = spec20State.absorbanceMode ? "-- Abs" : "-- %T"; } showFeedback(`Display mode changed to: ${spec20State.absorbanceMode ? 'Absorbance' : '%Transmittance'}.`, 'info'); updateUI(); }
    function trySetUnknownFlag(cuvetteId) { const cuvette = findObjectById(cuvetteId); if (!cuvette) { console.error("Internal error: Cuvette not found for unknown flag step."); showFeedback("Internal simulation error setting unknown flag.", "error"); return false; } console.log("ACTION: Setting concentration flag to -1 for cuvette:", cuvetteId); cuvette.concentration = -1; return true; }


    // --- UI Update ---
    function updateUI() { try { const stepConfig = instructions[currentStep]; highlights = []; const totalSteps = instructions.length -1; if (stepConfig) { instructionEl.innerHTML = `<b>Step ${currentStep + 1} / ${totalSteps}:</b> ${stepConfig.text}`; if(stepConfig.highlight) { highlights = [...stepConfig.highlight]; } } else { const finalStepIndex = instructions.length - 1; if (finalStepIndex >= 0 && instructions[finalStepIndex]) { instructionEl.innerHTML = `<b>${instructions[finalStepIndex].text}</b>`; } else { instructionEl.textContent = "Experiment Complete!"; } } feedbackEl.textContent = feedback.message; feedbackEl.className = feedback.type; resultsTbody.innerHTML = ''; dataTableData.forEach(row => { const tr = document.createElement('tr'); let displayConc = row.conc; let displayAbs = row.negLogT; if (row.id === 'unknown') { if (row.negLogT !== null && KNOWN_SLOPE > 0 && isFinite(row.negLogT)) { displayConc = (row.negLogT / KNOWN_SLOPE).toFixed(3); displayAbs = parseFloat(row.negLogT).toFixed(4); } else if (row.negLogT === Infinity) { displayConc = 'Too High'; displayAbs = `>${MAX_ABS.toFixed(1)}`; } else { displayConc = 'N/A'; displayAbs = '--'; } } else { displayConc = (displayConc !== null) ? displayConc.toFixed(3) : '--'; if(displayAbs === Infinity || displayAbs > 10) displayAbs = `>${MAX_ABS.toFixed(1)}`; else if(displayAbs !== null) displayAbs = parseFloat(displayAbs).toFixed(4); else displayAbs = '--'; } tr.innerHTML = `<td>${row.solution}</td><td>${row.dilution}</td><td>${displayConc}</td><td>${row.measuredPercentT !== null ? row.measuredPercentT : '--'}</td><td>${row.T !== null ? row.T : '--'}</td><td>${displayAbs}</td>`; resultsTbody.appendChild(tr); }); const measureCompleteStep = instructions.findIndex(instr => instr.id === 'graph_analysis'); if (measureCompleteStep > -1 && currentStep >= measureCompleteStep) { slopeDisplayEl.textContent = `Calibration Line Slope (Abs/µM) ≈ ${KNOWN_SLOPE}`; } else { slopeDisplayEl.textContent = ''; } const unknownRow = dataTableData.find(r => r.id === 'unknown'); if (unknownRow && unknownRow.negLogT !== null && KNOWN_SLOPE > 0) { if (isFinite(unknownRow.negLogT)) { const measuredAbs = parseFloat(unknownRow.negLogT); const calculatedConc = (measuredAbs / KNOWN_SLOPE); unknownResultEl.innerHTML = `<b>Unknown Drink Conc. ≈ ${calculatedConc.toFixed(3)} µM</b><br><small><i>Calc: Conc = Abs / Slope = ${measuredAbs.toFixed(4)} / ${KNOWN_SLOPE}</i></small>`; } else if (unknownRow.negLogT === Infinity){ unknownResultEl.innerHTML = `<b>Unknown Concentration Too High</b><br><small><i>Absorbance > ${MAX_ABS.toFixed(1)}.</i></small>`; } else { unknownResultEl.textContent = ''; } } else { unknownResultEl.textContent = ''; } undoButton.disabled = historyStack.length === 0; drawSimulation(); } catch (error) { console.error("Error during updateUI:", error); if (feedbackEl) showFeedback("An error occurred updating the interface. Check console.", "error"); else console.error("Feedback element also unavailable."); } }

    // --- Instructions Definition (Rinse steps added previously) ---
    // --- FIX: Added allowDirtyInsert flag for re-measuring blank ---
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
        { step: 20, text: "Zero Spectrophotometer: Fill Pipette (~3mL) from Blank Tube '0/10'.", action: 'fillPipette', pipette: 'pipette', source: 'tube_0_10', volume: RINSE_VOLUME, highlight: ['pipette', 'tube_0_10'] },
        { step: 21, text: "Dispense Blank into the Cuvette.", action: 'dispensePipette', pipette: 'pipette', destination: 'cuvette', volume: RINSE_VOLUME, highlight: ['pipette', 'cuvette'] },
        { step: 22, text: "Place Cuvette (with Blank) into the Spectrophotometer.", action: 'insertCuvette', cuvette: 'cuvette', destination: 'spec20', allowEmpty: false, allowDirtyInsert: true, highlight: ['cuvette', 'spec20'] }, // Allow insert even if not marked clean yet
        { step: 23, text: "Click the 'Zero' button on the Spectrophotometer.", action: 'zeroSpec', hint:"Click the 'Zero' button.", highlight: ['spec20'] },
        // Empty Blank + Rinse
        { step: 24, text: "Empty the Blank Cuvette: Drag Cuvette from Spec to Waste.", action: 'emptyCuvette', cuvette: 'cuvette', destination: 'wasteBeaker', markClean: false, hint: "Drag cuvette out of Spec first, then drag to Waste.", highlight: ['cuvette', 'wasteBeaker'] },
        { step: 25, text: "Rinse Cuvette 1/3: Fill Pipette with Water (~3mL).", action: 'fillPipette', pipette: 'pipette', source: 'waterBottle', volume: RINSE_VOLUME, highlight: ['pipette', 'waterBottle'] },
        { step: 26, text: "Rinse Cuvette 2/3: Dispense Water into the Cuvette.", action: 'dispensePipette', pipette: 'pipette', destination: 'cuvette', volume: RINSE_VOLUME, highlight: ['pipette', 'cuvette'] },
        { step: 27, text: "Rinse Cuvette 3/3: Empty rinse water into Waste (Drag Cuvette to Waste).", action: 'emptyCuvette', cuvette: 'cuvette', destination: 'wasteBeaker', markClean: true, hint: "Drag cuvette to Waste.", highlight: ['cuvette', 'wasteBeaker'] }, // Mark clean here
        // Measure Sample 1 + Rinse
        { step: 28, text: "Measure Sample 1 (10/0): Fill Pipette (~3mL) from Tube '10/0'.", action: 'fillPipette', pipette: 'pipette', source: 'tube_10_0', volume: RINSE_VOLUME, highlight: ['pipette', 'tube_10_0'] },
        { step: 29, text: "Dispense Sample 1 into the *clean* Cuvette.", action: 'dispensePipette', pipette: 'pipette', destination: 'cuvette', volume: RINSE_VOLUME, highlight: ['pipette', 'cuvette'] },
        { step: 30, text: "Place Cuvette (Sample 1) into Spec.", action: 'insertCuvette', cuvette: 'cuvette', destination: 'spec20', highlight: ['cuvette', 'spec20'] }, // Should pass check now
        { step: 31, text: "Click the 'Measure' button.", action: 'measure', targetDataRowId: 'tube_10_0', highlight: ['spec20'] },
        { step: 32, text: "Empty Sample 1 Cuvette: Drag Cuvette to Waste.", action: 'emptyCuvette', cuvette: 'cuvette', destination: 'wasteBeaker', markClean: false, highlight: ['cuvette', 'wasteBeaker'] }, // Mark dirty
        { step: 33, text: "Rinse Cuvette 1/3: Fill Pipette with Water.", action: 'fillPipette', pipette: 'pipette', source: 'waterBottle', volume: RINSE_VOLUME, highlight: ['pipette', 'waterBottle'] },
        { step: 34, text: "Rinse Cuvette 2/3: Dispense Water into Cuvette.", action: 'dispensePipette', pipette: 'pipette', destination: 'cuvette', volume: RINSE_VOLUME, highlight: ['pipette', 'cuvette'] },
        { step: 35, text: "Rinse Cuvette 3/3: Empty rinse water into Waste.", action: 'emptyCuvette', cuvette: 'cuvette', destination: 'wasteBeaker', markClean: true, highlight: ['cuvette', 'wasteBeaker'] }, // Mark clean
        // Measure Sample 2 + Rinse
        { step: 36, text: "Measure Sample 2 (8/2): Fill Pipette from Tube '8/2'.", action: 'fillPipette', pipette: 'pipette', source: 'tube_8_2', volume: RINSE_VOLUME, highlight: ['pipette', 'tube_8_2'] },
        { step: 37, text: "Dispense Sample 2 into Cuvette.", action: 'dispensePipette', pipette: 'pipette', destination: 'cuvette', volume: RINSE_VOLUME, highlight: ['pipette', 'cuvette'] },
        { step: 38, text: "Place Cuvette (Sample 2) into Spec.", action: 'insertCuvette', cuvette: 'cuvette', destination: 'spec20', highlight: ['cuvette', 'spec20'] },
        { step: 39, text: "Click 'Measure'.", action: 'measure', targetDataRowId: 'tube_8_2', highlight: ['spec20'] },
        { step: 40, text: "Empty Sample 2 Cuvette: Drag Cuvette to Waste.", action: 'emptyCuvette', cuvette: 'cuvette', destination: 'wasteBeaker', markClean: false, highlight: ['cuvette', 'wasteBeaker'] },
        { step: 41, text: "Rinse Cuvette 1/3: Fill Pipette with Water.", action: 'fillPipette', pipette: 'pipette', source: 'waterBottle', volume: RINSE_VOLUME, highlight: ['pipette', 'waterBottle'] },
        { step: 42, text: "Rinse Cuvette 2/3: Dispense Water into Cuvette.", action: 'dispensePipette', pipette: 'pipette', destination: 'cuvette', volume: RINSE_VOLUME, highlight: ['pipette', 'cuvette'] },
        { step: 43, text: "Rinse Cuvette 3/3: Empty rinse water into Waste.", action: 'emptyCuvette', cuvette: 'cuvette', destination: 'wasteBeaker', markClean: true, highlight: ['cuvette', 'wasteBeaker'] },
        // Measure Sample 3 + Rinse
        { step: 44, text: "Measure Sample 3 (6/4): Fill Pipette from Tube '6/4'.", action: 'fillPipette', pipette: 'pipette', source: 'tube_6_4', volume: RINSE_VOLUME, highlight: ['pipette', 'tube_6_4'] },
        { step: 45, text: "Dispense Sample 3 into Cuvette.", action: 'dispensePipette', pipette: 'pipette', destination: 'cuvette', volume: RINSE_VOLUME, highlight: ['pipette', 'cuvette'] },
        { step: 46, text: "Place Cuvette (Sample 3) into Spec.", action: 'insertCuvette', cuvette: 'cuvette', destination: 'spec20', highlight: ['cuvette', 'spec20'] },
        { step: 47, text: "Click 'Measure'.", action: 'measure', targetDataRowId: 'tube_6_4', highlight: ['spec20'] },
        { step: 48, text: "Empty Sample 3 Cuvette: Drag Cuvette to Waste.", action: 'emptyCuvette', cuvette: 'cuvette', destination: 'wasteBeaker', markClean: false, highlight: ['cuvette', 'wasteBeaker'] },
        { step: 49, text: "Rinse Cuvette 1/3: Fill Pipette with Water.", action: 'fillPipette', pipette: 'pipette', source: 'waterBottle', volume: RINSE_VOLUME, highlight: ['pipette', 'waterBottle'] },
        { step: 50, text: "Rinse Cuvette 2/3: Dispense Water into Cuvette.", action: 'dispensePipette', pipette: 'pipette', destination: 'cuvette', volume: RINSE_VOLUME, highlight: ['pipette', 'cuvette'] },
        { step: 51, text: "Rinse Cuvette 3/3: Empty rinse water into Waste.", action: 'emptyCuvette', cuvette: 'cuvette', destination: 'wasteBeaker', markClean: true, highlight: ['cuvette', 'wasteBeaker'] },
        // Measure Sample 4 + Rinse
        { step: 52, text: "Measure Sample 4 (4/6): Fill Pipette from Tube '4/6'.", action: 'fillPipette', pipette: 'pipette', source: 'tube_4_6', volume: RINSE_VOLUME, highlight: ['pipette', 'tube_4_6'] },
        { step: 53, text: "Dispense Sample 4 into Cuvette.", action: 'dispensePipette', pipette: 'pipette', destination: 'cuvette', volume: RINSE_VOLUME, highlight: ['pipette', 'cuvette'] },
        { step: 54, text: "Place Cuvette (Sample 4) into Spec.", action: 'insertCuvette', cuvette: 'cuvette', destination: 'spec20', highlight: ['cuvette', 'spec20'] },
        { step: 55, text: "Click 'Measure'.", action: 'measure', targetDataRowId: 'tube_4_6', highlight: ['spec20'] },
        { step: 56, text: "Empty Sample 4 Cuvette: Drag Cuvette to Waste.", action: 'emptyCuvette', cuvette: 'cuvette', destination: 'wasteBeaker', markClean: false, highlight: ['cuvette', 'wasteBeaker'] },
        { step: 57, text: "Rinse Cuvette 1/3: Fill Pipette with Water.", action: 'fillPipette', pipette: 'pipette', source: 'waterBottle', volume: RINSE_VOLUME, highlight: ['pipette', 'waterBottle'] },
        { step: 58, text: "Rinse Cuvette 2/3: Dispense Water into Cuvette.", action: 'dispensePipette', pipette: 'pipette', destination: 'cuvette', volume: RINSE_VOLUME, highlight: ['pipette', 'cuvette'] },
        { step: 59, text: "Rinse Cuvette 3/3: Empty rinse water into Waste.", action: 'emptyCuvette', cuvette: 'cuvette', destination: 'wasteBeaker', markClean: true, highlight: ['cuvette', 'wasteBeaker'] },
        // Measure Sample 5 + Rinse
        { step: 60, text: "Measure Sample 5 (2/8): Fill Pipette from Tube '2/8'.", action: 'fillPipette', pipette: 'pipette', source: 'tube_2_8', volume: RINSE_VOLUME, highlight: ['pipette', 'tube_2_8'] },
        { step: 61, text: "Dispense Sample 5 into Cuvette.", action: 'dispensePipette', pipette: 'pipette', destination: 'cuvette', volume: RINSE_VOLUME, highlight: ['pipette', 'cuvette'] },
        { step: 62, text: "Place Cuvette (Sample 5) into Spec.", action: 'insertCuvette', cuvette: 'cuvette', destination: 'spec20', highlight: ['cuvette', 'spec20'] },
        { step: 63, text: "Click 'Measure'.", action: 'measure', targetDataRowId: 'tube_2_8', highlight: ['spec20'] },
        { step: 64, text: "Empty Sample 5 Cuvette: Drag Cuvette to Waste.", action: 'emptyCuvette', cuvette: 'cuvette', destination: 'wasteBeaker', markClean: false, highlight: ['cuvette', 'wasteBeaker'] },
        { step: 65, text: "Rinse Cuvette 1/3: Fill Pipette with Water.", action: 'fillPipette', pipette: 'pipette', source: 'waterBottle', volume: RINSE_VOLUME, highlight: ['pipette', 'waterBottle'] },
        { step: 66, text: "Rinse Cuvette 2/3: Dispense Water into Cuvette.", action: 'dispensePipette', pipette: 'pipette', destination: 'cuvette', volume: RINSE_VOLUME, highlight: ['pipette', 'cuvette'] },
        { step: 67, text: "Rinse Cuvette 3/3: Empty rinse water into Waste.", action: 'emptyCuvette', cuvette: 'cuvette', destination: 'wasteBeaker', markClean: true, highlight: ['cuvette', 'wasteBeaker'] },
        // Measure Blank again + Rinse
        { step: 68, text: "Measure Blank (0/10) again: Fill Pipette from Tube '0/10'.", action: 'fillPipette', pipette: 'pipette', source: 'tube_0_10', volume: RINSE_VOLUME, highlight: ['pipette', 'tube_0_10'] },
        { step: 69, text: "Dispense Blank into Cuvette.", action: 'dispensePipette', pipette: 'pipette', destination: 'cuvette', volume: RINSE_VOLUME, highlight: ['pipette', 'cuvette'] },
        { step: 70, text: "Place Cuvette (Blank) into Spec.", action: 'insertCuvette', cuvette: 'cuvette', destination: 'spec20', allowEmpty: false, allowDirtyInsert: true, highlight: ['cuvette', 'spec20'] }, // Allow inserting blank
        { step: 71, text: "Click 'Measure' (Should read ~100%T / ~0 Abs).", action: 'measure', targetDataRowId: 'tube_0_10', allowBlankMeasure: true, highlight: ['spec20'] },
        { step: 72, text: "Empty the Blank Cuvette: Drag Cuvette to Waste.", action: 'emptyCuvette', cuvette: 'cuvette', destination: 'wasteBeaker', markClean: false, highlight: ['cuvette', 'wasteBeaker'] },
        { step: 73, text: "Rinse Cuvette 1/3: Fill Pipette with Water.", action: 'fillPipette', pipette: 'pipette', source: 'waterBottle', volume: RINSE_VOLUME, highlight: ['pipette', 'waterBottle'] },
        { step: 74, text: "Rinse Cuvette 2/3: Dispense Water into Cuvette.", action: 'dispensePipette', pipette: 'pipette', destination: 'cuvette', volume: RINSE_VOLUME, highlight: ['pipette', 'cuvette'] },
        { step: 75, text: "Rinse Cuvette 3/3: Empty rinse water into Waste.", action: 'emptyCuvette', cuvette: 'cuvette', destination: 'wasteBeaker', markClean: true, highlight: ['cuvette', 'wasteBeaker'] },
        // Graph Analysis Info Step
        { step: 76, id: 'graph_analysis', text: "Calibration complete. Observe Data Table & Graph. Note the slope.", action:'info', highlight: ['data-panel', 'graph-panel', 'slope-display'] },
        // Measure Unknown
        { step: 77, text: "Measure Unknown: Fill Pipette (~3mL) from 'Unknown Drink'.", action: 'fillPipette', pipette: 'pipette', source: 'unknownBottle', volume: RINSE_VOLUME, highlight: ['pipette', 'unknownBottle'] },
        { step: 78, text: "Dispense Unknown into the clean Cuvette.", action: 'dispensePipette', pipette: 'pipette', destination: 'cuvette', volume: RINSE_VOLUME, highlight: ['pipette', 'cuvette'] },
        { step: 79, text: "Set Cuvette as Unknown (Internal Step - Auto).", action: 'setUnknownFlag', cuvette: 'cuvette' },
        { step: 80, text: "Place Cuvette (Unknown) into Spec.", action: 'insertCuvette', cuvette: 'cuvette', destination: 'spec20', highlight: ['cuvette', 'spec20'] },
        { step: 81, text: "Click 'Measure' to find the absorbance of the Unknown.", action: 'measure', targetDataRowId: 'unknown', highlight: ['spec20'] },
        // Final Info Steps
        { step: 82, text: "Result recorded. Use Abs and Slope to find concentration.", action:'info', highlight: ['data-panel', 'unknown-result', 'graph-panel'] },
        { step: 83, text: "Experiment Complete! Analysis finished." },
    ];


    // --- Initial Setup ---
    try {
        initializeState();
        updateUI();
        drawGraph();
        checkAndProcessInternalStep();
        console.log("Initialization complete. Simulation running.");
        showFeedback("Welcome! Follow the instructions.", "info");
    } catch (error) {
        console.error("Error during initial setup:", error);
        if(instructionEl) instructionEl.textContent = "ERROR during initialization. Check console.";
        if(typeof showFeedback === 'function') {
           showFeedback("Error initializing simulation. Check console.", "error");
        } else {
            const fbElement = document.getElementById('feedback-message');
            if (fbElement) { fbElement.textContent = "Error initializing simulation. Check console."; fbElement.className = "error"; }
        }
    }

}); // End DOMContentLoaded listener
