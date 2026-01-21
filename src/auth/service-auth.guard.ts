import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';

/**
 * Service-to-Service Authentication Guard
 * 
 * Verifies that requests are from bridgepay-backoffice by checking
 * the X-Service-Key header matches the configured SERVICE_TO_SERVICE_SECRET.
 * 
 * This guard is used for service-to-service authentication where bridgepay-refund
 * has no user/role system - it only needs to verify service identity.
 */
@Injectable()
export class ServiceAuthGuard implements CanActivate {
  constructor(private readonly configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const serviceKey = request.headers['x-service-key'] as string;

    const expectedSecret = this.configService.get<string>('serviceToServiceSecret');

    if (!expectedSecret) {
      throw new UnauthorizedException('Service-to-service authentication not configured');
    }

    if (!serviceKey) {
      throw new UnauthorizedException('Missing X-Service-Key header');
    }

    // Use constant-time comparison to prevent timing attacks
    if (!this.secureCompare(serviceKey, expectedSecret)) {
      throw new UnauthorizedException('Invalid service key');
    }

    return true;
  }

  /**
   * Constant-time string comparison to prevent timing attacks
   */
  private secureCompare(a: string, b: string): boolean {
    if (a.length !== b.length) {
      return false;
    }

    let result = 0;
    for (let i = 0; i < a.length; i++) {
      result |= a.charCodeAt(i) ^ b.charCodeAt(i);
    }

    return result === 0;
  }
}
