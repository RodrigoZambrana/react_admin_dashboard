"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadClientConfig = void 0;
const fs_1 = require("fs");
const path = require("path");
const client_config_constants_1 = require("./client-config.constants");
const SUPPORTED_EXTENSIONS = ['.js', '.ts', '.cjs', '.mjs'];
const isPlainObject = (value) => typeof value === 'object' && value !== null && !Array.isArray(value);
const deepMerge = (base, override) => {
    const result = { ...base };
    Object.entries(override).forEach(([key, value]) => {
        if (value === undefined) {
            return;
        }
        const current = result[key];
        if (isPlainObject(current) && isPlainObject(value)) {
            result[key] = deepMerge(current, value);
            return;
        }
        result[key] = value;
    });
    return result;
};
const resolveClientConfigPath = (slug) => {
    const baseDir = path.resolve(__dirname, '..', 'clients', slug);
    for (const extension of SUPPORTED_EXTENSIONS) {
        const candidate = path.resolve(baseDir, `config${extension}`);
        if ((0, fs_1.existsSync)(candidate)) {
            return candidate;
        }
    }
    return null;
};
const loadRawClientConfig = (slug) => {
    const filePath = resolveClientConfigPath(slug);
    if (!filePath) {
        if (slug !== client_config_constants_1.BASE_CLIENT_SLUG) {
            console.warn(`[client-config] No se encontró configuración para el cliente "${slug}". Se utilizará la variante base.`);
        }
        return {};
    }
    try {
        const moduleExport = require(filePath);
        const config = (moduleExport?.default ?? moduleExport);
        if (!config || !isPlainObject(config)) {
            throw new Error('El archivo no exporta un objeto de configuración válido.');
        }
        return config;
    }
    catch (error) {
        console.error(`[client-config] Error cargando la configuración para "${slug}":`, error);
        return {};
    }
};
const loadClientConfig = (explicitSlug) => {
    const resolvedSlug = explicitSlug || process.env.CLIENT_SLUG || client_config_constants_1.FALLBACK_CLIENT_SLUG;
    const baseConfig = loadRawClientConfig(client_config_constants_1.BASE_CLIENT_SLUG);
    const overrideConfig = resolvedSlug === client_config_constants_1.BASE_CLIENT_SLUG
        ? {}
        : loadRawClientConfig(resolvedSlug);
    const merged = deepMerge(baseConfig, overrideConfig);
    return Object.freeze({
        ...merged,
        slug: resolvedSlug,
        displayName: overrideConfig.displayName ||
            merged.displayName ||
            baseConfig.displayName ||
            resolvedSlug,
    });
};
exports.loadClientConfig = loadClientConfig;
//# sourceMappingURL=client-config.loader.js.map