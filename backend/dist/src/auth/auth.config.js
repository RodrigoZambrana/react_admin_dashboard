"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SESSION_TTL_MILLISECONDS = exports.SESSION_TTL_SECONDS = exports.SESSION_TTL_HOURS = void 0;
const DEFAULT_SESSION_TTL_HOURS = 24 * 7;
const MAX_SESSION_TTL_HOURS = 24 * 30;
const resolveNumericEnv = (value) => {
    if (!value)
        return null;
    const parsed = Number(value);
    if (!Number.isFinite(parsed))
        return null;
    return parsed;
};
const resolvedHours = (() => {
    const candidate = resolveNumericEnv(process.env.SESSION_TTL_HOURS);
    if (candidate && candidate > 0) {
        return Math.min(candidate, MAX_SESSION_TTL_HOURS);
    }
    return DEFAULT_SESSION_TTL_HOURS;
})();
exports.SESSION_TTL_HOURS = resolvedHours;
exports.SESSION_TTL_SECONDS = Math.max(1, Math.round(exports.SESSION_TTL_HOURS * 60 * 60));
exports.SESSION_TTL_MILLISECONDS = exports.SESSION_TTL_SECONDS * 1000;
//# sourceMappingURL=auth.config.js.map