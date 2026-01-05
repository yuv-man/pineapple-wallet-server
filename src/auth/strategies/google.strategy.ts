import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, VerifyCallback } from 'passport-google-oauth20';
import { ConfigService } from '@nestjs/config';
import { AuthService } from '../auth.service';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(
    configService: ConfigService,
    private authService: AuthService,
  ) {
    const envMode = configService.get<string>('ENV_MODE') || 'dev';
    const isProduction = envMode === 'prod' || envMode === 'production';
    
    // Get backend URL - use BACKEND_URL if set, otherwise construct it
    let backendUrl = configService.get<string>('BACKEND_URL');
    if (!backendUrl) {
      if (isProduction) {
        // In production, try to get from Render's environment or use a default pattern
        backendUrl = process.env.RENDER_EXTERNAL_URL || 
                     `https://${process.env.RENDER_SERVICE_NAME || 'pineapple-wallet-backend'}.onrender.com`;
      } else {
        backendUrl = `http://localhost:${configService.get<number>('PORT') || 5001}`;
      }
    }
    
    // Remove trailing slash if present
    backendUrl = backendUrl.replace(/\/$/, '');
    const callbackURL = `${backendUrl}/api/auth/google/callback`;
    
    super({
      clientID: configService.get<string>('GOOGLE_CLIENT_ID'),
      clientSecret: configService.get<string>('GOOGLE_CLIENT_SECRET'),
      callbackURL,
      scope: ['email', 'profile'],
    });
  }

  async validate(
    accessToken: string,
    refreshToken: string,
    profile: any,
    done: VerifyCallback,
  ): Promise<any> {
    const { name, emails, photos } = profile;
    const user = await this.authService.validateOAuthUser({
      email: emails[0].value,
      name: `${name.givenName} ${name.familyName}`,
      avatar: photos[0]?.value,
      provider: 'google',
      providerId: profile.id,
    });
    done(null, user);
  }
}
