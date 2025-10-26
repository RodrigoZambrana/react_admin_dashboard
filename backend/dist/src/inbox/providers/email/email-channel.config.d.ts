import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EmailChannelConfig } from './email-channel.types';
type BuildEmailConfigOptions = {
    logger?: Logger;
};
export declare const buildEmailChannelConfig: (configService: ConfigService, options?: BuildEmailConfigOptions) => EmailChannelConfig;
export {};
