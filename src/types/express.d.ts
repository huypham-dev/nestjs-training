// Modules
import { User } from '@/modules/user/user.entity';

declare global {
  namespace Express {
    interface Request {
      auth?: {
        authId: string;
        email?: string;
        fullName?: string;
      };
      user?: User;
    }
  }
}

export {};
