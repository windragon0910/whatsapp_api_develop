import {create, Message, Whatsapp} from "venom-bot";
import {Inject, Injectable, Logger, OnApplicationShutdown} from "@nestjs/common";
import {ConfigService} from "@nestjs/config";
import * as path from "path";

import request = require('requestretry');
import mime = require('mime-types');
import fs = require('fs');
import del = require("del");

// eslint-disable-next-line @typescript-eslint/no-var-requires
const {promisify} = require('util')
const writeFileAsync = promisify(fs.writeFile)


const SECOND = 1000;

export const whatsappProvider = {
    provide: 'WHATSAPP',
    useFactory: async (config: ConfigService) => create('sessionName',
        (base64Qr, asciiQR) => {
            console.log(asciiQR);
        },
        (statusFind) => {
            console.log(statusFind);
        },
        {
            headless: true,
            devtools: false,
            useChrome: true,
            debug: false,
            logQR: true,
            browserArgs: ["--no-sandbox"],
            autoClose: 60000,
            disableSpins: true,
            createPathFileToken: true,
            puppeteerOptions: {},
        }
    ),
}

const ONMESSAGE_HOOK = "onMessage"
const HOOKS = [
    ONMESSAGE_HOOK,
    "onStateChange",
    "onAck",
    // TODO: IMPLEMENTED THESE TOO
    // "onLiveLocation",
    // "onParticipantsChanged",
    "onAddedToGroup"
]
const ENV_PREFIX = "WHATSAPP_HOOK_"


@Injectable()
export class WhatsappService implements OnApplicationShutdown {
    // TODO: Use environment variables
    private RETRY_DELAY = 15
    private RETRY_ATTEMPTS = 3;
    private DOWNLOADS_FOLDER = "/tmp/whatsapp-files"

    constructor(
        @Inject('WHATSAPP') private whatsapp: Whatsapp,
        private config: ConfigService,
        private log: Logger,
    ) {
        this.log.setContext('WhatsappService')

        this.clean_downloads()

        this.log.log('Configuring webhooks...')
        for (const hook of HOOKS) {
            const env_name = ENV_PREFIX + hook.toUpperCase()
            const url = config.get(env_name)
            if (!url) {
                this.log.log(`Hook '${hook}' is disabled. Set ${env_name} environment variable to url if you want to enabled it.`)
                continue
            }

            if (hook === ONMESSAGE_HOOK) {
                this.whatsapp[hook](data => this.onMessageHook(data, url))
            } else {
                this.whatsapp[hook](data => this.callWebhook(data, url))
            }
            this.log.log(`Hook '${hook}' was enabled to url: ${url}`)
        }
        this.log.log('Webhooks were configured.')
    }

    private clean_downloads() {
        if (fs.existsSync(this.DOWNLOADS_FOLDER)) {
            del([`${this.DOWNLOADS_FOLDER}/*`], {force: true}).then((paths) =>
                console.log('Deleted files and directories:\n', paths.join('\n'))
            )
        } else {
            fs.mkdirSync(this.DOWNLOADS_FOLDER)
            this.log.log(`Directory '${this.DOWNLOADS_FOLDER}' created from scratch`)
        }
    }


    private callWebhook(data, url) {
        this.log.log(`Sending POST to ${url}...`)
        this.log.debug(`POST DATA: ${JSON.stringify(data)}`)

        // TODO: Use HttpModule with retry
        request.post(
            url,
            {
                json: data,
                maxAttempts: this.RETRY_ATTEMPTS,
                retryDelay: this.RETRY_DELAY * SECOND,
                retryStrategy: request.RetryStrategies.HTTPOrNetworkError
            },
            (error, res, body) => {
                if (error) {
                    this.log.error(error)
                    return
                }
                this.log.log(`POST request was sent with status code: ${res.statusCode}`)
                this.log.verbose(`Response: ${JSON.stringify(body)}`)
            })
    }

    private async onMessageHook(message: Message, url: string) {
        if (message.isMMS || message.isMedia) {
            this.downloadAndDecryptMedia(message).then(
                (data) => this.callWebhook(data, url)
            );
        } else {
            this.callWebhook(message, url);
        }
    }

    private async downloadAndDecryptMedia(message: Message) {
        return this.whatsapp.decryptFile(message).then(async (buffer) => {
            // TODO: Add filter from env variables
            if (!message.mimetype.startsWith("audio")) {
                this.log.log(`The message ${message.id} has ${message.mimetype} media, skip it.`);
                return message
            }

            this.log.log(`The message ${message.id} has media, downloading it...`);
            const fileName = `${message.id}.${mime.extension(message.mimetype)}`;
            const filePath = path.resolve(`${this.DOWNLOADS_FOLDER}/${fileName}`)
            this.log.verbose(`Writing file to ${filePath}...`)
            await writeFileAsync(filePath, buffer);
            this.log.log(`The file from ${message.id} has been saved to ${filePath}`);

            // TODO: Pass real URL
            message.clientUrl = "http://localhost/..."
            return message
        });
    }

    onApplicationShutdown(signal ?: string): any {
        this.log.log('Close a browser...')
        return this.whatsapp.close()
    }

}