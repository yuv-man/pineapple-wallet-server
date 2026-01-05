import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-github2';
import { ConfigService } from '@nestjs/config';
import { AuthService } from '../auth.service';

@Injectable()
export class GithubStrategy extends PassportStrategy(Strategy, 'github') {
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
    const callbackURL = `${backendUrl}/api/auth/github/callback`;
    
    super({
      clientID: configService.get<string>('GITHUB_CLIENT_ID'),
      clientSecret: configService.get<string>('GITHUB_CLIENT_SECRET'),
      callbackURL,
      scope: ['user:email'],
    });
  }

  async validate(
    accessToken: string,
    refreshToken: string,
    profile: any,
    done: any,
  ): Promise<any> {
    const { displayName, emails, photos, id } = profile;
    const user = await this.authService.validateOAuthUser({
      email: emails[0].value,
      name: displayName || emails[0].value.split('@')[0],
      avatar: photos[0]?.value,
      provider: 'github',
      providerId: id,
    });
    done(null, user);
  }
}
