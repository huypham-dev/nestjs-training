// Dependencies
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Version,
} from '@nestjs/common';
import {
  ApiBody,
  ApiOperation,
  ApiResponse,
  ApiSecurity,
  ApiTags,
} from '@nestjs/swagger';

// Common
import { ZodValidationPipe } from '@/common/pipes/zod-validation.pipe';

// User
import { CurrentUser } from '@/modules/user/user.decorators';
import { User } from '@/modules/user/user.entity';

// Service
import { NotificationService } from './notification.service';

// DTOs
import {
  type RegisterDeviceDto,
  type SendNotificationToUserDto,
  type UnregisterDeviceDto,
  registerDeviceSchema,
  sendNotificationToUserSchema,
  unregisterDeviceSchema,
} from './notification.dto';

@ApiTags('Notifications')
@ApiSecurity('BearerAuth')
@Controller()
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  @Version('1')
  @Post('devices/register')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Register a device FCM token' })
  @ApiBody({ schema: { $ref: '#/components/schemas/RegisterDevice' } })
  @ApiResponse({ status: 200, description: 'Device token registered' })
  registerDevice(
    @CurrentUser() currentUser: User,
    @Body(new ZodValidationPipe(registerDeviceSchema))
    payload: RegisterDeviceDto
  ) {
    return this.notificationService.registerDevice(currentUser.id, payload);
  }

  @Version('1')
  @Delete('devices/unregister')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Unregister a device FCM token' })
  @ApiBody({ schema: { $ref: '#/components/schemas/UnregisterDevice' } })
  @ApiResponse({ status: 204, description: 'Device token removed' })
  unregisterDevice(
    @CurrentUser() currentUser: User,
    @Body(new ZodValidationPipe(unregisterDeviceSchema))
    payload: UnregisterDeviceDto
  ) {
    return this.notificationService.unregisterDevice(currentUser.id, payload);
  }

  @Version('1')
  @Get('notifications/devices')
  @ApiOperation({ summary: "List current user's registered devices" })
  @ApiResponse({
    status: 200,
    description: 'All active FCM tokens for the current user',
  })
  getMyDevices(@CurrentUser() currentUser: User) {
    return this.notificationService.getDeviceTokensByUser(currentUser.id);
  }

  @Version('1')
  @Post('notifications/send')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({
    summary: 'Send a push notification to a user (admin / internal)',
  })
  @ApiBody({ schema: { $ref: '#/components/schemas/SendNotificationToUser' } })
  @ApiResponse({ status: 202, description: 'Notification enqueued' })
  sendPushNotification(
    @Body(new ZodValidationPipe(sendNotificationToUserSchema))
    payload: SendNotificationToUserDto
  ) {
    return this.notificationService.sendPushNotification(payload);
  }
}
