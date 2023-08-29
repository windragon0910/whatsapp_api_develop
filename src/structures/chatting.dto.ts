import { ApiExtraModels, ApiProperty, getSchemaPath } from '@nestjs/swagger';
import { IsNumber, IsString } from 'class-validator';

import { SessionBaseRequest, SessionQuery } from './base.dto';
import {
  BinaryFile,
  RemoteFile,
  VoiceBinaryFile,
  VoiceRemoteFile,
} from './files.dto';

/**
 * Queries
 */
export class CheckNumberStatusQuery extends SessionQuery {
  @IsString()
  phone: string;
}

export class MessageTextQuery extends SessionQuery {
  @IsString()
  phone: string;
  @IsString()
  text: string;
}

export class ChatQuery extends SessionQuery {
  @ApiProperty({
    example: '11111111111@c.us',
  })
  chatId: string;
}

export class GetMessageQuery extends ChatQuery {
  @IsNumber()
  limit: number;
  @ApiProperty({
    example: true,
    required: false,
    description: 'Download media for messages',
  })
  downloadMedia: true;
}

export class GetPresenceQuery extends ChatQuery {}

/**
 * Requests
 */
export class ChatRequest extends SessionBaseRequest {
  @ApiProperty({
    example: '11111111111@c.us',
  })
  chatId: string;
}

export class SendSeenRequest extends ChatRequest {
  @ApiProperty({
    example: 'false_11111111111@c.us_AAAAAAAAAAAAAAAAAAAA',
    required: false,
    description:
      "NOWEB engine only - it's important to mark ALL messages as seen",
  })
  messageId?: string;

  @ApiProperty({
    example: '11111111111@c.us',
    required: false,
    description:
      'NOWEB engine only - the ID of the user that sent the  message (undefined for individual chats)',
  })
  participant?: string;
}

export class MessageRequest extends SessionBaseRequest {
  @ApiProperty({
    example: 'false_11111111111@c.us_AAAAAAAAAAAAAAAAAAAA',
  })
  messageId: string;
}

export class MessageContactVcardRequest extends ChatRequest {
  contactsId: string;
  name: string;
}

export class MessageTextRequest extends ChatRequest {
  text = 'Hi there!';
  @ApiProperty({
    description:
      'Mention contact in the message. ' +
      "The message MUST contain '@123456789' text in order to work with 'mentions' field.",
    example: ['123456789@c.us'],
  })
  mentions?: string[];
}

export class Button {
  id: string;
  text: string;
}

export class MessageTextButtonsRequest extends ChatRequest {
  title: string;
  footer?: string;
  buttons?: Array<Button>;
}

export class MessageReplyRequest extends MessageTextRequest {
  text = 'Reply text';
  @ApiProperty({
    example: 'false_11111111111@c.us_AAAAAAAAAAAAAAAAAAAA',
  })
  reply_to: string;
}

export class MessageLocationRequest extends ChatRequest {
  latitude: number;
  longitude: number;
  title: string;
}

@ApiExtraModels(BinaryFile, RemoteFile)
class FileRequest extends ChatRequest {
  @ApiProperty({
    oneOf: [
      { $ref: getSchemaPath(BinaryFile) },
      { $ref: getSchemaPath(RemoteFile) },
    ],
  })
  file: BinaryFile | RemoteFile;
}

export class MessageImageRequest extends FileRequest {
  caption: string;
}

export class MessageFileRequest extends FileRequest {
  caption: string;
}

@ApiExtraModels(VoiceBinaryFile, VoiceRemoteFile)
export class MessageVoiceRequest extends ChatRequest {
  @ApiProperty({
    oneOf: [
      { $ref: getSchemaPath(VoiceBinaryFile) },
      { $ref: getSchemaPath(VoiceRemoteFile) },
    ],
  })
  file: VoiceBinaryFile | VoiceRemoteFile;
}

export class MessageLinkPreviewRequest extends ChatRequest {
  url: string;
  title: string;
}

export class MessageReactionRequest extends MessageRequest {
  @ApiProperty({
    description:
      'Emoji to react with. Send an empty string to remove the reaction',
    example: '👍',
  })
  reaction: string;
}

export class WANumberExistResult {
  numberExists: boolean;
}

export class MessagePoll {
  @ApiProperty({
    example: 'How are you?',
  })
  name: string;

  @ApiProperty({
    example: ['Awesome!', 'Good!', 'Not bad!'],
  })
  options: string[];

  multipleAnswers = false;
}

export class MessagePollRequest extends ChatRequest {
  poll: MessagePoll;
}

export class MessageDestination {
  @ApiProperty({
    description: 'Message ID',
    example: 'false_11111111111@c.us_AAAAAAAAAAAAAAAAAAAA',
  })
  id: string;
  to: string;
  from: string;
  fromMe: boolean;
}
