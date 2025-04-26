// renderer.js
import { getState } from './state.js';
import * as config from './config.js';

let labCtx = null;
let graphCtx = null;

// --- Initialization ---
export function initRenderer(labContext, graphContext) {
    labCtx = labContext;
    graphCtx = graphContext;
}

// --- Drawing Functions ---
function drawBottle(obj, isHighlighted) {
    if (!labCtx) return;
    labCtx.save();
    labCtx.fillStyle = config.COLORS.glass;
    labCtx.fillRect(obj.x, obj.y, obj.width, obj.height);
    labCtx.strokeRect(obj.x, obj.y, obj.width, obj.height);
    labCtx.fillRect(obj.x + obj.width * 0.3, obj.y - obj.height * 0.1, obj.width * 0.4, obj.height * 0.1);
    labCtx.strokeRect(obj.x + obj.width * 0.3, obj.y - obj.height * 0.1, obj.width * 0.4, obj.height * 0.1);
    const liquidHeight = obj.height * (obj.currentVolume / obj.maxVolume) * 0.95;
    labCtx.fillStyle = getLiquidColor(obj.concentration);
    labCtx.fillRect(obj.x + 2, obj.y + obj.height - liquidHeight, obj.width - 4, liquidHeight);
    labCtx.fillStyle = config.COLORS.label;
    labCtx.textAlign = 'center';
    labCtx.font = '10px sans-serif';
    labCtx.fillText(obj.label, obj.x + obj.width / 2, obj.y + obj.height + 12);
    if (isHighlighted) highlightObjectBorder(obj);
    labCtx.restore();
}

function drawTestTube(obj, isHighlighted) {
    if (!labCtx) return;
    labCtx.save();
    labCtx.strokeStyle = '#555';
    labCtx.fillStyle = 'rgba(230, 230, 230, 0.5)';
    labCtx.fillRect(obj.x, obj.y, obj.width, obj.height);
    labCtx.strokeRect(obj.x, obj.y, obj.width, obj.height);
    labCtx.beginPath();
    labCtx.arc(obj.x + obj.width / 2, obj.y + obj.height, obj.width / 2, 0, Math.PI);
    labCtx.stroke();
    labCtx.fillStyle = 'rgba(230, 230, 230, 0.5)';
    labCtx.fill();
    if (obj.currentVolume > 0 && obj.maxVolume > 0) {
        const liquidLevelRatio = obj.currentVolume / obj.maxVolume;
        const liquidLevel = obj.height * liquidLevelRatio;
        const liquidColor = getLiquidColor(obj.concentration);
        labCtx.fillStyle = liquidColor;
        const tubeRadius = obj.width / 2;
        const liquidTopY = obj.y + obj.height - liquidLevel;
        const rectFillHeight = Math.max(0, liquidLevel - tubeRadius);
        if (rectFillHeight > 0) {
            labCtx.fillRect(obj.x + 1, liquidTopY, obj.width - 2, rectFillHeight);
        }
        const arcFillHeight = Math.min(liquidLevel, tubeRadius);
        if (arcFillHeight > 0) {
            const angle = Math.acos(Math.max(-1, Math.min(1, 1 - arcFillHeight / tubeRadius)));
            const startAngle = Math.PI - angle;
            const endAngle = angle;
            labCtx.beginPath();
            labCtx.arc(obj.x + tubeRadius, obj.y + obj.height, tubeRadius, startAngle, endAngle);
            const arcStartX = obj.x + tubeRadius - Math.sin(angle) * tubeRadius;
            const arcEndX = obj.x + tubeRadius + Math.sin(angle) * tubeRadius;
            const connectY = liquidTopY + rectFillHeight;
            labCtx.lineTo(arcEndX, connectY);
            labCtx.lineTo(arcStartX, connectY);
            labCtx.closePath();
            labCtx.fill();
        }
    }
    labCtx.fillStyle = config.COLORS.label;
    labCtx.textAlign = 'center';
    labCtx.font = '10px sans-serif';
    labCtx.fillText(obj.label, obj.x + obj.width / 2, obj.y + obj.height + 15 + obj.width / 2);
    if (isHighlighted) highlightObjectBorder(obj);
    labCtx.restore();
}

// --- Realistic Pipette Drawing Function ---
function drawPipette(obj, isHighlighted) {
    if (!labCtx) return;
    labCtx.save();
    labCtx.strokeStyle = '#333';
    labCtx.lineWidth = 1;

    // Define geometry based on obj properties
    const bodyStartX = obj.x;
    const bodyStartY = obj.y;
    const bodyEndY = bodyStartY + obj.height;

    // --- ADJUSTMENT: Bulb size reduced by 20% from 2.0 factor ---
    const bulbRadius = obj.width * 1.6; // Bulb proportionally wider (was 2.0)
    const bulbCenterX = bodyStartX + obj.width / 2;
    const bulbCenterY = bodyStartY - bulbRadius * 0.7;
    const bulbTopY = bulbCenterY - bulbRadius;

    const tipLength = 18;
    const tipEndY = bodyEndY + tipLength;

    const pipetteTotalHeight = tipEndY - bulbTopY;
    const pipetteTotalVisualWidth = bulbRadius * 2; // Width based on bulb now
    const pipetteVisualX = bulbCenterX - bulbRadius;

    // Draw Bulb
    labCtx.fillStyle = 'rgba(210, 210, 220, 0.6)';
    labCtx.beginPath();
    labCtx.arc(bulbCenterX, bulbCenterY, bulbRadius, 0, Math.PI * 2);
    labCtx.closePath();
    labCtx.fill();
    labCtx.stroke();

    // Draw Body
    labCtx.fillStyle = 'rgba(230, 230, 240, 0.5)';
    labCtx.fillRect(bodyStartX, bodyStartY, obj.width, obj.height);
    labCtx.strokeRect(bodyStartX, bodyStartY, obj.width, obj.height);

    // Draw Graduations
    labCtx.strokeStyle = '#778';
    labCtx.lineWidth = 0.5;
    const numMarks = 10;
    const majorMarkInterval = 5;
    labCtx.font = '6px sans-serif';
    labCtx.fillStyle = '#445';
    labCtx.textAlign = 'right';

    for (let i = 1; i <= numMarks; i++) {
        const markY = bodyEndY - (i / numMarks) * obj.height;
        const isMajorMark = (i % majorMarkInterval === 0) || i === numMarks;
        const markWidth = isMajorMark ? obj.width : obj.width * 0.6;
        const markX = bodyStartX + (obj.width - markWidth) / 2;
        labCtx.beginPath();
        labCtx.moveTo(markX, markY);
        labCtx.lineTo(markX + markWidth, markY);
        labCtx.stroke();
        if (isMajorMark) {
            labCtx.fillText(i.toString(), bodyStartX - 2, markY + 2);
        }
    }
    labCtx.lineWidth = 1;
    labCtx.strokeStyle = '#333';

    // Draw Tip
    labCtx.fillStyle = 'rgba(230, 230, 240, 0.5)';
    labCtx.beginPath();
    labCtx.moveTo(bodyStartX, bodyEndY);
    labCtx.lineTo(bulbCenterX, tipEndY);
    labCtx.lineTo(bodyStartX + obj.width, bodyEndY);
    labCtx.closePath();
    labCtx.fill();
    labCtx.stroke();

    // Draw Liquid
    if (obj.currentVolume > 0) {
        const liquidHeightRatio = obj.currentVolume / obj.maxVolume;
        const liquidBodyHeight = obj.height * liquidHeightRatio;
        const liquidTopY = bodyEndY - liquidBodyHeight;
        const color = getLiquidColor(obj.contentsConcentration);
        labCtx.fillStyle = color;
        const actualLiquidBodyHeight = Math.max(0, bodyEndY - Math.max(bodyStartY, liquidTopY));
        const actualLiquidBodyTopY = Math.max(bodyStartY, liquidTopY);
        if (actualLiquidBodyHeight > 0) {
             labCtx.fillRect(bodyStartX + 1, actualLiquidBodyTopY, obj.width - 2, actualLiquidBodyHeight);
        }
        if (liquidTopY <= bodyEndY) {
             labCtx.beginPath();
             labCtx.moveTo(bodyStartX + 1, bodyEndY);
             labCtx.lineTo(bulbCenterX, tipEndY);
             labCtx.lineTo(bodyStartX + obj.width - 1, bodyEndY);
             labCtx.closePath();
             labCtx.fill();
        }
    }

    // Highlight
    if (isHighlighted) {
        highlightObjectBorder(
            { ...obj, x: pipetteVisualX, y: bulbTopY, width: pipetteTotalVisualWidth, height: pipetteTotalHeight },
            0, 0, pipetteTotalVisualWidth, pipetteTotalHeight
        );
    }
    labCtx.restore();
}


function drawBeaker(obj, isHighlighted) {
    if (!labCtx) return;
    labCtx.save();
    labCtx.strokeStyle = '#555';
    labCtx.lineWidth = 1;
    labCtx.beginPath();
    labCtx.moveTo(obj.x, obj.y);
    labCtx.lineTo(obj.x + obj.width * 0.1, obj.y + obj.height);
    labCtx.lineTo(obj.x + obj.width * 0.9, obj.y + obj.height);
    labCtx.lineTo(obj.x + obj.width, obj.y);
    labCtx.lineTo(obj.x + obj.width * 1.05, obj.y - obj.height * 0.05);
    labCtx.lineTo(obj.x - obj.width * 0.05, obj.y - obj.height * 0.05);
    labCtx.closePath();
    labCtx.stroke();
    if (obj.currentVolume > 0) {
        const liquidLevelRatio = Math.min(1, obj.currentVolume / obj.maxVolume);
        const liquidHeight = obj.height * liquidLevelRatio;
        const topWidth = obj.width;
        const bottomWidth = obj.width * 0.8;
        const currentTopWidth = bottomWidth + (topWidth - bottomWidth) * liquidLevelRatio;
        const currentY = obj.y + obj.height - liquidHeight;
        const currentX = obj.x + (obj.width - currentTopWidth) / 2;
        labCtx.fillStyle = 'rgba(150, 150, 100, 0.5)';
        labCtx.beginPath();
        labCtx.moveTo(currentX, currentY);
        labCtx.lineTo(obj.x + obj.width * 0.1, obj.y + obj.height);
        labCtx.lineTo(obj.x + obj.width * 0.9, obj.y + obj.height);
        labCtx.lineTo(currentX + currentTopWidth, currentY);
        labCtx.closePath();
        labCtx.fill();
    }
    labCtx.fillStyle = config.COLORS.label;
    labCtx.textAlign = 'center';
    labCtx.font = '12px sans-serif';
    labCtx.fillText(obj.label, obj.x + obj.width / 2, obj.y + obj.height + 15);
    if (isHighlighted) highlightObjectBorder(obj);
    labCtx.restore();
}

function drawSpectrophotometer(obj, isHighlighted) {
    if (!labCtx) return;
    const state = getState(); // Get current state
    labCtx.save();
    labCtx.fillStyle = '#B0BEC5';
    labCtx.fillRect(obj.x, obj.y, obj.width, obj.height);
    labCtx.strokeStyle = '#546E7A';
    labCtx.strokeRect(obj.x, obj.y, obj.width, obj.height);
    const displayX = obj.x + 20;
    const displayY = obj.y + 20;
    const displayWidth = obj.width * 0.6;
    const displayHeight = obj.height * 0.4;
    labCtx.fillStyle = '#263238';
    labCtx.fillRect(displayX, displayY, displayWidth, displayHeight);
    labCtx.fillStyle = '#B2FF59';
    labCtx.font = 'bold 20px monospace';
    labCtx.textAlign = 'right';
    labCtx.fillText(state.spec20State.reading, displayX + displayWidth - 10, displayY + displayHeight / 2 + 8);
    labCtx.fillStyle = '#76FF03';
    labCtx.font = '10px monospace';
    labCtx.textAlign = 'left';
    const modeText = state.spec20State.absorbanceMode ? 'Abs' : '%T';
    labCtx.fillText(`${modeText} @ ${state.spec20State.wavelength}nm`, displayX + 5, displayY + displayHeight - 5);
    const slotX = obj.x + obj.width * 0.8;
    const slotY = obj.y + 15;
    const slotWidth = 30;
    const slotHeight = 60;
    labCtx.fillStyle = '#455A64';
    labCtx.fillRect(slotX, slotY, slotWidth, slotHeight);
    labCtx.strokeRect(slotX, slotY, slotWidth, slotHeight);
    labCtx.fillStyle = '#78909C';
    labCtx.textAlign = 'center';
    labCtx.font = '9px sans-serif';
    labCtx.fillText("Cuvette", slotX + slotWidth / 2, slotY + slotHeight + 10);
    if (state.spec20State.cuvetteInsideId) {
        const cuvette = state.labObjects.find(o => o.id === state.spec20State.cuvetteInsideId);
        if (cuvette) {
            const cuvetteDrawX = slotX + (slotWidth - cuvette.width) / 2;
            const cuvetteDrawY = slotY + 5;
            drawCuvette({ ...cuvette, x: cuvetteDrawX, y: cuvetteDrawY, isInSpec: true }, false);
        }
    }
    labCtx.fillStyle = '#78909C';
    labCtx.strokeStyle = '#37474F';
    const zb = state.spec20State.zeroButtonPos;
    labCtx.fillRect(zb.x, zb.y, zb.width, zb.height);
    labCtx.strokeRect(zb.x, zb.y, zb.width, zb.height);
    labCtx.fillStyle = '#FFF';
    labCtx.font = 'bold 12px sans-serif';
    labCtx.textAlign = 'center';
    labCtx.fillText("Zero", zb.x + zb.width / 2, zb.y + zb.height / 2 + 4);
    const mb = state.spec20State.measureButtonPos;
    labCtx.fillStyle = '#78909C';
    labCtx.fillRect(mb.x, mb.y, mb.width, mb.height);
    labCtx.strokeRect(mb.x, mb.y, mb.width, mb.height);
    labCtx.fillStyle = '#FFF';
    labCtx.fillText("Measure", mb.x + mb.width / 2, mb.y + mb.height / 2 + 4);
    const modeB = state.spec20State.modeButtonPos;
    labCtx.fillStyle = '#78909C';
    labCtx.fillRect(modeB.x, modeB.y, modeB.width, modeB.height);
    labCtx.strokeRect(modeB.x, modeB.y, modeB.width, modeB.height);
    labCtx.fillStyle = '#FFF';
    labCtx.fillText(state.spec20State.absorbanceMode ? "%T" : "Abs", modeB.x + modeB.width / 2, modeB.y + modeB.height / 2 + 4);
    if (isHighlighted) highlightObjectBorder(obj);
    labCtx.restore();
}

function drawCuvette(obj, isHighlighted) {
    if (!labCtx) return;
    if (obj.isInSpec && !isHighlighted) { return; }
    labCtx.save();
    labCtx.fillStyle = obj.isClean ? 'rgba(240, 240, 240, 0.7)' : 'rgba(220, 220, 200, 0.7)';
    labCtx.strokeStyle = '#666';
    labCtx.lineWidth = 1;
    labCtx.fillRect(obj.x, obj.y, obj.width, obj.height);
    labCtx.strokeRect(obj.x, obj.y, obj.width, obj.height);
    if (obj.currentVolume > 0) {
        const liquidHeight = obj.height * (obj.currentVolume / obj.maxVolume) * 0.9;
        const liquidY = obj.y + obj.height - liquidHeight;
        labCtx.fillStyle = getLiquidColor(obj.concentration);
        labCtx.fillRect(obj.x + 1, liquidY, obj.width - 2, liquidHeight);
    }
    if (isHighlighted) highlightObjectBorder(obj);
    labCtx.restore();
}

function highlightObjectBorder(obj, xOffset = 0, yOffset = 0, highlightWidth = obj.width, highlightHeight = obj.height) {
    if (!labCtx) return;
    labCtx.save();
    labCtx.strokeStyle = config.COLORS.highlight;
    labCtx.lineWidth = 3;
    labCtx.setLineDash([5, 3]);
    // Use the dimensions passed, which might be different from obj.width/height for pipette
    labCtx.strokeRect(obj.x + xOffset - 2, obj.y + yOffset - 2, highlightWidth + 4, highlightHeight + 4);
    labCtx.setLineDash([]);
    labCtx.lineWidth = 1;
    labCtx.restore();
}

// --- Visual Helpers ---
function getLiquidColor(concentration) {
    if (concentration === null || concentration === undefined) return 'rgba(128,128,128,0.5)';
    if (concentration === -1) return 'rgba(100, 0, 200, 0.7)';
    const effectiveConc = Math.max(0, Math.min(concentration, config.STOCK_CONCENTRATION));
    const ratio = (config.STOCK_CONCENTRATION > 0) ? effectiveConc / config.STOCK_CONCENTRATION : 0;
    const r = Math.round(config.WATER_COLOR_COMPONENTS.r * (1 - ratio) + config.STOCK_COLOR_COMPONENTS.r * ratio);
    const g = Math.round(config.WATER_COLOR_COMPONENTS.g * (1 - ratio) + config.STOCK_COLOR_COMPONENTS.g * ratio);
    const b = Math.round(config.WATER_COLOR_COMPONENTS.b * (1 - ratio) + config.STOCK_COLOR_COMPONENTS.b * ratio);
    const a = config.WATER_COLOR_COMPONENTS.a * (1 - ratio) + config.STOCK_COLOR_COMPONENTS.a * ratio;
    return `rgba(${r}, ${g}, ${b}, ${a.toFixed(2)})`;
}

// --- Main Drawing Loop ---
export function drawSimulation() {
    if (!labCtx) return;
    const state = getState(); // Get current state snapshot
    labCtx.clearRect(0, 0, labCtx.canvas.width, labCtx.canvas.height);
    state.labObjects.forEach(obj => {
        const isHighlighted = state.highlights.includes(obj.id);
        if (obj.type === 'bottle') drawBottle(obj, isHighlighted);
        else if (obj.type === 'testTube') drawTestTube(obj, isHighlighted);
        else if (obj.type === 'pipette') drawPipette(obj, isHighlighted);
        else if (obj.type === 'beaker') drawBeaker(obj, isHighlighted);
        else if (obj.type === 'spectrophotometer') drawSpectrophotometer(obj, isHighlighted);
        else if (obj.type === 'cuvette') drawCuvette(obj, isHighlighted);
    });
    // Draw dragged object last (on top)
    if (state.draggedObject) {
        const isDraggedHighlighted = state.highlights.includes(state.draggedObject.id);
        if (state.draggedObject.type === 'pipette') drawPipette(state.draggedObject, isDraggedHighlighted);
        else if (state.draggedObject.type === 'cuvette') drawCuvette(state.draggedObject, isDraggedHighlighted);
    }
}

// --- Graph Drawing ---
export function drawGraph() {
    if (!graphCtx) return;
    const state = getState(); // Get current state snapshot
    graphCtx.clearRect(0, 0, graphCtx.canvas.width, graphCtx.canvas.height);
    const plotData = state.dataTableData.filter(d => d.conc !== null && d.id !== 'unknown' && d.negLogT !== null && isFinite(d.negLogT));
    const padding = { top: 20, right: 20, bottom: 40, left: 50 };
    const plotWidth = graphCtx.canvas.width - padding.left - padding.right;
    const plotHeight = graphCtx.canvas.height - padding.top - padding.bottom;
    const allConcValues = plotData.map(d => d.conc);
    const unknownRow = state.dataTableData.find(r => r.id === 'unknown');
    let calculatedUnknownConc = null;
    if (unknownRow && unknownRow.negLogT !== null && config.KNOWN_SLOPE > 0 && isFinite(unknownRow.negLogT)) {
        calculatedUnknownConc = unknownRow.negLogT / config.KNOWN_SLOPE;
        allConcValues.push(calculatedUnknownConc);
    }
    allConcValues.push(config.STOCK_CONCENTRATION);
    const allAbsValues = plotData.map(d => d.negLogT);
    if (unknownRow && unknownRow.negLogT !== null && isFinite(unknownRow.negLogT)) {
        allAbsValues.push(unknownRow.negLogT);
    }
    allAbsValues.push(0.1);
    const maxConc = Math.max(0.1, ...allConcValues) * 1.1 || 1;
    const maxAbs = Math.max(0.1, ...allAbsValues) * 1.1 || 1;
    const scaleX = (conc) => padding.left + (conc / maxConc) * plotWidth;
    const scaleY = (abs) => padding.top + plotHeight - (abs / maxAbs) * plotHeight;
    graphCtx.strokeStyle = '#333'; graphCtx.lineWidth = 1; graphCtx.beginPath(); graphCtx.moveTo(padding.left, padding.top); graphCtx.lineTo(padding.left, padding.top + plotHeight); graphCtx.lineTo(padding.left + plotWidth, padding.top + plotHeight); graphCtx.stroke();
    graphCtx.fillStyle = '#333'; graphCtx.textAlign = 'center'; graphCtx.font = '10px sans-serif'; graphCtx.fillText("Concentration (µM)", padding.left + plotWidth / 2, graphCtx.canvas.height - 5); graphCtx.save(); graphCtx.translate(15, padding.top + plotHeight / 2); graphCtx.rotate(-Math.PI / 2); graphCtx.fillText("Absorbance (-log T)", 0, 0); graphCtx.restore();
    graphCtx.textAlign = 'right'; graphCtx.beginPath(); for (let i = 0; i <= 5; i++) { const absValue = (maxAbs / 5) * i; const y = scaleY(absValue); graphCtx.moveTo(padding.left - 5, y); graphCtx.lineTo(padding.left, y); graphCtx.fillText(absValue.toFixed(2), padding.left - 8, y + 3); }
    graphCtx.textAlign = 'center'; for (let i = 0; i <= 5; i++) { const concValue = (maxConc / 5) * i; const x = scaleX(concValue); graphCtx.moveTo(x, padding.top + plotHeight); graphCtx.lineTo(x, padding.top + plotHeight + 5); graphCtx.fillText(concValue.toFixed(2), x, padding.top + plotHeight + 15); } graphCtx.stroke();
    graphCtx.fillStyle = 'blue'; plotData.forEach(d => { graphCtx.beginPath(); graphCtx.arc(scaleX(d.conc), scaleY(d.negLogT), 3, 0, 2 * Math.PI); graphCtx.fill(); });
    if (plotData.length > 0 && config.KNOWN_SLOPE && config.KNOWN_SLOPE > 0) { graphCtx.strokeStyle = 'red'; graphCtx.lineWidth = 1.5; graphCtx.beginPath(); graphCtx.moveTo(scaleX(0), scaleY(0)); const endConc = maxConc; const endAbs = config.KNOWN_SLOPE * endConc; if (endAbs <= maxAbs * 1.05) { graphCtx.lineTo(scaleX(endConc), scaleY(endAbs)); } else { const boundedConc = maxAbs / config.KNOWN_SLOPE; if (isFinite(boundedConc)) graphCtx.lineTo(scaleX(boundedConc), scaleY(maxAbs)); } graphCtx.stroke(); }
    if (calculatedUnknownConc !== null && unknownRow && unknownRow.negLogT !== null && isFinite(unknownRow.negLogT)) { const unknownX = scaleX(calculatedUnknownConc); const unknownY = scaleY(unknownRow.negLogT); if (unknownX >= padding.left && unknownX <= padding.left + plotWidth && unknownY >= padding.top && unknownY <= padding.top + plotHeight) { graphCtx.fillStyle = 'green'; graphCtx.beginPath(); graphCtx.arc(unknownX, unknownY, 4, 0, 2 * Math.PI); graphCtx.fill(); graphCtx.strokeStyle = 'rgba(0, 128, 0, 0.5)'; graphCtx.lineWidth = 1; graphCtx.setLineDash([3, 3]); graphCtx.beginPath(); graphCtx.moveTo(padding.left, unknownY); graphCtx.lineTo(unknownX, unknownY); graphCtx.stroke(); graphCtx.beginPath(); graphCtx.moveTo(unknownX, unknownY); graphCtx.lineTo(unknownX, padding.top + plotHeight); graphCtx.stroke(); graphCtx.setLineDash([]); } else { console.log("Unknown point calculated outside graph bounds."); } }
    if (plotData.length === 0 && calculatedUnknownConc === null) { graphCtx.fillStyle = '#777'; graphCtx.textAlign = 'center'; graphCtx.fillText("Graph will appear here", graphCtx.canvas.width/2, graphCtx.canvas.height/2); }
}