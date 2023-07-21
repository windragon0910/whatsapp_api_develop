import { UnprocessableEntityException } from '@nestjs/common/exceptions/unprocessable-entity.exception';
import {
  Buttons,
  Chat,
  Client,
  ClientOptions,
  Contact,
  Events,
  GroupChat,
  Location,
  Message,
} from 'whatsapp-web.js';
import { Message as MessageInstance } from 'whatsapp-web.js/src/structures';

import {
  Button,
  ChatRequest,
  CheckNumberStatusQuery,
  GetMessageQuery,
  MessageContactVcardRequest,
  MessageFileRequest,
  MessageImageRequest,
  MessageLinkPreviewRequest,
  MessageLocationRequest,
  MessageReactionRequest,
  MessageReplyRequest,
  MessageTextButtonsRequest,
  MessageTextRequest,
  MessageVoiceRequest,
  SendSeenRequest,
} from '../structures/chatting.dto';
import { ContactQuery, ContactRequest } from '../structures/contacts.dto';
import {
  WAHAEngine,
  WAHAEvents,
  WAHAPresenceStatus,
  WAHASessionStatus,
} from '../structures/enums.dto';
import {
  CreateGroupRequest,
  ParticipantsRequest,
} from '../structures/groups.dto';
import { WAMessage, WANumberExistResult } from '../structures/responses.dto';
import { WAHAInternalEvent, WhatsappSession } from './abc/session.abc';
import {
  AvailableInPlusVersion,
  NotImplementedByEngineError,
} from './exceptions';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const qrcode = require('qrcode-terminal');

export class WhatsappSessionWebJSCore extends WhatsappSession {
  engine = WAHAEngine.WEBJS;

  whatsapp: Client;

  protected buildClient() {
    const clientOptions: ClientOptions = {
      puppeteer: {
        headless: true,
        executablePath: this.getBrowserExecutablePath(),
        args: this.getBrowserArgsForPuppeteer(),
      },
    };
    this.addProxyConfig(clientOptions);
    return new Client(clientOptions);
  }

  protected addProxyConfig(clientOptions: ClientOptions) {
    if (this.proxyConfig?.server !== undefined) {
      // push the proxy server to the args
      clientOptions.puppeteer.args.push(
        `--proxy-server=${this.proxyConfig?.server}`,
      );

      // Authenticate
      if (this.proxyConfig?.username && this.proxyConfig?.password) {
        clientOptions.proxyAuthentication = {
          username: this.proxyConfig?.username,
          password: this.proxyConfig?.password,
        };
      }
    }
  }

  async start() {
    this.whatsapp = this.buildClient();

    this.whatsapp.initialize().catch((error) => {
      this.status = WAHASessionStatus.FAILED;
      this.log.error(error);
      return;
    });

    // Connect events
    this.whatsapp.on(Events.QR_RECEIVED, (qr) => {
      qrcode.generate(qr, { small: true });
      this.status = WAHASessionStatus.SCAN_QR_CODE;
    });

    this.whatsapp.on(Events.AUTHENTICATED, () => {
      this.status = WAHASessionStatus.WORKING;
      this.log.log(`Session '${this.name}' has been authenticated!`);
    });
    this.events.emit(WAHAInternalEvent.engine_start);
    return this;
  }

  stop() {
    return this.whatsapp.destroy();
  }

  /**
   * START - Methods for API
   */
  async getScreenshot(): Promise<Buffer | string> {
    if (this.status === WAHASessionStatus.FAILED) {
      throw new UnprocessableEntityException(
        `The session under FAILED status. Please try to restart it.`,
      );
    }
    return await this.whatsapp.pupPage.screenshot();
  }

  async checkNumberStatus(
    request: CheckNumberStatusQuery,
  ): Promise<WANumberExistResult> {
    const exist = await this.whatsapp.isRegisteredUser(
      this.ensureSuffix(request.phone),
    );
    return { numberExists: exist };
  }

  sendText(request: MessageTextRequest) {
    const options = {
      // It's fine to sent just ids instead of Contact object
      mentions: request.mentions as unknown as Contact[],
    };
    return this.whatsapp.sendMessage(
      this.ensureSuffix(request.chatId),
      request.text,
      options,
    );
  }

  sendTextButtons(request: MessageTextButtonsRequest) {
    const buttons = request.buttons.map((button: Button) => {
      return {
        id: button.id,
        body: button.text,
      };
    });
    const message = new Buttons('', buttons, request.title, request.footer);
    return this.whatsapp.sendMessage(
      this.ensureSuffix(request.chatId),
      message,
    );
  }

  sendContactVCard(request: MessageContactVcardRequest) {
    throw new NotImplementedByEngineError();
  }

  reply(request: MessageReplyRequest) {
    const options = {
      quotedMessageId: request.reply_to,
      // It's fine to sent just ids instead of Contact object
      mentions: request.mentions as unknown as Contact[],
    };
    return this.whatsapp.sendMessage(request.chatId, request.text, options);
  }

  sendImage(request: MessageImageRequest) {
    throw new AvailableInPlusVersion();
  }

  sendFile(request: MessageFileRequest) {
    throw new AvailableInPlusVersion();
  }

  sendVoice(request: MessageVoiceRequest) {
    throw new AvailableInPlusVersion();
  }

  async sendLocation(request: MessageLocationRequest) {
    const location = new Location(
      request.latitude,
      request.longitude,
      request.title,
    );
    return this.whatsapp.sendMessage(request.chatId, location);
  }

  sendLinkPreview(request: MessageLinkPreviewRequest) {
    throw new NotImplementedByEngineError();
  }

  async sendSeen(request: SendSeenRequest) {
    const chat: Chat = await this.whatsapp.getChatById(request.chatId);
    await chat.sendSeen();
  }

  async startTyping(request: ChatRequest) {
    const chat: Chat = await this.whatsapp.getChatById(request.chatId);
    await chat.sendStateTyping();
  }

  async stopTyping(request: ChatRequest) {
    const chat: Chat = await this.whatsapp.getChatById(request.chatId);
    await chat.clearState();
  }

  async getMessages(query: GetMessageQuery) {
    return this.getChatMessages(query.chatId, query.limit, query.downloadMedia);
  }

  async setReaction(request: MessageReactionRequest) {
    const messageId = this.deserializeId(request.messageId);
    // Recreate instance to react on it
    const message = new MessageInstance(this.whatsapp);
    message.id = messageId;
    message._data = { id: messageId };

    return message.react(request.reaction);
  }

  /**
   * Chats methods
   */
  getChats() {
    return this.whatsapp.getChats();
  }

  async getChatMessages(chatId: string, limit: number, downloadMedia: boolean) {
    const chat: Chat = await this.whatsapp.getChatById(
      this.ensureSuffix(chatId),
    );
    const messages = await chat.fetchMessages({
      limit: limit,
    });
    // Go over messages, download media, and convert to right format.
    const result = [];
    for (const message of messages) {
      const msg = await this.processIncomingMessage(message, downloadMedia);
      result.push(msg);
    }
    return result;
  }

  async deleteChat(chatId) {
    const chat = await this.whatsapp.getChatById(chatId);
    return chat.delete();
  }

  async clearMessages(chatId) {
    const chat = await this.whatsapp.getChatById(chatId);
    return chat.clearMessages();
  }

  /**
   * Contacts methods
   */
  getContact(query: ContactQuery) {
    return this.whatsapp
      .getContactById(this.ensureSuffix(query.contactId))
      .then(this.toWAContact);
  }

  getContacts() {
    return this.whatsapp
      .getContacts()
      .then((contacts) => contacts.map(this.toWAContact));
  }

  public async getContactAbout(query: ContactQuery) {
    const contact = await this.whatsapp.getContactById(
      this.ensureSuffix(query.contactId),
    );
    return { about: await contact.getAbout() };
  }

  public async getContactProfilePicture(query: ContactQuery) {
    const contact = await this.whatsapp.getContactById(
      this.ensureSuffix(query.contactId),
    );
    return { profilePictureURL: await contact.getProfilePicUrl() };
  }

  public async blockContact(request: ContactRequest) {
    const contact = await this.whatsapp.getContactById(
      this.ensureSuffix(request.contactId),
    );
    await contact.block();
  }

  public async unblockContact(request: ContactRequest) {
    const contact = await this.whatsapp.getContactById(
      this.ensureSuffix(request.contactId),
    );
    await contact.unblock();
  }

  /**
   * Group methods
   */
  public createGroup(request: CreateGroupRequest) {
    const participantIds = request.participants.map(
      (participant) => participant.id,
    );
    return this.whatsapp.createGroup(request.name, participantIds);
  }

  public async setInfoAdminsOnly(id, value) {
    const groupChat = (await this.whatsapp.getChatById(id)) as GroupChat;
    return groupChat.setInfoAdminsOnly(value);
  }

  public getGroups() {
    return this.whatsapp
      .getChats()
      .then((chats) => chats.filter((chat) => chat.isGroup));
  }

  public getGroup(id) {
    return this.whatsapp.getChatById(id);
  }

  public async deleteGroup(id) {
    const groupChat = (await this.whatsapp.getChatById(id)) as GroupChat;
    return groupChat.delete();
  }

  public async leaveGroup(id) {
    const groupChat = (await this.whatsapp.getChatById(id)) as GroupChat;
    return groupChat.leave();
  }

  public async setDescription(id, description) {
    const groupChat = (await this.whatsapp.getChatById(id)) as GroupChat;
    return groupChat.setDescription(description);
  }

  public async setSubject(id, subject) {
    const groupChat = (await this.whatsapp.getChatById(id)) as GroupChat;
    return groupChat.setSubject(subject);
  }

  public async getInviteCode(id): Promise<string> {
    const groupChat = (await this.whatsapp.getChatById(id)) as GroupChat;
    return groupChat.getInviteCode();
  }

  public async revokeInviteCode(id): Promise<string> {
    const groupChat = (await this.whatsapp.getChatById(id)) as GroupChat;
    await groupChat.revokeInvite();
    return groupChat.getInviteCode();
  }

  public async getParticipants(id) {
    const groupChat = (await this.whatsapp.getChatById(id)) as GroupChat;
    return groupChat.participants;
  }

  public async addParticipants(id, request: ParticipantsRequest) {
    const groupChat = (await this.whatsapp.getChatById(id)) as GroupChat;
    const participantIds = request.participants.map(
      (participant) => participant.id,
    );
    return groupChat.addParticipants(participantIds);
  }

  public async removeParticipants(id, request: ParticipantsRequest) {
    const groupChat = (await this.whatsapp.getChatById(id)) as GroupChat;
    const participantIds = request.participants.map(
      (participant) => participant.id,
    );
    return groupChat.removeParticipants(participantIds);
  }

  public async promoteParticipantsToAdmin(id, request: ParticipantsRequest) {
    const groupChat = (await this.whatsapp.getChatById(id)) as GroupChat;
    const participantIds = request.participants.map(
      (participant) => participant.id,
    );
    return groupChat.promoteParticipants(participantIds);
  }

  public async demoteParticipantsToUser(id, request: ParticipantsRequest) {
    const groupChat = (await this.whatsapp.getChatById(id)) as GroupChat;
    const participantIds = request.participants.map(
      (participant) => participant.id,
    );
    return groupChat.demoteParticipants(participantIds);
  }

  public async setPresence(presence: WAHAPresenceStatus, chatId?: string) {
    let chat: Chat;
    switch (presence) {
      case WAHAPresenceStatus.ONLINE:
        await this.whatsapp.sendPresenceAvailable();
        break;
      case WAHAPresenceStatus.OFFLINE:
        await this.whatsapp.sendPresenceUnavailable();
        break;
      case WAHAPresenceStatus.TYPING:
        chat = await this.whatsapp.getChatById(chatId);
        await chat.sendStateTyping();
        break;
      case WAHAPresenceStatus.RECORDING:
        chat = await this.whatsapp.getChatById(chatId);
        await chat.sendStateRecording();
        break;
      case WAHAPresenceStatus.PAUSED:
        chat = await this.whatsapp.getChatById(chatId);
        await chat.clearState();
        break;
      default:
        throw new NotImplementedByEngineError(
          `WEBJS engine doesn't support '${presence}' presence.`,
        );
    }
  }

  /**
   * END - Methods for API
   */

  subscribe(event, handler) {
    if (event === WAHAEvents.MESSAGE) {
      this.whatsapp.on(Events.MESSAGE_RECEIVED, (message) =>
        this.processIncomingMessage(message).then(handler),
      );
    } else if (event === WAHAEvents.MESSAGE_ANY) {
      this.whatsapp.on(Events.MESSAGE_CREATE, (message) =>
        this.processIncomingMessage(message).then(handler),
      );
    } else if (event === WAHAEvents.STATE_CHANGE) {
      this.whatsapp.on(Events.STATE_CHANGED, handler);
    } else if (event === WAHAEvents.MESSAGE_ACK) {
      // We do not download media here
      this.whatsapp.on(Events.MESSAGE_ACK, (message) =>
        this.toWAMessage(message).then(handler),
      );
    } else if (event === WAHAEvents.GROUP_JOIN) {
      this.whatsapp.on(Events.GROUP_JOIN, handler);
    } else if (event === WAHAEvents.GROUP_LEAVE) {
      this.whatsapp.on(Events.GROUP_LEAVE, handler);
    } else {
      throw new NotImplementedByEngineError(
        `Engine does not support webhook event: ${event}`,
      );
    }
  }

  private async processIncomingMessage(message: Message, downloadMedia = true) {
    if (downloadMedia) {
      try {
        message = await this.downloadMedia(message);
      } catch (e) {
        this.log.error('Failed when tried to download media for a message');
        this.log.error(e, e.stack);
      }
    }
    return await this.toWAMessage(message);
  }

  protected toWAMessage(message: Message): Promise<WAMessage> {
    // @ts-ignore
    return Promise.resolve({
      id: message.id._serialized,
      timestamp: message.timestamp,
      from: message.from,
      fromMe: message.fromMe,
      to: message.to,
      body: message.body,
      // @ts-ignore
      hasMedia: Boolean(message.mediaUrl),
      // @ts-ignore
      mediaUrl: message.mediaUrl,
      // @ts-ignore
      ack: message.ack,
      location: message.location,
      vCards: message.vCards,
      _data: message.rawData,
    });
  }

  protected toWAContact(contact: Contact) {
    // @ts-ignore
    contact.id = contact.id._serialized;
    return contact;
  }

  protected async downloadMedia(message: Message) {
    if (!message.hasMedia) {
      return message;
    }

    // @ts-ignore
    message.mediaUrl = await this.storage.save(
      message.id._serialized,
      '',
      undefined,
    );
    return message;
  }
}
