// config.js

// Physical/Simulation constants
export const STOCK_CONCENTRATION = 2.31;
export const TARGET_WAVELENGTH = 630;
export const KNOWN_SLOPE = 0.1358;
export const MAX_ABS = 1.5;
export const RINSE_VOLUME = 3; // Volume used for rinsing cuvette

// UI/Appearance constants
export const WATER_COLOR_COMPONENTS = { r: 200, g: 200, b: 255, a: 0.6 };
export const STOCK_COLOR_COMPONENTS = { r: 0, g: 0, b: 255, a: 0.8 };
export const COLORS = {
    glass: '#ddd',
    label: '#333',
    error: '#d32f2f',
    success: '#388e3c',
    info: '#1976d2',
    highlight: 'orange',
};

// Lookup tables
export const TRANSMITTANCE_LOOKUP = {
    0: 100.0,
    0.231: 95.0,
    0.462: 87.0,
    0.693: 81.0,
    0.924: 77.0,
    1.39: 65.0,
    1.85: 58.0,
    2.31: 49.0,
};