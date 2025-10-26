"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ClientConfigProvider = void 0;
const client_config_constants_1 = require("./client-config.constants");
const client_config_loader_1 = require("./client-config.loader");
exports.ClientConfigProvider = {
    provide: client_config_constants_1.CLIENT_CONFIG_TOKEN,
    useFactory: () => (0, client_config_loader_1.loadClientConfig)(),
};
//# sourceMappingURL=client-config.provider.js.map